import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Helper to remove Vietnamese tones
export const removeVietnameseTones = (str: string) => {
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, "");
    str = str.replace(/\u02C6|\u0306|\u031B/g, "");
    str = str.replace(/ + /g, " ");
    str = str.trim();
    return str;
};
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
    if (result.startsWith("không trăm")) result = result.replace("không trăm", "").trim();
    if (result.startsWith("lẻ")) result = result.replace("lẻ", "").trim();

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
export const exportHandoverMinutesV2 = async (
    data: any[],
    receiverName: string,
    dateStr: string,
    reporterName: string,
    senderPhone: string = '',
    receiverPhone: string = '',
    reportNumber: string = '.......' // Added reportNumber
) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bien_Ban_Ban_Giao', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'portrait',
            fitToPage: true, // Fit all columns on one page
            fitToWidth: 1,
            fitToHeight: 0, // Let height grow
            margins: {
                left: 0.25, right: 0.25, top: 0.5, bottom: 0.5,
                header: 0.3, footer: 0.3
            }
        }
    });

    // --- STYLES ---
    const fontTitle = { name: 'Times New Roman', size: 12, bold: true };
    const fontHeader = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FFFF0000' } }; // RED Header
    const fontTableHead = { name: 'Times New Roman', size: 12, bold: true, wrapText: true };
    const fontTableBody = { name: 'Times New Roman', size: 12, wrapText: true };
    const fontNormal = { name: 'Times New Roman', size: 12 };

    const fontBoldBlue = { name: 'Times New Roman', bold: true, color: { argb: 'FF0070C0' }, size: 12 };
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    // --- LAYOUT SETUP (8 Columns) ---
    // Col 1: STT
    // Col 2: Ma Hang
    // Col 3: Name
    // Col 4: Unit
    // Col 5: Qty
    // Col 6: Price
    // Col 7: Total
    // Col 8: Serial
    sheet.columns = [
        { key: 'stt', width: 6 },      // A
        { key: 'code', width: 25 },    // B (Ma Hang) - Widened
        { key: 'name', width: 60 },    // C (Ten Hang) - Super Wide
        { key: 'unit', width: 8 },     // D
        { key: 'qty', width: 8 },      // E
        { key: 'price', width: 14 },   // F
        { key: 'total', width: 18 },   // G
        { key: 'serial', width: 45 },  // H - Super Wide
    ];

    // --- HEADER SECTION ---
    // Row 1: Center Name (Left)
    sheet.mergeCells('A1:C1');
    sheet.getCell('A1').value = "TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN";
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('A1').font = fontBoldBlue; // Blue

    sheet.mergeCells('A2:C2');
    sheet.getCell('A2').value = "455A TRẦN THỊ NĂM P.TMT QUẬN 12";
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('A2').font = { ...fontBoldBlue, size: 9 };

    // Row 1: Motto (Right)
    sheet.mergeCells('E1:H1');
    sheet.getCell('E1').value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
    sheet.getCell('E1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('E1').font = fontTitle;

    sheet.mergeCells('E2:H2');
    sheet.getCell('E2').value = "Độc lập - Tự do - Hạnh phúc";
    sheet.getCell('E2').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('E2').font = { ...fontTitle, size: 10 };

    // Row 3: Report Number (Right)
    // Format: "BBBG-BSG/ACT :PX-[Number]"
    sheet.mergeCells('E3:H3');
    sheet.getCell('E3').value = `BBBG-BSG/ACT :PX-${reportNumber}`;
    sheet.getCell('E3').alignment = { vertical: 'middle', horizontal: 'right' };
    sheet.getCell('E3').font = { name: 'Times New Roman', size: 11, color: { argb: 'FFFF0000' } }; // Red text? Or standard? Image shows red.

    // Row 4 Title
    sheet.mergeCells('A4:H4');
    sheet.getCell('A4').value = "BIÊN BẢN BÀN GIAO VẬT TƯ HÀNG HÓA"; // Removed (MỚI)
    sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A4').font = fontHeader; // Red, Bold, 16

    // Row 5: Date
    const [y, m, d] = dateStr.split('-');
    sheet.mergeCells('A5:H5');
    sheet.getCell('A5').value = `Ngày ${d} tháng ${m} năm ${y}`;
    sheet.getCell('A5').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A5').font = { name: 'Times New Roman', size: 11, italic: true };

    // --- INFO SECTION ---
    let currentRow = 7;
    // ... (Existing Info Logic) ... Left as is for now, just ensure layout spans A-H correctly.
    const addInfoRow = (label1: string, val1: string, label2?: string, val2?: string) => {
        sheet.mergeCells(`A${currentRow}:B${currentRow}`);
        sheet.getCell(`A${currentRow}`).value = label1;
        sheet.getCell(`A${currentRow}`).font = fontNormal;

        sheet.mergeCells(`C${currentRow}:D${currentRow}`);
        sheet.getCell(`C${currentRow}`).value = val1;
        sheet.getCell(`C${currentRow}`).font = { ...fontNormal, bold: true }; // Bold Value

        if (label2) {
            sheet.mergeCells(`E${currentRow}:F${currentRow}`);
            sheet.getCell(`E${currentRow}`).value = label2;
            sheet.getCell(`E${currentRow}`).font = fontNormal;

            sheet.mergeCells(`G${currentRow}:H${currentRow}`);
            sheet.getCell(`G${currentRow}`).value = val2;
            sheet.getCell(`G${currentRow}`).font = { ...fontNormal, bold: true };
        }
        currentRow++;
    };

    // Headers
    sheet.getCell(`A${currentRow}`).value = "BÊN GIAO :";
    sheet.getCell(`A${currentRow}`).font = fontBoldBlue;
    currentRow++;

    addInfoRow("Họ tên người giao hàng :", reporterName);
    addInfoRow("Chức vụ:", "Nhân viên - QLTS(Kho)", "Điện thoại:", senderPhone);
    // Explicit row for address to span wider
    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12";
    sheet.getCell(`A${currentRow}`).font = fontNormal;
    currentRow++;

    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Lý do xuất: Xuất hàng hóa,vật tư phát triển và xử lý sự cố, UCTT.....";
    sheet.getCell(`A${currentRow}`).font = fontNormal;
    currentRow++;

    // Spacer
    currentRow++;

    sheet.getCell(`A${currentRow}`).value = "BÊN NHẬN :";
    sheet.getCell(`A${currentRow}`).font = fontBoldBlue;
    currentRow++;

    sheet.mergeCells(`A${currentRow}:H${currentRow}`);
    sheet.getCell(`A${currentRow}`).value = "Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12";
    sheet.getCell(`A${currentRow}`).font = fontNormal;
    currentRow++;

    addInfoRow("Họ tên người nhận hàng :", receiverName);
    // Red Name for Receiver
    sheet.getCell(`C${currentRow - 1}`).font = { ...fontNormal, bold: true, color: { argb: 'FFFF0000' } };

    addInfoRow("Chức vụ:", "Nhân viên Kỹ thuật CĐBR", "Điện thoại:", receiverPhone);

    currentRow++; // Spacer

    // --- DATA TABLE ---


    // Header Row
    const headers = ["STT", "MÃ HÀNG", "TÊN HÀNG HÓA", "DVT", "SL", "ĐƠN GIÁ", "THÀNH TIỀN", "SERIAL"];
    headers.forEach((h, idx) => {
        const cell = sheet.getCell(currentRow, idx + 1);
        cell.value = h;
        cell.font = { ...fontTableHead, size: 10, color: { argb: 'FF808080' } }; // Grey text per image? Wait, image has White text on Grey BG? or Black text?
        // User image shows: Grey Background, Black Text maybe? Let's use Standard:
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } }; // Light Grey
        cell.font = { ...fontTableHead, color: { argb: 'FF000000' } }; // Black text
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderStyle;
    });
    currentRow++;

    // Data Rows
    let totalAll = 0;
    let totalQty = 0;
    data.forEach((item, index) => {
        const rowData = sheet.getRow(currentRow);
        const totalPrice = (Number(item.quantity) * Number(item.unit_price || 0));
        totalAll += totalPrice;
        totalQty += Number(item.quantity);

        rowData.getCell(1).value = index + 1; // STT
        rowData.getCell(2).value = item.item_code || ''; // Ma Hang
        rowData.getCell(3).value = item.product_name; // Ten Hang
        rowData.getCell(4).value = item.unit; // SKU/Unit
        rowData.getCell(5).value = item.quantity; // SL
        rowData.getCell(6).value = item.unit_price; // Don Gia
        rowData.getCell(7).value = totalPrice; // Thanh Tien
        rowData.getCell(8).value = item.serial_code || ''; // Serial

        // Styles
        for (let i = 1; i <= 8; i++) {
            const cell = rowData.getCell(i);
            cell.border = borderStyle;
            cell.font = fontTableBody;
            cell.alignment = { vertical: 'middle', wrapText: true };
            if (i === 1 || i === 4 || i === 5) cell.alignment.horizontal = 'center'; // Center STT, Unit, Qty
            if (i === 6 || i === 7) {
                cell.numFmt = '#,##0'; // Money format
                cell.alignment.horizontal = 'right';
            }
        }
        currentRow++;
    });

    // Total Row
    const totalRow = sheet.addRow(['TỔNG CỘNG', '', '', '', totalQty, '', totalAll, '']);
    sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
    totalRow.eachCell((cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } }; // Blueish grey from image
        cell.font = { ...fontTableHead, size: 10 };
        cell.border = borderStyle as any;
        cell.alignment = { vertical: 'middle' };
        if (colNumber === 1) cell.alignment.horizontal = 'center'; // "TONG CONG" center
        if (colNumber === 5) cell.alignment.horizontal = 'center'; // Qty center
        if (colNumber === 7) {
            cell.alignment.horizontal = 'right'; // Amount right
            cell.numFmt = '#,##0';
        }
    });

    // Text Amount
    const textRow = sheet.addRow([`Tổng số tiền (viết bằng chữ): ${readMoney(totalAll)}`]);
    sheet.mergeCells(`A${textRow.number}:H${textRow.number}`);
    const textCell = sheet.getCell(`A${textRow.number}`);
    textCell.font = { ...fontNormal, bold: true, italic: true };
    textCell.alignment = { horizontal: 'left' };
    textCell.border = borderStyle as any; // Box it

    // Note
    const noteRow = sheet.addRow(['Lưu ý : Kiểm tra trước khi đi,mọi khiếu nại về sau không giải quyết.Trân trọng ! (Truy cập xem biên bản điện tử tại app/In biên bản bàn giao)']);
    sheet.mergeCells(`A${noteRow.number}:H${noteRow.number}`);
    sheet.getCell(`A${noteRow.number}`).font = { ...fontNormal, italic: true };
    sheet.getCell(`A${noteRow.number}`).alignment = { horizontal: 'left' };

    sheet.addRow([]);

    // Signatures
    // User requested: Ben Giao (A-B), Ben Nhan (G-H)
    const sigHeader = sheet.addRow(['BÊN GIAO', '', '', '', '', '', 'BÊN NHẬN', '']);
    sheet.mergeCells(`A${sigHeader.number}:B${sigHeader.number}`);
    sheet.mergeCells(`G${sigHeader.number}:H${sigHeader.number}`);
    sheet.getCell(`A${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigHeader.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`G${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`G${sigHeader.number}`).alignment = { horizontal: 'center' };

    const sigTitle = sheet.addRow(['(Ký, họ tên)', '', '', '', '', '', '(Ký, họ tên)', '']);
    sheet.mergeCells(`A${sigTitle.number}:B${sigTitle.number}`);
    sheet.mergeCells(`G${sigTitle.number}:H${sigTitle.number}`);
    sheet.getCell(`A${sigTitle.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`G${sigTitle.number}`).alignment = { horizontal: 'center' };

    sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);

    const sigName = sheet.addRow([reporterName, '', '', '', '', '', receiverName, '']);
    sheet.mergeCells(`A${sigName.number}:B${sigName.number}`);
    sheet.mergeCells(`G${sigName.number}:H${sigName.number}`);
    sheet.getCell(`A${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigName.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`G${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`G${sigName.number}`).alignment = { horizontal: 'center' };



    const buffer = await workbook.xlsx.writeBuffer();
    // Fix filename font error: Convert Vietnamese to ASCII before saving
    const safeName = removeVietnameseTones(receiverName)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_'); // Collapse multiple underscores

    saveAs(new Blob([buffer]), `BBBG_${safeName}_${dateStr}.xlsx`);
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};
