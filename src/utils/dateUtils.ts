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
export const parseDate = (dateStr: any): Date => {
    if (!dateStr) return new Date();
    
    // Nếu đã là đối tượng Date
    if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? new Date() : dateStr;
    }

    // Đảm bảo là chuỗi
    const s = String(dateStr).trim();
    
    // Nếu là định dạng dd/mm/yyyy
    const parts = s.split('/');
    if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? new Date() : d;
    }
    
    // Nếu là định dạng khác (ISO, v.v.)
    const d = new Date(s);
    return isNaN(d.getTime()) ? new Date() : d;
};

/**
 * Lấy thời gian hiện tại định dạng dd/mm/yyyy
 */
export const getNowFormatted = (): string => formatDate(new Date());

/**
 * Kiểm tra xem một ngày có thuộc về tháng/năm mục tiêu hay không (targetMonthStr dạng YYYY-MM)
 */
export const checkIsSameMonth = (d: any, targetMonthStr: string): boolean => {
    if (!d) return false;
    
    // Trường hợp d là đối tượng Date thực thụ
    if (d instanceof Date) {
        // KIỂM TRA ĐA MÚI GIỜ: Đề phòng lỗi lệch 1 ngày do múi giờ VN/UTC
        // Thử theo Giờ địa phương
        const yL = d.getFullYear();
        const mL = String(d.getMonth() + 1).padStart(2, '0');
        const isMatchLocal = `${yL}-${mL}` === targetMonthStr;
        
        // Thử theo Giờ quốc tế (UTC)
        const yU = d.getUTCFullYear();
        const mU = String(d.getUTCMonth() + 1).padStart(2, '0');
        const isMatchUTC = `${yU}-${mU}` === targetMonthStr;

        return isMatchLocal || isMatchUTC;
    }

    const dateStr = String(d).trim();
    if (!dateStr || dateStr === 'undefined' || dateStr === 'null') return false;
    
    // ISO format YYYY-MM-DD... (như 2024-04-01T00:00:00.000Z)
    if (dateStr.includes('T') || (dateStr.length >= 10 && dateStr.includes('-') && dateStr.startsWith('20'))) {
        return dateStr.substring(0, 7) === targetMonthStr;
    }
    
    // DD/MM/YYYY or MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const separator = dateStr.includes('/') ? '/' : (dateStr.includes('-') ? '-' : (dateStr.includes('.') ? '.' : null));
    if (separator) {
        const parts = dateStr.split(separator);
        if (parts.length >= 2) {
            const m = parts[parts.length - 2].padStart(2, '0');
            let y = parts[parts.length - 1].split(' ')[0];
            if (y.length === 2) y = '20' + y;
            if (y.length === 4) return `${y}-${m}` === targetMonthStr;
        }
    }
    return false;
};
