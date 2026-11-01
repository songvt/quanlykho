import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCampaignInventoryItem, validateCampaignExportLines } from '../src/utils/examCampaigns.ts';

test('normalizes a campaign inventory item without linking it to the GGS product catalog', () => {
    assert.deepEqual(
        normalizeCampaignInventoryItem({
            itemCode: '  vt-01 ',
            itemName: '  Đề thi môn Toán ',
            unit: ' Bộ ',
            quantityReceived: 24,
        }),
        {
            itemCode: 'VT-01',
            itemName: 'Đề thi môn Toán',
            unit: 'Bộ',
            quantityReceived: 24,
            serialNumbers: null,
        },
    );
});

test('rejects campaign inventory with an empty identity or a non-positive received quantity', () => {
    assert.throws(
        () => normalizeCampaignInventoryItem({ itemCode: 'VT-01', itemName: '', unit: 'Bộ', quantityReceived: 1 }),
        /tên vật tư/i,
    );
    assert.throws(
        () => normalizeCampaignInventoryItem({ itemCode: 'VT-01', itemName: 'Đề thi', unit: 'Bộ', quantityReceived: 0 }),
        /số lượng/i,
    );
});

test('rejects duplicate or non-positive lines before creating a campaign export document', () => {
    assert.throws(
        () => validateCampaignExportLines([
            { inventoryItemId: 'item-1', quantity: 1 },
            { inventoryItemId: 'item-1', quantity: 2 },
        ]),
        /trùng/i,
    );
    assert.throws(
        () => validateCampaignExportLines([{ inventoryItemId: 'item-1', quantity: 0 }]),
        /số lượng/i,
    );
});
