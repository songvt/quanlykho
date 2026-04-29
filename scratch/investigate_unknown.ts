
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const investigateUnknown = async () => {
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

        const [sRows, pRows] = await Promise.all([
            stockSheet.getRows(),
            productsSheet.getRows()
        ]);

        const productIds = new Set(pRows.map(r => String(r.get('id') || r.get('item_code') || '').trim()));
        
        console.log(`Total Products: ${productIds.size}`);
        
        const unknownProducts = new Map();

        for (const row of sRows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            const pId = String(pIdRaw || '').trim();
            
            if (pId && !productIds.has(pId)) {
                if (!unknownProducts.has(pId)) {
                    unknownProducts.set(pId, {
                        count: 0,
                        sample_serial: row.get('serial_code') || row.get('SERIAL') || row.get('Serial')
                    });
                }
                unknownProducts.get(pId).count++;
            }
        }

        console.log('--- Missing Products in "products" sheet ---');
        unknownProducts.forEach((info, id) => {
            console.log(`Product Code: "${id}" | Transactions in Stock: ${info.count} | Example Serial: ${info.sample_serial}`);
        });

    } catch (e) {
        console.error(e);
    }
};

investigateUnknown();
