import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';

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
                });
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
                        id: p.id || crypto.randomUUID(),
                        order_date: p.order_date || new Date().toISOString(),
                        created_at: p.created_at || new Date().toISOString(),
                        updated_at: p.updated_at || new Date().toISOString()
                    }));
                    const rowsAdded = await sheet.addRows(toInsert);
                    return res.status(201).json(rowsAdded.map(r => r.toObject()));
                } else {
                    const toInsert = {
                        ...payload,
                        id: payload.id || crypto.randomUUID(),
                        order_date: payload.order_date || new Date().toISOString(),
                        created_at: payload.created_at || new Date().toISOString(),
                        updated_at: payload.updated_at || new Date().toISOString()
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
                        rowToUpdate.set('approved_at', new Date().toISOString());
                    }
                }
                rowToUpdate.set('updated_at', new Date().toISOString());

                await rowToUpdate.save();
                return res.status(200).json(rowToUpdate.toObject());
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const rows = await sheet.getRows();
                let deletedIds: string[] = [];

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
