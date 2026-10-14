import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { Transaction, Order, Employee } from '../../types';
import type { RootState } from '../index';
import { isTrackedWarehouse, normalizeWarehouseType } from '../../utils/warehouse';

interface InventoryState {
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: InventoryState = {
    status: 'succeeded',
};

// No async thunk needed, we compute dynamically, but keeping this export to not break existing component imports
export const fetchInventory = createAsyncThunk('inventory/fetchInventory', async () => {
    return null;
});

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {},
});

// Dynamic memoized selectors to instantly compute inventory without hitting the DB
const rawTransactions = (state: RootState) => state.transactions.items;
const rawOrders = (state: RootState) => state.orders.items;
const rawEmployees = (state: RootState) => state.employees.items;

export const selectDetailedStockMap = createSelector(
    [rawTransactions, rawOrders, rawEmployees],
    (transactions: Transaction[], orders: Order[], employees: Employee[]) => {
        const detailedStockMap: Record<string, number> = {};

        if (!transactions || !Array.isArray(transactions)) return detailedStockMap;

        transactions.forEach((t) => {
            // Chỉ tính tồn kho từ các kho dịch vụ và kho nhân viên
            if (t.type === 'inbound') {
                const wh = (t.warehouse_type || '').trim().toUpperCase();
                if (wh !== 'KHO_DV_Q12' && wh !== 'KHO_DV_HMN' && wh !== 'KHO_DV_CCI' && wh !== 'KHO_NV_Q12' && wh !== 'KHO_NV_HMN') {
                    return;
                }
            }

            const qty = t.type === 'inbound' ? Number(t.quantity) : -Number(t.quantity);
            const pId = t.product_id;
            const dist = t.district || '';
            const status = t.item_status || '';

            // Detailed Stock
            const specificKey = `${pId}|${dist}|${status}`;
            detailedStockMap[specificKey] = (detailedStockMap[specificKey] || 0) + qty;

            const districtAggKey = `${pId}|${dist}|*ALL*`;
            detailedStockMap[districtAggKey] = (detailedStockMap[districtAggKey] || 0) + qty;
            
            // Total Stock mapping (district empty, status empty)
            const totalKey = `${pId}||`;
            detailedStockMap[totalKey] = (detailedStockMap[totalKey] || 0) + qty;
        });

        // Deduct pending and approved orders from available stock
        if (orders && Array.isArray(orders)) {
            orders.forEach((o) => {
                if (o.status === 'pending' || o.status === 'approved') {
                    // Check for expiration (24 hours) for approved orders
                    if (o.status === 'approved' && o.approved_at) {
                        const approvedTime = new Date(o.approved_at).getTime();
                        const now = new Date().getTime();
                        if (now - approvedTime > 24 * 60 * 60 * 1000) {
                            return; // Expired, do not deduct
                        }
                    }

                    const qty = Number(o.quantity) || 0;
                    const pId = o.product_id;
                    if (pId) {
                        // Tìm nhân viên để xác định quận
                        const emp = employees?.find(e => e.full_name === o.requester_group || e.username === o.requester_group);
                        const empDistrict = emp?.district || '';

                        // Khấu trừ khỏi tổng tồn kho
                        const totalKey = `${pId}||`;
                        detailedStockMap[totalKey] = (detailedStockMap[totalKey] || 0) - qty;

                        // Khấu trừ khỏi tồn kho theo quận tương ứng
                        if (empDistrict) {
                            const districtAggKey = `${pId}|${empDistrict}|*ALL*`;
                            detailedStockMap[districtAggKey] = (detailedStockMap[districtAggKey] || 0) - qty;
                        }
                    }
                }
            });
        }

        return detailedStockMap;
    }
);

/**
 * Tồn chi tiết theo đúng kho nguồn.  Khóa có dạng
 * productId|district|itemStatus|warehouseType, vì district không đủ để phân
 * biệt KHO_DV_Q12 và KHO_NV_Q12.
 */
export const selectWarehouseDetailedStockMap = createSelector(
    [rawTransactions],
    (transactions: Transaction[]) => {
        const stock: Record<string, number> = {};
        const serialWarehouse = new Map<string, string>();

        transactions.forEach(t => {
            if (t.type !== 'inbound') return;
            const warehouse = normalizeWarehouseType(t.warehouse_type);
            if (!isTrackedWarehouse(warehouse)) return;
            if (t.serial_code?.trim()) {
                serialWarehouse.set(`${t.product_id}|${t.serial_code.trim().toUpperCase()}`, warehouse);
            }
        });

        transactions.forEach(t => {
            let warehouse = normalizeWarehouseType(t.warehouse_type);
            if (t.type === 'outbound' && !isTrackedWarehouse(warehouse) && t.serial_code?.trim()) {
                warehouse = serialWarehouse.get(`${t.product_id}|${t.serial_code.trim().toUpperCase()}`) || '';
            }
            if (t.type === 'inbound' && !isTrackedWarehouse(warehouse)) return;
            // Các phiếu xuất lịch sử không ghi kho phải hiện riêng để không bị
            // trừ nhầm vào một kho bất kỳ. Phiếu mới luôn được yêu cầu chọn kho.
            if (t.type === 'outbound' && !isTrackedWarehouse(warehouse)) warehouse = 'KHO_CHUA_XAC_DINH';

            const key = `${t.product_id}|${t.district || ''}|${t.item_status || ''}|${warehouse}`;
            const qty = Number(t.quantity) || 0;
            stock[key] = (stock[key] || 0) + (t.type === 'inbound' ? qty : -qty);
        });
        return stock;
    }
);

const rawAuth = (state: RootState) => state.auth.profile;

export const selectStockMap = createSelector(
    [selectDetailedStockMap, rawAuth],
    (detailedMap, profile) => {
        if (!detailedMap) return {};
        const isAdmin = profile?.role?.toLowerCase() === 'admin';
        const userDistrict = profile?.district || '';
        
        const simpleMap: Record<string, number> = {};
        Object.keys(detailedMap).forEach(key => {
            const parts = key.split('|');
            if (parts.length === 3) {
                const pId = parts[0];
                const dist = parts[1];
                const status = parts[2];
                
                if (isAdmin || !userDistrict) {
                    if (dist === '' && status === '') {
                        simpleMap[pId] = detailedMap[key];
                    }
                } else {
                    if (dist === userDistrict && status === '*ALL*') {
                        simpleMap[pId] = detailedMap[key];
                    }
                }
            }
        });
        return simpleMap;
    }
);

export const selectProductStock = (state: RootState, productId: string) => {
    const map = selectStockMap(state);
    return map[productId] || 0;
};

export const selectDetailedStock = (state: RootState, productId: string, district?: string, itemStatus?: string) => {
    if (!district && !itemStatus) {
        return selectProductStock(state, productId);
    }

    const map = selectDetailedStockMap(state);
    const districtKey = district || '';
    const statusKey = itemStatus !== undefined && itemStatus !== '' ? itemStatus : '*ALL*';
    const key = `${productId}|${districtKey}|${statusKey}`;
    
    return map[key] || 0;
};

export default inventorySlice.reducer;
