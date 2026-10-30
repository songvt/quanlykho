import assert from 'node:assert/strict';
import test from 'node:test';
import { assetMonthlyStatusColumns, calculateInspectionQuantity, calculateQuantityDifference, getPreviousReportMonth } from '../src/utils/assetMonthlyReportMath.ts';

test('calculates inspection quantity from book quantity and monthly movement', () => {
    assert.equal(calculateInspectionQuantity(19, 3, 2), 20);
});

test('calculates the difference between book and inspected quantities', () => {
    assert.equal(calculateQuantityDifference(19, 20), -1);
});

test('uses the preceding calendar month for the TBVP movement label', () => {
    assert.deepEqual(getPreviousReportMonth(10, 2026), { month: 9, year: 2026, label: '09' });
    assert.deepEqual(getPreviousReportMonth(1, 2026), { month: 12, year: 2025, label: '12' });
});

test('uses the operational TBVP condition headings from the approved report layout', () => {
    assert.deepEqual(assetMonthlyStatusColumns, ['Số lượng đang sử dụng', 'Số lượng hỏng', 'Số lượng chưa sử dụng', 'Sửa chữa/bảo dưỡng']);
});
