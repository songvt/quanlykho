import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './utils/supabase.js';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Fetch pending jobs (chỉ lấy job chưa vượt 3 lần retry)
        const { data: queue, error: fetchError } = await supabase
            .from('gs_sync_queue')
            .select('*')
            .eq('status', 'pending')
            .lt('retry_count', 3)
            .order('created_at', { ascending: true })
            .limit(10);

        if (fetchError) throw fetchError;

        if (!queue || queue.length === 0) {
            return res.status(200).json({ message: 'No pending items to sync' });
        }

        const doc = await getGoogleSheet();
        const results = { successful: 0, failed: 0 };

        for (const job of queue) {
            const { id, table_name, action, payload } = job;
            const sheet = doc.sheetsByTitle[table_name];

            if (!sheet) {
                await supabase.from('gs_sync_queue').update({ status: 'failed', error_message: `Sheet ${table_name} not found` }).eq('id', id);
                results.failed++;
                continue;
            }

            try {
                const pk = table_name === 'district_storekeepers' ? 'district' : 'id';

                if (action === 'insert') {
                    const items = Array.isArray(payload) ? payload : [payload];
                    // Add rows incrementally with smaller chunks and delay to avoid limits
                    const chunkSize = 100;
                    for (let i = 0; i < items.length; i += chunkSize) {
                        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000)); // Nghỉ 1s giữa các chunk
                        const chunk = items.slice(i, i + chunkSize);
                        await sheet.addRows(chunk);
                    }
                } else if (action === 'update') {
                    const rows = await sheet.getRows();
                    const targetId = payload[pk] || payload.id;
                    const updates = payload.updates || payload;
                    const row = rows.find(r => r.get(pk) === targetId);
                    if (row) {
                        Object.keys(updates).forEach(k => { if (updates[k] !== undefined) row.set(k, updates[k]); });
                        if (!updates.updated_at && row.get('updated_at') !== undefined) row.set('updated_at', formatLocalDate(new Date()));
                        await row.save();
                        await new Promise(resolve => setTimeout(resolve, 300)); // Nghỉ 300ms sau khi save
                    }
                } else if (action === 'delete') {
                    const rows = await sheet.getRows();
                    const targetIds = payload.ids || [payload[pk] || payload.id];
                    let deletedCount = 0;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get(pk))) {
                            await rows[i].delete();
                            deletedCount++;
                            // Cứ xóa 5 dòng thì nghỉ 1s, còn không thì nghỉ 300ms
                            if (deletedCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                            else await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                }

                // Mark as done
                await supabase.from('gs_sync_queue').delete().eq('id', id);
                results.successful++;

            } catch (jobError: any) {
                console.error(`Job ${id} failed:`, jobError);
                await supabase.from('gs_sync_queue').update({ 
                    status: 'failed', 
                    error_message: jobError.message,
                    retry_count: (job.retry_count || 0) + 1 
                }).eq('id', id);
                results.failed++;
            }
        }

        return res.status(200).json({ message: 'Sync cycle completed', results });

    } catch (e: any) {
        console.error('Cron Sync Error:', e);
        return res.status(500).json({ error: 'Sync failed', details: e.message });
    }
}
