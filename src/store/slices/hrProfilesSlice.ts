import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { HRProfile } from '../../types';

interface HRProfilesState {
    items: HRProfile[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: HRProfilesState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchHRProfiles = createAsyncThunk('hrProfiles/fetchHRProfiles', async () => {
    const data = await SupabaseService.fetchHRProfiles();
    return data;
});

export const addHRProfile = createAsyncThunk('hrProfiles/addHRProfile', async (profile: Partial<HRProfile>) => {
    const data = await SupabaseService.addHRProfile(profile);
    return data;
});

export const importHRProfiles = createAsyncThunk('hrProfiles/import', async (profiles: Partial<HRProfile>[]) => {
    return await SupabaseService.bulkAddHRProfiles(profiles);
});

export const updateHRProfile = createAsyncThunk('hrProfiles/updateHRProfile', async ({ id, updates }: { id: string; updates: Partial<HRProfile> }) => {
    const data = await SupabaseService.updateHRProfile(id, updates);
    return data;
});

export const deleteHRProfile = createAsyncThunk('hrProfiles/deleteHRProfile', async (id: string) => {
    await SupabaseService.deleteHRProfile(id);
    return id;
});

export const deleteHRProfiles = createAsyncThunk('hrProfiles/deleteHRProfiles', async (ids: string[]) => {
    await SupabaseService.bulkDeleteHRProfiles(ids);
    return ids;
});

const hrProfilesSlice = createSlice({
    name: 'hrProfiles',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchHRProfiles.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchHRProfiles.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = Array.isArray(action.payload) ? action.payload : [];
            })
            .addCase(fetchHRProfiles.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch HR profiles';
            })
            // Add
            .addCase(addHRProfile.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            // Import
            .addCase(importHRProfiles.fulfilled, (state, action) => {
                if (action.payload) {
                    state.items.push(...action.payload);
                }
            })
            // Update
            .addCase(updateHRProfile.fulfilled, (state, action) => {
                const index = state.items.findIndex((item) => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteHRProfile.fulfilled, (state, action) => {
                state.items = state.items.filter((item) => item.id !== action.payload);
            })
            .addCase(deleteHRProfiles.fulfilled, (state, action) => {
                state.items = state.items.filter((item) => !action.payload.includes(item.id));
            });
    },
});

export default hrProfilesSlice.reducer;
