
import { getGoogleSheet, getSheetByTitle } from './api_handlers/_utils/googleSheets.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  // fetch all products
  let allProds = [];
  let from = 0;
  while(true) {
    const { data } = await supabase.from('products').select('id, item_code').range(from, from + 999);
    if (!data || data.length === 0) break;
    allProds = allProds.concat(data);
    from += 1000;
  }
  const productsMap = {};
  allProds.forEach(p => {
    productsMap[p.id] = p;
    if (p.item_code) productsMap[p.item_code.trim()] = p;
  });

  console.log('Total products in DB:', allProds.length);

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
    if (!productsMap[pId]) {
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
}
check();

