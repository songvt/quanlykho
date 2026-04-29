
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const listAllSheetsAndColumns = async () => {
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

        for (const sheet of doc.sheetsByIndex) {
            console.log(`Sheet: "${sheet.title}"`);
            await sheet.loadHeaderRow();
            console.log(`Columns: ${sheet.headerValues.join(', ')}`);
            console.log('---');
        }

    } catch (e) {
        console.error(e);
    }
};

listAllSheetsAndColumns();
