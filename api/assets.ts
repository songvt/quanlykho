import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase, fetchAll } from './utils/supabase.js';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const data = await fetchAll('assets', '*', (q) => q.order('created_at', { ascending: false }));
                return res.status(200).json(data);
            } catch (error: any) {
                console.warn('Supabase fetch failed, falling back to Google Sheets:', error);
            }
        }

        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'assets');

        switch (req.method) {
            case 'GET': {
                const rows = await sheet.getRows();
                return res.status(200).json(rows.map(row => row.toObject()));
            }

            case 'POST': {
                const { action } = req.body;
                const itemsToInsert = (req.body.payload as any[]).map(item => ({
                    ...item,
                    id: item.id || randomUUID()
                }));

                // Get current max stt to auto-increment
                const { data: maxSttRow } = await supabase
                    .from('assets')
                    .select('stt')
                    .order('stt', { ascending: false })
                    .limit(1);
                let nextStt = (maxSttRow && maxSttRow[0]?.stt) ? (maxSttRow[0].stt + 1) : 1;

                const processedItems = itemsToInsert.map((item: any) => {
                    const cleaned: any = { ...item, stt: nextStt++ };
                    for (const [k, v] of Object.entries(item)) {
                        if (v === undefined || v === null || v === '') {
                            delete cleaned[k];
                        }
                    }
                    return cleaned;
                });

                // 1. Supabase upsert
                const { data: sbData, error: sbError } = await supabase
                    .from('assets')
                    .upsert(processedItems, { onConflict: 'asset_code', ignoreDuplicates: false })
                    .select();
                if (sbError) {
                    console.error('SB Write Error:', JSON.stringify(sbError));
                    return res.status(500).json({ error: 'Supabase Write Failed', details: sbError.message });
                }

                // 2. Google Sheets (non-blocking, fire-and-forget with timeout)
                try {
                    const gsWritePromise = async () => {
                        if (action === 'bulk_insert') await sheet.addRows(processedItems);
                        else await sheet.addRow(processedItems[0]);
                    };
                    await Promise.race([
                        gsWritePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 4500))
                    ]);
                } catch (e: any) {
                    console.warn('GS Write fallback to queue:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'assets',
                        action: 'insert',
                        payload: processedItems,
                        error_message: e.message
                    });
                }

                return res.status(201).json(action === 'bulk_insert' ? (sbData || processedItems) : (sbData ? sbData[0] : processedItems[0]));
            }


            case 'PUT': {
                const updatedAsset = req.body;
                if (!updatedAsset.id) return res.status(400).json({ error: 'Asset ID required' });
                
                // Fetch old state to detect changes for logging
                const { data: oldData } = await supabase.from('assets').select('*').eq('id', updatedAsset.id).single();

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase.from('assets').update(updatedAsset).eq('id', updatedAsset.id).select();
                if (sbError) {
                    console.error('SB Update Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Update Failed' });
                }

                // 2. Logging if status or user changed
                if (oldData && (updatedAsset.status || updatedAsset.user_employee_name !== undefined)) {
                    const finalAsset = sbData ? sbData[0] : updatedAsset;
                    let logAction = 'Cập nhật';
                    if (updatedAsset.status?.toLowerCase().includes('cấp phát')) logAction = 'Cấp phát';
                    else if (updatedAsset.status?.toLowerCase().includes('điều chuyển')) logAction = 'Điều chuyển';
                    else if (updatedAsset.user_employee_name === '' || updatedAsset.status === 'Chưa sử dụng') logAction = 'Thu hồi';

                    await supabase.from('asset_logs').insert({
                        asset_code: finalAsset.asset_code || oldData.asset_code,
                        asset_name: finalAsset.asset_name || oldData.asset_name,
                        action: logAction,
                        employee_name: updatedAsset.user_employee_name ?? oldData.user_employee_name,
                        employee_code: updatedAsset.user_employee_code ?? oldData.user_employee_code,
                        department: updatedAsset.user_department_name ?? oldData.user_department_name,
                        performed_by: 'Hệ thống' // Can be updated to use actual user session if available
                    });
                }

                // 3. Google Sheets
                try {
                    const updatePromise = async () => {
                        const rows = await sheet.getRows();
                        const row = rows.find(r => r.get('id') === updatedAsset.id);
                        if (row) { row.assign(updatedAsset); await row.save(); }
                    };
                    await Promise.race([
                        updatePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) { 
                    console.error('GS Update Error:', e); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'assets',
                        action: 'update',
                        payload: { id: updatedAsset.id, updates: updatedAsset },
                        error_message: e.message
                    });
                }

                return res.status(200).json(sbData ? sbData[0] : updatedAsset);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = ids && Array.isArray(ids) ? ids : [id];
                if (targetIds.length === 0) return res.status(400).json({ error: 'ID required' });
                
                // 1. Supabase
                const { error: sbError } = await supabase.from('assets').delete().in('id', targetIds);
                if (sbError) {
                    console.error('SB Delete Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Delete Failed' });
                }

                // 2. Google Sheets
                try {
                    const deletePromise = async () => {
                        const rows = await sheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                        }
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) { 
                    console.error('GS Delete Error:', e); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'assets',
                        action: 'delete',
                        payload: { ids: targetIds },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ message: 'Deleted successfully', ids: targetIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Assets):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
