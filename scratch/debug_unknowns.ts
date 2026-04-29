
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const debugUnknowns = async () => {
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

        const productsSet = new Set(products?.map(p => String(p.id).trim()));

        console.log(`Supabase Products Count: ${productsSet.size}`);

        for (const row of sRows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            const pId = String(pIdRaw || '').trim();
            
            if (pId && pId === 'CAMMOD_T3_HC34_3M') {
                const exists = productsSet.has(pId);
                console.log(`Checking "${pId}": Exists in Map? ${exists}`);
                if (!exists) {
                    console.log(`Row Data: ${JSON.stringify(row.toObject())}`);
                }
                break;
            }
        }

    } catch (e) {
        console.error(e);
    }
};

debugUnknowns();
