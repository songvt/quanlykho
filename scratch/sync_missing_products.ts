
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const syncMissingProducts = async () => {
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

        const stockSheet = doc.sheetsByTitle['in_stock'];
        const productsSheet = doc.sheetsByTitle['products'];
        const productSourceSheet = doc.sheetsByTitle['product']; // Source of names

        const [sRows, pRows, sourceRows] = await Promise.all([
            stockSheet.getRows(),
            productsSheet.getRows(),
            productSourceSheet.getRows()
        ]);

        const existingProductIds = new Set(pRows.map(r => String(r.get('id') || r.get('item_code') || '').trim()));
        const sourceMap = new Map();
        sourceRows.forEach(r => {
            const id = String(r.get('product_id') || '').trim();
            if (id) {
                sourceMap.set(id, {
                    name: r.get('product'),
                    unit: r.get('unit'),
                    unit_price: r.get('unit_price')
                });
            }
        });

        const missingInProducts = new Set();
        for (const row of sRows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            const pId = String(pIdRaw || '').trim();
            if (pId && !existingProductIds.has(pId)) {
                missingInProducts.add(pId);
            }
        }

        console.log(`Found ${missingInProducts.size} missing products in "products" list.`);

        const toAdd = [];
        missingInProducts.forEach(id => {
            const source = sourceMap.get(id);
            toAdd.push({
                id: id,
                item_code: id,
                name: source ? source.name : 'Unknown Product',
                unit: source ? source.unit : 'Cái',
                unit_price: source ? parseFloat(String(source.unit_price).replace(/,/g, '')) : 0,
                category: 'Uncategorized',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        });

        if (toAdd.length > 0) {
            console.log(`Adding ${toAdd.length} products to "products" sheet and Supabase...`);
            
            // 1. Supabase
            const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
            const { error: sbError } = await supabase.from('products').insert(toAdd);
            if (sbError) console.error('Supabase Error:', sbError);
            else console.log('Added to Supabase.');

            // 2. Google Sheets
            await productsSheet.addRows(toAdd.map(p => ({
                ...p,
                unit_price: p.unit_price.toString()
            })));
            console.log('Added to Google Sheets.');
        } else {
            console.log('No missing products to add.');
        }

    } catch (e) {
        console.error(e);
    }
};

syncMissingProducts();
