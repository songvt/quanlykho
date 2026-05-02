import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envConfig = dotenv.parse(fs.readFileSync(path.resolve('.env')));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function sync() {
    console.log("Fetching from Google Sheets API...");
    try {
        const res = await fetch('https://coral-antonym-451903-t5.vercel.app/api/orders'); // the deployed API
        // actually let's just query supabase to see if it's empty
        const { data, error } = await supabase.from('orders').select('*');
        console.log("Supabase orders:", data?.length, error);
    } catch (e) {
        console.error(e);
    }
}
sync();
