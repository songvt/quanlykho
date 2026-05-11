import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Asset } from '../../types';

interface AssetsState {
    items: Asset[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: AssetsState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchAssets = createAsyncThunk('assets/fetchAssets', async () => {
    const response = await fetch('/api/assets');
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to fetch assets');
    }
    const data = await response.json();
    return data as Asset[];
});

export const addNewAsset = createAsyncThunk('assets/addNewAsset', async (newAsset: Omit<Asset, 'id'>) => {
    const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insert', payload: newAsset }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add asset');
    }
    return (await response.json()) as Asset;
});

export const importAssets = createAsyncThunk('assets/importAssets', async (assets: Omit<Asset, 'id'>[]) => {
    const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_insert', payload: assets }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(`${err.error || 'Failed to import assets'}${err.details ? ': ' + err.details : ''}`);
    }
    return (await response.json()) as Asset[];
});


export const updateAsset = createAsyncThunk('assets/updateAsset', async (updatedAsset: Partial<Asset> & { id: string }) => {
    const response = await fetch('/api/assets', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAsset),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update asset');
    }
    return (await response.json()) as Asset;
});

export const deleteAsset = createAsyncThunk('assets/deleteAsset', async (id: string) => {
    const response = await fetch('/api/assets', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to delete asset');
    }
    return id;
});

const assetsSlice = createSlice({
    name: 'assets',
    initialState,
    reducers: {
        clearAssetsError(state) {
            state.error = null;
        }
    },
    extraReducers(builder) {
        builder
            .addCase(fetchAssets.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(fetchAssets.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
            })
            .addCase(fetchAssets.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch assets';
            })
            .addCase(addNewAsset.fulfilled, (state, action) => {
                state.items.unshift(action.payload);
            })
            .addCase(importAssets.fulfilled, (state, action) => {
                const newItems = action.payload.filter(p => !state.items.some(existing => existing.id === p.id));
                const updatedItems = action.payload.filter(p => state.items.some(existing => existing.id === p.id));
                state.items = [...newItems, ...state.items.map(item => updatedItems.find(u => u.id === item.id) || item)];
            })
            .addCase(updateAsset.fulfilled, (state, action) => {
                const index = state.items.findIndex(item => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = { ...state.items[index], ...action.payload };
                }
            })
            .addCase(deleteAsset.fulfilled, (state, action) => {
                state.items = state.items.filter(item => item.id !== action.payload);
            });
    }
});

export const { clearAssetsError } = assetsSlice.actions;
export default assetsSlice.reducer;
