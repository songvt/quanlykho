
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const debugSync = async () => {
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
        const sRows = await stockSheet.getRows();
        
        const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
        const { data: products } = await supabase.from('products').select('*');
        const { data: existing } = await supabase.from('inbound_transactions').select('serial_code');

        const productsMap = new Map();
        products?.forEach(p => {
            productsMap.set(String(p.id).trim(), p);
            productsMap.set(String(p.item_code).trim(), p);
        });

        const existingSerials = new Set(existing?.map(r => String(r.serial_code || '').trim()).filter(Boolean));

        let total = 0;
        let missingP = 0;
        let unknownP = 0;
        let missingS = 0;
        let alreadyE = 0;
        let ready = 0;

        const unknownSample = [];

        for (const row of sRows) {
            total++;
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            if (!pIdRaw) {
                missingP++;
                continue;
            }
            const pId = String(pIdRaw).trim();
            const product = productsMap.get(pId);
            if (!product) {
                unknownP++;
                if (unknownSample.length < 5) unknownSample.push(pId);
                continue;
            }

            const serial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            if (!serial) {
                missingS++;
                continue;
            }

            if (existingSerials.has(serial)) {
                alreadyE++;
                continue;
            }

            ready++;
        }

        console.log(`Total: ${total}`);
        console.log(`Missing Product ID: ${missingP}`);
        console.log(`Unknown Product ID: ${unknownP}`);
        console.log(`Missing Serial: ${missingS}`);
        console.log(`Already in Supabase: ${alreadyE}`);
        console.log(`Ready to Sync: ${ready}`);
        console.log(`Sample Unknown IDs: ${unknownSample.join(', ')}`);

    } catch (e) {
        console.error(e);
    }
};

debugSync();
