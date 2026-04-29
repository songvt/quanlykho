import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkCounts() {
    try {
        const doc = await getGoogleSheet();
        const pSheet = await getSheetByTitle(doc, 'products');
        const iSheet = await getSheetByTitle(doc, 'inbound_transactions');
        const oSheet = await getSheetByTitle(doc, 'outbound_transactions');

        const pRows = await pSheet.getRows();
        const iRows = await iSheet.getRows();
        const oRows = await oSheet.getRows();

        console.log(`--- Google Sheets Counts ---`);
        console.log(`Products: ${pRows.length}`);
        console.log(`Inbound: ${iRows.length}`);
        console.log(`Outbound: ${oRows.length}`);
    } catch (e) {
        console.error(e);
    }
}

checkCounts();
