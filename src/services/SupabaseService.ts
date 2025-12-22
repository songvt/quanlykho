import { supabase } from '../supabaseClient';
import type { Product, Transaction } from '../types';

export const SupabaseService = {
    // --- Products ---
    async fetchProducts(): Promise<Product[]> {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('name');

        if (error) throw error;
        return data || [];
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
        // Fetch both tables and combine


        // Fetch employees map for quick lookup (optimize if needed, but for now join logic is below)
        // Actually, let's update queries to join.

        // Refetch with join
        const { data: inboundJoined, error: errInJ } = await supabase
            .from('inbound_transactions')
            .select(`
                *,
                product:products(name, item_code)
            `)
            .order('inbound_date', { ascending: false });

        if (errInJ) throw errInJ;

        const { data: outboundJoined, error: errOutJ } = await supabase
            .from('outbound_transactions')
            .select(`
                 *,
                 product:products(name, item_code)
             `)
            .order('outbound_date', { ascending: false });

        if (errOutJ) throw errOutJ;

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
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async bulkCreateInboundTransactions(transactions: any[]) {
        const { data, error } = await supabase
            .from('inbound_transactions')
            .insert(transactions)
            .select();

        if (error) throw error;
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
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async bulkCreateOutboundTransactions(transactions: any[]) {
        const { data, error } = await supabase
            .from('outbound_transactions')
            .insert(transactions)
            .select();

        if (error) throw error;
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

        // Create a session object
        const session = {
            user: {
                id: data.auth_user_id || data.id, // Use employee ID if auth_id not present
                email: data.email,
                role: 'authenticated'
            },
            profile: data
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
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async addEmployee(employee: any) { // Type will be defined better in slice
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
    }
};
