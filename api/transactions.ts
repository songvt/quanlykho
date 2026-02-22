import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets';
import { CONFIG } from '../src/config';

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
    const allowedMethods = ['GET', 'POST', 'DELETE'];
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

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload must be an array' });

                    const toInsert = payload.map(p => ({
                        ...p,
                        id: p.id || crypto.randomUUID(),
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
                        id: payload.id || crypto.randomUUID(),
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

            case 'DELETE': {
                const { id, type } = req.body;
                if (!id || !['inbound', 'outbound'].includes(type)) {
                    return res.status(400).json({ error: 'Invalid ID or transaction type' });
                }

                const sheetToUse = type === 'inbound' ? inboundSheet : outboundSheet;
                const rows = await sheetToUse.getRows();
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
