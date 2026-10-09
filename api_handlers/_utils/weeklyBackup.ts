import { createClient } from '@supabase/supabase-js';
import { fetchAll, supabase } from './supabase.js';

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';

const backupStore = serviceRoleKey && supabaseUrl
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;

export const collectSystemBackup = async () => {
    const [companyRes, branchesRes, districtStorekeepers, products, employees, orders,
        inboundTransactions, outboundTransactions, employeeReturns, assets, assetLogs,
        assetHandovers, hrProfiles] = await Promise.all([
        supabase.from('company_info').select('*'),
        supabase.from('branches').select('*'),
        fetchAll('district_storekeepers'), fetchAll('products'), fetchAll('employees'),
        fetchAll('orders'), fetchAll('inbound_transactions'), fetchAll('outbound_transactions'),
        fetchAll('employee_returns'), fetchAll('assets'), fetchAll('asset_logs'),
        fetchAll('asset_handovers'), fetchAll('hr_profiles')
    ]);

    const directResults = [companyRes, branchesRes];
    const failedResult = directResults.find(result => result.error);
    if (failedResult?.error) throw failedResult.error;

    return {
        backup_date: new Date().toISOString(),
        version: '1.1.0',
        company_info: companyRes.data || [], branches: branchesRes.data || [],
        district_storekeepers: districtStorekeepers || [], products: products || [],
        employees: employees || [], orders: orders || [],
        inbound_transactions: inboundTransactions || [], outbound_transactions: outboundTransactions || [],
        employee_returns: employeeReturns || [], assets: assets || [], asset_logs: assetLogs || [],
        asset_handovers: assetHandovers || [], hr_profiles: hrProfiles || []
    };
};

export const createWeeklyBackup = async () => {
    if (!backupStore) {
        throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY; không thể lưu bản sao lưu tự động một cách an toàn.');
    }
    const payload = await collectSystemBackup();
    const { data, error } = await backupStore.from('system_backups').insert({
        backup_type: 'weekly', payload, size_bytes: Buffer.byteLength(JSON.stringify(payload), 'utf8')
    }).select('id, created_at, backup_type, size_bytes').single();
    if (error) throw error;

    // Keep the most recent 12 weekly snapshots (about three months).
    const { data: oldBackups, error: listError } = await backupStore.from('system_backups')
        .select('id').eq('backup_type', 'weekly').order('created_at', { ascending: false }).range(12, 9999);
    if (!listError && oldBackups?.length) {
        await backupStore.from('system_backups').delete().in('id', oldBackups.map(backup => backup.id));
    }
    return data;
};

export const getLatestWeeklyBackup = async () => {
    if (!backupStore) throw new Error('Thiếu SUPABASE_SERVICE_ROLE_KEY; không thể đọc bản sao lưu tự động.');
    const { data, error } = await backupStore.from('system_backups')
        .select('payload, created_at').eq('backup_type', 'weekly').order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return data;
};
