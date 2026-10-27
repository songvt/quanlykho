import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateInspectionQuantity, calculateQuantityDifference } from '../src/utils/assetMonthlyReportMath.ts';

test('calculates inspection quantity from book quantity and monthly movement', () => {
    assert.equal(calculateInspectionQuantity(19, 3, 2), 20);
});

test('calculates the difference between book and inspected quantities', () => {
    assert.equal(calculateQuantityDifference(19, 20), -1);
});
