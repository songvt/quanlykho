import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow specific methods
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'products');

        // Always ensure header row exists if empty
        if (sheet.rowCount === 0) {
            await sheet.setHeaderRow([
                'id', 'item_code', 'name', 'category', 'unit_price', 'unit', 'type', 'created_at', 'updated_at'
            ]);
        }

        switch (req.method) {
            case 'GET': {
                // Fetch all products
                const rows = await sheet.getRows();
                const products = rows.map(row => row.toObject());
                return res.status(200).json(products);
            }

            case 'POST': {
                // Add new product(s)
                const { action, payload } = req.body;

                if (action === 'bulk_insert') {
                    // Bulk insert array of products
                    if (!Array.isArray(payload)) {
                        return res.status(400).json({ error: 'Payload must be an array for bulk_insert' });
                    }
                    const rowsAdded = await sheet.addRows(payload);
                    return res.status(201).json(rowsAdded.map(r => r.toObject()));
                } else {
                    // Single insert
                    const newRow = await sheet.addRow(payload);
                    return res.status(201).json(newRow.toObject());
                }
            }

            case 'PUT': {
                // Update product (requires 'id')
                const updatedProduct = req.body;
                if (!updatedProduct.id) {
                    return res.status(400).json({ error: 'Product ID is required for update' });
                }

                const rows = await sheet.getRows();
                const rowToUpdate = rows.find(row => row.get('id') === updatedProduct.id);

                if (!rowToUpdate) {
                    return res.status(404).json({ error: 'Product not found' });
                }

                rowToUpdate.assign(updatedProduct);
                await rowToUpdate.save();

                return res.status(200).json(rowToUpdate.toObject());
            }

            case 'DELETE': {
                // Delete product by id or array of ids
                const { id, ids } = req.body;

                const rows = await sheet.getRows();
                let deletedIds: string[] = [];

                if (ids && Array.isArray(ids)) {
                    // Bulk delete (iterate backwards to avoid index shifting issues)
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (ids.includes(rows[i].get('id'))) {
                            await rows[i].delete();
                            deletedIds.push(rows[i].get('id'));
                        }
                    }
                } else if (id) {
                    // Single delete
                    const rowToDelete = rows.find(row => row.get('id') === id);
                    if (rowToDelete) {
                        await rowToDelete.delete();
                        deletedIds.push(id);
                    } else {
                        return res.status(404).json({ error: 'Product not found' });
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
        console.error('API Error (Products):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
