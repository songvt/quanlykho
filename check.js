
import { getGoogleSheet, getSheetByTitle } from './api_handlers/_utils/googleSheets.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  const { data: prods } = await supabase.from('products').select('id, item_code');
  const prodCodes = new Set(prods.map(p => p.item_code.trim()));

  const doc = await getGoogleSheet();
  const sheet = await getSheetByTitle(doc, 'in_stock');
  const rows = await sheet.getRows();

  let countTotal = rows.length;
  let countHasCode = 0;
  let countProductFound = 0;
  let countSerial = 0;
  let skippedNoProduct = [];
  let skippedNoSerial = 0;
  let uniqueSerials = new Set();
  let duplicateSerials = 0;

  for (let r of rows) {
    const pId = (r.get('product_id') || r.get('MA_HANG') || r.get('Ma_Hang') || r.get('MA_VT') || '').trim();
    if (!pId) continue;
    countHasCode++;
    if (!prodCodes.has(pId)) {
        skippedNoProduct.push(pId);
        continue;
    }
    countProductFound++;

    const serialRaw = (r.get('serial_code') || r.get('SERIAL') || r.get('Serial') || '').trim();
    const isVT = (r.get('check_lo?i_hang') || '').trim() === 'VT-TKM';
    const serial = serialRaw || (isVT ? 'VT-' + r.get('ID') : '');

    if (serial) {
      countSerial++;
      if (uniqueSerials.has(serial)) {
        duplicateSerials++;
      }
      uniqueSerials.add(serial);
    } else {
      skippedNoSerial++;
    }
  }

  console.log({ countTotal, countHasCode, countProductFound, countSerial, duplicateSerials, uniqueSerials: uniqueSerials.size, skippedNoSerial });
  console.log('Skipped Product Codes (Sample):', [...new Set(skippedNoProduct)].slice(0, 10));
}
check();

