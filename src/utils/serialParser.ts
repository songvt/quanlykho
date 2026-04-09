/**
 * serialParser.ts
 * ===============
 * Bộ phân tích serial chuyên dụng cho máy quét QR/Barcode.
 *
 * Hỗ trợ:
 * - GS1-128 / GS1 DataMatrix (Application Identifiers: 21=serial, 01=GTIN, v.v.)
 * - DataMatrix không có AI (raw serial)
 * - QR Code thông thường
 * - Các mã 2D ghép liền không có phân cách
 * - Scanner vật lý USB, Bluetooth (keyboard emulation)
 *
 * Thuật toán auto-detect ghép serial:
 * 1. Tách theo ký tự phân cách chuẩn ASCII (GS/RS/EOT/FS)
 * 2. Parse GS1 Application Identifiers để lấy đúng field serial (AI 21)
 * 3. Với chuỗi dài không phân cách: thử tách theo độ dài + prefix chung
 * 4. Với chuỗi dài không phân cách: thử tách theo pattern lặp
 */

/** Ký tự phân cách chuẩn GS1 / DataMatrix */
export const SEPARATORS = {
    GS:  String.fromCharCode(29),  // ASCII 29 - Group Separator (phổ biến nhất trong GS1)
    RS:  String.fromCharCode(30),  // ASCII 30 - Record Separator
    EOT: String.fromCharCode(4),   // ASCII 4  - End of Transmission
    FS:  String.fromCharCode(28),  // ASCII 28 - File Separator
    US:  String.fromCharCode(31),  // ASCII 31 - Unit Separator
    FNC1: String.fromCharCode(232), // FNC1 character (một số scanner encode thế này)
};

/** Application Identifiers GS1 thường gặp trong IDs thiết bị viễn thông */
const GS1_AI_MAP: Record<string, string> = {
    '01': 'gtin',           // Global Trade Item Number (14 digits)
    '10': 'lot',            // Lot/Batch Number
    '11': 'prod_date',      // Production Date (YYMMDD)
    '17': 'exp_date',       // Expiration Date (YYMMDD)
    '21': 'serial',         // Serial Number ← QUAN TRỌNG NHẤT
    '240': 'add_product_id',
    '241': 'customer_part', 
    '250': 'secondary_serial',
    '251': 'ref_to_source',
    '30': 'var_count',
    '310': 'net_weight',
    '320': 'net_weight_lbs',
    '37': 'quantity',
    '410': 'ship_to',
    '420': 'ship_to_postal',
    '93': 'company_internal_1',
    '94': 'company_internal_2',
    '95': 'company_internal_3',
    '96': 'company_internal_4',
    '97': 'company_internal_5',
    '98': 'company_internal_6',
    '99': 'company_internal_7',
};

/** Known fixed-length AIs (không cần GS separator để biết kết thúc) */
const GS1_FIXED_LENGTH: Record<string, number> = {
    '01': 14,  // GTIN luôn 14 digits
    '11': 6,   // Date YYMMDD
    '13': 6,
    '15': 6,
    '17': 6,
    '310': 9, '311': 9, '312': 9, '313': 9, '314': 9,
    '315': 9, '316': 9,
    '320': 9, '321': 9,
    '410': 13, '411': 13, '412': 13, '413': 13, '414': 13,
};

export interface ParsedGS1 {
    raw: string;
    gtin?: string;
    serial?: string;
    lot?: string;
    expDate?: string;
    prodDate?: string;
    extras: Record<string, string>;
}

/**
 * Parse chuỗi GS1 DataMatrix/128 có Application Identifiers
 * VD: "\x01012345678901234\x1021ABC123" → { gtin: "2345678901234", serial: "ABC123" }
 */
export const parseGS1 = (raw: string): ParsedGS1 => {
    const result: ParsedGS1 = { raw, extras: {} };
    
    // Loại bỏ Symbology Identifier prefix nếu có (VD: ]d2, ]C1, ]Q0...)
    // nhưng giữ nguyên toàn bộ nội dung GS1 để parse AIs
    const str = raw.replace(/^\]([dC]\d|Q\d|e\d)/, '');

    
    // Tách theo GS/RS/EOT/FS
    const sepPattern = new RegExp(
        `[${SEPARATORS.GS}${SEPARATORS.RS}${SEPARATORS.EOT}${SEPARATORS.FS}${SEPARATORS.US}]`
    );
    const segments = str.split(sepPattern).filter(s => s.length > 0);
    
    for (const seg of segments) {
        let pos = 0;
        while (pos < seg.length) {
            // Thử khớp AI (2-4 chữ số)
            let aiFound = false;
            for (const aiLen of [4, 3, 2]) {
                if (pos + aiLen > seg.length) continue;
                const ai = seg.substring(pos, pos + aiLen);
                if (!/^\d+$/.test(ai)) continue;
                
                const fieldName = GS1_AI_MAP[ai];
                if (!fieldName) {
                    // AI không biết - bỏ qua tìm AI ngắn hơn
                    continue;
                }
                
                pos += aiLen;
                const fixedLen = GS1_FIXED_LENGTH[ai];
                let value: string;
                
                if (fixedLen) {
                    value = seg.substring(pos, pos + fixedLen);
                    pos += fixedLen;
                } else {
                    // Variable-length: đọc đến hết segment
                    value = seg.substring(pos);
                    pos = seg.length;
                }
                
                if (fieldName === 'serial') result.serial = value.trim();
                else if (fieldName === 'gtin') result.gtin = value.trim();
                else if (fieldName === 'lot') result.lot = value.trim();
                else if (fieldName === 'exp_date') result.expDate = value.trim();
                else if (fieldName === 'prod_date') result.prodDate = value.trim();
                else result.extras[fieldName] = value.trim();
                
                aiFound = true;
                break;
            }
            
            if (!aiFound) {
                // Không parse được AI - cả segment là serial thô
                if (!result.serial && seg.length > 0) {
                    result.serial = seg.trim();
                }
                break;
            }
        }
    }
    
    return result;
};

/**
 * Kiểm tra chuỗi có dạng GS1 không (bắt đầu bằng AI digit + có separator hoặc có symbology ID)
 */
export const isGS1Format = (text: string): boolean => {
    if (!text) return false;
    // Có ký tự phân cách ASCII đặc trưng
    if (
        text.includes(SEPARATORS.GS) ||
        text.includes(SEPARATORS.RS) ||
        text.includes(SEPARATORS.FS) ||
        text.includes(SEPARATORS.EOT)
    ) return true;
    // Bắt đầu bằng symbology identifier
    if (/^\](d2|C1|Q[0-9]|e[0-9])/.test(text)) return true;
    // Bắt đầu bằng "01" + 14 digits (GTIN pattern)
    if (/^01\d{14}/.test(text)) return true;
    // Bắt đầu bằng "(01)" GS1 human-readable format
    if (/^\(\d{2,4}\)/.test(text)) return true;
    return false;
};

/**
 * Normalize serial: loại bỏ whitespace thừa, control characters lạ.
 * GIỮ NGUYÊN các ký tự GS1 (GS/RS/FS/US/EOT) để parseGS1 xử lý sau.
 */
export const normalizeSerial = (s: string): string => {
    return s
        .trim()
        // Loại bỏ ký tự null và control chars KHÔNG phải GS1
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x03\x05-\x08\x0B\x0C\x0E-\x1B\x7F]/g, '')
        .replace(/\0/g, '');
};


/**
 * Auto-detect nhiều serial ghép liền không có phân cách.
 * 
 * Thuật toán:
 * 1. Thử chia theo độ dài cố định (8-24 ký tự)
 * 2. Kiểm tra prefix chung (dấu hiệu cùng loại serial)
 * 3. Kiểm tra pattern: tất cả chunks phải alphanumeric hợp lệ
 * 4. Nếu không có prefix chung, thử tách theo pattern lặp (các ký tự đầu lặp nhau)
 */
export const tryDetectConcatenated = (raw: string): string[] => {
    if (raw.length < 8) return [raw];
    
    // Chỉ xử lý chuỗi thuần alphanumeric + dấu thông thường
    if (!/^[A-Za-z0-9\-_.]+$/.test(raw)) return [raw];

    const results: Array<{ chunks: string[], score: number }> = [];

    // Chiến lược 1: chia theo độ dài cố định với prefix chung
    for (let len = 6; len <= Math.min(24, Math.floor(raw.length / 2)); len++) {
        if (raw.length % len !== 0) continue;
        const count = raw.length / len;
        if (count < 2 || count > 20) continue;

        const chunks: string[] = [];
        let valid = true;
        for (let i = 0; i < raw.length; i += len) {
            const chunk = raw.substring(i, i + len);
            // Chunk phải là alphanumeric hợp lệ
            if (!/^[A-Za-z0-9\-_.]+$/.test(chunk)) { valid = false; break; }
            // Chunk phải có ít nhất 1 ký tự chữ cái (tránh tách số thuần túy sai)
            if (!/[A-Za-z]/.test(chunk)) { valid = false; break; }
            chunks.push(chunk);
        }
        if (!valid || chunks.length < 2) continue;

        // Tính điểm: prefix chung dài hơn = điểm cao hơn
        let commonPrefixLen = 0;
        for (let i = 0; i < chunks[0].length; i++) {
            if (chunks.every(c => c[i] === chunks[0][i])) commonPrefixLen++;
            else break;
        }
        
        // Cần ít nhất 3 ký tự prefix chung (tránh false positive)
        if (commonPrefixLen >= 3) {
            results.push({ chunks, score: commonPrefixLen * 10 + count });
        }
    }

    // Chiến lược 2: tìm pattern lặp (sliding window)
    // VD: "ABC123DEF456" → không có prefix chung nhưng pattern rõ ràng
    if (results.length === 0 && raw.length >= 16) {
        for (let len = 8; len <= Math.floor(raw.length / 2); len++) {
            if (raw.length % len !== 0) continue;
            const count = raw.length / len;
            if (count < 2 || count > 10) continue;
            
            const chunks = Array.from({ length: count }, (_, i) => raw.substring(i * len, (i + 1) * len));
            
            // Kiểm tra format nhất quán (cùng số chữ + cùng số digit ở vị trí cụ thể)
            const firstLetterCount = (chunks[0].match(/[A-Za-z]/g) || []).length;
            const firstDigitCount = (chunks[0].match(/\d/g) || []).length;
            
            const consistent = chunks.every(c => {
                const lc = (c.match(/[A-Za-z]/g) || []).length;
                const dc = (c.match(/\d/g) || []).length;
                return Math.abs(lc - firstLetterCount) <= 1 && Math.abs(dc - firstDigitCount) <= 1;
            });
            
            if (consistent && firstLetterCount > 0 && firstDigitCount > 0) {
                results.push({ chunks, score: count });
            }
        }
    }

    if (results.length === 0) return [raw];
    
    // Chọn kết quả có điểm cao nhất (prefix chung dài nhất)
    results.sort((a, b) => b.score - a.score);
    return results[0].chunks;
};

/**
 * Hàm chính: Parse toàn bộ đầu vào từ scanner
 * 
 * Xử lý theo thứ tự ưu tiên:
 * 1. GS1 format (có AI) → lấy serial từ AI 21
 * 2. Có ký tự phân cách → split thành nhiều serial
 * 3. Chuỗi đơn dài → thử auto-detect ghép
 * 4. Chuỗi bình thường → trả về nguyên
 * 
 * @returns Mảng serial đã được normalize, unique, non-empty
 */
export const parseSerialInput = (rawInput: string): string[] => {
    if (!rawInput || rawInput.trim().length === 0) return [];
    
    const normalized = normalizeSerial(rawInput);
    if (!normalized) return [];

    let serials: string[] = [];

    // ── Bước 1: Kiểm tra GS1 format ──────────────────────────────────────
    if (isGS1Format(normalized)) {
        // Có thể là 1 GS1 đơn hoặc nhiều GS1 nối nhau
        // Tách theo Record Separator trước (từng GS1 block riêng)
        const blocks = normalized
            .split(new RegExp(`[${SEPARATORS.RS}${SEPARATORS.EOT}]`))
            .filter(b => b.length > 0);
        
        for (const block of blocks) {
            const parsed = parseGS1(block);
            if (parsed.serial) {
                // Serial từ AI 21 - đây là serial chính xác nhất
                serials.push(parsed.serial);
            } else if (parsed.gtin) {
                // Không có serial AI 21, dùng GTIN nếu có
                serials.push(parsed.gtin);
            } else if (parsed.raw && !isGS1Format(parsed.raw)) {
                // Raw string không phải GS1 → dùng nguyên
                serials.push(parsed.raw.trim());
            }
        }
        
        // Nếu không parse được AI nào → fallback sang tách thông thường
        if (serials.length === 0) {
            const stripped = normalized.replace(
                new RegExp(
                    `[${SEPARATORS.GS}${SEPARATORS.RS}${SEPARATORS.EOT}${SEPARATORS.FS}${SEPARATORS.US}]`,
                    'g'
                ),
                ' '
            ).trim();
            if (stripped) serials = [stripped];
        }
    }
    
    // ── Bước 2: Tách theo phân cách thông thường ─────────────────────────
    if (serials.length === 0) {
        const parts = normalized
            .split(/[\n\r,;|\t\s]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 2);
        
        if (parts.length > 1) {
            serials = parts;
        }
    }

    // ── Bước 3: Chuỗi đơn - thử auto-detect ghép serial ─────────────────
    if (serials.length === 0) {
        const single = normalized.trim();
        if (single.length > 25) {
            serials = tryDetectConcatenated(single);
        } else {
            serials = [single];
        }
    }

    // ── Bước 4: Với mỗi serial đã tách, thử tách thêm nếu còn dài ───────
    const finalSerials: string[] = [];
    for (const s of serials) {
        const clean = s.trim();
        if (!clean) continue;
        if (clean.length > 30 && /^[A-Za-z0-9\-_.]+$/.test(clean)) {
            const subDetected = tryDetectConcatenated(clean);
            finalSerials.push(...subDetected);
        } else {
            finalSerials.push(clean);
        }
    }

    // ── Bước 5: Lọc và unique ─────────────────────────────────────────────
    const unique = [...new Set(
        finalSerials
            .map(s => s.trim())
            .filter(s => s.length >= 2)
    )];

    return unique;
};

/**
 * Kiểm tra 2 serial có "trùng" không (case-insensitive + normalize)
 */
export const isSameSerial = (a: string, b: string): boolean => {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
};

/**
 * Lọc ra các serial mới chưa có trong danh sách
 */
export const filterNewSerials = (newOnes: string[], existing: string[]): string[] => {
    const existingLower = new Set(existing.map(s => s.trim().toLowerCase()));
    return newOnes.filter(s => !existingLower.has(s.trim().toLowerCase()));
};
