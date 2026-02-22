import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Employee } from '../../types';

interface AuthState {
    user: any | null; // Supabase Auth User
    profile: Employee | null; // Employee Profile
    isAuthenticated: boolean;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: AuthState = {
    user: null,
    profile: null,
    isAuthenticated: false,
    status: 'idle',
    error: null,
};

// Async Thunks
export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
        try {
            // Call custom login service
            const { user, profile } = await SupabaseService.login(email, password);
            return { user, profile };
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const logoutUser = createAsyncThunk(
    'auth/logout',
    async (_, { rejectWithValue }) => {
        try {
            await SupabaseService.logout();
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

export const checkAuthSession = createAsyncThunk(
    'auth/checkSession',
    async (_, { rejectWithValue }) => {
        try {
            // Check for existing session in localStorage via Service
            const sessionStr = localStorage.getItem('qlkho_session');
            if (sessionStr) {
                const session = JSON.parse(sessionStr);

                // CRITICAL FIX: Always fetch the latest profile from the database
                // Do not rely on the stale profile in localStorage
                try {
                    const freshProfile = await SupabaseService.getEmployeeProfile(session.profile.auth_user_id || session.profile.id);

                    // Verify if the user is really authenticated (exists in DB)
                    if (freshProfile) {
                        // Update localStorage with fresh profile so subsequent reads are newer
                        const newSession = { ...session, profile: freshProfile };
                        localStorage.setItem('qlkho_session', JSON.stringify(newSession));

                        return { user: session.user, profile: freshProfile };
                    }
                } catch (err) {
                    console.warn('Failed to fetch fresh profile, falling back to local storage', err);
                }

                // Fallback (or if fetch failed but we want to keep them logged in)
                return { user: session.user, profile: session.profile };
            }

            return null;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        clearError(state) {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Login
        builder
            .addCase(loginUser.pending, (state) => {
                state.status = 'loading';
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.isAuthenticated = true;
                state.user = action.payload.user;
                state.profile = action.payload.profile;
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.status = 'failed';
                state.isAuthenticated = false;
                state.user = null;
                state.profile = null;
                state.error = action.payload as string;
            });

        // Logout
        builder.addCase(logoutUser.fulfilled, (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.profile = null;
            state.status = 'idle';
        });

        // Check Session
        builder
            .addCase(checkAuthSession.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(checkAuthSession.fulfilled, (state, action) => {
                state.status = 'succeeded';
                if (action.payload) {
                    state.isAuthenticated = true;
                    state.user = action.payload.user;
                    state.profile = action.payload.profile;
                } else {
                    state.isAuthenticated = false;
                    state.user = null;
                    state.profile = null;
                }
            })
            .addCase(checkAuthSession.rejected, (state) => {
                state.status = 'failed';
                state.isAuthenticated = false;
            });
    },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;
