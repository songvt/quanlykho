import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareHRProfileUpsert, mergeHRProfiles } from '../api_handlers/_utils/hrProfiles.ts';

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

test('uses Mã NV as key: updates changed fields for existing ID and adds new ID', () => {
    const existing = [
        { id: 'NV001', full_name: 'Nguyen Van A', job_position: 'Nhan vien', district: 'Q1', created_at: '2025-01-01' }
    ];
    const imported = [
        { id: 'NV001', full_name: 'Nguyen Van A Moi', job_position: 'To truong', district: 'Q12' },
        { id: 'NV002', full_name: 'Tran Thi B', job_position: 'Ke toan', district: 'CC' }
    ];
    const { mergedList, insertedCount, updatedCount } = mergeHRProfiles(imported, existing);
    assert.equal(insertedCount, 1);
    assert.equal(updatedCount, 1);
    assert.equal(mergedList[0].full_name, 'Nguyen Van A Moi');
    assert.equal(mergedList[0].job_position, 'To truong');
    assert.equal(mergedList[0].district, 'Q12');
    assert.equal(mergedList[0].created_at, '2025-01-01');
    assert.equal(mergedList[1].id, 'NV002');
    assert.equal(mergedList[1].full_name, 'Tran Thi B');
});

test('includes district when preparing HR profile upsert', () => {
    const profiles = prepareHRProfileUpsert([
        { id: 'NV001', full_name: 'Nguyen Van A', district: 'Q12' },
        { id: 'NV002', full_name: 'Tran Thi B' },
    ]);
    assert.equal(profiles[0].district, 'Q12');
    assert.equal(profiles[1].district, '');
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
