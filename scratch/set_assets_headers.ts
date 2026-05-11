import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function setHeaders() {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        let privateKey = process.env.GOOGLE_PRIVATE_KEY;
        const sheetId = process.env.GOOGLE_SHEET_ID;

        if (!serviceAccountEmail || !privateKey || !sheetId) {
            throw new Error('Missing credentials');
        }

        if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
            privateKey = privateKey.slice(1, -1);
        }
        privateKey = privateKey.replace(/\\n/g, '\n');

        const serviceAccountAuth = new JWT({
            email: serviceAccountEmail,
            key: privateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const doc = new GoogleSpreadsheet(sheetId, serviceAccountAuth);
        await doc.loadInfo();

        const sheet = doc.sheetsByTitle['assets'];
        if (!sheet) {
            throw new Error('Sheet "assets" not found!');
        }

        const headers = [
            'id', 'stt', 'asset_code', 'asset_name', 'asset_type_code', 'asset_type', 
            'asset_group', 'asset_set', 'quantity', 'unit', 'unit_price', 'total_value', 
            'status', 'manager_code', 'manager_name', 'management_unit_code', 
            'management_unit_name', 'location_code', 'location_name', 'receipt_date', 
            'user_type', 'user_employee_code', 'user_employee_name', 'user_department_code', 
            'user_department_name', 'representative_code', 'representative_name', 
            'first_use_date', 'serial_number', 'specifications', 'attached_components', 
            'maintenance_content', 'maintenance_basis', 'maintenance_start_time', 
            'maintenance_cycle', 'maintenance_start_capacity', 'next_maintenance_after', 
            'origin', 'supplier_code', 'supplier_name', 'purchase_date', 'contract_number', 
            'notes', 'depreciation_value', 'depreciation_period', 'depreciation_start_date', 
            'accumulated_depreciation', 'remaining_time', 'remaining_value', 'is_fixed_asset', 
            'brought_outside', 'is_shared_asset', 'asset_management_type', 'is_rented_asset', 
            'rented_type', 'created_at', 'updated_at'
        ];

        await sheet.resize({ rowCount: 1000, columnCount: 60 });
        await sheet.setHeaderRow(headers);
        console.log('Successfully set headers for "assets" sheet!');
    } catch (e) {
        console.error('Error:', e);
    }
}

setHeaders();
