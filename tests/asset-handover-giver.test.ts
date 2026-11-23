import assert from 'node:assert/strict';
import test from 'node:test';
import {
    getDefaultSecondGiver,
    findGiverProfile,
    filterGiverProfiles,
} from '../src/utils/assetHandoverGiver.ts';

const mockProfiles = [
    {
        id: 'NV001',
        full_name: 'Trần Việt Bắc',
        job_position: 'Chuyên viên quản lý tài sản',
        phone_number: '0901234567',
    },
    {
        id: 'NV002',
        full_name: 'Võ Thanh Song',
        job_position: 'Kỹ sư hệ thống',
        phone_number: '0988229082',
    },
];

test('defaults the second giver to Trần Việt Bắc using HR profile details', () => {
    const giver = getDefaultSecondGiver(mockProfiles);

    assert.deepEqual(giver, {
        giverName2: 'TRẦN VIỆT BẮC',
        giverTitle2: 'Chuyên viên quản lý tài sản',
        giverPhone2: '0901234567',
    });
});

test('keeps the default name and empty contact fields when the HR profile is unavailable', () => {
    assert.deepEqual(getDefaultSecondGiver([]), {
        giverName2: 'TRẦN VIỆT BẮC',
        giverTitle2: '',
        giverPhone2: '',
    });
});

test('finds HR profile by name (case-insensitive) or employee id', () => {
    const foundByName = findGiverProfile('võ thanh song', mockProfiles);
    assert.equal(foundByName?.id, 'NV002');
    assert.equal(foundByName?.full_name, 'Võ Thanh Song');

    const foundById = findGiverProfile('nv001', mockProfiles);
    assert.equal(foundById?.full_name, 'Trần Việt Bắc');

    const notFound = findGiverProfile('Unknown Person', mockProfiles);
    assert.equal(notFound, undefined);
});

test('filterGiverProfiles returns full list when input matches current selection or is empty', () => {
    // When input is empty, return all
    const allOnEmpty = filterGiverProfiles('', mockProfiles, 'TRẦN VIỆT BẮC');
    assert.equal(allOnEmpty.length, 2);

    // When input is identical to current selection, return all so dropdown shows everyone
    const allOnSelection = filterGiverProfiles('TRẦN VIỆT BẮC', mockProfiles, 'TRẦN VIỆT BẮC');
    assert.equal(allOnSelection.length, 2);

    // When typing a search query, filter matching items
    const filtered = filterGiverProfiles('song', mockProfiles, 'TRẦN VIỆT BẮC');
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].full_name, 'Võ Thanh Song');
});
