import 'dotenv/config';
import { supabase } from '../api/utils/supabase.js';

async function queueExistingData() {
    try {
        console.log('Fetching existing settlement_history data...');
        const { data, error } = await supabase.from('settlement_history').select('*');
        if (error) throw error;

        if (data && data.length > 0) {
            console.log(`Queuing ${data.length} rows for sync...`);
            const { error: queueError } = await supabase.from('gs_sync_queue').insert({
                table_name: 'settlement_history',
                action: 'insert',
                payload: data
            });
            if (queueError) throw queueError;
            console.log('Successfully queued.');
        } else {
            console.log('No data to queue.');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

queueExistingData();
