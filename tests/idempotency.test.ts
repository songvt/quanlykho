import assert from 'node:assert/strict';
import test from 'node:test';
import { getIdempotencyKey } from '../api_handlers/_utils/idempotency.ts';

test('uses the Idempotency-Key request header when it is present', () => {
    assert.equal(getIdempotencyKey({ 'idempotency-key': ' header-key ' }, { idempotencyKey: 'body-key' }), 'header-key');
});

test('uses the body fallback when a local proxy strips the custom header', () => {
    assert.equal(getIdempotencyKey({}, { idempotencyKey: ' body-key ' }), 'body-key');
});
