/**
 * serialParser.ts
 * ===============
 * Bộ phân tích và trích xuất serial chuyên dụng cho máy quét QR/Barcode.
 *
 * Hỗ trợ toàn diện:
 * - GS1-128 / GS1 DataMatrix (Application Identifiers: 21=serial, 01=GTIN, v.v.)
 * - GS1 dạng ngoặc đơn human-readable: (01)...(21)SERIAL
 * - Đọc và tách nhiều serial trong 1 mã GS1 (AI 21 xuất hiện nhiều lần)
 * - Tự động tách serial chùm (nhiều serial phân cách bởi xuống dòng, phẩy, chấm phẩy, tab, pipe, gạch chéo, v.v.)
 * - Tự động mở rộng dải số tuần tự (VD: VNPT00000001 - VNPT00000005 -> bung 5 serial)
 * - Tự động bóc tách từ tem nhãn đa dòng (lọc lấy dòng SN / S/N, loại bỏ nhãn rác như MODEL:, MAC:, PN:)
 * - Hỗ trợ mã QR dạng JSON chứa danh sách serial
 * - Hỗ trợ mã QR dạng URL (trích xuất tham số sn, serial, code hoặc path)
 * - Tự động phát hiện và chia chuỗi dài ghép liền không phân cách (Concatenated Serials)
 * - Scanner vật lý USB, Bluetooth (keyboard emulation)
 */

/** Ký tự phân cách chuẩn GS1 / DataMatrix */
export const SEPARATORS = {
    GS:  String.fromCharCode(29),  // ASCII 29 - Group Separator (phổ biến nhất trong GS1)
    RS:  String.fromCharCode(30),  // ASCII 30 - Record Separator
    EOT: String.fromCharCode(4),   // ASCII 4  - End of Transmission
    FS:  String.fromCharCode(28),  // ASCII 28 - File Separator
    US:  String.fromCharCode(31),  // ASCII 31 - Unit Separator
    FNC1: String.fromCharCode(232), // FNC1 character
};

/** Application Identifiers GS1 thường gặp trong IDs thiết bị viễn thông & tài sản */
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

/** Các từ khóa tiền tố nhãn thông tin cần bỏ qua, không được coi là serial */
const IGNORED_LABEL_KEYWORDS = new Set([
    'sn', 's/n', 'sn:', 's/n:', 'serial', 'serial:', 'ser', 'ser:', 'serial no', 'serial no:',
    'mac', 'mac:', 'mac address', 'mac-address', 'pn', 'p/n', 'pn:', 'p/n:', 'part no', 'part no:',
    'model', 'model:', 'imei', 'imei:', 'imei1', 'imei2', 'gpon', 'gpon:', 'pon', 'pon:',
    'item', 'item:', 'no', 'no:', 'qty', 'quantity', 'date', 'hw', 'sw', 'ip',
    'vendor', 'manufacture', 'rev', 'version', 'type', 'id', 'code', 'batch'
]);

export interface ParsedGS1 {
    raw: string;
    gtin?: string;
    serial?: string;
    serials?: string[];
    lot?: string;
    expDate?: string;
    prodDate?: string;
    extras: Record<string, string>;
}

/**
 * Chuẩn hóa chuỗi serial thô: loại bỏ null và control characters không phải GS1.
 */
export const normalizeSerial = (s: string): string => {
    return s
        .trim()
        .replace(/[\x00-\x03\x05-\x08\x0B\x0C\x0E-\x1B\x7F]/g, '')
        .replace(/\0/g, '');
};

/**
 * Kiểm tra chuỗi có định dạng GS1 không
 */
export const isGS1Format = (text: string): boolean => {
    if (!text) return false;
    if (
        text.includes(SEPARATORS.GS) ||
        text.includes(SEPARATORS.RS) ||
        text.includes(SEPARATORS.FS) ||
        text.includes(SEPARATORS.EOT)
    ) return true;
    if (/^\](d2|C1|Q[0-9]|e[0-9])/.test(text)) return true;
    if (/^01\d{14}/.test(text)) return true;
    if (/^\(\d{2,4}\)/.test(text)) return true;
    return false;
};

/**
 * Phân tích chuỗi GS1 (hỗ trợ cả chuẩn ASCII separator và human-readable có ngoặc đơn)
 */
export const parseGS1 = (raw: string): ParsedGS1 => {
    const result: ParsedGS1 = { raw, extras: {} };
    const str = raw.replace(/^\]([dC]\d|Q\d|e\d)/, '');

    // Trường hợp 1: GS1 dạng ngoặc đơn (01)12345678901234(21)SN123456
    if (/\(\d{2,4}\)/.test(str)) {
        const parenRegex = /\((\d{2,4})\)([^(]+)/g;
        let m: RegExpExecArray | null;
        const allSerials: string[] = [];
        while ((m = parenRegex.exec(str)) !== null) {
            const ai = m[1];
            const val = m[2].trim();
            const field = GS1_AI_MAP[ai];
            if (field === 'serial') {
                allSerials.push(val);
            } else if (field === 'gtin') {
                result.gtin = val;
            } else if (field === 'lot') {
                result.lot = val;
            } else if (field === 'exp_date') {
                result.expDate = val;
            } else if (field === 'prod_date') {
                result.prodDate = val;
            } else if (field) {
                result.extras[field] = val;
            }
        }
        if (allSerials.length > 0) {
            result.serials = allSerials;
            result.serial = allSerials[0];
            return result;
        }
    }

    // Trường hợp 2: GS1 dạng phân cách chuẩn ASCII (GS, RS, EOT, FS, US)
    const sepPattern = new RegExp(
        `[${SEPARATORS.GS}${SEPARATORS.RS}${SEPARATORS.EOT}${SEPARATORS.FS}${SEPARATORS.US}]`
    );
    const segments = str.split(sepPattern).filter(s => s.length > 0);
    const allSerials: string[] = [];

    for (const seg of segments) {
        let pos = 0;
        while (pos < seg.length) {
            let aiFound = false;
            for (const aiLen of [4, 3, 2]) {
                if (pos + aiLen > seg.length) continue;
                const ai = seg.substring(pos, pos + aiLen);
                if (!/^\d+$/.test(ai)) continue;

                const fieldName = GS1_AI_MAP[ai];
                if (!fieldName) continue;

                pos += aiLen;
                const fixedLen = GS1_FIXED_LENGTH[ai];
                let value: string;

                if (fixedLen) {
                    value = seg.substring(pos, pos + fixedLen);
                    pos += fixedLen;
                } else {
                    value = seg.substring(pos);
                    pos = seg.length;
                }

                if (fieldName === 'serial') allSerials.push(value.trim());
                else if (fieldName === 'gtin') result.gtin = value.trim();
                else if (fieldName === 'lot') result.lot = value.trim();
                else if (fieldName === 'exp_date') result.expDate = value.trim();
                else if (fieldName === 'prod_date') result.prodDate = value.trim();
                else result.extras[fieldName] = value.trim();

                aiFound = true;
                break;
            }

            if (!aiFound) {
                if (allSerials.length === 0 && seg.length > 0) {
                    allSerials.push(seg.trim());
                }
                break;
            }
        }
    }

    if (allSerials.length > 0) {
        result.serials = allSerials;
        result.serial = allSerials[0];
    }

    return result;
};

/**
 * Tự động phát hiện và mở rộng dải số tuần tự
 * Hỗ trợ: PREFIX0001 - PREFIX0005, PREFIX0001~PREFIX0005, PREFIX0001..PREFIX0005, PREFIX0001 to PREFIX0005
 */
const tryExpandSerialRange = (raw: string): string[] | null => {
    const trimmed = raw.trim();
    const match = trimmed.match(/^([A-Za-z0-9_-]*?)(\d+)\s*(?:-|~|\.\.|\s+to\s+)\s*([A-Za-z0-9_-]*?)(\d+)$/i);
    if (!match) return null;

    const [, p1, n1, p2, n2] = match;
    if (p1 !== p2) return null;

    const start = parseInt(n1, 10);
    const end = parseInt(n2, 10);
    if (isNaN(start) || isNaN(end) || start >= end) return null;

    const count = end - start + 1;
    // Giới hạn dải tối đa 100 serial để tránh tràn bộ nhớ
    if (count > 100) return null;

    const padLen = Math.max(n1.length, n2.length);
    const list: string[] = [];
    for (let i = start; i <= end; i++) {
        list.push(p1 + String(i).padStart(padLen, '0'));
    }
    return list;
};

/**
 * Phân tích dữ liệu JSON nếu mã QR chứa chuỗi JSON (ví dụ carton box QR chứa JSON array/object)
 */
const tryParseJSONSerials = (raw: string): string[] | null => {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

    try {
        const parsed = JSON.parse(trimmed);
        const results: string[] = [];

        const extract = (val: any) => {
            if (val === null || val === undefined) return;
            if (typeof val === 'string' || typeof val === 'number') {
                const s = String(val).trim();
                if (s.length >= 2) results.push(s);
            } else if (Array.isArray(val)) {
                val.forEach(extract);
            } else if (typeof val === 'object') {
                const priorityKeys = ['serial', 'serials', 'sn', 'sns', 'code', 'codes', 'id', 'ids', 'mac', 'gpon'];
                let foundPriority = false;
                for (const k of priorityKeys) {
                    if (val[k]) {
                        extract(val[k]);
                        foundPriority = true;
                    }
                }
                if (!foundPriority) {
                    Object.values(val).forEach(extract);
                }
            }
        };

        extract(parsed);
        return results.length > 0 ? results : null;
    } catch {
        return null;
    }
};

/**
 * Trích xuất serial từ URL (ví dụ https://kho.ggs.vn/lookup?sn=VNPT12345678)
 */
const tryExtractFromURL = (raw: string): string[] | null => {
    const trimmed = raw.trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;

    try {
        const url = new URL(trimmed);
        const snParam = url.searchParams.get('sn') ||
                        url.searchParams.get('serial') ||
                        url.searchParams.get('code') ||
                        url.searchParams.get('id') ||
                        url.searchParams.get('s');
        if (snParam && snParam.trim().length >= 2) {
            return [snParam.trim()];
        }
        // Kiểm tra phần cuối pathname (nếu có dạng mã thiết bị 6-30 ký tự)
        const pathSegments = url.pathname.split('/').filter(Boolean);
        const last = pathSegments[pathSegments.length - 1];
        if (last && last.length >= 6 && last.length <= 30 && /^[A-Za-z0-9_-]+$/.test(last)) {
            return [last];
        }
    } catch {}
    return null;
};

/**
 * Trích xuất từ tem nhãn thiết bị đa dòng (Multi-line Label QR)
 * VD:
 * MODEL: G-97RG6M
 * MAC: AABBCCDDEEFF
 * SN: VNPT12345678
 */
const tryExtractFromDeviceLabel = (raw: string): string[] | null => {
    const lines = raw.split(/[\r\n]+/);
    if (lines.length < 2 && !raw.includes(';') && !raw.includes(',')) return null;

    const serialRegex = /(?:^|[\r\n;])\s*(?:S\/?N|SERIAL(?:\s*NO|\s*NUMBER)?|GPON[\s-_]*SN|GPON|IMEI[12]?)\s*[:=]\s*([^\r\n;]+)/gi;
    const matches: string[] = [];
    let m: RegExpExecArray | null;

    while ((m = serialRegex.exec(raw)) !== null) {
        const val = m[1].trim();
        if (val) {
            // Có thể là danh sách phân tách dấu phẩy: SN: VNPT01, VNPT02, VNPT03
            const parts = val.split(/[,|/]+/).map(s => s.trim()).filter(Boolean);
            matches.push(...parts);
        }
    }

    if (matches.length > 0) return matches;
    return null;
};

const isIgnoredToken = (token: string): boolean => {
    const clean = token.trim().toLowerCase().replace(/:$/, '');
    if (!clean || clean.length < 2) return true;
    if (IGNORED_LABEL_KEYWORDS.has(clean)) return true;
    // Bỏ các nhãn kiểu "MODEL:", "MAC:", "HW_REV:" nếu không chứa số
    if (token.endsWith(':') && !/\d/.test(token)) return true;
    return false;
};

/**
 * Auto-detect nhiều serial ghép liền không có phân cách.
 */
export const tryDetectConcatenated = (raw: string): string[] => {
    if (raw.length < 8) return [raw];
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
            if (!/^[A-Za-z0-9\-_.]+$/.test(chunk)) { valid = false; break; }
            if (!/[A-Za-z]/.test(chunk)) { valid = false; break; }
            chunks.push(chunk);
        }
        if (!valid || chunks.length < 2) continue;

        let commonPrefixLen = 0;
        for (let i = 0; i < chunks[0].length; i++) {
            if (chunks.every(c => c[i] === chunks[0][i])) commonPrefixLen++;
            else break;
        }

        if (commonPrefixLen >= 3) {
            results.push({ chunks, score: commonPrefixLen * 10 + count });
        }
    }

    // Chiến lược 2: tìm pattern lặp (sliding window)
    if (results.length === 0 && raw.length >= 16) {
        for (let len = 8; len <= Math.floor(raw.length / 2); len++) {
            if (raw.length % len !== 0) continue;
            const count = raw.length / len;
            if (count < 2 || count > 10) continue;

            const chunks = Array.from({ length: count }, (_, i) => raw.substring(i * len, (i + 1) * len));

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
    results.sort((a, b) => b.score - a.score);
    return results[0].chunks;
};

/**
 * Hàm chính: Parse và tự động tách serial từ mọi loại mã quét (QR Code, Barcode, Serial chùm)
 * 
 * Thứ tự ưu tiên thông minh:
 * 1. Mã QR chứa JSON -> Trích xuất mảng serial
 * 2. Mã QR chứa URL -> Lấy tham số sn/serial/code
 * 3. Mã QR dạng tem nhãn (Nhiều dòng) -> Lấy đúng dòng SN:, bỏ các dòng MAC:, MODEL:
 * 4. GS1 DataMatrix/128 -> Lấy toàn bộ AI 21 (hỗ trợ nhiều serial lặp lại)
 * 5. Serial dạng dải khoảng (Range) -> Tự động bung tuần tự (VNPT001 - VNPT005)
 * 6. Ký tự phân cách thông thường (\n, phẩy, chấm phẩy, tab, pipe, gạch chéo, dấu cộng)
 * 7. Chuỗi đơn dài -> Thử auto-detect ghép nối không phân cách
 * 8. Làm sạch, loại bỏ nhãn rác và lọc trùng lặp
 */
export const parseSerialInput = (rawInput: string): string[] => {
    if (!rawInput || rawInput.trim().length === 0) return [];

    const normalized = normalizeSerial(rawInput);
    if (!normalized) return [];

    let serials: string[] = [];

    // ── Bước 1: Kiểm tra JSON format ─────────────────────────────────────
    const jsonSerials = tryParseJSONSerials(normalized);
    if (jsonSerials && jsonSerials.length > 0) {
        serials = jsonSerials;
    }

    // ── Bước 2: Kiểm tra URL ─────────────────────────────────────────────
    if (serials.length === 0) {
        const urlSerials = tryExtractFromURL(normalized);
        if (urlSerials && urlSerials.length > 0) {
            serials = urlSerials;
        }
    }

    // ── Bước 3: Kiểm tra định dạng tem nhãn thiết bị (SN: ... MAC: ...) ──
    if (serials.length === 0) {
        const labelSerials = tryExtractFromDeviceLabel(normalized);
        if (labelSerials && labelSerials.length > 0) {
            serials = labelSerials;
        }
    }

    // ── Bước 4: Kiểm tra GS1 format ──────────────────────────────────────
    if (serials.length === 0 && isGS1Format(normalized)) {
        const blocks = normalized
            .split(new RegExp(`[${SEPARATORS.RS}${SEPARATORS.EOT}]`))
            .filter(b => b.length > 0);

        for (const block of blocks) {
            const parsed = parseGS1(block);
            if (parsed.serials && parsed.serials.length > 0) {
                serials.push(...parsed.serials);
            } else if (parsed.serial) {
                serials.push(parsed.serial);
            } else if (parsed.gtin) {
                serials.push(parsed.gtin);
            } else if (parsed.raw && !isGS1Format(parsed.raw)) {
                serials.push(parsed.raw.trim());
            }
        }
    }

    // ── Bước 5: Kiểm tra dải số tuần tự (VD: VNPT00000001 - VNPT00000005) ─
    if (serials.length === 0) {
        const rangeSerials = tryExpandSerialRange(normalized);
        if (rangeSerials && rangeSerials.length > 0) {
            serials = rangeSerials;
        }
    }

    // ── Bước 6: Tách theo phân cách thông thường ─────────────────────────
    if (serials.length === 0) {
        let cleaned = normalized
            .replace(/(?:^|[\r\n])\s*\d+\.\s*/g, '\n') // Bỏ đánh số thứ tự "1. ", "2. "
            .replace(/(?:^|[\r\n;,|])\s*(?:S\/?N|SERIAL|GPON|IMEI)\s*[:=]\s*/gi, '\n'); // Bỏ prefix nhãn

        const parts = cleaned
            .split(/[\r\n,;|/\t+]+/)
            .map(s => s.trim())
            .filter(s => s.length >= 2 && !isIgnoredToken(s));

        if (parts.length > 0) {
            serials = parts;
        }
    }

    // ── Bước 7: Với từng phần tử, nếu là dải số tuần tự thì mở rộng ──────
    const expandedSerials: string[] = [];
    for (const item of serials) {
        const range = tryExpandSerialRange(item);
        if (range) {
            expandedSerials.push(...range);
        } else {
            expandedSerials.push(item);
        }
    }
    serials = expandedSerials;

    // ── Bước 8: Chuỗi đơn dài - thử auto-detect ghép nối ─────────────────
    if (serials.length === 1 && serials[0].length > 25) {
        const detected = tryDetectConcatenated(serials[0]);
        if (detected.length > 1) {
            serials = detected;
        }
    }

    // ── Bước 9: Làm sạch, loại bỏ nhãn rác và lọc trùng lặp ──────────────
    const unique = [...new Set(
        serials
            .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
            .filter(s => s.length >= 2 && !isIgnoredToken(s))
    )];

    return unique;
};

/**
 * Kiểm tra 2 serial có giống nhau không (không phân biệt hoa thường và khoảng trắng)
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
