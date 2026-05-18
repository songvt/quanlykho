import 'dotenv/config';
import { supabase } from '../api/utils/supabase';

const tablesToCheck = [
    'products',
    'employees',
    'orders',
    'inbound_transactions',
    'outbound_transactions',
    'employee_returns',
    'district_storekeepers',
    'assets',
    'asset_logs',
    'asset_handovers',
    'inventory_audits',
    'qr_logs',
    'settlement_history',
    'settlement_inventory_data',
    'settlement_outbound_data'
];

async function getSchemas() {
    console.log('--- Table Keys (Schema) from Supabase ---');
    for (const table of tablesToCheck) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.error(`❌ Table "${table}": error:`, error.message);
            } else if (data && data.length > 0) {
                console.log(`✅ Table "${table}":`, Object.keys(data[0]));
            } else {
                console.log(`ℹ️ Table "${table}": EXISTS but has 0 rows.`);
            }
        } catch (err: any) {
            console.error(`❌ Table "${table}" exception:`, err.message);
        }
    }
}

getSchemas();
