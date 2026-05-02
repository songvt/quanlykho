import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const { data, error } = await supabase.from('employees').select('*');
                if (!error && data) {
                    return res.status(200).json(data.map(u => {
                        const { password, ...rest } = u;
                        return { ...rest, permissions: typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions };
                    }));
                }
            } catch (e) {
                console.warn('Supabase fetch failed, falling back to GS');
            }
        }

        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'employees');

        switch (req.method) {
            case 'GET': {
                const rows = await sheet.getRows();
                const employees = rows.map(row => {
                    const obj = row.toObject();
                    delete obj.password;
                    if (obj.permissions && typeof obj.permissions === 'string') {
                        try { obj.permissions = JSON.parse(obj.permissions); } catch (e) { obj.permissions = []; }
                    }
                    return obj;
                });
                return res.status(200).json(employees);
            }

            case 'POST': {
                const { action, payload, email, password } = req.body;

                if (action === 'login') {
                    const { data, error } = await supabase.from('employees').select('*').eq('email', email).eq('password', password).single();
                    if (!error && data) {
                        const { password: _, ...user } = data;
                        return res.status(200).json({ ...user, permissions: typeof data.permissions === 'string' ? JSON.parse(data.permissions) : data.permissions });
                    }
                    const rows = await sheet.getRows();
                    const userRow = rows.find(r => r.get('email') === email && r.get('password') === password);
                    if (!userRow) return res.status(401).json({ error: 'Email hoặc mật khẩu không chính xác.' });
                    const user = userRow.toObject();
                    delete user.password;
                    return res.status(200).json(user);
                }

                const items = action === 'bulk_insert' ? payload : [payload];
                const formatted = items.map((p: any) => ({ ...p, permissions: p.permissions ? JSON.stringify(p.permissions) : '[]' }));
                let successCount = 0;

                const { data: sbData, error: sbError } = await supabase
                    .from('employees')
                    .upsert(formatted, { onConflict: 'id', ignoreDuplicates: true })
                    .select();
                if (!sbError) successCount++;

                try { await sheet.addRows(formatted); successCount++; } catch (e) { console.error('GS Mirror Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'Create failed on both databases' });
                return res.status(201).json(action === 'bulk_insert' ? (sbData || items) : (sbData ? sbData[0] : items[0]));
            }

            case 'PUT': {
                const updates = req.body;
                if (!updates.id) return res.status(400).json({ error: 'ID required' });
                let successCount = 0;
                
                const dbUpdates = { ...updates };
                if (dbUpdates.permissions) dbUpdates.permissions = JSON.stringify(dbUpdates.permissions);

                const { data: sbData, error: sbError } = await supabase.from('employees').update(dbUpdates).eq('id', updates.id).select();
                if (!sbError) successCount++;

                try {
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.get('id') === updates.id);
                    if (row) { row.assign(dbUpdates); await row.save(); successCount++; }
                } catch (e) { console.error('GS Mirror Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'Update failed on both databases' });
                return res.status(200).json(sbData ? sbData[0] : updates);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = Array.isArray(ids) ? ids : [id];
                let successCount = 0;

                const { error: sbError } = await supabase.from('employees').delete().in('id', targetIds);
                if (!sbError) successCount++;

                try {
                    const rows = await sheet.getRows();
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                    }
                    successCount++;
                } catch (e) { console.error('GS Mirror Error:', e); }

                if (successCount === 0) return res.status(500).json({ error: 'Delete failed on both databases' });
                return res.status(200).json({ message: 'Deleted', ids: targetIds });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Employees):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
