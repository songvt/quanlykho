
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

async function verifyRPC() {
    console.log('--- Testing get_dashboard_stats RPC ---');
    try {
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (error) {
            console.error('get_dashboard_stats Error:', error);
        } else {
            console.log('get_dashboard_stats SUCCESS!');
            console.log('Keys returned:', Object.keys(data));
            console.log('Total Products:', data.total_products);
            console.log('Total Inventory:', data.total_inventory);
        }
    } catch (err) {
        console.error('get_dashboard_stats Script Error:', err);
    }

    console.log('\n--- Testing get_fifo_inventory_aging RPC ---');
    try {
        const { data, error } = await supabase.rpc('get_fifo_inventory_aging');
        if (error) {
            console.error('get_fifo_inventory_aging Error:', error);
        } else {
            console.log('get_fifo_inventory_aging SUCCESS!');
            console.log(`Returned ${data?.length || 0} aging rows.`);
            if (data && data.length > 0) {
                console.log('Sample row:', data[0]);
            }
        }
    } catch (err) {
        console.error('get_fifo_inventory_aging Script Error:', err);
    }
}

verifyRPC();
