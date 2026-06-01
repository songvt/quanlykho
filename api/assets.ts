import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase, fetchAll } from './_utils/supabase.js';
import { randomUUID } from 'crypto';

const logAssetFluctuation = async (doc: any, logEntries: any | any[]) => {
    const entries = Array.isArray(logEntries) ? logEntries : [logEntries];
    const formattedEntries = entries.map(entry => ({
        ...entry,
        id: entry.id || randomUUID(),
        created_at: entry.created_at || new Date().toISOString()
    }));
    
    // 1. Supabase
    try {
        await supabase.from('asset_logs').insert(formattedEntries);
    } catch (sbErr) {
        console.error('[logAssetFluctuation] Supabase insert failed:', sbErr);
    }
    
    // 2. Google Sheets
    if (doc) {
        try {
            const logSheet = await getSheetByTitle(doc, 'asset_logs');
            const gsWritePromise = async () => {
                await logSheet.addRows(formattedEntries);
            };
            await Promise.race([
                gsWritePromise(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
            ]);
        } catch (e: any) {
            console.warn('GS Log Write fallback to queue:', e.message);
            await supabase.from('gs_sync_queue').insert({
                table_name: 'asset_logs',
                action: 'insert',
                payload: formattedEntries,
                error_message: e.message
            });
        }
    } else {
        console.warn('GS Log skipped: Google Sheets document not initialized');
        await supabase.from('gs_sync_queue').insert({
            table_name: 'asset_logs',
            action: 'insert',
            payload: formattedEntries,
            error_message: 'Google Sheets document not initialized during logAssetFluctuation'
        });
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;

    if (type === 'logs') {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }
        try {
            const data = await fetchAll('asset_logs', '*', (q) => q.order('created_at', { ascending: false }));
            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Lỗi lấy danh sách biến động tài sản asset_logs:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (type === 'handovers') {
        const handoverAllowedMethods = ['GET', 'POST', 'DELETE'];
        if (!handoverAllowedMethods.includes(req.method || '')) {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        try {
            if (req.method === 'GET') {
                try {
                    const { data, error } = await supabase
                        .from('asset_handovers')
                        .select('*')
                        .order('created_at', { ascending: false });
                    
                    if (error) throw error;
                    return res.status(200).json(data);
                } catch (err: any) {
                    console.error('Lỗi lấy danh sách bàn giao asset_handovers:', err);
                    return res.status(500).json({ error: err.message });
                }
            }

            if (req.method === 'POST') {
                const payload = req.body;
                const handoverId = payload.id || randomUUID();
                const processedPayload = {
                    ...payload,
                    id: handoverId,
                    created_at: payload.created_at || new Date().toISOString()
                };

                // 1. Supabase
                const { data, error } = await supabase
                    .from('asset_handovers')
                    .insert([processedPayload])
                    .select();
                
                if (error) throw error;

                // 2. Google Sheets (with fallback to queue)
                const gsRow = {
                    ...processedPayload,
                    items: typeof processedPayload.items === 'object' ? JSON.stringify(processedPayload.items) : processedPayload.items
                };
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'asset_handovers');
                    const writePromise = async () => {
                        await sheet.addRow(gsRow);
                    };
                    await Promise.race([
                        writePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.warn('GS Handover Write fallback to queue:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'asset_handovers',
                        action: 'insert',
                        payload: gsRow,
                        error_message: e.message
                    });
                }

                return res.status(201).json({ success: true, data: data[0] });
            }

            if (req.method === 'DELETE') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: 'ID required' });
                
                // 1. Supabase
                const { error } = await supabase
                    .from('asset_handovers')
                    .delete()
                    .eq('id', id);
                
                if (error) throw error;

                // 2. Google Sheets (with fallback to queue)
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'asset_handovers');
                    const deletePromise = async () => {
                        const rows = await sheet.getRows();
                        const rowToDelete = rows.find(row => row.get('id') === id);
                        if (rowToDelete) await rowToDelete.delete();
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.warn('GS Handover Delete fallback to queue:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'asset_handovers',
                        action: 'delete',
                        payload: { id },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ success: true });
            }
        } catch (err: any) {
            console.error('Lỗi server asset_handovers:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const data = await fetchAll('assets', '*', (q) => q.order('stt', { ascending: true }));
                return res.status(200).json(data);
            } catch (error: any) {
                console.warn('Supabase fetch failed, falling back to Google Sheets:', error);
            }
        }

        switch (req.method) {
            case 'GET': {
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'assets');
                    const rows = await sheet.getRows();
                    return res.status(200).json(rows.map(row => row.toObject()));
                } catch (gsErr: any) {
                    console.error('[Assets GET] Google Sheets fallback failed:', gsErr.message);
                    return res.status(500).json({ error: 'Failed to fetch assets from both sources' });
                }
            }

            case 'POST': {
                const { action, performed_by } = req.body;
                const creator = performed_by || 'Hệ thống';
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
                let doc: any = null;
                try {
                    doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'assets');
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

                // 3. Logging for fluctuations
                try {
                    const logEntries = processedItems.map((item: any) => ({
                        asset_code: item.asset_code,
                        asset_name: item.asset_name,
                        asset_type: item.asset_type,
                        asset_group: item.asset_group,
                        action: 'Tăng',
                        employee_name: item.user_employee_name || '',
                        employee_code: item.user_employee_code || '',
                        department: item.user_department_name || '',
                        performed_by: creator
                    }));
                    await logAssetFluctuation(doc, logEntries);
                } catch (logErr) {
                    console.error('Logging increase failed:', logErr);
                }

                return res.status(201).json(action === 'bulk_insert' ? (sbData || processedItems) : (sbData ? sbData[0] : processedItems[0]));
            }


            case 'PUT': {
                const { performed_by, ...updatedAsset } = req.body;
                const editor = performed_by || 'Hệ thống';
                if (!updatedAsset.id) return res.status(400).json({ error: 'Asset ID required' });
                
                // Fetch old state to detect changes for logging
                const { data: oldData } = await supabase.from('assets').select('*').eq('id', updatedAsset.id).single();

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase.from('assets').update(updatedAsset).eq('id', updatedAsset.id).select();
                if (sbError) {
                    console.error('SB Update Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Update Failed' });
                }

                // 2. Logging & Google Sheets
                let doc: any = null;
                try {
                    doc = await getGoogleSheet();
                } catch (docErr: any) {
                    console.warn('Could not initialize Google Sheets document for PUT asset:', docErr.message);
                }

                // Logging fluctuation
                if (oldData) {
                    const finalAsset = sbData ? sbData[0] : updatedAsset;
                    let logAction = 'Cập nhật';
                    let logDetails = '';
                    
                    const oldUser = oldData.user_employee_name || 'Kho';
                    const newUser = updatedAsset.user_employee_name !== undefined ? (updatedAsset.user_employee_name || 'Kho') : oldUser;

                    if (updatedAsset.status?.toLowerCase().includes('cấp phát')) {
                        logAction = 'Cấp phát';
                        logDetails = `Cấp phát cho: ${newUser}`;
                    } else if (updatedAsset.status?.toLowerCase().includes('điều chuyển')) {
                        logAction = 'Điều chuyển';
                        logDetails = `Điều chuyển từ [${oldUser}] sang [${newUser}]`;
                    } else if (updatedAsset.user_employee_name === '' || updatedAsset.status === 'Chưa sử dụng') {
                        logAction = 'Thu hồi';
                        logDetails = `Thu hồi từ [${oldUser}] về kho`;
                    } else if (updatedAsset.user_employee_name && updatedAsset.user_employee_name !== oldData.user_employee_name) {
                        logAction = 'Điều chuyển';
                        logDetails = `Thay đổi người sử dụng: ${oldUser} -> ${newUser}`;
                    }

                    try {
                        await logAssetFluctuation(doc, {
                            asset_code: finalAsset.asset_code || oldData.asset_code,
                            asset_name: finalAsset.asset_name || oldData.asset_name,
                            asset_type: finalAsset.asset_type || oldData.asset_type,
                            asset_group: finalAsset.asset_group || oldData.asset_group,
                            action: logAction,
                            details: logDetails,
                            employee_name: updatedAsset.user_employee_name ?? oldData.user_employee_name,
                            employee_code: updatedAsset.user_employee_code ?? oldData.user_employee_code,
                            department: updatedAsset.user_department_name ?? oldData.user_department_name,
                            performed_by: editor
                        });
                    } catch (logErr) {
                        console.error('Logging update failed:', logErr);
                    }
                }

                // 3. Google Sheets
                if (doc) {
                    try {
                        const sheet = await getSheetByTitle(doc, 'assets');
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
                } else {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'assets',
                        action: 'update',
                        payload: { id: updatedAsset.id, updates: updatedAsset },
                        error_message: 'Google Sheets document not initialized'
                    });
                }

                return res.status(200).json(sbData ? sbData[0] : updatedAsset);
            }

            case 'DELETE': {
                const { id, ids, performed_by } = req.body;
                const remover = performed_by || 'Hệ thống';
                const targetIds = ids && Array.isArray(ids) ? ids : [id];
                if (targetIds.length === 0) return res.status(400).json({ error: 'ID required' });
                
                // 1. Fetch info before deletion for logging
                const { data: assetsToDelete } = await supabase.from('assets').select('asset_code, asset_name, asset_type, asset_group').in('id', targetIds);

                // 2. Supabase
                const { error: sbError } = await supabase.from('assets').delete().in('id', targetIds);
                if (sbError) {
                    console.error('SB Delete Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Delete Failed' });
                }

                // 3. Initialize Google Sheets
                let doc: any = null;
                try {
                    doc = await getGoogleSheet();
                } catch (docErr: any) {
                    console.warn('Could not initialize Google Sheets document for DELETE assets:', docErr.message);
                }

                // 4. Logging for fluctuations (Decrease)
                if (assetsToDelete && assetsToDelete.length > 0) {
                    try {
                        const logEntries = assetsToDelete.map(item => ({
                            asset_code: item.asset_code,
                            asset_name: item.asset_name,
                            asset_type: item.asset_type,
                            asset_group: item.asset_group,
                            action: 'Giảm',
                            performed_by: remover
                        }));
                        await logAssetFluctuation(doc, logEntries);
                    } catch (logErr) {
                        console.error('Logging decrease failed:', logErr);
                    }
                }

                // 5. Google Sheets
                if (doc) {
                    try {
                        const sheet = await getSheetByTitle(doc, 'assets');
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
                } else {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'assets',
                        action: 'delete',
                        payload: { ids: targetIds },
                        error_message: 'Google Sheets document not initialized'
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
