import assert from 'node:assert/strict';
import test from 'node:test';
import { saveAssetHandoverHistory } from '../src/services/assetHandoverHistory.ts';

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
