export interface DefaultHandoverAsset {
    id: string;
    asset_code: string;
    asset_name: string;
    quantity: number;
    asset_type: string;
    serial_number: string;
    note: string;
    is_custom?: boolean;
}

export const createCustomHandoverAsset = (params: {
    asset_code?: string;
    asset_name: string;
    quantity?: number;
    asset_type?: string;
    serial_number?: string;
    note?: string;
    is_custom?: boolean;
}): DefaultHandoverAsset => {
    return {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        asset_code: (params.asset_code || '').trim(),
        asset_name: (params.asset_name || '').trim(),
        quantity: Math.max(1, Number(params.quantity) || 1),
        asset_type: (params.asset_type || '').trim(),
        serial_number: (params.serial_number || '').trim(),
        note: (params.note || '').trim(),
        is_custom: params.is_custom !== undefined ? params.is_custom : true,
    };
};

export const restoreDefaultAssetsFromHistory = (items: any[]): DefaultHandoverAsset[] => {
    if (!Array.isArray(items)) return [];
    return items.map((item, idx) => ({
        id: item.id || `restored-${idx}-${Date.now()}`,
        asset_code: item.asset_code || item.code || '',
        asset_name: item.asset_name || item.name || '',
        quantity: Math.max(1, Number(item.quantity) || 1),
        asset_type: item.asset_type || item.type || '',
        serial_number: item.serial_number || item.serial || '',
        note: item.note || '',
        is_custom: Boolean(item.is_custom),
    }));
};

export const prepareDefaultAssetsToSave = (items: DefaultHandoverAsset[]) => {
    return items.map(item => ({
        asset_code: item.asset_code || '',
        asset_name: item.asset_name,
        name: item.asset_name,
        quantity: Math.max(1, Number(item.quantity) || 1),
        asset_type: item.asset_type || '',
        serial_number: item.serial_number || '',
        serial: item.serial_number || '',
        note: item.note || '',
        is_custom: Boolean(item.is_custom),
    }));
};
