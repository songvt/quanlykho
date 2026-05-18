import 'dotenv/config';
import { supabase } from '../api/utils/supabase';

async function main() {
    try {
        const { data: assetLogsData, error: err1 } = await supabase.from('asset_logs').select('*').limit(1);
        if (err1) {
            console.error('Error fetching asset_logs:', err1);
        } else if (assetLogsData && assetLogsData.length > 0) {
            console.log('ASSET_LOGS KEYS:', Object.keys(assetLogsData[0]));
        } else {
            // Let's query information_schema columns for asset_logs
            const { data: cols } = await supabase.rpc('get_table_columns', { table_name: 'asset_logs' });
            console.log('ASSET_LOGS KEYS (no rows):', cols);
        }

        const { data: auditData, error: err2 } = await supabase.from('inventory_audits').select('*').limit(1);
        if (err2) {
            console.error('Error fetching inventory_audits:', err2);
        } else if (auditData && auditData.length > 0) {
            console.log('INVENTORY_AUDITS KEYS:', Object.keys(auditData[0]));
        } else {
            console.log('INVENTORY_AUDITS: 0 rows');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
