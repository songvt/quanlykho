import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase, fetchAll } from './_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { tab } = req.query; // 'company', 'branches', 'devices', 'backup', 'restore'

    try {
        // --- 1. COMPANY INFO ---
        if (tab === 'company') {
            if (req.method === 'GET') {
                const { data, error } = await supabase
                    .from('company_info')
                    .select('*')
                    .eq('id', 1)
                    .single();
                
                if (error && error.code !== 'PGRST116') { // PGRST116 is code for 0 rows returned
                    return res.status(500).json({ error: 'Failed to fetch company info', details: error.message });
                }
                
                return res.status(200).json(data || {});
            }

            if (req.method === 'POST' || req.method === 'PUT') {
                const updates = req.body;
                const payload = {
                    id: 1,
                    name: updates.name || 'Công Ty Cổ Phần Quản Lý Kho BSG',
                    tax_code: updates.tax_code || '',
                    address: updates.address || '',
                    phone: updates.phone || '',
                    email: updates.email || '',
                    representative: updates.representative || '',
                    website: updates.website || '',
                    logo_url: updates.logo_url || '',
                    updated_at: new Date().toISOString()
                };

                const { data, error } = await supabase
                    .from('company_info')
                    .upsert(payload)
                    .select()
                    .single();

                if (error) {
                    return res.status(500).json({ error: 'Failed to save company info', details: error.message });
                }

                return res.status(200).json(data);
            }
        }

        // --- 2. BRANCHES ---
        if (tab === 'branches') {
            if (req.method === 'GET') {
                const { data, error } = await supabase
                    .from('branches')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error) {
                    return res.status(500).json({ error: 'Failed to fetch branches', details: error.message });
                }

                return res.status(200).json(data || []);
            }

            if (req.method === 'POST') {
                const payload = req.body;
                const { data, error } = await supabase
                    .from('branches')
                    .insert([{
                        name: payload.name,
                        code: payload.code,
                        address: payload.address || '',
                        phone: payload.phone || '',
                        manager_name: payload.manager_name || '',
                        status: payload.status || 'Hoạt động'
                    }])
                    .select()
                    .single();

                if (error) {
                    return res.status(500).json({ error: 'Failed to create branch', details: error.message });
                }

                return res.status(201).json(data);
            }

            if (req.method === 'PUT') {
                const { id, ...updates } = req.body;
                if (!id) return res.status(400).json({ error: 'Branch ID is required for update' });

                const { data, error } = await supabase
                    .from('branches')
                    .update({
                        ...updates,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', id)
                    .select()
                    .single();

                if (error) {
                    return res.status(500).json({ error: 'Failed to update branch', details: error.message });
                }

                return res.status(200).json(data);
            }

            if (req.method === 'DELETE') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: 'Branch ID is required for deletion' });

                const { error } = await supabase
                    .from('branches')
                    .delete()
                    .eq('id', id);

                if (error) {
                    return res.status(500).json({ error: 'Failed to delete branch', details: error.message });
                }

                return res.status(200).json({ message: 'Deleted branch successfully', id });
            }
        }

        // --- 3. LOGGED-IN DEVICES ---
        if (tab === 'devices') {
            if (req.method === 'GET') {
                const { data, error } = await supabase
                    .from('logged_in_devices')
                    .select('*')
                    .order('last_active', { ascending: false });

                if (error) {
                    return res.status(500).json({ error: 'Failed to fetch devices', details: error.message });
                }

                return res.status(200).json(data || []);
            }

            if (req.method === 'POST') {
                // Register a new device session
                const payload = req.body;
                const { data, error } = await supabase
                    .from('logged_in_devices')
                    .insert([{
                        user_id: payload.user_id,
                        email: payload.email,
                        device_name: payload.device_name || 'PC / Phone',
                        browser_name: payload.browser_name || 'Browser',
                        ip_address: payload.ip_address || '127.0.0.1',
                        last_active: new Date().toISOString()
                    }])
                    .select()
                    .single();

                if (error) {
                    return res.status(500).json({ error: 'Failed to register device session', details: error.message });
                }

                return res.status(201).json(data);
            }

            if (req.method === 'DELETE') {
                const { id } = req.body;
                if (!id) return res.status(400).json({ error: 'Device ID is required' });

                const { error } = await supabase
                    .from('logged_in_devices')
                    .delete()
                    .eq('id', id);

                if (error) {
                    return res.status(500).json({ error: 'Failed to delete device session', details: error.message });
                }

                return res.status(200).json({ message: 'Logged out device successfully', id });
            }
        }

        // --- 4. BACKUP & RESTORE ---
        if (tab === 'backup') {
            if (req.method === 'GET') {
                // Fetch tables to back up (including all business data tables)
                const [
                    companyRes,
                    branchesRes,
                    storekeepersRes,
                    productsRes,
                    employeesRes,
                    ordersRes,
                    inboundRes,
                    outboundRes,
                    returnsRes,
                    assetsRes,
                    assetLogsRes,
                    assetHandoversRes,
                    hrProfilesRes
                ] = await Promise.all([
                    supabase.from('company_info').select('*'),
                    supabase.from('branches').select('*'),
                    fetchAll('district_storekeepers'),
                    fetchAll('products'),
                    fetchAll('employees'),
                    fetchAll('orders'),
                    fetchAll('inbound_transactions'),
                    fetchAll('outbound_transactions'),
                    fetchAll('employee_returns'),
                    fetchAll('assets'),
                    fetchAll('asset_logs'),
                    fetchAll('asset_handovers'),
                    fetchAll('hr_profiles')
                ]);

                const backupData = {
                    backup_date: new Date().toISOString(),
                    version: '1.0.0',
                    company_info: companyRes.data || [],
                    branches: branchesRes.data || [],
                    district_storekeepers: storekeepersRes || [],
                    products: productsRes || [],
                    employees: employeesRes || [],
                    orders: ordersRes || [],
                    inbound_transactions: inboundRes || [],
                    outbound_transactions: outboundRes || [],
                    employee_returns: returnsRes || [],
                    assets: assetsRes || [],
                    asset_logs: assetLogsRes || [],
                    asset_handovers: assetHandoversRes || [],
                    hr_profiles: hrProfilesRes || []
                };

                return res.status(200).json(backupData);
            }
        }

        if (tab === 'restore') {
            if (req.method === 'POST') {
                const {
                    company_info, branches, district_storekeepers,
                    products, employees, orders, inbound_transactions,
                    outbound_transactions, employee_returns, assets,
                    asset_logs, asset_handovers, hr_profiles
                } = req.body;

                const restoreTable = async (table: string, records: any[]) => {
                    if (!records || records.length === 0) return;
                    const CHUNK = 500;
                    for (let i = 0; i < records.length; i += CHUNK) {
                        const chunk = records.slice(i, i + CHUNK);
                        const { error } = await supabase.from(table).upsert(chunk);
                        if (error) throw new Error(`Lỗi khôi phục bảng ${table}: ${error.message}`);
                    }
                };

                await restoreTable('company_info', company_info);
                await restoreTable('branches', branches);
                await restoreTable('district_storekeepers', district_storekeepers);
                await restoreTable('products', products);
                await restoreTable('employees', employees);
                await restoreTable('orders', orders);
                await restoreTable('inbound_transactions', inbound_transactions);
                await restoreTable('outbound_transactions', outbound_transactions);
                await restoreTable('employee_returns', employee_returns);
                await restoreTable('assets', assets);
                await restoreTable('asset_logs', asset_logs);
                await restoreTable('asset_handovers', asset_handovers);
                await restoreTable('hr_profiles', hr_profiles);

                return res.status(200).json({ success: true, message: 'Dữ liệu đã được khôi phục thành công!' });
            }
        }

        return res.status(400).json({ error: 'Invalid tab parameter' });
    } catch (error: any) {
        console.error('API Error (System Config):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
