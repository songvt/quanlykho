
import * as dotenv from 'dotenv';
dotenv.config();
import handler from './api_handlers/cron-sync-stock.ts';
async function run() {
  await handler({ method: 'POST', headers: { authorization: 'Bearer secret_cron_token_123' } }, {
    status: (code) => ({ json: (data) => console.log(code, data) })
  });
  console.log('Done');
}
run().catch(console.error);

