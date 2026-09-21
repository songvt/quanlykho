
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function check() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  // just check how many inbound_transactions there are directly in Supabase
  let { count, error } = await supabase.from('inbound_transactions').select('*', { count: 'exact', head: true });
  console.log('Total in Supabase inbound_transactions:', count);
}
check();

