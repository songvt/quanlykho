import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase } from './_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const { data, error } = await supabase
                    .from('district_storekeepers')
                    .select('*')
                    .order('district', { ascending: true });
                
                if (!error && data && data.length > 0) {
                    return res.status(200).json(data);
                }
            } catch (sbErr) {
                console.warn('Lỗi đọc district_storekeepers từ Supabase, fallback về Google Sheets:', sbErr);
            }

            // Fallback to Google Sheets
            const doc = await getGoogleSheet();
            const sheet = await getSheetByTitle(doc, 'district_storekeepers');
            const rows = await sheet.getRows();
            const items = rows.map(row => row.toObject());
            return res.status(200).json(items);
        }

        if (req.method === 'POST' || req.method === 'PUT') {
            const { district, storekeeper_name } = req.body;

            if (!district || !storekeeper_name) {
                return res.status(400).json({ error: 'district and storekeeper_name are required' });
            }

            const now = new Date().toISOString();
            const payload = {
                district,
                storekeeper_name,
                updated_at: now
            };

            // 1. Supabase (primary)
            const { data: existing } = await supabase
                .from('district_storekeepers')
                .select('*')
                .eq('district', district)
                .single();

            let isInsert = true;
            let sbResult;

            if (existing) {
                isInsert = false;
                const { data, error } = await supabase
                    .from('district_storekeepers')
                    .update(payload)
                    .eq('district', district)
                    .select();
                if (error) throw error;
                sbResult = data[0];
            } else {
                const insertPayload = { ...payload, created_at: now };
                const { data, error } = await supabase
                    .from('district_storekeepers')
                    .insert([insertPayload])
                    .select();
                if (error) throw error;
                sbResult = data[0];
            }

            // 2. Google Sheets with Queue Fallback
            try {
                const doc = await getGoogleSheet();
                const sheet = await getSheetByTitle(doc, 'district_storekeepers');
                const writePromise = async () => {
                    const rows = await sheet.getRows();
                    const existingRow = rows.find(row => row.get('district') === district);
                    if (existingRow) {
                        existingRow.set('storekeeper_name', storekeeper_name);
                        existingRow.set('updated_at', now);
                        await existingRow.save();
                    } else {
                        await sheet.addRow({
                            district,
                            storekeeper_name,
                            created_at: now,
                            updated_at: now
                        });
                    }
                };

                await Promise.race([
                    writePromise(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                ]);
            } catch (e: any) {
                console.error('Lỗi đồng bộ Google Sheets, đẩy vào hàng đợi:', e.message);
                await supabase.from('gs_sync_queue').insert({
                    table_name: 'district_storekeepers',
                    action: isInsert ? 'insert' : 'update',
                    payload: isInsert ? { district, storekeeper_name, created_at: now, updated_at: now } : { district, storekeeper_name, updated_at: now },
                    error_message: e.message
                });
            }

            return res.status(isInsert ? 201 : 200).json(sbResult);
        }

        if (req.method === 'DELETE') {
            const { district } = req.body;
            if (!district) {
                return res.status(400).json({ error: 'Provide "district" to delete' });
            }

            // 1. Supabase
            const { error } = await supabase
                .from('district_storekeepers')
                .delete()
                .eq('district', district);
            
            if (error) throw error;

            // 2. Google Sheets with Queue Fallback
            try {
                const doc = await getGoogleSheet();
                const sheet = await getSheetByTitle(doc, 'district_storekeepers');
                const deletePromise = async () => {
                    const rows = await sheet.getRows();
                    const rowToDelete = rows.find(row => row.get('district') === district);
                    if (rowToDelete) await rowToDelete.delete();
                };

                await Promise.race([
                    deletePromise(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                ]);
            } catch (e: any) {
                console.error('Lỗi đồng bộ xóa Google Sheets, đẩy vào hàng đợi:', e.message);
                await supabase.from('gs_sync_queue').insert({
                    table_name: 'district_storekeepers',
                    action: 'delete',
                    payload: { district },
                    error_message: e.message
                });
            }

            return res.status(200).json({ message: 'Deleted successfully', district });
        }

    } catch (error: any) {
        console.error('API Error (District Storekeepers):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
