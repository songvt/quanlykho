
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const fullDebug = async () => {
    try {
        const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
        
        const { data: products, error: pError } = await supabase.from('products').select('*').limit(10000);
        console.log(`Supabase Products Loaded: ${products?.length || 0}`);
        if (pError) console.error('P Error:', pError);

        const { data: existing, error: eError } = await supabase.from('inbound_transactions').select('serial_code').limit(100000);
        console.log(`Supabase Inbound Transactions Loaded: ${existing?.length || 0}`);
        if (eError) console.error('E Error:', eError);

        const productsMap = new Map();
        products?.forEach(p => {
            productsMap.set(String(p.id).trim().toLowerCase(), p);
            productsMap.set(String(p.item_code).trim().toLowerCase(), p);
        });

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
        console.log(`In-Stock Sheet Rows: ${sRows.length}`);

        const existingSerials = new Set(existing?.map(r => String(r.serial_code || '').trim()).filter(Boolean));

        let ready = 0;
        let unknownP = 0;
        let missingS = 0;
        let alreadyE = 0;
        
        const unknownSample = new Set();

        for (const row of sRows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            if (!pIdRaw) continue;
            
            const pId = String(pIdRaw).trim().toLowerCase();
            const product = productsMap.get(pId);
            
            if (!product) {
                unknownP++;
                if (unknownSample.size < 10) unknownSample.add(String(pIdRaw).trim());
                continue;
            }

            const serialRaw = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            const isVT = String(row.get('check_loại_hang')).trim() === 'VT-TKM';
            const serial = serialRaw || (isVT ? `VT-${row.get('ID')}` : '');

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

        console.log(`--- Results ---`);
        console.log(`Ready to Sync: ${ready}`);
        console.log(`Unknown Products: ${unknownP}`);
        console.log(`Missing Serials (Non-VT): ${missingS}`);
        console.log(`Already Exist: ${alreadyE}`);
        console.log(`Sample Unknown IDs: ${Array.from(unknownSample).join(', ')}`);

    } catch (e) {
        console.error(e);
    }
};

fullDebug();
