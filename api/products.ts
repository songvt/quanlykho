import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'products');

        switch (req.method) {
            case 'GET': {
                // High performance fetch from Supabase (paginated to handle >1000 items)
                try {
                    const { fetchAll } = await import('./utils/supabase.js');
                    const data = await fetchAll('products', '*', (q) => q.order('name'));
                    return res.status(200).json(data);
                } catch (error: any) {
                    console.warn('Supabase fetch failed, falling back to Google Sheets:', error);
                    const rows = await sheet.getRows();
                    return res.status(200).json(rows.map(row => row.toObject()));
                }
                return res.status(200).json(data);
            }

            case 'POST': {
                const { action, payload } = req.body;
                let itemsToInsert = action === 'bulk_insert' ? payload : [payload];
                
                // Ensure ID consistency: use item_code as id if id is missing
                itemsToInsert = itemsToInsert.map((item: any) => ({
                    ...item,
                    id: item.id || item.item_code
                }));

                let successCount = 0;

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase.from('products').insert(itemsToInsert).select();
                if (!sbError) successCount++;
                else console.error('SB Write Error:', sbError);

                // 2. Google Sheets
                try {
                    if (action === 'bulk_insert') await sheet.addRows(itemsToInsert);
                    else await sheet.addRow(itemsToInsert[0]);
                    successCount++;
                } catch (e) { console.error('GS Write Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'All database writes failed' });
                return res.status(201).json(action === 'bulk_insert' ? (sbData || itemsToInsert) : (sbData ? sbData[0] : itemsToInsert[0]));
            }

            case 'PUT': {
                const updatedProduct = req.body;
                if (!updatedProduct.id) return res.status(400).json({ error: 'Product ID required' });
                let successCount = 0;

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase.from('products').update(updatedProduct).eq('id', updatedProduct.id).select();
                if (!sbError) successCount++;
                else console.error('SB Update Error:', sbError);

                // 2. Google Sheets
                try {
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.get('id') === updatedProduct.id);
                    if (row) { row.assign(updatedProduct); await row.save(); successCount++; }
                } catch (e) { console.error('GS Update Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'All database updates failed' });
                return res.status(200).json(sbData ? sbData[0] : updatedProduct);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = ids && Array.isArray(ids) ? ids : [id];
                if (targetIds.length === 0) return res.status(400).json({ error: 'ID required' });
                let successCount = 0;

                // 1. Supabase
                const { error: sbError } = await supabase.from('products').delete().in('id', targetIds);
                if (!sbError) successCount++;
                else console.error('SB Delete Error:', sbError);

                // 2. Google Sheets
                try {
                    const rows = await sheet.getRows();
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                    }
                    successCount++;
                } catch (e) { console.error('GS Delete Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'All database deletes failed' });
                return res.status(200).json({ message: 'Deleted successfully', ids: targetIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Products):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
