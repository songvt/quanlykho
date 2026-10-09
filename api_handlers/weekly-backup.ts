import { VercelRequest, VercelResponse } from '@vercel/node';
import { createWeeklyBackup } from './_utils/weeklyBackup.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'Unauthorized cron invocation' });
    }
    try {
        const backup = await createWeeklyBackup();
        return res.status(201).json({ message: 'Weekly backup created', backup });
    } catch (error: any) {
        console.error('[Weekly Backup] Failed:', error);
        return res.status(500).json({ error: error.message || 'Weekly backup failed' });
    }
}
