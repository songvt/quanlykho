export interface InspectionProtectiveItem {
    name: string;
    unit: string;
}

export const fixedProtectiveItems: InspectionProtectiveItem[] = [
    { name: 'Dây đai bảo hiểm', unit: 'Chiếc' },
    { name: 'Mũ cứng bảo hộ', unit: 'Chiếc' },
    { name: 'Quần áo bảo hộ lao động', unit: 'Bộ' },
    { name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi' },
    { name: 'Bảng tên nhân viên', unit: 'Cái' },
];

const retiredInspectionUniformNames = new Set(['Áo gió', 'Áo thun ACT', 'Áo sơ mi']);

export const getInspectionProtectiveItems = (items: InspectionProtectiveItem[] = fixedProtectiveItems) =>
    items.filter((item) => !retiredInspectionUniformNames.has(item.name));
