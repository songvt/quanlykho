import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import dotenv from 'dotenv';
dotenv.config();

async function peek() {
    const doc = await getGoogleSheet();
    const pSheet = await getSheetByTitle(doc, 'products');
    const rows = await pSheet.getRows();
    console.log('Products Sample:');
    rows.slice(0, 5).forEach(r => console.log(r.toObject()));
    
    const iSheet = await getSheetByTitle(doc, 'inbound_transactions');
    const iRows = await iSheet.getRows();
    console.log('\nInbound Sample:');
    iRows.slice(0, 5).forEach(r => console.log(r.toObject()));
}

peek();
