import ExcelJS from 'exceljs';
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

// Helper: Download ArrayBuffer using FileSaver
import { saveAs } from 'file-saver';

export const downloadAsDataUri = (buffer: ArrayBuffer | Uint8Array, fileName: string) => {
    const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, fileName);
};


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

// Helper to calculate auto row height based on text content and column widths
const calculateRowHeight = (row: ExcelJS.Row, columnsConfig: { width?: number }[], defaultHeight = 22, lineMultiplier = 14) => {
    let maxHeight = defaultHeight;
    row.eachCell((cell, colNumber) => {
        const colWidth = columnsConfig[colNumber - 1]?.width || 10;
        const value = cell.value;
        let text = '';
        if (value !== null && value !== undefined) {
            if (typeof value === 'object' && 'richText' in value) {
                text = value.richText.map((t: any) => t.text).join('');
            } else {
                text = String(value);
            }
        }
        if (text) {
            const lines = text.split('\n');
            let totalLines = 0;
            lines.forEach(line => {
                const charsPerLine = Math.max(1, Math.floor(colWidth * 0.85));
                totalLines += Math.ceil(line.length / charsPerLine);
            });
            const cellHeight = totalLines * lineMultiplier + 6; // Add small padding
            if (cellHeight > maxHeight) {
                maxHeight = cellHeight;
            }
        }
    });
    return maxHeight;
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
        for (let i = 1; i <= totalCols; i++) {
            const cell = row.getCell(i);
            cell.font = fontNormal;
            cell.border = borderStyle as any;
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: columns[i - 1].align || 'left' };
        }
        const colWidths = columns.map(c => ({ width: sheet.getColumn(c.key).width || c.width || 10 }));
        row.height = calculateRowHeight(row, colWidths, 22, 14);
    });

    sheet.addRow([]);

    // --- FOOTER ---
    const lastRow = sheet.rowCount + 1;
    if (totalCols >= 6) {
        sheet.mergeCells(lastRow, 1, lastRow, 3); // Left Signature (Optional)
        sheet.mergeCells(lastRow, totalCols - 2, lastRow, totalCols); // Right Signature (Reporter)
    } else if (totalCols >= 4) {
        sheet.mergeCells(lastRow, 1, lastRow, 2); 
        sheet.mergeCells(lastRow, totalCols - 1, lastRow, totalCols);
    } else {
        // Very few columns, avoid merging multiple cells
        // Fallback to single cells if needed, or don't merge
    }

    const cSigRight = sheet.getCell(lastRow, totalCols >= 4 ? (totalCols >= 6 ? totalCols - 2 : totalCols - 1) : totalCols);
    cSigRight.value = 'NGƯỜI LẬP BIỂU';
    cSigRight.font = { ...fontNormal, bold: true };
    cSigRight.alignment = { horizontal: 'center' };

    const nameRow = lastRow + 4;
    if (totalCols >= 6) {
        sheet.mergeCells(nameRow, totalCols - 2, nameRow, totalCols);
    } else if (totalCols >= 4) {
        sheet.mergeCells(nameRow, totalCols - 1, nameRow, totalCols);
    }
    const cNameRight = sheet.getCell(nameRow, totalCols >= 4 ? (totalCols >= 6 ? totalCols - 2 : totalCols - 1) : totalCols);
    cNameRight.value = reporterName;
    cNameRight.font = { ...fontNormal, bold: true };
    cNameRight.alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, `${fileName}.xlsx`);
};

// --- LEGACY EXPORTS (converted to ExcelJS) ---
export const exportToExcel = async (data: any[], fileName: string, sheetName: string = 'Sheet1', options?: { title?: string; reporter?: string; }) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    
    let currentRow = 1;
    if (options?.title) {
        sheet.mergeCells(currentRow, 1, currentRow, 6);
        sheet.getCell(currentRow, 1).value = options.title.toUpperCase();
        currentRow++;
    }
    if (options?.reporter) {
        sheet.getCell(currentRow, 1).value = 'Người lập báo cáo:';
        sheet.getCell(currentRow, 2).value = options.reporter;
        currentRow++;
    }
    const now = new Date();
    sheet.getCell(currentRow, 1).value = 'Thời gian xuất:';
    sheet.getCell(currentRow, 2).value = `${now.toLocaleTimeString('vi-VN')} - ${now.toLocaleDateString('vi-VN')}`;
    currentRow += 2; // Add a blank line

    const tableKeys = data.length > 0 ? Object.keys(data[0]) : [];
    sheet.getRow(currentRow).values = tableKeys;
    currentRow++;

    data.forEach(row => {
        const rowValues = tableKeys.map(key => row[key] !== undefined && row[key] !== null ? row[key] : '');
        sheet.getRow(currentRow).values = rowValues;
        currentRow++;
    });

    sheet.columns = tableKeys.map(key => ({ width: Math.max(key.length, 20) }));

    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, `${fileName}.xlsx`);
};

const generateTemplateFromHeaders = async (headers: any[], colsConfig: number[], sheetName: string, fileName: string) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sheetName);
    
    const keys = Object.keys(headers[0]);
    sheet.addRow(keys);
    sheet.addRow(Object.values(headers[0]));
    
    sheet.columns = colsConfig.map(wch => ({ width: wch }));
    
    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, fileName);
};

export const generateProductTemplate = () => {
    const headers = [{ MA_HANG: "SP001", TEN_HANG_HOA: "Sản phẩm mẫu", LOAI_DM: "Hàng hóa", DON_GIA: 100000, DON_VI: "Cái", LOAI_HANG: "Thường" }];
    generateTemplateFromHeaders(headers, [15, 30, 20, 15, 10, 15], "ProductTemplate", "ProductImportTemplate.xlsx");
};
export const generateEmployeeTemplate = () => {
    const headers = [{
        MA_NHAN_VIEN: "NV001",
        HO_TEN: "Nguyễn Văn A",
        GIOI_TINH: "Nam",
        NGAY_SINH: "15/10/1995",
        SO_DIEN_THOAI: "0901234567",
        EMAIL: "nguyenvan.a@example.com",
        VI_TRI_CONG_VIEC: "Nhân viên Kỹ thuật",
        DON_VI_CONG_TAC: "Trung tâm ACT BSG",
        NGAY_THU_VIEC: "01/01/2024",
        NGAY_CHINH_THUC: "01/03/2024",
        LOAI_HOP_DONG: "HĐ lao động xác định thời hạn",
        TRANG_THAI_LAO_DONG: "Đang làm việc",
        THAM_GIA_BAO_HIEM: "Có",
        VAI_TRO: "staff",
        TEN_DANG_NHAP: "nguyenvana",
        QUAN_HUYEN: "Quận 12"
    }];
    generateTemplateFromHeaders(
        headers, 
        [15, 25, 12, 15, 15, 30, 20, 25, 15, 15, 30, 20, 20, 15, 20, 15], 
        "EmployeeTemplate", 
        "EmployeeImportTemplate.xlsx"
    );
};
export const generateInboundTemplate = () => {
    const headers = [{ MA_HANG: "SP001", SO_LUONG: 10, DON_GIA: 150000, SERIAL: "SN123456", GHI_CHU: "Nhập hàng đợt 1", QUAN_HUYEN: "Quận 1", TRANG_THAI_HANG: "Mới 100%" }];
    generateTemplateFromHeaders(headers, [15, 10, 15, 20, 30, 15, 20], "InboundTemplate", "InboundImportTemplate.xlsx");
};
export const generateOutboundTemplate = () => {
    const headers = [{ MA_HANG: "SP001", SO_LUONG: 5, EMAIL_NGUOI_NHAN: "nguyenvan.a@example.com", SERIAL: "SN123", GHI_CHU: "Xuất cho dự án A", QUAN_HUYEN: "Quận 3", TRANG_THAI_HANG: "Đã qua sử dụng" }];
    generateTemplateFromHeaders(headers, [15, 10, 30, 20, 30, 15, 20], "OutboundTemplate", "OutboundImportTemplate.xlsx");
};

export const readExcelFile = async (file: File, headerRow: number = 1): Promise<any[]> => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    
    const json: any[] = [];
    if (!worksheet) return json;
    
    const headers: string[] = [];
    worksheet.getRow(headerRow).eachCell((cell, colNumber) => {
        headers[colNumber] = cell.text?.trim() || '';
    });
    
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRow) return; // skip header row(s) above
        const obj: any = {};
        let hasData = false;
        row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
                let val = cell.value;
                if (val && typeof val === 'object') {
                    if ('formula' in val) {
                        val = (val as ExcelJS.CellFormulaValue).result;
                    } else if ('richText' in val) {
                        val = (val as ExcelJS.CellRichTextValue).richText.map(t => t.text).join('');
                    }
                }
                obj[header] = val;
                if (val !== null && val !== undefined && val !== '') hasData = true;
            }
        });
        if (hasData) json.push(obj);
    });
    return json;
};

// Auto-detect header row by scanning for "Mã tài sản" keyword
export const readAssetExcelFile = async (file: File): Promise<any[]> => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);
    const worksheet = workbook.worksheets[0];
    
    if (!worksheet) return [];

    // Scan first 10 rows to find the header row
    let detectedHeaderRow = 1;
    for (let r = 1; r <= 10; r++) {
        const row = worksheet.getRow(r);
        let foundHeader = false;
        row.eachCell((cell) => {
            const text = cell.text?.trim() || '';
            if (text === 'Mã tài sản' || text === 'Tên tài sản' || text === 'asset_code') {
                foundHeader = true;
            }
        });
        if (foundHeader) {
            detectedHeaderRow = r;
            break;
        }
    }

    // Read headers from detected row
    const headers: string[] = [];
    worksheet.getRow(detectedHeaderRow).eachCell((cell, colNumber) => {
        // Strip parenthetical hints like "(dd/mm/yyyy)" or "(TRUE/FALSE)"
        const text = (cell.text?.trim() || '').replace(/\s*\(.*?\)\s*$/, '').trim();
        headers[colNumber] = text;
    });

    const json: any[] = [];
    const sampleValues = Object.values({
        'Mã tài sản': 'TS-2024-001',
        'Tên tài sản': 'Máy tính xách tay Dell Latitude 5540',
    });

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= detectedHeaderRow) return;

        const obj: any = {};
        let hasData = false;
        row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (!header) return;

            let val = cell.value;
            if (val && typeof val === 'object') {
                if ('formula' in val) {
                    val = (val as ExcelJS.CellFormulaValue).result;
                } else if ('richText' in val) {
                    val = (val as ExcelJS.CellRichTextValue).richText.map(t => t.text).join('');
                }
            }
            obj[header] = val;
            if (val !== null && val !== undefined && val !== '') hasData = true;
        });

        if (hasData) json.push(obj);
    });

    return json;
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

    const originalMerge = sheet.mergeCells.bind(sheet);
    (sheet as any).mergeCells = function() {
        try {
            return originalMerge.apply(sheet, arguments as any);
        } catch (e: any) {
            const range = Array.from(arguments).join(', ');
            console.error(`ERROR MERGING CELLS: ${range}`, e);
            if (e && e.message) {
                e.message = `[Overlap tại ${range}] ` + e.message;
            }
            throw e;
        }
    };

    // --- STYLES ---
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
    sheet.mergeCells('A1:D1');
    sheet.getCell('A1').value = "CÔNG TY CỔ PHẦN VIỄN THÔNG ACT";
    sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('A1').font = fontBoldBlue; // Blue

    sheet.mergeCells('A2:D2');
    sheet.getCell('A2').value = "TRUNG TÂM ACT BẮC SÀI GÒN";
    sheet.getCell('A2').alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    sheet.getCell('A2').font = fontBoldBlue;

    // Row 1: Right Side (Mẫu số...)
    sheet.mergeCells('G1:H1');
    sheet.getCell('G1').value = "Mẫu số: 01 - VT";
    sheet.getCell('G1').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('G1').font = { name: 'Times New Roman', size: 10, bold: true };

    sheet.mergeCells('G2:H2');
    sheet.getCell('G2').value = "Ban hành theo QĐ số";
    sheet.getCell('G2').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('G2').font = { name: 'Times New Roman', size: 9 };

    sheet.mergeCells('G3:H3');
    sheet.getCell('G3').value = "1141-TC/QĐ/CĐKT";
    sheet.getCell('G3').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('G3').font = { name: 'Times New Roman', size: 9 };

    sheet.mergeCells('G4:H4');
    sheet.getCell('G4').value = "Ngày 01 tháng 11 năm 1995";
    sheet.getCell('G4').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('G4').font = { name: 'Times New Roman', size: 9 };

    sheet.mergeCells('G5:H5');
    sheet.getCell('G5').value = "của bộ tài chính";
    sheet.getCell('G5').alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getCell('G5').font = { name: 'Times New Roman', size: 9 };

    // Title
    sheet.mergeCells('A6:H6');
    sheet.getCell('A6').value = "PHIẾU XUẤT KHO";
    sheet.getCell('A6').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A6').font = { ...fontHeader, size: 20 }; // Red, Bold, 20

    // Date
    const [y, m, d] = dateStr.split('-');
    sheet.mergeCells('A7:H7');
    sheet.getCell('A7').value = `Ngày ${d} tháng ${m} năm ${y}`;
    sheet.getCell('A7').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A7').font = { name: 'Times New Roman', size: 11, color: { argb: 'FF0000FF' } }; // Blue

    // Report Number
    sheet.mergeCells('A8:H8');
    sheet.getCell('A8').value = `Số phiếu : PXK-ACT-BSG-${String(reportNumber).padStart(6, '0')}/${m}-${y}`;
    sheet.getCell('A8').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getCell('A8').font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FF1e4b9b' } };

    // Spacer
    sheet.addRow([]);

    // --- INFO SECTION ---
    let currentRow = 11;
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
        const colWidths = [6, 25, 60, 8, 8, 14, 18, 45];
        rowData.height = calculateRowHeight(rowData, colWidths.map(w => ({ width: w })), 22, 14);
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
    const sigHeader = sheet.addRow(['Người nhận', '', '', 'Thủ kho', '', 'Thủ trưởng đơn vị', '', '']);
    sheet.mergeCells(`A${sigHeader.number}:C${sigHeader.number}`);
    sheet.mergeCells(`D${sigHeader.number}:E${sigHeader.number}`);
    sheet.mergeCells(`F${sigHeader.number}:H${sigHeader.number}`);
    
    sheet.getCell(`A${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigHeader.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`D${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`D${sigHeader.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`F${sigHeader.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`F${sigHeader.number}`).alignment = { horizontal: 'center' };

    const sigTitle = sheet.addRow(['(Ký, họ tên)', '', '', '(Ký, họ tên)', '', '(Ký, họ tên)', '', '']);
    sheet.mergeCells(`A${sigTitle.number}:C${sigTitle.number}`);
    sheet.mergeCells(`D${sigTitle.number}:E${sigTitle.number}`);
    sheet.mergeCells(`F${sigTitle.number}:H${sigTitle.number}`);
    
    sheet.getCell(`A${sigTitle.number}`).font = { ...fontNormal, italic: true };
    sheet.getCell(`A${sigTitle.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`D${sigTitle.number}`).font = { ...fontNormal, italic: true };
    sheet.getCell(`D${sigTitle.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`F${sigTitle.number}`).font = { ...fontNormal, italic: true };
    sheet.getCell(`F${sigTitle.number}`).alignment = { horizontal: 'center' };

    sheet.addRow([]); sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);

    const sigName = sheet.addRow([receiverName, '', '', reporterName, '', 'TRẦN KIM HÙNG', '', '']);
    sheet.mergeCells(`A${sigName.number}:C${sigName.number}`);
    sheet.mergeCells(`D${sigName.number}:E${sigName.number}`);
    sheet.mergeCells(`F${sigName.number}:H${sigName.number}`);
    
    sheet.getCell(`A${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`A${sigName.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`D${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`D${sigName.number}`).alignment = { horizontal: 'center' };
    sheet.getCell(`F${sigName.number}`).font = { ...fontNormal, bold: true };
    sheet.getCell(`F${sigName.number}`).alignment = { horizontal: 'center' };



    const buffer = await workbook.xlsx.writeBuffer();
    // Fix filename font error: Convert Vietnamese to ASCII before saving
    const safeName = removeVietnameseTones(receiverName)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_'); // Collapse multiple underscores

    downloadAsDataUri(buffer, `BBBG_${safeName}_${dateStr}.xlsx`);
};

export const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// ── ASSET IMPORT TEMPLATE ─────────────────────────────────────────────────────
export const generateAssetTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh_Sach_Tai_San', {
        pageSetup: {
            paperSize: 9,
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
    });

    // ── Column definitions: [fieldKey, headerVietnamese, width, isRequired]
    const columns: [string, string, number, boolean][] = [
        ['Mã tài sản',                      'Mã tài sản',                               18, true],
        ['Tên tài sản',                      'Tên tài sản',                              35, true],
        ['Mã loại tài sản',                  'Mã loại tài sản',                          18, false],
        ['Loại tài sản',                     'Loại tài sản',                             25, false],
        ['Nhóm tài sản',                     'Nhóm tài sản',                             25, false],
        ['Bộ tài sản',                       'Bộ tài sản',                               20, false],
        ['Số lượng',                         'Số lượng',                                 12, true],
        ['Đơn vị tính',                      'Đơn vị tính',                              14, false],
        ['Đơn giá',                          'Đơn giá',                                  18, false],
        ['Giá trị',                          'Giá trị',                                  18, false],
        ['Tình trạng',                       'Tình trạng',                               20, false],
        ['Mã NQL',                           'Mã NQL',                                   15, false],
        ['Người quản lý',                    'Người quản lý',                            25, false],
        ['Mã ĐVQL',                          'Mã ĐVQL',                                  15, false],
        ['Đơn vị quản lý',                   'Đơn vị quản lý',                           25, false],
        ['Mã vị trí TS',                     'Mã vị trí TS',                             15, false],
        ['Vị trí tài sản',                   'Vị trí tài sản',                           25, false],
        ['Ngày nhận',                        'Ngày nhận (dd/mm/yyyy)',                    22, false],
        ['Đối tượng sử dụng',               'Đối tượng sử dụng',                        22, false],
        ['Mã nhân viên SD',                  'Mã nhân viên SD',                          18, false],
        ['Nhân viên sử dụng',               'Nhân viên sử dụng',                        28, false],
        ['Mã phòng ban SD',                  'Mã phòng ban SD',                          18, false],
        ['Phòng ban sử dụng',               'Phòng ban sử dụng',                        28, false],
        ['Mã người ĐD',                      'Mã người ĐD',                              15, false],
        ['Người đại diện',                   'Người đại diện',                           25, false],
        ['Lần đầu sử dụng',                 'Lần đầu sử dụng (dd/mm/yyyy)',             28, false],
        ['Số serial',                        'Số serial',                                20, false],
        ['Quy cách tài sản',                'Quy cách tài sản',                         30, false],
        ['Linh kiện đính kèm',              'Linh kiện đính kèm',                       30, false],
        ['Nội dung bảo dưỡng',             'Nội dung bảo dưỡng',                       30, false],
        ['Xác định BD theo',               'Xác định BD theo',                          22, false],
        ['Thời điểm bắt đầu BD',           'Thời điểm bắt đầu BD',                    25, false],
        ['Bảo dưỡng lặp lại theo',         'Bảo dưỡng lặp lại theo',                  25, false],
        ['Công suất bắt đầu BD',           'Công suất bắt đầu BD',                    22, false],
        ['BD lại sau',                       'BD lại sau',                               15, false],
        ['Nguồn gốc',                        'Nguồn gốc',                                20, false],
        ['Mã NCC',                           'Mã NCC',                                   15, false],
        ['Nhà cung cấp',                     'Nhà cung cấp',                             30, false],
        ['Ngày mua',                         'Ngày mua (dd/mm/yyyy)',                    22, false],
        ['Số hợp đồng',                      'Số hợp đồng',                              20, false],
        ['Ghi chú',                          'Ghi chú',                                  30, false],
        ['Giá trị tính KH/PB',              'Giá trị tính KH/PB',                       22, false],
        ['Kỳ KH/PB',                         'Kỳ KH/PB',                                 15, false],
        ['Ngày bắt đầu tính KH/PB',        'Ngày bắt đầu tính KH/PB (dd/mm/yyyy)',    35, false],
        ['KH/PB lũy kế',                     'KH/PB lũy kế',                             18, false],
        ['Thời gian còn lại',               'Thời gian còn lại',                        22, false],
        ['Giá trị còn lại',                 'Giá trị còn lại',                          20, false],
        ['Là tài sản cố định',             'Là tài sản cố định (TRUE/FALSE)',          30, false],
        ['Mang ra ngoài',                   'Mang ra ngoài (TRUE/FALSE)',               25, false],
        ['Là tài sản dùng chung',          'Là tài sản dùng chung (TRUE/FALSE)',       30, false],
        ['Loại hình quản lý TS',           'Loại hình quản lý TS',                    25, false],
        ['Là TS thuê ngoài',               'Là TS thuê ngoài (TRUE/FALSE)',            28, false],
        ['Loại thuê',                        'Loại thuê',                                18, false],
    ];

    // ── Styles
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
    };

    // ── Row 1: Title
    sheet.mergeCells(1, 1, 1, columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'MẪU NHẬP LIỆU DANH SÁCH TÀI SẢN';
    titleCell.font = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FF1e4b9b' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } };
    sheet.getRow(1).height = 30;

    // ── Row 2: Instructions
    sheet.mergeCells(2, 1, 2, columns.length);
    const noteCell = sheet.getCell(2, 1);
    noteCell.value = '⚠️  Cột màu ĐỎ là bắt buộc (Mã tài sản, Tên tài sản, Số lượng). Cột màu XANH là tùy chọn. Không xóa hoặc thay đổi tiêu đề cột. Ngày tháng nhập theo định dạng dd/mm/yyyy.';
    noteCell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF7c3aed' } };
    noteCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf5f3ff' } };
    sheet.getRow(2).height = 28;

    // ── Row 3: Column number row (1, 2, 3...)
    const numRow = sheet.getRow(3);
    columns.forEach((_, i) => {
        const cell = numRow.getCell(i + 1);
        cell.value = i + 1;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF555555' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        cell.border = borderThin;
    });
    numRow.height = 18;

    // ── Row 4: Headers
    const headerRow = sheet.getRow(4);
    columns.forEach(([, header, , isRequired], i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = header;
        cell.font = {
            name: 'Times New Roman', size: 10, bold: true,
            color: { argb: isRequired ? 'FFCC0000' : 'FF1e4b9b' }
        };
        cell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: isRequired ? 'FFFFEBEB' : 'FFdbeafe' }
        };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderThin;
    });
    headerRow.height = 40;

    // ── Row 5: Sample data row
    const sampleData: Record<string, any> = {
        'Mã tài sản':                   'TS-2024-001',
        'Tên tài sản':                   'Máy tính xách tay Dell Latitude 5540',
        'Mã loại tài sản':              'MTXT',
        'Loại tài sản':                  'Thiết bị CNTT',
        'Nhóm tài sản':                  'Máy tính',
        'Bộ tài sản':                    '',
        'Số lượng':                      1,
        'Đơn vị tính':                   'Cái',
        'Đơn giá':                       25000000,
        'Giá trị':                       25000000,
        'Tình trạng':                    'Đang sử dụng',
        'Mã NQL':                        'NV001',
        'Người quản lý':                 'Nguyễn Văn A',
        'Mã ĐVQL':                       'PHONG-IT',
        'Đơn vị quản lý':               'Phòng Công nghệ thông tin',
        'Mã vị trí TS':                 'VP-Q12-T2',
        'Vị trí tài sản':               'Văn phòng Quận 12 - Tầng 2',
        'Ngày nhận':                     '15/01/2024',
        'Đối tượng sử dụng':           'Nhân viên',
        'Mã nhân viên SD':              'NV002',
        'Nhân viên sử dụng':           'Trần Thị B',
        'Mã phòng ban SD':             'PHONG-IT',
        'Phòng ban sử dụng':          'Phòng Công nghệ thông tin',
        'Mã người ĐD':                  'NV001',
        'Người đại diện':              'Nguyễn Văn A',
        'Lần đầu sử dụng':            '20/01/2024',
        'Số serial':                     'DELL-SN-20240115',
        'Quy cách tài sản':            'Intel Core i7, RAM 16GB, SSD 512GB',
        'Linh kiện đính kèm':         'Sạc pin, túi đựng',
        'Nội dung bảo dưỡng':        'Vệ sinh, kiểm tra phần cứng',
        'Xác định BD theo':           'Thời gian',
        'Thời điểm bắt đầu BD':      '01/01/2024',
        'Bảo dưỡng lặp lại theo':    'Năm',
        'Công suất bắt đầu BD':      '',
        'BD lại sau':                   '12 tháng',
        'Nguồn gốc':                    'Mua mới',
        'Mã NCC':                        'NCC-DELL-VN',
        'Nhà cung cấp':                 'Công ty Dell Việt Nam',
        'Ngày mua':                      '10/01/2024',
        'Số hợp đồng':                  'HĐ-2024-001',
        'Ghi chú':                       'Bảo hành 3 năm',
        'Giá trị tính KH/PB':         25000000,
        'Kỳ KH/PB':                      '36 tháng',
        'Ngày bắt đầu tính KH/PB':  '01/02/2024',
        'KH/PB lũy kế':                 0,
        'Thời gian còn lại':          '36 tháng',
        'Giá trị còn lại':             25000000,
        'Là tài sản cố định':         'TRUE',
        'Mang ra ngoài':               'FALSE',
        'Là tài sản dùng chung':    'FALSE',
        'Loại hình quản lý TS':      'Tự có',
        'Là TS thuê ngoài':          'FALSE',
        'Loại thuê':                     '',
    };

    const sampleRow = sheet.getRow(5);
    columns.forEach(([key], i) => {
        const cell = sampleRow.getCell(i + 1);
        cell.value = sampleData[key] ?? '';
        cell.font = { name: 'Times New Roman', size: 10, italic: true, color: { argb: 'FF444444' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFDE7' } };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = borderThin;
        // Format number cells
        if (typeof sampleData[key] === 'number') {
            cell.numFmt = '#,##0';
            cell.alignment.horizontal = 'right';
        }
    });
    sampleRow.height = 22;

    // ── Row 6+: Empty data rows (ready to fill in)
    for (let r = 6; r <= 106; r++) {
        const row = sheet.getRow(r);
        columns.forEach((_, i) => {
            const cell = row.getCell(i + 1);
            cell.border = borderThin;
            cell.font = { name: 'Times New Roman', size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
        });
        row.height = 18;
    }

    // ── Set column widths
    columns.forEach(([, , width], i) => {
        sheet.getColumn(i + 1).width = width;
    });

    // ── Freeze header rows
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, 'Mau_Import_Tai_San.xlsx');
};

export const exportHandoverHistory = async (history: any[], fileName: string) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lich_Su_Ban_Giao', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0
        }
    });

    const fontHeader = { name: 'Times New Roman', size: 14, bold: true, color: { argb: 'FF1e4b9b' } };
    const fontTableHead = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FF000000' } };
    const fontTableBody = { name: 'Times New Roman', size: 11 };
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Set columns
    sheet.columns = [
        { key: 'stt', width: 6 },
        { key: 'created_at', width: 20 },
        { key: 'template_type', width: 15 },
        { key: 'action_type', width: 15 },
        { key: 'receiver_name', width: 25 },
        { key: 'receiver_title', width: 20 },
        { key: 'receiver_dept', width: 25 },
        { key: 'giver_1', width: 25 },
        { key: 'giver_2', width: 25 },
        { key: 'total_quantity', width: 12 },
        { key: 'items_detail', width: 50 },
        { key: 'created_by', width: 20 },
    ];

    // Header Title
    sheet.mergeCells(1, 1, 1, 12);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'DANH SÁCH LỊCH SỬ BÀN GIAO & THU HỒI CCDC - BHLĐ';
    titleCell.font = fontHeader;
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 30;

    // Time Exported
    sheet.mergeCells(2, 1, 2, 12);
    const timeCell = sheet.getCell(2, 1);
    const now = new Date();
    timeCell.value = `Thời gian xuất báo cáo: ${now.toLocaleTimeString('vi-VN')} - ${now.toLocaleDateString('vi-VN')}`;
    timeCell.font = { name: 'Times New Roman', size: 10, italic: true };
    timeCell.alignment = { horizontal: 'center' };

    sheet.addRow([]); // Blank row

    // Table Header Row
    const headers = [
        'STT', 'Thời gian', 'Loại mẫu', 'Tác vụ', 'Người nhận', 
        'Chức vụ người nhận', 'Đơn vị người nhận', 
        'Người giao 1', 'Người giao 2', 'Tổng SL', 'Chi tiết trang bị', 'Người tạo'
    ];
    
    const headRow = sheet.addRow(headers);
    headRow.height = 25;
    headRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = fontTableHead;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderThin;
    });

    // Populate Data
    history.forEach((h, index) => {
        const dateVal = new Date(h.created_at).toLocaleString('vi-VN');
        const templateVal = h.template_type === 'bhl' ? 'Mẫu BHLĐ' : 'Mẫu TSCĐ';
        
        let actionVal = 'Bàn giao';
        if (h.action_type === 'revoke') actionVal = 'Thu hồi';
        else if (h.action_type === 'transfer') actionVal = 'Điều chuyển';

        const giver1 = h.giver_info ? `${h.giver_info.giverName} (${h.giver_info.giverPhone || ''})` : '';
        const giver2 = h.giver_info && h.giver_info.giverName2 ? `${h.giver_info.giverName2} (${h.giver_info.giverPhone2 || ''})` : '';

        // Format items list details
        let itemsDetail = '';
        if (Array.isArray(h.items)) {
            itemsDetail = h.items.map((item: any) => {
                const name = item.name || item.asset_name || '';
                const qty = item.quantity !== undefined ? item.quantity : 1;
                const serial = item.serial || item.serial_number ? ` [SN: ${item.serial || item.serial_number}]` : '';
                return `${name} (${qty})${serial}`;
            }).join(', ');
        }

        const rowValues = [
            index + 1,
            dateVal,
            templateVal,
            actionVal,
            h.receiver_name || '',
            h.receiver_title || '',
            h.receiver_dept || '',
            giver1,
            giver2,
            h.total_quantity || 0,
            itemsDetail,
            h.created_by || ''
        ];

        const row = sheet.addRow(rowValues);
        for (let i = 1; i <= 12; i++) {
            const cell = row.getCell(i);
            cell.font = fontTableBody;
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', wrapText: true };
            if ([1, 2, 3, 4, 10, 12].includes(i)) {
                cell.alignment.horizontal = 'center';
            }
        }
        row.height = calculateRowHeight(row, [
            { width: 6 }, { width: 20 }, { width: 15 }, { width: 15 },
            { width: 25 }, { width: 20 }, { width: 25 }, { width: 25 },
            { width: 25 }, { width: 12 }, { width: 50 }, { width: 20 }
        ], 22, 14);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, `${fileName}.xlsx`);
};

export const exportAssetReport = async (assets: any[], reporterName: string = 'Admin') => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Bao_Cao_Tai_San', {
        pageSetup: {
            paperSize: 9, // A4
            orientation: 'landscape',
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        }
    });

    const fontTitle = { name: 'Times New Roman', size: 16, bold: true, color: { argb: 'FFFF0000' } };
    const fontBoldBlue = { name: 'Times New Roman', bold: true, color: { argb: 'FF0070C0' }, size: 11 };
    const fontTableHead = { name: 'Times New Roman', size: 11, bold: true };
    const fontTableBody = { name: 'Times New Roman', size: 11 };
    const fontNormal = { name: 'Times New Roman', size: 11 };
    const borderThin: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' }
    };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    const columns = [
        { header: 'STT', key: 'stt', width: 6, align: 'center' },
        { header: 'MÃ TÀI SẢN', key: 'asset_code', width: 18, align: 'left' },
        { header: 'TÊN TÀI SẢN', key: 'asset_name', width: 35, align: 'left' },
        { header: 'LOẠI TÀI SẢN', key: 'asset_type', width: 20, align: 'left' },
        { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
        { header: 'ĐƠN VỊ TÍNH', key: 'unit', width: 12, align: 'center' },
        { header: 'ĐƠN GIÁ', key: 'unit_price', width: 16, align: 'right' },
        { header: 'GIÁ TRỊ', key: 'total_value', width: 16, align: 'right' },
        { header: 'TÌNH TRẠNG', key: 'status', width: 15, align: 'center' },
        { header: 'VỊ TRÍ', key: 'location_name', width: 22, align: 'left' },
        { header: 'NGƯỜI SỬ DỤNG', key: 'user_employee_name', width: 22, align: 'left' },
        { header: 'PHÒNG BAN', key: 'user_department_name', width: 25, align: 'left' },
        { header: 'SỐ SERIAL', key: 'serial_number', width: 18, align: 'left' },
        { header: 'NGÀY MUA', key: 'purchase_date', width: 14, align: 'center' }
    ];

    sheet.columns = columns.map(c => ({ key: c.key, width: c.width }));

    // Company info
    sheet.mergeCells('A1:F1');
    sheet.getCell('A1').value = "CÔNG TY CỔ PHẦN VIỄN THÔNG ACT";
    sheet.getCell('A1').font = fontBoldBlue;
    sheet.getCell('A1').alignment = { horizontal: 'left' };

    sheet.mergeCells('A2:F2');
    sheet.getCell('A2').value = "TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN";
    sheet.getCell('A2').font = { ...fontBoldBlue, size: 10 };
    sheet.getCell('A2').alignment = { horizontal: 'left' };

    // National Title
    sheet.mergeCells('H1:N1');
    sheet.getCell('H1').value = "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM";
    sheet.getCell('H1').font = fontBoldBlue;
    sheet.getCell('H1').alignment = { horizontal: 'center' };

    sheet.mergeCells('H2:N2');
    sheet.getCell('H2').value = "Độc lập - Tự do - Hạnh phúc";
    sheet.getCell('H2').font = { ...fontBoldBlue, size: 10, italic: true };
    sheet.getCell('H2').alignment = { horizontal: 'center' };

    // Report Title
    sheet.mergeCells('A4:N4');
    sheet.getCell('A4').value = "BÁO CÁO CHI TIẾT DANH SÁCH TÀI SẢN";
    sheet.getCell('A4').font = fontTitle;
    sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(4).height = 28;

    // Date
    const dateObj = new Date();
    sheet.mergeCells('A5:N5');
    sheet.getCell('A5').value = `Ngày ${dateObj.getDate()} tháng ${dateObj.getMonth() + 1} năm ${dateObj.getFullYear()}`;
    sheet.getCell('A5').font = { name: 'Times New Roman', size: 11, italic: true, color: { argb: 'FF0070C0' } };
    sheet.getCell('A5').alignment = { horizontal: 'center' };

    sheet.addRow([]);

    // Table Header Row
    const headerRow = sheet.addRow(columns.map(c => c.header));
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = fontTableHead;
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = borderThin;
    });

    // Populate Data
    let totalQty = 0;
    let totalVal = 0;

    assets.forEach((item, index) => {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        const val = Number(item.total_value) || (qty * price);
        
        totalQty += qty;
        totalVal += val;

        const rowValues = [
            index + 1,
            item.asset_code || '',
            item.asset_name || '',
            item.asset_type || '',
            qty,
            item.unit || 'Cái',
            price,
            val,
            item.status || 'Mới',
            item.location_name || '',
            item.user_employee_name || '-',
            item.user_department_name || '-',
            item.serial_number || '',
            item.purchase_date ? new Date(item.purchase_date).toLocaleDateString('vi-VN') : ''
        ];

        const row = sheet.addRow(rowValues);
        columns.forEach((col, i) => {
            const cell = row.getCell(i + 1);
            cell.font = fontTableBody;
            cell.border = borderThin;
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: col.align as any };
            
            // Format currency
            if (col.key === 'unit_price' || col.key === 'total_value') {
                cell.numFmt = '#,##0';
            }
        });
        row.height = calculateRowHeight(row, columns, 22, 14);
    });

    // Summary Row
    const totalRow = sheet.addRow([
        'TỔNG CỘNG', '', '', '', totalQty, '', '', totalVal, '', '', '', '', '', ''
    ]);
    sheet.mergeCells(`A${totalRow.number}:D${totalRow.number}`);
    totalRow.height = 24;
    columns.forEach((col, i) => {
        const cell = totalRow.getCell(i + 1);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } }; // Light blue
        cell.font = fontTableHead;
        cell.border = borderThin;
        cell.alignment = { vertical: 'middle' };
        
        if (i === 0) cell.alignment.horizontal = 'center';
        if (col.key === 'quantity') {
            cell.alignment.horizontal = 'center';
        }
        if (col.key === 'total_value') {
            cell.alignment.horizontal = 'right';
            cell.numFmt = '#,##0';
        }
    });

    sheet.addRow([]);

    // Signatures
    const lastRow = sheet.rowCount + 1;
    sheet.mergeCells(lastRow, 1, lastRow, 4);
    sheet.getCell(lastRow, 1).value = 'Thủ kho';
    sheet.getCell(lastRow, 1).font = { ...fontNormal, bold: true };
    sheet.getCell(lastRow, 1).alignment = { horizontal: 'center' };

    sheet.mergeCells(lastRow, 11, lastRow, 14);
    sheet.getCell(lastRow, 11).value = 'Người lập biểu';
    sheet.getCell(lastRow, 11).font = { ...fontNormal, bold: true };
    sheet.getCell(lastRow, 11).alignment = { horizontal: 'center' };

    const nameRow = lastRow + 4;
    sheet.mergeCells(nameRow, 1, nameRow, 4);
    sheet.getCell(nameRow, 1).value = 'VÕ THANH SONG';
    sheet.getCell(nameRow, 1).font = { ...fontNormal, bold: true };
    sheet.getCell(nameRow, 1).alignment = { horizontal: 'center' };

    sheet.mergeCells(nameRow, 11, nameRow, 14);
    sheet.getCell(nameRow, 11).value = reporterName.toUpperCase();
    sheet.getCell(nameRow, 11).font = { ...fontNormal, bold: true };
    sheet.getCell(nameRow, 11).alignment = { horizontal: 'center' };

    const buffer = await workbook.xlsx.writeBuffer();
    downloadAsDataUri(buffer, `Bao_Cao_Chi_Tiet_Tai_San_${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`);
};
