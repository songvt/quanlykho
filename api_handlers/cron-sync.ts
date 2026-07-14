import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { runSyncQueue } from './_utils/syncQueue.js';
import { supabase } from './_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Khôi phục các job bị kẹt ở trạng thái processing do serverless functions bị timeout
        await supabase.from('gs_sync_queue').update({ status: 'pending' }).eq('status', 'processing');

        let totalResults = { successful: 0, failed: 0 };
        while (true) {
            const results: any = await runSyncQueue();
            if (results?.message === 'No pending items' || !results) {
                break;
            }
            if (results.successful !== undefined) {
                totalResults.successful += results.successful;
                totalResults.failed += results.failed;
            }
            // Sleep 1s to avoid Google Sheets API rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return res.status(200).json({ message: 'Sync cycle completed', results: totalResults });
    } catch (e: any) {
        console.error('Cron Sync Error:', e);
        return res.status(500).json({ error: 'Sync failed', details: e.message });
    }
}
