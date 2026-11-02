import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createAppSession, verifyAppSession } from '../api_handlers/_utils/appSession.ts';

const secret = 'test-secret-that-is-long-enough-to-sign-a-session';
const user = { id: 'employee-1', email: 'staff@example.com', role: 'staff', permissions: ['inventory.view'] };

test('creates a signed session that preserves the user identity and permissions', () => {
    const token = createAppSession(user, secret, 60);
    assert.deepEqual(verifyAppSession(token, secret), user);
});

test('rejects a session whose signature was modified', () => {
    const token = createAppSession(user, secret, 60);
    assert.equal(verifyAppSession(`${token}x`, secret), null);
});

test('rejects an expired session', () => {
    const token = createAppSession(user, secret, -1);
    assert.equal(verifyAppSession(token, secret), null);
});

test('keeps the bearer token compact when an employee profile contains a signature image', () => {
    const profileWithSignature = { ...user, signature_data: 'x'.repeat(16_000) };
    const token = createAppSession(profileWithSignature, secret, 60);

    assert.ok(token.length < 1_000);
    assert.deepEqual(verifyAppSession(token, secret), user);
});

import { isSessionTokenExpired } from '../src/services/apiSessionFetch.ts';

test('isSessionTokenExpired identifies valid vs expired tokens client-side', () => {
    const validToken = createAppSession(user, secret, 3600);
    const expiredToken = createAppSession(user, secret, -1);
    
    assert.equal(isSessionTokenExpired(validToken), false);
    assert.equal(isSessionTokenExpired(expiredToken), true);
    assert.equal(isSessionTokenExpired(undefined), true);
    assert.equal(isSessionTokenExpired(''), true);
    assert.equal(isSessionTokenExpired('invalid-token'), true);
});

test('isSessionTokenExpired rejects oversized legacy bearer tokens before an API request', () => {
    const payload = Buffer.from(JSON.stringify({ ...user, signature_data: 'x'.repeat(16_000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');

    assert.equal(isSessionTokenExpired(`${payload}.${signature}`), true);
});
