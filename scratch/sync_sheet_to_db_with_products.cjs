// sync_sheet_to_db_with_products.cjs
// 1. Tạo các product chưa tồn tại (placeholder)
// 2. Chèn các inbound_transactions mới (chỉ những dòng chưa có trong DB)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

(async () => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // ---------- Đọc Google Sheet ----------
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['in_stock'];
    if (!sheet) {
      console.error('Sheet in_stock not found');
      process.exit(1);
    }
    const rows = await sheet.getRows();

    // ---------- Lấy dữ liệu hiện tại từ DB ----------
    const { data: dbTrans, error: errTrans } = await supabase
      .from('inbound_transactions')
      .select('product_id, serial_code')
      .order('id');
    if (errTrans) throw errTrans;
    const dbSet = new Set(dbTrans.map(r => `${r.product_id}|${r.serial_code}`));

    const { data: prodRows, error: errProd } = await supabase
      .from('products')
      .select('id')
      .order('id');
    if (errProd) throw errProd;
    const prodSet = new Set(prodRows.map(p => p.id));

    // ---------- Xây dựng danh sách cần chèn ----------
    const missingProducts = new Set();
    const newInbound = [];
    for (const r of rows) {
      const pid = String(r.get('product_id') || r.get('MA_HANG') || '').trim();
      const serial = String(r.get('serial_code') || r.get('SERIAL') || '').trim();
      if (!pid) continue;
      const key = `${pid}|${serial}`;
      if (dbSet.has(key)) continue;
      if (pid && !prodSet.has(pid)) missingProducts.add(pid);

      const now = new Date().toISOString();
      newInbound.push({
        id: crypto.randomUUID(),
        product_id: pid,
        serial_code: serial,
        quantity: 1,
        district: r.get('district') || r.get('District') || 'Kho Tổng',
        inbound_date: now,
        created_at: now,
        updated_at: now,
        created_by: 'auto_sync_sheet',
        unit_price: 0,
        // total_price là generated column (quantity * unit_price) → KHÔNG gửi lên
        item_status: 'active',
        item_type: null,
        warehouse_type: null,
        source_id: null,
        sap_id: null,
        tc_id: null,
        full_name: null,
        type: null,
      });
    }

    console.log('Số product_id thiếu trong bảng products :', missingProducts.size);
    console.log('Số bản ghi inbound mới sẽ chèn          :', newInbound.length);

    // ---------- Tạo product placeholder nếu cần ----------
    if (missingProducts.size > 0) {
      const placeholderProducts = Array.from(missingProducts).map(pid => ({
        id: pid,
        item_code: pid,
        name: `Sản phẩm ${pid}`,
        unit: 'Cái',
        unit_price: 0,
      }));
      const { error: prodErr } = await supabase
        .from('products')
        .upsert(placeholderProducts, { onConflict: 'id', ignoreDuplicates: true });
      if (prodErr) throw prodErr;
      console.log(`Đã chèn ${placeholderProducts.length} product placeholder`);
    }

    // ---------- Chèn inbound_transactions ----------
    if (newInbound.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < newInbound.length; i += CHUNK) {
        const chunk = newInbound.slice(i, i + CHUNK);
        const { error: upErr } = await supabase
          .from('inbound_transactions')
          .upsert(chunk, { onConflict: 'id' });
        if (upErr) {
          console.error('Lỗi insert batch', Math.floor(i / CHUNK) + 1, upErr.message);
          throw upErr;
        }
      }
      console.log('✅ Đã chèn thành công', newInbound.length, 'bản ghi inbound');
    } else {
      console.log('✅ Không có bản ghi inbound mới để chèn');
    }
  } catch (e) {
    console.error('❌ Lỗi thực thi script:', e.message);
    process.exit(1);
  }
})();
