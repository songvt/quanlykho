import 'dotenv/config';
import { getGoogleSheet } from '../api/utils/googleSheets.js';

async function peekSheets() {
    try {
        const doc = await getGoogleSheet();
        const sheetNames = ['settlement_inventory_data', 'settlement_outbound_data', 'settlement_history'];
        
        for (const name of sheetNames) {
            const sheet = doc.sheetsByTitle[name];
            if (!sheet) {
                console.log(`Sheet ${name} not found`);
                continue;
            }
            const rows = await sheet.getRows({ limit: 5 });
            console.log(`--- ${name} (Top 5 rows) ---`);
            rows.forEach(r => {
                console.log(r.toObject());
            });
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

peekSheets();
