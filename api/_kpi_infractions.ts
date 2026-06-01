import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './_utils/googleSheets.js';
import { supabase, fetchAll } from './_utils/supabase.js';
import { randomUUID } from 'crypto';

interface InfractionReport {
    id: string;
    reportDate: string;
    violatorId: string;
    violatorName: string;
    violatorCode: string;
    violatorJob: string;
    violatorUnit?: string;
    violatorPhone?: string;
    inspectorId: string;
    inspectorName: string;
    inspectorCode: string;
    inspectorJob: string;
    inspectorUnit?: string;
    inspectorPhone?: string;
    supervisorName: string;
    clause: string;
    description: string;
    mitigationReq: string;
    explanation: string;
    conclusion: string;
    status: 'draft' | 'approved' | 'closed';
    createdAt?: string;
}

const mapToFrontend = (dbItem: any): InfractionReport => ({
    id: dbItem.id,
    reportDate: dbItem.report_date,
    violatorId: dbItem.violator_id,
    violatorName: dbItem.violator_name,
    violatorCode: dbItem.violator_code,
    violatorJob: dbItem.violator_job,
    violatorUnit: dbItem.violator_unit || '',
    violatorPhone: dbItem.violator_phone || '',
    inspectorId: dbItem.inspector_id,
    inspectorName: dbItem.inspector_name,
    inspectorCode: dbItem.inspector_code,
    inspectorJob: dbItem.inspector_job,
    inspectorUnit: dbItem.inspector_unit || '',
    inspectorPhone: dbItem.inspector_phone || '',
    supervisorName: dbItem.supervisor_name || '',
    clause: dbItem.clause || '',
    description: dbItem.description || '',
    mitigationReq: dbItem.mitigation_req || '',
    explanation: dbItem.explanation || '',
    conclusion: dbItem.conclusion || '',
    status: dbItem.status || 'draft',
    createdAt: dbItem.created_at
});

const mapToDatabase = (feItem: any) => ({
    id: feItem.id,
    report_date: feItem.reportDate,
    violator_id: feItem.violatorId,
    violator_name: feItem.violatorName,
    violator_code: feItem.violatorCode,
    violator_job: feItem.violatorJob,
    violator_unit: feItem.violatorUnit || '',
    violator_phone: feItem.violatorPhone || '',
    inspector_id: feItem.inspectorId,
    inspector_name: feItem.inspectorName,
    inspector_code: feItem.inspectorCode,
    inspector_job: feItem.inspectorJob,
    inspector_unit: feItem.inspectorUnit || '',
    inspector_phone: feItem.inspectorPhone || '',
    supervisor_name: feItem.supervisorName || '',
    clause: feItem.clause || '',
    description: feItem.description || '',
    mitigation_req: feItem.mitigationReq || '',
    explanation: feItem.explanation || '',
    conclusion: feItem.conclusion || '',
    status: feItem.status || 'draft'
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        if (req.method === 'GET') {
            try {
                const dbData = await fetchAll('kpi_infractions', '*', (q) => q.order('created_at', { ascending: false }));
                const feData = dbData.map(mapToFrontend);
                return res.status(200).json(feData);
            } catch (error: any) {
                console.warn('Supabase fetch failed for kpi_infractions, falling back to Google Sheets:', error);
            }
        }

        switch (req.method) {
            case 'GET': {
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'kpi_infractions');
                    const rows = await sheet.getRows();
                    const gsData = rows.map(row => {
                        const obj = row.toObject();
                        // Map GS columns to Frontend keys
                        return {
                            id: obj.id,
                            reportDate: obj.report_date || obj.reportDate,
                            violatorId: obj.violator_id || obj.violatorId,
                            violatorName: obj.violator_name || obj.violatorName,
                            violatorCode: obj.violator_code || obj.violatorCode,
                            violatorJob: obj.violator_job || obj.violatorJob,
                            violatorUnit: obj.violator_unit || obj.violatorUnit || '',
                            violatorPhone: obj.violator_phone || obj.violatorPhone || '',
                            inspectorId: obj.inspector_id || obj.inspectorId,
                            inspectorName: obj.inspector_name || obj.inspectorName,
                            inspectorCode: obj.inspector_code || obj.inspectorCode,
                            inspectorJob: obj.inspector_job || obj.inspectorJob,
                            inspectorUnit: obj.inspector_unit || obj.inspectorUnit || '',
                            inspectorPhone: obj.inspector_phone || obj.inspectorPhone || '',
                            supervisorName: obj.supervisor_name || obj.supervisorName || '',
                            clause: obj.clause || '',
                            description: obj.description || '',
                            mitigationReq: obj.mitigation_req || obj.mitigationReq || '',
                            explanation: obj.explanation || '',
                            conclusion: obj.conclusion || '',
                            status: obj.status || 'draft',
                            createdAt: obj.created_at || obj.createdAt
                        };
                    });
                    return res.status(200).json(gsData);
                } catch (gsErr: any) {
                    console.error('[KPI Infractions GET] Google Sheets fallback failed:', gsErr.message);
                    return res.status(500).json({ error: 'Failed to fetch KPI infractions from both sources' });
                }
            }

            case 'POST': {
                const { action, payload } = req.body;
                let itemsToInsert = action === 'bulk_insert' ? payload : [payload];
                
                const processedItems = itemsToInsert.map((item: any) => ({
                    ...mapToDatabase(item),
                    id: item.id || `RP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    created_at: item.createdAt || item.created_at || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }));

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase
                    .from('kpi_infractions')
                    .insert(processedItems)
                    .select();
                if (sbError) {
                    console.error('SB Write Error for KPI Infractions:', sbError);
                    return res.status(500).json({ error: 'Supabase Write Failed', details: sbError.message });
                }

                // 2. Google Sheets (Optional mirror)
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'kpi_infractions');
                    const gsWritePromise = async () => {
                        if (action === 'bulk_insert') await sheet.addRows(processedItems);
                        else await sheet.addRow(processedItems[0]);
                    };
                    await Promise.race([
                        gsWritePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 4500))
                    ]);
                } catch (e: any) { 
                    console.warn('GS Mirror KPI Infractions Error, queuing:', e.message); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'kpi_infractions',
                        action: 'insert',
                        payload: processedItems,
                        error_message: e.message
                    });
                }

                const responseData = sbData ? sbData.map(mapToFrontend) : processedItems.map(mapToFrontend);
                return res.status(201).json(action === 'bulk_insert' ? responseData : responseData[0]);
            }

            case 'PUT': {
                const feReport = req.body;
                if (!feReport.id) return res.status(400).json({ error: 'Report ID required' });
                
                const dbReport = {
                    ...mapToDatabase(feReport),
                    updated_at: new Date().toISOString()
                };

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase
                    .from('kpi_infractions')
                    .update(dbReport)
                    .eq('id', dbReport.id)
                    .select();
                if (sbError) {
                    console.error('SB Update Error for KPI Infractions:', sbError);
                    return res.status(500).json({ error: 'Supabase Update Failed' });
                }

                // 2. Google Sheets
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'kpi_infractions');
                    const updatePromise = async () => {
                        const rows = await sheet.getRows();
                        const row = rows.find(r => r.get('id') === dbReport.id);
                        if (row) { 
                            row.assign(dbReport); 
                            await row.save(); 
                        }
                    };
                    await Promise.race([
                        updatePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) { 
                    console.warn('GS Update KPI Infractions Error, queuing:', e.message); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'kpi_infractions',
                        action: 'update',
                        payload: { id: dbReport.id, updates: dbReport },
                        error_message: e.message
                    });
                }

                const resultFe = sbData ? mapToFrontend(sbData[0]) : feReport;
                return res.status(200).json(resultFe);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = ids && Array.isArray(ids) ? ids : [id];
                if (targetIds.length === 0) return res.status(400).json({ error: 'ID required' });
                
                // 1. Supabase
                const { error: sbError } = await supabase
                    .from('kpi_infractions')
                    .delete()
                    .in('id', targetIds);
                if (sbError) {
                    console.error('SB Delete Error for KPI Infractions:', sbError);
                    return res.status(500).json({ error: 'Supabase Delete Failed' });
                }

                // 2. Google Sheets
                try {
                    const doc = await getGoogleSheet();
                    const sheet = await getSheetByTitle(doc, 'kpi_infractions');
                    const deletePromise = async () => {
                        const rows = await sheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (targetIds.includes(rows[i].get('id'))) {
                                await rows[i].delete();
                            }
                        }
                    };
                    await Promise.race([
                        deletePromise(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                    ]);
                } catch (e: any) { 
                    console.warn('GS Delete KPI Infractions Error, queuing:', e.message); 
                    await supabase.from('gs_sync_queue').insert({
                        table_name: 'kpi_infractions',
                        action: 'delete',
                        payload: { ids: targetIds },
                        error_message: e.message
                    });
                }

                return res.status(200).json({ message: 'Deleted successfully', ids: targetIds });
            }

            default:
                return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (KPI Infractions):', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
