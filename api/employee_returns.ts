import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const doc = await getGoogleSheet();
        const returnsSheet = await getSheetByTitle(doc, 'employee_returns');
        const inboundSheet = await getSheetByTitle(doc, 'inbound_transactions');
        const productsSheet = await getSheetByTitle(doc, 'products');

        if (returnsSheet.rowCount === 0) {
            await returnsSheet.setHeaderRow([
                'id', 'product_id', 'serial_code', 'quantity', 'reason', 'unit_price', 'total_price', 'return_date', 'employee_id', 'created_by', 'created_at',
                'group_name', 'returner_name', 'status', 'description', 'district', 'item_status', 'type', 'updated_at', 'date'
            ]);
        }

        const getProductsMap = async () => {
            const rows = await productsSheet.getRows();
            const map: Record<string, any> = {};
            rows.forEach(r => map[r.get('id')] = { name: r.get('name'), item_code: r.get('item_code'), unit: r.get('unit') });
            return map;
        };

        const getEmployeesMap = async () => {
            const empSheet = await getSheetByTitle(doc, 'employees');
            const rows = await empSheet.getRows();
            const map: Record<string, any> = {};
            rows.forEach(r => map[r.get('id')] = { full_name: r.get('full_name') });
            return map;
        }

        switch (req.method) {
            case 'GET': {
                const rows = await returnsSheet.getRows();
                const productsMap = await getProductsMap();
                const employeesMap = await getEmployeesMap();

                const returns = rows.map(r => {
                    const rowObj = r.toObject();
                    return {
                        ...rowObj,
                        product: productsMap[rowObj.product_id] || null,
                        employee: employeesMap[rowObj.employee_id] || null
                    };
                }).sort((a: any, b: any) => new Date(b.return_date).getTime() - new Date(a.return_date).getTime());

                return res.status(200).json(returns);
            }

            case 'POST': {
                // Creating an employee return also means creating an inbound transaction
                const { action, payload } = req.body;

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload must be an array' });

                    const toInsertReturns = payload.map(p => ({
                        ...p,
                        id: p.id || crypto.randomUUID(),
                        return_date: p.return_date || new Date().toISOString(),
                        created_at: p.created_at || new Date().toISOString(),
                        updated_at: p.updated_at || new Date().toISOString()
                    }));

                    const toInsertInbound = payload.map(p => ({
                        id: crypto.randomUUID(),
                        type: 'inbound',
                        product_id: p.product_id,
                        quantity: p.quantity,
                        serial_code: p.serial_code,
                        unit_price: p.unit_price,
                        total_price: p.total_price || (Number(p.quantity || 0) * Number(p.unit_price || 0)),
                        district: '',
                        item_status: p.reason,
                        created_by: p.created_by,
                        inbound_date: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }));

                    await returnsSheet.addRows(toInsertReturns);
                    await inboundSheet.addRows(toInsertInbound);

                    return res.status(201).json(toInsertReturns);
                } else {
                    const toInsertReturn = {
                        ...payload,
                        id: payload.id || crypto.randomUUID(),
                        return_date: payload.return_date || new Date().toISOString(),
                        created_at: payload.created_at || new Date().toISOString(),
                        updated_at: payload.updated_at || new Date().toISOString()
                    };

                    const toInsertInbound = {
                        id: crypto.randomUUID(),
                        type: 'inbound',
                        product_id: payload.product_id,
                        quantity: payload.quantity,
                        serial_code: payload.serial_code,
                        unit_price: payload.unit_price,
                        total_price: payload.total_price || (Number(payload.quantity || 0) * Number(payload.unit_price || 0)),
                        district: '',
                        item_status: payload.reason,
                        created_by: payload.created_by,
                        inbound_date: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    };

                    await returnsSheet.addRow(toInsertReturn);
                    await inboundSheet.addRow(toInsertInbound);

                    return res.status(201).json(toInsertReturn);
                }
            }

            case 'DELETE': {
                const { ids } = req.body;
                if (!ids || !Array.isArray(ids)) {
                    return res.status(400).json({ error: 'Invalid array of IDs' });
                }

                const rows = await returnsSheet.getRows();
                let deletedIds: string[] = [];

                for (let i = rows.length - 1; i >= 0; i--) {
                    if (ids.includes(rows[i].get('id'))) {
                        await rows[i].delete();
                        deletedIds.push(rows[i].get('id'));
                    }
                }

                return res.status(200).json({ message: 'Deleted successfully', ids: deletedIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Employee Returns):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
