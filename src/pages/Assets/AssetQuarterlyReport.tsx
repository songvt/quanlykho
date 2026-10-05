import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box, Typography, Button, Paper, Stack, CircularProgress, useMediaQuery, useTheme,
    TextField, Chip, InputAdornment, TablePagination, Tooltip
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import EditIcon from '@mui/icons-material/Edit';
import ExcelJS from 'exceljs';
import { fetchAssets } from '../../store/slices/assetsSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Asset } from '../../types';

interface Props {
    reportType: 'CCDC' | 'TBVP';
}

const parseCutoffDate = (str: string): Date | null => {
    if (!str) return null;
    const trimmed = str.trim();
    // Định dạng DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const dmy = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) {
        const day = parseInt(dmy[1], 10);
        const month = parseInt(dmy[2], 10) - 1;
        const year = parseInt(dmy[3], 10);
        return new Date(year, month, day, 23, 59, 59, 999);
    }
    // Định dạng YYYY-MM-DD
    const ymd = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
    if (ymd) {
        const year = parseInt(ymd[1], 10);
        const month = parseInt(ymd[2], 10) - 1;
        const day = parseInt(ymd[3], 10);
        return new Date(year, month, day, 23, 59, 59, 999);
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        return d;
    }
    return null;
};

const getStatusCategory = (statusStr?: string): 'using' | 'unused' | 'liquidated' | 'broken' | 'repair' => {
    const s = (statusStr || '').trim().toLowerCase();
    if (s.includes('thanh lý') || s.includes('liquidat') || s.includes('disposed')) return 'liquidated';
    if (s.includes('hỏng') || s.includes('broken') || s.includes('damage')) return 'broken';
    if (s.includes('sửa chữa') || s.includes('bảo dưỡng') || s.includes('repair') || s.includes('maint')) return 'repair';
    if (s.includes('chưa') || s.includes('mới') || s.includes('new') || s.includes('tồn kho') || s.includes('unused')) return 'unused';
    return 'using';
};

const AssetQuarterlyReport: React.FC<Props> = ({ reportType }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: allAssets, status } = useSelector((s: RootState) => s.assets);

    useEffect(() => {
        dispatch(fetchAssets());
    }, [dispatch]);

    // Hai trường điền tay tự do
    const [kyXacNhan, setKyXacNhan] = useState<string>('Quý 3.2026');
    const [thoiDiemChot, setThoiDiemChot] = useState<string>('29/09/2026');

    const [statusFilter, setStatusFilter] = useState<'all' | 'using' | 'unused' | 'liquidated' | 'broken' | 'repair'>('all');
    const [searchKeyword, setSearchKeyword] = useState('');

    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const printRef = useRef<HTMLDivElement>(null);

    const reportTitle = reportType === 'CCDC'
        ? 'BIÊN BẢN XÁC NHẬN CÔNG CỤ DỤNG CỤ - TSNT'
        : 'BIÊN BẢN XÁC NHẬN TÀI SẢN TRANG BỊ VĂN PHÒNG';

    const shortReportName = reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP';

    const leftSignTitle = reportType === 'CCDC'
        ? 'NHÂN SỰ PHỤ TRÁCH QLTS CCDC-TSNT'
        : 'NHÂN SỰ PHỤ TRÁCH QLTS TBVP';

    // Lọc tài sản thuộc danh mục CCDC hoặc TBVP và chốt trước ngày chốt điền tay
    const quarterAssets = useMemo(() => {
        const cutoff = parseCutoffDate(thoiDiemChot);

        return allAssets.filter((a: Asset) => {
            const typeCode = (a.asset_type || '').trim().toUpperCase();
            const grpCode = (a.asset_group || '').trim().toUpperCase();
            const isMatch = reportType === 'CCDC'
                ? (typeCode.includes('CCDC') || typeCode.includes('TSNT') || grpCode.includes('CCDC') || grpCode.includes('TSNT'))
                : (typeCode.includes('TBVP') || grpCode.includes('TBVP') || typeCode.includes('TTB-PCCC'));

            if (!isMatch) return false;

            if (cutoff) {
                if (a.receipt_date) {
                    const rDate = new Date(a.receipt_date);
                    if (rDate > cutoff) return false;
                } else if (a.created_at) {
                    const cDate = new Date(a.created_at);
                    if (cDate > cutoff) return false;
                }
            }
            return true;
        });
    }, [allAssets, reportType, thoiDiemChot]);

    // Thống kê số lượng theo từng tình trạng
    const summary = useMemo(() => {
        let using = 0;
        let unused = 0;
        let liquidated = 0;
        let broken = 0;
        let repair = 0;

        quarterAssets.forEach(a => {
            const cat = getStatusCategory(a.status);
            if (cat === 'using') using++;
            else if (cat === 'unused') unused++;
            else if (cat === 'liquidated') liquidated++;
            else if (cat === 'broken') broken++;
            else if (cat === 'repair') repair++;
        });

        return {
            total: quarterAssets.length,
            using,
            unused,
            liquidated,
            broken,
            repair
        };
    }, [quarterAssets]);

    // Danh sách tài sản sau khi áp dụng lọc theo trạng thái và tìm kiếm
    const filteredAssets = useMemo(() => {
        let result = quarterAssets;

        if (statusFilter !== 'all') {
            result = result.filter(a => getStatusCategory(a.status) === statusFilter);
        }

        if (searchKeyword.trim()) {
            const kw = searchKeyword.trim().toLowerCase();
            result = result.filter(a =>
                (a.asset_code || '').toLowerCase().includes(kw) ||
                (a.asset_name || '').toLowerCase().includes(kw) ||
                (a.asset_type || '').toLowerCase().includes(kw) ||
                (a.manager_code || '').toLowerCase().includes(kw) ||
                (a.manager_name || '').toLowerCase().includes(kw) ||
                (a.user_employee_code || '').toLowerCase().includes(kw) ||
                (a.user_employee_name || '').toLowerCase().includes(kw) ||
                (a.serial_number || '').toLowerCase().includes(kw) ||
                (a.location_name || '').toLowerCase().includes(kw) ||
                (a.management_unit_name || '').toLowerCase().includes(kw) ||
                (a.notes || '').toLowerCase().includes(kw)
            );
        }

        return result;
    }, [quarterAssets, statusFilter, searchKeyword]);

    // Xuất Excel đúng chuẩn mẫu hình ảnh
    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const sheetName = reportType === 'CCDC' ? 'BB_CCDC_TSNT' : 'BB_TBVP';
        const ws = wb.addWorksheet(sheetName, {
            views: [{ showGridLines: true }],
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0, // Tự động co giãn theo chiều dọc qua các trang
                margins: {
                    left: 0.79,
                    right: 0.59,
                    top: 0.79,
                    bottom: 0.79,
                    header: 0.3,
                    footer: 0.3
                },
                printTitlesRow: '18:18' // Lặp lại tiêu đề bảng ở mỗi trang in
            }
        });

        const borderAll: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            bottom: { style: 'thin' },
            left: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Header thông tin công ty
        ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT';
        ws.getCell('A1').font = { bold: true, size: 11, name: 'Times New Roman' };

        ws.getCell('A2').value = '2R-2R1 Bình giã, P.Tân Bình, TP.HCM';
        ws.getCell('A2').font = { size: 10, name: 'Times New Roman' };

        ws.getCell('A4').value = 'Đơn vị: ACT Telecom';
        ws.getCell('A4').font = { bold: true, size: 10, name: 'Times New Roman' };

        // Tiêu đề biên bản canh giữa, chữ to in đậm
        ws.mergeCells('A6:L6');
        const titleCell = ws.getCell('A6');
        titleCell.value = reportTitle;
        titleCell.font = { bold: true, size: 16, name: 'Times New Roman' };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(6).height = 36;

        // Kỳ và thời điểm chốt (Toàn bộ in đậm chuẩn theo hình)
        ws.getCell('A8').value = `- Kỳ xác nhận: ${kyXacNhan}`;
        ws.getCell('A8').font = { bold: true, size: 11, name: 'Times New Roman' };

        ws.getCell('A9').value = `- Thời điểm chốt dữ liệu: ${thoiDiemChot}`;
        ws.getCell('A9').font = { bold: true, size: 11, name: 'Times New Roman' };

        // Thống kê danh mục tài sản (hoàn toàn không kẻ khung)
        ws.getCell('A11').value = '- Tổng danh mục tài sản:';
        ws.getCell('A11').font = { bold: true, size: 10, name: 'Times New Roman' };
        ws.getCell('F11').value = summary.total;
        ws.getCell('F11').font = { bold: true, size: 11, color: { argb: 'FFFF0000' }, name: 'Times New Roman' };
        ws.getCell('F11').alignment = { horizontal: 'center' };
        ws.getCell('G11').value = 'Danh mục';
        ws.getCell('G11').font = { size: 10, name: 'Times New Roman' };
        ws.getCell('G11').alignment = { horizontal: 'center' };

        const statRows = [
            { label: '    + Đang sử dụng:', val: summary.using, row: 12 },
            { label: '    + Chưa sử dụng:', val: summary.unused, row: 13 },
            { label: '    + Đã thanh lý:', val: summary.liquidated, row: 14 },
            { label: '    + Đã hỏng:', val: summary.broken, row: 15 },
            { label: '    + Đang sửa chữa:', val: summary.repair, row: 16 },
        ];

        statRows.forEach(sr => {
            ws.getCell(`A${sr.row}`).value = sr.label;
            ws.getCell(`A${sr.row}`).font = { size: 10, name: 'Times New Roman' };
            ws.getCell(`F${sr.row}`).value = sr.val;
            ws.getCell(`F${sr.row}`).font = { size: 10, name: 'Times New Roman' };
            ws.getCell(`F${sr.row}`).alignment = { horizontal: 'center' };
            ws.getCell(`G${sr.row}`).value = 'Danh mục';
            ws.getCell(`G${sr.row}`).font = { size: 10, name: 'Times New Roman' };
            ws.getCell(`G${sr.row}`).alignment = { horizontal: 'center' };
        });

        ws.getCell('A17').value = '- Chi tiết như sau:';
        ws.getCell('A17').font = { bold: true, size: 10, name: 'Times New Roman' };

        // Headers của bảng chi tiết (Row 18) - Căn chỉnh kích thước cột vừa khít A4 Landscape
        const headers = [
            { text: 'STT', width: 6, align: 'center' },
            { text: 'Mã tài sản', width: 15, align: 'center' },
            { text: 'Tên tài sản', width: 32, align: 'left' },
            { text: 'Loại tài sản', width: 22, align: 'left' },
            { text: 'Tình trạng', width: 14, align: 'center' },
            { text: 'Mã NQ', width: 10, align: 'center' },
            { text: 'Người quản lý', width: 18, align: 'left' },
            { text: 'Mã NV SD', width: 10, align: 'center' },
            { text: 'Nhân viên sử dụng', width: 18, align: 'left' },
            { text: 'Số serial', width: 22, align: 'left' },
            { text: 'Ghi chú', width: 18, align: 'left' },
            { text: 'Đơn vị quản lý', width: 22, align: 'center' },
        ];

        ws.getRow(18).height = 26;
        headers.forEach((h, idx) => {
            const colNum = idx + 1;
            const cell = ws.getCell(18, colNum);
            cell.value = h.text;
            cell.font = { bold: true, size: 10, name: 'Times New Roman' };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD9D9D9' }
            };
            cell.border = borderAll;
            ws.getColumn(colNum).width = h.width;
        });

        const colWidths = headers.map(h => h.width);

        // Điền toàn bộ dữ liệu chi tiết
        filteredAssets.forEach((a, index) => {
            const unit = a.management_unit_name || a.location_name || a.user_department_name || a.location_code || '';
            const rowValues = [
                index + 1,
                a.asset_code || '',
                a.asset_name || '',
                a.asset_type || '',
                a.status || '',
                a.manager_code || '',
                a.manager_name || '',
                a.user_employee_code || '',
                a.user_employee_name || '',
                a.serial_number || '',
                a.notes || '',
                unit
            ];

            const row = ws.addRow(rowValues);
            
            // Tính toán chiều cao dòng tự động dựa trên độ dài nội dung để không bao giờ bị cắt chữ
            let maxLines = 1;
            rowValues.forEach((val, colIdx) => {
                if (!val) return;
                const text = String(val);
                const colW = colWidths[colIdx] || 15;
                const charsPerLine = Math.max(6, Math.floor(colW * 1.15));
                const lines = text.split(/\r\n|\r|\n/).reduce((acc, line) => {
                    return acc + Math.max(1, Math.ceil(line.length / charsPerLine));
                }, 0);
                if (lines > maxLines) maxLines = lines;
            });
            row.height = Math.max(22, maxLines * 15 + 4);

            row.eachCell((cell, colIndex) => {
                cell.font = { size: 9.5, name: 'Times New Roman' };
                cell.border = borderAll;
                const alignConf = headers[colIndex - 1]?.align || 'left';
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: alignConf as ExcelJS.Alignment['horizontal'],
                    wrapText: true
                };
            });
        });

        // Chữ ký ở chân trang
        const lastRowNum = ws.rowCount;
        const sigRow = lastRowNum + 3;

        ws.mergeCells(`B${sigRow}:E${sigRow}`);
        const leftSig = ws.getCell(`B${sigRow}`);
        leftSig.value = leftSignTitle;
        leftSig.font = { bold: true, size: 10.5, name: 'Times New Roman' };
        leftSig.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        ws.mergeCells(`I${sigRow}:L${sigRow}`);
        const rightSig = ws.getCell(`I${sigRow}`);
        rightSig.value = 'TRƯỞNG ĐƠN VỊ';
        rightSig.font = { bold: true, size: 10.5, name: 'Times New Roman' };
        rightSig.alignment = { horizontal: 'center', vertical: 'middle' };

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const safeKy = kyXacNhan.replace(/[\/\\?%*:|"<>]/g, '_');
        link.download = `BienBan_XacNhan_${shortReportName}_${safeKy}.xlsx`;
        link.click();
    };

    // In / Xuất PDF
    const handlePrint = () => {
        const w = window.open('', '_blank', 'width=1400,height=900');
        if (!w) return;

        const rowsHtml = filteredAssets.map((a, i) => {
            const unit = a.management_unit_name || a.location_name || a.user_department_name || a.location_code || '';
            return `
                <tr>
                    <td style="text-align: center;">${i + 1}</td>
                    <td style="text-align: center;">${a.asset_code || '-'}</td>
                    <td style="text-align: left;">${a.asset_name || ''}</td>
                    <td style="text-align: left;">${a.asset_type || ''}</td>
                    <td style="text-align: center;">${a.status || ''}</td>
                    <td style="text-align: center;">${a.manager_code || '-'}</td>
                    <td style="text-align: left;">${a.manager_name || '-'}</td>
                    <td style="text-align: center;">${a.user_employee_code || '-'}</td>
                    <td style="text-align: left;">${a.user_employee_name || '-'}</td>
                    <td style="text-align: left; word-break: break-word;">${a.serial_number || ''}</td>
                    <td style="text-align: left;">${a.notes || ''}</td>
                    <td style="text-align: center;">${unit}</td>
                </tr>
            `;
        }).join('');

        w.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>${reportTitle}</title>
                <style>
                    @page { 
                        size: A4 landscape; 
                        margin: 20mm 15mm 20mm 20mm; 
                    }
                    * {
                        box-sizing: border-box;
                    }
                    body { 
                        font-family: 'Times New Roman', serif; 
                        font-size: 10pt; 
                        margin: 0; 
                        padding: 10px; 
                        color: #000;
                        background: #fff;
                    }
                    
                    /* Tiêu đề căn giữa, to đậm chuẩn như Excel */
                    .title-container {
                        text-align: center;
                        margin: 18px 0 20px 0;
                        width: 100%;
                    }
                    .report-title {
                        font-size: 16pt;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 0.03em;
                        margin: 0;
                        padding: 0;
                    }

                    /* Thông tin công ty bên trên */
                    .company-header {
                        margin-bottom: 12px;
                    }
                    .company-name {
                        font-weight: bold;
                        font-size: 11pt;
                    }
                    .company-address {
                        font-size: 10pt;
                    }
                    .company-unit {
                        font-weight: bold;
                        font-size: 10.5pt;
                        margin-top: 8px;
                    }

                    /* Kỳ & ngày chốt */
                    .meta-info {
                        margin-bottom: 12px;
                        font-size: 11pt;
                        font-weight: bold;
                    }
                    .meta-line {
                        margin-bottom: 3px;
                    }

                    /* Bảng tóm tắt danh mục: HOÀN TOÀN KHÔNG KẺ KHUNG */
                    .summary-table {
                        border-collapse: collapse;
                        border: none !important;
                        margin-bottom: 14px;
                        font-size: 10.5pt;
                    }
                    .summary-table td {
                        border: none !important;
                        padding: 2px 14px 2px 0;
                    }

                    /* Bảng dữ liệu chi tiết: kẻ khung chuẩn A4 */
                    .detail-table { 
                        width: 100%; 
                        border-collapse: collapse; 
                        margin-top: 6px; 
                        table-layout: fixed; 
                    }
                    .detail-table th, .detail-table td { 
                        border: 1px solid #000 !important; 
                        padding: 4px 3px; 
                        vertical-align: middle; 
                        word-wrap: break-word; 
                        font-size: 8pt; 
                    }
                    .detail-table th { 
                        background: #d9d9d9; 
                        font-weight: bold; 
                        text-align: center; 
                    }

                    /* Chân trang chữ ký */
                    .sig-container {
                        margin-top: 35px;
                        width: 100%;
                        display: flex;
                        justify-content: space-between;
                        page-break-inside: avoid;
                    }
                    .sig-box {
                        width: 45%;
                        text-align: center;
                    }
                    .sig-title {
                        font-weight: bold;
                        font-size: 11pt;
                        text-transform: uppercase;
                    }
                    .sig-space {
                        height: 75px;
                    }
                </style>
            </head>
            <body>
                <div class="company-header">
                    <div class="company-name">CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</div>
                    <div class="company-address">2R-2R1 Bình giã, P.Tân Bình, TP.HCM</div>
                    <div class="company-unit">Đơn vị: ACT Telecom</div>
                </div>

                <div class="title-container">
                    <div class="report-title">${reportTitle}</div>
                </div>

                <div class="meta-info">
                    <div class="meta-line">- Kỳ xác nhận: ${kyXacNhan}</div>
                    <div class="meta-line">- Thời điểm chốt dữ liệu: ${thoiDiemChot}</div>
                </div>

                <table class="summary-table">
                    <tbody>
                        <tr>
                            <td style="font-weight: bold;">- Tổng danh mục tài sản:</td>
                            <td style="font-weight: bold; color: #D32F2F; text-align: center; font-size: 11pt; min-width: 60px;">${summary.total}</td>
                            <td>Danh mục</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 14px;">+ Đang sử dụng:</td>
                            <td style="text-align: center;">${summary.using}</td>
                            <td>Danh mục</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 14px;">+ Chưa sử dụng:</td>
                            <td style="text-align: center;">${summary.unused}</td>
                            <td>Danh mục</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 14px;">+ Đã thanh lý:</td>
                            <td style="text-align: center;">${summary.liquidated}</td>
                            <td>Danh mục</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 14px;">+ Đã hỏng:</td>
                            <td style="text-align: center;">${summary.broken}</td>
                            <td>Danh mục</td>
                        </tr>
                        <tr>
                            <td style="padding-left: 14px;">+ Đang sửa chữa:</td>
                            <td style="text-align: center;">${summary.repair}</td>
                            <td>Danh mục</td>
                        </tr>
                    </tbody>
                </table>

                <div style="font-weight: bold; font-size: 10.5pt; margin-bottom: 6px;">
                    - Chi tiết như sau:
                </div>

                <table class="detail-table">
                    <thead>
                        <tr>
                            <th style="width: 3.5%;">STT</th>
                            <th style="width: 8.5%;">Mã tài sản</th>
                            <th style="width: 19%;">Tên tài sản</th>
                            <th style="width: 13%;">Loại tài sản</th>
                            <th style="width: 8%;">Tình trạng</th>
                            <th style="width: 6%;">Mã NQ</th>
                            <th style="width: 10%;">Người quản lý</th>
                            <th style="width: 6%;">Mã NV SD</th>
                            <th style="width: 10%;">Nhân viên sử dụng</th>
                            <th style="width: 12%;">Số serial</th>
                            <th style="width: 10%;">Ghi chú</th>
                            <th style="width: 8%;">Đơn vị quản lý</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>

                <div class="sig-container">
                    <div class="sig-box">
                        <div class="sig-title">${leftSignTitle}</div>
                        <div class="sig-space"></div>
                    </div>
                    <div class="sig-box">
                        <div class="sig-title">TRƯỞNG ĐƠN VỊ</div>
                        <div class="sig-space"></div>
                    </div>
                </div>
            </body>
            </html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 500);
    };

    return (
        <Box sx={{ p: { xs: 1, sm: 3 }, '& .print-only': { display: 'none' } }}>
            {/* Thanh điều khiển */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }} sx={{ mb: 2.5 }} className="no-print">
                <Box sx={{ flexGrow: 1 }}>
                    <Typography variant={isMobile ? 'subtitle1' : 'h6'} fontWeight={800} color="primary.main">
                        Báo cáo Quý chi tiết {shortReportName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Biên bản xác nhận tài sản (Cho phép điền tay Kỳ xác nhận & Thời điểm chốt)
                    </Typography>
                </Box>

                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="center">
                    {/* Ô điền tay: Kỳ xác nhận */}
                    <TextField
                        size="small"
                        label="Kỳ xác nhận (điền tay)"
                        value={kyXacNhan}
                        onChange={e => setKyXacNhan(e.target.value)}
                        placeholder="Quý 3.2026"
                        sx={{ width: 180 }}
                        InputLabelProps={{ shrink: true }}
                    />

                    {/* Ô điền tay: Thời điểm chốt dữ liệu */}
                    <TextField
                        size="small"
                        label="Thời điểm chốt (điền tay)"
                        value={thoiDiemChot}
                        onChange={e => setThoiDiemChot(e.target.value)}
                        placeholder="29/09/2026"
                        sx={{ width: 190 }}
                        InputLabelProps={{ shrink: true }}
                    />

                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<PrintIcon />}
                        onClick={handlePrint}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        In / PDF
                    </Button>

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportExcel}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Xuất Excel
                    </Button>
                </Stack>
            </Stack>

            {/* Ô tìm kiếm và lọc trạng thái nhanh */}
            <Paper sx={{ p: 1.5, mb: 2.5, bgcolor: 'background.paper', borderRadius: 2 }} className="no-print">
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                    <TextField
                        size="small"
                        placeholder="Tìm theo mã TS, tên, serial, người sử dụng, đơn vị..."
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        fullWidth
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" color="action" />
                                </InputAdornment>
                            )
                        }}
                    />

                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center" sx={{ minWidth: 'fit-content' }}>
                        <FilterAltIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                        <Chip
                            label={`Tất cả (${summary.total})`}
                            size="small"
                            color={statusFilter === 'all' ? 'primary' : 'default'}
                            onClick={() => setStatusFilter('all')}
                            clickable
                        />
                        <Chip
                            label={`Đang sử dụng (${summary.using})`}
                            size="small"
                            color={statusFilter === 'using' ? 'success' : 'default'}
                            onClick={() => setStatusFilter('using')}
                            clickable
                        />
                        <Chip
                            label={`Chưa SD (${summary.unused})`}
                            size="small"
                            color={statusFilter === 'unused' ? 'info' : 'default'}
                            onClick={() => setStatusFilter('unused')}
                            clickable
                        />
                        <Chip
                            label={`Đã hỏng (${summary.broken})`}
                            size="small"
                            color={statusFilter === 'broken' ? 'error' : 'default'}
                            onClick={() => setStatusFilter('broken')}
                            clickable
                        />
                        <Chip
                            label={`Sửa chữa (${summary.repair})`}
                            size="small"
                            color={statusFilter === 'repair' ? 'warning' : 'default'}
                            onClick={() => setStatusFilter('repair')}
                            clickable
                        />
                    </Stack>
                </Stack>
            </Paper>

            {status === 'loading' && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

            {/* Khung nội dung hiển thị chuẩn theo mẫu */}
            <Box sx={{ overflowX: 'auto' }}>
                <Paper
                    elevation={0}
                    sx={{
                        p: { xs: 2, sm: 3.5 },
                        border: '1px solid #ddd',
                        minWidth: '1000px',
                        bgcolor: '#fff',
                        color: '#000',
                        fontFamily: "'Times New Roman', serif"
                    }}
                    ref={printRef}
                >
                    {/* Header thông tin công ty */}
                    <Box sx={{ mb: 2 }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif' }}>
                            CÔNG TY CỔ PHẦN VIỄN THÔNG ACT
                        </Typography>
                        <Typography sx={{ fontSize: '10pt', fontFamily: 'Times New Roman, serif' }}>
                            2R-2R1 Bình giã, P.Tân Bình, TP.HCM
                        </Typography>
                        <Box sx={{ height: 14 }} />
                        <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt', fontFamily: 'Times New Roman, serif' }}>
                            Đơn vị: ACT Telecom
                        </Typography>
                    </Box>

                    {/* Tiêu đề biên bản canh giữa, chữ to in đậm */}
                    <Box sx={{ textAlign: 'center', my: 3, width: '100%' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '18pt', fontFamily: 'Times New Roman, serif', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {reportTitle}
                        </Typography>
                    </Box>

                    {/* Dòng 8 & 9: Kỳ xác nhận & Thời điểm chốt dữ liệu - Chỉnh sửa trực tiếp tại đây */}
                    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography component="span" sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif', whiteSpace: 'nowrap' }}>
                                - Kỳ xác nhận:&nbsp;
                            </Typography>
                            <Box className="no-print" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <input
                                    type="text"
                                    value={kyXacNhan}
                                    onChange={e => setKyXacNhan(e.target.value)}
                                    placeholder="Quý 3.2026"
                                    style={{
                                        fontFamily: 'Times New Roman, serif',
                                        fontSize: '11pt',
                                        fontWeight: 'bold',
                                        border: '1.5px dashed #2563eb',
                                        backgroundColor: '#eff6ff',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        minWidth: '220px',
                                        outline: 'none',
                                        color: '#1e3a8a'
                                    }}
                                    title="Nhấp vào đây để chỉnh sửa trực tiếp Kỳ xác nhận"
                                />
                                <Tooltip title="Chỉnh sửa trực tiếp Kỳ xác nhận">
                                    <EditIcon sx={{ fontSize: 16, color: '#3b82f6', cursor: 'pointer' }} />
                                </Tooltip>
                            </Box>
                            <span className="print-only" style={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif' }}>
                                {kyXacNhan}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            <Typography component="span" sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif', whiteSpace: 'nowrap' }}>
                                - Thời điểm chốt dữ liệu:&nbsp;
                            </Typography>
                            <Box className="no-print" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                                <input
                                    type="text"
                                    value={thoiDiemChot}
                                    onChange={e => setThoiDiemChot(e.target.value)}
                                    placeholder="29/09/2026"
                                    style={{
                                        fontFamily: 'Times New Roman, serif',
                                        fontSize: '11pt',
                                        fontWeight: 'bold',
                                        border: '1.5px dashed #2563eb',
                                        backgroundColor: '#eff6ff',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                        minWidth: '220px',
                                        outline: 'none',
                                        color: '#1e3a8a'
                                    }}
                                    title="Nhấp vào đây để chỉnh sửa trực tiếp Thời điểm chốt dữ liệu"
                                />
                                <Tooltip title="Chỉnh sửa trực tiếp Thời điểm chốt dữ liệu">
                                    <EditIcon sx={{ fontSize: 16, color: '#3b82f6', cursor: 'pointer' }} />
                                </Tooltip>
                            </Box>
                            <span className="print-only" style={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif' }}>
                                {thoiDiemChot}
                            </span>
                        </Box>
                    </Box>

                    {/* Bảng thống kê tóm tắt danh mục - HOÀN TOÀN KHÔNG KẺ KHUNG */}
                    <Box sx={{ mb: 2 }}>
                        <table
                            className="summary-table"
                            style={{
                                borderCollapse: 'collapse',
                                border: 'none',
                                fontSize: '10.5pt',
                                fontFamily: 'Times New Roman, serif'
                            }}
                        >
                            <tbody>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 0', fontWeight: 'bold', minWidth: '180px' }}>
                                        - Tổng danh mục tài sản:
                                    </td>
                                    <td style={{ border: 'none', padding: '2px 20px', fontWeight: 'bold', color: '#D32F2F', textAlign: 'center', fontSize: '11pt', minWidth: '60px' }}>
                                        {summary.total}
                                    </td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('all')}
                                            sx={{
                                                color: statusFilter === 'all' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'all' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'all' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc toàn bộ danh mục tài sản"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 14px' }}>+ Đang sử dụng:</td>
                                    <td style={{ border: 'none', padding: '2px 20px', textAlign: 'center' }}>{summary.using}</td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('using')}
                                            sx={{
                                                color: statusFilter === 'using' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'using' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'using' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc danh mục Đang sử dụng"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 14px' }}>+ Chưa sử dụng:</td>
                                    <td style={{ border: 'none', padding: '2px 20px', textAlign: 'center' }}>{summary.unused}</td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('unused')}
                                            sx={{
                                                color: statusFilter === 'unused' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'unused' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'unused' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc danh mục Chưa sử dụng"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 14px' }}>+ Đã thanh lý:</td>
                                    <td style={{ border: 'none', padding: '2px 20px', textAlign: 'center' }}>{summary.liquidated}</td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('liquidated')}
                                            sx={{
                                                color: statusFilter === 'liquidated' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'liquidated' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'liquidated' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc danh mục Đã thanh lý"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 14px' }}>+ Đã hỏng:</td>
                                    <td style={{ border: 'none', padding: '2px 20px', textAlign: 'center' }}>{summary.broken}</td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('broken')}
                                            sx={{
                                                color: statusFilter === 'broken' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'broken' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'broken' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc danh mục Đã hỏng"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                                <tr>
                                    <td style={{ border: 'none', padding: '2px 12px 2px 14px' }}>+ Đang sửa chữa:</td>
                                    <td style={{ border: 'none', padding: '2px 20px', textAlign: 'center' }}>{summary.repair}</td>
                                    <td style={{ border: 'none', padding: '2px 4px' }}>
                                        <Typography
                                            component="span"
                                            onClick={() => setStatusFilter('repair')}
                                            sx={{
                                                color: statusFilter === 'repair' ? '#1d4ed8' : '#000',
                                                fontWeight: statusFilter === 'repair' ? 'bold' : 'normal',
                                                cursor: 'pointer',
                                                fontSize: '10pt',
                                                fontFamily: 'inherit',
                                                textDecoration: statusFilter === 'repair' ? 'underline' : 'none',
                                                userSelect: 'none',
                                                '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                                            }}
                                            title="Bấm để lọc danh mục Đang sửa chữa"
                                        >
                                            Danh mục
                                        </Typography>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </Box>

                    <Typography sx={{ fontWeight: 'bold', fontSize: '10.5pt', mb: 1, fontFamily: 'Times New Roman, serif' }}>
                        - Chi tiết như sau: {statusFilter !== 'all' && `(Đang lọc: ${statusFilter})`}
                    </Typography>

                    {/* Bảng dữ liệu chi tiết */}
                    <table className="detail-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman, serif' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#D9D9D9' }}>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '3.5%', textAlign: 'center', fontSize: '8.5pt' }}>STT</th>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '8.5%', textAlign: 'center', fontSize: '8.5pt' }}>Mã tài sản</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '19%', textAlign: 'center', fontSize: '8.5pt' }}>Tên tài sản</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '13%', textAlign: 'center', fontSize: '8.5pt' }}>Loại tài sản</th>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '8%', textAlign: 'center', fontSize: '8.5pt' }}>Tình trạng</th>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '6%', textAlign: 'center', fontSize: '8.5pt' }}>Mã NQ</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '10%', textAlign: 'center', fontSize: '8.5pt' }}>Người quản lý</th>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '6%', textAlign: 'center', fontSize: '8.5pt' }}>Mã NV SD</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '10%', textAlign: 'center', fontSize: '8.5pt' }}>Nhân viên sử dụng</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '12%', textAlign: 'center', fontSize: '8.5pt' }}>Số serial</th>
                                <th style={{ border: '1px solid #000', padding: '5px 4px', width: '10%', textAlign: 'center', fontSize: '8.5pt' }}>Ghi chú</th>
                                <th style={{ border: '1px solid #000', padding: '5px 3px', width: '8%', textAlign: 'center', fontSize: '8.5pt' }}>Đơn vị quản lý</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAssets.slice(page * rowsPerPage, (page + 1) * rowsPerPage).map((a, i) => {
                                const realIdx = page * rowsPerPage + i + 1;
                                const unit = a.management_unit_name || a.location_name || a.user_department_name || a.location_code || '';
                                return (
                                    <tr key={a.id || realIdx}>
                                        <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', fontSize: '8pt' }}>{realIdx}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8pt' }}>{a.asset_code || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt' }}>{a.asset_name}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt' }}>{a.asset_type}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8pt' }}>{a.status}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', fontSize: '8pt' }}>{a.manager_code || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt' }}>{a.manager_name || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 2px', textAlign: 'center', fontSize: '8pt' }}>{a.user_employee_code || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt' }}>{a.user_employee_name || '-'}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt', wordBreak: 'break-word' }}>{a.serial_number || ''}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 4px', textAlign: 'left', fontSize: '8pt' }}>{a.notes || ''}</td>
                                        <td style={{ border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8pt' }}>{unit}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Phân trang khi xem trên màn hình */}
                    <Box className="no-print" sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5 }}>
                        <TablePagination
                            rowsPerPageOptions={[50, 100, 200, 500, 1000]}
                            component="div"
                            count={filteredAssets.length}
                            rowsPerPage={rowsPerPage}
                            page={page}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            onRowsPerPageChange={e => {
                                setRowsPerPage(parseInt(e.target.value, 10));
                                setPage(0);
                            }}
                            labelRowsPerPage="Số dòng/trang:"
                            labelDisplayedRows={({ from, to, count }) => `${from}-${to} trong ${count !== -1 ? count : `hơn ${to}`}`}
                        />
                    </Box>

                    {/* Chữ ký chân trang theo mẫu */}
                    <Box sx={{ mt: 5, pt: 2, display: 'flex', justifyContent: 'space-between', textAlign: 'center', pageBreakInside: 'avoid' }}>
                        <Box sx={{ width: '45%' }}>
                            <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif', textTransform: 'uppercase' }}>
                                {leftSignTitle}
                            </Typography>
                            <Box sx={{ height: 80 }} />
                        </Box>

                        <Box sx={{ width: '45%' }}>
                            <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: 'Times New Roman, serif', textTransform: 'uppercase' }}>
                                TRƯỞNG ĐƠN VỊ
                            </Typography>
                            <Box sx={{ height: 80 }} />
                        </Box>
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default AssetQuarterlyReport;
