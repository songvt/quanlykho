import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual .env parsing
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
        env[key.trim()] = value.trim();
    }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

console.log('URL:', supabaseUrl);
console.log('Key:', supabaseKey ? 'Found' : 'Missing');

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
    console.log('--- Testing SignUp ---');
    const { data: signData, error: signError } = await supabase.auth.signUp({
        email: 'test' + Math.floor(Math.random() * 1000) + '@example.com',
        password: 'password123'
    });

    if (signError) {
        console.error('SignUp Error:', signError);
    } else {
        console.log('SignUp Success:', signData.user?.id);
    }

    console.log('--- Testing Login ---');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'password123'
    });

    if (authError) {
        console.error('Login Error:', authError);
    } else {
        console.log('Login successful! User ID:', authData.user.id);
    }

    // Only query employees if login succeeded to get a token, but here we use anon client which might fail RLS if not authenticated.
    // However, we just want to see if the TABLE is queryable at all (schema error check).

    console.log('--- Testing Employees Query (as Anon) ---');
    // Note: This will likely fail RLS but shouldn't fail with "Database error querying schema" if schema is OK.
    const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .limit(1);

    if (empError) {
        console.error('Employees Query Error:', JSON.stringify(empError, null, 2));
    } else {
        console.log('Employees Query Success:', empData);
    }
}

testConnection();
