import assert from 'node:assert/strict';
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
