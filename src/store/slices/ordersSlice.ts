import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Order } from '../../types';
import type { RootState } from '../index';

const CACHE_TTL_MS = 30_000; // 30 seconds cache

interface OrdersState {
    items: Order[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: OrdersState = {
    items: [],
    status: 'idle',
    error: null,
    lastFetched: null,
};

export const fetchOrders = createAsyncThunk(
    'orders/fetchOrders',
    async () => {
        const data = await SupabaseService.fetchOrders();
        return data as Order[];
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { status, lastFetched } = state.orders;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return false;
            return true;
        }
    }
);

export const fetchOrdersForce = createAsyncThunk('orders/fetchOrdersForce', async () => {
    const data = await SupabaseService.fetchOrders();
    return data as Order[];
});

export const addOrder = createAsyncThunk('orders/addOrder', async (newOrder: Omit<Order, 'id' | 'order_date' | 'product'>) => {
    const data = await SupabaseService.addOrder(newOrder);
    return data as Order;
});

export const updateOrderStatus = createAsyncThunk(
    'orders/updateStatus',
    async ({ id, status, approver }: { id: string; status: Order['status'], approver?: string }) => {
        const data = await SupabaseService.updateOrderStatus(id, status, approver);
        return data as unknown as Order;
    }
);

export const deleteOrder = createAsyncThunk('orders/deleteOrder', async (id: string) => {
    await SupabaseService.deleteOrder(id);
    return id;
});

export const deleteOrders = createAsyncThunk('orders/deleteOrders', async (ids: string[]) => {
    await SupabaseService.bulkDeleteOrders(ids);
    return ids;
});

const ordersSlice = createSlice({
    name: 'orders',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchOrders.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchOrders.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.status = 'succeeded';
                state.items = Array.isArray(action.payload) ? action.payload : [];
                state.lastFetched = Date.now();
            })
            .addCase(fetchOrders.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch orders';
            })
            // Fetch Force
            .addCase(fetchOrdersForce.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchOrdersForce.fulfilled, (state, action: PayloadAction<Order[]>) => {
                state.status = 'succeeded';
                state.items = Array.isArray(action.payload) ? action.payload : [];
                state.lastFetched = Date.now();
            })
            .addCase(fetchOrdersForce.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch orders';
            })
            // Add
            .addCase(addOrder.fulfilled, (state, action: PayloadAction<Order>) => {
                state.items.unshift(action.payload);
            })
            // Update
            .addCase(updateOrderStatus.fulfilled, (state, action: PayloadAction<Order>) => {
                const index = state.items.findIndex(order => order.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteOrder.fulfilled, (state, action: PayloadAction<string>) => {
                state.items = state.items.filter(order => order.id !== action.payload);
            })
            .addCase(deleteOrders.fulfilled, (state, action: PayloadAction<string[]>) => {
                state.items = state.items.filter(order => !action.payload.includes(order.id));
            });
    },
});

export default ordersSlice.reducer;
