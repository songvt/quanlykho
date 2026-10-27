export interface AssetDetailMonthlyMovement {
    purchased: number;
    transferOut: number;
    transferIn: number;
    returnedDamaged: number;
    returnedLost: number;
    returnedUnused: number;
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

export const buildAssetDetailMonthlyMovement = (logs: AssetLogLike[]) => {
    const result: Record<string, AssetDetailMonthlyMovement> = {};

    logs.forEach((log) => {
        const code = log.asset_code?.trim();
        if (!code) return;

        const movement = result[code] || (result[code] = emptyMovement());
        const action = `${log.action || ''} ${log.details || ''}`.toLocaleLowerCase('vi-VN');

        if (/(tăng|thêm mới|tạo mới|insert|create|add)/.test(action)) movement.purchased += 1;
        else if (action.includes('điều chuyển')) {
            if (/(về kho|đến kho|nhập kho)/.test(action)) movement.transferIn += 1;
            else movement.transferOut += 1;
        }
        else if (/(thu hồi|không sử dụng)/.test(action)) movement.returnedUnused += 1;
        else if (/(hỏng|sửa chữa)/.test(action)) movement.returnedDamaged += 1;
        else if (/(giảm|xóa|delete|remove|thất thoát|mất)/.test(action)) movement.returnedLost += 1;
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
        if (!code || !date || Number.isNaN(date.getTime())) return;
        if (!latestDates[code] || date > latestDates[code]) latestDates[code] = date;
    });

    return Object.fromEntries(Object.entries(latestDates).map(([code, date]) => [
        code,
        `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`,
    ]));
};
