import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Transaction } from '../../types';
import type { RootState } from '../index';

const CACHE_TTL_MS = 30_000; // 30 giây — không fetch lại nếu data còn mới

interface TransactionsState {
    items: Transaction[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null; // timestamp lần fetch gần nhất
}

const initialState: TransactionsState = {
    items: [],
    status: 'idle',
    error: null,
    lastFetched: null,
};

export const fetchTransactions = createAsyncThunk(
    'transactions/fetchTransactions',
    async () => {
        const data = await SupabaseService.fetchTransactions();
        return data;
    },
    {
        // Không fetch lại nếu data còn trong cache (30 giây)
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { status, lastFetched } = state.transactions;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return false;
            return true;
        }
    }
);

export const fetchTransactionsForce = createAsyncThunk(
    'transactions/fetchForce',
    async () => {
        const data = await SupabaseService.fetchTransactions();
        return data;
    }
);

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
        const data = await SupabaseService.bulkCreateInboundTransactions(transactions);
        return data;
    }
);

export const syncInStock = createAsyncThunk(
    'transactions/syncInStock',
    async (_, { dispatch }) => {
        const res = await SupabaseService.syncInStockToInbound();
        if (res?.count > 0) {
            dispatch(fetchTransactionsForce()); // Refresh transactions
        }
        return res;
    }
);

export const syncFromQR = createAsyncThunk(
    'transactions/syncFromQR',
    async ({ productId }: { productId: string }, { dispatch }) => {
        const res = await SupabaseService.syncQRSheet(productId);
        if (res?.count > 0) {
            dispatch(fetchTransactionsForce());
        }
        return res;
    }
);

export const importOutboundTransactions = createAsyncThunk(
    'transactions/importOutbound',
    async (transactions: any[]) => {
        const data = await SupabaseService.bulkCreateOutboundTransactions(transactions);
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

export const bulkDeleteTransactions = createAsyncThunk(
    'transactions/bulkDelete',
    async ({ ids, type }: { ids: string[], type: 'inbound' | 'outbound' }) => {
        await SupabaseService.bulkDeleteTransactions(ids, type);
        return ids;
    }
);

export const updateTransaction = createAsyncThunk(
    'transactions/updateTransaction',
    async ({ id, type, payload }: { id: string, type: 'inbound' | 'outbound', payload: any }) => {
        const data = await SupabaseService.updateTransaction(id, type, payload);
        return data;
    }
);

const transactionsSlice = createSlice({
    name: 'transactions',
    initialState,
    reducers: {
        // Manual cache invalidation khi biết data đã thay đổi
        invalidateCache: (state) => {
            state.lastFetched = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // ── fetchTransactions ───────────────────────────
            .addCase(fetchTransactions.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchTransactions.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(fetchTransactions.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Không tải được dữ liệu';
            })
            // ── fetchTransactionsForce (bỏ qua cache) ───────
            .addCase(fetchTransactionsForce.pending, (state) => { state.status = 'loading'; })
            .addCase(fetchTransactionsForce.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(fetchTransactionsForce.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Không tải được dữ liệu';
            })
            // ── Delete single (Optimistic) ──────────────────
            .addCase(deleteTransaction.pending, (state, action) => {
                const id = action.meta.arg.id;
                state.items = state.items.filter(item => item.id !== id);
                // Note: Không null lastFetched ở đây để tránh trigger refetch giữa chừng
            })
            .addCase(deleteTransaction.rejected, (state) => {
                state.lastFetched = null; // Mark as stale to force refetch on next access
                state.status = 'failed';
            })
            // ── Bulk Delete (Optimistic) ─────────────────────
            .addCase(bulkDeleteTransactions.pending, (state, action) => {
                const ids = action.meta.arg.ids;
                state.items = state.items.filter(item => !ids.includes(item.id));
            })
            .addCase(bulkDeleteTransactions.rejected, (state) => {
                state.lastFetched = null;
                state.status = 'failed';
            })
            // ── Update ───────────────────────────────────────
            .addCase(updateTransaction.fulfilled, (state, action) => {
                const index = state.items.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // ── Add (Optimistic directly from backend response) ─────────
            .addCase(addInboundTransaction.fulfilled, (state, action) => {
                const newItems = Array.isArray(action.payload) ? action.payload : [action.payload];
                state.items = [...newItems, ...state.items];
            })
            .addCase(addOutboundTransaction.fulfilled, (state, action) => {
                const newItems = Array.isArray(action.payload) ? action.payload : [action.payload];
                state.items = [...newItems, ...state.items];
            })
            .addCase(importInboundTransactions.fulfilled, (state, action) => {
                const newItems = Array.isArray(action.payload) ? action.payload : [];
                state.items = [...newItems, ...state.items];
            })
            .addCase(importOutboundTransactions.fulfilled, (state, action) => {
                const newItems = Array.isArray(action.payload) ? action.payload : [];
                state.items = [...newItems, ...state.items];
            });
    },
});

export const { invalidateCache } = transactionsSlice.actions;

// ── Selectors (memoized) ─────────────────────────────────────────────────────

export const selectAllTransactions = (state: RootState) => state.transactions.items;

/** Chỉ lấy inbound transactions */
export const selectInboundTransactions = createSelector(
    selectAllTransactions,
    items => items.filter(t => t.type === 'inbound' || (t as any).inbound_date)
);

/** Chỉ lấy outbound transactions */
export const selectOutboundTransactions = createSelector(
    selectAllTransactions,
    items => items.filter(t => t.type === 'outbound' || (t as any).outbound_date)
);

/** Outbound trong ngày hôm nay */
export const selectOutboundToday = createSelector(
    selectOutboundTransactions,
    items => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return items.filter(t => {
            const dateVal = (t as any).outbound_date || t.date || (t as any).created_at;
            if (!dateVal) return false;
            return new Date(dateVal) >= todayStart;
        });
    }
);

/** Inbound trong ngày hôm nay */
export const selectInboundToday = createSelector(
    selectInboundTransactions,
    items => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return items.filter(t => {
            const dateVal = (t as any).inbound_date || t.date || (t as any).created_at;
            if (!dateVal) return false;
            return new Date(dateVal) >= todayStart;
        });
    }
);

export default transactionsSlice.reducer;
