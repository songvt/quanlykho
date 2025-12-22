import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

// --- Utility: Read Number to Text (Vietnamese) ---
const readGroup = (group: string) => {
    const readDigit = [" không", " một", " hai", " ba", " bốn", " năm", " sáu", " bảy", " tám", " chín"];
    let temp = "";
    if (group === "000") return "";

    // Hundred
    temp += readDigit[parseInt(group[0])] + " trăm";

    // Ten
    if (group[1] === "0") {
        if (group[2] === "0") return temp;
        temp += " lẻ";
    } else if (group[1] === "1") {
        temp += " mười";
    } else {
        temp += readDigit[parseInt(group[1])] + " mươi";
    }

    // Unit
    if (group[2] === "1") {
        if (group[1] === "0" || group[1] === "1") temp += " một";
        else temp += " mốt";
    } else if (group[2] === "5") {
        if (group[1] === "0") temp += " năm";
        else temp += " lăm";
    } else if (group[2] !== "0") {
        temp += readDigit[parseInt(group[2])];
    }
    return temp;
};

export const readMoney = (n: number) => {
    if (n === 0) return "Không đồng";
    let str = Math.round(n).toString();
    while (str.length % 3 !== 0) str = "0" + str;

    const groups = [];
    for (let i = 0; i < str.length; i += 3) groups.push(str.slice(i, i + 3));

    const suffixes = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    let result = "";

    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const suffix = suffixes[groups.length - 1 - i];
        const read = readGroup(group);
        if (read) result += read + suffix;
    }

    // Clean up
    result = result.trim();
    if (result.startsWith("không trăm lẻ")) result = result.replace("không trăm lẻ ", "");
    if (result.startsWith("lẻ")) result = result.replace("lẻ", "");

    return result.charAt(0).toUpperCase() + result.slice(1) + " đồng./.";
};

// --- NEW STANDARD EXPORT (ExcelJS) ---
export interface ReportColumn {
    header: string;
    key: string;
    width?: number;
    align?: 'left' | 'center' | 'right';
}

export const exportStandardReport = async (
    data: any[],
    fileName: string,
    reportTitle: string,
    columns: ReportColumn[],
    reporterName: string = 'Admin'
) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sheet1', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
    });

    const dateObj = new Date();
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const totalCols = columns.length;

    // Auto-calculate column widths based on data
    const getTextWidth = (text: string) => {
        return text ? text.toString().length : 0;
    };

    const maxLengths: { [key: string]: number } = {};
    columns.forEach(col => maxLengths[col.key] = col.header.length + 2); // Init with header length

    data.forEach(item => {
        columns.forEach(col => {
            const val = item[col.key];
            const len = getTextWidth(val);
            if (len > maxLengths[col.key]) {
                // Special handling for specific columns
                if (col.key === 'serial') {
                    maxLengths[col.key] = Math.min(len, 12); // Narrow Serial
                } else if (col.key === 'receiver') {
                    maxLengths[col.key] = Math.min(len, 40); // Allow receiver to grow
                } else {
                    maxLengths[col.key] = Math.min(len, 50); // Default Cap
                }
            }
        });
    });

    // Apply widths
    sheet.columns = columns.map(c => {
        let finalWidth = Math.max(c.width || 10, maxLengths[c.key] + 2);

        // Force specific overrides if needed
        if (c.key === 'receiver') finalWidth = Math.max(finalWidth, 30); // Min width for Receiver
        if (c.key === 'serial') finalWidth = 14; // Fixed width for Serial to force wrap

        return { key: c.key, width: finalWidth };
    });

    // Styles
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const fontBoldBlue = { name: 'Times New Roman', bold: true, color: { argb: 'FF0070C0' }, size: 10 };
    const fontBoldRed = { name: 'Times New Roman', bold: true, color: { argb: 'FFFF0000' }, size: 14 };
    const fontNormal = { name: 'Times New Roman', size: 11 };
    // Changed to Black Text on Light Grey for better visibility
    const fontHeader = { name: 'Times New Roman', bold: true, color: { argb: 'FF000000' }, size: 11 };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // --- HEADER --- (Simplified for generic 5-10 col reports)
    // We will merge roughly half-half for Left/Right header info
    const midPoint = Math.floor(totalCols / 2);

    // Left Header
    // ... (Keep existing header code logic, ensuring alignment) ...
    sheet.mergeCells(1, 1, 1, midPoint);
    const cA1 = sheet.getCell(1, 1);
    cA1.value = 'TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN';
    cA1.font = fontBoldBlue;
    cA1.alignment = { horizontal: 'left' };

    sheet.mergeCells(2, 1, 2, midPoint);
    const cA2 = sheet.getCell(2, 1);
    cA2.value = '455A TRẦN THỊ NĂM P.TMT QUẬN 12';
    cA2.font = { ...fontBoldBlue, size: 9 };
    cA2.alignment = { horizontal: 'left' };

    // Right Header
    sheet.mergeCells(1, midPoint + 1, 1, totalCols);
    const cRight1 = sheet.getCell(1, midPoint + 1);
    cRight1.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    cRight1.font = fontBoldBlue;
    cRight1.alignment = { horizontal: 'center' };

    sheet.mergeCells(2, midPoint + 1, 2, totalCols);
    const cRight2 = sheet.getCell(2, midPoint + 1);
    cRight2.value = 'Độc lập - Tự do - Hạnh phúc';
    cRight2.font = { ...fontBoldBlue, size: 10 };
    cRight2.alignment = { horizontal: 'center' };

    // Title
    sheet.mergeCells(4, 1, 4, totalCols);
    const cTitle = sheet.getCell(4, 1);
    cTitle.value = reportTitle.toUpperCase();
    cTitle.font = fontBoldRed;
    cTitle.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells(5, 1, 5, totalCols);
    const cDate = sheet.getCell(5, 1);
    cDate.value = `Ngày ${day} tháng ${month} năm ${year}`;
    cDate.font = { name: 'Times New Roman', italic: true, size: 11, color: { argb: 'FF0070C0' } };
    cDate.alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // --- TABLE HEADER ---
    const headerRow = sheet.addRow(columns.map(c => c.header));
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = fontHeader;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderStyle as any;
    });

    // --- DATA ---
    data.forEach((item, index) => {
        const rowValues = columns.map((col) => {
            if (col.key === 'stt') return index + 1;
            return item[col.key];
        });
        const row = sheet.addRow(rowValues);
        row.eachCell((cell, colNum) => {
            cell.font = fontNormal;
            cell.border = borderStyle as any;
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: columns[colNum - 1].align || 'left' };
        });
    });

    sheet.addRow([]);

    // --- FOOTER ---
    const lastRow = sheet.rowCount + 1;
    sheet.mergeCells(lastRow, 1, lastRow, 3); // Left Signature (Optional)
    sheet.mergeCells(lastRow, totalCols - 2, lastRow, totalCols); // Right Signature (Reporter)

    const cSigRight = sheet.getCell(lastRow, totalCols - 2);
    cSigRight.value = 'NGƯỜI LẬP BIỂU';
    cSigRight.font = { ...fontNormal, bold: true };
    cSigRight.alignment = { horizontal: 'center' };

    const nameRow = lastRow + 4;
    sheet.mergeCells(nameRow, totalCols - 2, nameRow, totalCols);
    const cNameRight = sheet.getCell(nameRow, totalCols - 2);
    cNameRight.value = reporterName;
    cNameRight.font = { ...fontNormal, bold: true };
    cNameRight.alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${fileName}.xlsx`);
};

// --- LEGACY EXPORTS (XLSX) ---
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1', options?: { title?: string; reporter?: string; }) => {
    const headers = [];
    if (options?.title) headers.push([options.title.toUpperCase()]);
    if (options?.reporter) headers.push(['Người lập báo cáo:', options.reporter]);
    const now = new Date();
    headers.push(['Thời gian xuất:', `${now.toLocaleTimeString('vi-VN')} - ${now.toLocaleDateString('vi-VN')}`]);
    headers.push(['']);

    const tableKeys = data.length > 0 ? Object.keys(data[0]) : [];
    const tableHeader = [tableKeys];
    const tableBody = data.map(row => tableKeys.map(key => row[key]));
    const finalData = [...headers, ...tableHeader, ...tableBody];
    const ws = XLSX.utils.aoa_to_sheet(finalData);
    if (options?.title) {
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });
    }
    const colWidths = tableKeys.map(key => ({ wch: Math.max(key.length, 20) }));
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const generateProductTemplate = () => {
    const headers = [{ MA_HANG: "SP001", TEN_HANG_HOA: "Sản phẩm mẫu", LOAI_DM: "Hàng hóa", DON_GIA: 100000, DON_VI: "Cái", LOAI_HANG: "Thường" }];
    const ws = XLSX.utils.json_to_sheet(headers);
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProductTemplate");
    XLSX.writeFile(wb, "ProductImportTemplate.xlsx");
};
export const generateEmployeeTemplate = () => {
    const headers = [{ HO_TEN: "Nguyễn Văn A", EMAIL: "nguyenvan.a@example.com", SO_DIEN_THOAI: "0901234567", VAI_TRO: "staff", TEN_DANG_NHAP: "nguyenvana", QUAN_HUYEN: "Quận 1" }];
    const ws = XLSX.utils.json_to_sheet(headers);
    ws['!cols'] = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "EmployeeTemplate");
    XLSX.writeFile(wb, "EmployeeImportTemplate.xlsx");
};
export const generateInboundTemplate = () => {
    const headers = [{ MA_HANG: "SP001", SO_LUONG: 10, DON_GIA: 150000, SERIAL: "SN123456", GHI_CHU: "Nhập hàng đợt 1", QUAN_HUYEN: "Quận 1", TRANG_THAI_HANG: "Mới 100%" }];
    const ws = XLSX.utils.json_to_sheet(headers);
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "InboundTemplate");
    XLSX.writeFile(wb, "InboundImportTemplate.xlsx");
};
export const generateOutboundTemplate = () => {
    const headers = [{ MA_HANG: "SP001", SO_LUONG: 5, EMAIL_NGUOI_NHAN: "nguyenvan.a@example.com", SERIAL: "SN123", GHI_CHU: "Xuất cho dự án A", QUAN_HUYEN: "Quận 3", TRANG_THAI_HANG: "Đã qua sử dụng" }];
    const ws = XLSX.utils.json_to_sheet(headers);
    ws['!cols'] = [{ wch: 15 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "OutboundTemplate");
    XLSX.writeFile(wb, "OutboundImportTemplate.xlsx");
};
export const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);
                resolve(json);
            } catch (error) { reject(error); }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};

// --- NEW EXCELJS HANDOVER EXPORT ---
export const exportHandoverMinutes = async (
    data: any[],
    employeeName: string,
    date: string,
    creatorName: string = 'Admin',
    senderPhone: string = '',
    receiverPhone: string = ''
) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Biên Bản Bàn Giao', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            horizontalCentered: true,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
    });

    const dateObj = new Date(date);
    const day = dateObj.getDate();
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();

    // Setup Columns (Widths approx for A4 Portrait)
    // Total available width relative unit approx 90-100?
    sheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'ma_hang', width: 14 },
        { key: 'ten_hang', width: 25 },
        { key: 'don_vi', width: 8 },
        { key: 'so_luong', width: 8 },
        { key: 'don_gia', width: 12 },
        { key: 'thanh_tien', width: 13 },
        { key: 'serial', width: 14 },
        { key: 'nhan_vien', width: 12 },
        { key: 'thong_tin', width: 8 },
        { key: 'phieu_xuat', width: 6 },
    ];

    // Style Definitions
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const fontBoldBlue = { name: 'Times New Roman', bold: true, color: { argb: 'FF0070C0' }, size: 9 };
    const fontBoldRed = { name: 'Times New Roman', bold: true, color: { argb: 'FFFF0000' }, size: 16 };
    const fontNormal = { name: 'Times New Roman', size: 10 };
    const fontHeader = { name: 'Times New Roman', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };

    // --- HEADER ---
    sheet.mergeCells('A1:D1');
    const cA1 = sheet.getCell('A1');
    cA1.value = 'TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN';
    cA1.font = fontBoldBlue;
    cA1.alignment = { horizontal: 'left' };

    sheet.mergeCells('G1:K1');
    const cG1 = sheet.getCell('G1');
    cG1.value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
    cG1.font = fontBoldBlue;
    cG1.alignment = { horizontal: 'center' };

    sheet.mergeCells('A2:D2');
    const cA2 = sheet.getCell('A2');
    cA2.value = '455A TRẦN THỊ NĂM P.TMT QUẬN 12';
    cA2.font = { ...fontBoldBlue, size: 8 };
    cA2.alignment = { horizontal: 'left' };

    sheet.mergeCells('G2:K2');
    const cG2 = sheet.getCell('G2');
    cG2.value = 'Độc lập - Tự do - Hạnh phúc';
    cG2.font = { ...fontBoldBlue, size: 9 };
    cG2.alignment = { horizontal: 'center' };

    sheet.mergeCells('G3:K3');
    const cG3 = sheet.getCell('G3');
    cG3.value = 'BBBG-BSG/ACT :PX-1';
    cG3.font = { name: 'Times New Roman', color: { argb: 'FFFF0000' }, size: 9 };
    cG3.alignment = { horizontal: 'right' };

    sheet.mergeCells('A4:K4');
    const cA4 = sheet.getCell('A4');
    cA4.value = 'BIÊN BẢN BÀN GIAO VẬT TƯ HÀNG HÓA';
    cA4.font = fontBoldRed;
    cA4.alignment = { horizontal: 'center', vertical: 'middle' };

    sheet.mergeCells('A5:K5');
    const cA5 = sheet.getCell('A5');
    cA5.value = `Ngày ${day} tháng ${month} năm ${year}`;
    cA5.font = { name: 'Times New Roman', italic: true, size: 10, color: { argb: 'FF0070C0' } };
    cA5.alignment = { horizontal: 'center' };

    // Info Blocks
    sheet.getCell('A6').value = 'BÊN GIAO :';
    sheet.getCell('A6').font = { ...fontBoldBlue, size: 10 };

    sheet.mergeCells('A7:D7'); sheet.getCell('A7').value = `Họ tên người giao hàng : ${creatorName}`;
    sheet.getCell('A7').font = { ...fontBoldBlue, size: 10 };
    sheet.mergeCells('E7:G7'); sheet.getCell('E7').value = 'Chức vụ: Nhân viên - QLTS(Kho)';
    sheet.getCell('E7').font = { ...fontNormal, color: { argb: 'FF0070C0' } };
    sheet.mergeCells('H7:K7'); sheet.getCell('H7').value = `Điện thoại : ${senderPhone}`;
    sheet.getCell('H7').font = { ...fontNormal, color: { argb: 'FF0070C0' } };

    sheet.mergeCells('A8:K8'); sheet.getCell('A8').value = 'Địa chỉ(Bộ phận) :455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12';
    sheet.getCell('A8').font = { ...fontNormal, color: { argb: 'FF0070C0' } };

    sheet.mergeCells('A9:K9'); sheet.getCell('A9').value = 'Lý do xuất: Xuất hàng hóa,vật tư phát triển và xử lý sự cố, UCTT.....';
    sheet.getCell('A9').font = { ...fontNormal, color: { argb: 'FF0070C0' } };

    sheet.getCell('A10').value = 'BÊN NHẬN :';
    sheet.getCell('A10').font = { ...fontBoldBlue, size: 10 };

    sheet.mergeCells('A11:K11'); sheet.getCell('A11').value = 'Địa chỉ(Bộ phận) :455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12';
    sheet.getCell('A11').font = { ...fontNormal, color: { argb: 'FF0070C0' } };

    sheet.mergeCells('A12:D12'); sheet.getCell('A12').value = `Họ tên người nhận hàng : ${employeeName}`;
    sheet.getCell('A12').font = { ...fontBoldRed, size: 10 }; // Red name
    sheet.mergeCells('E12:G12'); sheet.getCell('E12').value = 'Chức vụ: Nhân viên Kỹ thuật CĐBR';
    sheet.getCell('E12').font = { ...fontNormal, color: { argb: 'FF0070C0' } };
    sheet.mergeCells('H12:K12'); sheet.getCell('H12').value = `Điện thoại : ${receiverPhone}`;
    sheet.getCell('H12').font = { ...fontNormal, color: { argb: 'FF0070C0' } };

    sheet.addRow([]);

    // --- TABLE ---
    // [STT][Tên][ĐVT][SL][ĐG][TT][Serial][NV][Info][PX] - 10 cols? 
    // Wait my columns setup has 11 columns (0-10 or A-K). 
    // My cols: stt, ma, ten, donvi, sl, dg, tt, serial, nv, info, px -> 11 columns.
    // The image has 10 visible columns. Let's stick to 11 to detail Ma Hang vs Ten Hang.
    const headerRow = sheet.addRow(['STT', 'MÃ HÀNG', 'TÊN HÀNG HÓA', 'ĐƠN VỊ', 'SỐ LƯỢNG', 'ĐƠN GIÁ', 'THÀNH TIỀN', 'SERIAL NHẬN', 'NHÂN VIÊN NHẬN', 'THÔNG TIN HÀNG HÓA', 'PHIẾU XUẤT']);
    headerRow.height = 35;
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.font = fontHeader;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderStyle as any;
    });

    let totalAmount = 0;
    data.forEach((item, index) => {
        const price = item.unit_price || 0;
        const qty = item.quantity || 0;
        const total = price * qty;
        totalAmount += total;

        const row = sheet.addRow([
            index + 1,
            item.item_code || '',
            item.product_name || item.name,
            item.unit || 'Cái',
            qty,
            new Intl.NumberFormat('vi-VN').format(price),
            new Intl.NumberFormat('vi-VN').format(total),
            item.serial_code || '',
            employeeName,
            item.item_status || item.district || '',
            '1'
        ]);

        row.eachCell((cell, colNum) => {
            cell.font = fontNormal;
            cell.border = borderStyle as any;
            cell.alignment = { vertical: 'middle', wrapText: true };
            if ([1, 4, 5, 11].includes(colNum)) cell.alignment = { ...cell.alignment, horizontal: 'center' }; // STT, Unit, Qty, PX
            if ([6, 7].includes(colNum)) cell.alignment = { ...cell.alignment, horizontal: 'right' }; // Price, Total
        });
    });

    // Total Row
    const totalRow = sheet.addRow(['TỔNG TIỀN (1):', '', '', '', data.length, '', new Intl.NumberFormat('vi-VN').format(totalAmount), '', '', '', '']);
    sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
    totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        cell.font = { ...fontHeader, size: 10 };
        cell.border = borderStyle as any;
    });
    sheet.getCell(`A${totalRow.number}`).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell(`E${totalRow.number}`).alignment = { horizontal: 'center', vertical: 'middle' }; // Qty
    sheet.getCell(`G${totalRow.number}`).alignment = { horizontal: 'right', vertical: 'middle' }; // Amount

    // Text Amount
    const textRow = sheet.addRow([`Tổng số tiền (viết bằng chữ): ${readMoney(totalAmount)}`]);
    sheet.mergeCells(`A${textRow.number}:K${textRow.number}`);
    const textCell = sheet.getCell(`A${textRow.number}`);
    textCell.font = { ...fontNormal, bold: true, italic: true };
    textCell.alignment = { horizontal: 'center' };
    textCell.border = borderStyle as any; // Box it

    // Note
    const noteRow = sheet.addRow(['Lưu ý : Kiểm tra trước khi đi,mọi khiếu nại về sau không giải quyết.Trân trọng ! (Truy cập xem biên bản điện tử tại app/In biên bản bàn giao)']);
    sheet.mergeCells(`A${noteRow.number}:K${noteRow.number}`);
    sheet.getCell(`A${noteRow.number}`).font = { ...fontNormal, italic: true, size: 9 };
    sheet.getCell(`A${noteRow.number}`).alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // Signatures
    const sigHeader = sheet.addRow(['BÊN GIAO', '', '', '', '', '', '', '', '', 'BÊN NHẬN', '']);
    sheet.mergeCells(`A${sigHeader.number}:D${sigHeader.number}`);
    sheet.mergeCells(`J${sigHeader.number}:K${sigHeader.number}`);
    sheet.getCell(`A${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigHeader.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`J${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`J${sigHeader.number}`).alignment = { horizontal: 'center' };

    const sigTitle = sheet.addRow(['(Ký, họ tên)', '', '', '', '', '', '', '', '', '(Ký, họ tên)', '']);
    sheet.mergeCells(`A${sigTitle.number}:D${sigTitle.number}`);
    sheet.mergeCells(`J${sigTitle.number}:K${sigTitle.number}`);
    sheet.getCell(`A${sigTitle.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`J${sigTitle.number}`).alignment = { horizontal: 'center' };

    sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);

    const sigName = sheet.addRow([creatorName, '', '', '', '', '', '', '', '', employeeName, '']);
    sheet.mergeCells(`A${sigName.number}:D${sigName.number}`);
    sheet.mergeCells(`J${sigName.number}:K${sigName.number}`);
    sheet.getCell(`A${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigName.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`J${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`J${sigName.number}`).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    const safeName = employeeName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    saveAs(new Blob([buffer]), `BBBG_${safeName}_${date}.xlsx`);
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
