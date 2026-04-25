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
        map[r.get('id')] = {
            name: r.get('name'),
            unit_price: Number(r.get('unit_price') || 0)
        };
    });
    
    productCache = { map, timestamp: now };
    return map;
};

// --- Helper to ensure headers exist safely ---
const ensureHeaders = async (sheet: any, defaultHeaders: string[]) => {
    // Only load if not already loaded in this instance
    if (!sheet.headerValues || sheet.headerValues.length === 0) {
        try { await sheet.loadHeaderRow(); } catch (e) { /* ignore */ }
    }
    
    if (!sheet.headerValues || sheet.headerValues.length === 0) {
        if (sheet.columnCount < defaultHeaders.length) {
            await sheet.updateProperties({ gridProperties: { columnCount: defaultHeaders.length + 2 } });
        }
        await sheet.setHeaderRow(defaultHeaders);
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const doc = await getGoogleSheet();
        const [inboundSheet, outboundSheet, productsSheet] = await Promise.all([
            getSheetByTitle(doc, 'inbound_transactions'),
            getSheetByTitle(doc, 'outbound_transactions'),
            getSheetByTitle(doc, 'products')
        ]);

        // Optimized header check
        await Promise.all([
            ensureHeaders(inboundSheet, ['id', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'inbound_date', 'created_by', 'district', 'item_status', 'type', 'created_at', 'updated_at', 'date', 'source_id']),
            ensureHeaders(outboundSheet, ['id', 'receiver_group', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'outbound_date', 'created_by', 'district', 'item_status', 'type', 'group_name', 'created_at', 'updated_at', 'date'])
        ]);

        switch (req.method) {
            case 'GET': {
                const type = req.query.type as string;
                const productsMap = await getCachedProductsMap(productsSheet);

                // Fetch rows in parallel
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

                const allLinks = [
                    ...iRows.map(r => mapper(r, 'inbound')),
                    ...oRows.map(r => mapper(r, 'outbound'))
                ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                return res.status(200).json(allLinks);
            }

            case 'POST': {
                const { type, action, payload } = req.body;
                if (!['inbound', 'outbound'].includes(type)) return res.status(400).json({ error: 'Invalid type' });

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';

                if (action === 'sync_from_qr') {
                    const qrSheet = doc.sheetsByTitle['Creat_QRcode'];
                    if (!qrSheet) return res.status(404).json({ error: 'Sheet Creat_QRcode not found' });
                    
                    const { product_id } = req.body;
                    if (!product_id) return res.status(400).json({ error: 'product_id required' });

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
                        const thung = row.get('Number_Thung') || '';
                        const district = row.get('District') || 'Kho Tổng';
                        
                        return {
                            id: randomUUID(), product_id, serial_code: serial, quantity: 1, item_status: 'Mới',
                            district: thung ? `${district} - ${thung}` : district,
                            inbound_date: new Date().toISOString(), created_by: 'sync_qr', type: 'inbound',
                            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
                            unit_price: product?.unit_price || 0, total_price: product?.unit_price || 0
                        };
                    }).filter(Boolean);

                    if (toInsert.length > 0) await inboundSheet.addRows(toInsert);
                    return res.status(200).json({ message: `Synced ${toInsert.length} QR codes`, count: toInsert.length });
                }

                // Batch insert logic
                const transactions = Array.isArray(payload) ? payload : [payload];
                const now = new Date().toISOString();
                const processed = transactions.map(p => ({
                    ...p,
                    id: p.id || randomUUID(),
                    type,
                    [dateField]: p[dateField] || now,
                    created_at: p.created_at || now,
                    updated_at: now,
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

                const updated = { ...payload, updated_at: new Date().toISOString() };
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
