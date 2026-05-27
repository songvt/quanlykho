/**
 * Formats a number with dot as thousands separator and comma as decimal separator (vi-VN standard)
 * @param val The number to format
 * @param options Intl.NumberFormatOptions
 * @returns Formatted string
 */
export const formatNumber = (val: number | string | undefined | null, options?: Intl.NumberFormatOptions): string => {
    if (val === undefined || val === null || val === '') return '-';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return String(val);
    
    return num.toLocaleString('vi-VN', options);
};

/**
 * Formats a currency value
 * @param val The number to format
 * @returns Formatted string with 'đ' suffix
 */
export const formatCurrency = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '-';
    const formatted = formatNumber(val);
    return formatted === '-' ? '-' : `${formatted} đ`;
};

/**
 * Safely parses numbers from Excel strings/values, handling Vietnamese thousands separators and negative accounting formats.
 * @param val The value to parse
 * @returns Parsed number, defaults to 0 if invalid
 */
export const parseExcelNumber = (val: any): number => {
    if (typeof val === 'number') {
        return isNaN(val) ? 0 : val;
    }
    if (val === undefined || val === null || val === '') return 0;
    
    let str = String(val).trim();
    if (!str) return 0;
    
    // 1. Xử lý số âm trong ngoặc đơn kiểu kế toán: (2.852) -> -2.852
    if (str.startsWith('(') && str.endsWith(')')) {
        str = '-' + str.substring(1, str.length - 1);
    }
    
    // 2. Nếu có cả dấu chấm và dấu phẩy (ví dụ: 1.234,56 hoặc 1,234.56)
    if (str.includes('.') && str.includes(',')) {
        const dotIndex = str.indexOf('.');
        const commaIndex = str.indexOf(',');
        if (dotIndex < commaIndex) {
            // Dạng 1.234,56 (dấu chấm phân tách phần nghìn, dấu phẩy phân tách thập phân)
            str = str.replace(/\./g, '').replace(/,/g, '.');
        } else {
            // Dạng 1,234.56 (dấu phẩy phân tách phần nghìn, dấu chấm phân tách thập phân)
            str = str.replace(/,/g, '');
        }
    } else if (str.includes('.')) {
        // Chỉ có dấu chấm: ví dụ 2.852 hoặc 1.267.462.000 hoặc 12.34
        const parts = str.split('.');
        if (parts.length > 2) {
            // Nhiều dấu chấm -> phân tách phần nghìn
            str = str.replace(/\./g, '');
        } else if (parts.length === 2) {
            // Có đúng 1 dấu chấm
            const decimalPart = parts[1];
            if (decimalPart.length === 3) {
                // Ví dụ 2.852 hoặc 150.000 -> thường là dấu phân cách phần nghìn trong Excel Việt Nam
                str = str.replace(/\./g, '');
            } else {
                // Ví dụ 12.34 hoặc 12.5 -> là số thập phân
                // Giữ nguyên dấu chấm để Number(str) parse đúng.
            }
        }
    } else if (str.includes(',')) {
        // Chỉ có dấu phẩy: ví dụ 2,852 hoặc 12,34
        const parts = str.split(',');
        if (parts.length > 2) {
            // Nhiều dấu phẩy -> phân tách phần nghìn
            str = str.replace(/,/g, '');
        } else if (parts.length === 2) {
            // Có đúng 1 dấu phẩy
            const decimalPart = parts[1];
            if (decimalPart.length === 3) {
                // Ví dụ 2,852 -> phân tách phần nghìn kiểu Anh
                str = str.replace(/,/g, '');
            } else {
                // Ví dụ 12,34 -> 12.34 (thập phân)
                str = str.replace(/,/g, '.');
            }
        }
    }
    
    const num = Number(str);
    return isNaN(num) ? 0 : num;
};

