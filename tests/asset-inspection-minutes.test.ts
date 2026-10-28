import assert from 'node:assert/strict';
import test from 'node:test';
import { fixedProtectiveItems, getInspectionProtectiveItems } from '../src/utils/assetInspectionItems.ts';

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

test('filters the retired uniform items when an older inspection list is loaded', () => {
    const items = getInspectionProtectiveItems([
        ...fixedProtectiveItems,
        { name: 'Áo gió', unit: 'Chiếc' },
        { name: 'Áo thun ACT', unit: 'Chiếc' },
        { name: 'Áo sơ mi', unit: 'Chiếc' },
    ]);

    assert.deepEqual(items.map((item) => item.name), fixedProtectiveItems.map((item) => item.name));
});
