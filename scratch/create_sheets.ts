import 'dotenv/config';
import { getGoogleSheet } from '../api/utils/googleSheets.js';

async function createSheets() {
    try {
        const doc = await getGoogleSheet();
        console.log('Document title:', doc.title);

        const sheetsToCreate = [
            {
                title: 'settlement_inventory_data',
                headers: ['month', 'voucher_date', 'actual_date', 'transaction_type', 'item_code', 'bccs_item', 'finance_item', 'quantity', 'unit_price', 'total_amount', 'note', 'created_at']
            },
            {
                title: 'settlement_outbound_data',
                headers: ['month', 'stock_out_date', 'item_code', 'item_name', 'finance_item', 'sap_item_code', 'sap_item_name', 'qty_within_limit', 'cost_price', 'total_amount', 'created_at']
            },
            {
                title: 'settlement_history',
                headers: [
                    'month', 'item_code', 'item_name', 'unit', 'unit_price', 
                    'opening_qty', 'opening_amount', 
                    'inbound_qty', 'inbound_amount', 
                    'outbound_qty', 'outbound_amount', 
                    'usage_qty', 'usage_amount', 
                    'return_qty', 'return_amount', 
                    'closing_qty', 'closing_amount',
                    'sap_item_code', 'finance_item_name',
                    'created_at', 'updated_at'
                ]
            }
        ];

        for (const s of sheetsToCreate) {
            if (doc.sheetsByTitle[s.title]) {
                console.log(`Sheet "${s.title}" already exists.`);
                continue;
            }
            console.log(`Creating sheet "${s.title}"...`);
            const newSheet = await doc.addSheet({ title: s.title, headerValues: s.headers });
            console.log(`Created sheet "${s.title}".`);
        }

    } catch (err) {
        console.error('Error:', err);
    }
}

createSheets();
