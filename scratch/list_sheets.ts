import 'dotenv/config';
import { getGoogleSheet } from '../api/utils/googleSheets.js';

async function listSheets() {
    try {
        const doc = await getGoogleSheet();
        console.log('Document title:', doc.title);
        console.log('Worksheets:');
        doc.sheetsByIndex.forEach(sheet => {
            console.log(`- ${sheet.title} (${sheet.rowCount} rows)`);
        });
    } catch (err) {
        console.error('Error:', err);
    }
}

listSheets();
