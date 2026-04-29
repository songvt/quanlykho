
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const checkSheetIDUnique = async () => {
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
        
        const ids = new Set();
        let duplicates = 0;

        for (const row of rows) {
            const id = row.get('ID');
            if (id) {
                if (ids.has(id)) duplicates++;
                else ids.set(id, true);
            }
        }

        console.log(`Total Rows: ${rows.length}`);
        console.log(`Unique IDs in column "ID": ${ids.size}`);
        console.log(`Duplicate IDs in column "ID": ${duplicates}`);

    } catch (e) {
        console.error(e);
    }
};

checkSheetIDUnique();
