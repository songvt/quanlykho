export interface BhlItem {
    stt: number;
    name: string;
    unit: string;
    contract: string;
    quota: string;
    quantity: number;
    spec: string;
    serial: string;
    note: string;
}

export const createDefaultBhlItems = (): BhlItem[] => [
    { stt: 1, name: 'Dây đai bảo hiểm', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Dây đai 1 móc', serial: '', note: '' },
    { stt: 2, name: 'Dây đai bảo hiểm (2 móc)', unit: 'Chiếc', contract: '0', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Bổ sung cho lực lượng trạm viễn thông thực hiện công việc trên cao.', serial: '', note: '' },
    { stt: 3, name: 'Mũ cứng bảo hộ', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Màu Trắng, có khả năng chống nóng, cách điện, tăng tính an toàn, thấm hút mồ hôi, chịu va đập cực tốt', serial: '', note: '' },
    { stt: 4, name: 'Quần áo bảo hộ lao động', unit: 'Bộ', contract: '≥ 1', quota: '3 Bộ/1 NV', quantity: 0, spec: 'Đồng phục công ty ACT', serial: '', note: '' },
    { stt: 5, name: 'Áo bảo hộ mùa đông', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
    { stt: 6, name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 0, spec: 'Giày bảo hộ chống đinh, chống va đập', serial: '', note: '' },
    { stt: 7, name: 'Dép rọ', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 0, spec: 'Dép rọ bảo hộ lao động', serial: '', note: 'Chỉ sử dụng khi thao tác dưới cống, bể hoặc di chuyển trong điều kiện trời mưa, ngập lụt; tuyệt đối không sử dụng để leo trèo' },
    { stt: 8, name: 'Bảng tên nhân viên', unit: 'Cái', contract: '≥ 1', quota: '1 Cái/1 NV', quantity: 0, spec: 'Bảng tên nhân viên', serial: '', note: '' },
    { stt: 9, name: 'Áo gió', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
    { stt: 10, name: 'Áo thun ACT', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo thun đồng phục ACT', serial: '', note: '' },
    { stt: 11, name: 'Áo sơ mi', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo sơ mi đồng phục', serial: '', note: '' },
    { stt: 12, name: 'Găng tay', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Găng tay bảo hộ lao động', serial: '', note: '' },
];
