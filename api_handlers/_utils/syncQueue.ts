import { supabase } from './supabase.js';
import { getGoogleSheet } from './googleSheets.js';

const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

/** Helper: dừng n milliseconds */
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Convert a database record to the shape accepted by the Google Sheet. */
export const toSheetRow = (payload: any, tableName: string) => {
    const item = { ...payload };
    delete item.product;

    // JSON/JSONB fields are valid in Supabase but the Sheets API only accepts
    // scalar cell values. Preserve the value as JSON rather than dropping it.
    for (const [key, value] of Object.entries(item)) {
        if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
            item[key] = JSON.stringify(value);
        }
    }

    // Serial numbers are identifiers, never quantities or dates. Force text so
    // Google Sheets cannot coerce a 14-digit serial into a date/scientific value.
    if (item.serial_code !== null && item.serial_code !== undefined) {
        item.serial_code = String(item.serial_code);
    }

    const dateField = tableName === 'inbound_transactions' ? 'inbound_date'
        : tableName === 'outbound_transactions' ? 'outbound_date'
        : tableName === 'orders' ? 'order_date' : null;
    const nowLocal = formatLocalDate(new Date());

    if (dateField) {
        item[dateField] = item[dateField]
            ? (String(item[dateField]).includes('/') ? item[dateField] : formatLocalDate(item[dateField]))
            : nowLocal;
    }
    item.created_at = item.created_at
        ? (String(item.created_at).includes('/') ? item.created_at : formatLocalDate(item.created_at))
        : nowLocal;
    item.updated_at = item.updated_at
        ? (String(item.updated_at).includes('/') ? item.updated_at : formatLocalDate(item.updated_at))
        : nowLocal;
    return item;
};

export const SHEET_WRITE_CHUNK_SIZE = 250;
export const SHEET_WRITE_DELAY_MS = 1500;

const addRowsInChunks = async (sheet: any, rows: any[]) => {
    for (let i = 0; i < rows.length; i += SHEET_WRITE_CHUNK_SIZE) {
        if (i > 0) await sleep(SHEET_WRITE_DELAY_MS);
        await sheet.addRows(rows.slice(i, i + SHEET_WRITE_CHUNK_SIZE));
    }
};

/**
 * Supabase is the source of truth. A replace job is successful only after the
 * Google Sheets mirror contains exactly the same number of rows and keys.
 */
export const assertReplacementMirror = (mirroredRows: any[], items: any[], tableName: string) => {
    const primaryKey = tableName === 'district_storekeepers' ? 'district' : 'id';
    const expectedRows = items.map(item => toSheetRow(item, tableName));
    if (mirroredRows.length !== expectedRows.length) {
        throw new Error(`Đối soát Google Sheets thất bại: Supabase có ${expectedRows.length} dòng, Google Sheets có ${mirroredRows.length} dòng.`);
    }
    const expectedKeys = new Set(expectedRows.map(row => String(row[primaryKey] || '')));
    const mirroredKeys = new Set(mirroredRows.map(row => String(row.get(primaryKey) || '')));
    if (expectedKeys.size !== expectedRows.length) {
        throw new Error(`Đối soát Google Sheets thất bại: Supabase có khóa ${primaryKey} trùng.`);
    }
    if (mirroredKeys.size !== mirroredRows.length || mirroredKeys.has('')) {
        throw new Error(`Đối soát Google Sheets thất bại: Google Sheets có khóa ${primaryKey} trùng hoặc rỗng.`);
    }
    const missingKeys = [...expectedKeys].filter(key => !mirroredKeys.has(key));
    if (missingKeys.length) {
        throw new Error(`Đối soát Google Sheets thất bại: thiếu ${missingKeys.length} khóa ${primaryKey} từ Supabase.`);
    }
    const staleKeys = [...mirroredKeys].filter(key => !expectedKeys.has(key));
    if (staleKeys.length) {
        throw new Error(`Đối soát Google Sheets thất bại: có ${staleKeys.length} khóa ${primaryKey} không còn tồn tại trong Supabase.`);
    }
};

const verifyReplacementMirror = async (sheet: any, items: any[], tableName: string) => {
    assertReplacementMirror(await sheet.getRows(), items, tableName);
};

export async function runSyncQueue() {
    console.log('[Background Sync] Khởi động tiến trình xử lý hàng đợi đồng bộ ngầm...');

    try {
        // The database claims jobs under a row lock. An in-memory flag is not safe in
        // serverless because each invocation has its own process.
        const { data: queue, error: fetchError } = await supabase
            .rpc('claim_gs_sync_jobs', { p_limit: 10 });

        if (fetchError) throw fetchError;

        if (!queue || queue.length === 0) {
            console.log('[Background Sync] Không có lệnh nào chờ đồng bộ.');
            return { message: 'No pending items' };
        }

        const doc = await getGoogleSheet();
        const results = { successful: 0, failed: 0 };

        // Adaptive delay: khởi đầu 1200ms, giảm sau success (min 800ms), tăng sau lỗi
        let currentDelay = 1200;
        const MIN_DELAY = 800;
        const BASE_DELAY = 1200;
        const ERROR_DELAY = 2000;

        for (const job of queue) {
            const { id, table_name, action, payload } = job;

            // in_stock is the one-way external source and must never be written
            // from Supabase or the durable outbox.
            if (table_name === 'in_stock') {
                await supabase.from('gs_sync_queue').update({
                    status: 'failed',
                    error_message: 'in_stock là nguồn nhập một chiều từ Google Sheets; ghi ngược bị chặn.'
                }).eq('id', id);
                results.failed++;
                continue;
            }
            
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
                    const rows = await sheet.getRows();
                    const existingById = new Map(rows.map(row => [String(row.get(pk) || ''), row]));
                    const newRows: any[] = [];

                    // Queue jobs may be retried after a transient Google API failure. Upsert by
                    // primary key so retries repair the mirror instead of creating duplicate rows.
                    for (const item of items.map((entry: any) => toSheetRow(entry, table_name))) {
                        const existing = existingById.get(String(item[pk] || ''));
                        if (existing) {
                            existing.assign(item);
                            await existing.save();
                        } else {
                            newRows.push(item);
                        }
                    }
                    await addRowsInChunks(sheet, newRows);
                } else if (action === 'replace') {
                    const items = Array.isArray(payload) ? payload : [payload];
                    // A replacement job is deliberately idempotent: if a run is interrupted,
                    // retrying starts from a clean sheet and writes the complete Supabase snapshot.
                    await sheet.clearRows();
                    await addRowsInChunks(sheet, items.map((entry: any) => toSheetRow(entry, table_name)));
                    await verifyReplacementMirror(sheet, items, table_name);
                } else if (action === 'update') {
                    const rows = await sheet.getRows();
                    const targetId = String(payload[pk] || payload.id || '');
                    const updates = payload.updates || payload;
                    const row = rows.find(r => String(r.get(pk) || '') === targetId);
                    if (row) {
                        Object.keys(updates).forEach(k => { 
                            if (updates[k] !== undefined && k !== 'product') row.set(k, updates[k]); 
                        });
                        if (!updates.updated_at && row.get('updated_at') !== undefined) row.set('updated_at', formatLocalDate(new Date()));
                        await row.save();
                        await sleep(300);
                    } else {
                        // Missing rows must never be silently accepted as synced.
                        throw new Error(`Không tìm thấy bản ghi ${targetId} trên Google Sheets để cập nhật`);
                    }
                } else if (action === 'delete') {
                    const rows = await sheet.getRows();
                    const targetIds = new Set((payload.ids || [payload[pk] || payload.id]).map((value: unknown) => String(value)));
                    let deletedCount = 0;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.has(String(rows[i].get(pk) || ''))) {
                            await rows[i].delete();
                            deletedCount++;
                            if (deletedCount % 5 === 0) await sleep(1000);
                            else await sleep(300);
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
                            if (deletedCount % 5 === 0) await sleep(1000);
                            else await sleep(300);
                        }
                    }
                }

                // Xóa khỏi queue sau khi đồng bộ thành công.  Do not silently accept
                // a failed acknowledgement: the operation is idempotent on retry.
                const { error: deleteQueueError } = await supabase.from('gs_sync_queue').delete().eq('id', id);
                if (deleteQueueError) throw deleteQueueError;
                results.successful++;
                console.log(`[Background Sync] Đồng bộ thành công job ${id} cho bảng ${table_name}`);

                // Adaptive delay: sau mỗi success liên tiếp, giảm dần về MIN_DELAY
                currentDelay = Math.max(MIN_DELAY, currentDelay - 100);
                await sleep(currentDelay);

            } catch (jobError: any) {
                const errMsg: string = jobError?.message || String(jobError);
                console.error(`[Background Sync] Lỗi xử lý job ${id} (${table_name}):`, errMsg);

                // ── Xử lý đặc biệt khi gặp Rate Limit 429 ──
                if (errMsg.includes('429')) {
                    console.warn(`[Background Sync] Rate limit 429 gặp phải! Reset job ${id} về pending (không tăng retry_count). Ngủ 60s...`);
                    // Reset về pending nhưng KHÔNG tăng retry_count để không "tiêu" lượt thử
                    await supabase.from('gs_sync_queue').update({
                        status: 'pending',
                        error_message: `Rate limit 429 tại ${new Date().toISOString()}: ${errMsg}`
                    }).eq('id', id);

                    // Let the next scheduled invocation retry. Sleeping in a serverless
                    // request wastes the function budget and can strand other jobs.
                    return { message: 'rate_limited' };
                }

                // Keep the durable outbox pending. A temporary Google API/network problem must
                // not silently leave a Supabase write permanently absent from the mirror.
                await supabase.from('gs_sync_queue').update({ 
                    status: 'pending',
                    error_message: errMsg,
                    retry_count: (job.retry_count || 0) + 1 
                }).eq('id', id);
                results.failed++;

                // Adaptive delay: sau lỗi non-429, tăng lên ERROR_DELAY
                currentDelay = ERROR_DELAY;
                await sleep(currentDelay);
                // Dần hồi phục về BASE_DELAY cho job tiếp theo
                currentDelay = BASE_DELAY;
            }
        }
        
        return results;

    } catch (e: any) {
        console.error('[Background Sync] Lỗi tiến trình đồng bộ ngầm:', e.message);
        throw e;
    }
}
