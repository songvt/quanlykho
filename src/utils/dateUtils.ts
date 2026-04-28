/**
 * Định dạng ngày tháng sang dd/mm/yyyy
 */
export const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    
    // Nếu đã là định dạng dd/mm/yyyy thì trả về luôn
    if (typeof date === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(date)) {
        return date.substring(0, 10);
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return `${day}/${month}/${year}`;
};

/**
 * Giải mã chuỗi dd/mm/yyyy thành đối tượng Date
 */
export const parseDate = (dateStr: string | null): Date => {
    if (!dateStr) return new Date();
    
    // Nếu là định dạng dd/mm/yyyy
    const parts = dateStr.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
    }
    
    // Nếu là định dạng khác (ISO, v.v.)
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Lấy thời gian hiện tại định dạng dd/mm/yyyy
 */
export const getNowFormatted = (): string => formatDate(new Date());
