import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SupabaseService } from '../../services/SupabaseService';
import type { EmployeeReturn } from '../../types';

interface ReturnsState {
    items: EmployeeReturn[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: ReturnsState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchReturns = createAsyncThunk('returns/fetchReturns', async () => {
    return await SupabaseService.getEmployeeReturns();
});

export const addReturn = createAsyncThunk('returns/addReturn', async (data: Partial<EmployeeReturn>) => {
    return await SupabaseService.addEmployeeReturn(data);
});

export const addReturns = createAsyncThunk('returns/addReturns', async (data: Partial<EmployeeReturn>[]) => {
    return await SupabaseService.bulkAddEmployeeReturns(data);
});

export const deleteReturns = createAsyncThunk('returns/deleteReturns', async (ids: string[]) => {
    return await SupabaseService.deleteEmployeeReturns(ids);
});

const returnsSlice = createSlice({
    name: 'returns',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchReturns.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchReturns.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
            })
            .addCase(fetchReturns.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch returns';
            })
            .addCase(addReturn.fulfilled, (state, action) => {
                state.items.unshift(action.payload); // Add to top
            })
            .addCase(addReturns.fulfilled, (state, action) => {
                state.items = [...action.payload, ...state.items]; // Add bulk to top
            })
            .addCase(deleteReturns.fulfilled, (state, action) => {
                state.items = state.items.filter(item => !action.payload.includes(item.id));
            });
    },
});

export default returnsSlice.reducer;
