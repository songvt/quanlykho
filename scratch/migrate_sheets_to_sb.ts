import { getGoogleSheet, getSheetByTitle } from '../api/utils/googleSheets.js';
import { supabase } from '../api/utils/supabase.js';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
    try {
        const doc = await getGoogleSheet();
        
        // 1. Migrate Products
        console.log('Migrating Products...');
        const pSheet = await getSheetByTitle(doc, 'products');
        const pRows = await pSheet.getRows();
        
        // Use a Map to ensure unique IDs
        const pMap = new Map();
        pRows.forEach(r => {
            const obj = r.toObject();
            if (obj.id) pMap.set(obj.id, obj);
        });
        const pData = Array.from(pMap.values());
        
        // Batch upsert to Supabase
        const { error: pErr } = await supabase.from('products').upsert(pData);
        if (pErr) console.error('Product Migration Error:', pErr);
        else console.log(`Successfully migrated ${pData.length} products.`);

        // 2. Migrate Inbound Transactions
        console.log('Migrating Inbound Transactions...');
        const iSheet = await getGoogleSheet().then(d => getSheetByTitle(d, 'inbound_transactions'));
        const iRows = await iSheet.getRows();
        const iData = iRows.map(r => {
            const obj = r.toObject();
            if (obj.id === '597f7618-7a59-49a7-8b57-2453316a4ebe') {
                console.log('DEBUG Failing Row Object:', obj);
            }
            // EXCLUDE generated column
            delete obj.total_price;
            
            // Clean numeric fields - ensure they are NEVER null if they have not-null constraints
            // Strip commas (thousand separators)
            const cleanNum = (v: any) => {
                if (typeof v === 'string') v = v.replace(/,/g, '');
                const n = Number(v);
                return isNaN(n) ? 0 : n;
            };

            obj.quantity = cleanNum(obj.quantity || 0);
            obj.unit_price = cleanNum(obj.unit_price || 0);
            
            // Handle serial_code if missing
            if (obj.serial_code === undefined) obj.serial_code = '';

            // Convert dd/mm/yyyy to ISO for Supabase
            if (obj.inbound_date && obj.inbound_date.includes('/')) {
                const [d, m, y] = obj.inbound_date.split('/');
                obj.inbound_date = `${y}-${m}-${d}`;
            }
            return obj;
        });
        
        // Batch insert in chunks of 500 to avoid Supabase limits
        const BATCH_SIZE = 500;
        for (let i = 0; i < iData.length; i += BATCH_SIZE) {
            const chunk = iData.slice(i, i + BATCH_SIZE);
            const { error } = await supabase.from('inbound_transactions').upsert(chunk);
            if (error) console.error(`Inbound Migration Error (batch ${i}):`, error);
        }
        console.log(`Successfully migrated ${iData.length} inbound transactions.`);

        // 3. Migrate Outbound Transactions
        console.log('Migrating Outbound Transactions...');
        const oSheet = await getGoogleSheet().then(d => getSheetByTitle(d, 'outbound_transactions'));
        const oRows = await oSheet.getRows();
        const oData = oRows.map(r => {
            const obj = r.toObject();
            delete obj.total_price;
            const cleanNum = (v: any) => {
                if (typeof v === 'string') v = v.replace(/,/g, '');
                const n = Number(v);
                return isNaN(n) ? 0 : n;
            };
            obj.quantity = cleanNum(obj.quantity || 0);
            obj.unit_price = cleanNum(obj.unit_price || 0);
            if (obj.outbound_date && obj.outbound_date.includes('/')) {
                const [d, m, y] = obj.outbound_date.split('/');
                obj.outbound_date = `${y}-${m}-${d}`;
            }
            return obj;
        });
        if (oData.length > 0) {
            for (let i = 0; i < oData.length; i += BATCH_SIZE) {
                await supabase.from('outbound_transactions').upsert(oData.slice(i, i + BATCH_SIZE));
            }
        }
        console.log(`Successfully migrated ${oData.length} outbound transactions.`);

        // 4. Migrate Orders
        console.log('Migrating Orders...');
        const ordSheet = await getGoogleSheet().then(d => getSheetByTitle(d, 'orders'));
        const ordRows = await ordSheet.getRows();
        const ordData = ordRows.map(r => {
            const obj = r.toObject();
            if (obj.order_date && obj.order_date.includes('/')) {
                const [d, m, y] = obj.order_date.split('/');
                obj.order_date = `${y}-${m}-${d}`;
            }
            if (obj.quantity) obj.quantity = Number(obj.quantity.replace(/,/g, ''));
            return obj;
        });
        if (ordData.length > 0) {
            for (let i = 0; i < ordData.length; i += BATCH_SIZE) {
                await supabase.from('orders').upsert(ordData.slice(i, i + BATCH_SIZE));
            }
        }
        console.log(`Successfully migrated ${ordData.length} orders.`);

        console.log('Migration Completed!');
    } catch (e) {
        console.error('Global Migration Error:', e);
    }
}

migrate();
