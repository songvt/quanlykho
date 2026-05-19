import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        switch (req.method) {
            case 'GET': {
                const { data: sbData, error: sbError } = await supabase.from('employees').select('*');
                
                let gsEmployees: any[] = [];
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'employees');
                    const rows = await sheet.getRows();
                    gsEmployees = rows.map(r => {
                        const obj = r.toObject();
                        if (obj.permissions && typeof obj.permissions === 'string') {
                            try { obj.permissions = JSON.parse(obj.permissions); } catch (e) { obj.permissions = []; }
                        }
                        return obj;
                    });
                } catch (gsErr: any) {
                    console.warn('Google Sheets load failed for GET employees:', gsErr.message);
                }

                if (!sbError && sbData && sbData.length > 0) {
                    const sbIds = new Set(sbData.map(e => e.id));
                    const missingInSb = gsEmployees.filter(e => e.id && !sbIds.has(e.id));
                    const combined = [...sbData, ...missingInSb].map(u => {
                        const { password, ...rest } = u;
                        return { ...rest, permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions };
                    });
                    return res.status(200).json(combined);
                }

                if (sbError) {
                    if (gsEmployees.length > 0) {
                        return res.status(200).json(gsEmployees);
                    }
                    return res.status(500).json({ error: 'Failed to fetch employees from both sources', details: sbError.message });
                }
                return res.status(200).json([]);
            }

            case 'POST': {
                const { action, payload, email, password } = req.body;

                if (action === 'login') {
                    // Try Supabase first
                    const { data, error } = await supabase.from('employees').select('*').eq('email', email).eq('password', password).single();
                    if (!error && data) {
                        const { password: _, ...user } = data;
                        try {
                            await supabase.from('qr_logs').insert([{
                                action: 'LOGIN',
                                doc_title: 'Đăng nhập hệ thống',
                                created_by: email,
                                total_serials: 0,
                                total_qrs: 0,
                                details: JSON.stringify({ ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown' })
                            }]);
                        } catch (logErr) {
                            console.error('Lỗi insert QR log khi login:', logErr);
                        }
                        return res.status(200).json({ ...user, permissions: typeof data.permissions === 'string' ? JSON.parse(data.permissions) : data.permissions });
                    }
                    
                    // Fallback to Google Sheets
                    try {
                        const doc = await getGoogleSheet();
                        const sheet = await getSheetByTitle(doc, 'employees');
                        const rows = await sheet.getRows();
                        const userRow = rows.find(r => r.get('email') === email && r.get('password') === password);
                        if (!userRow) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
                        const user = userRow.toObject();
                        delete user.password;
                        try {
                            await supabase.from('qr_logs').insert([{
                                action: 'LOGIN',
                                doc_title: 'Đăng nhập hệ thống (GS)',
                                created_by: email,
                                total_serials: 0,
                                total_qrs: 0,
                                details: JSON.stringify({ ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'Unknown' })
                            }]);
                        } catch (logErr) {
                            console.error('Lỗi insert QR log khi login GS:', logErr);
                        }
                        return res.status(200).json({ ...user, permissions: typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions });
                    } catch (gsErr: any) {
                        console.error('Google Sheets login fallback failed:', gsErr.message);
                        return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác hoặc lỗi cấu hình hệ thống.' });
                    }
                }

                const items = action === 'bulk_insert' ? payload : [payload];
                const formatted = items.map((p: any) => ({
                    ...p,
                    id: p.id || crypto.randomUUID(),
                    permissions: p.permissions ? (typeof p.permissions === 'string' ? p.permissions : JSON.stringify(p.permissions)) : '[]',
                    created_at: p.created_at || new Date().toISOString()
                }));

                const { data: sbData, error: sbError } = await supabase
                    .from('employees')
                    .upsert(formatted, { onConflict: 'id', ignoreDuplicates: true })
                    .select();
                
                if (sbError) {
                    console.error('SB Upsert Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Upsert Failed' });
                }

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'employees');
                    const writePromise = async () => {
                        await sheet.addRows(formatted);
                    };
                    await Promise.race([
                        writePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.error('GS Mirror Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'employees',
                        action: 'insert',
                        payload: formatted,
                        error_message: e.message
                    });
                }

                return res.status(201).json(action === 'bulk_insert' ? (sbData || formatted) : (sbData ? sbData[0] : formatted[0]));
            }

            case 'PUT': {
                const updates = req.body;
                if (!updates.id) return res.status(400).json({ error: 'ID required' });
                
                const dbUpdates = { ...updates };
                if (dbUpdates.permissions) dbUpdates.permissions = JSON.stringify(dbUpdates.permissions);

                const { data: sbData, error: sbError } = await supabase.from('employees').update(dbUpdates).eq('id', updates.id).select();
                if (sbError) {
                    console.error('SB Update Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Update Failed' });
                }

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'employees');
                    const updatePromise = async () => {
                        const rows = await sheet.getRows();
                        const row = rows.find(r => r.get('id') === updates.id);
                        if (row) { row.assign(dbUpdates); await row.save(); }
                    };
                    await Promise.race([
                        updatePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.error('GS Mirror Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'employees',
                        action: 'update',
                        payload: dbUpdates,
                        error_message: e.message
                    });
                }

                return res.status(200).json(sbData ? sbData[0] : updates);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = Array.isArray(ids) ? ids : [id];

                const { error: sbError } = await supabase.from('employees').delete().in('id', targetIds);
                if (sbError) {
                    console.error('SB Delete Error:', sbError);
                    return res.status(500).json({ error: 'Supabase Delete Failed' });
                }

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'employees');
                    const deletePromise = async () => {
                        const rows = await sheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                        }
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) {
                    console.error('GS Mirror Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'employees',
                        action: 'delete',
                        payload: { ids: targetIds },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ message: 'Deleted', ids: targetIds });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Employees):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
