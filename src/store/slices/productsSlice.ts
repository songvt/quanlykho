import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Product } from '../../types';

interface ProductsState {
    items: Product[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: ProductsState = {
    items: [],
    status: 'idle',
    error: null,
    lastFetched: null,
};

export const fetchProducts = createAsyncThunk('products/fetchProducts', async () => {
    const data = await SupabaseService.fetchProducts();
    return data;
});

export const addNewProduct = createAsyncThunk('products/add', async (product: Omit<Product, 'id'>) => {
    return await SupabaseService.addProduct(product);
});

export const updateProduct = createAsyncThunk('products/update', async (product: Product) => {
    return await SupabaseService.updateProduct(product);
});

export const importProducts = createAsyncThunk('products/import', async (products: Omit<Product, 'id'>[]) => {
    return await SupabaseService.bulkAddProducts(products);
});

export const deleteProduct = createAsyncThunk('products/delete', async (id: string) => {
    return await SupabaseService.deleteProduct(id);
});

export const deleteProducts = createAsyncThunk('products/deleteProducts', async (ids: string[]) => {
    return await SupabaseService.bulkDeleteProducts(ids);
});

const productsSlice = createSlice({
    name: 'products',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchProducts.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchProducts.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = action.payload;
                state.lastFetched = Date.now();
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch products';
            })
            // Add
            .addCase(addNewProduct.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(addNewProduct.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items.push(action.payload);
            })
            .addCase(addNewProduct.rejected, (state) => {
                state.status = 'failed';
                state.lastFetched = null;
            })
            // Update
            .addCase(updateProduct.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(updateProduct.fulfilled, (state, action) => {
                state.status = 'succeeded';
                const index = state.items.findIndex(p => p.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // Import
            .addCase(importProducts.fulfilled, (state, action) => {
                if (action.payload) {
                    state.items.push(...action.payload);
                    state.lastFetched = null;
                }
            })
            // Delete (Optimistic)
            .addCase(deleteProduct.pending, (state, action) => {
                const id = action.meta.arg;
                state.items = state.items.filter(p => p.id !== id);
            })
            .addCase(deleteProduct.rejected, (state) => {
                state.lastFetched = null;
                state.status = 'failed';
            })
            // Bulk Delete (Optimistic)
            .addCase(deleteProducts.pending, (state, action) => {
                const ids = action.meta.arg;
                state.items = state.items.filter(p => !ids.includes(p.id));
            })
            .addCase(deleteProducts.rejected, (state) => {
                state.lastFetched = null;
                state.status = 'failed';
            });
    },
});

export default productsSlice.reducer;
