import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SupabaseService } from '../../services/SupabaseService';
import type { RootState } from '../index';

interface InventoryState {
    stockMap: Record<string, number>; // Total stock map (for backward compatibility)
    detailedStockMap: Record<string, number>; // Detailed stock map
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
}

const initialState: InventoryState = {
    stockMap: {},
    detailedStockMap: {}, // Initialize
    status: 'idle',
};

export const fetchInventory = createAsyncThunk('inventory/fetchInventory', async () => {
    const data = await SupabaseService.getInventorySnapshot();
    return data;
});

const inventorySlice = createSlice({
    name: 'inventory',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchInventory.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchInventory.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.stockMap = action.payload.total;
                state.detailedStockMap = action.payload.detailed;
            });
    },
});

export const selectProductStock = (state: RootState, productId: string) =>
    state.inventory.stockMap[productId] || 0;

export const selectDetailedStock = (state: RootState, productId: string, district?: string, itemStatus?: string) => {
    // If no filters are applied, return total stock
    if (!district && !itemStatus) {
        return state.inventory.stockMap[productId] || 0;
    }

    const districtKey = district || '';
    const statusKey = itemStatus || '';
    const key = `${productId}|${districtKey}|${statusKey}`;
    return state.inventory.detailedStockMap?.[key] || 0;
};

export default inventorySlice.reducer;
