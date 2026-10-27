import assert from 'node:assert/strict';
import test from 'node:test';
import { WAREHOUSE_AUTO_REFRESH_MS, shouldAutoRefreshWarehouse } from '../src/pages/Inventory/warehouseRefresh.ts';

test('refreshes the warehouse only while the page is visible', () => {
    assert.equal(shouldAutoRefreshWarehouse('visible'), true);
    assert.equal(shouldAutoRefreshWarehouse('hidden'), false);
});

test('uses a five-minute warehouse refresh interval', () => {
    assert.equal(WAREHOUSE_AUTO_REFRESH_MS, 5 * 60 * 1000);
});
