import { supabase } from '../supabaseClient';
import type { Product, Transaction } from '../types';
import { CONFIG } from '../config';

// Helper to send webhook
const sendWebhook = async (type: 'inbound' | 'outbound', data: any) => {
    // Only send webhook for Outbound transactions as per user request
    if (type === 'inbound') return;

    if (!CONFIG.N8N_WEBHOOK_URL) {
        console.warn('Webhook URL not configured');
        return;
    }

    try {
        const payload = Array.isArray(data) ? data.map(formatPayload) : formatPayload(data);
        console.log(`[Webhook] Preparing to send ${type} data:`, payload);

        // Use text/plain to avoid CORS preflight (Simple Request)
        // n8n usually can parse JSON body even if header is text/plain
        fetch(CONFIG.N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: JSON.stringify({
                type,
                timestamp: new Date().toISOString(),
                data: payload
            })
        })
            .then(() => console.log('[Webhook] Request sent successfully'))
            .catch(err => console.error('[Webhook] Failed to send:', err));
    } catch (e) {
        console.error('[Webhook] Error constructing payload:', e);
    }
};

const formatPayload = (item: any) => {
    // Format date as dd/MM/yyyy HH:mm:ss
    const formatDate = (dateString: string) => {
        if (!dateString) return new Date().toLocaleString('vi-VN');
        const d = new Date(dateString);

        // Pad helper
        const pad = (n: number) => n.toString().padStart(2, '0');

        const day = pad(d.getDate());
        const month = pad(d.getMonth() + 1);
        const year = d.getFullYear();
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const formattedDate = formatDate(item.created_at || item.inbound_date || item.outbound_date || new Date().toISOString());

    return {
        ...item,
        // Overwrite core date fields with formatted versions if they exist
        ...(item.created_at && { created_at: formatDate(item.created_at) }),
        ...(item.inbound_date && { inbound_date: formatDate(item.inbound_date) }),
        ...(item.outbound_date && { outbound_date: formatDate(item.outbound_date) }),

        // Enrich with flattened human-readable fields
        product_name: item.product?.name || item.product_name, // Handle joined or direct
        receiver_name: item.receiver_group || item.employee?.full_name || item.user_name || 'N/A',
        // Ensure core fields are present explicitely if needed (they are in item, but explicitly listing for clarity if needed, mostly redundant if spread)
        quantity: item.quantity,
        serial: item.serial_code,
        date: formattedDate
    };
};

// Helper to fetch all data with pagination (to bypass 1000 rows limit)
const fetchAll = async (table: string, select: string = '*', orderCol: string = 'created_at', ascending: boolean = false) => {
    let allData: any[] = [];
    let from = 0;
    const BATCH_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from(table)
            .select(select)
            .order(orderCol, { ascending: ascending })
            .range(from, from + BATCH_SIZE - 1);

        if (error) throw error;

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            if (data.length < BATCH_SIZE) {
                hasMore = false;
            } else {
                from += BATCH_SIZE;
            }
        } else {
            hasMore = false;
        }
    }
    return allData;
};

export const SupabaseService = {
    // --- Products ---
    async fetchProducts(): Promise<Product[]> {
        const data = await fetchAll('products', '*', 'name', true);
        return data as Product[];
    },

    async addProduct(product: Omit<Product, 'id'>) {
        const { data, error } = await supabase
            .from('products')
            .insert([product])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async bulkAddProducts(products: Omit<Product, 'id'>[]) {
        const { data, error } = await supabase
            .from('products')
            .insert(products)
            .select();

        if (error) throw error;
        return data; // Returns array of inserted products
    },

    async updateProduct(product: Product) {
        const { data, error } = await supabase
            .from('products')
            .update(product)
            .eq('id', product.id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteProduct(id: string) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return id;
    },

    // --- Transactions ---
    async fetchTransactions(): Promise<Transaction[]> {
        const [inboundJoined, outboundJoined] = await Promise.all([
            fetchAll('inbound_transactions', '*, product:products(name, item_code)', 'inbound_date'),
            fetchAll('outbound_transactions', '*, product:products(name, item_code)', 'outbound_date')
        ]);

        // Map to unified Transaction interface
        const inboundTrans: Transaction[] = (inboundJoined || []).map((t: any) => ({
            id: t.id,
            type: 'inbound',
            group_name: 'N/A',
            product_id: t.product_id,
            serial_code: t.serial_code,
            quantity: t.quantity,
            unit_price: t.unit_price,
            total_price: t.total_price,
            date: t.inbound_date,
            district: t.district,
            item_status: t.item_status, // Added item_status
            product: t.product,
            // Inbound usually doesn't track specific employee performer in this schema yet, or maybe add later
        }));


        const outboundTrans: Transaction[] = (outboundJoined || []).map((t: any) => ({
            id: t.id,
            type: 'outbound',
            group_name: t.receiver_group,
            product_id: t.product_id,
            serial_code: t.serial_code,
            quantity: t.quantity,
            unit_price: t.unit_price,
            total_price: t.total_price,
            date: t.outbound_date,
            district: t.district,
            item_status: t.item_status, // Added item_status
            product: t.product,
            user_name: t.created_by // This is just ID, ideally join or store name
        }));

        // Merge and sort
        return [...inboundTrans, ...outboundTrans].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );
    },

    async createInboundTransaction(transaction: Omit<Transaction, 'id' | 'type' | 'group_name' | 'total_price' | 'date' | 'product'>) {
        // unit_price is now required from input (fetched from product in UI)

        const { data, error } = await supabase
            .from('inbound_transactions')
            .insert([{
                product_id: transaction.product_id,
                quantity: transaction.quantity,
                serial_code: transaction.serial_code,
                unit_price: transaction.unit_price,
                district: transaction.district,
                item_status: transaction.item_status, // Added item_status
                // inbound_date defaults to NOW()
            }])
            .select('*, product:products(name)')
            .single();

        if (error) throw error;
        sendWebhook('inbound', data);
        return data;
    },

    async bulkCreateInboundTransactions(transactions: any[], options?: { skipWebhook?: boolean }) {
        const { data, error } = await supabase
            .from('inbound_transactions')
            .insert(transactions)
            .select('*, product:products(name)');

        if (error) throw error;
        if (!options?.skipWebhook) {
            sendWebhook('inbound', data);
        }
        return data;
    },

    async createOutboundTransaction(transaction: Omit<Transaction, 'id' | 'type' | 'total_price' | 'date' | 'product'> & { group_name: string, user_id?: string }) {
        // unit_price is now required from input (fetched from product in UI)

        const { data, error } = await supabase
            .from('outbound_transactions')
            .insert([{
                product_id: transaction.product_id,
                quantity: transaction.quantity,
                serial_code: transaction.serial_code,
                receiver_group: transaction.group_name,
                unit_price: transaction.unit_price,
                created_by: transaction.user_id,
                district: transaction.district,
                item_status: transaction.item_status // Added item_status
                // outbound_date defaults to NOW()
            }])
            .select('*, product:products(name)')
            .single();

        if (error) throw error;
        sendWebhook('outbound', data);
        return data;
    },

    async bulkCreateOutboundTransactions(transactions: any[], options?: { skipWebhook?: boolean }) {
        const { data, error } = await supabase
            .from('outbound_transactions')
            .insert(transactions)
            .select('*, product:products(name)');

        if (error) throw error;
        if (!options?.skipWebhook) {
            sendWebhook('outbound', data);
        }
        return data;
    },

    async deleteTransaction(id: string, type: 'inbound' | 'outbound') {
        const table = type === 'inbound' ? 'inbound_transactions' : 'outbound_transactions';
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', id);

        if (error) throw error;
        return id;
    },

    // --- Inventory Calculation (Primitive) ---
    async getInventorySnapshot() {
        const { data, error } = await supabase.rpc('get_inventory_summary');

        if (error) throw error;

        const stockMap: Record<string, number> = {};
        const detailedStockMap: Record<string, number> = {};

        (data || []).forEach((item: any) => {
            // Total Stock
            if (!stockMap[item.product_id]) stockMap[item.product_id] = 0;
            stockMap[item.product_id] += Number(item.total_quantity);

            // Sanitize inputs
            const pId = item.product_id;
            const dist = item.district || '';
            const status = item.item_status || '';
            const qty = Number(item.total_quantity);

            // Detailed Stock (Specific Status)
            const specificKey = `${pId}|${dist}|${status}`;
            detailedStockMap[specificKey] = (detailedStockMap[specificKey] || 0) + qty;

            // Aggregated Stock (District Level - Any Status)
            const districtAggKey = `${pId}|${dist}|*ALL*`;
            detailedStockMap[districtAggKey] = (detailedStockMap[districtAggKey] || 0) + qty;
        });

        return { total: stockMap, detailed: detailedStockMap };
    },

    async getDashboardStats() {
        const { data, error } = await supabase.rpc('get_dashboard_stats');
        if (error) throw error;
        return data as import('../types').DashboardStats;
    },

    async getFifoInventoryAging() {
        const { data, error } = await supabase.rpc('get_fifo_inventory_aging');
        if (error) throw error;
        return data as import('../types').FifoAgingItem[];
    },

    // --- Authentication & Employees ---
    // --- Authentication & Employees ---
    async login(email: string, password: string) {
        // Query employees table directly
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('email', email.trim())
            .eq('password', password)
            .single();

        if (error || !data) {
            throw new Error('Email hoặc mật khẩu không chính xác.');
        }

        // Assign default permissions if not present
        let permissions = data.permissions;
        if (!permissions || permissions.length === 0) {
            if (data.role === 'staff') {
                // Default permissions for Staff
                permissions = [
                    'orders.create',
                    'orders.view_own',
                    'outbound.create',
                    'outbound.view',
                    'reports.handover'
                ];
            } else if (data.role === 'admin' || data.role === 'manager') {
                // Full access for Admin/Manager
                permissions = ['*'];
            }
        }

        // Create a session object
        const session = {
            user: {
                id: data.auth_user_id || data.id,
                email: data.email,
                role: 'authenticated'
            },
            profile: { ...data, permissions }
        };

        // Persist to localStorage
        localStorage.setItem('qlkho_session', JSON.stringify(session));

        return { user: session.user, profile: session.profile };
    },

    async logout() {
        localStorage.removeItem('qlkho_session');
        // Optional: still try to sign out of Supabase if ever logged in
        await supabase.auth.signOut();
    },

    async getCurrentUser() {
        // Check localStorage first
        const sessionStr = localStorage.getItem('qlkho_session');
        if (sessionStr) {
            try {
                const session = JSON.parse(sessionStr);
                return session.user;
            } catch (e) {
                console.error('Invalid session data', e);
                localStorage.removeItem('qlkho_session');
            }
        }
        return null;
    },

    async getEmployeeProfile(queryId: string) {
        // Try to find by auth_user_id first
        let { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('auth_user_id', queryId)
            .single();

        // If not found, try by id (for custom users without auth_user_id)
        if (error || !data) {
            const { data: dataById, error: errorById } = await supabase
                .from('employees')
                .select('*')
                .eq('id', queryId)
                .single();

            if (dataById) {
                data = dataById;
                error = null;
            } else if (errorById) {
                error = errorById;
            }
        }

        // If no profile found, it might be a new user not yet in employees table
        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async changePassword(id: string, newPass: string) {
        const { data, error } = await supabase
            .from('employees')
            .update({ password: newPass, must_change_password: false })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // --- Employee Management (Admin) ---
    async fetchEmployees() {
        return await fetchAll('employees', '*', 'created_at', false);
    },

    async addEmployee(employee: any) { // Type will be defined better in slice
        // Set default permissions if not provided
        if (!employee.permissions) {
            if (employee.role === 'staff') {
                employee.permissions = [
                    'orders.create',
                    'orders.view_own',
                    'outbound.create',
                    'outbound.view',
                    'reports.handover'
                ];
            } else if (employee.role === 'admin' || employee.role === 'manager') {
                employee.permissions = ['*'];
            }
        }

        // Note: Creating a user in auth.users typically requires Admin API or sign up
        // Here we just add to employees table. Linking to auth.users is manual or via Trigger.
        const { data, error } = await supabase
            .from('employees')
            .insert([employee])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async bulkAddEmployees(employees: any[]) {
        const { data, error } = await supabase
            .from('employees')
            .insert(employees)
            .select();

        if (error) throw error;
        return data;
    },

    async updateEmployee(id: string, updates: any) {
        const { data, error } = await supabase
            .from('employees')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteEmployee(id: string) {
        const { error } = await supabase
            .from('employees')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return id;
    },

    async bulkDeleteEmployees(ids: string[]) {
        const { error } = await supabase
            .from('employees')
            .delete()
            .in('id', ids);

        if (error) throw error;
        return ids;
    },

    // --- Orders ---
    async fetchOrders() {
        return await fetchAll('orders', '*', 'order_date', false);
    },

    // --- Orders (Bulk Delete) ---
    async bulkDeleteOrders(ids: string[]) {
        const { error } = await supabase
            .from('orders')
            .delete()
            .in('id', ids);

        if (error) throw error;
        return ids;
    },

    // --- Products (Bulk Delete) ---
    async bulkDeleteProducts(ids: string[]) {
        const { error } = await supabase
            .from('products')
            .delete()
            .in('id', ids);

        if (error) throw error;
        return ids;
    },

    // --- Employee Returns ---
    async getEmployeeReturns() {
        // Fetch all returns with related product and employee data
        const data = await fetchAll('employee_returns', '*, product:products!id(name, item_code, unit), employee:employees!id(full_name)', 'return_date', false);
        return data as import('../types').EmployeeReturn[];
    },

    async addEmployeeReturn(data: Partial<import('../types').EmployeeReturn>) {
        // 1. Add record to employee_returns
        const { data: newReturn, error } = await supabase
            .from('employee_returns')
            .insert([data])
            .select('*, product:products(name), employee:employees(full_name)')
            .single();

        if (error) throw error;

        // 2. Automatically update inventory stock (Increase quantity)
        const inboundRecord = {
            product_id: data.product_id,
            quantity: data.quantity,
            serial_code: data.serial_code,
            unit_price: data.unit_price,
            district: '',
            item_status: data.reason,
            created_by: data.created_by
        };

        await supabase.from('inbound_transactions').insert([inboundRecord]);
        sendWebhook('inbound', inboundRecord);

        return newReturn;
    },

    async bulkAddEmployeeReturns(returns: Partial<import('../types').EmployeeReturn>[]) {
        if (!returns.length) return [];

        // 1. Bulk insert returns
        const { data, error } = await supabase
            .from('employee_returns')
            .insert(returns)
            .select('*, product:products(name), employee:employees(full_name)');

        if (error) throw error;

        // 2. Bulk insert inbound transactions for stock update
        const inboundRecords = returns.map(r => ({
            product_id: r.product_id,
            quantity: r.quantity,
            serial_code: r.serial_code,
            unit_price: r.unit_price,
            district: '',
            item_status: r.reason,
            created_by: r.created_by
        }));

        await supabase.from('inbound_transactions').insert(inboundRecords);
        sendWebhook('inbound', inboundRecords);

        return data;
    },

    async getReportNumber(date: Date, receiverName: string) {
        const month = date.getMonth();
        const year = date.getFullYear();

        const startDate = new Date(year, month, 1).toISOString();
        const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        const { data, error } = await supabase
            .from('outbound_transactions')
            .select('date, group_name, receiver_group')
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: true });

        if (error) {
            console.error('Error fetching report number:', error);
            return 1;
        }

        if (!data || data.length === 0) return 1;

        const uniqueReports = new Set<string>();
        data.forEach((item: any) => {
            const d = new Date(item.date).toLocaleDateString('en-CA');
            const r = (item.group_name || item.receiver_group || '').trim().toLowerCase();
            if (r) {
                uniqueReports.add(`${d}_${r}`);
            }
        });

        const sortedUniqueReports = Array.from(uniqueReports);
        const targetKey = `${date.toLocaleDateString('en-CA')}_${receiverName.trim().toLowerCase()}`;

        const index = sortedUniqueReports.indexOf(targetKey);
        return index !== -1 ? index + 1 : sortedUniqueReports.length + 1;
    },


    async deleteEmployeeReturns(ids: string[]) {
        const { error } = await supabase
            .from('employee_returns')
            .delete()
            .in('id', ids);

        if (error) throw error;
        return ids;
    },

    // --- District Storekeepers (Settings) ---
    async getDistrictStorekeepers() {
        const { data, error } = await supabase
            .from('district_storekeepers')
            .select('*');

        if (error) throw error;
        return data as { district: string; storekeeper_name: string }[];
    },

    async upsertDistrictStorekeeper(district: string, name: string) {
        const { data, error } = await supabase
            .from('district_storekeepers')
            .upsert({ district, storekeeper_name: name })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async deleteDistrictStorekeeper(district: string) {
        const { error } = await supabase
            .from('district_storekeepers')
            .delete()
            .eq('district', district);

        if (error) throw error;
        return district;
    }
};
