import { checkIsSameMonth } from './dateUtils';

export type SettlementReportMode = 'supply' | 'goods';

export interface SettlementMovementTotals {
    item_code: string;
    item_name: string;
    unit: string;
    unit_price: number;
    inbound_qty: number;
    inbound_amount: number;
    outbound_qty: number;
    outbound_amount: number;
    return_qty: number;
    return_amount: number;
    sap_item_code?: string;
    finance_item_name?: string;
}

/** Chuẩn hóa tháng về YYYY-MM */
export const normalizeSettlementMonth = (month: string): string => {
    const s = String(month || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
    return s;
};

export const parseSettlementNumber = (val: unknown): number => {
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    if (val === null || val === undefined || val === '') return 0;
    let str = String(val).trim();
    if (str.includes('.') && !str.includes(',')) {
        const parts = str.split('.');
        if (parts.length > 1 && parts[parts.length - 1].length === 3) {
            str = str.replace(/\./g, '');
        }
    }
    if (str.startsWith('(') && str.endsWith(')')) {
        str = '-' + str.substring(1, str.length - 1);
    }
    str = str.replace(/,/g, '');
    return Number(str) || 0;
};

const normalizeKeyName = (name: string) =>
    (name || '').trim().replace(/\s+/g, ' ');

/** Khóa gộp ổn định: ưu tiên mã hàng, không phụ thuộc danh mục SP đang tải */
export const getStableItemKey = (itemCode: string, itemName: string): string => {
    const code = (itemCode || '').trim();
    const name = normalizeKeyName(itemName);
    return code || name;
};

export const historyRecordsToMap = (records: any[]): Record<string, any> => {
    const map: Record<string, any> = {};
    for (const h of records || []) {
        if (h.item_name) map[h.item_name] = h;
        if (h.item_code) map[h.item_code] = h;
    }
    return map;
};

const isGoodsCategory = (excelCat: string) =>
    excelCat.includes('hàng hóa') || excelCat.includes('hang hoa');

const isSupplyInventoryRow = (item: any, selectedMonth: string) => {
    const date = item.actual_date || item.voucher_date;
    if (date && !checkIsSameMonth(date, selectedMonth)) return false;
    const excelCat = String(item.note || '').toLowerCase();
    return !isGoodsCategory(excelCat);
};

const classifyOutboundQty = (item: any) => {
    const qWithin = parseSettlementNumber(item.qty_within_limit);
    const qOver = parseSettlementNumber(item.qty_over_limit);
    const qTotal = parseSettlementNumber(item.qty_total);
    const qty = qTotal || qWithin + qOver;
    const amount = parseSettlementNumber(item.total_amount);
    const type = String(item.transaction_type || '').toLowerCase();
    const isReturn =
        type.includes('trả') ||
        type.includes('thu hồi') ||
        type.includes('thu hoi') ||
        type.includes('điều chuyển') ||
        type.includes('dieu chuyen') ||
        type.includes('chuyển kho') ||
        qty < 0;
    return { qty: Math.abs(qty), amount: Math.abs(amount), isReturn };
};

/** Tổng hợp xuất/nhập/trả từ chi tiết — logic cố định, không dùng allProducts */
export function aggregateSettlementMovements(
    inventoryData: any[],
    outboundData: any[],
    selectedMonth: string,
    mode: SettlementReportMode,
    options?: {
        standardGoodsNames?: string[];
        findStandardKey?: (name: string, code?: string) => string | null;
    }
): Map<string, SettlementMovementTotals> {
    const month = normalizeSettlementMonth(selectedMonth);
    const map = new Map<string, SettlementMovementTotals>();

    const ensure = (key: string, itemCode: string, itemName: string, unit = 'Cái', unitPrice = 0) => {
        if (!key) return null;
        if (!map.has(key)) {
            map.set(key, {
                item_code: itemCode,
                item_name: itemName,
                unit,
                unit_price: unitPrice,
                inbound_qty: 0,
                inbound_amount: 0,
                outbound_qty: 0,
                outbound_amount: 0,
                return_qty: 0,
                return_amount: 0,
            });
        }
        return map.get(key)!;
    };

    if (mode === 'supply') {
        const sortedInv = [...inventoryData].filter((i) => isSupplyInventoryRow(i, month));
        sortedInv.sort((a, b) =>
            getStableItemKey(a.item_code || '', a.bccs_item || '').localeCompare(
                getStableItemKey(b.item_code || '', b.bccs_item || '')
            )
        );

        for (const item of sortedInv) {
            const itemName = normalizeKeyName(item.bccs_item || item.item_name || '');
            const itemCode = (item.item_code || '').trim();
            if (!itemName && !itemCode) continue;
            const key = getStableItemKey(itemCode, itemName);
            const row = ensure(key, itemCode, itemName, item.unit, parseSettlementNumber(item.unit_price));
            if (!row) continue;

            const qty = parseSettlementNumber(item.quantity);
            const amt = parseSettlementNumber(item.total_amount);
            const type = String(item.transaction_type || '').toLowerCase();
            if (type.includes('nhập')) {
                row.inbound_qty += qty;
                row.inbound_amount += amt;
            } else if (type.includes('xuất')) {
                row.return_qty += qty;
                row.return_amount += amt;
            }
            if (item.finance_item) row.finance_item_name = String(item.finance_item);
        }

        const sortedOut = [...outboundData].filter((item) => {
            const stockDate = item.stock_out_date;
            const inMonth =
                !stockDate || stockDate === 'null' || stockDate === 'undefined'
                    ? true
                    : checkIsSameMonth(stockDate, month);
            if (!inMonth) return false;
            const excelCat = String(item.item_type || '').toLowerCase();
            if (excelCat && isGoodsCategory(excelCat)) return false;
            return true;
        });

        let lastItemName = '';
        let lastItemCode = '';
        let lastDate: string | null = null;

        for (const item of sortedOut) {
            let itemName = normalizeKeyName(item.item_name || '');
            let itemCode = (item.item_code || '').trim();
            let stockDate = item.stock_out_date;

            if (!itemName && !itemCode) {
                itemName = lastItemName;
                itemCode = lastItemCode;
            }
            if (!stockDate) stockDate = lastDate;
            if (itemName) lastItemName = itemName;
            if (itemCode) lastItemCode = itemCode;
            if (stockDate) lastDate = stockDate;
            if (!itemName && !itemCode) continue;
            if (stockDate && !checkIsSameMonth(stockDate, month)) continue;

            const key = getStableItemKey(itemCode, itemName);
            const row = ensure(
                key,
                itemCode,
                itemName,
                item.unit,
                parseSettlementNumber(item.cost_price)
            );
            if (!row) continue;

            const { qty, amount, isReturn } = classifyOutboundQty(item);
            if (isReturn) {
                row.return_qty += qty;
                row.return_amount += amount;
            } else {
                row.outbound_qty += qty;
                row.outbound_amount += amount;
            }
            if (item.finance_item) row.finance_item_name = String(item.finance_item);
            if (item.sap_item_code) row.sap_item_code = String(item.sap_item_code);
        }
    } else {
        const findStandardKey = options?.findStandardKey;
        const sortedInv = [...inventoryData].filter((item) => {
            const date = item.actual_date || item.voucher_date;
            return date ? checkIsSameMonth(date, month) : true;
        });

        for (const item of sortedInv) {
            const rawName = normalizeKeyName(item.bccs_item || item.item_name || '');
            const rawCode = (item.item_code || '').trim();
            if (!rawName && !rawCode) continue;
            const key = findStandardKey?.(rawName, rawCode);
            if (!key) continue;

            const row = ensure(key, rawCode, key, item.unit, parseSettlementNumber(item.unit_price));
            if (!row) continue;
            const qty = parseSettlementNumber(item.quantity);
            const amt = parseSettlementNumber(item.total_amount);
            const type = String(item.transaction_type || '').toLowerCase();
            if (type.includes('nhập')) {
                row.inbound_qty += qty;
                row.inbound_amount += amt;
            } else if (type.includes('xuất')) {
                row.return_qty += qty;
                row.return_amount += amt;
            }
        }

        let lastItemName = '';
        let lastItemCode = '';
        let lastDate: string | null = null;

        for (const item of outboundData) {
            let itemName = normalizeKeyName(item.item_name || '');
            let itemCode = (item.item_code || '').trim();
            let stockDate = item.stock_out_date;

            if (!itemName && !itemCode) {
                itemName = lastItemName;
                itemCode = lastItemCode;
            }
            if (!stockDate) stockDate = lastDate;
            if (itemName) lastItemName = itemName;
            if (itemCode) lastItemCode = itemCode;
            if (stockDate) lastDate = stockDate;
            if (!itemName && !itemCode) continue;

            const inMonth =
                !stockDate || stockDate === 'null' || stockDate === 'undefined'
                    ? true
                    : checkIsSameMonth(stockDate, month);
            if (!inMonth) continue;

            let key = findStandardKey?.(itemName, itemCode);
            if (!key) {
                const excelCat = String(item.item_type || '').toLowerCase();
                if (isGoodsCategory(excelCat)) key = itemName;
            }
            if (!key) continue;

            const row = ensure(key, itemCode, key, item.unit, parseSettlementNumber(item.cost_price));
            if (!row) continue;
            const { qty, amount, isReturn } = classifyOutboundQty(item);
            if (isReturn) {
                row.return_qty += qty;
                row.return_amount += amount;
            } else {
                row.outbound_qty += qty;
                row.outbound_amount += amount;
            }
            if (item.sap_item_code) row.sap_item_code = String(item.sap_item_code);
        }
    }

    return map;
}

/** Gộp tổng hợp vào payload settlement_history (giữ tồn đầu kỳ đã lưu) */
export function buildSettlementHistoryPayload(
    month: string,
    aggregates: Map<string, SettlementMovementTotals>,
    existingHistory: Record<string, any> = {}
): any[] {
    const normalizedMonth = normalizeSettlementMonth(month);
    const payload: any[] = [];

    aggregates.forEach((agg) => {
        const hist =
            existingHistory[agg.item_name] ||
            existingHistory[agg.item_code] ||
            {};
        const opening_qty = Number(hist.opening_qty) || 0;
        const opening_amount = Number(hist.opening_amount) || 0;
        const usage_qty = Number(hist.usage_qty) || 0;
        const usage_amount = Number(hist.usage_amount) || 0;

        const closing_qty =
            opening_qty + agg.inbound_qty - agg.outbound_qty - usage_qty - agg.return_qty;
        const closing_amount =
            opening_amount + agg.inbound_amount - agg.outbound_amount - usage_amount - agg.return_amount;

        payload.push({
            month: normalizedMonth,
            item_code: agg.item_code || hist.item_code || '',
            item_name: agg.item_name,
            unit: agg.unit || hist.unit || 'Cái',
            unit_price: Number(hist.unit_price) || agg.unit_price || 0,
            opening_qty,
            opening_amount,
            inbound_qty: agg.inbound_qty,
            inbound_amount: agg.inbound_amount,
            outbound_qty: agg.outbound_qty,
            outbound_amount: agg.outbound_amount,
            usage_qty,
            usage_amount,
            return_qty: agg.return_qty,
            return_amount: agg.return_amount,
            closing_qty,
            closing_amount,
            sap_item_code: agg.sap_item_code || hist.sap_item_code || '',
            finance_item_name: agg.finance_item_name || hist.finance_item_name || '',
            updated_at: new Date().toISOString(),
        });
    });

    return payload;
}

const frozenStorageKey = (month: string, mode: SettlementReportMode) =>
    `settlement_frozen_${normalizeSettlementMonth(month)}_${mode}`;

export const markMovementsFrozen = (month: string, mode: SettlementReportMode) => {
    localStorage.setItem(frozenStorageKey(month, mode), '1');
};

export const clearMovementsFrozen = (month: string, mode: SettlementReportMode) => {
    localStorage.removeItem(frozenStorageKey(month, mode));
};

export const isMovementsFrozen = (month: string, mode: SettlementReportMode): boolean =>
    localStorage.getItem(frozenStorageKey(month, mode)) === '1';

/** Áp số đã chốt từ history lên dòng báo cáo (không tính lại từ chi tiết) */
export function applyFrozenMovementsFromHistory<T extends {
    item_code: string;
    item_name: string;
    inbound_qty: number;
    inbound_amount: number;
    outbound_qty: number;
    outbound_amount: number;
    return_qty: number;
    return_amount: number;
    initial_qty: number;
    initial_amount: number;
    final_qty: number;
    final_amount: number;
    usage_qty?: number;
    usage_amount?: number;
}>(row: T, historicalData: Record<string, any>, frozen: boolean): T {
    if (!frozen) return row;
    const hist = historicalData[row.item_name] || historicalData[row.item_code];
    if (!hist) return row;

    row.inbound_qty = Number(hist.inbound_qty) || 0;
    row.inbound_amount = Number(hist.inbound_amount) || 0;
    row.outbound_qty = Number(hist.outbound_qty) || 0;
    row.outbound_amount = Number(hist.outbound_amount) || 0;
    row.return_qty = Number(hist.return_qty) || 0;
    row.return_amount = Number(hist.return_amount) || 0;
    if (row.usage_qty !== undefined) row.usage_qty = Number(hist.usage_qty) || 0;
    if (row.usage_amount !== undefined) row.usage_amount = Number(hist.usage_amount) || 0;

    const usageQty = Number(hist.usage_qty) || 0;
    const usageAmt = Number(hist.usage_amount) || 0;
    row.final_qty = row.initial_qty + row.inbound_qty - row.outbound_qty - usageQty - row.return_qty;
    row.final_amount = row.initial_amount + row.inbound_amount - row.outbound_amount - usageAmt - row.return_amount;
    return row;
}

/** @deprecated use isMovementsFrozen */
export const hasSyncedMovements = (_historicalData: Record<string, any>, month: string, mode: SettlementReportMode): boolean =>
    isMovementsFrozen(month, mode);

/** Khớp tên/mã hàng hóa với danh mục 31 mặt hàng chuẩn */
export function createGoodsFindStandardKey(standardGoodsData: { name: string; code: string }[]) {
    const standardCodeMap = new Map<string, string>();
    standardGoodsData.forEach((item) => {
        if (item.code) standardCodeMap.set(item.code.trim().toLowerCase(), item.name);
    });

    const stripPrefixes = (name: string) => {
        let n = name.trim();
        const prefixes = [
            /^tm_/i, /^kd_/i, /^fullbox kd_/i, /^fullbox /i,
            /^bh_/i, /^uc\d_/i, /^th\d_/i, /^thiết bị /i, /^thân /i,
        ];
        let changed = true;
        while (changed) {
            changed = false;
            for (const p of prefixes) {
                if (p.test(n)) {
                    n = n.replace(p, '').trim();
                    changed = true;
                }
            }
        }
        return n;
    };

    const ultraNormalize = (str: string) =>
        (str || '').normalize('NFC').toLowerCase()
            .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, '')
            .trim();

    return (name: string, code?: string): string | null => {
        if (code) {
            const normalizedCode = code.trim().toLowerCase();
            if (standardCodeMap.has(normalizedCode)) {
                return standardCodeMap.get(normalizedCode)!;
            }
        }
        if (!name) return null;
        const normalizedName = name.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
        const strippedName = stripPrefixes(name.normalize('NFC')).toLowerCase();
        const ultraName = ultraNormalize(strippedName);

        const exactMatch = standardGoodsData.find((item) => {
            const sLow = item.name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
            const sStripped = stripPrefixes(item.name.normalize('NFC')).toLowerCase();
            return (
                sLow === normalizedName ||
                sStripped === strippedName ||
                ultraNormalize(sStripped) === ultraName
            );
        });
        return exactMatch ? exactMatch.name : null;
    };
}
