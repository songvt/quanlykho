
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const checkDuplicateSerials = async () => {
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
        
        const serials = new Map();
        let duplicates = 0;

        for (const row of rows) {
            const serial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            if (serial) {
                if (serials.has(serial)) {
                    duplicates++;
                } else {
                    serials.set(serial, true);
                }
            }
        }

        console.log(`Unique Serials: ${serials.size}`);
        console.log(`Duplicate Serials: ${duplicates}`);

    } catch (e) {
        console.error(e);
    }
};

checkDuplicateSerials();
