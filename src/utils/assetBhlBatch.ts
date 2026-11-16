import ExcelJS from 'exceljs';
import { createDefaultBhlItems, formatBhlItemNote, splitBhlItemNote, type BhlItem } from './assetBhlItems';
import type { HRProfile } from '../types';
import { formatPhone } from './format';

export interface BhlBatchEmployee {
    id: string;
    stt: number;
    employeeId: string;
    fullName: string;
    jobTitle: string;
    department: string;
    uniformSize: string;
    shoeSize: string;
    items: BhlItem[];
    generalNote: string;
    totalQuantity: number;
    selected: boolean;
}

/**
 * Downloads a binary buffer as a file in the browser using a temporary anchor element.
 */
export const downloadBufferAsFile = (buffer: ArrayBuffer | Uint8Array, fileName: string) => {
    if (typeof window === 'undefined') return;
    const blob = new Blob([buffer as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Generates and downloads a standardized Excel template for batch BHLĐ handover importing.
 */
export const generateBhlHandoverTemplate = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Danh_Sach_Nhan_BHLD', {
        views: [{ showGridLines: true, state: 'frozen', ySplit: 2 }]
    });

    // ── Row 1: Header Titles ──
    const headers = [
        'STT',
        'Mã NV',
        'Họ và tên (*)',
        'Chức vụ',
        'Đơn vị / Đội',
        'Size Quần áo',
        'Size Giày dép',
        'Dây đai 1 móc',
        'Dây đai 2 móc',
        'Mũ cứng bảo hộ',
        'Quần áo BHLĐ',
        'Áo bảo hộ mùa đông',
        'Giày BHLĐ',
        'Dép rọ',
        'Bảng tên nhân viên',
        'Áo gió',
        'Áo thun ACT',
        'Áo sơ mi',
        'Găng tay',
        'Ghi chú'
    ];

    const widths = [
        6,   // STT
        14,  // Mã NV
        26,  // Họ và tên
        22,  // Chức vụ
        30,  // Đơn vị
        14,  // Size Quần áo
        14,  // Size Giày dép
        15,  // Dây đai 1 móc
        15,  // Dây đai 2 móc
        16,  // Mũ cứng
        15,  // Quần áo
        18,  // Áo mùa đông
        14,  // Giày
        12,  // Dép rọ
        16,  // Bảng tên
        12,  // Áo gió
        14,  // Áo thun
        12,  // Áo sơ mi
        12,  // Găng tay
        25   // Ghi chú
    ];

    // Set columns
    sheet.columns = headers.map((header, idx) => ({
        header,
        key: `col_${idx}`,
        width: widths[idx]
    }));

    // Style row 1 (Main Header)
    const headerRow = sheet.getRow(1);
    headerRow.height = 30;

    headerRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Times New Roman', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

        // Color categories:
        // Cols 1-7: Employee info (Navy blue #003087)
        // Cols 8-19: Equipment quantities (Teal #0D5C75)
        // Col 20: Note (Slate #334155)
        if (colNumber <= 7) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003087' } };
        } else if (colNumber <= 19) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D5C75' } };
        } else {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        }

        cell.border = {
            top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            bottom: { style: 'medium', color: { argb: 'FFFFFFFF' } },
            left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
            right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
        };
    });

    // ── Row 2: Explanatory / Instruction Subheader ──
    const hintRow = sheet.addRow([
        '1', '2', '3', '4', '5', '6', '7',
        '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'
    ]);
    hintRow.height = 18;
    hintRow.eachCell((cell) => {
        cell.font = { name: 'Times New Roman', size: 8, italic: true, color: { argb: 'FF475569' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
    });

    // ── Sample Rows ──
    const sampleData = [
        [
            1, 'ACT001', 'LƯU TẤN THÀNH', 'Nhân viên Kỹ thuật CĐBR', 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn',
            'L', '42',
            1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 2,
            'Cấp mới định kỳ đợt 1'
        ],
        [
            2, 'ACT002', 'NGUYỄN VĂN AN', 'Nhân viên Kỹ thuật CĐBR', 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn',
            'XL', '41',
            1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1,
            ''
        ],
        [
            3, 'ACT003', 'TRẦN MINH TÂM', 'Trưởng nhóm Kỹ thuật', 'Trung tâm ACT Bắc Sài Gòn',
            'M', '40',
            1, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 2,
            'Cấp bổ sung trạm viễn thông'
        ]
    ];

    sampleData.forEach((rowVals) => {
        const row = sheet.addRow(rowVals);
        row.height = 22;
        row.eachCell((cell, colNumber) => {
            cell.font = { name: 'Times New Roman', size: 10 };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            // Text columns: Name (3), Title (4), Dept (5), Note (20) -> left
            // Number / size columns -> center
            const leftCols = [3, 4, 5, 20];
            cell.alignment = {
                vertical: 'middle',
                horizontal: leftCols.includes(colNumber) ? 'left' : 'center'
            };
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBufferAsFile(buffer, 'Mau_Import_Ban_Giao_BHLD.xlsx');
};

/**
 * Normalizes a string for loose, accent-insensitive keyword matching.
 */
const normalizeText = (text: string): string => {
    return (text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Parses an uploaded Excel file and returns an array of BhlBatchEmployee records.
 */
export const parseBhlHandoverExcel = async (
    file: File,
    hrProfiles: HRProfile[] = []
): Promise<BhlBatchEmployee[]> => {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error('File Excel không có sheet nào.');
    }

    // 1. Find Header Row (must contain "họ và tên" or "mã nv" or "họ tên")
    let headerRowNumber = -1;
    const colIndexMap: Record<string, number> = {};

    worksheet.eachRow((row, rowNumber) => {
        if (headerRowNumber !== -1) return;
        const rowCells: string[] = [];
        row.eachCell((cell) => {
            rowCells.push(normalizeText(cell.text || String(cell.value || '')));
        });

        const hasName = rowCells.some(c => c.includes('ho va ten') || c.includes('ho ten') || c.includes('ten'));
        const hasId = rowCells.some(c => c.includes('ma nv') || c.includes('manv') || c.includes('ma'));
        const hasStt = rowCells.some(c => c === 'stt');

        if (hasName || (hasId && hasStt)) {
            headerRowNumber = rowNumber;
            // Map columns
            row.eachCell((cell, colNumber) => {
                const normalized = normalizeText(cell.text || String(cell.value || ''));
                if (normalized.includes('stt')) colIndexMap['stt'] = colNumber;
                else if (normalized.includes('ma nv') || normalized === 'manv' || normalized === 'id') colIndexMap['id'] = colNumber;
                else if (normalized.includes('ho va ten') || normalized.includes('ho ten')) colIndexMap['fullName'] = colNumber;
                else if (normalized.includes('chuc vu')) colIndexMap['jobTitle'] = colNumber;
                else if (normalized.includes('don vi') || normalized.includes('phong ban') || normalized.includes('doi')) colIndexMap['department'] = colNumber;
                else if (normalized.includes('size quan ao') || normalized.includes('size ao')) colIndexMap['uniformSize'] = colNumber;
                else if (normalized.includes('size giay') || normalized.includes('size dep') || normalized.includes('size giay dep')) colIndexMap['shoeSize'] = colNumber;
                else if (normalized.includes('day dai 2') || normalized.includes('2 moc')) colIndexMap['item_2'] = colNumber;
                else if (normalized.includes('day dai 1') || normalized.includes('1 moc') || normalized.includes('day dai')) colIndexMap['item_1'] = colNumber;
                else if (normalized.includes('mu cung') || normalized.includes('mu')) colIndexMap['item_3'] = colNumber;
                else if (normalized.includes('quan ao')) colIndexMap['item_4'] = colNumber;
                else if (normalized.includes('mua dong')) colIndexMap['item_5'] = colNumber;
                else if (normalized.includes('giay')) colIndexMap['item_6'] = colNumber;
                else if (normalized.includes('dep')) colIndexMap['item_7'] = colNumber;
                else if (normalized.includes('bang ten')) colIndexMap['item_8'] = colNumber;
                else if (normalized.includes('ao gio')) colIndexMap['item_9'] = colNumber;
                else if (normalized.includes('ao thun')) colIndexMap['item_10'] = colNumber;
                else if (normalized.includes('ao so mi') || normalized.includes('so mi')) colIndexMap['item_11'] = colNumber;
                else if (normalized.includes('gang tay')) colIndexMap['item_12'] = colNumber;
                else if (normalized.includes('ghi chu')) colIndexMap['note'] = colNumber;
            });
        }
    });

    if (headerRowNumber === -1) {
        throw new Error('Không nhận diện được dòng tiêu đề cột trong file Excel (cần cột "Họ và tên" hoặc "Mã NV").');
    }

    // 2. Iterate data rows
    const results: BhlBatchEmployee[] = [];
    let sequentialStt = 1;

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowNumber) return; // skip headers

        const getVal = (key: string): string => {
            const col = colIndexMap[key];
            if (!col) return '';
            const cell = row.getCell(col);
            if (!cell || cell.value === null || cell.value === undefined) return '';
            if (typeof cell.value === 'object') {
                if ('result' in cell.value) return String(cell.value.result ?? '').trim();
                if ('text' in cell.value) return String((cell.value as any).text ?? '').trim();
            }
            return String(cell.value).trim();
        };

        const getNum = (key: string): number => {
            const val = getVal(key);
            if (!val) return 0;
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? 0 : Math.max(0, parsed);
        };

        const rawFullName = getVal('fullName');
        const rawId = getVal('id');

        // Ignore empty rows
        if (!rawFullName && !rawId) return;

        // Cross reference with HR profiles if available
        const matchedProfile = hrProfiles.find(p => {
            if (rawId && p.id && p.id.trim().toUpperCase() === rawId.toUpperCase()) return true;
            if (rawFullName && p.full_name && normalizeText(p.full_name) === normalizeText(rawFullName)) return true;
            return false;
        });

        const employeeId = rawId || matchedProfile?.id || '';
        const fullName = (rawFullName || matchedProfile?.full_name || '').toUpperCase();
        const jobTitle = getVal('jobTitle') || matchedProfile?.job_position || 'Nhân viên Kỹ thuật CĐBR';
        const department = getVal('department') || matchedProfile?.department || 'Lực lượng kỹ thuật CĐBR Bắc Sài Gòn';
        const uniformSize = getVal('uniformSize') || matchedProfile?.uniform_size || '';
        const shoeSize = getVal('shoeSize') || matchedProfile?.shoe_size || '';
        const generalNote = getVal('note');

        // Build 12 BHL Items with quantities from Excel
        const defaultItems = createDefaultBhlItems();
        const items: BhlItem[] = defaultItems.map(def => {
            const qtyKey = `item_${def.stt}`;
            const importedQty = getNum(qtyKey);

            return {
                ...def,
                quantity: importedQty,
                note: def.stt === 7 ? def.note : (def.note || '')
            };
        });

        const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);

        results.push({
            id: `batch-${Date.now()}-${sequentialStt}`,
            stt: sequentialStt++,
            employeeId,
            fullName,
            jobTitle,
            department,
            uniformSize,
            shoeSize,
            items,
            generalNote,
            totalQuantity,
            selected: totalQuantity > 0 // auto select rows that have equipment assigned
        });
    });

    if (results.length === 0) {
        throw new Error('Không tìm thấy dữ liệu nhân viên hợp lệ nào trong file Excel.');
    }

    return results;
};

/**
 * Builds the complete, multi-page HTML printable document for all selected batch employees.
 */
export const buildBatchHandoverPrintHtml = (options: {
    employees: BhlBatchEmployee[];
    actionType: 'allocate' | 'revoke' | 'transfer';
    giverInfo: {
        giverName?: string;
        giverTitle?: string;
        giverPhone?: string;
        giverName2?: string;
        giverTitle2?: string;
        giverPhone2?: string;
    };
    dateStr?: string;
}): string => {
    const { employees, actionType, giverInfo, dateStr } = options;

    const titleMapBhl = {
        allocate: 'BIÊN BẢN BÀN GIAO TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        revoke: 'BIÊN BẢN THU HỒI TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        transfer: 'BIÊN BẢN ĐIỀU CHUYỂN TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)'
    };
    const currentTitle = titleMapBhl[actionType];
    const isRevoke = actionType === 'revoke';
    const qtyLabel = isRevoke ? 'SL thu hồi' : actionType === 'transfer' ? 'SL điều chuyển' : 'SL bàn giao';

    const now = new Date();
    const resolvedDateStr = dateStr || `TPHCM, Ngày ${now.getDate().toString().padStart(2, '0')} tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const sheetsHtml = employees.map((emp, empIdx) => {
        const activeItems = emp.items.filter(item => item.quantity > 0);
        const totalQty = activeItems.reduce((sum, item) => sum + item.quantity, 0);
        const isLast = empIdx === employees.length - 1;

        // Render equipment rows
        const tableRowsHtml = activeItems.length > 0 ? activeItems.map((item, i) => {
            const formattedNote = formatBhlItemNote(item, emp.uniformSize, emp.shoeSize);
            const parsed = splitBhlItemNote(formattedNote);

            const renderedNoteHtml = parsed
                ? `<strong>${parsed.sizePart}</strong>${parsed.separator}${parsed.rest}`
                : formattedNote;

            return `
                <tr>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle;">${i + 1}</td>
                    <td style="border: 1px solid #000; padding: 4px 8px; text-align: left; vertical-align: middle;">${item.name}</td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle;">${item.unit}</td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle;">${item.quota}</td>
                    <td style="border: 1px solid #000; padding: 4px; text-align: center; vertical-align: middle; font-weight: bold;">${item.quantity}</td>
                    <td style="border: 1px solid #000; padding: 4px; vertical-align: middle; font-size: 9pt; line-height: 1.2;">
                        ${item.spec} ${item.serial ? `(Serial: ${item.serial})` : ''}
                    </td>
                    <td class="note-cell" style="border: 1px solid #000; padding: 5px; vertical-align: top; font-size: 8.5pt; line-height: 1.35; word-wrap: break-word; overflow-wrap: break-word;">
                        ${renderedNoteHtml}
                    </td>
                </tr>
            `;
        }).join('') : `
            <tr>
                <td colspan="7" style="border: 1px solid #000; padding: 8px; text-align: center; font-style: italic;">
                    Không có trang bị bảo hộ nào được chọn (Số lượng &gt; 0).
                </td>
            </tr>
        `;

        // Render person rows (using exact 120px / 200px / 75px / flex / 110px straight alignment)
        const personSectionHtml = isRevoke ? `
            <div style="font-weight: bold; font-size: 10.5pt; color: #003087; margin: 6px 0 2px;">BÊN GIAO :</div>
            <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${emp.fullName}</span>
                <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                <span style="flex: 1;">${emp.jobTitle}</span>
                <span style="width: 110px; text-align: right;"></span>
            </div>
            <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                <span style="font-weight: bold; width: 120px;">Đơn vị:</span>
                <span style="flex: 1;">${emp.department}</span>
            </div>
            <div style="font-weight: bold; font-size: 10.5pt; color: #003087; margin: 8px 0 2px;">BÊN NHẬN :</div>
            ${giverInfo.giverName ? `
                <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                    <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                    <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${giverInfo.giverName}</span>
                    <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                    <span style="flex: 1;">${giverInfo.giverTitle || ''}</span>
                    <span style="width: 110px; text-align: right;">${formatPhone(giverInfo.giverPhone || '')}</span>
                </div>
            ` : ''}
            ${giverInfo.giverName2 ? `
                <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                    <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                    <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${giverInfo.giverName2}</span>
                    <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                    <span style="flex: 1;">${giverInfo.giverTitle2 || ''}</span>
                    <span style="width: 110px; text-align: right;">${formatPhone(giverInfo.giverPhone2 || '')}</span>
                </div>
            ` : ''}
        ` : `
            <div style="font-weight: bold; font-size: 10.5pt; color: #003087; margin: 6px 0 2px;">BÊN GIAO :</div>
            ${giverInfo.giverName ? `
                <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                    <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                    <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${giverInfo.giverName}</span>
                    <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                    <span style="flex: 1;">${giverInfo.giverTitle || ''}</span>
                    <span style="width: 110px; text-align: right;">${formatPhone(giverInfo.giverPhone || '')}</span>
                </div>
            ` : ''}
            ${giverInfo.giverName2 ? `
                <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                    <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                    <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${giverInfo.giverName2}</span>
                    <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                    <span style="flex: 1;">${giverInfo.giverTitle2 || ''}</span>
                    <span style="width: 110px; text-align: right;">${formatPhone(giverInfo.giverPhone2 || '')}</span>
                </div>
            ` : ''}
            <div style="font-weight: bold; font-size: 10.5pt; color: #003087; margin: 8px 0 2px;">BÊN NHẬN :</div>
            <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                <span style="font-weight: bold; width: 120px;">Họ và tên:</span>
                <span style="width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase;">${emp.fullName}</span>
                <span style="font-weight: bold; width: 75px;">Chức vụ:</span>
                <span style="flex: 1;">${emp.jobTitle}</span>
                <span style="width: 110px; text-align: right;"></span>
            </div>
            <div style="display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center;">
                <span style="font-weight: bold; width: 120px;">Đơn vị:</span>
                <span style="flex: 1;">${emp.department}</span>
            </div>
        `;

        return `
            <div class="handover-page ${isLast ? '' : 'page-break'}">
                <!-- Header -->
                <div class="header">
                    <div class="header-left">
                        <div class="header-org-text">
                            <div class="company-name">CTY CỔ PHẦN VIỄN THÔNG ACT</div>
                            <div class="company-sub">TRUNG TÂM KHU VỰC BẮC SÀI GÒN</div>
                        </div>
                    </div>
                    <div class="header-right">
                        <div class="republic">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
                        <div class="motto">Độc lập - Tự do - Hạnh phúc</div>
                    </div>
                </div>

                <!-- Date -->
                <div class="date-line">${resolvedDateStr}</div>

                <!-- Document Title -->
                <div class="document-title">${currentTitle}</div>

                <!-- Person Information -->
                ${personSectionHtml}

                <!-- Equipment Table -->
                <table>
                    <thead>
                        <tr>
                            <th style="width: 5%;">STT</th>
                            <th style="width: 20%;">Nội dung yêu cầu</th>
                            <th style="width: 7%;">Đơn vị</th>
                            <th style="width: 12%;">Số lượng định mức</th>
                            <th style="width: 8%;">${qtyLabel}</th>
                            <th style="width: 15%;">Quy cách, TCKT</th>
                            <th style="width: 33%;">Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        <tr class="total-row">
                            <td colspan="4" style="text-align: center; font-weight: bold;">TỔNG</td>
                            <td style="text-align: center; font-weight: bold;">${totalQty}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tbody>
                </table>

                <!-- Footer Note -->
                <div class="footer-note">
                    Biên bản lập như nhau và có hiệu lực từ ngày ký, Đ/c kiểm tra trước khi xác nhận tài sản bàn giao ./.
                </div>

                <!-- Signatures -->
                <div class="signatures">
                    <div class="sig-block">
                        <div class="sig-title">BÊN GIAO</div>
                        <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
                        <div class="sig-space"></div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-title">BÊN NHẬN</div>
                        <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
                        <div class="sig-space"></div>
                    </div>
                    <div class="sig-block">
                        <div class="sig-title">GIÁM ĐỐC TRUNG TÂM</div>
                        <div class="sig-sub">(Ký, ghi rõ họ tên)</div>
                        <div class="sig-space"></div>
                    </div>
                </div>
            </div>
        `;
    }).join('\n');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <title>In biên bản bàn giao BHLĐ hàng loạt (${employees.length} nhân viên)</title>
            <style>
                @page {
                    size: A4 portrait;
                    margin: 15mm 15mm 15mm 25mm;
                }
                * { box-sizing: border-box; }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    font-size: 10.5pt;
                    color: #000;
                    margin: 0;
                    padding: 0;
                    line-height: 1.25;
                }
                body * { color: #000 !important; }
                .handover-page {
                    box-sizing: border-box;
                    width: 100%;
                    min-height: calc(100vh - 30mm);
                    page-break-inside: avoid;
                    break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                }
                .page-break {
                    page-break-after: always;
                    break-after: page;
                }
                .header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 4px;
                }
                .header-left { width: 55%; }
                .header-org-text { text-align: center; }
                .header-right { width: 45%; text-align: center; }
                .company-name, .company-sub, .republic, .motto {
                    font-size: 10.5pt;
                    font-weight: bold;
                    text-align: center;
                }
                .company-name, .company-sub {
                    color: #003087 !important;
                    text-transform: uppercase;
                }
                .motto { text-decoration: underline; }
                .date-line {
                    text-align: right;
                    font-style: italic;
                    font-size: 10.5pt;
                    margin: 8px 0 4px;
                }
                .document-title {
                    text-align: center;
                    font-size: 14pt;
                    font-weight: bold;
                    color: #000;
                    margin: 10px 0 14px;
                    text-transform: uppercase;
                    line-height: 1.3;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                    font-size: 10pt;
                }
                th {
                    background: #f2f2f2;
                    border: 1px solid #000;
                    padding: 5px 4px;
                    text-align: center;
                    font-weight: bold;
                }
                td {
                    border: 1px solid #000;
                    padding: 4px;
                    vertical-align: middle;
                    word-wrap: break-word;
                    overflow-wrap: break-word;
                }
                .note-cell {
                    font-size: 8.5pt;
                    line-height: 1.35;
                    vertical-align: top;
                }
                tr.total-row td {
                    font-weight: bold;
                    background: #f0f0f0;
                }
                .footer-note {
                    font-style: italic;
                    font-size: 9.5pt;
                    margin-top: 8px;
                    border-top: 1px solid #000;
                    padding-top: 5px;
                    text-align: justify;
                }
                .signatures {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 18px;
                    text-align: center;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .sig-block { width: 30%; }
                .sig-title { font-weight: bold; font-size: 11pt; }
                .sig-sub { font-style: italic; font-size: 9.5pt; margin-top: 2px; }
                .sig-space { height: 50px; }
            </style>
        </head>
        <body>
            ${sheetsHtml}
            <script>
                window.onload = function() {
                    window.focus();
                    window.print();
                };
            </script>
        </body>
        </html>
    `;
};
