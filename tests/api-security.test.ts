import assert from 'node:assert/strict';
import test from 'node:test';
import { getCronAuthorizationError, isCorsOriginAllowed } from '../api_handlers/_utils/httpSecurity.ts';

test('only allows configured origins in production', () => {
    const env = { NODE_ENV: 'production', CORS_ORIGINS: 'https://warehouse.example.com' } as NodeJS.ProcessEnv;
    assert.equal(isCorsOriginAllowed('https://warehouse.example.com', env), true);
    assert.equal(isCorsOriginAllowed('https://attacker.example.com', env), false);
    assert.equal(isCorsOriginAllowed('https://localhost:5173', env), false);
});

test('allows localhost origins only outside production', () => {
    const env = { NODE_ENV: 'development' } as NodeJS.ProcessEnv;
    assert.equal(isCorsOriginAllowed('https://localhost:5173', env), true);
    assert.equal(isCorsOriginAllowed('https://attacker.example.com', env), false);
});

test('requires a configured cron secret in production', () => {
    const request = { headers: {} };
    assert.deepEqual(getCronAuthorizationError(request, { NODE_ENV: 'production' }), {
        status: 503,
        error: 'CRON_SECRET is not configured',
    });
});

test('accepts only the matching cron bearer token in production', () => {
    const env = { NODE_ENV: 'production', CRON_SECRET: 'test-secret' } as NodeJS.ProcessEnv;
    assert.deepEqual(getCronAuthorizationError({ headers: {} }, env), {
        status: 401,
        error: 'Unauthorized cron invocation',
    });
    assert.equal(getCronAuthorizationError({ headers: { authorization: 'Bearer test-secret' } }, env), null);
});
