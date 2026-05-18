import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, fetchAll } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        switch (req.method) {
            case 'GET': {
                const { month } = req.query;
                if (month) {
                    const data = await fetchAll(
                        'settlement_history',
                        '*',
                        (q) => q.eq('month', month as string).order('item_code')
                    );
                    return res.status(200).json(data);
                }
                const data = await fetchAll('settlement_history', '*', (q) => q.order('item_code'));
                return res.status(200).json(data);
            }

            case 'POST': {
                const { payload } = req.body;
                if (!payload) return res.status(400).json({ error: 'Payload required' });
                
                const itemsToInsert = Array.isArray(payload) ? payload : [payload];
                const CHUNK_SIZE = 500;
                let insertedCount = 0;

                for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
                    const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase
                        .from('settlement_history')
                        .upsert(chunk, { onConflict: 'month,item_name' });
                    
                    if (error) throw error;
                    insertedCount += chunk.length;

                    // QUEUE SYNC TO GOOGLE SHEETS
                    try {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'settlement_history',
                            action: 'insert',
                            payload: chunk
                        });
                    } catch (gsError) {
                        console.error('[Dual-Write] Failed to queue GS sync:', gsError);
                    }
                }
                
                return res.status(201).json({ success: true, count: insertedCount });
            }

            case 'DELETE': {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const { error } = await supabase
                    .from('settlement_history')
                    .delete()
                    .eq('month', month);
                
                if (error) throw error;
                return res.status(200).json({ message: `Deleted settlement for ${month}` });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Settlement History):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
