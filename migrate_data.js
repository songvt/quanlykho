import { createClient } from '@supabase/supabase-js';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

// 1. Init Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in environment variables.');
    process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// 2. Init Google Sheets
const getGoogleSheet = async () => {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!serviceAccountEmail || !privateKey || !sheetId) {
            throw new Error('Missing Google Sheets credentials in environment variables.');
        }

        // Handle private key format
        privateKey = privateKey.replace(/\\n/g, '\n');

        const serviceAccountAuth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();
        return doc;
    } catch (error) {
        console.error('Error initializing Google Sheets:', error);
        throw error;
    }
};

const tables = [
    'products',
    'employees',
    'orders',
    'inbound_transactions',
    'outbound_transactions',
    'employee_returns',
    'district_storekeepers',
    'assets',
    'asset_logs',
    'asset_handovers',
    'inventory_audits',
    'qr_logs',
    'settlement_history',
    'settlement_inventory_data',
    'settlement_outbound_data',
    'exam_materials'
];

const tableHeaders = {
    products: ['id', 'item_code', 'name', 'category', 'unit_price', 'unit', 'type', 'created_at', 'updated_at', 'created_by', 'description', 'brand', 'specifications', 'image_url', 'min_stock'],
    employees: ['id', 'auth_user_id', 'full_name', 'role', 'email', 'permissions', 'created_at', 'username', 'password', 'must_change_password', 'phone_number', 'district', 'check'],
    orders: ['id', 'requester_group', 'product_id', 'quantity', 'status', 'order_date', 'created_by', 'project_name', 'reason', 'requester_phone', 'created_at', 'updated_at', 'approved_by', 'approved_at'],
    inbound_transactions: ['id', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'inbound_date', 'created_by', 'district', 'item_status', 'type', 'created_at', 'updated_at', 'date'],
    outbound_transactions: ['id', 'receiver_group', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'outbound_date', 'created_by', 'district', 'item_status', 'type', 'group_name', 'created_at', 'updated_at', 'date'],
    employee_returns: ['id', 'product_id', 'serial_code', 'quantity', 'reason', 'unit_price', 'total_price', 'return_date', 'employee_id', 'created_by', 'created_at', 'group_name', 'returner_name', 'status', 'description', 'district', 'item_status', 'type', 'updated_at', 'date'],
    district_storekeepers: ['district', 'storekeeper_name', 'created_at', 'updated_at'],
    assets: ['id', 'stt', 'asset_code', 'asset_name', 'asset_type_code', 'asset_type', 'asset_group', 'asset_set', 'quantity', 'unit', 'unit_price', 'total_value', 'status', 'manager_code', 'manager_name', 'management_unit_code', 'management_unit_name', 'location_code', 'location_name', 'receipt_date', 'user_type', 'user_employee_code', 'user_employee_name', 'user_department_code', 'user_department_name', 'representative_code', 'representative_name', 'first_use_date', 'serial_number', 'specifications', 'attached_components', 'maintenance_content', 'maintenance_basis', 'maintenance_start_time', 'maintenance_cycle', 'maintenance_start_capacity', 'next_maintenance_after', 'origin', 'supplier_code', 'supplier_name', 'purchase_date', 'contract_number', 'notes', 'depreciation_value', 'depreciation_period', 'depreciation_start_date', 'accumulated_depreciation', 'remaining_time', 'remaining_value', 'is_fixed_asset', 'brought_outside', 'is_shared_asset', 'asset_management_type', 'is_rented_asset', 'rented_type', 'created_at', 'updated_at'],
    asset_logs: ['id', 'asset_code', 'asset_name', 'asset_type', 'asset_group', 'action', 'details', 'employee_name', 'employee_code', 'department', 'performed_by', 'created_at'],
    asset_handovers: ['id', 'employee_id', 'receiver_name', 'receiver_title', 'receiver_dept', 'giver_info', 'template_type', 'action_type', 'items', 'total_quantity', 'created_at', 'created_by'],
    inventory_audits: ['id', 'title', 'created_by', 'status', 'details', 'created_at'],
    qr_logs: ['id', 'created_at', 'action', 'doc_title', 'total_serials', 'total_qrs', 'created_by', 'details'],
    settlement_history: ['id', 'month', 'item_code', 'item_name', 'unit', 'unit_price', 'opening_qty', 'opening_amount', 'inbound_qty', 'inbound_amount', 'outbound_qty', 'outbound_amount', 'usage_qty', 'usage_amount', 'return_qty', 'return_amount', 'closing_qty', 'closing_amount', 'created_at', 'updated_at', 'sap_item_code', 'finance_item_name'],
    settlement_inventory_data: ['id', 'month', 'voucher_date', 'actual_date', 'transaction_type', 'item_code', 'bccs_item', 'finance_item', 'quantity', 'unit_price', 'total_amount', 'note', 'created_at', 'unit', 'item_name', 'unit_code', 'unit_name', 'order_number', 'employee_voucher', 'warehouse_voucher', 'employee_name', 'reason'],
    settlement_outbound_data: ['id', 'month', 'stock_out_date', 'item_code', 'item_name', 'finance_item', 'sap_item_code', 'sap_item_name', 'qty_within_limit', 'cost_price', 'total_amount', 'created_at', 'unit', 'cost_center_unit', 'cost_center', 'cost_center_store', 'cost_center_employee_code', 'channel_group', 'channel_type', 'service', 'transaction_type', 'item_type', 'qty_over_limit', 'from_serial', 'to_serial', 'item_status', 'stock_out_voucher', 'transaction_code', 'management_unit', 'vtp_transaction_type', 'case_code', 'case_name', 'document_number', 'customer_group', 'sap_sync_type', 'impact_type', 'cost_allocation', 'qty_total'],
    exam_materials: ['id', 'category_name', 'quantity', 'unit', 'unit_price', 'serial', 'import_date', 'notes', 'created_at', 'updated_at']
};

async function migrateTable(doc, tableName) {
    console.log(`\n===========================================`);
    console.log(`Migrating table: ${tableName}`);
    console.log(`===========================================`);

    try {
        // Fetch data from Supabase
        console.log(`Fetching data from Supabase for ${tableName}...`);

        let allData = [];
        let from = 0;
        const limit = 1000;
        while (true) {
            const { data: chunk, error } = await supabase
                .from(tableName)
                .select('*')
                .range(from, from + limit - 1);
            
            if (error) {
                throw error;
            }
            if (!chunk || chunk.length === 0) {
                break;
            }
            allData = allData.concat(chunk);
            from += limit;
        }

        const data = allData;
        console.log(`Fetched ${data.length} rows.`);

        // Get headers based on strict schema
        const headers = tableHeaders[tableName];
        if (!headers) {
            throw new Error(`Predefined headers for table "${tableName}" are missing!`);
        }

        // Find or create sheet
        let sheet = doc.sheetsByTitle[tableName];
        if (sheet) {
            console.log(`Sheet "${tableName}" already exists. Recreating to clear old data...`);
            await sheet.delete();
            // Wait 1 second to ensure deletion is processed by Google API
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`Creating fresh sheet "${tableName}" with headers:`, headers.slice(0, 5), '...');
        sheet = await doc.addSheet({ 
            title: tableName, 
            headerValues: headers,
            gridProperties: {
                rowCount: Math.max(data ? data.length + 100 : 100, 2),
                columnCount: Math.max(headers.length, 26)
            }
        });
        console.log(`Created sheet ID: ${sheet.sheetId}`);

        if (!data || data.length === 0) {
            console.log(`No data found in Supabase table ${tableName}. Fresh sheet created with headers.`);
            return;
        }

        // Write to Google Sheets in batches
        const BATCH_SIZE = 500;
        console.log(`Inserting ${data.length} rows into Google Sheet in batches of ${BATCH_SIZE}...`);

        for (let i = 0; i < data.length; i += BATCH_SIZE) {
            const batch = data.slice(i, i + BATCH_SIZE);
            // Format data rows (e.g. handle nulls or objects)
            const formattedBatch = batch.map(row => {
                const newRow = {};
                for (let key of headers) {
                    let val = row[key];
                    if (val === null || val === undefined) {
                        newRow[key] = '';
                    } else if (typeof val === 'object') {
                        newRow[key] = JSON.stringify(val);
                    } else {
                        newRow[key] = String(val); // Stringify to format for GS
                    }
                }
                return newRow;
            });

            await sheet.addRows(formattedBatch);
            console.log(`- Inserted rows ${i + 1} to ${Math.min(i + BATCH_SIZE, data.length)}`);
            // Brief 300ms pause between chunks to respect API rate limits
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        console.log(`Successfully migrated ${tableName}.`);
    } catch (err) {
        console.error(`Error migrating table ${tableName}:`, err.message);
    }
}

async function runMigration() {
    try {
        console.log('Starting data migration from Supabase to Google Sheets...');

        const doc = await getGoogleSheet();
        console.log(`Connected to Google Sheet: "${doc.title}"`);

        for (const tableName of tables) {
            await migrateTable(doc, tableName);
            // Small delay to avoid hitting Google Sheets API rate limits
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        console.log('\n===========================================');
        console.log('Migration Completed Finally!');
        console.log('===========================================');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

runMigration();
