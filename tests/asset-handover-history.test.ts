import assert from 'node:assert/strict';
import test from 'node:test';
import { saveAssetHandoverHistory } from '../src/services/assetHandoverHistory.ts';
import { createDefaultBhlItems, formatBhlItemNote, splitBhlItemNote } from '../src/utils/assetBhlItems.ts';

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

test('formatBhlItemNote avoids duplicate size prefixes for Dép rọ', () => {
    const defaultDepRo = createDefaultBhlItems().find(i => i.name === 'Dép rọ')!;

    // Case 1: Fresh default note + shoe size 42
    const res1 = formatBhlItemNote(defaultDepRo, undefined, '42');
    assert.equal(res1, 'Size: 42 - Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo');

    // Case 2: Note already contains duplicate "Size: 42 Size: 42" from history or manual edit
    const dupItem = { ...defaultDepRo, note: 'Size: 42 Size: 42 Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo' };
    const res2 = formatBhlItemNote(dupItem, undefined, '42');
    assert.equal(res2, 'Size: 42 - Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo');

    // Case 3: Note already contains "Size: 42 - ..."
    const existingFormatted = { ...defaultDepRo, note: 'Size: 42 - Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo' };
    const res3 = formatBhlItemNote(existingFormatted, undefined, '42');
    assert.equal(res3, 'Size: 42 - Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo');

    // Case 4: No shoe size provided
    const res4 = formatBhlItemNote(defaultDepRo, undefined, '');
    assert.equal(res4, 'Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo');
});

test('splitBhlItemNote correctly isolates the size segment for bold styling', () => {
    const p1 = splitBhlItemNote('Size: 42 - Chỉ sử dụng khi thao tác dưới cống...');
    assert.ok(p1);
    assert.equal(p1.sizePart, 'Size: 42');
    assert.equal(p1.separator, ' - ');
    assert.equal(p1.rest, 'Chỉ sử dụng khi thao tác dưới cống...');

    const p2 = splitBhlItemNote('Size: 42');
    assert.ok(p2);
    assert.equal(p2.sizePart, 'Size: 42');
    assert.equal(p2.separator, '');
    assert.equal(p2.rest, '');

    const p3 = splitBhlItemNote('Size: XL - Áo thun');
    assert.ok(p3);
    assert.equal(p3.sizePart, 'Size: XL');
    assert.equal(p3.separator, ' - ');
    assert.equal(p3.rest, 'Áo thun');

    const p4 = splitBhlItemNote('Ghi chú không có size');
    assert.equal(p4, null);
});
