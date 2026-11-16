import assert from 'node:assert/strict';
import test from 'node:test';
import { saveAssetHandoverHistory } from '../src/services/assetHandoverHistory.ts';
import { createDefaultBhlItems } from '../src/utils/assetBhlItems.ts';

test('persists a handover record before printing can continue', async () => {
    const payload = { receiver_name: 'Nguyễn Văn A', items: [{ name: 'Áo gió', quantity: 1 }] };
    const savedRecord = await saveAssetHandoverHistory(payload, async () => new Response(JSON.stringify({
        success: true,
        data: { id: 'handover-1', ...payload },
    }), { status: 201 }));

    assert.equal(savedRecord.id, 'handover-1');
});

test('does not treat an unsuccessful history response as saved', async () => {
    await assert.rejects(
        () => saveAssetHandoverHistory({ receiver_name: 'Nguyễn Văn A' }, async () => new Response(JSON.stringify({
            error: 'Không thể lưu lịch sử',
        }), { status: 500 })),
        /Không thể lưu lịch sử/
    );
});

test('includes Dép rọ with unit Đôi directly after Giày Bảo Hộ Lao Động in default BHL items', () => {
    const items = createDefaultBhlItems();
    assert.equal(items.length, 12);

    const giayIndex = items.findIndex(i => i.name === 'Giày Bảo Hộ Lao Động');
    assert.ok(giayIndex >= 0);
    assert.equal(items[giayIndex].unit, 'Đôi');

    const depRoItem = items[giayIndex + 1];
    assert.equal(depRoItem.name, 'Dép rọ');
    assert.equal(depRoItem.unit, 'Đôi');
    assert.equal(depRoItem.contract, '≥ 1');
    assert.equal(depRoItem.quota, '1 Đôi/1 NV');
});
