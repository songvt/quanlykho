import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Product } from '../../types';

interface ProductsState {
    items: Product[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: ProductsState = {
    items: [],
    status: 'idle',
    error: null,
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
            })
            .addCase(fetchProducts.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch products';
            })
            // Add
            .addCase(addNewProduct.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            // Update
            .addCase(updateProduct.fulfilled, (state, action) => {
                const index = state.items.findIndex(p => p.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // Import
            .addCase(importProducts.fulfilled, (state, action) => {
                if (action.payload) {
                    state.items.push(...action.payload);
                }
            })
            // Delete
            .addCase(deleteProduct.fulfilled, (state, action) => {
                state.items = state.items.filter(p => p.id !== action.payload);
            })
            .addCase(deleteProducts.fulfilled, (state, action) => {
                state.items = state.items.filter(p => !action.payload.includes(p.id));
            });
    },
});

export default productsSlice.reducer;
