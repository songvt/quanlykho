import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { runSyncQueue } from './_utils/syncQueue.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const results = await runSyncQueue();
        return res.status(200).json({ message: 'Sync cycle completed', results });
    } catch (e: any) {
        console.error('Cron Sync Error:', e);
        return res.status(500).json({ error: 'Sync failed', details: e.message });
    }
}
