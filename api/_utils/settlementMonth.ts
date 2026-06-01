/** Chuẩn hóa tháng về YYYY-MM (hỗ trợ dữ liệu cũ MM/YYYY) */
export const normalizeSettlementMonth = (month: string): string => {
    const s = String(month || '').trim();
    const dashMatch = s.match(/^(\d{4})-(\d{1,2})$/);
    if (dashMatch) {
        return `${dashMatch[1]}-${dashMatch[2].padStart(2, '0')}`;
    }
    const slash = s.match(/^(\d{1,2})\/(\d{4})$/);
    if (slash) return `${slash[2]}-${slash[1].padStart(2, '0')}`;
    return s;
};
