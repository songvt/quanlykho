import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet } from './_utils/googleSheets.js';
import { fetchAll, supabase } from './_utils/supabase.js';

type LayoutConfig = { assignments?: Record<string, string>; serialAssignments?: Record<string, string> };
const trackedWarehouses = new Set(['KHO_DV_Q12', 'KHO_DV_HMN']);

const rowValue = (row: any, names: string[]) => {
    for (const name of names) {
        const candidate = row.get(name);
        if (candidate !== undefined && candidate !== null && String(candidate).trim()) return String(candidate).trim();
    }
    return '';
};

/** Writes only MA_KE cells; stock rows and all other columns remain untouched. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
    let config = req.body?.config as LayoutConfig | undefined;

    try {
        // The button sends current screen state. Direct calls safely use the
        // already-persisted warehouse-map configuration instead.
        if (!config) {
            const { data, error } = await supabase.from('district_storekeepers')
                .select('storekeeper_name').eq('district', 'WAREHOUSE_LAYOUT_CONFIG').maybeSingle();
            if (error) throw error;
            if (!data?.storekeeper_name) return res.status(422).json({ error: 'Chưa có cấu hình sơ đồ kho để đồng bộ.' });
            try { config = JSON.parse(data.storekeeper_name) as LayoutConfig; }
            catch { return res.status(422).json({ error: 'Cấu hình sơ đồ kho trên Cloud không hợp lệ.' }); }
        }

        const assignments = config.assignments || {};
        const serialAssignments = config.serialAssignments || {};
        const [doc, products] = await Promise.all([getGoogleSheet(), fetchAll('products', 'id,item_code')]);
        const stockSheet = doc.sheetsByTitle['in_stock'];
        if (!stockSheet) return res.status(404).json({ error: 'Sheet in_stock not found' });

        const rows = await stockSheet.getRows();
        const shelfColumn = stockSheet.headerValues.find(header => ['MA_KE', 'MÃ_KỆ'].includes(String(header).trim().toUpperCase()));
        if (!shelfColumn) return res.status(422).json({ error: 'Chưa có cột MA_KE trong in_stock.' });

        const productIds = new Map<string, string>();
        products.forEach((product: any) => {
            if (product.id) productIds.set(String(product.id).trim(), product.id);
            if (product.item_code) productIds.set(String(product.item_code).trim(), product.id);
        });

        const shelfColumnIndex = stockSheet.headerValues.indexOf(shelfColumn);
        const changes: Array<{ rowNumber: number; shelf: string }> = [];
        let matchedRows = 0;
        let serialMatches = 0;

        for (const row of rows) {
            const sourceCode = rowValue(row, ['product_id', 'MA_HANG', 'Ma_Hang', 'MA_VT']);
            const warehouse = rowValue(row, ['loai_kho', 'warehouse_type', 'district', 'District']).toUpperCase();
            if (!sourceCode || !trackedWarehouses.has(warehouse)) continue;
            const productId = productIds.get(sourceCode) || sourceCode;
            const serial = rowValue(row, ['serial_code', 'SERIAL', 'Serial']).toUpperCase();
            const serialShelf = serial ? serialAssignments[`${productId}|${warehouse}|${serial}`] : '';
            const shelf = serialShelf || assignments[`${productId}|${warehouse}`] || '';
            if (shelf) {
                matchedRows++;
                if (serialShelf) serialMatches++;
            }
            // A removed assignment must clear its former MA_KE value; otherwise a
            // later sync would leave a stale shelf location on the stock row.
            if (String(row.get(shelfColumn) || '').trim() !== shelf) changes.push({ rowNumber: row.rowNumber, shelf });
        }

        // saveUpdatedCells emits updateCells requests for just MA_KE. It never
        // writes whole rows, so source values/formulas cannot be overwritten.
        if (changes.length) {
            const firstRow = Math.min(...changes.map(change => change.rowNumber));
            const lastRow = Math.max(...changes.map(change => change.rowNumber));
            await stockSheet.loadCells({ startRowIndex: firstRow - 1, endRowIndex: lastRow, startColumnIndex: shelfColumnIndex, endColumnIndex: shelfColumnIndex + 1 });
            changes.forEach(change => { stockSheet.getCell(change.rowNumber - 1, shelfColumnIndex).value = change.shelf; });
            await stockSheet.saveUpdatedCells();
        }

        return res.status(200).json({ message: `Đã gán mã kệ cho ${changes.length} dòng in_stock (${serialMatches} dòng theo gán serial riêng).`, updated: changes.length, matchedRows, serialMatches, column: shelfColumn });
    } catch (error: any) {
        console.error('Lỗi đồng bộ mã kệ vào in_stock:', error);
        return res.status(500).json({ error: 'Không thể đồng bộ mã kệ vào in_stock.', details: error?.message });
    }
}
