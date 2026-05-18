import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load ENV
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const candidateTables = [
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
    'settlement_outbound_data',
    'gs_sync_queue'
];

async function checkTables() {
    console.log('--- Checking Supabase Tables ---');
    for (const table of candidateTables) {
        try {
            const { data, error, count } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: false })
                .limit(2);
            
            if (error) {
                if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
                    console.log(`❌ Table "${table}" does not exist or not accessible:`, error.message);
                } else {
                    console.log(`⚠️ Table "${table}" returned error:`, error.message);
                }
            } else {
                console.log(`✅ Table "${table}" EXISTS. Row count: ${count}. Row sample keys:`, data.length > 0 ? Object.keys(data[0]) : 'No rows');
            }
        } catch (err) {
            console.log(`❌ Error checking table "${table}":`, err.message);
        }
    }
}

checkTables();
