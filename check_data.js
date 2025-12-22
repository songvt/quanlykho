
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

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

async function checkData() {
    console.log('--- Check Specific Product Stock (Fuzzy) ---');
    const { data: fuzzyProds, error: fuzzErr } = await supabase.from('products').select('id, name').ilike('name', '%Cáp quang%').limit(5);

    if (fuzzErr) console.error(fuzzErr);
    else if (!fuzzyProds || fuzzyProds.length === 0) console.log('No products found matching "Cáp quang"');
    else {
        console.log(`Found ${fuzzyProds.length} matches.`);
        for (const p of fuzzyProds) {
            console.log(`Checking: ${p.name} (${p.id})`);
            const { data: specIn } = await supabase.from('inbound_transactions').select('quantity').eq('product_id', p.id);
            const { data: specOut } = await supabase.from('outbound_transactions').select('quantity').eq('product_id', p.id);
            const totalIn = (specIn || []).reduce((acc, curr) => acc + curr.quantity, 0);
            const totalOut = (specOut || []).reduce((acc, curr) => acc + curr.quantity, 0);
            console.log(`  > Stock: In=${totalIn}, Out=${totalOut}, Net=${totalIn - totalOut}`);
        }
    }

    // Also check total inbound count just to be sure
    const { count } = await supabase.from('inbound_transactions').select('*', { count: 'exact', head: true });
    console.log('Total Inbound Transactions in DB:', count);
}

checkData();
