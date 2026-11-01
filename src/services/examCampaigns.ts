import type { ExamCampaign, ExamSite } from '../types/examCampaigns';

async function request<T>(resource: 'campaigns' | 'sites', init?: RequestInit, campaignId?: string): Promise<T> {
    const query = campaignId ? `&campaignId=${encodeURIComponent(campaignId)}` : '';
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
