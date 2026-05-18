/** Chuẩn hóa tháng về YYYY-MM (hỗ trợ dữ liệu cũ MM/YYYY) */
export const normalizeSettlementMonth = (month: string): string => {
    const s = String(month || '').trim();
    if (/^\d{4}-\d{2}$/.test(s)) return s;
    const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
    return s;
};
