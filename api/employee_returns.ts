import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase, fetchAll } from './utils/supabase.js';
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
    const allowedMethods = ['GET', 'POST', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const data = await fetchAll('employee_returns', '*, product:products(*), employee:employees(*)');
                if (data && data.length > 0) {
                    return res.status(200).json(data);
                }
            } catch (e) {
                console.warn('Supabase fetch failed, falling back to Google Sheets:', e);
            }
        }

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
                    if (rowObj.quantity !== undefined) rowObj.quantity = Number(rowObj.quantity);
                    if (rowObj.unit_price !== undefined) rowObj.unit_price = Number(rowObj.unit_price);
                    if (rowObj.total_price !== undefined) rowObj.total_price = Number(rowObj.total_price);
                    return {
                        ...rowObj,
                        product: productsMap[rowObj.product_id] || null,
                        employee: employeesMap[rowObj.employee_id] || null
                    };
                }).sort((a: any, b: any) => parseLocalDate(b.return_date).getTime() - parseLocalDate(a.return_date).getTime());

                return res.status(200).json(returns);
            }

            case 'POST': {
                // Creating an employee return also means creating an inbound transaction
                const { action, payload } = req.body;

                if (action === 'bulk_insert') {
                    if (!Array.isArray(payload)) return res.status(400).json({ error: 'Payload must be an array' });

                    const toInsertReturns = payload.map(p => ({
                        ...p,
                        id: p.id || randomUUID(),
                        return_date: formatLocalDate(p.return_date || new Date()),
                        created_at: formatLocalDate(p.created_at || new Date()),
                        updated_at: formatLocalDate(new Date())
                    }));
 
                    const toInsertInbound = payload.map(p => ({
                        id: randomUUID(),
                        type: 'inbound',
                        product_id: p.product_id,
                        quantity: p.quantity,
                        serial_code: p.serial_code,
                        unit_price: p.unit_price,
                        total_price: p.total_price || (Number(p.quantity || 0) * Number(p.unit_price || 0)),
                        district: '',
                        item_status: p.reason,
                        created_by: p.created_by,
                        inbound_date: formatLocalDate(new Date()),
                        created_at: formatLocalDate(new Date()),
                        updated_at: formatLocalDate(new Date())
                    }));

                    const { error: sbReturnError } = await supabase.from('employee_returns').insert(toInsertReturns);
                    const { error: sbInboundError } = await supabase.from('inbound_transactions').insert(toInsertInbound);
                    
                    if (sbReturnError || sbInboundError) {
                        console.error('Supabase Write Error:', sbReturnError || sbInboundError);
                        return res.status(500).json({ error: 'Supabase Write Failed', details: sbReturnError || sbInboundError });
                    }

                    try {
                        const gsWritePromise = async () => {
                            await returnsSheet.addRows(toInsertReturns);
                            await inboundSheet.addRows(toInsertInbound);
                        };
                        await Promise.race([
                            gsWritePromise(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 4500))
                        ]);
                    } catch (e: any) { 
                        console.error('GS Mirror Error:', e); 
                        await supabase.from('gs_sync_queue').insert([
                            { table_name: 'employee_returns', action: 'insert', payload: toInsertReturns, error_message: e.message },
                            { table_name: 'inbound_transactions', action: 'insert', payload: toInsertInbound, error_message: e.message }
                        ]);
                    }

                    return res.status(201).json(toInsertReturns);
                } else {
                    const toInsertReturn = {
                        ...payload,
                        id: payload.id || randomUUID(),
                        return_date: formatLocalDate(payload.return_date || new Date()),
                        created_at: formatLocalDate(payload.created_at || new Date()),
                        updated_at: formatLocalDate(new Date())
                    };
 
                    const toInsertInbound = {
                        id: randomUUID(),
                        type: 'inbound',
                        product_id: payload.product_id,
                        quantity: payload.quantity,
                        serial_code: payload.serial_code,
                        unit_price: payload.unit_price,
                        total_price: payload.total_price || (Number(payload.quantity || 0) * Number(payload.unit_price || 0)),
                        district: '',
                        item_status: payload.reason,
                        created_by: payload.created_by,
                        inbound_date: formatLocalDate(new Date()),
                        created_at: formatLocalDate(new Date()),
                        updated_at: formatLocalDate(new Date())
                    };

                    const { error: sbReturnError } = await supabase.from('employee_returns').insert([toInsertReturn]);
                    const { error: sbInboundError } = await supabase.from('inbound_transactions').insert([toInsertInbound]);
                    
                    if (sbReturnError || sbInboundError) {
                        console.error('Supabase Write Error:', sbReturnError || sbInboundError);
                        return res.status(500).json({ error: 'Supabase Write Failed', details: sbReturnError || sbInboundError });
                    }

                    try {
                        const gsWritePromise = async () => {
                            await returnsSheet.addRow(toInsertReturn);
                            await inboundSheet.addRow(toInsertInbound);
                        };
                        await Promise.race([
                            gsWritePromise(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 4500))
                        ]);
                    } catch (e: any) { 
                        console.error('GS Mirror Error:', e); 
                        await supabase.from('gs_sync_queue').insert([
                            { table_name: 'employee_returns', action: 'insert', payload: toInsertReturn, error_message: e.message },
                            { table_name: 'inbound_transactions', action: 'insert', payload: toInsertInbound, error_message: e.message }
                        ]);
                    }

                    return res.status(201).json(toInsertReturn);
                }
            }

            case 'DELETE': {
                const { ids } = req.body;
                if (!ids || !Array.isArray(ids)) {
                    return res.status(400).json({ error: 'Invalid array of IDs' });
                }

                const { error: sbError } = await supabase.from('employee_returns').delete().in('id', ids);
                if (sbError) {
                    console.error('SB Delete Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Delete Failed', details: sbError });
                }

                try {
                    const deletePromise = async () => {
                        const rows = await returnsSheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (ids.includes(rows[i].get('id'))) {
                                await rows[i].delete();
                            }
                        }
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) { 
                    console.error('GS Mirror Error:', e); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'employee_returns',
                        action: 'delete',
                        payload: { ids },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ message: 'Deleted successfully', ids: ids });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Employee Returns):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
