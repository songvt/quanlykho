import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { action } = req.query;

    try {
        if (action === 'dashboard') {
            const { data, error } = await supabase.rpc('get_dashboard_stats');
            if (error) throw error;
            return res.status(200).json(data);
        }

        if (action === 'fifo_aging') {
            const { data, error } = await supabase.rpc('get_fifo_inventory_aging');
            if (error) throw error;
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: 'Invalid action. Supported: dashboard, fifo_aging' });
    } catch (error: any) {
        console.error(`[Stats API] Error (${action}):`, error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
