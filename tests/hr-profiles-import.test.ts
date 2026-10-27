import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareHRProfileUpsert } from '../api_handlers/_utils/hrProfiles.ts';

test('prepares a bulk HR profile import with one record per employee ID', () => {
    const profiles = prepareHRProfileUpsert([
        { id: ' NV001 ', full_name: 'Nguyen Van A', department: 'Kho cu' },
        { id: 'NV002', full_name: 'Tran Thi B' },
        { id: 'NV001', full_name: 'Nguyen Van A', department: 'Kho moi' },
    ]);

    assert.equal(profiles.length, 2);
    assert.deepEqual(profiles.map(profile => profile.id), ['NV001', 'NV002']);
    assert.equal(profiles[0].department, 'Kho moi');
});

test('rejects HR profile imports without a valid employee ID and name', () => {
    assert.throws(
        () => prepareHRProfileUpsert([{ id: ' ', full_name: 'Nguyen Van A' }]),
        /Mã nhân viên không được để trống/
    );
    assert.throws(
        () => prepareHRProfileUpsert([{ id: 'NV001', full_name: ' ' }]),
        /Họ và tên không được để trống/
    );
});
