export type ExamCampaignStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type CampaignExportStatus = 'ISSUED' | 'CANCELLED';

export interface ExamCampaign {
    id: string;
    campaignCode: string;
    campaignName: string;
    description: string | null;
    status: ExamCampaignStatus;
    createdAt: string;
    updatedAt: string;
}

export interface ExamSite {
    id: string;
    campaignId: string;
    siteCode: string;
    siteName: string;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
}

export interface CampaignInventoryItem {
    id: string;
    campaignId: string;
    itemCode: string;
    itemName: string;
    unit: string;
    quantityReceived: number;
    quantityAvailable: number;
    serialNumbers: string | null;
}

export interface CampaignInventoryItemInput {
    itemCode: string;
    itemName: string;
    unit: string;
    quantityReceived: number;
    serialNumbers?: string | null;
}

export interface CampaignExportLineInput {
    inventoryItemId: string;
    quantity: number;
    serialNumbers?: string | null;
}

export interface CampaignExportDocument {
    id: string;
    documentNumber: string;
    campaignId: string;
    siteId: string | null;
    recipientEmployeeId: string;
    exportDate: string;
    status: CampaignExportStatus;
    notes: string | null;
    createdBy: string;
    createdAt: string;
    lines: Array<CampaignExportLineInput & { itemName?: string; unit?: string }>;
}
