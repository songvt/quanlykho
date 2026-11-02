import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppSession } from './_utils/appSession.js';
import { canManageExamCampaigns, canViewExamCampaigns } from './_utils/examCampaignAccess.js';
import { getIdempotencyKey } from './_utils/idempotency.js';

type RequestWithSession = VercelRequest & { appSession?: AppSession };

const error = (res: VercelResponse, status: number, code: string, message: string) =>
    res.status(status).json({ error: { code, message } });

function getDatabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    // Supabase now issues sb_secret_* keys as the server-side replacement for
    // legacy service_role JWTs.  Support both during migration.
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Exam campaign database is not configured');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export default async function handler(request: RequestWithSession, response: VercelResponse) {
    const session = request.appSession;
    if (!session) return error(response, 401, 'UNAUTHORIZED', 'Yêu cầu đăng nhập lại');
    if (!canViewExamCampaigns(session)) return error(response, 403, 'FORBIDDEN', 'Bạn không có quyền truy cập phân hệ kỳ thi');

    let db;
    try { db = getDatabase(); } catch { return error(response, 503, 'SERVICE_UNAVAILABLE', 'Phân hệ kỳ thi chưa được cấu hình'); }

    const resource = text(request.query.resource) || 'campaigns';
    if (!['campaigns', 'sites', 'items', 'exports'].includes(resource)) return error(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên');

    try {
        if (request.method === 'GET') {
            if (resource === 'campaigns') {
                const { data, error: dbError } = await db.from('exam_campaigns').select('*').order('created_at', { ascending: false });
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            const campaignId = text(request.query.campaignId);
            if (!campaignId) return error(response, 422, 'VALIDATION_ERROR', 'Thiếu mã chiến dịch');
            if (resource === 'exports') {
                const { data, error: dbError } = await db.from('campaign_export_documents')
                    .select('*, campaign_export_lines(*)').eq('campaign_id', campaignId).order('created_at', { ascending: false });
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            if (resource === 'items') {
                const { data, error: dbError } = await db.from('campaign_inventory_items').select('*').eq('campaign_id', campaignId).order('item_name');
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            const { data, error: dbError } = await db.from('exam_sites').select('*').eq('campaign_id', campaignId).order('site_name');
            if (dbError) throw dbError;
            return response.status(200).json({ data });
        }

        if (!['POST', 'PATCH', 'DELETE'].includes(request.method || '')) return error(response, 405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ');
        if (!canManageExamCampaigns(session)) return error(response, 403, 'FORBIDDEN', 'Bạn không có quyền cập nhật phân hệ kỳ thi');
        if (request.method === 'DELETE') {
            if (session.role !== 'admin') return error(response, 403, 'FORBIDDEN', 'Chỉ admin được xóa dữ liệu');
            if (resource === 'exports') return error(response, 422, 'VALIDATION_ERROR', 'Phiếu xuất phải được hủy để hoàn tồn và lưu lịch sử');
            const id = text(request.body?.id);
            if (!id) return error(response, 422, 'VALIDATION_ERROR', 'Thiếu mã dữ liệu cần xóa');
            const table = resource === 'campaigns' ? 'exam_campaigns' : resource === 'sites' ? 'exam_sites' : 'campaign_inventory_items';
            const { error: dbError } = await db.from(table).delete().eq('id', id);
            if (dbError?.code === '23503') return error(response, 409, 'CONFLICT', 'Không thể xóa dữ liệu đang được sử dụng; hãy hủy chứng từ liên quan trước');
            if (dbError) throw dbError;
            return response.status(204).end();
        }

        if (resource === 'campaigns') {
            if (request.method === 'PATCH') {
                const campaignId = text(request.body?.campaignId);
                const status = text(request.body?.status);
                const campaignCode = text(request.body?.campaignCode).toUpperCase();
                const campaignName = text(request.body?.campaignName);
                if (!campaignId) return error(response, 422, 'VALIDATION_ERROR', 'Thiếu mã chiến dịch');
                if (status && !['DRAFT', 'ACTIVE', 'CLOSED'].includes(status)) return error(response, 422, 'VALIDATION_ERROR', 'Trạng thái chiến dịch không hợp lệ');
                if ((campaignCode && !campaignName) || (!campaignCode && campaignName)) return error(response, 422, 'VALIDATION_ERROR', 'Mã và tên chiến dịch phải được cập nhật cùng nhau');
                const { data, error: dbError } = await db.from('exam_campaigns')
                    .update({ ...(status ? { status } : {}), ...(campaignCode ? { campaign_code: campaignCode, campaign_name: campaignName, description: text(request.body?.description) || null } : {}), updated_at: new Date().toISOString() }).eq('id', campaignId).select().single();
                if (dbError?.code === 'PGRST116') return error(response, 404, 'NOT_FOUND', 'Không tìm thấy chiến dịch');
                if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã chiến dịch đã tồn tại');
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            const campaignCode = text(request.body?.campaignCode).toUpperCase();
            const campaignName = text(request.body?.campaignName);
            if (!campaignCode || !campaignName) return error(response, 422, 'VALIDATION_ERROR', 'Mã và tên chiến dịch là bắt buộc');
            const { data, error: dbError } = await db.from('exam_campaigns').insert({
                campaign_code: campaignCode,
                campaign_name: campaignName,
                description: text(request.body?.description) || null,
                status: 'DRAFT',
            }).select().single();
            if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã chiến dịch đã tồn tại');
            if (dbError) throw dbError;
            return response.status(201).json({ data });
        }

        if (resource === 'items') {
            if (request.method === 'PATCH') {
                if (session.role !== 'admin') return error(response, 403, 'FORBIDDEN', 'Chỉ admin được sửa vật tư');
                const id = text(request.body?.id);
                const itemCode = text(request.body?.itemCode).toUpperCase();
                const itemName = text(request.body?.itemName);
                const unit = text(request.body?.unit);
                const quantityReceived = Number(request.body?.quantityReceived);
                if (!id || !itemCode || !itemName || !unit || !Number.isFinite(quantityReceived) || quantityReceived <= 0) return error(response, 422, 'VALIDATION_ERROR', 'Thông tin vật tư hoặc số lượng không hợp lệ');
                const { data, error: dbError } = await db.from('campaign_inventory_items').update({ item_code: itemCode, item_name: itemName, unit, quantity_received: quantityReceived, serial_numbers: text(request.body?.serialNumbers) || null }).eq('id', id).select().single();
                if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã vật tư đã tồn tại trong chiến dịch');
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            const campaignId = text(request.body?.campaignId);
            const itemCode = text(request.body?.itemCode).toUpperCase();
            const itemName = text(request.body?.itemName);
            const unit = text(request.body?.unit);
            const quantityReceived = Number(request.body?.quantityReceived);
            if (!campaignId || !itemCode || !itemName || !unit || !Number.isFinite(quantityReceived) || quantityReceived <= 0) {
                return error(response, 422, 'VALIDATION_ERROR', 'Thông tin vật tư hoặc số lượng không hợp lệ');
            }
            const { data, error: dbError } = await db.from('campaign_inventory_items').insert({
                campaign_id: campaignId, item_code: itemCode, item_name: itemName, unit,
                quantity_received: quantityReceived, quantity_available: quantityReceived,
                serial_numbers: text(request.body?.serialNumbers) || null,
            }).select().single();
            if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã vật tư đã tồn tại trong chiến dịch');
            if (dbError) throw dbError;
            return response.status(201).json({ data });
        }

        if (resource === 'exports') {
            if (text(request.query.action) === 'cancel') {
                if (session.role !== 'admin') return error(response, 403, 'FORBIDDEN', 'Chỉ admin được hủy phiếu');
                const documentId = text(request.body?.documentId);
                const idempotencyKey = getIdempotencyKey(request.headers, request.body);
                if (!documentId || !idempotencyKey) return error(response, 422, 'VALIDATION_ERROR', 'Thiếu phiếu hoặc Idempotency-Key');
                const requestHash = crypto.createHash('sha256').update(JSON.stringify({ documentId })).digest('hex');
                const { data, error: dbError } = await db.rpc('cancel_campaign_export', {
                    p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_document_id: documentId, p_cancelled_by: session.id,
                });
                if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Phiếu đã hủy hoặc Idempotency-Key không hợp lệ');
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            let campaignId = text(request.body?.campaignId);
            const siteId = text(request.body?.siteId);
            const recipientEmployeeId = text(request.body?.recipientEmployeeId);
            // Older browser bundles did not include this key. Generate one on
            // the server for that one request so a stale client remains usable.
            const idempotencyKey = getIdempotencyKey(request.headers, request.body) || crypto.randomUUID();
            const lines = Array.isArray(request.body?.lines) ? request.body.lines : [];
            // Legacy clients can submit a selected site but omit campaignId.
            // The site belongs to exactly one campaign, so resolve it safely.
            if (!campaignId && siteId) {
                const { data: site, error: siteError } = await db.from('exam_sites').select('campaign_id').eq('id', siteId).maybeSingle();
                if (siteError) throw siteError;
                campaignId = text(site?.campaign_id);
            }
            if (!campaignId) return error(response, 422, 'VALIDATION_ERROR', 'Chưa chọn chiến dịch');
            if (!recipientEmployeeId) return error(response, 422, 'VALIDATION_ERROR', 'Chưa chọn nhân sự GGS nhận');
            if (!lines.length) return error(response, 422, 'VALIDATION_ERROR', 'Chưa nhập vật tư hoặc số lượng xuất');
            if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idempotencyKey)) {
                return error(response, 422, 'VALIDATION_ERROR', 'Idempotency-Key không hợp lệ');
            }
            const { data: employee } = await db.from('employees').select('id').eq('id', recipientEmployeeId).maybeSingle();
            const { data: profile } = employee ? { data: null } : await db.from('hr_profiles').select('id').eq('id', recipientEmployeeId).maybeSingle();
            if (!employee && !profile) return error(response, 422, 'VALIDATION_ERROR', 'Nhân sự nhận không tồn tại trong GGS');

            const requestHash = crypto.createHash('sha256').update(JSON.stringify({ campaignId, recipientEmployeeId, lines, siteId: siteId || null })).digest('hex');
            const documentNumber = `BBBG-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
            const { data, error: dbError } = await db.rpc('issue_campaign_export', {
                p_idempotency_key: idempotencyKey, p_request_hash: requestHash, p_document_number: documentNumber,
                p_campaign_id: campaignId, p_site_id: siteId || null,
                p_recipient_employee_id: recipientEmployeeId, p_export_date: text(request.body?.exportDate) || new Date().toISOString().slice(0, 10),
                p_notes: text(request.body?.notes) || null, p_created_by: session.id, p_lines: lines,
            });
            if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Idempotency-Key đã dùng với yêu cầu khác');
            if (dbError?.code === '22023' || dbError?.code === 'P0002') {
                return error(response, 422, 'VALIDATION_ERROR', dbError.message || 'Dữ liệu phiếu hoặc tồn kho không hợp lệ');
            }
            if (dbError) throw dbError;
            return response.status(201).json({ data });
        }

        if (resource === 'sites' && request.method === 'PATCH') {
            if (session.role !== 'admin') return error(response, 403, 'FORBIDDEN', 'Chỉ admin được sửa điểm trường');
            const id = text(request.body?.id);
            const siteCode = text(request.body?.siteCode).toUpperCase();
            const siteName = text(request.body?.siteName);
            if (!id || !siteCode || !siteName) return error(response, 422, 'VALIDATION_ERROR', 'Mã và tên điểm trường là bắt buộc');
            const { data, error: dbError } = await db.from('exam_sites').update({ site_code: siteCode, site_name: siteName, address: text(request.body?.address) || null, contact_name: text(request.body?.contactName) || null, contact_phone: text(request.body?.contactPhone) || null }).eq('id', id).select().single();
            if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã điểm trường đã tồn tại trong chiến dịch');
            if (dbError) throw dbError;
            return response.status(200).json({ data });
        }

        const campaignId = text(request.body?.campaignId);
        const siteCode = text(request.body?.siteCode).toUpperCase();
        const siteName = text(request.body?.siteName);
        if (!campaignId || !siteCode || !siteName) return error(response, 422, 'VALIDATION_ERROR', 'Chiến dịch, mã và tên điểm trường là bắt buộc');
        const { data, error: dbError } = await db.from('exam_sites').insert({
            campaign_id: campaignId, site_code: siteCode, site_name: siteName,
            address: text(request.body?.address) || null,
            contact_name: text(request.body?.contactName) || null,
            contact_phone: text(request.body?.contactPhone) || null,
        }).select().single();
        if (dbError?.code === '23505') return error(response, 409, 'CONFLICT', 'Mã điểm trường đã tồn tại trong chiến dịch');
        if (dbError) throw dbError;
        return response.status(201).json({ data });
    } catch (caught) {
        console.error('Exam campaigns API failed:', caught);
        return error(response, 500, 'INTERNAL_ERROR', 'Không thể xử lý yêu cầu phân hệ kỳ thi');
    }
}
