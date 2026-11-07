// daily_sync.cjs
// Automated daily workflow: backup inbound_transactions, sync Sheet -> DB (in_stock),
// then sync DB -> Sheet (chit). Logs are written to ./logs/daily_sync_YYYYMMDD.log

require('dotenv').config();
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

(async () => {
  try {
    // 1. Backup current inbound_transactions (timestamped)
    log('Starting backup of inbound_transactions');
    execSync('node "E:/APP_QL_KHO - GGS/scratch/backup_current_inbound_transactions.cjs"', { stdio: 'inherit' });
    log('Backup completed');

    // 2. Sync Sheet -> DB for in_stock (creates missing products)
    log('Running Sheet → DB sync for in_stock');
    execSync('node "E:/APP_QL_KHO - GGS/scratch/sync_sheet_to_db_with_products.cjs"', { stdio: 'inherit' });
    log('Sheet → DB sync finished');

    // 3. Sync DB -> Sheet for chit (only missing rows)
    log('Running DB → Sheet sync for chit');
    execSync('node "E:/APP_QL_KHO - GGS/scratch/sync_db_to_sheet.cjs"', { stdio: 'inherit' });
    log('DB → Sheet sync finished');

    log('Daily sync workflow completed successfully');
    process.exit(0);
  } catch (e) {
    log(`❌ Daily sync failed: ${e.message}`);
    process.exit(1);
  }
})();
