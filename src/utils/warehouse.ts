/** Các kho được đồng bộ từ nguồn in_stock. */
export const WAREHOUSE_TYPES = [
    'KHO_DV_Q12',
    'KHO_NV_Q12',
    'KHO_DV_HMN',
    'KHO_NV_HMN',
    'KHO_DV_CCI',
] as const;

export type WarehouseType = typeof WAREHOUSE_TYPES[number];

export const normalizeWarehouseType = (value?: string) => String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

export const isTrackedWarehouse = (value?: string): value is WarehouseType =>
    WAREHOUSE_TYPES.includes(normalizeWarehouseType(value) as WarehouseType);
