import type { CampaignExportLineInput, CampaignInventoryItemInput } from '../types/examCampaigns';

function requireText(value: string, label: string): string {
    const normalized = value.trim();
    if (!normalized) throw new Error(`${label} không được để trống`);
    return normalized;
}

function requirePositiveQuantity(value: number, label: string): number {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} phải lớn hơn 0`);
    return value;
}

export function normalizeCampaignInventoryItem(input: CampaignInventoryItemInput): Required<CampaignInventoryItemInput> {
    return {
        itemCode: requireText(input.itemCode, 'Mã vật tư').toUpperCase(),
        itemName: requireText(input.itemName, 'Tên vật tư'),
        unit: requireText(input.unit, 'Đơn vị tính'),
        quantityReceived: requirePositiveQuantity(input.quantityReceived, 'Số lượng'),
        serialNumbers: input.serialNumbers?.trim() || null,
    };
}

export function validateCampaignExportLines(lines: CampaignExportLineInput[]): CampaignExportLineInput[] {
    if (!lines.length) throw new Error('Chọn ít nhất một vật tư để xuất');

    const inventoryItemIds = new Set<string>();
    return lines.map((line) => {
        const inventoryItemId = requireText(line.inventoryItemId, 'Vật tư');
        if (inventoryItemIds.has(inventoryItemId)) throw new Error('Không được xuất trùng vật tư trong cùng một phiếu');
        inventoryItemIds.add(inventoryItemId);

        return {
            inventoryItemId,
            quantity: requirePositiveQuantity(line.quantity, 'Số lượng xuất'),
            serialNumbers: line.serialNumbers?.trim() || null,
        };
    });
}
