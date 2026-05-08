import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('inventory_audits')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Lỗi lấy inventory_audits:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const payload = req.body;
            const { data, error } = await supabase
                .from('inventory_audits')
                .insert([payload])
                .select();
            
            if (error) throw error;
            return res.status(201).json({ success: true, data: data[0] });
        } catch (err: any) {
            console.error('Lỗi lưu inventory_audits:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
