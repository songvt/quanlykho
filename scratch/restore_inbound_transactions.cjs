// restore_inbound_transactions.cjs
// Khôi phục bảng inbound_transactions từ backup (đã tạo trước khi thực hiện đồng bộ)
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const backupPath = path.resolve('scratch', 'inbound_transactions_backup.json'); // backup ban đầu (1000 rows)
    if (!fs.existsSync(backupPath)) throw new Error('Backup file not found: ' + backupPath);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    console.log('Backup rows to restore:', backupData.length);

    // Xóa toàn bộ dữ liệu hiện tại trong inbound_transactions
    console.log('Deleting current inbound_transactions...');
    const { error: delErr } = await supabase.from('inbound_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) throw delErr;
    console.log('All current rows deleted.');

    // Chèn lại dữ liệu từ backup (upsert để tạo mới)
    console.log('Restoring backup...');
    const BATCH = 1000;
    for (let i = 0; i < backupData.length; i += BATCH) {
      const batch = backupData.slice(i, i + BATCH);
      const { error: upErr } = await supabase.from('inbound_transactions').upsert(batch, { onConflict: 'id' });
      if (upErr) throw upErr;
      console.log(`Inserted batch ${i / BATCH + 1} (${batch.length} rows)`);
    }
    console.log('✅ Restore completed successfully.');
  } catch (e) {
    console.error('❌ Restore script error:', e.message);
    process.exit(1);
  }
})();