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
