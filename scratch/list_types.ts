
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const listTypes = async () => {
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
        
        const counts: Record<string, number> = {};
        for (const row of rows) {
            const val = String(row.get('check_loại_hang')).trim() || 'EMPTY';
            counts[val] = (counts[val] || 0) + 1;
        }
        console.log(counts);

    } catch (e) {
        console.error(e);
    }
};

listTypes();
