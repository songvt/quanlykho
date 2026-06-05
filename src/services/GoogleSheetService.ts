import type { Product, Transaction, DashboardStats, FifoAgingItem, EmployeeReturn } from '../types';

const API_BASE = '/api';
const REQUEST_TIMEOUT_MS = 60000; // Tăng lên 60 giây cho các tác vụ Import lớn
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

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Logging payload size for debugging
    if (options?.body) {
        const size = (options.body as string).length;
        if (size > 1024 * 1024) {
            console.log(`[API] Payload size for ${endpoint}: ${(size / (1024 * 1024)).toFixed(2)} MB`);
        }
    }

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
            console.warn(`[API] Network error on ${endpoint}, retrying... (${retryCount + 1}/${MAX_RETRIES})`);
            await delay(1000 * (retryCount + 1));
            return apiRequest(endpoint, options, retryCount + 1);
        }

        if (err instanceof TypeError) {
            throw new Error(`Không thể kết nối đến máy chủ API (${endpoint}). Vui lòng kiểm tra kết nối mạng hoặc server.`);
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

    async syncInStockToInbound(createdBy?: string) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'inbound', action: 'sync_from_in_stock', created_by: createdBy })
        });
    },

    async syncQRSheet(productId: string, createdBy?: string) {
        return apiRequest('transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'inbound', action: 'sync_from_qr', product_id: productId, created_by: createdBy })
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
        const user = await apiRequest('employees', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'login', email, password })
        });

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

    // --- HR Profiles ---
    async fetchHRProfiles() {
        return apiRequest('hr_profiles');
    },

    async addHRProfile(profile: any) {
        return apiRequest('hr_profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: profile })
        });
    },

    async bulkAddHRProfiles(profiles: any[]) {
        return apiRequest('hr_profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'bulk_insert', payload: profiles })
        });
    },

    async updateHRProfile(id: string, updates: any) {
        return apiRequest('hr_profiles', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...updates, id })
        });
    },

    async deleteHRProfile(id: string) {
        await apiRequest('hr_profiles', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        return id;
    },

    async bulkDeleteHRProfiles(ids: string[]) {
        await apiRequest('hr_profiles', {
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

    async getDashboardStats(): Promise<DashboardStats> {
        return apiRequest('stats?action=dashboard');
    },

    async getFifoInventoryAging(): Promise<FifoAgingItem[]> {
        return apiRequest('stats?action=fifo_aging');
    },

    async getReportNumber(_dateObj?: Date, _employeeName?: string) {
        // Mock returning 1 to satisfy frontend logic for now
        return 1;
    },

    // --- QR Logs ---
    async saveQRLog(logData: {
        action: string;
        doc_title: string;
        total_serials: number;
        total_qrs: number;
        created_by?: string;
        details?: any;
    }) {
        return apiRequest('qr_logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logData)
        });
    },

    async getActionLogs() {
        return apiRequest('qr_logs', {
            method: 'GET'
        });
    },

    async getAssetLogs() {
        return apiRequest('asset_logs', {
            method: 'GET'
        });
    },

    // --- Settlement History ---
    async getSettlementHistory(month: string) {
        return apiRequest(`settlement_history?month=${month}`);
    },

    async saveSettlementHistory(payload: any[]) {
        return apiRequest('settlement_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload })
        });
    },

    // --- Settlement Data Persistence (with Chunking to avoid Vercel limits) ---
    /** Internal helper for chunked saving to avoid Vercel timeouts/limits */
    async _saveChunked(endpoint: string, month: string, payload: any[], typeLabel: string) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
            const chunk = payload.slice(i, i + CHUNK_SIZE);
            await apiRequest(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    month, 
                    payload: chunk,
                    skipDelete: i > 0 
                })
            });
            console.log(`[Import] Saved ${typeLabel} chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(payload.length/CHUNK_SIZE)}`);
        }
    },

    async saveSettlementInventory(month: string, payload: any[]) {
        return this._saveChunked('settlement_inventory', month, payload, 'Inventory');
    },

    async saveSettlementOutbound(month: string, payload: any[]) {
        return this._saveChunked('settlement_outbound', month, payload, 'Outbound');
    },

    async clearSettlementData(month: string, type: 'inventory' | 'outbound') {
        const endpoint = type === 'inventory' ? 'settlement_inventory' : 'settlement_outbound';
        return apiRequest(`${endpoint}?month=${month}`, { method: 'DELETE' });
    },

    async getSettlementInventory(month: string) {
        return apiRequest(`settlement_inventory?month=${month}`);
    },

    async getSettlementOutbound(month: string) {
        return apiRequest(`settlement_outbound?month=${month}`);
    },

    /**
     * Tổng hợp nhập/xuất/trả từ chi tiết và lưu cố định vào settlement_history.
     * Sau bước này, cột XUẤT TRONG KỲ không đổi khi reload cho đến khi import/xóa lại.
     */
    async syncSettlementMovements(
        month: string,
        inventoryData: any[],
        outboundData: any[],
        mode: 'supply' | 'goods',
        existingHistory: Record<string, any> = {},
        goodsOptions?: { findStandardKey?: (name: string, code?: string) => string | null }
    ) {
        const {
            normalizeSettlementMonth,
            aggregateSettlementMovements,
            buildSettlementHistoryPayload,
        } = await import('../utils/settlementAggregates');

        const normalizedMonth = normalizeSettlementMonth(month);
        const aggregates = aggregateSettlementMovements(
            inventoryData,
            outboundData,
            normalizedMonth,
            mode,
            goodsOptions
        );
        const payload = buildSettlementHistoryPayload(normalizedMonth, aggregates, existingHistory);
        if (payload.length > 0) {
            await apiRequest('settlement_history', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload }),
            });
        }
        const { markMovementsFrozen } = await import('../utils/settlementAggregates');
        markMovementsFrozen(normalizedMonth, mode);
        return payload;
    },

    async clearSettlementMovements(
        month: string,
        existingHistory: Record<string, any>,
        mode: 'supply' | 'goods' = 'supply'
    ) {
        const { normalizeSettlementMonth, clearMovementsFrozen } = await import('../utils/settlementAggregates');
        const normalizedMonth = normalizeSettlementMonth(month);
        const uniqueRecordsMap = new Map<string, any>();
        Object.values(existingHistory).forEach((hist: any) => {
            if (hist && hist.item_name) {
                uniqueRecordsMap.set(hist.item_name, hist);
            }
        });
        const records = Array.from(uniqueRecordsMap.values());
        if (records.length === 0) return;

        const payload = records.map((hist: any) => {
            const opening_qty = Number(hist.opening_qty) || 0;
            const opening_amount = Number(hist.opening_amount) || 0;
            return {
                month: normalizedMonth,
                item_code: hist.item_code || '',
                item_name: hist.item_name,
                unit: hist.unit || 'Cái',
                unit_price: Number(hist.unit_price) || 0,
                opening_qty,
                opening_amount,
                inbound_qty: 0,
                inbound_amount: 0,
                outbound_qty: 0,
                outbound_amount: 0,
                usage_qty: Number(hist.usage_qty) || 0,
                usage_amount: Number(hist.usage_amount) || 0,
                return_qty: 0,
                return_amount: 0,
                closing_qty: opening_qty,
                closing_amount: opening_amount,
                sap_item_code: hist.sap_item_code || '',
                finance_item_name: hist.finance_item_name || '',
                updated_at: new Date().toISOString(),
            };
        });

        clearMovementsFrozen(normalizedMonth, mode);

        await apiRequest('settlement_history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload }),
        });
    },

    // --- Security & Configuration ---
    async getCompanyInfo() {
        return apiRequest('system_config?tab=company');
    },

    async updateCompanyInfo(payload: any) {
        return apiRequest('system_config?tab=company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async getBranches() {
        return apiRequest('system_config?tab=branches');
    },

    async createBranch(payload: any) {
        return apiRequest('system_config?tab=branches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async updateBranch(payload: any) {
        return apiRequest('system_config?tab=branches', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },

    async deleteBranch(id: string) {
        return apiRequest('system_config?tab=branches', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
    },

    async getDevices() {
        return apiRequest('system_config?tab=devices');
    },

    async deleteDevice(id: string) {
        return apiRequest('system_config?tab=devices', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
    },

    async getBackupData() {
        return apiRequest('system_config?tab=backup');
    },

    async restoreBackupData(payload: any) {
        return apiRequest('system_config?tab=restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    },
};
