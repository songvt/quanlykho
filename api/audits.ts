import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase } from './_utils/supabase.js';
import { randomUUID } from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;

    if (type === 'qr') {
        const qrAllowedMethods = ['GET', 'POST'];
        if (!qrAllowedMethods.includes(req.method || '')) {
            return res.status(405).json({ error: 'Method Not Allowed' });
        }

        try {
            if (req.method === 'GET') {
                const { data, error } = await supabase
                    .from('qr_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500);
                
                if (error) throw error;
                return res.status(200).json(data);
            }

            if (req.method === 'POST') {
                const { action, doc_title, total_serials, total_qrs, created_by, details } = req.body;
                
                if (!action) return res.status(400).json({ error: 'Action is required' });

                const logId = randomUUID();
                const logCreatedAt = new Date().toISOString();
                const logEntry = {
                    id: logId,
                    created_at: logCreatedAt,
                    action,
                    doc_title: doc_title || '',
                    total_serials: Number(total_serials) || 0,
                    total_qrs: Number(total_qrs) || 0,
                    created_by: created_by || 'unknown',
                    details: details || {}
                };

                // 1. Supabase
                const { data, error } = await supabase
                    .from('qr_logs')
                    .insert([logEntry])
                    .select();

                if (error) {
                    console.error('Lỗi khi lưu QR log Supabase:', error);
                    return res.status(500).json({ error: error.message });
                }

                // 2. Google Sheets
                const gsRow = {
                    ...logEntry,
                    details: typeof logEntry.details === 'object' ? JSON.stringify(logEntry.details) : logEntry.details
                };

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'qr_logs');
                    const writePromise = async () => {
                        await sheet.addRow(gsRow);
                    };
                    await Promise.race([
                        writePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.warn('GS QR Log Write fallback to queue:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'qr_logs',
                        action: 'insert',
                        payload: gsRow,
                        error_message: e.message
                    });
                }

                return res.status(200).json({ success: true, data: data?.[0] });
            }
        } catch (err: any) {
            console.error('Lỗi server qr_logs:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    const allowedMethods = ['GET', 'POST'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('inventory_audits')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (req.method === 'POST') {
            const payload = req.body;
            const auditId = payload.id || randomUUID();
            const processedPayload = {
                ...payload,
                id: auditId,
                created_at: payload.created_at || new Date().toISOString()
            };

            // 1. Supabase
            const { data, error } = await supabase
                .from('inventory_audits')
                .insert([processedPayload])
                .select();
            
            if (error) throw error;

            // 2. Google Sheets
            const gsRow = {
                ...processedPayload,
                details: typeof processedPayload.details === 'object' ? JSON.stringify(processedPayload.details) : processedPayload.details
            };

            try {
                const doc = await getGoogleSheet();
                const sheet = await getSheetByTitle(doc, 'inventory_audits');
                const writePromise = async () => {
                    await sheet.addRow(gsRow);
                };
                await Promise.race([
                    writePromise(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                ]);
            } catch (e: any) {
                console.warn('GS Audit Write fallback to queue:', e.message);
                await supabase.from('gs_sync_queue').insert({
                    table_name: 'inventory_audits',
                    action: 'insert',
                    payload: gsRow,
                    error_message: e.message
                });
            }

            return res.status(201).json({ success: true, data: data[0] });
        }

    } catch (err: any) {
        console.error('Lỗi server audits:', err);
        return res.status(500).json({ error: err.message });
    }
}
