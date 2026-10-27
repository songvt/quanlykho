import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeImportedDate } from '../src/utils/dateUtils.ts';

test('converts an Excel date serial to an ISO date for database import', () => {
    assert.equal(normalizeImportedDate(38282), '2004-10-22');
    assert.equal(normalizeImportedDate('38282'), '2004-10-22');
});

test('keeps supported date values in ISO format', () => {
    assert.equal(normalizeImportedDate('22/10/2004'), '2004-10-22');
    assert.equal(normalizeImportedDate('2004-10-22'), '2004-10-22');
});
