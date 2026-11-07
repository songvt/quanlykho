// Check sync counts between Google Sheet 'in_stock' and Supabase inbound_transactions
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

(async () => {
  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    // Count rows in inbound_transactions table
    const { data, count, error } = await supabase
      .from('inbound_transactions')
      .select('id', { count: 'exact', head: true });
    if (error) throw error;
    const dbCount = count ?? 0;
    // Google Sheet
    const auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, auth);
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['in_stock'];
    if (!sheet) {
      console.log('Sheet in_stock not found');
      process.exit(1);
    }
    const rows = await sheet.getRows();
    const sheetCount = rows.length;
    console.log('DB inbound_transactions count:', dbCount);
    console.log('Google Sheet in_stock rows count:', sheetCount);
    console.log('Difference (DB - Sheet):', dbCount - sheetCount);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();