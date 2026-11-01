import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { AppSession } from './_utils/appSession.js';
import { canManageExamCampaigns, canViewExamCampaigns } from './_utils/examCampaignAccess.js';

type RequestWithSession = VercelRequest & { appSession?: AppSession };

const error = (res: VercelResponse, status: number, code: string, message: string) =>
    res.status(status).json({ error: { code, message } });

function getDatabase() {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
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
    if (!['campaigns', 'sites'].includes(resource)) return error(response, 404, 'NOT_FOUND', 'Không tìm thấy tài nguyên');

    try {
        if (request.method === 'GET') {
            if (resource === 'campaigns') {
                const { data, error: dbError } = await db.from('exam_campaigns').select('*').order('created_at', { ascending: false });
                if (dbError) throw dbError;
                return response.status(200).json({ data });
            }
            const campaignId = text(request.query.campaignId);
            if (!campaignId) return error(response, 422, 'VALIDATION_ERROR', 'Thiếu mã chiến dịch');
            const { data, error: dbError } = await db.from('exam_sites').select('*').eq('campaign_id', campaignId).order('site_name');
            if (dbError) throw dbError;
            return response.status(200).json({ data });
        }

        if (request.method !== 'POST') return error(response, 405, 'METHOD_NOT_ALLOWED', 'Phương thức không được hỗ trợ');
        if (!canManageExamCampaigns(session)) return error(response, 403, 'FORBIDDEN', 'Bạn không có quyền cập nhật phân hệ kỳ thi');

        if (resource === 'campaigns') {
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
