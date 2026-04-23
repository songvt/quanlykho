import type { Product, Transaction, DashboardStats, FifoAgingItem, EmployeeReturn } from '../types';

const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 15000; // 15 giây timeout
const MAX_RETRIES = 2;            // Retry tối đa 2 lần nếu lỗi mạng

/** Delay helper */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * apiRequest với auto-retry + timeout
 * - Timeout: 15s (tránh treo vô hạn khi Google Sheets chậm)
 * - Retry: 2 lần với exponential backoff (1s, 2s) cho lỗi mạng
 * - Không retry lỗi 4xx (client error)
 */
const apiRequest = async (endpoint: string, options?: RequestInit, retryCount = 0): Promise<any> => {
    const url = `${API_BASE}/${endpoint}`;

    // AbortController để timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errMsg = errorData.error || errorData.details || `Lỗi ${response.status}: ${response.statusText}`;

            // 4xx → lỗi client, không retry
            if (response.status >= 400 && response.status < 500) {
                throw new Error(errMsg);
            }

            // 5xx → có thể retry
            if (retryCount < MAX_RETRIES) {
                await delay(1000 * (retryCount + 1)); // 1s, 2s
                return apiRequest(endpoint, options, retryCount + 1);
            }
            throw new Error(errMsg);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : null;

    } catch (err: any) {
        clearTimeout(timeoutId);

        if (err.name === 'AbortError') {
            // Timeout
            if (retryCount < MAX_RETRIES) {
                await delay(1000 * (retryCount + 1));
                return apiRequest(endpoint, options, retryCount + 1);
            }
            throw new Error('Kết nối quá lâu, vui lòng thử lại');
        }

        // Lỗi mạng (TypeError: Failed to fetch)
        if (err instanceof TypeError && retryCount < MAX_RETRIES) {
            await delay(1000 * (retryCount + 1));
            return apiRequest(endpoint, options, retryCount + 1);
        }

        throw err;
    }
};



export const GoogleSheetService = {
    // --- Products ---
    async fetchProducts(): Promise<Product[]> {
        return apiRequest('products');
    },

    async addProduct(product: Omit<Product, 'id'>) {
        return apiRequest('products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: product })
        });
    },

    async bulkAddProducts(products: Omit<Product, 'id'>[]) {
        return apiRequest('products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulk_insert', payload: products })
        });
    },

    async updateProduct(product: Product) {
        return apiRequest('products', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(product)
        });
    },

    async deleteProduct(id: string) {
        await apiRequest('products', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return id;
    },

    async bulkDeleteProducts(ids: string[]) {
        await apiRequest('products', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return ids;
    },

    // --- Transactions ---
    async fetchTransactions(): Promise<Transaction[]> {
        return apiRequest('transactions');
    },

    async createInboundTransaction(transaction: Omit<Transaction, 'id' | 'type' | 'group_name' | 'total_price' | 'date' | 'product'>) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'inbound', payload: transaction })
        });
    },

    async bulkCreateInboundTransactions(transactions: any[]) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'inbound', action: 'bulk_insert', payload: transactions })
        });
    },

    async createOutboundTransaction(transaction: Omit<Transaction, 'id' | 'type' | 'total_price' | 'date' | 'product'> & { group_name: string, user_id?: string }) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'outbound', payload: transaction })
        });
    },

    async bulkCreateOutboundTransactions(transactions: any[]) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'outbound', action: 'bulk_insert', payload: transactions })
        });
    },

    async updateTransaction(id: string, type: 'inbound' | 'outbound', payload: any) {
        return apiRequest('transactions', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type, payload })
        });
    },

    async deleteTransaction(id: string, type: 'inbound' | 'outbound') {
        await apiRequest('transactions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type })
        });
        return id;
    },

    async bulkDeleteTransactions(ids: string[], type: 'inbound' | 'outbound') {
        await apiRequest('transactions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, type })
        });
        return ids;
    },

    // --- Employee Returns ---
    async getEmployeeReturns(): Promise<EmployeeReturn[]> {
        return apiRequest('employee_returns');
    },

    async addEmployeeReturn(data: Partial<EmployeeReturn>) {
        return apiRequest('employee_returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: data })
        });
    },

    async bulkAddEmployeeReturns(returns: Partial<EmployeeReturn>[]) {
        return apiRequest('employee_returns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulk_insert', payload: returns })
        });
    },

    async deleteEmployeeReturns(ids: string[]) {
        await apiRequest('employee_returns', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return ids;
    },

    // --- Authentication & Employees ---
    async login(email: string, password: string) {
        const query = new URLSearchParams({ email, password }).toString();
        const user = await apiRequest(`employees?${query}`);

        const session = {
            user: { id: user.id || user.auth_user_id, email: user.email, role: 'authenticated' },
            profile: user
        };
        localStorage.setItem('qlkho_session', JSON.stringify(session));
        return { user: session.user, profile: session.profile };
    },

    async logout() {
        localStorage.removeItem('qlkho_session');
    },

    async getCurrentUser() {
        const sessionStr = localStorage.getItem('qlkho_session');
        if (sessionStr) {
            try { return JSON.parse(sessionStr).user; }
            catch { localStorage.removeItem('qlkho_session'); }
        }
        return null;
    },

    async getEmployeeProfile(queryId: string) {
        const employees = await apiRequest('employees');
        return employees.find((e: any) => e.auth_user_id === queryId || e.id === queryId);
    },

    async changePassword(id: string, newPass: string) {
        return apiRequest('employees', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, password: newPass, must_change_password: false })
        });
    },

    async fetchEmployees() {
        return apiRequest('employees');
    },

    async addEmployee(employee: any) {
        return apiRequest('employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: employee })
        });
    },

    async bulkAddEmployees(employees: any[]) {
        return apiRequest('employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulk_insert', payload: employees })
        });
    },

    async updateEmployee(id: string, updates: any) {
        return apiRequest('employees', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, id })
        });
    },

    async deleteEmployee(id: string) {
        await apiRequest('employees', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return id;
    },

    async bulkDeleteEmployees(ids: string[]) {
        await apiRequest('employees', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return ids;
    },



    // --- Orders ---
    async fetchOrders() {
        return apiRequest('orders');
    },

    async addOrder(newOrder: any) {
        return apiRequest('orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: newOrder })
        });
    },

    async updateOrderStatus(id: string, status: string, approver?: string) {
        return apiRequest('orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status, approved_by: approver })
        });
    },

    async deleteOrder(id: string) {
        await apiRequest('orders', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return id;
    },

    async bulkDeleteOrders(ids: string[]) {
        await apiRequest('orders', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        return ids;
    },

    // --- District Storekeepers ---
    async getDistrictStorekeepers() {
        return apiRequest('district_storekeepers');
    },

    async upsertDistrictStorekeeper(district: string, name: string) {
        return apiRequest('district_storekeepers', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ district, storekeeper_name: name })
        });
    },

    async deleteDistrictStorekeeper(district: string) {
        await apiRequest('district_storekeepers', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ district })
        });
        return district;
    },

    // --- Complex Analytics Dashboard ---

    async getDashboardStats() {
        // Simplistic mock until fully implemented
        return {
            total_products: 0,
            total_inventory: 0,
            low_stock_items: 0,
            out_of_stock_items: 0,
            recent_transactions: [],
            weekly_stats: [],
            category_stats: []
        } as DashboardStats;
    },

    async getFifoInventoryAging() {
        // Hard to implement purely without a backend function doing the math.
        // Might need an API endpoint just for this if required, or fetch all inbound and outbound and calc locally.
        return [] as FifoAgingItem[];
    },

    async getReportNumber(_dateObj?: Date, _employeeName?: string) {
        // Mock returning 1 to satisfy frontend logic for now
        return 1;
    }
};
