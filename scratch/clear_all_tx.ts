
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const clearSheets = async (sheetTitles: string[]) => {
    console.log('Starting sheet clear process...');

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

        for (const title of sheetTitles) {
            const sheet = doc.sheetsByTitle[title];
            if (sheet) {
                console.log(`Clearing Google Sheet: ${title}...`);
                await sheet.clearRows();
                console.log(`Sheet "${title}" cleared.`);
            } else {
                console.error(`Sheet "${title}" not found.`);
            }
        }
    } catch (e) {
        console.error('Error clearing Google Sheets:', e);
    }
};

const sheetsToClear = ['inbound_transactions', 'outbound_transactions', 'employee_returns'];
clearSheets(sheetsToClear);
