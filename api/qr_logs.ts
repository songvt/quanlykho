import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    try {
        switch (req.method) {
            case 'GET': {
                const { data, error } = await supabase
                    .from('qr_logs')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500);
                
                if (error) throw error;
                return res.status(200).json(data);
            }

            case 'POST': {
                const { action, doc_title, total_serials, total_qrs, created_by, details } = req.body;
                
                // Validate required fields
                if (!action) return res.status(400).json({ error: 'Action is required' });

                const { data, error } = await supabase
                    .from('qr_logs')
                    .insert([{
                        action,
                        doc_title: doc_title || '',
                        total_serials: Number(total_serials) || 0,
                        total_qrs: Number(total_qrs) || 0,
                        created_by: created_by || 'unknown',
                        details: details || {}
                    }])
                    .select();

                if (error) {
                    console.error('Lỗi khi lưu QR log:', error);
                    return res.status(500).json({ error: error.message });
                }

                return res.status(200).json({ success: true, data: data?.[0] });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (err: any) {
        console.error('Lỗi server qr_logs:', err);
        return res.status(500).json({ error: err.message });
    }
}
