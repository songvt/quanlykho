import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { SupabaseService } from '../../services/SupabaseService';
import type { Employee } from '../../types';

interface EmployeesState {
    items: Employee[];
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: EmployeesState = {
    items: [],
    status: 'idle',
    error: null,
};

export const fetchEmployees = createAsyncThunk('employees/fetchEmployees', async () => {
    const data = await SupabaseService.fetchEmployees();
    return data;
});

export const addEmployee = createAsyncThunk('employees/addEmployee', async (employee: Omit<Employee, 'id'>) => {
    const data = await SupabaseService.addEmployee(employee);
    return data;
});

export const importEmployees = createAsyncThunk('employees/import', async (employees: Omit<Employee, 'id'>[]) => {
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
                state.items = action.payload;
            })
            .addCase(fetchEmployees.rejected, (state, action) => {
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
