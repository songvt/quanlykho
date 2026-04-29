
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const findInProductSheet = async (id: string) => {
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
        const rows = await sheet.getRows();
        
        const found = rows.find(r => String(r.get('product_id')).trim() === id);
        if (found) {
            console.log(`FOUND: ${JSON.stringify(found.toObject())}`);
        } else {
            console.log(`NOT FOUND: ${id}`);
        }

    } catch (e) {
        console.error(e);
    }
};

findInProductSheet('CAMMOD_T3_HC34_3M');
