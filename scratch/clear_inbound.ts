
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const clearData = async () => {
    console.log('Starting clear process...');

    // 1. Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!; // Assuming anon key has delete rights for now, or use service role if available
    // Note: If RLS is on, anon key might not be enough. I'll use the SQL tool for Supabase instead.
    
    // 2. Google Sheets
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
        const privateKey = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n');
        const sheetId = process.env.GOOGLE_SHEET_ID!;

        const auth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, auth);
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['inbound_transactions'];

        if (sheet) {
            console.log('Clearing Google Sheet: inbound_transactions...');
            const rows = await sheet.getRows();
            console.log(`Found ${rows.length} rows to delete.`);
            
            // Delete rows in reverse to avoid index issues
            // Optimization: clearRows is not available in google-spreadsheet v4 easily for large sets
            // Better to just clear the range
            await sheet.clearRows(); 
            console.log('Google Sheet cleared.');
        } else {
            console.error('Sheet "inbound_transactions" not found.');
        }
    } catch (e) {
        console.error('Error clearing Google Sheet:', e);
    }
};

clearData();
