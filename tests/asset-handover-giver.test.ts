import assert from 'node:assert/strict';
import test from 'node:test';
import { getDefaultSecondGiver } from '../src/utils/assetHandoverGiver.ts';

test('defaults the second giver to Trần Việt Bắc using HR profile details', () => {
    const giver = getDefaultSecondGiver([
        {
            id: 'NV001',
            full_name: 'Trần Việt Bắc',
            job_position: 'Chuyên viên quản lý tài sản',
            phone_number: '0901234567',
        },
    ]);

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
