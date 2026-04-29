
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const findVTQuantities = async () => {
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

        const sheet = doc.sheetsByTitle['in_stock'];
        const rows = await sheet.getRows();
        
        const vtRows = rows.filter(r => String(r.get('check_loại_hang')).trim() === 'VT-TKM');
        
        console.log(`Found ${vtRows.length} VT-TKM rows.`);
        vtRows.forEach(r => {
            console.log(`ID: ${r.get('ID')}, Product: ${r.get('product_id')}, Qty: "${r.get('quantity')}"`);
        });

    } catch (e) {
        console.error(e);
    }
};

findVTQuantities();
