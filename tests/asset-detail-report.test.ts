import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAssetDetailMonthlyMovement, buildAssetDetailMovementDates, getAssetConditionQuantities } from '../src/utils/assetDetailReport.ts';

test('classifies the current TBVP condition into the three report columns', () => {
    assert.deepEqual(getAssetConditionQuantities('Đang sử dụng', 1), { good: 1, damaged: 0, lost: 0 });
    assert.deepEqual(getAssetConditionQuantities('Hỏng', 1), { good: 0, damaged: 1, lost: 0 });
    assert.deepEqual(getAssetConditionQuantities('Thất thoát', 1), { good: 0, damaged: 0, lost: 1 });
});

test('uses the latest monthly log date in the movement date column', () => {
    assert.deepEqual(buildAssetDetailMovementDates([
        { asset_code: 'TBVP-01', created_at: '2026-10-02T08:00:00+07:00' },
        { asset_code: 'TBVP-01', created_at: '2026-10-15T08:00:00+07:00' },
    ]), { 'TBVP-01': '15/10/2026' });
});

test('maps monthly asset logs to the detailed TBVP movement columns', () => {
    const movement = buildAssetDetailMonthlyMovement([
        { asset_code: 'TBVP-01', action: 'Tăng' },
        { asset_code: 'TBVP-01', action: 'Điều chuyển', details: 'Điều chuyển từ [Kho] sang [A]' },
        { asset_code: 'TBVP-01', action: 'Thu hồi' },
        { asset_code: 'TBVP-01', action: 'Hỏng' },
        { asset_code: 'TBVP-02', action: 'Giảm' },
    ]);

    assert.deepEqual(movement['TBVP-01'], {
        purchased: 1,
        transferOut: 1,
        transferIn: 0,
        returnedDamaged: 1,
        returnedLost: 0,
        returnedUnused: 1,
    });
    assert.equal(movement['TBVP-02'].returnedLost, 1);
});
