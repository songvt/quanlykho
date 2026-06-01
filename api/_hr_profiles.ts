import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase } from './_utils/supabase.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        switch (req.method) {
            case 'GET': {
                const { data: sbData, error: sbError } = await supabase.from('hr_profiles').select('*').order('created_at', { ascending: false });
                
                let gsProfiles: any[] = [];
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'hr_profiles');
                    const rows = await sheet.getRows();
                    gsProfiles = rows.map(r => {
                        const obj = r.toObject();
                        // Parse boolean
                        if (obj.insurance_participation !== undefined) {
                            obj.insurance_participation = String(obj.insurance_participation).toLowerCase() === 'true' || obj.insurance_participation === '1' || obj.insurance_participation === 1;
                        }
                        return obj;
                    });
                } catch (gsErr: any) {
                    console.warn('Google Sheets load failed for GET hr_profiles:', gsErr.message);
                }

                if (!sbError && sbData && sbData.length > 0) {
                    const sbIds = new Set(sbData.map(e => e.id));
                    const missingInSb = gsProfiles.filter(e => e.id && !sbIds.has(e.id));
                    const combined = [...sbData, ...missingInSb];
                    return res.status(200).json(combined);
                }

                if (sbError) {
                    if (gsProfiles.length > 0) {
                        return res.status(200).json(gsProfiles);
                    }
                    return res.status(500).json({ error: 'Failed to fetch HR profiles from both sources', details: sbError.message });
                }
                return res.status(200).json([]);
            }

            case 'POST': {
                const { action, payload } = req.body;
                const items = action === 'bulk_insert' ? payload : [payload];
                const formatted = items.map((p: any) => ({
                    id: String(p.id).trim(),
                    full_name: String(p.full_name).trim(),
                    gender: p.gender || 'Nam',
                    date_of_birth: p.date_of_birth || null,
                    phone_number: p.phone_number || '',
                    email: p.email || '',
                    job_position: p.job_position || '',
                    department: p.department || '',
                    probation_date: p.probation_date || null,
                    official_date: p.official_date || null,
                    contract_type: p.contract_type || '',
                    labor_status: p.labor_status || 'Đang làm việc',
                    insurance_participation: p.insurance_participation || false,
                    created_at: p.created_at || new Date().toISOString()
                }));

                const { data: sbData, error: sbError } = await supabase
                    .from('hr_profiles')
                    .upsert(formatted, { onConflict: 'id' })
                    .select();
                
                if (sbError) {
                    console.error('SB HR Profiles Upsert Error:', sbError);
                    return res.status(500).json({ error: 'Supabase HR Profiles Upsert Failed' });
                }

                // Sync to Google Sheets
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'hr_profiles');
                    await sheet.addRows(formatted);
                } catch (e: any) {
                    console.error('GS Mirror HR Profiles Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'hr_profiles',
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

                const { data: sbData, error: sbError } = await supabase.from('hr_profiles').update(updates).eq('id', updates.id).select();
                if (sbError) {
                    console.error('SB HR Profiles Update Error:', sbError);
                    return res.status(500).json({ error: 'Supabase HR Profiles Update Failed' });
                }

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'hr_profiles');
                    const rows = await sheet.getRows();
                    const row = rows.find(r => r.get('id') === updates.id);
                    if (row) { row.assign(updates); await row.save(); }
                } catch (e: any) {
                    console.error('GS Mirror HR Profiles Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'hr_profiles',
                        action: 'update',
                        payload: updates,
                        error_message: e.message
                    });
                }

                return res.status(200).json(sbData ? sbData[0] : updates);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = Array.isArray(ids) ? ids : [id];

                const { error: sbError } = await supabase.from('hr_profiles').delete().in('id', targetIds);
                if (sbError) {
                    console.error('SB HR Profiles Delete Error:', sbError);
                    return res.status(500).json({ error: 'Supabase HR Profiles Delete Failed' });
                }

                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'hr_profiles');
                    const rows = await sheet.getRows();
                    for (let i = rows.length - 1; i >= 0; i--) {
                        if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                    }
                } catch (e: any) {
                    console.error('GS Mirror HR Profiles Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'hr_profiles',
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
        console.error('API Error (HR Profiles):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
