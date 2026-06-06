import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { GoogleSheetService as SupabaseService } from '../../services/GoogleSheetService';
import type { Employee } from '../../types';
import type { RootState } from '../index';

const CACHE_TTL_MS = 30_000; // 30 seconds cache

interface EmployeesState {
    items: Employee[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
    lastFetched: number | null;
}

const initialState: EmployeesState = {
    items: [],
    status: 'idle',
    error: null,
    lastFetched: null,
};

export const fetchEmployees = createAsyncThunk(
    'employees/fetchEmployees',
    async () => {
        const data = await SupabaseService.fetchEmployees();
        return data;
    },
    {
        condition: (_, { getState }) => {
            const state = getState() as RootState;
            const { status, lastFetched } = state.employees;
            if (status === 'loading') return false;
            if (lastFetched && Date.now() - lastFetched < CACHE_TTL_MS) return false;
            return true;
        }
    }
);

export const fetchEmployeesForce = createAsyncThunk('employees/fetchEmployeesForce', async () => {
    const data = await SupabaseService.fetchEmployees();
    return data;
});

export const addEmployee = createAsyncThunk('employees/addEmployee', async (employee: Partial<Employee>) => {
    const data = await SupabaseService.addEmployee(employee);
    return data;
});

export const importEmployees = createAsyncThunk('employees/import', async (employees: Partial<Employee>[]) => {
    return await SupabaseService.bulkAddEmployees(employees);
});

export const updateEmployee = createAsyncThunk('employees/updateEmployee', async ({ id, updates }: { id: string; updates: Partial<Employee> }) => {
    const data = await SupabaseService.updateEmployee(id, updates);
    return data;
});

export const deleteEmployee = createAsyncThunk('employees/deleteEmployee', async (id: string) => {
    await SupabaseService.deleteEmployee(id);
    return id;
});

export const deleteEmployees = createAsyncThunk('employees/deleteEmployees', async (ids: string[]) => {
    await SupabaseService.bulkDeleteEmployees(ids);
    return ids;
});

const employeesSlice = createSlice({
    name: 'employees',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            // Fetch
            .addCase(fetchEmployees.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchEmployees.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = Array.isArray(action.payload) ? action.payload : [];
                state.lastFetched = Date.now();
            })
            .addCase(fetchEmployees.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch employees';
            })
            // Fetch Force
            .addCase(fetchEmployeesForce.pending, (state) => {
                state.status = 'loading';
            })
            .addCase(fetchEmployeesForce.fulfilled, (state, action) => {
                state.status = 'succeeded';
                state.items = Array.isArray(action.payload) ? action.payload : [];
                state.lastFetched = Date.now();
            })
            .addCase(fetchEmployeesForce.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Failed to fetch employees';
            })
            // Add
            .addCase(addEmployee.fulfilled, (state, action) => {
                state.items.push(action.payload);
            })
            // Import
            .addCase(importEmployees.fulfilled, (state, action) => {
                if (action.payload) {
                    state.items.push(...action.payload);
                }
            })
            // Update
            .addCase(updateEmployee.fulfilled, (state, action) => {
                const index = state.items.findIndex((item) => item.id === action.payload.id);
                if (index !== -1) {
                    state.items[index] = action.payload;
                }
            })
            // Delete
            .addCase(deleteEmployee.fulfilled, (state, action) => {
                state.items = state.items.filter((item) => item.id !== action.payload);
            })
            .addCase(deleteEmployees.fulfilled, (state, action) => {
                state.items = state.items.filter((item) => !action.payload.includes(item.id));
            });
    },
});

export default employeesSlice.reducer;
