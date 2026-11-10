// Hàm tính CRC16-CCITT (chuẩn EMVCo cho VietQR / QR ngân hàng)
function crc16Ccitt(data: string): string {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

// Hàm format trường TLV (Tag - Length - Value)
function tlv(tag: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${tag}${len}${value}`;
}

export interface VietQROptions {
    bankBin: string;       // BIN ngân hàng (MBBank: 970422)
    bankAccount: string;   // Số tài khoản
    amount?: string | number; // Số tiền (nếu có)
    message?: string;      // Nội dung chuyển khoản
}

/**
 * Sinh chuỗi payload chuẩn EMVCo / VietQR NAPAS 247
 * Hoạt động 100% offline, vẽ bằng QRCodeSVG trực tiếp không phụ thuộc internet
 */
export function buildVietQRPayload({ bankBin, bankAccount, amount, message }: VietQROptions): string {
    // Sub-tags cho Tag 38 (Merchant Account Info)
    const sub00 = tlv('00', 'A000000727'); // GUID của VietQR / NAPAS
    const sub01_00 = tlv('00', bankBin);
    const sub01_01 = tlv('01', bankAccount);
    const sub01 = tlv('01', sub01_00 + sub01_01);
    const sub02 = tlv('02', 'QRIBFTTA'); // Dịch vụ chuyển nhanh 247 tới tài khoản
    const f38 = tlv('38', sub00 + sub01 + sub02);

    const f00 = tlv('00', '01'); // Phiên bản payload
    const parsedAmount = amount ? amount.toString().replace(/[^0-9]/g, '') : '';
    const f01 = tlv('01', parsedAmount && Number(parsedAmount) > 0 ? '12' : '11'); // 12: Động (có số tiền), 11: Tĩnh
    const f53 = tlv('53', '704'); // Tiền tệ: VNĐ (704)
    const f54 = parsedAmount && Number(parsedAmount) > 0 ? tlv('54', parsedAmount) : '';
    const f58 = tlv('58', 'VN'); // Quốc gia

    // Tag 62: Additional Data (Nội dung CK ở sub-tag 08)
    let f62 = '';
    if (message) {
        // Chuẩn hóa CHỮ THƯỜNG KHÔNG DẤU theo yêu cầu
        const cleanMsg = message
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .toLowerCase()
            .trim();
        if (cleanMsg) {
            f62 = tlv('62', tlv('08', cleanMsg));
        }
    }

    let raw = `${f00}${f01}${f38}${f53}${f54}${f58}${f62}6304`;
    const crc = crc16Ccitt(raw);
    return `${raw}${crc}`;
}
