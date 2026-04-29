
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const countInboundRows = async () => {
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

        const sheet = doc.sheetsByTitle['inbound_transactions'];
        const rows = await sheet.getRows();
        
        console.log(`Total Rows in "inbound_transactions" sheet: ${rows.length}`);

    } catch (e) {
        console.error(e);
    }
};

countInboundRows();
