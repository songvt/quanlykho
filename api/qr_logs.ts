import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('qr_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(500); // Lấy 500 bản ghi gần nhất
            
            if (error) throw error;
            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Lỗi lấy QR logs:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { action, doc_title, total_serials, total_qrs, created_by, details } = req.body;

        const { data, error } = await supabase
            .from('qr_logs')
            .insert([{
                action,
                doc_title,
                total_serials,
                total_qrs,
                created_by,
                details
            }]);

        if (error) {
            console.error('Lỗi khi lưu QR log:', error);
            return res.status(500).json({ error: error.message });
        }

        return res.status(200).json({ success: true, data });
    } catch (err: any) {
        console.error('Lỗi server qr_logs:', err);
        return res.status(500).json({ error: err.message });
    }
}
