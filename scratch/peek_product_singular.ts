
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const peekProductSingular = async () => {
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

        const sheet = doc.sheetsByTitle['product'];
        if (!sheet) {
            console.log('Sheet "product" not found.');
            return;
        }

        const rows = await sheet.getRows();
        console.log(`Found ${rows.length} rows in "product" sheet.`);
        rows.slice(0, 10).forEach(r => {
            console.log(r.toObject());
        });

    } catch (e) {
        console.error(e);
    }
};

peekProductSingular();
