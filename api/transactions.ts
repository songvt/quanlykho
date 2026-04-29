import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';
import { randomUUID } from 'crypto';

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
    const N8N_WEBHOOK_URL = "https://n8n.songvietvn.com/webhook/c3e9894e-2895-4673-9a3d-3652d3a39e3b";
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
                const type = req.query.type as string; // 'inbound' | 'outbound' | undefined
                
                // 1. Try Supabase first (Fast)
                try {
                    const { fetchAll } = await import('./utils/supabase.js');
                    if (!type) {
                        const [inbound, outbound] = await Promise.all([
                            fetchAll('inbound_transactions', '*, product:products(*)'),
                            fetchAll('outbound_transactions', '*, product:products(*)')
                        ]);
                        const merged = [
                            ...inbound.map(t => ({ ...t, type: 'inbound', date: t.inbound_date })),
                            ...outbound.map(t => ({ ...t, type: 'outbound', date: t.outbound_date }))
                        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        if (merged.length > 0) return res.status(200).json(merged);
                    } else {
                        const table = type === 'outbound' ? 'outbound_transactions' : 'inbound_transactions';
                        const data = await fetchAll(table, '*, product:products(*)', (q) => q.order(type === 'inbound' ? 'inbound_date' : 'outbound_date', { ascending: false }));
                        if (data) return res.status(200).json(data.map(t => ({ ...t, type: type, date: type === 'inbound' ? t.inbound_date : t.outbound_date })));
                    }
                } catch (e) { console.error('Supabase Error:', e); }

                // 2. Fallback to Google Sheets (Reliable but Slow)
                const doc = await getGoogleSheet();
                const inboundSheet = (doc.sheetsByTitle['inbound_transactions']);
                const outboundSheet = (doc.sheetsByTitle['outbound_transactions']);
                const productsSheet = (doc.sheetsByTitle['products']);

                const [iRows, oRows, pRows] = await Promise.all([
                    (!type || type === 'inbound') ? inboundSheet.getRows() : Promise.resolve([]),
                    (!type || type === 'outbound') ? outboundSheet.getRows() : Promise.resolve([]),
                    productsSheet.getRows()
                ]);

                const productsMap: Record<string, any> = {};
                pRows.forEach(r => { productsMap[r.get('id')] = r.toObject(); });

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
                const { type, action, payload, created_by, product_id } = req.body;
                const creator = created_by || 'system';

                // --- Best-Effort Dual-Write Logic ---
                const performWrite = async (table: string, items: any[]) => {
                    let lastError = null;
                    let sbSuccess = false;
                    let gsSuccess = false;

                    // 1. Supabase (Chunked)
                    try {
                        const chunkSize = 1000;
                        for (let i = 0; i < items.length; i += chunkSize) {
                            const chunk = items.slice(i, i + chunkSize);
                            const { error: sbError } = await supabase.from(table).insert(chunk);
                            if (sbError) throw sbError;
                        }
                        sbSuccess = true;
                    } catch (e: any) {
                        lastError = e;
                        console.error('SB Write Error:', e);
                    }

                    // 2. Google Sheets (Chunked - VERY SLOW, be careful with timeouts)
                    try {
                        const doc = await getGoogleSheet();
                        const sheet = doc.sheetsByTitle[table];
                        const dateField = table === 'inbound_transactions' ? 'inbound_date' : 'outbound_date';
                        const nowLocal = formatLocalDate(new Date());
                        const gsItems = items.map(p => ({
                            ...p,
                            [dateField]: p[dateField] ? (p[dateField].includes('/') ? p[dateField] : formatLocalDate(p[dateField])) : nowLocal,
                            created_at: nowLocal,
                            updated_at: nowLocal
                        }));
                        
                        const gsChunkSize = 500;
                        for (let i = 0; i < gsItems.length; i += gsChunkSize) {
                            const chunk = gsItems.slice(i, i + gsChunkSize);
                            await sheet.addRows(chunk);
                        }
                        gsSuccess = true;
                    } catch (e: any) {
                        lastError = e;
                        console.error('GS Write Error:', e);
                    }

                    if (!sbSuccess && !gsSuccess) throw lastError || new Error('All writes failed');
                    return true;
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
                            created_by: creator, unit_price: product?.unit_price || 0, total_price: product?.unit_price || 0
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
                    
                    const { fetchAll } = await import('./utils/supabase.js');
                    const [sRows, existingRows, products] = await Promise.all([
                        stockSheet.getRows(),
                        fetchAll('inbound_transactions', 'serial_code'),
                        fetchAll('products', '*')
                    ]);

                    const productsMap: Record<string, any> = {};
                    products.forEach(p => { 
                        productsMap[p.id] = p; 
                        productsMap[p.item_code] = p;
                    });

                    const existingSerials = new Set(existingRows.map(r => String(r.serial_code || '').trim()).filter(Boolean));
                    const toInsert: any[] = [];

                    for (const row of sRows) {
                        const pIdRaw = row.get('product_id') || row.get('MA_HANG') || row.get('Ma_Hang') || row.get('MA_VT');
                        if (!pIdRaw) continue;
                        const product = productsMap[String(pIdRaw).trim()];
                        if (!product) continue;

                        const serialRaw = String(row.get('serial_code') || row.get('SERIAL') || row.get('Serial') || '').trim();
                        const isVT = String(row.get('check_loại_hang')).trim() === 'VT-TKM';
                        
                        // ONLY VT-TKM can have empty serial (using row ID as fallback)
                        const serial = serialRaw || (isVT ? `VT-${row.get('ID')}` : '');

                        if (serial && !existingSerials.has(serial)) {
                            existingSerials.add(serial);
                            // Parse quantity: remove dots (thousands separator) and commas
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
                    }

                    if (toInsert.length > 0) await performWrite('inbound_transactions', toInsert);
                    return res.status(200).json({ message: `Synced ${toInsert.length} items`, count: toInsert.length });
                }

                if (!['inbound', 'outbound'].includes(type)) return res.status(400).json({ error: 'Invalid type' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
                const transactions = Array.isArray(payload) ? payload : [payload];
                const now = new Date().toISOString();

                const processed = transactions.map(p => ({
                    ...p,
                    id: p.id || randomUUID(),
                    created_at: p.created_at || now,
                    updated_at: now,
                    created_by: p.created_by || creator
                }));

                await performWrite(table, processed);
                if (type === 'outbound') sendWebhook(type, processed);
                return res.status(201).json(Array.isArray(payload) ? processed : processed[0]);
            }

            case 'PUT': {
                const { id, type, payload } = req.body;
                if (!id || !type) return res.status(400).json({ error: 'ID and type required' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
                let successCount = 0;

                // 1. Supabase
                const { error: sbError } = await supabase.from(table).update({ ...payload, updated_at: new Date().toISOString() }).eq('id', id);
                if (!sbError) successCount++;

                // 2. Sheets
                try {
                    const doc = await getGoogleSheet();
                    const sheet = doc.sheetsByTitle[table];
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.get('id') === id);
                    if (row) {
                        Object.keys(payload).forEach(k => { if (payload[k] !== undefined) row.set(k, payload[k]); });
                        row.set('updated_at', formatLocalDate(new Date()));
                        await row.save();
                        successCount++;
                    }
                } catch (e) { console.error('GS Update Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'Update failed on both databases' });
                return res.status(200).json({ message: 'Updated successfully' });
            }

            case 'DELETE': {
                const { id, ids, type } = req.body;
                if (!type) return res.status(400).json({ error: 'Type required' });
                const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
                const targetIds = Array.isArray(ids) ? ids : [id];
                let successCount = 0;

                // 1. Supabase
                const { error: sbError } = await supabase.from(table).delete().in('id', targetIds);
                if (!sbError) successCount++;

                // 2. Sheets
                try {
                    const doc = await getGoogleSheet();
                    const sheet = doc.sheetsByTitle[table];
                    const rows = await sheet.getRows();
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                    }
                    successCount++;
                } catch (e) { console.error('GS Delete Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'Delete failed on both databases' });
                return res.status(200).json({ message: `Deleted ${targetIds.length} items`, ids: targetIds });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Transactions):', error);
        return res.status(500).json({ error: error.message });
    }
}
