import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, fetchAll } from './utils/supabase.js';
import { normalizeSettlementMonth } from './utils/settlementMonth.js';

function getMonthFormats(monthStr: string): string[] {
    const s = String(monthStr || '').trim();
    const formats = new Set<string>([s]);
    
    // Parse YYYY-MM hoặc YYYY-M
    const dashMatch = s.match(/^(\d{4})-(\d{1,2})$/);
    if (dashMatch) {
        const y = dashMatch[1];
        const m = dashMatch[2];
        const mNum = parseInt(m, 10);
        formats.add(`${y}-${m.padStart(2, '0')}`);
        formats.add(`${mNum}/${y}`);
        formats.add(`${String(mNum).padStart(2, '0')}/${y}`);
    }
    
    // Parse M/YYYY hoặc MM/YYYY
    const slashMatch = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const m = slashMatch[1];
        const y = slashMatch[2];
        const mNum = parseInt(m, 10);
        formats.add(`${y}-${String(mNum).padStart(2, '0')}`);
        formats.add(`${mNum}/${y}`);
        formats.add(`${String(mNum).padStart(2, '0')}/${y}`);
    }
    
    return Array.from(formats);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type } = req.query;
    
    // Default allowed methods
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // --- 1. SETTLEMENT OUTBOUND DATA ---
        if (type === 'outbound') {
            if (req.method === 'GET') {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const formats = getMonthFormats(month as string);
                const data = await fetchAll(
                    'settlement_outbound_data',
                    '*',
                    (q) => q.in('month', formats).order('id', { ascending: true })
                );
                return res.status(200).json(data);
            }

            if (req.method === 'DELETE') {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const formats = getMonthFormats(month as string);
                console.log(`[API] Deleting settlement_outbound for formats:`, formats);
                const { error } = await supabase.from('settlement_outbound_data').delete().in('month', formats);
                if (error) return res.status(500).json({ error: error.message });

                // Đồng bộ xóa sang Google Sheet
                try {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'settlement_outbound_data',
                        action: 'delete_by_month',
                        payload: { formats }
                    });
                } catch (gsError) {
                    console.error('[Dual-Write] Failed to queue GS sync delete:', gsError);
                }

                return res.status(200).json({ success: true, message: `Deleted data for ${month}` });
            }

            if (req.method === 'POST') {
                const { month, payload, skipDelete } = req.body;
                if (!month || !payload || !Array.isArray(payload)) {
                    return res.status(400).json({ error: 'Month and payload array required' });
                }

                const monthStored = normalizeSettlementMonth(month);
                console.log(`[API] Processing settlement_outbound for ${monthStored}. Rows: ${payload.length}`);
                const startTime = Date.now();

                // Xóa dữ liệu cũ nếu không yêu cầu skip
                if (!skipDelete) {
                    console.log(`[API] Clearing existing data for ${month}`);
                    await supabase.from('settlement_outbound_data').delete().eq('month', monthStored);

                    // Đồng bộ xóa cũ sang Google Sheet trước khi thêm mới
                    try {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'settlement_outbound_data',
                            action: 'delete_by_month',
                            payload: { formats: [monthStored] }
                        });
                    } catch (gsError) {
                        console.error('[Dual-Write] Failed to queue GS sync delete for update:', gsError);
                    }
                }

                // Lọc đúng các cột có trong bảng settlement_outbound_data
                const itemsToInsert = payload.map((item: any) => ({
                    month: monthStored,
                    cost_center_unit: item.cost_center_unit,
                    cost_center: item.cost_center,
                    cost_center_store: item.cost_center_store,
                    cost_center_employee_code: item.cost_center_employee_code,
                    stock_out_date: item.stock_out_date,
                    channel_group: item.channel_group,
                    channel_type: item.channel_type,
                    service: item.service,
                    transaction_type: item.transaction_type,
                    item_code: item.item_code,
                    item_name: item.item_name,
                    finance_item: item.finance_item,
                    item_type: item.item_type,
                    qty_within_limit: Number(item.qty_within_limit) || 0,
                    qty_over_limit: Number(item.qty_over_limit) || 0,
                    qty_total: Number(item.qty_total) || 0,
                    cost_price: Number(item.cost_price) || 0,
                    total_amount: Number(item.total_amount) || 0,
                    from_serial: item.from_serial,
                    to_serial: item.to_serial,
                    item_status: item.item_status,
                    stock_out_voucher: item.stock_out_voucher,
                    transaction_code: item.transaction_code,
                    management_unit: item.management_unit,
                    vtp_transaction_type: item.vtp_transaction_type,
                    case_code: item.case_code,
                    case_name: item.case_name,
                    document_number: item.document_number,
                    customer_group: item.customer_group,
                    sap_item_code: item.sap_item_code,
                    sap_item_name: item.sap_item_name,
                    sap_sync_type: item.sap_sync_type,
                    impact_type: item.impact_type,
                    cost_allocation: item.cost_allocation
                }));

                // CHUNKING
                const CHUNK_SIZE = 500;
                for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
                    const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase
                        .from('settlement_outbound_data')
                        .insert(chunk);

                    if (error) throw error;
                }

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[API] Successfully saved ${itemsToInsert.length} rows for ${month} in ${duration}s`);

                // QUEUE SYNC TO GOOGLE SHEETS
                try {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'settlement_outbound_data',
                        action: 'insert',
                        payload: itemsToInsert
                    });
                } catch (gsError) {
                    console.error('[Dual-Write] Failed to queue GS sync:', gsError);
                }

                return res.status(201).json({ success: true, count: itemsToInsert.length, duration });
            }
        }

        // --- 2. SETTLEMENT INVENTORY DATA ---
        if (type === 'inventory') {
            if (req.method === 'GET') {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const formats = getMonthFormats(month as string);
                const data = await fetchAll(
                    'settlement_inventory_data',
                    '*',
                    (q) => q.in('month', formats).order('id', { ascending: true })
                );
                return res.status(200).json(data);
            }

            if (req.method === 'DELETE') {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const formats = getMonthFormats(month as string);
                console.log(`[API] Deleting settlement_inventory for formats:`, formats);
                const { error } = await supabase.from('settlement_inventory_data').delete().in('month', formats);
                if (error) return res.status(500).json({ error: error.message });

                // Đồng bộ xóa sang Google Sheet
                try {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'settlement_inventory_data',
                        action: 'delete_by_month',
                        payload: { formats }
                    });
                } catch (gsError) {
                    console.error('[Dual-Write] Failed to queue GS sync delete:', gsError);
                }

                return res.status(200).json({ success: true, message: `Deleted data for ${month}` });
            }

            if (req.method === 'POST') {
                const { month, payload, skipDelete } = req.body;
                if (!month || !payload || !Array.isArray(payload)) {
                    return res.status(400).json({ error: 'Month and payload array required' });
                }

                const monthStored = normalizeSettlementMonth(month);
                console.log(`[API] Processing settlement_inventory for ${monthStored}. Rows: ${payload.length}`);
                const startTime = Date.now();

                // Xóa dữ liệu cũ nếu không yêu cầu skip
                if (!skipDelete) {
                    console.log(`[API] Clearing existing data for ${month}`);
                    await supabase.from('settlement_inventory_data').delete().eq('month', monthStored);

                    // Đồng bộ xóa cũ sang Google Sheet trước khi thêm mới
                    try {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'settlement_inventory_data',
                            action: 'delete_by_month',
                            payload: { formats: [monthStored] }
                        });
                    } catch (gsError) {
                        console.error('[Dual-Write] Failed to queue GS sync delete for update:', gsError);
                    }
                }

                // Lọc đúng các cột có trong bảng để tránh lỗi Supabase
                const itemsToInsert = payload.map((item: any) => ({
                    month: monthStored,
                    unit_code: item.unit_code,
                    unit_name: item.unit_name,
                    transaction_type: item.transaction_type,
                    order_number: item.order_number,
                    employee_voucher: item.employee_voucher,
                    warehouse_voucher: item.warehouse_voucher,
                    bccs_item: item.bccs_item,
                    finance_item: item.finance_item,
                    item_code: item.item_code,
                    item_name: item.item_name,
                    unit: item.unit,
                    unit_price: Number(item.unit_price) || 0,
                    quantity: Number(item.quantity) || 0,
                    total_amount: Number(item.total_amount) || 0,
                    voucher_date: item.voucher_date,
                    actual_date: item.actual_date,
                    employee_name: item.employee_name,
                    reason: item.reason,
                    note: item.note
                }));

                // CHUNKING
                const CHUNK_SIZE = 500;
                for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
                    const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase
                        .from('settlement_inventory_data')
                        .insert(chunk);

                    if (error) throw error;
                }

                const duration = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`[API] Successfully saved ${itemsToInsert.length} rows for ${month} in ${duration}s`);

                // QUEUE SYNC TO GOOGLE SHEETS
                try {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'settlement_inventory_data',
                        action: 'insert',
                        payload: itemsToInsert
                    });
                } catch (gsError) {
                    console.error('[Dual-Write] Failed to queue GS sync:', gsError);
                }

                return res.status(201).json({ success: true, count: itemsToInsert.length, duration });
            }
        }

        // --- 3. SETTLEMENT HISTORY ---
        if (type === 'history') {
            if (req.method === 'GET') {
                const { month } = req.query;
                if (month) {
                    const data = await fetchAll(
                        'settlement_history',
                        '*',
                        (q) => q.eq('month', month as string).order('item_code')
                    );
                    return res.status(200).json(data);
                }
                const data = await fetchAll('settlement_history', '*', (q) => q.order('item_code'));
                return res.status(200).json(data);
            }

            if (req.method === 'POST') {
                const { payload } = req.body;
                if (!payload) return res.status(400).json({ error: 'Payload required' });
                
                const itemsToInsert = Array.isArray(payload) ? payload : [payload];

                // Đồng bộ dọn dẹp Google Sheets trước để tránh duplicate
                const monthsInPayload = Array.from(new Set(itemsToInsert.map((item: any) => item.month).filter(Boolean)));
                if (monthsInPayload.length > 0) {
                    try {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'settlement_history',
                            action: 'delete_by_month',
                            payload: { formats: monthsInPayload }
                        });
                    } catch (gsError) {
                        console.error('[Dual-Write] Failed to queue GS sync delete for history update:', gsError);
                    }
                }

                const CHUNK_SIZE = 500;
                let insertedCount = 0;

                for (let i = 0; i < itemsToInsert.length; i += CHUNK_SIZE) {
                    const chunk = itemsToInsert.slice(i, i + CHUNK_SIZE);
                    const { error } = await supabase
                        .from('settlement_history')
                        .upsert(chunk, { onConflict: 'month,item_name' });
                    
                    if (error) throw error;
                    insertedCount += chunk.length;

                    // QUEUE SYNC TO GOOGLE SHEETS
                    try {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'settlement_history',
                            action: 'insert',
                            payload: chunk
                        });
                    } catch (gsError) {
                        console.error('[Dual-Write] Failed to queue GS sync:', gsError);
                    }
                }
                
                return res.status(201).json({ success: true, count: insertedCount });
            }

            if (req.method === 'DELETE') {
                const { month } = req.query;
                if (!month) return res.status(400).json({ error: 'Month required' });
                
                const { error } = await supabase
                    .from('settlement_history')
                    .delete()
                    .eq('month', month);
                
                if (error) throw error;

                // Đồng bộ xóa sang Google Sheet
                try {
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'settlement_history',
                        action: 'delete_by_month',
                        payload: { formats: [month as string] }
                    });
                } catch (gsError) {
                    console.error('[Dual-Write] Failed to queue GS sync delete for history:', gsError);
                }

                return res.status(200).json({ message: `Deleted settlement for ${month}` });
            }
        }

        // --- 4. STATS (FIFO / DASHBOARD) ---
        if (type === 'stats') {
            if (req.method !== 'GET') {
                return res.status(405).json({ error: 'Method Not Allowed' });
            }

            const { action } = req.query;
            if (action === 'dashboard') {
                const { data, error } = await supabase.rpc('get_dashboard_stats');
                if (error) throw error;
                return res.status(200).json(data);
            }

            if (action === 'fifo_aging') {
                const { data, error } = await supabase.rpc('get_fifo_inventory_aging');
                if (error) throw error;
                return res.status(200).json(data);
            }

            return res.status(400).json({ error: 'Invalid action. Supported: dashboard, fifo_aging' });
        }

        return res.status(400).json({ error: 'Invalid type parameter' });

    } catch (error: any) {
        console.error(`[Settlement API Error] type=${type}:`, error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
