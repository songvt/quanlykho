import type { CampaignExportDocument, CampaignExportLineInput, CampaignInventoryItem, CampaignInventoryItemInput, ExamCampaign, ExamSite } from '../types/examCampaigns';

async function request<T>(resource: 'campaigns' | 'sites' | 'items' | 'exports', init?: RequestInit, campaignId?: string, action?: string): Promise<T> {
    const query = `${campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : ''}${action ? `&action=${encodeURIComponent(action)}` : ''}`;
    const response = await fetch(`/api/exam-campaigns?resource=${resource}${query}`, {
        headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init,
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body?.error?.message || 'Không thể xử lý yêu cầu');
    return body.data as T;
}

export const listExamCampaigns = () => request<ExamCampaign[]>('campaigns');
export const createExamCampaign = (input: Pick<ExamCampaign, 'campaignCode' | 'campaignName' | 'description'>) =>
    request<ExamCampaign>('campaigns', { method: 'POST', body: JSON.stringify(input) });
export const listExamSites = (campaignId: string) => request<ExamSite[]>('sites', undefined, campaignId);
export const createExamSite = (input: Pick<ExamSite, 'campaignId' | 'siteCode' | 'siteName' | 'address' | 'contactName' | 'contactPhone'>) =>
    request<ExamSite>('sites', { method: 'POST', body: JSON.stringify(input) });
export const listCampaignInventoryItems = (campaignId: string) => request<CampaignInventoryItem[]>('items', undefined, campaignId);
export const createCampaignInventoryItem = (campaignId: string, input: CampaignInventoryItemInput) =>
    request<CampaignInventoryItem>('items', { method: 'POST', body: JSON.stringify({ campaignId, ...input }) });
export const listCampaignExports = (campaignId: string) => request<CampaignExportDocument[]>('exports', undefined, campaignId);
export const createCampaignExport = (input: { campaignId: string; siteId?: string; recipientEmployeeId: string; exportDate: string; notes?: string; lines: CampaignExportLineInput[] }) =>
    request<CampaignExportDocument>('exports', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) });
export const cancelCampaignExport = (documentId: string) => request<CampaignExportDocument>('exports', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ documentId }) }, undefined, 'cancel');
