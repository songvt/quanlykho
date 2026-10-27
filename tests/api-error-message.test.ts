import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiErrorMessage } from '../src/services/GoogleSheetService.ts';

test('shows API error details when they are available', () => {
    assert.equal(
        getApiErrorMessage({
            error: 'Supabase HR Profiles Upsert Failed',
            details: 'duplicate key value violates unique constraint',
        }, 500, 'Internal Server Error'),
        'duplicate key value violates unique constraint'
    );
});

test('falls back to the generic API error when no details are returned', () => {
    assert.equal(
        getApiErrorMessage({ error: 'Supabase HR Profiles Upsert Failed' }, 500, 'Internal Server Error'),
        'Supabase HR Profiles Upsert Failed'
    );
});
