import 'dotenv/config';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet } from './_utils/googleSheets.js';
import { supabase, fetchAll } from './_utils/supabase.js';
import { randomUUID } from 'crypto';

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

        // 1. Xóa toàn bộ dữ liệu inbound_transactions cũ trên Supabase
        const { error: deleteError } = await supabase
            .from('inbound_transactions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteError) {
            console.error('[Cron Sync Stock] Lỗi xóa inbound_transactions cũ trên Supabase:', deleteError);
            return res.status(500).json({ error: 'Không thể xóa dữ liệu cũ trên database' });
        }

        // 2. Xóa các dòng trong Google Sheet inbound_transactions để đồng bộ
        try {
            const inboundSheet = doc.sheetsByTitle['inbound_transactions'];
            if (inboundSheet) {
                await inboundSheet.clearRows();
            }
        } catch (gsClearErr) {
            console.error('[Cron Sync Stock] Lỗi xóa inbound_transactions cũ trên Google Sheets:', gsClearErr);
        }

        // 3. Đọc dữ liệu từ stock sheet và danh sách sản phẩm từ Supabase
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
                const newId = randomUUID();
                const newProd = {
                    id: newId,
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
            const { error: pErr } = await supabase.from('products').insert(newProductsToInsert);
            if (pErr) console.error("Lỗi khi tạo sản phẩm mới:", pErr);
            Object.assign(productsMap, missingProductsMap);
        }

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

            const qtyStr = String(row.get('quantity') || '').trim();
            const qty = qtyStr ? parseFloat(qtyStr.replace(/\./g, '').replace(/,/g, '')) : 1;

            toInsert.push({
                id: randomUUID(),
                product_id: product.id,
                serial_code: serial,
                quantity: isNaN(qty) ? 1 : Math.round(qty),
                item_status: row.get('item_status') || row.get('status') || 'Mới',
                district: row.get('district') || row.get('District') || 'Kho Tổng',
                inbound_date: new Date().toISOString(),
                created_by: creator,
                unit_price: product.unit_price || 0,
                sap_id: row.get('ID_SAP') || '',
                tc_id: row.get('ID_TC') || '',
                item_type: row.get('check_loại_hang') || '',
                warehouse_type: row.get('loai_kho') || '',
                full_name: row.get('full_name') || ''
            });
        }

        // 4. Ghi lại dữ liệu mới (Ghi vào Supabase + Google Sheet)
        if (toInsert.length > 0) {
            // 4.1 Ghi vào Supabase
            const chunkSize = 1000;
            for (let i = 0; i < toInsert.length; i += chunkSize) {
                const chunk = toInsert.slice(i, i + chunkSize);
                const { error: sbError } = await supabase
                    .from('inbound_transactions')
                    .upsert(chunk, { onConflict: 'id', ignoreDuplicates: true });
                if (sbError) throw sbError;
            }

            // 4.2 Ghi vào Google Sheet
            try {
                const inboundSheet = doc.sheetsByTitle['inbound_transactions'];
                if (inboundSheet) {
                    const nowLocal = formatLocalDate(new Date());
                    const gsItems = toInsert.map(p => ({
                        ...p,
                        inbound_date: nowLocal,
                        created_at: nowLocal,
                        updated_at: nowLocal
                    }));

                    const gsChunkSize = 250;
                    for (let i = 0; i < gsItems.length; i += gsChunkSize) {
                        await inboundSheet.addRows(gsItems.slice(i, i + gsChunkSize));
                    }
                }
            } catch (gsWriteErr) {
                console.error('[Cron Sync Stock] Lỗi ghi Google Sheets inbound_transactions:', gsWriteErr);
            }
        }

        console.log(`[Cron Sync Stock] Tự động đồng bộ thành công ${toInsert.length} sản phẩm từ kho tổng!`);
        return res.status(200).json({
            message: `Tự động đồng bộ thành công ${toInsert.length} sản phẩm từ kho tổng!`,
            count: toInsert.length
        });

    } catch (error: any) {
        console.error('[Cron Sync Stock] Lỗi đồng bộ tự động từ kho tổng:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
