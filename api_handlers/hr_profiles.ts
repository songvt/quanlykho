import { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase } from './_utils/supabase.js';
import { prepareHRProfileUpsert, mergeHRProfiles } from './_utils/hrProfiles.js';
import { buildCDBREmployeeAccounts, CDBR_TECHNICAL_UNIT } from './_utils/hrEmployeeSync.js';

async function syncCDBREmployeeAccounts(profiles: Record<string, unknown>[]) {
    const candidateEmails = [...new Set(profiles
        .filter(profile => String(profile.department ?? '').trim() === CDBR_TECHNICAL_UNIT)
        .map(profile => String(profile.email ?? '').trim().toLowerCase())
        .filter(Boolean))];
    if (candidateEmails.length === 0) return 0;

    const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('email')
        .in('email', candidateEmails);
    if (employeesError) throw employeesError;

    const accounts = buildCDBREmployeeAccounts(
        profiles,
        new Set((employees || []).map(employee => String(employee.email ?? '').trim().toLowerCase())),
    );
    if (accounts.length === 0) return 0;

    const { error: upsertError } = await supabase
        .from('employees')
        .upsert(accounts.map(account => ({ ...account, id: randomUUID() })), { onConflict: 'email', ignoreDuplicates: true });
    if (upsertError) throw upsertError;

    return accounts.length;
}

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
                if (action === 'sync_cdbr_employees') {
                    const { data: profiles, error: profilesError } = await supabase
                        .from('hr_profiles')
                        .select('id, full_name, email, phone_number, department')
                        .eq('department', CDBR_TECHNICAL_UNIT);
                    if (profilesError) throw profilesError;

                    const synced = await syncCDBREmployeeAccounts(profiles || []);
                    return res.status(200).json({ synced });
                }

                const items = action === 'bulk_insert' ? payload : [payload];
                let formatted: Record<string, unknown>[];
                try {
                    formatted = prepareHRProfileUpsert(items);
                } catch (error: any) {
                    return res.status(400).json({ error: error.message });
                }

                // 1. Fetch existing profiles matching Mã NV (id) to detect updates vs new inserts
                const targetIds = formatted.map(item => String(item.id));
                const { data: existingRecords, error: fetchError } = await supabase
                    .from('hr_profiles')
                    .select('*')
                    .in('id', targetIds);
                if (fetchError) {
                    console.error('Fetch existing HR profiles error:', fetchError);
                }

                // 2. Merge changes for existing IDs; insert new records for non-existing IDs
                const { mergedList, insertedCount, updatedCount } = mergeHRProfiles(
                    formatted,
                    (existingRecords || []) as Record<string, unknown>[]
                );

                // 3. Upsert into Supabase with Mã NV (id) as primary key
                const { data: sbData, error: sbError } = await supabase
                    .from('hr_profiles')
                    .upsert(mergedList, { onConflict: 'id' })
                    .select();
                
                if (sbError) {
                    console.error('SB HR Profiles Upsert Error:', sbError);
                    return res.status(500).json({
                        error: 'Supabase HR Profiles Upsert Failed',
                        details: sbError.message,
                    });
                }

                try {
                    await syncCDBREmployeeAccounts((sbData || mergedList) as Record<string, unknown>[]);
                } catch (employeeSyncError) {
                    console.error('CDBR employee account sync failed:', employeeSyncError);
                    return res.status(500).json({ error: 'HR profile saved but employee account sync failed' });
                }

                // 4. Batch sync to Google Sheets (prevents 429 quota rate limit errors)
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'hr_profiles');
                    await sheet.loadHeaderRow();
                    const colKeys = sheet.headerValues;
                    const rows = await sheet.getRows();
                    const rowCount = rows.length;

                    const existingRowMap = new Map<string, number>();
                    rows.forEach((r, idx) => {
                        const id = String(r.get('id') ?? '').trim();
                        if (id) existingRowMap.set(id, idx);
                    });

                    const rowsToAdd: Record<string, unknown>[] = [];
                    const rowsToUpdate: { rowIndex: number; item: Record<string, unknown> }[] = [];

                    for (const item of mergedList) {
                        const id = String(item.id ?? '').trim();
                        if (existingRowMap.has(id)) {
                            rowsToUpdate.push({ rowIndex: existingRowMap.get(id)!, item });
                        } else {
                            rowsToAdd.push(item);
                        }
                    }

                    if (rowsToAdd.length > 0) {
                        await sheet.addRows(rowsToAdd);
                    }

                    if (rowsToUpdate.length > 0 && rowCount > 0) {
                        await sheet.loadCells({
                            startRowIndex: 1,
                            endRowIndex: rowCount + 1,
                            startColumnIndex: 0,
                            endColumnIndex: colKeys.length
                        });

                        let cellChanged = false;
                        for (const { rowIndex, item } of rowsToUpdate) {
                            for (let c = 0; c < colKeys.length; c++) {
                                const key = colKeys[c];
                                if (key in item) {
                                    const cell = sheet.getCell(rowIndex + 1, c);
                                    let val = item[key];
                                    if (typeof val === 'boolean') val = val ? 'TRUE' : 'FALSE';
                                    else if (val === null || val === undefined) val = '';
                                    else val = String(val);

                                    if (String(cell.value ?? '') !== String(val)) {
                                        cell.value = val;
                                        cellChanged = true;
                                    }
                                }
                            }
                        }
                        if (cellChanged) {
                            await sheet.saveUpdatedCells();
                        }
                    }
                } catch (e: any) {
                    console.error('GS Mirror HR Profiles Error, queuing:', e.message);
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'hr_profiles',
                        action: 'upsert',
                        payload: mergedList,
                        error_message: e.message
                    });
                }

                return res.status(201).json({
                    data: action === 'bulk_insert' ? (sbData || mergedList) : (sbData ? sbData[0] : mergedList[0]),
                    inserted: insertedCount,
                    updated: updatedCount,
                    total: mergedList.length
                });
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
                    await syncCDBREmployeeAccounts((sbData || []) as Record<string, unknown>[]);
                } catch (employeeSyncError) {
                    console.error('CDBR employee account sync failed:', employeeSyncError);
                    return res.status(500).json({ error: 'HR profile updated but employee account sync failed' });
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
