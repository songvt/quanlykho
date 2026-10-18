import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_utils/supabase.js';
import { getGoogleSheet } from './_utils/googleSheets.js';
import { randomUUID } from 'crypto';

const backupToGoogleSheet = async (records: any[]) => {
    const doc = await getGoogleSheet();
    const title = 'periodic_asset_audits';
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
        sheet = await doc.addSheet({ title, headerValues: ['ID', 'Mã tài sản', 'Tên tài sản', 'Tình trạng', 'Vị trí', 'Người sử dụng', 'Người quản lý', 'Thời gian kiểm kê', 'Người kiểm kê', 'Ghi chú'] });
    }
    await sheet.addRows(records.map(record => ({
        ID: record.id, 'Mã tài sản': record.asset_code, 'Tên tài sản': record.asset_name,
        'Tình trạng': record.status || '', 'Vị trí': record.location_name || '',
        'Người sử dụng': record.user_employee_name || '', 'Người quản lý': record.manager_name || '',
        'Thời gian kiểm kê': record.checked_at, 'Người kiểm kê': record.checked_by || '', 'Ghi chú': record.notes || '',
    })));
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (!['GET', 'POST'].includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });
    try {
        if (req.method === 'GET') {
            const { data, error } = await supabase.from('periodic_asset_audits').select('*').order('checked_at', { ascending: false }).limit(1000);
            if (error) throw error;
            return res.status(200).json(data || []);
        }

        const inputCodes = Array.isArray(req.body?.asset_codes) ? req.body.asset_codes : [req.body?.asset_code];
        const assetCodes = [...new Set(inputCodes.map(code => String(code || '').trim().toLocaleUpperCase('vi')).filter(Boolean))];
        if (!assetCodes.length) return res.status(400).json({ error: 'Vui lòng nhập hoặc quét mã tài sản.' });
        const { data: assets, error: assetError } = await supabase
            .from('assets').select('id, asset_code, asset_name, status, location_name, user_employee_name, manager_name')
            .in('asset_code', assetCodes);
        if (assetError) throw assetError;
        if (!assets?.length) return res.status(404).json({ error: 'Không tìm thấy tài sản nào với các mã đã quét.' });

        const checkedAt = new Date().toISOString();
        const records = assets.map(asset => ({
            id: randomUUID(), asset_id: asset.id, asset_code: asset.asset_code, asset_name: asset.asset_name,
            status: asset.status || null, location_name: asset.location_name || null,
            user_employee_name: asset.user_employee_name || null, manager_name: asset.manager_name || null,
            checked_at: checkedAt, checked_by: String(req.body?.checked_by || '').trim() || null,
            notes: String(req.body?.notes || '').trim() || null,
        }));
        const { data, error } = await supabase.from('periodic_asset_audits').insert(records).select();
        if (error) throw error;
        let googleSheetBackup = true;
        try { await backupToGoogleSheet(data || records); }
        catch (backupError: any) { googleSheetBackup = false; console.error('Periodic asset audit Google Sheet backup error:', backupError); }
        const foundCodes = new Set((data || records).map(record => record.asset_code));
        return res.status(201).json({ data: data || records, missing_codes: assetCodes.filter(code => !foundCodes.has(code)), google_sheet_backup: googleSheetBackup });
    } catch (error: any) {
        console.error('Periodic asset audit API error:', error);
        return res.status(500).json({ error: error.message || 'Không thể lưu kết quả kiểm kê.' });
    }
}
