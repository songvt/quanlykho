import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmployeeDistrict } from '../src/utils/employeeDistrict.ts';

test('uses the employee identifier before falling back to a normalized name', () => {
    const district = resolveEmployeeDistrict(
        { id: 'NV001', name: 'Nguyễn Văn A' },
        [
            { id: 'NV001', full_name: 'Người khác', district: 'Quận 1' },
            { id: 'NV002', full_name: ' Nguyễn  Văn A ', district: 'Quận 3' },
        ],
    );

    assert.equal(district, 'Quận 1');
});

test('matches a district by normalized employee name when identifiers differ', () => {
    const district = resolveEmployeeDistrict(
        { id: 'HR-42', name: 'Đặng Văn Nhịn' },
        [{ id: 'EMP-42', full_name: 'đặng   văn nhịn', district: 'Bình Thạnh' }],
    );

    assert.equal(district, 'Bình Thạnh');
});
