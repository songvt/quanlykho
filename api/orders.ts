import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { randomUUID } from 'crypto';


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
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'orders');

        if (sheet.rowCount === 0) {
            await sheet.setHeaderRow([
                'id', 'requester_group', 'product_id', 'quantity', 'status', 'order_date', 'created_by',
                'project_name', 'reason', 'requester_phone', 'created_at', 'updated_at', 'approved_by', 'approved_at'
            ]);
        }

        switch (req.method) {
            case 'GET': {
                const rows = await sheet.getRows();
                const orders = rows.map(row => {
                    const obj = row.toObject();
                    if (obj.quantity !== undefined) obj.quantity = Number(obj.quantity);
                    return obj;
                }).sort((a, b) => parseLocalDate(b.order_date).getTime() - parseLocalDate(a.order_date).getTime());
                return res.status(200).json(orders);
            }

            case 'POST': {
                const { action, payload } = req.body;

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) {
                        return res.status(400).json({ error: 'Payload must be an array for bulk_insert' });
                    }
                    const toInsert = payload.map(p => ({
                        ...p,
                        id: p.id || randomUUID(),
                        order_date: formatLocalDate(p.order_date || new Date()),
                        created_at: formatLocalDate(p.created_at || new Date()),
                        updated_at: formatLocalDate(new Date())
                    }));
                    const rowsAdded = await sheet.addRows(toInsert);
                    return res.status(201).json(rowsAdded.map(r => r.toObject()));
                } else {
                    const toInsert = {
                        ...payload,
                        id: payload.id || randomUUID(),
                        order_date: formatLocalDate(payload.order_date || new Date()),
                        created_at: formatLocalDate(payload.created_at || new Date()),
                        updated_at: formatLocalDate(new Date())
                    };
                    const newRow = await sheet.addRow(toInsert);
                    return res.status(201).json(newRow.toObject());
                }
            }

            case 'PUT': {
                const { id, status, approved_by } = req.body;
                if (!id) {
                    return res.status(400).json({ error: 'Order ID is required for update' });
                }

                const rows = await sheet.getRows();
                const rowToUpdate = rows.find(row => row.get('id') === id);

                if (!rowToUpdate) {
                    return res.status(404).json({ error: 'Order not found' });
                }

                if (status) {
                    rowToUpdate.set('status', status);
                    if (status === 'approved' || status === 'rejected') {
                        if (approved_by) rowToUpdate.set('approved_by', approved_by);
                        rowToUpdate.set('approved_at', formatLocalDate(new Date()));
                    }

                    // Block completion of expired approved orders
                    if (status === 'completed') {
                        const currentStatus = rowToUpdate.get('status');
                        const approvedAt = rowToUpdate.get('approved_at');
                        if (currentStatus === 'approved' && approvedAt) {
                            const approvedTime = parseLocalDate(approvedAt).getTime();
                            const elapsed = Date.now() - approvedTime;
                            if (elapsed > 24 * 60 * 60 * 1000) {
                                return res.status(403).json({
                                    error: 'ORDER_EXPIRED',
                                    message: '\u0110\u01a1n h\u00e0ng \u0111\u00e3 qu\u00e1 h\u1ea1n 24 gi\u1edd k\u1ec3 t\u1eeb khi duy\u1ec7t, kh\u00f4ng th\u1ec3 xu\u1ea5t kho!'
                                });
                            }
                        }
                    }
                }
                rowToUpdate.set('updated_at', formatLocalDate(new Date()));

                await rowToUpdate.save();
                return res.status(200).json(rowToUpdate.toObject());
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const rows = await sheet.getRows();
                const deletedIds: string[] = [];

                if (ids && Array.isArray(ids)) {
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (ids.includes(rows[i].get('id'))) {
                            await rows[i].delete();
                            deletedIds.push(rows[i].get('id'));
                        }
                    }
                } else if (id) {
                    const rowToDelete = rows.find(row => row.get('id') === id);
                    if (rowToDelete) {
                        await rowToDelete.delete();
                        deletedIds.push(id);
                    } else {
                        return res.status(404).json({ error: 'Order not found' });
                    }
                } else {
                    return res.status(400).json({ error: 'Provide "id" or "ids" array to delete' });
                }

                return res.status(200).json({ message: 'Deleted successfully', ids: deletedIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Orders):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
