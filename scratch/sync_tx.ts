import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function sync() {
    console.log("Fetching from Google Sheets API...");
    try {
        const doc = await getGoogleSheet();
        const outboundSheet = await getSheetByTitle(doc, 'outbound_transactions');
        const rows = await outboundSheet.getRows();
        const records = rows.map(r => r.toObject());
        console.log(`Found ${records.length} records in Google Sheets`);
        
        let successCount = 0;
        for (const r of records) {
            if (!r.id) continue;
            
            // Format date correctly
            let isoDate = new Date().toISOString();
            if (r.outbound_date) {
                const parts = r.outbound_date.split('/');
                if (parts.length === 3) {
                    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                    if (!isNaN(d.getTime())) isoDate = d.toISOString();
                } else {
                    const d = new Date(r.outbound_date);
                    if (!isNaN(d.getTime())) isoDate = d.toISOString();
                }
            }

            const { error } = await supabase.from('outbound_transactions').upsert({
                id: r.id,
                product_id: r.product_id,
                quantity: Number(r.quantity),
                unit_price: Number(r.unit_price || 0),
                outbound_date: isoDate,
                item_status: r.item_status || 'Mới',
                created_by: r.created_by,
                user_id: r.user_id,
                receiver_name: r.receiver_name,
                receiver_group: r.receiver_group,
                group_name: r.group_name,
                serial_code: r.serial_code,
                district: r.district,
                created_at: r.created_at ? new Date(r.created_at).toISOString() : isoDate,
                updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : isoDate
            });
            if (error) {
                console.error("Error syncing", r.id, error.message);
            } else {
                successCount++;
            }
        }
        console.log(`Successfully synced ${successCount} outbound transactions to Supabase`);
    } catch (e) {
        console.error(e);
    }
}
sync();
