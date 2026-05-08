
import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import dotenv from 'dotenv';
dotenv.config();

async function updatePermissions() {
    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'employees');
        const rows = await sheet.getRows();
        
        const phong = rows.find(r => r.get('full_name') === 'Nguyễn Thanh Phong');
        
        if (phong) {
            console.log('Updating permissions for Phong in GS...');
            phong.set('permissions', JSON.stringify(['qr_hcm.view']));
            await phong.save();
            console.log('Phong permissions updated in GS!');
        } else {
            console.log('Phong NOT found in GS.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

updatePermissions();
