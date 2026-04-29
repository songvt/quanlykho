
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const countStockRows = async () => {
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
        const rows = await stockSheet.getRows();
        
        console.log(`Total Rows in "in_stock" sheet: ${rows.length}`);

        let validRows = 0;
        let missingProductId = 0;
        let missingSerial = 0;
        let unknownProduct = 0;
        
        const productsSheet = doc.sheetsByTitle['products'];
        const pRows = await productsSheet.getRows();
        const productIds = new Set(pRows.map(r => String(r.get('id') || '').trim()));

        for (const row of rows) {
            const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
            const serial = row.get('serial_code') || row.get('SERIAL') || row.get('Serial');
            
            if (!pIdRaw) missingProductId++;
            else if (!serial) missingSerial++;
            else if (!productIds.has(String(pIdRaw).trim())) unknownProduct++;
            else validRows++;
        }

        console.log(`Valid Rows (ready to sync): ${validRows}`);
        console.log(`Missing Product ID: ${missingProductId}`);
        console.log(`Missing Serial: ${missingSerial}`);
        console.log(`Unknown Product (not in products list): ${unknownProduct}`);

    } catch (e) {
        console.error(e);
    }
};

countStockRows();
