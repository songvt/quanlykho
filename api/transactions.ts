import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { CONFIG } from '../src/config.js';
import { randomUUID } from 'crypto';

// Helper to send webhook
const sendWebhook = async (type: 'inbound' | 'outbound', data: any) => {
    if (type === 'inbound') return;
    if (!CONFIG.N8N_WEBHOOK_URL) return;

    try {
        const payload = Array.isArray(data) ? data : [data];

        fetch(CONFIG.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({
                type,
                timestamp: new Date().toISOString(),
                data: payload
            })
        }).catch(err => console.error('[Webhook] Failed to send:', err));
    } catch (e) {
        console.error('[Webhook] Error constructing payload:', e);
    }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const inboundSheet = await getSheetByTitle(doc, 'inbound_transactions');
        const outboundSheet = await getSheetByTitle(doc, 'outbound_transactions');
        const productsSheet = await getSheetByTitle(doc, 'products');

        // Ensure headers exist
        if (inboundSheet.rowCount === 0) {
            await inboundSheet.setHeaderRow([
                'id', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'inbound_date', 'created_by', 'district', 'item_status',
                'type', 'created_at', 'updated_at', 'date'
            ]);
        }
        if (outboundSheet.rowCount === 0) {
            await outboundSheet.setHeaderRow([
                'id', 'receiver_group', 'product_id', 'serial_code', 'quantity', 'unit_price', 'total_price', 'outbound_date', 'created_by', 'district', 'item_status',
                'type', 'group_name', 'created_at', 'updated_at', 'date'
            ]);
        }

        // Helper to populate product data
        const getProductsMap = async () => {
            const rows = await productsSheet.getRows();
            const map: Record<string, any> = {};
            rows.forEach(r => map[r.get('id')] = { name: r.get('name'), item_code: r.get('item_code') });
            return map;
        };

        switch (req.method) {
            case 'GET': {
                // Fetch ALL transactions and merge them
                const type = req.query.type as string;
                const productsMap = await getProductsMap();

                let allLinks: any[] = [];

                if (!type || type === 'inbound') {
                    const iRows = await inboundSheet.getRows();
                    allLinks = [...allLinks, ...iRows.map(r => {
                        const t = r.toObject();
                        if (t.quantity !== undefined) t.quantity = Number(t.quantity);
                        if (t.unit_price !== undefined) t.unit_price = Number(t.unit_price);
                        if (t.total_price !== undefined) t.total_price = Number(t.total_price);
                        return {
                            ...t,
                            type: 'inbound',
                            group_name: 'N/A', // Unified format
                            date: t.inbound_date,
                            product: productsMap[t.product_id] || { name: 'Unknown' }
                        };
                    })];
                }

                if (!type || type === 'outbound') {
                    const oRows = await outboundSheet.getRows();
                    allLinks = [...allLinks, ...oRows.map(r => {
                        const t = r.toObject();
                        if (t.quantity !== undefined) t.quantity = Number(t.quantity);
                        if (t.unit_price !== undefined) t.unit_price = Number(t.unit_price);
                        if (t.total_price !== undefined) t.total_price = Number(t.total_price);
                        return {
                            ...t,
                            type: 'outbound',
                            group_name: t.receiver_group, // Unified format
                            date: t.outbound_date,
                            product: productsMap[t.product_id] || { name: 'Unknown' }
                        };
                    })];
                }

                // Sort by date descending
                allLinks.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                return res.status(200).json(allLinks);
            }

            case 'POST': {
                const { type, action, payload } = req.body;

                if (!['inbound', 'outbound'].includes(type)) {
                    return res.status(400).json({ error: 'Invalid transaction type' });
                }

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const dateField = type === 'inbound' ? 'inbound_date' : 'outbound_date';

                if (action === 'sync_from_in_stock') {
                    // Look for the sheet which might have trailing space
                    const inStockSheet = doc.sheetsByTitle['in_stock '] || doc.sheetsByTitle['in_stock'];
                    if (!inStockSheet) {
                        return res.status(404).json({ error: 'Sheet in_stock not found' });
                    }
                    
                    const inStockRows = await inStockSheet.getRows();
                    const inboundRows = await inboundSheet.getRows();

                    const existingSerials = new Set(inboundRows.map(r => r.get('serial_code')).filter(Boolean));
                    const toInsert = [];

                    for (const row of inStockRows) {
                        const serial = row.get('serial_code') || row.get('serial_code1');
                        if (serial && !existingSerials.has(serial)) {
                            toInsert.push({
                                id: randomUUID(),
                                product_id: row.get('product_id') || row.get('product_id1') || 'UNKNOWN',
                                serial_code: serial,
                                quantity: Number(row.get('quantity') || 1),
                                item_status: row.get('item_status') || row.get('item_status1') || 'Mới',
                                district: row.get('district') || 'Kho Tổng',
                                inbound_date: new Date().toISOString(),
                                created_by: 'system_sync',
                                type: 'inbound',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                unit_price: 0,
                                total_price: 0
                            });
                            // Add to existing to prevent duplicates within the same batch
                            existingSerials.add(serial);
                        }
                    }

                    if (toInsert.length > 0) {
                        await inboundSheet.addRows(toInsert);
                        
                        // Also notify via webhook if needed, optional
                        const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.WEBHOOK_URL;
                        if (webhookUrl) {
                            fetch(webhookUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    type: 'inbound',
                                    action: 'sync_from_in_stock',
                                    count: toInsert.length,
                                    timestamp: new Date().toISOString()
                                })
                            }).catch(e => console.error('[Webhook] Error:', e));
                        }
                    }

                    return res.status(200).json({ message: `Đã đồng bộ ${toInsert.length} mã mới`, count: toInsert.length });
                }

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload must be an array' });

                    const toInsert = payload.map(p => ({
                        ...p,
                        id: p.id || randomUUID(),
                        type: type,
                        [dateField]: p[dateField] || new Date().toISOString(),
                        created_at: p.created_at || new Date().toISOString(),
                        updated_at: p.updated_at || new Date().toISOString(),
                        total_price: p.total_price || (Number(p.quantity || 0) * Number(p.unit_price || 0)),
                        created_by: p.created_by || p.user_id || undefined,
                        receiver_group: type === 'outbound' ? (p.receiver_group || p.group_name || undefined) : undefined,
                    }));

                    const rowsAdded = await sheetToUse.addRows(toInsert);

                    if (type === 'outbound') sendWebhook(type, toInsert);
                    return res.status(201).json(rowsAdded.map(r => r.toObject()));
                } else {
                    const toInsert = {
                        ...payload,
                        id: payload.id || randomUUID(),
                        type: type,
                        [dateField]: payload[dateField] || new Date().toISOString(),
                        created_at: payload.created_at || new Date().toISOString(),
                        updated_at: payload.updated_at || new Date().toISOString(),
                        total_price: payload.total_price || (Number(payload.quantity || 0) * Number(payload.unit_price || 0)),
                        created_by: payload.created_by || payload.user_id || undefined,
                        receiver_group: type === 'outbound' ? (payload.receiver_group || payload.group_name || undefined) : undefined,
                    };

                    const newRow = await sheetToUse.addRow(toInsert);

                    if (type === 'outbound') sendWebhook(type, toInsert);
                    return res.status(201).json(newRow.toObject());
                }
            }

            case 'PUT': {
                const { id, type, payload } = req.body;
                if (!id || !['inbound', 'outbound'].includes(type)) {
                    return res.status(400).json({ error: 'Invalid ID or transaction type' });
                }

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const rows = await sheetToUse.getRows();
                const rowToUpdate = rows.find(row => row.get('id') === id);

                if (rowToUpdate) {
                    const updatedData = {
                        ...payload,
                        updated_at: new Date().toISOString(),
                        total_price: payload.total_price || (Number(payload.quantity || 0) * Number(payload.unit_price || 0)),
                    };
                    
                    if (type === 'outbound' && payload.group_name) {
                         updatedData.receiver_group = payload.group_name;
                    }

                    Object.keys(updatedData).forEach(key => {
                        if (updatedData[key] !== undefined) {
                            rowToUpdate.set(key, updatedData[key]);
                        }
                    });

                    await rowToUpdate.save();
                    return res.status(200).json(rowToUpdate.toObject());
                } else {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
            }

            case 'DELETE': {
                const { id, ids, type } = req.body;
                if (!['inbound', 'outbound'].includes(type)) {
                    return res.status(400).json({ error: 'Invalid transaction type' });
                }

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const rows = await sheetToUse.getRows();

                // Bulk delete
                if (Array.isArray(ids) && ids.length > 0) {
                    const rowsToDelete = rows.filter(row => ids.includes(row.get('id')));
                    if (rowsToDelete.length === 0) {
                        return res.status(404).json({ error: 'No transactions found' });
                    }
                    
                    // Xóa từ dưới lên trên (bottom to top) để tránh lỗi lệch index trong Google Sheets
                    let deletedCount = 0;
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (ids.includes(rows[i].get('id'))) {
                            await rows[i].delete();
                            deletedCount++;
                        }
                    }
                    
                    return res.status(200).json({ message: `Deleted ${deletedCount} transactions`, ids });
                }

                // Single delete
                if (!id) {
                    return res.status(400).json({ error: 'Missing id or ids' });
                }
                const rowToDelete = rows.find(row => row.get('id') === id);
                if (rowToDelete) {
                    await rowToDelete.delete();
                    return res.status(200).json({ message: 'Deleted successfully', id });
                } else {
                    return res.status(404).json({ error: 'Transaction not found' });
                }
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Transactions):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
