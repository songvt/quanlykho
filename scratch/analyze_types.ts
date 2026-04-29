
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import * as dotenv from 'dotenv';

dotenv.config();

const analyzeHHTKM = async () => {
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
        
        let hhWithSerial = 0;
        let hhWithoutSerial = 0;
        let vtWithSerial = 0;
        let vtWithoutSerial = 0;

        for (const row of rows) {
            const type = String(row.get('check_loại_hang')).trim();
            const serial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            
            if (type === 'HH-TKM') {
                if (serial) hhWithSerial++;
                else hhWithoutSerial++;
            } else if (type === 'VT-TKM') {
                if (serial) vtWithSerial++;
                else vtWithoutSerial++;
            }
        }

        console.log(`HH-TKM: ${hhWithSerial} with serial, ${hhWithoutSerial} without serial`);
        console.log(`VT-TKM: ${vtWithSerial} with serial, ${vtWithoutSerial} without serial`);

    } catch (e) {
        console.error(e);
    }
};

analyzeHHTKM();
