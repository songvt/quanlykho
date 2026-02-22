import type { Product, Transaction, DashboardStats, FifoAgingItem, EmployeeReturn } from '../types';

const API_BASE = '/api';

const apiRequest = async (endpoint: string, options?: RequestInit) => {
    const url = `${API_BASE}/${endpoint}`;
    const response = await fetch(url, options);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `API Request failed: ${response.statusText}`);
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
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

    async deleteTransaction(id: string, type: 'inbound' | 'outbound') {
        await apiRequest('transactions', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, type })
        });
        return id;
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

    // --- Complex Analytics Dashboard (Requires fetching ALL data, potentially slow on Sheets) ---
    // For now we will implement simple frontend-side calc based on raw data
    async getInventorySnapshot() {
        const p1 = this.fetchTransactions();
        const [transactions] = await Promise.all([p1]);

        const stockMap: Record<string, number> = {};
        const detailedStockMap: Record<string, number> = {};

        transactions.forEach((t: any) => {
            const qty = t.type === 'inbound' ? Number(t.quantity) : -Number(t.quantity);
            const pId = t.product_id;
            const dist = t.district || '';
            const status = t.item_status || '';

            // Total Stock
            stockMap[pId] = (stockMap[pId] || 0) + qty;

            // Detailed Stock
            const specificKey = `${pId}|${dist}|${status}`;
            detailedStockMap[specificKey] = (detailedStockMap[specificKey] || 0) + qty;

            const districtAggKey = `${pId}|${dist}|*ALL*`;
            detailedStockMap[districtAggKey] = (detailedStockMap[districtAggKey] || 0) + qty;
        });

        return { total: stockMap, detailed: detailedStockMap };
    },

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
