import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase, fetchAll } from './_utils/supabase.js';
import { randomUUID } from 'crypto';
import { runSyncQueue } from './_utils/syncQueue.js';

// --- Helpers ---
const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const parseLocalDate = (dateStr: any) => {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date(0) : dateStr;
    const s = String(dateStr).trim();
    const parts = s.split('/');
    if (parts.length === 3) {
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

// --- Helper to send webhook ---
const sendWebhook = async (type: 'inbound' | 'outbound', data: any) => {
    const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
    if (type === 'inbound' || !N8N_WEBHOOK_URL) return;
    try {
        const payload = Array.isArray(data) ? data : [data];
        fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, timestamp: new Date().toISOString(), data: payload })
        }).catch(err => console.error('[Webhook] Failed:', err));
    } catch (e) { console.error('[Webhook] Error:', e); }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        switch (req.method) {
            case 'GET': {
                const type = req.query.type as string;
                const allRecords = String(req.query.all || '').toLowerCase() === 'true';
                const daysParam = parseInt(req.query.days as string, 10) || 30; // Reduce default from 60 to 30 days for faster load
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - daysParam);
                const limitDateIso = limitDate.toISOString();

                // 1. Try Supabase first (Fast) — fallback chỉ khi có lỗi thật
                try {
                    if (!type) {
                        const [inbound, outbound] = await Promise.all([
                            fetchAll('inbound_transactions', '*, product:products(name, item_code, unit)', (q) => allRecords ? q : q.gte('inbound_date', limitDateIso)),
                            fetchAll('outbound_transactions', '*, product:products(name, item_code, unit)', (q) => allRecords ? q : q.gte('outbound_date', limitDateIso))
                        ]);
                        const merged = [
                            ...inbound.map(t => ({ ...t, type: 'inbound', date: t.inbound_date })),
                            ...outbound.map(t => ({ ...t, type: 'outbound', date: t.outbound_date }))
                        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        // Trả về kể cả khi rỗng — đây là dữ liệu hợp lệ từ Supabase
                        return res.status(200).json(merged);
                    } else {
                        const table = type === 'outbound' ? 'outbound_transactions' : 'inbound_transactions';
                        const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';
                        const data = await fetchAll(table, '*, product:products(name, item_code, unit)', (q) => (allRecords ? q : q.gte(dateField, limitDateIso)).order(dateField, { ascending: false }));
                        return res.status(200).json(data.map(t => ({ ...t, type, date: type === 'inbound' ? t.inbound_date : t.outbound_date })));
                    }
                } catch (e: any) {
                    // Supabase is authoritative. Returning a stale Google Sheets mirror here
                    // would conceal a replication lag and allow users to act on divergent data.
                    console.error('[Transactions GET] Supabase unavailable:', e);
                    return res.status(503).json({
                        error: 'Supabase is temporarily unavailable; Google Sheets mirror is not used as a fallback.',
                        details: e?.message || 'Unknown Supabase error'
                    });
                }
            }

            case 'POST': {
                const { type, action, payload, created_by, product_id } = req.body;
                const creator = created_by || 'system';

                // --- Best-Effort Dual-Write Logic ---
                const performWrite = async (table: string, items: any[], queueAction: 'insert' | 'replace' = 'insert') => {
                    // 1. Supabase (Chunked upsert)
                    const chunkSize = 1000;
                    for (let i = 0; i < items.length; i += chunkSize) {
                        const chunk = items.slice(i, i + chunkSize);
                        const { error: sbError } = await supabase
                            .from(table)
                            .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
                        if (sbError) {
                            console.error('SB Write Error:', sbError);
                            throw sbError;
                        }
                    }

                    // 2. Queue the rows as committed by Supabase, not the request draft.
                    // This preserves database defaults/triggers (for example total_price)
                    // in the Google Sheets mirror.
                    let syncQueued = true;
                    try {
                        let mirrorPayload: any[];
                        if (queueAction === 'replace') {
                            mirrorPayload = await fetchAll(table, '*');
                        } else {
                            mirrorPayload = [];
                            const ids = items.map(item => item.id).filter(Boolean);
                            for (let i = 0; i < ids.length; i += chunkSize) {
                                const { data: committedRows, error: committedError } = await supabase
                                    .from(table)
                                    .select('*')
                                    .in('id', ids.slice(i, i + chunkSize));
                                if (committedError) throw committedError;
                                mirrorPayload.push(...(committedRows || []));
                            }
                        }

                        await supabase.from('gs_sync_queue').insert({
                            table_name: table,
                            action: queueAction,
                            payload: mirrorPayload
                        });
                        
                        // Kích hoạt tiến trình đồng bộ ngầm xử lý hàng đợi (chạy ngầm, không await để phản hồi client ngay)
                        runSyncQueue().catch(err => console.error('[Background Sync Trigger] Error:', err));
                    } catch (queueErr: any) {
                        console.error('Queue Sync Error:', queueErr);
                        syncQueued = false;
                    }

                    return { syncQueued };
                };

                // --- Action: Sync from QR Sheet ---
                if (action === 'sync_from_qr') {
                    const doc = await getGoogleSheet();
                    const qrSheet = doc.sheetsByTitle['Creat_QRcode'];
                    if (!qrSheet) return res.status(404).json({ error: 'Sheet Creat_QRcode not found' });

                    const [qrRows, existingRows, products] = await Promise.all([
                        qrSheet.getRows(),
                        supabase.from('inbound_transactions').select('serial_code'),
                        supabase.from('products').select('*').eq('id', product_id).single()
                    ]);

                    const product = products.data;
                    const existingSerials = new Set((existingRows.data || []).map(r => String(r.serial_code || '').trim()).filter(Boolean));

                    const toInsert = qrRows.map(row => {
                        const serial = String(row.get('serial_code') || '').trim();
                        if (!serial || existingSerials.has(serial)) return null;
                        existingSerials.add(serial);
                        return {
                            id: randomUUID(), product_id, serial_code: serial, quantity: 1, item_status: 'Mới',
                            district: row.get('District') || 'Kho Tổng', inbound_date: new Date().toISOString(),
                            created_by: creator, unit_price: product?.unit_price || 0
                        };
                    }).filter(Boolean);

                    if (toInsert.length > 0) await performWrite('inbound_transactions', toInsert);
                    return res.status(200).json({ message: `Synced ${toInsert.length} QR codes`, count: toInsert.length });
                }

                // --- Action: Sync from In Stock Sheet ---
                if (action === 'sync_from_in_stock') {
                    const doc = await getGoogleSheet();
                    const stockSheet = doc.sheetsByTitle['in_stock'];
                    if (!stockSheet) return res.status(404).json({ error: 'Sheet in_stock not found' });

                    // Read and validate the complete source before touching persisted data.
                    // A blank/invalid source file must never be allowed to wipe inventory.
                    const [sRows, products] = await Promise.all([
                        stockSheet.getRows(),
                        fetchAll('products', '*')
                    ]);

                    const productsMap: Record<string, any> = {};
                    products.forEach(p => {
                        productsMap[p.id] = p;
                        if (p.item_code) productsMap[String(p.item_code).trim()] = p;
                    });

                    // Build missing catalog entries from the source first. The source stock code
                    // is retained as both id and item_code so later stock rows resolve exactly.
                    const missingProducts: any[] = [];
                    for (const row of sRows) {
                        const code = String(row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT') || '').trim();
                        if (!code || productsMap[code]) continue;
                        const product = {
                            id: code,
                            item_code: code,
                            name: row.get('product') || row.get('product1') || row.get('TEN_HANG') || row.get('Tên Hàng Hóa') || code,
                            unit: row.get('DVT') || row.get('ĐVT') || row.get('unit') || 'Cái',
                            unit_price: 0,
                            type: row.get('check_loại_hang') || undefined,
                        };
                        productsMap[code] = product;
                        missingProducts.push(product);
                    }

                    if (missingProducts.length > 0) {
                        const catalogWrite = await performWrite('products', missingProducts);
                        if (!catalogWrite.syncQueued) {
                            await supabase.from('products').delete().in('id', missingProducts.map(product => product.id));
                            return res.status(503).json({
                                error: 'Không thể tạo hàng đợi đồng bộ danh mục sản phẩm; không thay đổi tồn kho.'
                            });
                        }
                    }

                    // A source sheet can contain one aggregate stock row and separate serial
                    // detail rows for the same product/warehouse. The aggregate is the
                    // authoritative quantity; serial rows are retained for traceability but
                    // must not be added to stock a second time.
                    const aggregateStockKeys = new Set(sRows.flatMap(row => {
                        const productId = String(row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT') || '').trim();
                        const sourceSerial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
                        const warehouse = String(row.get('loai_kho') || row.get('district') || row.get('District') || 'Kho Tổng').trim().toUpperCase();
                        return productId && !sourceSerial ? [`${productId}|${warehouse}`] : [];
                    }));

                    // Set to avoid duplicates within the current sync file
                    const existingSerials = new Set<string>();
                    const toInsert: any[] = [];
                    const syncTime = new Date().toISOString();

                    for (const [rowIndex, row] of sRows.entries()) {
                        const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
                        if (!pIdRaw) continue;
                        const product = productsMap[String(pIdRaw).trim()];
                        if (!product) continue;

                        const serialRaw = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
                        const isVT = String(row.get('check_loại_hang')).trim() === 'VT-TKM';
                        const serial = serialRaw || (isVT ? `VT-${row.get('ID')}` : '');
                        const warehouse = String(row.get('loai_kho') || row.get('district') || row.get('District') || 'Kho Tổng').trim().toUpperCase();
                        // Items without a serial are valid aggregate stock rows. Deduplicate them
                        // by their source-row identity rather than dropping them entirely.
                        const sourceKey = `${product.id}|${warehouse}|${serial || `NO-SERIAL-${row.get('ID') || rowIndex}`}`;

                        if (!existingSerials.has(sourceKey)) {
                            existingSerials.add(sourceKey);
                            const qtyStr = String(row.get('quantity') || '').trim();
                            const sourceQty = qtyStr ? parseFloat(qtyStr.replace(/\./g, '').replace(/,/g, '')) : 1;
                            const qty = serialRaw && aggregateStockKeys.has(`${String(pIdRaw).trim()}|${warehouse}`) ? 0 : sourceQty;

                            toInsert.push({
                                id: randomUUID(),
                                product_id: product.id,
                                serial_code: serial,
                                quantity: isNaN(qty) ? 1 : Math.round(qty),
                                item_status: row.get('item_status') || row.get('status') || 'Mới',
                                district: row.get('district') || row.get('District') || 'Kho Tổng',
                                // Preserve the source receipt date. Falling back to the sync time is
                                // only appropriate when the source truly has no usable date.
                                inbound_date: (() => {
                                    const sourceDate = row.get('inbound_date') || row.get('NGAY_NHAP') || row.get('Ngay_Nhap') || row.get('receipt_date');
                                    const parsed = parseLocalDate(sourceDate);
                                    return parsed.getTime() > 0 ? parsed.toISOString() : syncTime;
                                })(),
                                created_by: creator,
                                unit_price: product.unit_price || 0,
                                sap_id: row.get('ID_SAP') || '',
                                tc_id: row.get('ID_TC') || '',
                                item_type: row.get('check_loại_hang') || '',
                                warehouse_type: row.get('loai_kho') || '',
                                full_name: row.get('full_name') || ''
                            });
                        }
                    }

                    if (toInsert.length === 0) {
                        return res.status(422).json({
                            error: 'Không tìm thấy bản ghi kho hợp lệ; dữ liệu hiện tại không bị thay đổi.'
                        });
                    }

                    // Do not remove the existing data until the source has been fully read and
                    // validated. This keeps a temporary source outage from becoming data loss.
                    const previousRows = await fetchAll('inbound_transactions', '*');
                    const { error: deleteError } = await supabase
                        .from('inbound_transactions')
                        .delete()
                        .neq('id', '00000000-0000-0000-0000-000000000000');
                    if (deleteError) {
                        console.error('Lỗi xóa inbound_transactions cũ trên Supabase:', deleteError);
                        return res.status(500).json({ error: 'Không thể chuẩn bị dữ liệu mới trên database; dữ liệu hiện tại được giữ nguyên.' });
                    }

                    try {
                        const writeResult = await performWrite('inbound_transactions', toInsert, 'replace');

                        // Do not clear the mirror when the replacement job was not queued.
                        // Roll Supabase back as well: the operation must not report a successful
                        // replacement while its Google Sheets mirror cannot be guaranteed.
                        if (!writeResult.syncQueued) {
                            await supabase
                                .from('inbound_transactions')
                                .delete()
                                .neq('id', '00000000-0000-0000-0000-000000000000');
                            for (let i = 0; i < previousRows.length; i += 1000) {
                                const { error: restoreError } = await supabase
                                    .from('inbound_transactions')
                                    .upsert(previousRows.slice(i, i + 1000), { onConflict: 'id' });
                                if (restoreError) throw restoreError;
                            }
                            return res.status(503).json({
                                error: 'Không tạo được hàng đợi đồng bộ Google Sheets; dữ liệu đã được khôi phục và không có thay đổi nào được xác nhận.'
                            });
                        }

                        // The in_stock sheet is the one-way source. Verify that Supabase now
                        // contains every validated source row before the client is told the
                        // sync succeeded. This catches partial writes even when a batch error
                        // was not surfaced by the transport layer.
                        const committedRows = await fetchAll('inbound_transactions', 'id');
                        const expectedIds = new Set(toInsert.map(item => item.id));
                        const committedIds = new Set(committedRows.map(row => row.id));
                        const isExactReplacement = committedRows.length === toInsert.length
                            && expectedIds.size === toInsert.length
                            && [...expectedIds].every(id => committedIds.has(id));
                        if (!isExactReplacement) {
                            throw new Error(`Đối soát tồn kho thất bại: nguồn có ${toInsert.length} dòng, cơ sở dữ liệu có ${committedRows.length} dòng.`);
                        }
                    } catch (writeError) {
                        // Best-effort rollback keeps the previously committed inventory available
                        // if replacement fails after the delete. The original write error remains
                        // visible to the caller even if restoring the snapshot also fails.
                        try {
                            if (previousRows.length > 0) {
                                for (let i = 0; i < previousRows.length; i += 1000) {
                                    const { error: restoreError } = await supabase
                                        .from('inbound_transactions')
                                        .upsert(previousRows.slice(i, i + 1000), { onConflict: 'id' });
                                    if (restoreError) throw restoreError;
                                }
                            }
                        } catch (restoreError) {
                            console.error('Khôi phục dữ liệu nhập kho sau lỗi đồng bộ thất bại:', restoreError);
                        }
                        console.error('Lỗi ghi dữ liệu đồng bộ mới:', writeError);
                        return res.status(500).json({ error: 'Đồng bộ chưa hoàn tất; đã thử khôi phục dữ liệu trước đó. Vui lòng thử lại hoặc kiểm tra nhật ký đồng bộ.' });
                    }

                    return res.status(202).json({
                        message: `Đã cập nhật ${toInsert.length} sản phẩm; Google Sheets đang đồng bộ an toàn từ hàng đợi.`,
                        count: toInsert.length,
                        sync_pending: true
                    });
                }

                if (!['inbound', 'outbound'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
                const transactions = Array.isArray(payload) ? payload : [payload];
                const now = new Date().toISOString();

                const processed = transactions.map(p => {
                    const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';
                    const { total_price, ...rest } = p;
                    return {
                        ...rest,
                        id: p.id || randomUUID(),
                        [dateField]: p[dateField] || now,
                        created_at: p.created_at || now,
                        updated_at: now,
                        created_by: p.created_by || creator
                    };
                });

                await performWrite(table, processed);
                if (type === 'outbound') sendWebhook(type, processed);
                return res.status(201).json(Array.isArray(payload) ? processed : processed[0]);
            }

            case 'PUT': {
                const { id, type, payload } = req.body;
                if (!id || !type) return res.status(400).json({ error: 'ID and type required' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';

                // 1. Supabase
                const { data: updatedRow, error: sbError } = await supabase
                    .from(table)
                    .update({ ...payload, updated_at: new Date().toISOString() })
                    .eq('id', id)
                    .select('*, product:products(name, item_code, unit)')
                    .single();
                const sbSuccess = !sbError;
                if (sbError) console.error('SB Update Error:', sbError);

                // 2. Google Sheets
                try {
                    const updatePromise = async () => {
                        const doc = await getGoogleSheet();
                        const sheet = doc.sheetsByTitle[table];
                        const rows = await sheet.getRows();
                        const row = rows.find(r => r.get('id') === id);
                        if (row) {
                            Object.keys(payload).forEach(k => { if (payload[k] !== undefined) row.set(k, payload[k]); });
                            row.set('updated_at', formatLocalDate(new Date()));
                            await row.save();
                        }
                    };
                    await Promise.race([
                        updatePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.error('GS Update Error:', e);
                    if (!sbSuccess) {
                        return res.status(500).json({ error: 'Cập nhật thất bại trên cả 2 hệ thống' });
                    }
                    await supabase.from('gs_sync_queue').insert({
                        table_name: table,
                        action: 'update',
                        payload: { id, updates: payload },
                        error_message: e.message
                    });
                }

                if (!updatedRow) return res.status(404).json({ error: 'Không tìm thấy giao dịch cần cập nhật' });
                const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';
                return res.status(200).json({ ...updatedRow, type, date: updatedRow[dateField] });
            }

            case 'DELETE': {
                const { id, ids, type } = req.body;
                if (!type) return res.status(400).json({ error: 'Type required' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
                const targetIds = Array.isArray(ids) ? ids : [id];

                // 1. Supabase
                const { error: sbError } = await supabase.from(table).delete().in('id', targetIds);
                const sbSuccess = !sbError;
                if (sbError) console.error('SB Delete Error:', sbError);

                // 2. Google Sheets
                try {
                    const deletePromise = async () => {
                        const doc = await getGoogleSheet();
                        const sheet = doc.sheetsByTitle[table];
                        const rows = await sheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                        }
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.error('GS Delete Error:', e);
                    if (!sbSuccess) {
                        return res.status(500).json({ error: 'Xóa thất bại trên cả 2 hệ thống' });
                    }
                    await supabase.from('gs_sync_queue').insert({
                        table_name: table,
                        action: 'delete',
                        payload: { ids: targetIds },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ message: `Deleted ${targetIds.length} items`, ids: targetIds });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Transactions):', error);
        return res.status(500).json({ error: error.message });
    }
}
