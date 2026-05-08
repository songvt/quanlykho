
import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'employees');
        const rows = await sheet.getRows();
        console.log('Total employees in GS:', rows.length);
        
        const phong = rows.filter(r => {
            const obj = r.toObject();
            return (obj.full_name?.includes('Phong') || obj.email?.includes('Phong'));
        });
        
        if (phong.length > 0) {
            console.log('Found Phong in GS:');
            phong.forEach(r => console.log(r.toObject()));
        } else {
            console.log('Phong NOT found in GS.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

check();
