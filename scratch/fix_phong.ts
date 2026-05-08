
import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

async function fixPhong() {
    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'employees');
        const rows = await sheet.getRows();
        
        const phong = rows.find(r => r.get('full_name') === 'Nguyễn Thanh Phong');
        
        if (phong) {
            const currentId = phong.get('id');
            if (!currentId) {
                const newId = crypto.randomUUID();
                console.log(`Fixing Phong... Assigning ID: ${newId}`);
                phong.set('id', newId);
                // Also fill other missing fields if any
                if (!phong.get('created_at')) phong.set('created_at', new Date().toISOString());
                await phong.save();
                console.log('Phong fixed in GS!');
            } else {
                console.log(`Phong already has an ID: ${currentId}`);
            }
        } else {
            console.log('Phong NOT found in GS.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

fixPhong();
