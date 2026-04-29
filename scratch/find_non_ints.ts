
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const findNonIntegerQuantities = async () => {
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
        
        rows.forEach(r => {
            const qty = String(r.get('quantity') || '');
            if (qty && (qty.includes('.') || qty.includes(','))) {
                console.log(`ID: ${r.get('ID')}, Type: ${r.get('check_loại_hang')}, Qty: "${qty}"`);
            }
        });

    } catch (e) {
        console.error(e);
    }
};

findNonIntegerQuantities();
