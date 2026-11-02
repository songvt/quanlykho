import type { CampaignExportDocument, CampaignExportLineInput, CampaignInventoryItem, CampaignInventoryItemInput, ExamCampaign, ExamSite } from '../types/examCampaigns';

async function request<T>(resource: 'campaigns' | 'sites' | 'items' | 'exports', init?: RequestInit, campaignId?: string, action?: string): Promise<T> {
    const query = `${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ''}${action ? `&action=${encodeURIComponent(action)}` : ''}`;
    const response = await fetch(`/api/exam-campaigns?resource=${resource}${query}`, {
        // Apply init first: spreading it after headers used to overwrite
        // Content-Type when Idempotency-Key was supplied. Express then could
        // not parse the JSON body and reported every export field as missing.
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (response.status === 204) return undefined as T;
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || 'Không thể xử lý yêu cầu');
    return body.data as T;
}

export const listExamCampaigns = () => request<ExamCampaign[]>('campaigns');
export const createExamCampaign = (input: Pick<ExamCampaign, 'campaignCode' | 'campaignName' | 'description'>) =>
    request<ExamCampaign>('campaigns', { method: 'POST', body: JSON.stringify(input) });
export const updateExamCampaignStatus = (campaignId: string, status: ExamCampaign['status']) =>
    request<ExamCampaign>('campaigns', { method: 'PATCH', body: JSON.stringify({ campaignId, status }) });
export const updateExamCampaign = (input: Pick<ExamCampaign, 'id' | 'campaignCode' | 'campaignName' | 'description'>) =>
    request<ExamCampaign>('campaigns', { method: 'PATCH', body: JSON.stringify(input) });
export const deleteExamCampaign = (id: string) => request<void>('campaigns', { method: 'DELETE', body: JSON.stringify({ id }) });
export const listExamSites = (campaignId: string) => request<ExamSite[]>('sites', undefined, campaignId);
export const createExamSite = (input: Pick<ExamSite, 'campaignId' | 'siteCode' | 'siteName' | 'address' | 'contactName' | 'contactPhone'>) =>
    request<ExamSite>('sites', { method: 'POST', body: JSON.stringify(input) });
export const updateExamSite = (input: Omit<ExamSite, 'campaignId'>) => request<ExamSite>('sites', { method: 'PATCH', body: JSON.stringify(input) });
export const deleteExamSite = (id: string) => request<void>('sites', { method: 'DELETE', body: JSON.stringify({ id }) });
export const listCampaignInventoryItems = (campaignId: string) => request<CampaignInventoryItem[]>('items', undefined, campaignId);
export const createCampaignInventoryItem = (campaignId: string, input: CampaignInventoryItemInput) =>
    request<CampaignInventoryItem>('items', { method: 'POST', body: JSON.stringify({ campaignId, ...input }) });
export const updateCampaignInventoryItem = (input: CampaignInventoryItem) => request<CampaignInventoryItem>('items', { method: 'PATCH', body: JSON.stringify(input) });
export const deleteCampaignInventoryItem = (id: string) => request<void>('items', { method: 'DELETE', body: JSON.stringify({ id }) });
export const listCampaignExports = (campaignId: string) => request<CampaignExportDocument[]>('exports', undefined, campaignId);
const createIdempotencyKey = () => crypto.randomUUID();

export const createCampaignExport = (input: { campaignId: string; siteId?: string; recipientEmployeeId: string; exportDate: string; notes?: string; lines: CampaignExportLineInput[] }) => {
    const idempotencyKey = createIdempotencyKey();
    // Keep the header for standard HTTP clients, and include the same value in
    // the body as a safe fallback for local proxies that strip custom headers.
    return request<CampaignExportDocument>('exports', {
        method: 'POST', headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...input, idempotencyKey }),
    });
};
export const cancelCampaignExport = (documentId: string) => {
    const idempotencyKey = createIdempotencyKey();
    return request<CampaignExportDocument>('exports', {
        method: 'POST', headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ documentId, idempotencyKey }),
    }, undefined, 'cancel');
};
