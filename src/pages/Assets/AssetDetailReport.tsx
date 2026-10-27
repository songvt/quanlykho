import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box, Typography, Button, Select, MenuItem, FormControl,
    InputLabel, Paper, Stack, CircularProgress, useMediaQuery, useTheme
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ExcelJS from 'exceljs';
import { fetchAssets, fetchAssetLogs } from '../../store/slices/assetsSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Asset } from '../../types';
import { sortAssetsByNameAndUser } from '../../utils/assetSorting';
import { buildAssetDetailMonthlyMovement, buildAssetDetailMovementDates, getAssetConditionQuantities, getFinalSignaturePageBreakRow, sumAssetDetailTotals } from '../../utils/assetDetailReport';

interface Props {
    reportType: 'CCDC' | 'TBVP';
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

const AssetDetailReport: React.FC<Props> = ({ reportType }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: allAssets, logs: allLogs, status } = useSelector((s: RootState) => s.assets);

    useEffect(() => {
        dispatch(fetchAssets());
        dispatch(fetchAssetLogs());
    }, [dispatch]);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const printRef = useRef<HTMLDivElement>(null);

    const assets = useMemo(() => {
        return sortAssetsByNameAndUser(allAssets.filter((a: Asset) => {
            const typeCode = (a.asset_type || '').trim().toUpperCase();
            const grpCode  = (a.asset_group || '').trim().toUpperCase();
            const isMatch = reportType === 'CCDC'
                ? (typeCode.includes('CCDC') || typeCode.includes('TSNT') || grpCode.includes('CCDC') || grpCode.includes('TSNT'))
                : (typeCode.includes('TBVP') || grpCode.includes('TBVP') || typeCode.includes('TTB-PCCC'));
            
            if (!isMatch) return false;

            if (a.receipt_date) {
                const rDate = new Date(a.receipt_date);
                const rYear = rDate.getFullYear();
                const rMonth = rDate.getMonth() + 1;
                if (rYear > year || (rYear === year && rMonth > month)) {
                    return false;
                }
            } else if (a.created_at) {
                const cDate = new Date(a.created_at);
                const cYear = cDate.getFullYear();
                const cMonth = cDate.getMonth() + 1;
                if (cYear > year || (cYear === year && cMonth > month)) {
                    return false;
                }
            }
            return true;
        }));
    }, [allAssets, reportType, month, year]);

    const assetIncreasesDecreases = useMemo(() => {
        const result: Record<string, { increase: number, decrease: number }> = {};
        
        (allLogs || []).forEach(log => {
            const logDate = new Date(log.created_at);
            const logMonth = logDate.getMonth() + 1;
            const logYear = logDate.getFullYear();
            
            if (logMonth === month && logYear === year) {
                const code = log.asset_code;
                if (!code) return;
                
                const action = (log.action || '').toLowerCase();
                const isIncrease = ['tăng', 'thêm mới', 'thêm', 'tạo mới', 'insert', 'create', 'add'].some(act => action.includes(act));
                const isDecrease = ['giảm', 'xóa', 'delete', 'remove'].some(act => action.includes(act));
                
                if (!result[code]) {
                    result[code] = { increase: 0, decrease: 0 };
                }
                
                if (isIncrease) result[code].increase += 1;
                if (isDecrease) result[code].decrease += 1;
            }
        });
        
        return result;
    }, [allLogs, month, year]);

    const tbvpMonthlyLogs = useMemo(() => (allLogs || []).filter((log) => {
        const date = new Date(log.created_at);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
    }), [allLogs, month, year]);

    const tbvpDetailMovement = useMemo(() => {
        return buildAssetDetailMonthlyMovement(tbvpMonthlyLogs);
    }, [tbvpMonthlyLogs]);

    const tbvpDetailMovementDates = useMemo(() => buildAssetDetailMovementDates(tbvpMonthlyLogs), [tbvpMonthlyLogs]);

    const tbvpTotals = useMemo(() => sumAssetDetailTotals(assets.map((asset) => {
        const movement = tbvpDetailMovement[asset.asset_code] || { purchased: 0, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0 };
        const bookQuantity = Number(asset.quantity) || 1;
        const condition = getAssetConditionQuantities(asset.status, bookQuantity);
        const checkedQuantity = condition.good + condition.damaged + condition.lost;
        return { ...movement, bookQuantity, checkedQuantity, ...condition, difference: bookQuantity - checkedQuantity };
    })), [assets, tbvpDetailMovement]);

    const dateFooterStr = `TP. Hồ Chí Minh, ngày ${now.getDate().toString().padStart(2, '0')} tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const handleExportExcel = async () => {
        if (reportType === 'TBVP') {
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('ChiTiet_TBVP', {
                views: [{ showGridLines: false }],
                pageSetup: {
                    paperSize: 9,
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    horizontalCentered: true,
                    margins: { left: 0.2, right: 0.2, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 },
                },
            });
            const border: Partial<ExcelJS.Borders> = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            const fill = (argb: string): ExcelJS.Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
            const header = (address: string, value: string, color = 'FFD9D9D9') => {
                const cell = ws.getCell(address);
                cell.value = value;
                cell.font = { name: 'Times New Roman', size: 8, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.fill = fill(color);
                cell.border = border;
            };

            ws.mergeCells('A1:M1'); ws.mergeCells('N1:Z1');
            ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT\nTRUNG TÂM ACT BẮC SÀI GÒN';
            ws.getCell('N1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc';
            ['A1', 'N1'].forEach((address) => {
                const cell = ws.getCell(address);
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
            ws.mergeCells('A2:Z2'); ws.getCell('A2').value = 'DANH SÁCH TÀI SẢN TBVP TTKV BẮC SÀI GÒN';
            ws.getCell('A2').font = { name: 'Times New Roman', size: 13, bold: true };
            ws.getCell('A2').alignment = { horizontal: 'center' };
            ws.mergeCells('A3:Z3'); ws.getCell('A3').value = `Báo cáo biến động tháng: ${String(month).padStart(2, '0')}/${year}`;
            ws.getCell('A3').font = { name: 'Times New Roman', size: 10, italic: true };
            ws.getCell('A3').alignment = { horizontal: 'center' };
            ws.getRow(1).height = 28; ws.getRow(2).height = 22; ws.getRow(3).height = 18;

            const singleHeaders = ['STT', 'Mã tài sản', 'Tên tài sản', 'Loại tài sản', 'ĐVT', 'Tình trạng', 'Mã NQL', 'Người quản lý', 'Mã NV SD', 'Nhân viên sử dụng', 'Số serial', 'Số lượng\nsổ sách'];
            singleHeaders.forEach((label, index) => {
                const column = index + 1;
                ws.mergeCells(5, column, 7, column);
                header(`${String.fromCharCode(64 + column)}5`, label);
            });
            ws.mergeCells('M5:S5'); header('M5', `BIẾN ĐỘNG THÁNG:${String(month).padStart(2, '0')}`, 'FFFFFF00');
            ws.mergeCells('M6:M7'); header('M6', 'Mua\nmới', 'FFFFFF00');
            ws.mergeCells('N6:O6'); header('N6', 'Điều chuyển', 'FFFFFF00');
            ws.mergeCells('P6:R6'); header('P6', 'Trả kho', 'FFFFFF00');
            ws.mergeCells('S6:S7'); header('S6', 'Ngày\ntháng', 'FFFFFF00');
            [['N7', 'Đi'], ['O7', 'Đến'], ['P7', 'Hỏng'], ['Q7', 'Thất\nthoát'], ['R7', 'Không\nsử dụng']].forEach(([address, label]) => header(address, label, 'FFFFFF00'));
            ws.mergeCells('T5:T7'); header('T5', 'Lý do:\nTT, QĐ,\nKH, PXK,\nBBBG', 'FFFFC7CE');
            ws.mergeCells('U5:U7'); header('U5', 'Số lượng\nkiểm\nthực tế');
            ws.mergeCells('V5:X5'); header('V5', 'Tình trạng');
            [['V6', 'Tốt'], ['W6', 'Hỏng'], ['X6', 'Thất\nthoát']].forEach(([address, label]) => {
                ws.mergeCells(`${address}:${address[0]}7`); header(address, label);
            });
            ws.mergeCells('Y5:Y7'); header('Y5', 'Chênh\nlệch');
            ws.mergeCells('Z5:Z7'); header('Z5', 'Ghi\nchú');
            for (let row = 5; row <= 7; row += 1) {
                ws.getRow(row).height = row === 5 ? 22 : 28;
                for (let column = 1; column <= 26; column += 1) ws.getCell(row, column).border = border;
            }
            ws.pageSetup.printTitlesRow = '5:7';
            [4, 10, 21, 10, 4, 9, 8, 13, 8, 13, 19, 8, 6, 5, 5, 5, 5, 5, 6, 12, 7, 5, 5, 6, 6, 7]
                .forEach((width, index) => { ws.getColumn(index + 1).width = width; });

            const totalRow = ws.addRow([
                'Tổng', '', '', '', '', '', '', '', '', '', '', tbvpTotals.bookQuantity,
                tbvpTotals.purchased, tbvpTotals.transferOut, tbvpTotals.transferIn, tbvpTotals.returnedDamaged, tbvpTotals.returnedLost, tbvpTotals.returnedUnused, '', '',
                tbvpTotals.checkedQuantity, tbvpTotals.good, tbvpTotals.damaged, tbvpTotals.lost, tbvpTotals.difference, '',
            ]);
            ws.mergeCells(totalRow.number, 1, totalRow.number, 2);
            totalRow.height = 20;
            totalRow.eachCell((cell, column) => {
                cell.border = border;
                cell.fill = fill('FFF2F2F2');
                cell.font = { name: 'Times New Roman', size: 8, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: [1, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25].includes(column) ? 'center' : 'left' };
            });

            const firstDetailRow = ws.rowCount + 1;
            assets.forEach((asset, index) => {
                const movement = tbvpDetailMovement[asset.asset_code] || { purchased: 0, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0 };
                const quantity = Number(asset.quantity) || 1;
                const condition = getAssetConditionQuantities(asset.status, quantity);
                const checkedQuantity = condition.good + condition.damaged + condition.lost;
                const row = ws.addRow([
                    index + 1, asset.asset_code || '-', asset.asset_name || '-', asset.asset_type || '-', asset.unit || '-', asset.status || '-',
                    asset.manager_code || '-', asset.manager_name || '-', asset.user_employee_code || '-', asset.user_employee_name || '-', asset.serial_number || '-', quantity,
                    movement.purchased || '-', movement.transferOut || '-', movement.transferIn || '-', movement.returnedDamaged || '-', movement.returnedLost || '-', movement.returnedUnused || '-', tbvpDetailMovementDates[asset.asset_code] || '-',
                    '', checkedQuantity, condition.good, condition.damaged, condition.lost, quantity - checkedQuantity, asset.notes || '-',
                ]);
                row.height = Math.max(22, Math.ceil(Math.max((asset.asset_name || '').length / 28, (asset.manager_name || '').length / 16, (asset.user_employee_name || '').length / 16, (asset.serial_number || '').length / 20)) * 12 + 6);
                row.eachCell((cell, column) => {
                    cell.border = border;
                    cell.font = { name: 'Times New Roman', size: 7 };
                    cell.alignment = { vertical: 'middle', wrapText: true, horizontal: [1, 5, 6, 7, 9, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25].includes(column) ? 'center' : 'left' };
                });
            });
            const lastDetailRow = ws.rowCount;
            const pageBreakAfterRow = getFinalSignaturePageBreakRow(firstDetailRow, lastDetailRow);
            if (pageBreakAfterRow) ws.getRow(pageBreakAfterRow).addPageBreak();

            const dateRow = ws.rowCount + 1;
            ws.mergeCells(dateRow, 14, dateRow, 26);
            const dateCell = ws.getCell(dateRow, 14);
            dateCell.value = dateFooterStr;
            dateCell.font = { name: 'Times New Roman', size: 9, italic: true };
            dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

            const signatureRow = dateRow + 1;
            ws.mergeCells(signatureRow, 1, signatureRow, 12);
            ws.mergeCells(signatureRow, 14, signatureRow, 26);
            const leaderCell = ws.getCell(signatureRow, 1);
            const staffCell = ws.getCell(signatureRow, 14);
            leaderCell.value = 'LÃNH ĐẠO ĐƠN VỊ';
            staffCell.value = 'NHÂN VIÊN QLTS ĐƠN VỊ';
            [leaderCell, staffCell].forEach((cell) => {
                cell.font = { name: 'Times New Roman', size: 10, bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            ws.getRow(signatureRow).height = 18;

            ws.mergeCells(signatureRow + 1, 1, signatureRow + 1, 12);
            ws.mergeCells(signatureRow + 1, 14, signatureRow + 1, 26);
            [ws.getCell(signatureRow + 1, 1), ws.getCell(signatureRow + 1, 14)].forEach((cell) => {
                cell.value = '(Ký, ghi rõ họ tên)';
                cell.font = { name: 'Times New Roman', size: 9, italic: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            ws.mergeCells(signatureRow + 2, 1, signatureRow + 5, 12);
            ws.mergeCells(signatureRow + 2, 14, signatureRow + 5, 26);
            ws.getRow(signatureRow + 2).height = 58;
            const buffer = await wb.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob); link.download = `BaoCao_ChiTiet_TBVP_T${month}.xlsx`; link.click();
            URL.revokeObjectURL(link.href);
            return;
        }
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('ChiTiet', {
            views: [{ showGridLines: true }],
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.79, right: 0.59, top: 0.79, bottom: 0.79, header: 0.3, footer: 0.3 }
            }
        });
        const border: Partial<ExcelJS.Borders> = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
        const hFill = (argb: string): ExcelJS.Fill => ({ type:'pattern', pattern:'solid', fgColor:{argb} });

        ws.mergeCells('A1:G1');
        ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT\nTRUNG TÂM ACT BẮC SÀI GÒN';
        ws.getCell('A1').font = { bold:true, size:11, name:'Times New Roman' };
        ws.mergeCells('H1:O1');
        ws.getCell('H1').value = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc`;
        ws.getCell('H1').font = { bold:true, size:11, name:'Times New Roman' };
        ws.getCell('H1').alignment = { horizontal:'center', vertical:'middle', wrapText:true };

        ws.mergeCells('A2:O2');
        ws.getCell('A2').value = `BÁO CÁO CHI TIẾT TÀI SẢN ${reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}`;
        ws.getCell('A2').font = { bold:true, size:14, name:'Times New Roman' };
        ws.getCell('A2').alignment = { horizontal:'center' };

        ws.mergeCells('A3:O3');
        ws.getCell('A3').value = `Kỳ báo cáo tháng ${String(month).padStart(2,'0')} năm ${year}`;
        ws.getCell('A3').font = { italic:true, size:11, name:'Times New Roman' };
        ws.getCell('A3').alignment = { horizontal:'center' };

        const headers = [
            'STT', 'Mã tài sản', 'Tên tài sản', 'Loại tài sản', 'Tình trạng', 
            'Mã người SD', 'Tên người SD', 'Mã người QL', 'Tên người QL', 
            'Ngày nhận', 'Tăng TS', 'Giảm TS', 'Mã đơn vị', 'Tên đơn vị', 'Ghi chú'
        ];
        const widths = [6, 15, 30, 15, 15, 10, 18, 10, 18, 12, 10, 10, 12, 20, 15];
        
        headers.forEach((h, i) => {
            const cell = ws.getCell(5, i + 1);
            cell.value = h;
            cell.font = { bold:true, size:10, name:'Times New Roman' };
            cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
            cell.fill = hFill('FFD0D0D0');
            cell.border = border;
            ws.getColumn(i + 1).width = widths[i];
        });

        assets.forEach((a, idx) => {
            const inc = assetIncreasesDecreases[a.asset_code || '']?.increase || 0;
            const dec = assetIncreasesDecreases[a.asset_code || '']?.decrease || 0;
            const r = ws.addRow([
                idx+1, a.asset_code || '-', a.asset_name, a.asset_type, a.status,
                a.user_employee_code||'-', a.user_employee_name||'-',
                a.manager_code||'-', a.manager_name||'-',
                a.receipt_date ? new Date(a.receipt_date).toLocaleDateString('vi-VN') : '-',
                inc, dec, a.location_code||'-', a.location_name||'-', reportType
            ]);
            r.eachCell(c => { c.border = border; c.font = { size:9, name:'Times New Roman' }; c.alignment = { vertical:'middle', wrapText:true }; });
        });

        const fRow = ws.rowCount + 2;
        ws.mergeCells(fRow, 12, fRow, 15);
        ws.getCell(fRow, 12).value = dateFooterStr;
        ws.getCell(fRow, 12).font = { italic:true, size:10, name:'Times New Roman' };
        ws.getCell(fRow, 12).alignment = { horizontal:'center' };

        const sRow = fRow + 1;
        ws.mergeCells(sRow, 5, sRow, 8); ws.getCell(sRow,5).value = 'LÃNH ĐẠO ĐƠN VỊ';
        ws.mergeCells(sRow, 11, sRow, 15); ws.getCell(sRow,11).value = 'NHÂN VIÊN QLTS ĐƠN VỊ';
        [ws.getCell(sRow,5), ws.getCell(sRow,11)].forEach(c => {
            c.font = { bold:true, size:10, name:'Times New Roman' };
            c.alignment = { horizontal:'center' };
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BaoCao_ChiTiet_${reportType}_T${month}.xlsx`;
        a.click();
    };

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const w = window.open('', '_blank', 'width=1400,height=900');
        if (!w) return;
        w.document.write(`
            <html><head><meta charset="utf-8"/><title>In Báo Cáo Chi Tiết</title>
            <style>
                @page { size: A4 landscape; margin: 20mm 15mm 20mm 20mm; }
                body { font-family: 'Times New Roman', serif; font-size: 10pt; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                th, td { border: 1px solid #000; padding: 3px 2px; text-align: center; vertical-align: middle; word-wrap: break-word; font-size: 7.2pt; }
                th { background: #e0e0e0; font-weight: bold; }
                .footer-container { margin-top: 30px; }
                .sig-date { text-align: right; font-style: italic; margin-bottom: 5px; padding-right: 50px; font-size: 10pt; }
                .sig-grid { display: flex; justify-content: space-between; text-align: center; width: 100%; }
                .sig-box { width: 32%; display: inline-block; vertical-align: top; }
                .sig-title { font-weight: bold; font-size: 10.5pt; }
                .sig-note { font-style: italic; font-size: 9pt; }
                /* Ensure flex layout works in print */
                .print-header { display: flex; justify-content: space-between; width: 100%; }
                .print-header-side { text-align: center; width: 45%; }
            </style></head>
            <body>${printContents}</body></html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 500);
    };

    const colStyle: React.CSSProperties = { border: '1px solid #000', padding: '3px 2px', textAlign: 'center', fontSize: '7.2pt', fontFamily: 'Times New Roman' };
    const headerStyle: React.CSSProperties = { ...colStyle, backgroundColor: '#e0e0e0', fontWeight: 'bold' };

    return (
        <Box sx={{ p: { xs: 1, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 3 }} className="no-print">
                <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight={700} sx={{ flexGrow: 1 }}>
                    Báo cáo chi tiết {reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <FormControl size="small" sx={{ width: 90 }}><InputLabel>Tháng</InputLabel>
                        <Select value={month} label="Tháng" onChange={e => setMonth(Number(e.target.value))}>
                            {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ width: 95 }}><InputLabel>Năm</InputLabel>
                        <Select value={year} label="Năm" onChange={e => setYear(Number(e.target.value))}>
                            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </Select>
                    </FormControl>
                    {!isMobile && (
                        <Button 
                            variant="outlined" 
                            color="error" 
                            startIcon={<PrintIcon />} 
                            onClick={handlePrint}
                        >
                            In / Xuất PDF
                        </Button>
                    )}
                    <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={handleExportExcel}>Excel</Button>
                </Stack>
            </Stack>

            {status === 'loading' && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

            <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 3 }, border: '1px solid #ddd', minWidth: '900px' }} ref={printRef}>
                <div className="print-header" style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Times New Roman', width: '100%' }}>
                    <div className="print-header-side" style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</div>
                        <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '11pt' }}>TRUNG TÂM ACT BẮC SÀI GÒN</div>
                    </div>
                    <div className="print-header-side" style={{ textAlign: 'center', width: '45%' }}>
                        <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                        <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '11pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                    </div>
                </div>

                <div style={{ textAlign: 'center', margin: '24px 0', fontFamily: 'Times New Roman' }}>
                    <div style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '13pt' }}>
                        {reportType === 'TBVP' ? 'DANH SÁCH TÀI SẢN TBVP TTKV BẮC SÀI GÒN' : 'BÁO CÁO CHI TIẾT TÀI SẢN CCDC-TSNT'}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                        {reportType === 'TBVP' ? `Báo cáo biến động tháng: ${String(month).padStart(2, '0')}/${year}` : `Kỳ báo cáo tháng ${String(month).padStart(2,'0')} năm ${year}`}
                    </div>
                </div>

                {reportType === 'TBVP' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman', tableLayout: 'fixed', fontSize: '5.8pt' }}>
                    <colgroup>
                        {[2, 4.9, 8, 4.3, 2.2, 4.5, 3.7, 4.7, 3.7, 4.7, 10.5, 3.6, 2.8, 2.3, 2.3, 2.3, 2.3, 2.3, 2.8, 6.2, 3.6, 2.8, 2.8, 3.1, 3.4, 4.7].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}
                    </colgroup>
                    <thead>
                        <tr>
                            {['STT', 'Mã tài sản', 'Tên tài sản', 'Loại tài sản', 'ĐVT', 'Tình trạng', 'Mã NQL', 'Người quản lý', 'Mã NV SD', 'Nhân viên sử dụng', 'Số serial', 'Số lượng sổ sách'].map((label) => <th key={label} rowSpan={3} style={{ ...headerStyle, fontSize: '6pt' }}>{label}</th>)}
                            <th colSpan={7} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>BIẾN ĐỘNG THÁNG:{String(month).padStart(2, '0')}</th>
                            <th rowSpan={3} style={{ ...headerStyle, color: '#c00000', fontSize: '6pt' }}>Lý do: TT, QĐ, KH, PXK, BBBG</th>
                            <th rowSpan={3} style={{ ...headerStyle, fontSize: '6pt' }}>Số lượng kiểm thực tế</th>
                            <th colSpan={3} style={{ ...headerStyle, fontSize: '6pt' }}>Tình trạng</th>
                            <th rowSpan={3} style={{ ...headerStyle, fontSize: '6pt' }}>Chênh lệch</th>
                            <th rowSpan={3} style={{ ...headerStyle, fontSize: '6pt' }}>Ghi chú</th>
                        </tr>
                        <tr>
                            <th rowSpan={2} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>Mua mới</th>
                            <th colSpan={2} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>Điều chuyển</th>
                            <th colSpan={3} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>Trả kho</th>
                            <th rowSpan={2} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>Ngày tháng</th>
                            {['Tốt', 'Hỏng', 'Thất thoát'].map((label) => <th key={label} rowSpan={2} style={{ ...headerStyle, fontSize: '6pt' }}>{label}</th>)}
                        </tr>
                        <tr>
                            {['Đi', 'Đến', 'Hỏng', 'Thất thoát', 'Không sử dụng'].map((label) => <th key={label} style={{ ...headerStyle, backgroundColor: '#ffff00', fontSize: '6pt' }}>{label}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={2} style={{ ...headerStyle, fontSize: '5.8pt' }}>Tổng</td><td colSpan={9} style={{ ...headerStyle, fontSize: '5.8pt' }}></td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.bookQuantity}</td>
                            <td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.purchased}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.transferOut}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.transferIn}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.returnedDamaged}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.returnedLost}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.returnedUnused}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}></td><td style={{ ...headerStyle, fontSize: '5.8pt' }}></td>
                            <td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.checkedQuantity}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.good}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.damaged}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.lost}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}>{tbvpTotals.difference}</td><td style={{ ...headerStyle, fontSize: '5.8pt' }}></td>
                        </tr>
                        {assets.map((asset, index) => {
                            const movement = tbvpDetailMovement[asset.asset_code] || { purchased: 0, transferOut: 0, transferIn: 0, returnedDamaged: 0, returnedLost: 0, returnedUnused: 0 };
                            const quantity = Number(asset.quantity) || 1;
                            const condition = getAssetConditionQuantities(asset.status, quantity);
                            const checkedQuantity = condition.good + condition.damaged + condition.lost;
                            const detailStyle = { ...colStyle, fontSize: '5.8pt', padding: '2px 1px', overflowWrap: 'anywhere' as const };
                            return <tr key={asset.id}>
                                <td style={detailStyle}>{index + 1}</td><td style={detailStyle}>{asset.asset_code || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.asset_name || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.asset_type || '-'}</td><td style={detailStyle}>{asset.unit || '-'}</td><td style={detailStyle}>{asset.status || '-'}</td><td style={detailStyle}>{asset.manager_code || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.manager_name || '-'}</td><td style={detailStyle}>{asset.user_employee_code || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.user_employee_name || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.serial_number || '-'}</td><td style={detailStyle}>{quantity}</td>
                                <td style={detailStyle}>{movement.purchased || '-'}</td><td style={detailStyle}>{movement.transferOut || '-'}</td><td style={detailStyle}>{movement.transferIn || '-'}</td><td style={detailStyle}>{movement.returnedDamaged || '-'}</td><td style={detailStyle}>{movement.returnedLost || '-'}</td><td style={detailStyle}>{movement.returnedUnused || '-'}</td><td style={detailStyle}>{tbvpDetailMovementDates[asset.asset_code] || '-'}</td><td style={{ ...detailStyle, textAlign: 'left' }}></td><td style={detailStyle}>{checkedQuantity}</td><td style={detailStyle}>{condition.good}</td><td style={detailStyle}>{condition.damaged}</td><td style={detailStyle}>{condition.lost}</td><td style={detailStyle}>{quantity - checkedQuantity}</td><td style={{ ...detailStyle, textAlign: 'left' }}>{asset.notes || '-'}</td>
                            </tr>;
                        })}
                    </tbody>
                </table>
                ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman', tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th style={{...headerStyle, width: '3%'}}>STT</th>
                            <th style={{...headerStyle, width: '8%'}}>Mã tài sản</th>
                            <th style={{...headerStyle, width: '15%'}}>Tên tài sản</th>
                            <th style={{...headerStyle, width: '8%'}}>Loại tài sản</th>
                            <th style={{...headerStyle, width: '6%'}}>Tình trạng</th>
                            <th style={{...headerStyle, width: '5%'}}>Mã người SD</th>
                            <th style={{...headerStyle, width: '9%'}}>Tên người SD</th>
                            <th style={{...headerStyle, width: '5%'}}>Mã người QL</th>
                            <th style={{...headerStyle, width: '9%'}}>Tên người QL</th>
                            <th style={{...headerStyle, width: '7%'}}>Ngày nhận</th>
                            <th style={{...headerStyle, width: '4%'}}>Tăng TS</th>
                            <th style={{...headerStyle, width: '4%'}}>Giảm TS</th>
                            <th style={{...headerStyle, width: '6%'}}>Mã đơn vị</th>
                            <th style={{...headerStyle, width: '11%'}}>Tên đơn vị</th>
                            <th style={{...headerStyle, width: '5%'}}>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((a, i) => {
                            const inc = assetIncreasesDecreases[a.asset_code || '']?.increase || 0;
                            const dec = assetIncreasesDecreases[a.asset_code || '']?.decrease || 0;
                            return (
                                <tr key={a.id}>
                                    <td style={colStyle}>{i + 1}</td>
                                    <td style={colStyle}>{a.asset_code || '-'}</td>
                                    <td style={{ ...colStyle, textAlign: 'left' }}>{a.asset_name}</td>
                                    <td style={{ ...colStyle, textAlign: 'left', fontSize: '8pt' }}>{a.asset_type}</td>
                                    <td style={colStyle}>{a.status}</td>
                                    <td style={colStyle}>{a.user_employee_code || '-'}</td>
                                    <td style={{ ...colStyle, textAlign: 'left' }}>{a.user_employee_name || '-'}</td>
                                    <td style={colStyle}>{a.manager_code || '-'}</td>
                                    <td style={{ ...colStyle, textAlign: 'left' }}>{a.manager_name || '-'}</td>
                                    <td style={colStyle}>{a.receipt_date ? new Date(a.receipt_date).toLocaleDateString('vi-VN') : '-'}</td>
                                    <td style={colStyle}>{inc}</td>
                                    <td style={colStyle}>{dec}</td>
                                    <td style={colStyle}>{a.location_code || '-'}</td>
                                    <td style={{ ...colStyle, textAlign: 'left', fontSize: '8pt' }}>{a.location_name || '-'}</td>
                                    <td style={colStyle}>{reportType}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                )}

                <div className="footer-container" style={{ marginTop: '30px', fontFamily: 'Times New Roman' }}>
                    <div className="sig-date" style={{ textAlign: 'right', fontStyle: 'italic', marginBottom: '5px', paddingRight: '50px' }}>
                        {dateFooterStr}
                    </div>
                    <div className="sig-grid" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                        <div className="sig-box" style={{ width: '45%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>LÃNH ĐẠO ĐƠN VỊ</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                        <div className="sig-box" style={{ width: '45%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>NHÂN VIÊN QLTS ĐƠN VỊ</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                    </div>
                </div>
            </Paper>
            </Box>
        </Box>
    );
};

export default AssetDetailReport;
