import { VercelRequest, VercelResponse } from '@vercel/node';
import { getGoogleSheet, getSheetByTitle } from './utils/googleSheets.js';
import { supabase } from './utils/supabase.js';
import { randomUUID } from 'crypto';

const formatLocalDate = (date: Date | string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const parseLocalDate = (dateStr: any) => {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? new Date(0) : dateStr;
    const s = String(dateStr).trim();
    const parts = s.split('/');
    if (parts.length === 3) {
        const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        return isNaN(d.getTime()) ? new Date(0) : d;
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date(0) : d;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
    if (!allowedMethods.includes(req.method || '')) return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        if (req.method === 'GET') {
            try {
                const daysParam = parseInt(req.query.days as string, 10) || 60;
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - daysParam);
                const limitDateIso = limitDate.toISOString();
                
                const { data, error } = await supabase.from('orders')
                    .select('*, product:products(*)')
                    .gte('order_date', limitDateIso)
                    .order('order_date', { ascending: false });
                
                if (!error && data) return res.status(200).json(data);
            } catch (e) {
                console.warn('Supabase fetch failed, falling back to GS');
            }
        }

        const doc = await getGoogleSheet();
        const sheet = await getSheetByTitle(doc, 'orders');

        switch (req.method) {
            case 'GET': {
                const daysParam = parseInt(req.query.days as string, 10) || 60;
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() - daysParam);
                const rows = await sheet.getRows();
                return res.status(200).json(
                    rows.map(r => r.toObject())
                        .filter(r => parseLocalDate(r.order_date).getTime() >= limitDate.getTime())
                        .sort((a, b) => parseLocalDate(b.order_date).getTime() - parseLocalDate(a.order_date).getTime())
                );
            }

            case 'POST': {
                const { action, payload } = req.body;
                const items = action === 'bulk_insert' ? payload : [payload];
                const now = new Date().toISOString();
                const processed = items.map((p: any) => ({
                    ...p,
                    id: p.id || randomUUID(),
                    order_date: p.order_date || now,
                    created_at: p.created_at || now,
                    updated_at: now
                }));

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase
                    .from('orders')
                    .upsert(processed, { onConflict: 'id', ignoreDuplicates: true })
                    .select();
                const sbSuccess = !sbError;
                if (sbError) console.error('SB Write Error (Fallback to GS):', sbError);

                // 2. Sheets
                try {
                    const nowLocal = formatLocalDate(new Date());
                    const gsWritePromise = async () => {
                        await sheet.addRows(processed.map((p: any) => ({
                            ...p,
                            order_date: p.order_date ? formatLocalDate(p.order_date) : nowLocal,
                            created_at: nowLocal,
                            updated_at: nowLocal
                        })));
                    };
                    if (sbSuccess) {
                        await Promise.race([
                            gsWritePromise(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 4500))
                        ]);
                    } else {
                        await gsWritePromise();
                    }
                } catch (e: any) { 
                    console.error('GS Mirror Error:', e); 
                    if (!sbSuccess) {
                        return res.status(500).json({ error: 'Tạo đơn thất bại trên cả 2 hệ thống' });
                    } else {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'orders',
                            action: 'insert',
                            payload: processed,
                            error_message: e.message
                        });
                    }
                }

                return res.status(201).json(action === 'bulk_insert' ? (sbData || processed) : (sbData ? sbData[0] : processed[0]));
            }

            case 'PUT': {
                const { id, status, approved_by, ...rest } = req.body;
                if (!id) return res.status(400).json({ error: 'ID required' });

                // Check expiration
                if (status === 'completed') {
                    const { data: currentOrder } = await supabase.from('orders').select('*').eq('id', id).single();
                    if (currentOrder && currentOrder.status === 'approved' && currentOrder.approved_at) {
                        const approvedTime = new Date(currentOrder.approved_at).getTime();
                        if (Date.now() - approvedTime > 24 * 60 * 60 * 1000) {
                            return res.status(403).json({
                                error: 'ORDER_EXPIRED',
                                message: 'Đơn hàng đã quá hạn 24 giờ kể từ khi duyệt, không thể xuất kho!'
                            });
                        }
                    }
                }

                const updates: any = { ...rest, updated_at: new Date().toISOString() };
                if (status) {
                    updates.status = status;
                    if (status === 'approved' || status === 'rejected') {
                        if (approved_by) updates.approved_by = approved_by;
                        updates.approved_at = new Date().toISOString();
                    }
                }

                // 1. Supabase
                const { data: sbData, error: sbError } = await supabase.from('orders').update(updates).eq('id', id).select();
                const sbSuccess = !sbError;
                if (sbError) console.error('SB Update Error (Fallback to GS):', sbError);

                // 2. Sheets
                try {
                    const updatePromise = async () => {
                        const rows = await sheet.getRows();
                        const row = rows.find(r => r.get('id') === id);
                        if (row) {
                            const gsUpdates = { ...updates };
                            if (gsUpdates.approved_at) gsUpdates.approved_at = formatLocalDate(gsUpdates.approved_at);
                            gsUpdates.updated_at = formatLocalDate(new Date());
                            row.assign(gsUpdates);
                            await row.save();
                        }
                    };
                    if (sbSuccess) {
                        await Promise.race([
                            updatePromise(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                        ]);
                    } else {
                        await updatePromise();
                    }
                } catch (e: any) { 
                    console.error('GS Mirror Error:', e); 
                    if (!sbSuccess) {
                        return res.status(500).json({ error: 'Cập nhật thất bại trên cả 2 hệ thống' });
                    } else {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'orders',
                            action: 'update',
                            payload: { id, updates },
                            error_message: e.message
                        });
                    }
                }

                return res.status(200).json(sbData ? sbData[0] : updates);
            }

            case 'DELETE': {
                const { id, ids } = req.body;
                const targetIds = Array.isArray(ids) ? ids : [id];
                // 1. Supabase
                const { error: sbError } = await supabase.from('orders').delete().in('id', targetIds);
                const sbSuccess = !sbError;
                if (sbError) console.error('SB Delete Error (Fallback to GS):', sbError);

                // 2. Sheets
                try {
                    const deletePromise = async () => {
                        const rows = await sheet.getRows();
                        for (let i = rows.length - 1; i >= 0; i--) {
                            if (targetIds.includes(rows[i].get('id'))) await rows[i].delete();
                        }
                    };
                    if (sbSuccess) {
                        await Promise.race([
                            deletePromise(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('GS Sync Timeout')), 3000))
                        ]);
                    } else {
                        await deletePromise();
                    }
                } catch (e: any) { 
                    console.error('GS Mirror Error:', e); 
                    if (!sbSuccess) {
                        return res.status(500).json({ error: 'Xóa thất bại trên cả 2 hệ thống' });
                    } else {
                        await supabase.from('gs_sync_queue').insert({
                            table_name: 'orders',
                            action: 'delete',
                            payload: { ids: targetIds },
                            error_message: e.message
                        });
                    }
                }

                return res.status(200).json({ message: 'Deleted', ids: targetIds });
            }

            default: return res.status(405).json({ error: 'Method Not Allowed' });
        }
    } catch (error: any) {
        console.error('API Error (Orders):', error);
        return res.status(500).json({ error: error.message });
    }
}
