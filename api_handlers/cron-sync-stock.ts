import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet } from './_utils/googleSheets.js';
import { supabase, fetchAll } from './_utils/supabase.js';
import { randomUUID } from 'crypto';
import { runSyncQueue } from './_utils/syncQueue.js';

const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    console.log('[Cron Sync Stock] Bắt đầu tự động đồng bộ từ kho tổng (in_stock)...');

    try {
        const doc = await getGoogleSheet();
        const stockSheet = doc.sheetsByTitle['in_stock'];
        if (!stockSheet) {
            console.error('[Cron Sync Stock] Không tìm thấy sheet in_stock');
            return res.status(404).json({ error: 'Sheet in_stock not found' });
        }

        // Always load and validate the full source before replacing persisted inventory.
        const [sRows, products] = await Promise.all([
            stockSheet.getRows(),
            fetchAll('products', '*')
        ]);

        const productsMap: Record<string, any> = {};
        products.forEach(p => {
            productsMap[p.id] = p;
            if (p.item_code) productsMap[p.item_code.trim()] = p;
        });

        // Tự động tạo sản phẩm chưa có trong DB
        const missingProductsMap: Record<string, any> = {};
        const newProductsToInsert: any[] = [];
        
        for (const row of sRows) {
            const pIdRaw = String(row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT') || '').trim();
            if (!pIdRaw) continue;
            
            if (!productsMap[pIdRaw] && !missingProductsMap[pIdRaw]) {
                const newProd = {
                    // Keep the in_stock code stable so future rows resolve without a separate
                    // code-to-UUID translation and never create orphan transactions.
                    id: pIdRaw,
                    item_code: pIdRaw,
                    name: row.get('TEN_HANG') || row.get('Tên Hàng Hóa') || row.get('name') || pIdRaw,
                    unit: row.get('DVT') || row.get('ĐVT') || row.get('unit') || 'Cái',
                    unit_price: 0
                };
                missingProductsMap[pIdRaw] = newProd;
                newProductsToInsert.push(newProd);
            }
        }
        
        if (newProductsToInsert.length > 0) {
            console.log(`Đang tự động tạo ${newProductsToInsert.length} sản phẩm mới...`);
            const { error: pErr } = await supabase
                .from('products')
                .upsert(newProductsToInsert, { onConflict: 'id', ignoreDuplicates: true });
            if (pErr) throw pErr;
            const { error: productQueueError } = await supabase.from('gs_sync_queue').insert({
                table_name: 'products', action: 'insert', payload: newProductsToInsert
            });
            if (productQueueError) {
                await supabase.from('products').delete().in('id', newProductsToInsert.map(product => product.id));
                throw new Error('Không tạo được hàng đợi đồng bộ danh mục sản phẩm.');
            }
            Object.assign(productsMap, missingProductsMap);
        }

        // Some source groups have an aggregate quantity plus serial detail rows. Count
        // only the aggregate row while retaining each serial row for lookup and placement.
        const aggregateStockKeys = new Set(sRows.flatMap(row => {
            const productId = String(row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT') || '').trim();
            const sourceSerial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            const warehouse = String(row.get('loai_kho') || row.get('district') || row.get('District') || 'Kho Tổng').trim().toUpperCase();
            return productId && !sourceSerial ? [`${productId}|${warehouse}`] : [];
        }));
        const toInsert: any[] = [];
        const creator = 'system_cron_20h';

        for (const row of sRows) {
            const pIdRaw = String(row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT') || '').trim();
            if (!pIdRaw) continue;
            const product = productsMap[pIdRaw];
            if (!product) continue;

            const serialRaw = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
            const isVT = String(row.get('check_loại_hang')).trim() === 'VT-TKM';
            const serial = serialRaw || (isVT ? `VT-${row.get('ID')}` : '');
            const warehouse = String(row.get('loai_kho') || row.get('district') || row.get('District') || 'Kho Tổng').trim().toUpperCase();

            const qtyStr = String(row.get('quantity') || '').trim();
            const sourceQty = qtyStr ? parseFloat(qtyStr.replace(/\./g, '').replace(/,/g, '')) : 1;
            const qty = serialRaw && aggregateStockKeys.has(`${pIdRaw}|${warehouse}`) ? 0 : sourceQty;

            toInsert.push({
                id: randomUUID(),
                product_id: product.id,
                serial_code: serial,
                quantity: isNaN(qty) ? 1 : Math.round(qty),
                item_status: row.get('item_status') || row.get('status') || 'Mới',
                district: row.get('district') || row.get('District') || 'Kho Tổng',
                inbound_date: (() => {
                    const sourceDate = row.get('inbound_date') || row.get('NGAY_NHAP') || row.get('Ngay_Nhap') || row.get('receipt_date');
                    const parsed = sourceDate ? new Date(sourceDate) : null;
                    return parsed && !isNaN(parsed.getTime()) ? parsed.toISOString() : new Date().toISOString();
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

        if (toInsert.length === 0) {
            return res.status(422).json({ error: 'Không tìm thấy dữ liệu kho hợp lệ; không thay đổi dữ liệu hiện có.' });
        }

        const previousRows = await fetchAll('inbound_transactions', '*');
        const { error: deleteError } = await supabase
            .from('inbound_transactions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) throw deleteError;

        try {
            const chunkSize = 1000;
            for (let i = 0; i < toInsert.length; i += chunkSize) {
                const chunk = toInsert.slice(i, i + chunkSize);
                const { error: sbError } = await supabase
                    .from('inbound_transactions')
                    .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
                if (sbError) throw sbError;
            }
        } catch (writeError) {
            // Restore the previous committed snapshot if replacement cannot be written.
            for (let i = 0; i < previousRows.length; i += 1000) {
                const { error: restoreError } = await supabase
                    .from('inbound_transactions')
                    .upsert(previousRows.slice(i, i + 1000), { onConflict: 'id' });
                if (restoreError) console.error('[Cron Sync Stock] Khôi phục snapshot lỗi:', restoreError);
            }
            throw writeError;
        }

        // The durable outbox performs an idempotent whole-sheet replacement. Do not clear
        // Google Sheets in this request: a failed retry must leave a recoverable mirror.
        // Queue the committed Supabase snapshot, rather than the import draft. Database
        // defaults/triggers (for example total_price) must also be present in the mirror.
        const committedRows = await fetchAll('inbound_transactions', '*');
        const { error: queueError } = await supabase.from('gs_sync_queue').insert({
            table_name: 'inbound_transactions', action: 'replace', payload: committedRows
        });
        if (queueError) {
            await supabase
                .from('inbound_transactions')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000');
            for (let i = 0; i < previousRows.length; i += 1000) {
                await supabase
                    .from('inbound_transactions')
                    .upsert(previousRows.slice(i, i + 1000), { onConflict: 'id' });
            }
            throw new Error('Không tạo được hàng đợi đồng bộ Google Sheets; dữ liệu Supabase đã được khôi phục.');
        }
        runSyncQueue().catch(err => console.error('[Cron Sync Stock] Không thể khởi động đồng bộ Google Sheets:', err));

        console.log(`[Cron Sync Stock] Tự động đồng bộ thành công ${toInsert.length} sản phẩm từ kho tổng!`);
        return res.status(200).json({
            message: `Đã cập nhật ${toInsert.length} sản phẩm; Google Sheets đang đồng bộ an toàn từ hàng đợi.`,
            count: toInsert.length
        });

    } catch (error: any) {
        console.error('[Cron Sync Stock] Lỗi đồng bộ tự động từ kho tổng:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
