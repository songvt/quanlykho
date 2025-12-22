
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
    console.log('--- Testing get_inventory_summary RPC ---');

    try {
        const { data, error } = await supabase.rpc('get_inventory_summary');

        if (error) {
            console.error('RPC Error:', error);
            return;
        }

        if (!data || data.length === 0) {
            console.log('RPC returned NO DATA.');
        } else {
            console.log(`RPC returned ${data.length} rows.`);
            console.log('Sample rows:', data.slice(0, 5));
        }

        // Check if any stock > 0
        const totalStock = data.reduce((acc, curr) => acc + Number(curr.total_quantity || 0), 0);
        console.log('Total System Stock Sum:', totalStock);

    } catch (err) {
        console.error('Script Error:', err);
    }
}

verifyRPC();
