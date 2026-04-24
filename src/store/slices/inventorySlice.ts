import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { createSelector } from 'reselect';
import type { RootState } from '../index';

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

export const selectDetailedStockMap = createSelector(
    [rawTransactions, rawOrders],
    (transactions, orders) => {
        const detailedStockMap: Record<string, number> = {};

        transactions.forEach((t: any) => {
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
            orders.forEach((o: any) => {
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
                        const totalKey = `${pId}||`;
                        detailedStockMap[totalKey] = (detailedStockMap[totalKey] || 0) - qty;
                    }
                }
            });
        }

        return detailedStockMap;
    }
);

const rawAuth = (state: RootState) => state.auth.profile;

export const selectStockMap = createSelector(
    [selectDetailedStockMap, rawAuth],
    (detailedMap, profile) => {
        const isAdmin = profile?.role === 'Admin';
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
