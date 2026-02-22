import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'district_storekeepers');

        if (sheet.rowCount === 0) {
            await sheet.setHeaderRow(['district', 'storekeeper_name', 'created_at', 'updated_at']);
        }

        switch (req.method) {
            case 'GET': {
                const rows = await sheet.getRows();
                const items = rows.map(row => row.toObject());
                return res.status(200).json(items);
            }

            case 'POST':
            case 'PUT': {
                // Upsert logic for district storekeeper
                const { district, storekeeper_name } = req.body;

                if (!district || !storekeeper_name) {
                    return res.status(400).json({ error: 'district and storekeeper_name are required' });
                }

                const rows = await sheet.getRows();
                const existingRow = rows.find(row => row.get('district') === district);

                if (existingRow) {
                    existingRow.set('storekeeper_name', storekeeper_name);
                    await existingRow.save();
                    return res.status(200).json(existingRow.toObject());
                } else {
                    const newRow = await sheet.addRow({
                        district,
                        storekeeper_name,
                        created_at: new Date().toISOString()
                    });
                    return res.status(201).json(newRow.toObject());
                }
            }

            case 'DELETE': {
                const { district } = req.body;
                if (!district) {
                    return res.status(400).json({ error: 'Provide "district" to delete' });
                }

                const rows = await sheet.getRows();
                const rowToDelete = rows.find(row => row.get('district') === district);

                if (rowToDelete) {
                    await rowToDelete.delete();
                    return res.status(200).json({ message: 'Deleted successfully', district });
                } else {
                    return res.status(404).json({ error: 'District not found' });
                }
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (District Storekeepers):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
