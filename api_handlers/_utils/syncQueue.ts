import { supabase } from './supabase.js';
import { getGoogleSheet } from './googleSheets.js';

const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export async function runSyncQueue() {
    console.log('[Background Sync] Khởi động tiến trình xử lý hàng đợi đồng bộ ngầm...');

    try {
        const { data: queue, error: fetchError } = await supabase
            .from('gs_sync_queue')
            .select('*')
            .eq('status', 'pending')
            .lt('retry_count', 3)
            .order('created_at', { ascending: true })
            .limit(10); // Tăng limit lên 10 để xử lý nhanh hơn

        if (fetchError) throw fetchError;

        if (!queue || queue.length === 0) {
            console.log('[Background Sync] Không có lệnh nào chờ đồng bộ.');
            return { message: 'No pending items' };
        }

        const doc = await getGoogleSheet();
        const results = { successful: 0, failed: 0 };

        for (const job of queue) {
            const { id, table_name, action, payload } = job;
            
            // Đánh dấu đang xử lý
            await supabase.from('gs_sync_queue').update({ status: 'processing' }).eq('id', id);

            const sheet = doc.sheetsByTitle[table_name];
            if (!sheet) {
                console.warn(`[Background Sync] Không tìm thấy Sheet có tên: ${table_name}`);
                await supabase.from('gs_sync_queue').update({ status: 'failed', error_message: `Sheet ${table_name} not found` }).eq('id', id);
                results.failed++;
                continue;
            }

            try {
                const pk = table_name === 'district_storekeepers' ? 'district' : 'id';

                if (action === 'insert') {
                    const items = Array.isArray(payload) ? payload : [payload];
                    const chunkSize = 100;
                    for (let i = 0; i < items.length; i += chunkSize) {
                        if (i > 0) await new Promise(resolve => setTimeout(resolve, 1000));
                        const chunk = items.slice(i, i + chunkSize);
                        
                        const nowLocal = formatLocalDate(new Date());
                        const dateField = table_name === 'inbound_transactions' ? 'inbound_date' : 
                                          (table_name === 'outbound_transactions' ? 'outbound_date' : 
                                          (table_name === 'orders' ? 'order_date' : null));
                        
                        const gsItems = chunk.map((p: any) => {
                            const item = { ...p };
                            // Remove product objects or metadata that are not columns in Google Sheets
                            delete item.product;
                            
                            if (dateField && item[dateField]) {
                                item[dateField] = item[dateField].includes('/') ? item[dateField] : formatLocalDate(item[dateField]);
                            } else if (dateField) {
                                item[dateField] = nowLocal;
                            }
                            item.created_at = item.created_at ? (item.created_at.includes('/') ? item.created_at : formatLocalDate(item.created_at)) : nowLocal;
                            item.updated_at = nowLocal;
                            return item;
                        });
                        
                        await sheet.addRows(gsItems);
                    }
                } else if (action === 'update') {
                    const rows = await sheet.getRows();
                    const targetId = payload[pk] || payload.id;
                    const updates = payload.updates || payload;
                    const row = rows.find(r => r.get(pk) === targetId);
                    if (row) {
                        Object.keys(updates).forEach(k => { 
                            if (updates[k] !== undefined && k !== 'product') row.set(k, updates[k]); 
                        });
                        if (!updates.updated_at && row.get('updated_at') !== undefined) row.set('updated_at', formatLocalDate(new Date()));
                        await row.save();
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                } else if (action === 'delete') {
                    const rows = await sheet.getRows();
                    const targetIds = payload.ids || [payload[pk] || payload.id];
                    let deletedCount = 0;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get(pk))) {
                            await rows[i].delete();
                            deletedCount++;
                            if (deletedCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                            else await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                } else if (action === 'delete_by_month') {
                    const rows = await sheet.getRows();
                    const formats = payload.formats || [payload.month];
                    let deletedCount = 0;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        const rowMonth = rows[i].get('month');
                        if (formats.includes(rowMonth)) {
                            await rows[i].delete();
                            deletedCount++;
                            if (deletedCount % 5 === 0) await new Promise(resolve => setTimeout(resolve, 1000));
                            else await new Promise(resolve => setTimeout(resolve, 300));
                        }
                    }
                }

                // Xóa khỏi queue sau khi đồng bộ thành công
                await supabase.from('gs_sync_queue').delete().eq('id', id);
                results.successful++;
                console.log(`[Background Sync] Đồng bộ thành công job ${id} cho bảng ${table_name}`);

            } catch (jobError: any) {
                console.error(`[Background Sync] Lỗi xử lý job ${id} (${table_name}):`, jobError.message);
                await supabase.from('gs_sync_queue').update({ 
                    status: 'pending', // Trả về trạng thái pending để thử lại
                    error_message: jobError.message,
                    retry_count: (job.retry_count || 0) + 1 
                }).eq('id', id);
                results.failed++;
            }
        }
        
        isSyncing = false;
        return results;

    } catch (e: any) {
        isSyncing = false;
        console.error('[Background Sync] Lỗi tiến trình đồng bộ ngầm:', e.message);
        throw e;
    }
}
