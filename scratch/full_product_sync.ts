
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const fullSyncProducts = async () => {
    console.log('Starting full product sync from "product" sheet (with deduplication)...');

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

        const sourceSheet = doc.sheetsByTitle['product'];
        const targetSheet = doc.sheetsByTitle['products'];

        const sourceRows = await sourceSheet.getRows();
        console.log(`Found ${sourceRows.length} raw source products.`);

        const now = new Date().toISOString();
        const productsMap = new Map();

        sourceRows.forEach(r => {
            const rawId = String(r.get('product_id') || '').trim();
            if (!rawId) return;

            const unitPrice = parseFloat(String(r.get('unit_price') || '0').replace(/\./g, '').replace(/,/g, ''));

            // Use the last occurrence in case of duplicates, or keep first? 
            // Usually, keeping first or last is fine as long as it's consistent.
            productsMap.set(rawId, {
                id: rawId,
                item_code: rawId,
                name: r.get('product') || 'Unknown',
                unit: r.get('unit') || 'Cái',
                unit_price: isNaN(unitPrice) ? 0 : unitPrice,
                category: r.get('item') || 'General',
                created_at: now,
                updated_at: now
            });
        });

        const newProducts = Array.from(productsMap.values());
        console.log(`Processed ${newProducts.length} unique products.`);

        // 1. Supabase - Full Refresh
        const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
        
        console.log('Clearing Supabase products table...');
        // TRUNCATE is safer if we have permission, but delete all is fine.
        await supabase.from('products').delete().neq('id', 'placeholder');

        console.log('Inserting into Supabase...');
        const chunkSize = 500;
        for (let i = 0; i < newProducts.length; i += chunkSize) {
            const chunk = newProducts.slice(i, i + chunkSize);
            const { error: insError } = await supabase.from('products').insert(chunk);
            if (insError) console.error(`Supabase Insert Error (Chunk ${i}):`, insError);
        }
        console.log('Supabase sync complete.');

        // 2. Google Sheets - Full Refresh
        console.log('Clearing Google Sheet: products...');
        await targetSheet.clearRows();
        
        console.log('Inserting into Google Sheets...');
        await targetSheet.addRows(newProducts.map(p => ({
            ...p,
            unit_price: p.unit_price.toString()
        })));
        console.log('Google Sheets sync complete.');

    } catch (e) {
        console.error('Sync Error:', e);
    }
};

fullSyncProducts();
