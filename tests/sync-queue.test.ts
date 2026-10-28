import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReplacementMirror, SHEET_WRITE_CHUNK_SIZE, SHEET_WRITE_DELAY_MS, toSheetRow } from '../api_handlers/_utils/syncQueue.ts';

const row = (values: Record<string, unknown>) => ({
    get: (field: string) => values[field],
});

test('replacement mirror rejects a Sheets snapshot with different keys', () => {
    assert.throws(
        () => assertReplacementMirror([row({ id: 'current' }), row({ id: 'stale' })], [{ id: 'current' }, { id: 'expected' }], 'orders'),
        /thiếu 1 khóa/i,
    );
});

test('replacement mirror rejects duplicate Google Sheets keys', () => {
    assert.throws(
        () => assertReplacementMirror([row({ id: 'current' }), row({ id: 'current' })], [{ id: 'current' }, { id: 'next' }], 'orders'),
        /trùng hoặc rỗng/i,
    );
});

test('serializes JSON fields before writing a Google Sheets row', () => {
    const sheetRow = toSheetRow({ id: 'handover-1', giver: { name: 'Nguyễn Hải Sơn' } }, 'asset_handovers');
    assert.equal(sheetRow.giver, '{"name":"Nguyễn Hải Sơn"}');
});

test('batches large mirror replacements below the Google Sheets write quota', () => {
    const batchesForInboundSnapshot = Math.ceil(5977 / SHEET_WRITE_CHUNK_SIZE);

    assert.equal(SHEET_WRITE_CHUNK_SIZE, 250);
    assert.equal(SHEET_WRITE_DELAY_MS, 1500);
    assert.ok(batchesForInboundSnapshot < 60);
});
