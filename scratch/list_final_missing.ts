
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const listFinalMissing = async () => {
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
        const { data: products } = await supabase.from('products').select('id').limit(10000);

        const productsSet = new Set(products?.map(p => String(p.id).trim()));
        const missing = new Set();

        for (const row of sRows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            const pId = String(pIdRaw || '').trim();
            if (pId && !productsSet.has(pId)) {
                missing.add(pId);
            }
        }

        console.log('--- Product IDs in Kho Tổng but MISSING in Product List ---');
        console.log(Array.from(missing).join('\n'));

    } catch (e) {
        console.error(e);
    }
};

listFinalMissing();
