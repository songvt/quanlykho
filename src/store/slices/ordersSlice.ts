import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { supabase } from '../../supabaseClient';
import { SupabaseService } from '../../services/SupabaseService';
import type { Order } from '../../types';

interface OrdersState {
    items: Order[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: OrdersState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchOrders = createAsyncThunk('orders/fetchOrders', async () => {
    const data = await SupabaseService.fetchOrders();
    return data as Order[];
});

export const addOrder = createAsyncThunk('orders/addOrder', async (newOrder: Omit<Order, 'id' | 'order_date' | 'product'>) => {
    const { data, error } = await supabase
        .from('orders')
        .insert([newOrder])
        .select('*')
        .single();

    if (error) {
        throw error;
    }
    return data as Order;
});

export const updateOrderStatus = createAsyncThunk(
    'orders/updateStatus',
    async ({ id, status }: { id: string; status: Order['status'] }) => {
        const { data, error } = await supabase
            .from('orders')
            .update({ status })
            .eq('id', id)
            .select('*')
            .single();

        if (error) {
            throw error;
        }
        return data as Order;
    }
);

export const deleteOrder = createAsyncThunk('orders/deleteOrder', async (id: string) => {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

    if (error) {
        throw error;
    }
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
                state.items = action.payload;
            })
            .addCase(fetchOrders.rejected, (state, action) => {
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
