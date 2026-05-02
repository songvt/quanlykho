import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function sync() {
    console.log("Fetching from Google Sheets API...");
    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'orders');
        const rows = await sheet.getRows();
        const records = rows.map(r => r.toObject());
        console.log(`Found ${records.length} records in Google Sheets`);
        
        let successCount = 0;
        for (const r of records) {
            if (!r.id) continue;
            
            // Format order_date correctly
            let isoDate = new Date().toISOString();
            if (r.order_date) {
                const parts = r.order_date.split('/');
                if (parts.length === 3) {
                    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    if (!isNaN(d.getTime())) isoDate = d.toISOString();
                } else {
                    const d = new Date(r.order_date);
                    if (!isNaN(d.getTime())) isoDate = d.toISOString();
                }
            }

            const { error } = await supabase.from('orders').upsert({
                id: r.id,
                product_id: r.product_id,
                quantity: Number(r.quantity),
                requester_group: r.requester_group,
                order_date: isoDate,
                status: r.status || 'pending',
                project_name: r.project_name,
                created_by: r.created_by,
                approved_by: r.approved_by,
                approved_at: r.approved_at ? new Date(r.approved_at).toISOString() : null,
                reason: r.reason,
                created_at: r.created_at ? new Date(r.created_at).toISOString() : isoDate,
                updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : isoDate
            });
            if (error) {
                console.error("Error syncing", r.id, error);
            } else {
                successCount++;
            }
        }
        console.log(`Successfully synced ${successCount} orders to Supabase`);
    } catch (e) {
        console.error(e);
    }
}
sync();
