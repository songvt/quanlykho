import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
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

        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'asset_handovers');

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
