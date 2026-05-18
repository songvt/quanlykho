import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, fetchAll } from './utils/supabase.js';
import { normalizeSettlementMonth } from './utils/settlementMonth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        const { month } = req.query;
        if (!month) return res.status(400).json({ error: 'Month required' });
        
        try {
            const raw = month as string;
            const normalized = normalizeSettlementMonth(raw);
            let data = await fetchAll(
                'settlement_inventory_data',
                '*',
                (q) => q.eq('month', normalized).order('id', { ascending: true })
            );
            if (data.length === 0 && raw !== normalized) {
                data = await fetchAll(
                    'settlement_inventory_data',
                    '*',
                    (q) => q.eq('month', raw).order('id', { ascending: true })
                );
            }
            return res.status(200).json(data);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === 'DELETE') {
        const { month } = req.query;
        if (!month) return res.status(400).json({ error: 'Month required' });
        
        console.log(`[API] Deleting settlement_inventory for ${month}`);
        const { error } = await supabase.from('settlement_inventory_data').delete().eq('month', month as string);
        if (error) return res.status(500).json({ error: error.message });
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

        try {
            // Xóa dữ liệu cũ nếu không yêu cầu skip (thường là chunk đầu tiên hoặc request đơn)
            if (!skipDelete) {
                console.log(`[API] Clearing existing data for ${month}`);
                await supabase.from('settlement_inventory_data').delete().eq('month', monthStored);
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

            // CHUNKING: Chia nhỏ dữ liệu để insert (tránh lỗi giới hạn tham số của Postgres)
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
                // Ta cũng thêm ghi chú 'bulk_insert' để cron-sync biết đây là mảng dữ liệu
                await supabase.from('gs_sync_queue').insert({
                    table_name: 'settlement_inventory_data',
                    action: 'insert',
                    payload: itemsToInsert
                });
                console.log('[Dual-Write] Queued GS Insert for settlement_inventory_data');
            } catch (gsError) {
                console.error('[Dual-Write] Failed to queue GS sync:', gsError);
                // Không throw error ở đây để không làm hỏng transaction chính của Supabase
            }

            return res.status(201).json({ success: true, count: itemsToInsert.length, duration });
        } catch (error: any) {
            console.error('Insert inventory error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
