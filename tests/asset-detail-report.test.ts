import assert from 'node:assert/strict';
import test from 'node:test';
import { administrativeLandscapePrintPageMargin, administrativePageMargins, buildAssetDetailMonthlyMovement, buildAssetDetailMovementDates, getAssetConditionQuantities, getAssetDetailRowHeight, getAssetOperationalConditionQuantities, getFinalSignaturePageBreakRow, getSerialColumnWidths, signatureBlockKeepTogetherCss, sumAssetDetailTotals } from '../src/utils/assetDetailReport.ts';

test('classifies the current TBVP condition into the three report columns', () => {
    assert.deepEqual(getAssetConditionQuantities('Đang sử dụng', 1), { good: 1, damaged: 0, lost: 0 });
    assert.deepEqual(getAssetConditionQuantities('Hỏng', 1), { good: 0, damaged: 1, lost: 0 });
    assert.deepEqual(getAssetConditionQuantities('Thất thoát', 1), { good: 0, damaged: 0, lost: 1 });
});

test('uses the four operational condition columns in detailed TBVP reports', () => {
    assert.deepEqual(getAssetOperationalConditionQuantities('Đang sử dụng', 2), { using: 2, broken: 0, unused: 0, repair: 0 });
    assert.deepEqual(getAssetOperationalConditionQuantities('Chưa sử dụng', 1), { using: 0, broken: 0, unused: 1, repair: 0 });
    assert.deepEqual(getAssetOperationalConditionQuantities('Sửa chữa', 3), { using: 0, broken: 0, unused: 0, repair: 3 });
});

test('uses the new-asset date and ignores later internal transfer dates', () => {
    assert.deepEqual(buildAssetDetailMovementDates([
        { asset_code: 'TBVP-01', action: 'Tăng', created_at: '2026-10-02T08:00:00+07:00' },
        { asset_code: 'TBVP-01', action: 'Điều chuyển', created_at: '2026-10-15T08:00:00+07:00' },
    ]), { 'TBVP-01': '02/10/2026' });
});

test('counts only newly added asset codes and ignores internal transfers of existing codes', () => {
    const movement = buildAssetDetailMonthlyMovement([
        { asset_code: 'TBVP-01', action: 'Tăng' },
        { asset_code: 'TBVP-01', action: 'Điều chuyển', details: 'Điều chuyển từ [Kho] sang [A]' },
        { asset_code: 'TBVP-01', action: 'Thu hồi' },
        { asset_code: 'TBVP-01', action: 'Hỏng' },
        { asset_code: 'TBVP-02', action: 'Giảm' },
    ]);

    assert.deepEqual(movement['TBVP-01'], {
        purchased: 1,
        transferOut: 0,
        transferIn: 0,
        returnedDamaged: 0,
        returnedLost: 0,
        returnedUnused: 0,
    });
    assert.deepEqual(movement['TBVP-02'], {
        purchased: 0,
        transferOut: 0,
        transferIn: 0,
        returnedDamaged: 0,
        returnedLost: 0,
        returnedUnused: 0,
    });
});

test('sums the detailed TBVP quantities for the row directly below the header', () => {
    assert.deepEqual(sumAssetDetailTotals([
        { bookQuantity: 2, purchased: 1, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0, checkedQuantity: 2, good: 2, damaged: 0, lost: 0, difference: 0 },
        { bookQuantity: 1, purchased: 0, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0, checkedQuantity: 1, good: 0, damaged: 1, lost: 0, difference: 0 },
    ]), {
        bookQuantity: 3, purchased: 1, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0, checkedQuantity: 3, good: 2, damaged: 1, lost: 0, difference: 0,
    });
});

test('keeps the last detail rows with the TBVP signature block', () => {
    assert.equal(getFinalSignaturePageBreakRow(9, 70, 5), 65);
    assert.equal(getFinalSignaturePageBreakRow(9, 13, 5), undefined);
});

test('sizes the serial column to the longest serial instead of a fixed oversized width', () => {
    assert.deepEqual(getSerialColumnWidths(['ABC123', '5D01120PAG24C18']), { excel: 16, printPercent: 6.8, notesPercent: 4.6 });
});

test('keeps enough height for a wrapped TBVP asset type', () => {
    assert.equal(getAssetDetailRowHeight({ assetType: 'TBVP_Bàn, ghế, tủ, kệ, kết sắt' }), 54);
});

test('uses administrative document margins for TBVP exports', () => {
    assert.deepEqual(administrativePageMargins, { top: 0.79, bottom: 0.79, left: 1.18, right: 0.79, header: 0.3, footer: 0.3 });
});

test('uses administrative A4 landscape margins for printed TBVP reports', () => {
    assert.equal(administrativeLandscapePrintPageMargin, '20mm 15mm 20mm 30mm');
});

test('keeps each printed TBVP date and signature block on the same page', () => {
    assert.equal(signatureBlockKeepTogetherCss, 'break-before: avoid; page-break-before: avoid; break-inside: avoid !important; page-break-inside: avoid !important;');
});
