import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { CONFIG } from '../src/config.js';
import { randomUUID } from 'crypto';

// --- Memory Cache for Products (Shared across serverless instances for a short time) ---
let productCache: { map: Record<string, any>, timestamp: number } | null = null;
const CACHE_TTL = 60 * 1000; // 60 seconds

const getCachedProductsMap = async (productsSheet: any) => {
    const now = Date.now();
    if (productCache && (now - productCache.timestamp) < CACHE_TTL) {
        return productCache.map;
    }

    const rows = await productsSheet.getRows();
    const map: Record<string, any> = {};
    rows.forEach((r: any) => {
        const productData = {
            id: r.get('id'),
            item_code: r.get('item_code') || r.get('MA_HANG'),
            name: r.get('name') || r.get('TEN_HANG_HOA'),
            unit_price: Number(r.get('unit_price') || 0),
            type: r.get('type') || r.get('LOAI_HANG') || r.get('LOAI_DM')
        };
        if (productData.id) map[String(productData.id)] = productData;
        if (productData.item_code) map[String(productData.item_code).trim()] = productData;
    });
    
    productCache = { map, timestamp: now };
    return map;
};

// --- Helper to ensure headers exist safely ---
const ensureHeaders = async (sheet: any, defaultHeaders: string[]) => {
    if (!sheet.headerValues || sheet.headerValues.length === 0) {
        try { 
            await sheet.loadHeaderRow(); 
        } catch (e) { 
            console.log(`[Headers] Creating new headers for ${sheet.title}`);
            if (sheet.columnCount < defaultHeaders.length) {
                await sheet.updateProperties({ gridProperties: { columnCount: defaultHeaders.length + 2 } });
            }
            await sheet.setHeaderRow(defaultHeaders);
        }
    }
};

// --- Helper to send webhook ---
const sendWebhook = async (type: 'inbound' | 'outbound', data: any) => {
    if (type === 'inbound' || !CONFIG.N8N_WEBHOOK_URL) return;
    try {
        const payload = Array.isArray(data) ? data : [data];
        fetch(CONFIG.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, timestamp: new Date().toISOString(), data: payload })
        }).catch(err => console.error('[Webhook] Failed:', err));
    } catch (e) { console.error('[Webhook] Error:', e); }
};

// --- Helper to format date as dd/mm/yyyy for storage ---
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const doc = await getGoogleSheet();
        const getSheetRobust = (title: string) => {
            const t = title.trim().toLowerCase();
            return doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === t);
        };

        const inboundSheet = getSheetRobust('inbound_transactions');
        const outboundSheet = getSheetRobust('outbound_transactions');
        const productsSheet = getSheetRobust('products') || getSheetRobust('product');

        if (!inboundSheet || !outboundSheet || !productsSheet) {
            return res.status(404).json({ error: 'Missing core sheets' });
        }

        await Promise.all([
            inboundSheet.loadHeaderRow().catch(() => {}),
            outboundSheet.loadHeaderRow().catch(() => {}),
            productsSheet.loadHeaderRow().catch(() => {})
        ]);

        switch (req.method) {
            case 'GET': {
                const type = req.query.type as string;
                const productsMap = await getCachedProductsMap(productsSheet);
                const [iRows, oRows] = await Promise.all([
                    (!type || type === 'inbound') ? inboundSheet.getRows() : Promise.resolve([]),
                    (!type || type === 'outbound') ? outboundSheet.getRows() : Promise.resolve([])
                ]);

                const mapper = (r: any, tType: 'inbound' | 'outbound') => {
                    const t = r.toObject();
                    const qty = Number(t.quantity || 0);
                    const price = Number(t.unit_price || 0);
                    return {
                        ...t,
                        quantity: qty,
                        unit_price: price,
                        total_price: Number(t.total_price || (qty * price)),
                        type: tType,
                        group_name: tType === 'inbound' ? 'N/A' : (t.receiver_group || t.group_name),
                        date: tType === 'inbound' ? t.inbound_date : t.outbound_date,
                        product: productsMap[t.product_id] || { name: 'Unknown' }
                    };
                };

                const all = [
                    ...iRows.map(r => mapper(r, 'inbound')),
                    ...oRows.map(r => mapper(r, 'outbound'))
                ].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());

                return res.status(200).json(all);
            }

            case 'POST': {
                const { type, action, payload, created_by } = req.body;
                const creator = created_by || 'system';
                if (!['inbound', 'outbound'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';

                if (action === 'sync_from_qr') {
                    const qrSheet = getSheetRobust('Creat_QRcode');
                    if (!qrSheet) return res.status(404).json({ error: 'Sheet Creat_QRcode not found' });
                    await qrSheet.loadHeaderRow();

                    const { product_id } = req.body;
                    const [qrRows, inboundRows, productsMap] = await Promise.all([
                        qrSheet.getRows(),
                        inboundSheet.getRows(),
                        getCachedProductsMap(productsSheet)
                    ]);

                    const product = productsMap[product_id];
                    const existingSerials = new Set(inboundRows.map(r => String(r.get('serial_code') || '').trim()).filter(Boolean));
                    
                    const toInsert = qrRows.map(row => {
                        const serial = String(row.get('serial_code') || '').trim();
                        if (!serial || existingSerials.has(serial)) return null;
                        existingSerials.add(serial);
                        return {
                            id: randomUUID(), product_id, serial_code: serial, quantity: 1, item_status: 'Mới',
                            district: row.get('District') || 'Kho Tổng', inbound_date: formatLocalDate(new Date()),
                            created_by: creator, type: 'inbound', created_at: formatLocalDate(new Date()),
                            updated_at: formatLocalDate(new Date()), unit_price: product?.unit_price || 0,
                            total_price: product?.unit_price || 0
                        };
                    }).filter(Boolean);

                    if (toInsert.length > 0) await inboundSheet.addRows(toInsert);
                    return res.status(200).json({ message: `Synced ${toInsert.length} QR codes`, count: toInsert.length });
                }

                if (action === 'sync_from_in_stock') {
                    const stockSheet = doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === 'in_stock');
                    if (!stockSheet) return res.status(404).json({ error: 'Sheet in_stock not found' });
                    await stockSheet.loadHeaderRow();
                    
                    const [sRows, inboundRows, productsMap] = await Promise.all([
                        stockSheet.getRows(),
                        inboundSheet.getRows(),
                        getCachedProductsMap(productsSheet)
                    ]);

                    const existingSerials = new Set(inboundRows.map(r => String(r.get('serial_code') || '').trim()).filter(Boolean));
                    const existingNonSerialMap: Record<string, any> = {};
                    inboundRows.forEach(r => {
                        const serial = String(r.get('serial_code') || '').trim();
                        if (!serial) {
                            const pId = r.get('product_id');
                            const dist = String(r.get('district') || 'Kho Tổng').trim();
                            if (pId) existingNonSerialMap[`${pId}_${dist}`] = r;
                        }
                    });

                    const toInsert: any[] = [];
                    const toUpdate: any[] = [];

                    for (const row of sRows) {
                        const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
                        if (!pIdRaw) continue;

                        const product = productsMap[String(pIdRaw).trim()];
                        if (!product) continue;

                        const canonicalPId = product.id;
                        const serial = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
                        const qty = Number(row.get('quantity') || row.get('SO_LUONG') || row.get('So_Luong') || row.get('TON_KHO') || 0);
                        const status = row.get('status') || row.get('TRANG_THAI') || 'Mới';
                        const district = (row.get('district') || row.get('KHO') || 'Kho Tổng').trim();
                        
                        // Condition check for non-serialized items
                        const itemType = (row.get('type') || row.get('LOAI_HANG') || product.type || '').trim();

                        if (serial) {
                            if (!existingSerials.has(serial)) {
                                existingSerials.add(serial);
                                toInsert.push({
                                    id: randomUUID(), product_id: canonicalPId, serial_code: serial, quantity: 1, 
                                    item_status: status, district, inbound_date: formatLocalDate(new Date()), 
                                    created_by: creator, type: 'inbound', created_at: formatLocalDate(new Date()), 
                                    updated_at: formatLocalDate(new Date()), unit_price: product.unit_price || 0, 
                                    total_price: product.unit_price || 0, source_id: 'sync_stock'
                                });
                            }
                        } else {
                            // Non-serialized item: must be 'VT-TKM' to sync
                            if (itemType !== 'VT-TKM') continue;

                            const key = `${canonicalPId}_${district}`;
                            const existingRow = existingNonSerialMap[key];
                            if (existingRow) {
                                if (Number(existingRow.get('quantity')) !== qty) {
                                    existingRow.set('quantity', qty);
                                    existingRow.set('total_price', qty * (product.unit_price || 0));
                                    existingRow.set('updated_at', formatLocalDate(new Date()));
                                    toUpdate.push(existingRow);
                                }
                            } else {
                                toInsert.push({
                                    id: randomUUID(), product_id: canonicalPId, serial_code: '', quantity: qty, 
                                    item_status: status, district, inbound_date: formatLocalDate(new Date()), 
                                    created_by: creator, type: 'inbound', created_at: formatLocalDate(new Date()), 
                                    updated_at: formatLocalDate(new Date()), unit_price: product.unit_price || 0, 
                                    total_price: qty * (product.unit_price || 0), source_id: 'sync_stock'
                                });
                            }
                        }
                    }

                    if (toInsert.length > 0) await inboundSheet.addRows(toInsert);
                    for (const rowToSave of toUpdate) { await rowToSave.save(); }

                    return res.status(200).json({ message: `Đồng bộ hoàn tất: Thêm ${toInsert.length}, Cập nhật ${toUpdate.length}`, count: toInsert.length + toUpdate.length });
                }

                const transactions = Array.isArray(payload) ? payload : [payload];
                const now = formatLocalDate(new Date());
                const processed = transactions.map(p => ({
                    ...p,
                    id: p.id || randomUUID(),
                    type,
                    [dateField]: p[dateField] ? formatLocalDate(p[dateField]) : now,
                    created_at: p.created_at ? formatLocalDate(p.created_at) : now,
                    updated_at: now,
                    created_by: p.created_by || p.user_name || p.user_id || creator,
                    total_price: p.total_price || (Number(p.quantity || 0) * Number(p.unit_price || 0)),
                    receiver_group: type === 'outbound' ? (p.receiver_group || p.group_name) : undefined
                }));

                const added = await sheetToUse.addRows(processed);
                if (type === 'outbound') sendWebhook(type, processed);
                return res.status(201).json(Array.isArray(payload) ? added.map(r => r.toObject()) : added[0].toObject());
            }

            case 'PUT': {
                const { id, type, payload } = req.body;
                const sheet = type === 'inbound' ? inboundSheet : outboundSheet;
                const rows = await sheet.getRows();
                const row = rows.find(r => r.get('id') === id);
                if (!row) return res.status(404).json({ error: 'Not found' });
                const updated = { ...payload, updated_at: formatLocalDate(new Date()) };
                if (type === 'outbound' && payload.group_name) updated.receiver_group = payload.group_name;
                Object.keys(updated).forEach(k => { if (updated[k] !== undefined) row.set(k, updated[k]); });
                await row.save();
                return res.status(200).json(row.toObject());
            }

            case 'DELETE': {
                const { id, ids, type } = req.body;
                const sheet = type === 'inbound' ? inboundSheet : outboundSheet;
                const rows = await sheet.getRows();
                const targetIds = Array.isArray(ids) ? ids : [id];
                let count = 0;
                for (let i = rows.length - 1; i >= 0; i--) {
                    if (targetIds.includes(rows[i].get('id'))) {
                        await rows[i].delete();
                        count++;
                    }
                }
                return res.status(200).json({ message: `Deleted ${count} items`, count });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
