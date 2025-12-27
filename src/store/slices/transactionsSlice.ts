import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SupabaseService } from '../../services/SupabaseService';
import type { Transaction } from '../../types';

interface TransactionsState {
    items: Transaction[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: TransactionsState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchTransactions = createAsyncThunk('transactions/fetchTransactions', async () => {
    const data = await SupabaseService.fetchTransactions();
    return data;
});

export const addInboundTransaction = createAsyncThunk(
    'transactions/addInbound',
    async (transaction: Omit<Transaction, 'id' | 'type' | 'group_name' | 'total_price' | 'date' | 'product'>) => {
        const data = await SupabaseService.createInboundTransaction(transaction);
        return data;
    }
);

export const addOutboundTransaction = createAsyncThunk(
    'transactions/addOutbound',
    async (transaction: Omit<Transaction, 'id' | 'type' | 'total_price' | 'date' | 'product'> & { group_name: string, user_id?: string }) => {
        const data = await SupabaseService.createOutboundTransaction(transaction);
        return data;
    }
);

export const importInboundTransactions = createAsyncThunk(
    'transactions/importInbound',
    async (transactions: any[]) => {
        const data = await SupabaseService.bulkCreateInboundTransactions(transactions, { skipWebhook: true });
        return data;
    }
);

export const importOutboundTransactions = createAsyncThunk(
    'transactions/importOutbound',
    async (transactions: any[]) => {
        const data = await SupabaseService.bulkCreateOutboundTransactions(transactions, { skipWebhook: true });
        return data;
    }
);

export const deleteTransaction = createAsyncThunk(
    'transactions/deleteTransaction',
    async ({ id, type }: { id: string, type: 'inbound' | 'outbound' }) => {
        await SupabaseService.deleteTransaction(id, type);
        return id;
    }
);

const transactionsSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTransactions.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchTransactions.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
            })
            .addCase(fetchTransactions.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch transactions';
            })
            // Add Inbound
            .addCase(addInboundTransaction.fulfilled, () => {
                // We might want to just re-fetch or optimistically update. 
                // For simplicity, let's just mark succeeded and let the component re-fetch or push to list if needed in future
            })
            // Add Outbound
            .addCase(addOutboundTransaction.fulfilled, () => {
                // Same here
            })
            // Delete
            .addCase(deleteTransaction.fulfilled, (state, action) => {
                state.items = state.items.filter(item => item.id !== action.payload);
            });
    },
});

export default transactionsSlice.reducer;
