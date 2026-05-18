import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('asset_logs')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return res.status(200).json(data);
        } catch (err: any) {
            console.error('Lỗi lấy danh sách biến động tài sản asset_logs:', err);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
