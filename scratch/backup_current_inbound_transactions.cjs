// backup_current_inbound_transactions.cjs
// Sao lưu toàn bộ bảng inbound_transactions sau khi đã đồng bộ
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.from('inbound_transactions').select('*');
    if (error) throw error;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `inbound_transactions_backup_${timestamp}.json`;
    const fullPath = path.resolve('scratch', fileName);
    fs.writeFileSync(fullPath, JSON.stringify(data, null, 2));
    console.log('Backup saved to', fullPath, '- rows:', data.length);
  } catch (e) {
    console.error('Backup error:', e.message);
    process.exit(1);
  }
})();