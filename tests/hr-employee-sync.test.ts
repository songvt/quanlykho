import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCDBREmployeeAccounts } from '../api_handlers/_utils/hrEmployeeSync.ts';

test('creates employee accounts only for unmatched CDBR technical HR profiles', () => {
    const accounts = buildCDBREmployeeAccounts([
        { id: 'NV001', full_name: 'Nguyen Van A', email: 'a@example.com', phone_number: '0901', department: 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn' },
        { id: 'NV002', full_name: 'Tran Thi B', email: 'b@example.com', phone_number: '0902', department: 'Phòng khác' },
        { id: 'NV003', full_name: 'Le Van C', email: 'existing@example.com', phone_number: '0903', department: 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn' },
    ], new Set(['existing@example.com']));

    assert.deepEqual(accounts, [{
        username: 'NV001',
        full_name: 'Nguyen Van A',
        email: 'a@example.com',
        phone_number: '0901',
        role: 'staff',
        password: '123456',
        must_change_password: true,
        permissions: '[]',
    }]);
});

test('skips CDBR technical profiles without an email address', () => {
    assert.deepEqual(buildCDBREmployeeAccounts([
        { id: 'NV004', full_name: 'Pham Thi D', email: '', department: 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn' },
    ], new Set()), []);
});
