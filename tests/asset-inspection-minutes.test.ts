import assert from 'node:assert/strict';
import test from 'node:test';
import { fixedProtectiveItems } from '../src/utils/assetInspectionItems.ts';

test('omits the three retired uniform items from inspection minutes', () => {
    const itemNames = fixedProtectiveItems.map((item) => item.name);

    assert.deepEqual(itemNames, [
        'Dây đai bảo hiểm',
        'Mũ cứng bảo hộ',
        'Quần áo bảo hộ lao động',
        'Giày Bảo Hộ Lao Động',
        'Bảng tên nhân viên',
    ]);
});
