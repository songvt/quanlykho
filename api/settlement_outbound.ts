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
                'settlement_outbound_data',
                '*',
                (q) => q.eq('month', normalized).order('id', { ascending: true })
            );
            if (data.length === 0 && raw !== normalized) {
                data = await fetchAll(
                    'settlement_outbound_data',
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
        
        console.log(`[API] Deleting settlement_outbound for ${month}`);
        const { error } = await supabase.from('settlement_outbound_data').delete().eq('month', month as string);
        if (error) return res.status(500).json({ error: error.message });
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

        try {
            // Xóa dữ liệu cũ nếu không yêu cầu skip
            if (!skipDelete) {
                console.log(`[API] Clearing existing data for ${month}`);
                await supabase.from('settlement_outbound_data').delete().eq('month', monthStored);
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

            // CHUNKING: Chia nhỏ dữ liệu để insert (tránh lỗi giới hạn tham số của Postgres)
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
                console.log('[Dual-Write] Queued GS Insert for settlement_outbound_data');
            } catch (gsError) {
                console.error('[Dual-Write] Failed to queue GS sync:', gsError);
            }

            return res.status(201).json({ success: true, count: itemsToInsert.length, duration });
        } catch (error: any) {
            console.error('Insert outbound error:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
}
