export interface AssetDetailMonthlyMovement {
    purchased: number;
    transferOut: number;
    transferIn: number;
    returnedDamaged: number;
    returnedLost: number;
    returnedUnused: number;
}

export interface AssetDetailTotalValues extends AssetDetailMonthlyMovement {
    bookQuantity: number;
    checkedQuantity: number;
    good: number;
    damaged: number;
    lost: number;
    difference: number;
}

type AssetLogLike = { asset_code?: string; action?: string; details?: string; created_at?: string };

const emptyMovement = (): AssetDetailMonthlyMovement => ({
    purchased: 0,
    transferOut: 0,
    transferIn: 0,
    returnedDamaged: 0,
    returnedLost: 0,
    returnedUnused: 0,
});

const isNewAssetLog = (log: AssetLogLike) => /tăng|thêm mới|tạo mới|insert|create|add/.test(`${log.action || ''} ${log.details || ''}`.toLocaleLowerCase('vi-VN'));

export const buildAssetDetailMonthlyMovement = (logs: AssetLogLike[]) => {
    const result: Record<string, AssetDetailMonthlyMovement> = {};

    logs.forEach((log) => {
        const code = log.asset_code?.trim();
        if (!code) return;

        const movement = result[code] || (result[code] = emptyMovement());

        // The detailed TBVP form treats movement as a newly issued asset code only.
        // Changes to an existing code, including internal transfers, remain outside this block.
        if (isNewAssetLog(log)) movement.purchased += 1;
    });

    return result;
};

export const getAssetConditionQuantities = (status: string | undefined, quantity = 1) => {
    const normalized = (status || '').toLocaleLowerCase('vi-VN');
    const value = Math.max(0, Number(quantity) || 0);

    if (/(thất thoát|mất)/.test(normalized)) return { good: 0, damaged: 0, lost: value };
    if (/(hỏng|sửa chữa)/.test(normalized)) return { good: 0, damaged: value, lost: 0 };
    return { good: value, damaged: 0, lost: 0 };
};

export const buildAssetDetailMovementDates = (logs: AssetLogLike[]) => {
    const latestDates: Record<string, Date> = {};

    logs.forEach((log) => {
        const code = log.asset_code?.trim();
        const date = log.created_at ? new Date(log.created_at) : undefined;
        if (!code || !date || Number.isNaN(date.getTime()) || !isNewAssetLog(log)) return;
        if (!latestDates[code] || date > latestDates[code]) latestDates[code] = date;
    });

    return Object.fromEntries(Object.entries(latestDates).map(([code, date]) => [
        code,
        `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`,
    ]));
};

export const sumAssetDetailTotals = (rows: AssetDetailTotalValues[]) => rows.reduce<AssetDetailTotalValues>((totals, row) => ({
    bookQuantity: totals.bookQuantity + row.bookQuantity,
    purchased: totals.purchased + row.purchased,
    transferOut: totals.transferOut + row.transferOut,
    transferIn: totals.transferIn + row.transferIn,
    returnedDamaged: totals.returnedDamaged + row.returnedDamaged,
    returnedLost: totals.returnedLost + row.returnedLost,
    returnedUnused: totals.returnedUnused + row.returnedUnused,
    checkedQuantity: totals.checkedQuantity + row.checkedQuantity,
    good: totals.good + row.good,
    damaged: totals.damaged + row.damaged,
    lost: totals.lost + row.lost,
    difference: totals.difference + row.difference,
}), {
    bookQuantity: 0, purchased: 0, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0,
    checkedQuantity: 0, good: 0, damaged: 0, lost: 0, difference: 0,
});

export const getFinalSignaturePageBreakRow = (firstDataRow: number, lastDataRow: number, rowsToKeep = 5) => {
    const dataRowCount = lastDataRow - firstDataRow + 1;
    return dataRowCount > rowsToKeep ? lastDataRow - rowsToKeep : undefined;
};

export const getSerialColumnWidths = (serials: Array<string | undefined>) => {
    const longestSerialLength = Math.max(0, ...serials.map((serial) => serial?.trim().length || 0));
    const excel = Math.min(18, Math.max(14, longestSerialLength + 1));
    const printPercent = Math.min(8.5, Math.max(6.5, Math.round(longestSerialLength * 0.45 * 10) / 10));
    return { excel, printPercent, notesPercent: Math.round((11.4 - printPercent) * 10) / 10 };
};

export const getAssetDetailRowHeight = ({
    assetName = '',
    assetType = '',
    managerName = '',
    userEmployeeName = '',
    serialNumber = '',
}: {
    assetName?: string;
    assetType?: string;
    managerName?: string;
    userEmployeeName?: string;
    serialNumber?: string;
}) => Math.max(22, Math.ceil(Math.max(
    assetName.length / 28,
    assetType.length / 8,
    managerName.length / 16,
    userEmployeeName.length / 16,
    serialNumber.length / 20,
)) * 12 + 6);
