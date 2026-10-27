import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box, Typography, Button, Select, MenuItem, FormControl,
    InputLabel, Paper, Chip, Divider, Stack, CircularProgress,
    useMediaQuery, useTheme
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ExcelJS from 'exceljs';
import { fetchAssets, fetchAssetLogs } from '../../store/slices/assetsSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Asset } from '../../types';
import { calculateInspectionQuantity, calculateQuantityDifference } from '../../utils/assetMonthlyReportMath';

interface Props {
    reportType: 'CCDC' | 'TBVP';
}

const STATUS_USING = ['Đang sử dụng', 'Đang SD', 'Active'];
const STATUS_BROKEN = ['Hỏng', 'Hỏng hóc', 'Broken'];
const STATUS_UNUSED = ['Chưa sử dụng', 'Mới', 'New', 'Tồn kho'];
const STATUS_REPAIR = ['Đang bảo dưỡng', 'Sửa chữa', 'Bảo dưỡng', 'Maintenance'];
const STATUS_LOST = ['Thất thoát', 'Mất', 'Lost'];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

const AssetMonthlyReport: React.FC<Props> = ({ reportType }) => {
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

    const groupedAssets = useMemo(() => {
        const groups: Record<string, any> = {};

        // Helper to check if name/type matches reportType
        const matchesType = (type: string, group: string) => {
            const typeCode = (type || '').trim().toUpperCase();
            const grpCode  = (group || '').trim().toUpperCase();
            if (reportType === 'CCDC') {
                return typeCode.includes('CCDC') || typeCode.includes('TSNT') ||
                       grpCode.includes('CCDC') || grpCode.includes('TSNT');
            } else {
                return typeCode.includes('TBVP') || grpCode.includes('TBVP') || typeCode.includes('TTB-PCCC');
            }
        };

        // 1. Process currently active assets
        allAssets.forEach((a: Asset) => {
            if (!matchesType(a.asset_type || '', a.asset_group || '')) return;

            const key = `${(a.asset_name || 'N/A').trim()}_${(a.asset_type || '').trim()}`;
            if (!groups[key]) {
                groups[key] = { 
                    name: a.asset_name, 
                    type: a.asset_type, 
                    currentQty: 0,
                    totalQty: 0, 
                    usingQty: 0, 
                    brokenQty: 0, 
                    unusedQty: 0, 
                    repairQty: 0, 
                    lostQty: 0,
                    increaseQty: 0,
                    decreaseQty: 0,
                    departments: new Set(),
                    units: new Set()
                };
            }
            const qty = a.quantity || 0;
            groups[key].currentQty += qty;
            if (a.unit) groups[key].units.add(a.unit);

            const s = (a.status || '').trim();
            if (STATUS_USING.some(prefix => s.includes(prefix))) groups[key].usingQty += qty;
            else if (STATUS_BROKEN.some(prefix => s.includes(prefix))) groups[key].brokenQty += qty;
            else if (STATUS_LOST.some(prefix => s.includes(prefix))) groups[key].lostQty += qty;
            else if (STATUS_UNUSED.some(prefix => s.includes(prefix))) groups[key].unusedQty += qty;
            else if (STATUS_REPAIR.some(prefix => s.includes(prefix))) groups[key].repairQty += qty;
            else groups[key].usingQty += qty;
            
            if (a.location_name) groups[key].departments.add(a.location_name);
            else if (a.user_department_name) groups[key].departments.add(a.user_department_name);
            else if (a.management_unit_name) groups[key].departments.add(a.management_unit_name);
        });

        // 2. Process logs
        allLogs.forEach(log => {
            if (!matchesType(log.asset_type || '', log.asset_group || '')) return;

            const key = `${(log.asset_name || 'N/A').trim()}_${(log.asset_type || '').trim()}`;
            let targetKey = key;
            if (!groups[targetKey]) {
                const foundKey = Object.keys(groups).find(k => k.startsWith((log.asset_name || 'N/A').trim()));
                if (foundKey) {
                    targetKey = foundKey;
                } else {
                    groups[targetKey] = {
                        name: log.asset_name || 'N/A',
                        type: log.asset_type || '',
                        currentQty: 0,
                        totalQty: 0,
                        usingQty: 0,
                        brokenQty: 0,
                        unusedQty: 0,
                        repairQty: 0,
                        lostQty: 0,
                        increaseQty: 0,
                        decreaseQty: 0,
                        departments: new Set(),
                        units: new Set()
                    };
                }
            }

            const logDate = new Date(log.created_at);
            const logMonth = logDate.getMonth() + 1;
            const logYear = logDate.getFullYear();

            const action = (log.action || '').toLowerCase();
            const isIncrease = ['tăng', 'thêm mới', 'thêm', 'tạo mới', 'insert', 'create', 'add'].some(a => action.includes(a));
            const isDecrease = ['giảm', 'xóa', 'delete', 'remove'].some(a => action.includes(a));

            if (logMonth === month && logYear === year) {
                if (isIncrease) groups[targetKey].increaseQty += 1;
                if (isDecrease) groups[targetKey].decreaseQty += 1;
                if (log.department) groups[targetKey].departments.add(log.department);
            } else if (logYear > year || (logYear === year && logMonth > month)) {
                if (isIncrease) {
                    groups[targetKey].currentQty -= 1;
                }
                if (isDecrease) {
                    groups[targetKey].currentQty += 1;
                }
            }
        });

        // 3. Finalize totalQty and status breakdown
        return Object.values(groups)
            .map(g => {
                const totalQty = Math.max(0, g.currentQty);
                let usingQty = g.usingQty;
                let brokenQty = g.brokenQty;
                let unusedQty = g.unusedQty;
                let repairQty = g.repairQty;
                let lostQty = g.lostQty;

                if (totalQty === 0) {
                    usingQty = 0;
                    brokenQty = 0;
                    unusedQty = 0;
                    repairQty = 0;
                    lostQty = 0;
                } else {
                    const currentSum = usingQty + brokenQty + unusedQty + repairQty + lostQty;
                    if (currentSum > 0 && currentSum !== totalQty) {
                        const ratio = totalQty / currentSum;
                        usingQty = Math.round(usingQty * ratio);
                        brokenQty = Math.round(brokenQty * ratio);
                        unusedQty = Math.round(unusedQty * ratio);
                        lostQty = Math.round(lostQty * ratio);
                        repairQty = totalQty - (usingQty + brokenQty + unusedQty + lostQty);
                    }
                }

                const openingQty = totalQty - g.increaseQty + g.decreaseQty;
                const inspectionQty = calculateInspectionQuantity(openingQty, g.increaseQty, g.decreaseQty);

                return {
                    name: g.name,
                    type: g.type,
                    unit: Array.from(g.units).join(', ') || '-',
                    totalQty,
                    usingQty,
                    brokenQty,
                    unusedQty,
                    repairQty,
                    lostQty,
                    increaseQty: g.increaseQty,
                    decreaseQty: g.decreaseQty,
                    openingQty,
                    inspectionQty,
                    differenceQty: calculateQuantityDifference(openingQty, inspectionQty),
                    department: Array.from(g.departments).join(', ') || '-'
                };
            })
            .filter(g => g.openingQty > 0 || g.increaseQty > 0 || g.decreaseQty > 0 || g.totalQty > 0)
            .sort((left, right) => (
                (left.name || '').localeCompare(right.name || '', 'vi', { sensitivity: 'base', numeric: true })
                || (left.type || '').localeCompare(right.type || '', 'vi', { sensitivity: 'base', numeric: true })
            ));
    }, [allAssets, allLogs, reportType, month, year]);

    const summary = useMemo(() => {
        return groupedAssets.reduce((acc, g) => ({
            opening: acc.opening + (g.openingQty || 0),
            increase: acc.increase + (g.increaseQty || 0),
            decrease: acc.decrease + (g.decreaseQty || 0),
            inspection: acc.inspection + g.inspectionQty,
            difference: acc.difference + g.differenceQty,
            using: acc.using + g.usingQty, 
            broken: acc.broken + g.brokenQty, 
            unused: acc.unused + g.unusedQty, 
            repair: acc.repair + g.repairQty,
            lost: acc.lost + g.lostQty
        }), { opening: 0, increase: 0, decrease: 0, inspection: 0, difference: 0, using: 0, broken: 0, unused: 0, repair: 0, lost: 0 });
    }, [groupedAssets]);

    const currentDay   = now.getDate().toString().padStart(2, '0');
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear  = now.getFullYear();
    const dateFooterStr = `TP.Hồ Chí Minh, ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}`;

    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('BaoCao', {
            views: [{ showGridLines: false }],
            pageSetup: {
                paperSize: 9, // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                horizontalCentered: true,
                margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.15, footer: 0.15 }
            }
        });
        const border: Partial<ExcelJS.Borders> = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
        const hFill = (argb: string): ExcelJS.Fill => ({ type:'pattern', pattern:'solid', fgColor:{argb} });

        ws.mergeCells('A1:G1');
        ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT\nTRUNG TÂM ACT BẮC SÀI GÒN';
        ws.getCell('A1').font = { bold:true, size:10, name:'Times New Roman' };
        ws.getCell('A1').alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        ws.mergeCells('H1:M1');
        ws.getCell('H1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc';
        ws.getCell('H1').font = { bold:true, size:10, name:'Times New Roman' };
        ws.getCell('H1').alignment = { horizontal:'center', vertical:'middle', wrapText:true };
        ws.getRow(1).height = 31;

        ws.mergeCells('A2:M2');
        ws.getCell('A2').value = reportType === 'TBVP' ? 'TỔNG HỢP TBVP VÀ SỰ BIẾN ĐỘNG' : 'BÁO CÁO TỔNG HỢP TÀI SẢN CCDC-TSNT';
        ws.getCell('A2').font = { bold:true, size:14, name:'Times New Roman' };
        ws.getCell('A2').alignment = { horizontal:'center', vertical:'middle' };
        ws.getRow(2).height = 23;

        ws.mergeCells('A3:M3');
        ws.getCell('A3').value = `Kỳ báo cáo tháng ${String(month).padStart(2,'0')} năm ${year}`;
        ws.getCell('A3').font = { italic:true, size:11, name:'Times New Roman' };
        ws.getCell('A3').alignment = { horizontal:'center', vertical:'middle' };
        ws.getRow(3).height = 18;

        // Keep the full table inside one A4 landscape page; long asset names
        // wrap instead of being clipped or forcing an unreadably small scale.
        [4.5, 23, 19, 6, 8, 6, 6, 8, 6, 6, 7, 7, 14].forEach((width, index) => { ws.getColumn(index + 1).width = width; });
        ws.mergeCells('A5:A6'); ws.mergeCells('B5:B6'); ws.mergeCells('C5:C6'); ws.mergeCells('D5:D6'); ws.mergeCells('E5:E6');
        ws.mergeCells('F5:G5'); ws.mergeCells('H5:H6'); ws.mergeCells('I5:K5'); ws.mergeCells('L5:L6'); ws.mergeCells('M5:M6');
        const setHeader = (address: string, value: string, fill = 'FFD0D0D0') => {
            const cell = ws.getCell(address);
            cell.value = value;
            cell.font = { bold:true, size:10, name:'Times New Roman' };
            cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
            cell.fill = hFill(fill);
            cell.border = border;
        };
        [
            ['A5', 'TT'], ['B5', 'Tên tài sản'], ['C5', 'Loại tài sản'], ['D5', 'ĐVT'], ['E5', 'Số lượng\nsổ sách'],
            ['F5', `BIẾN ĐỘNG\nTHÁNG: ${month}`], ['H5', 'Số lượng\nkiểm'], ['I5', 'Tình trạng'], ['L5', 'Chênh\nlệch'], ['M5', 'Ghi chú'],
            ['F6', 'Tăng', 'FFFFFF00'], ['G6', 'Giảm', 'FFFFFF00'], ['I6', 'Tốt'], ['J6', 'Hỏng'], ['K6', 'Thất\nthoát'],
        ].forEach(([address, value, fill]) => setHeader(address, value, fill));
        for (let column = 1; column <= 13; column += 1) {
            const cell = ws.getCell(7, column);
            cell.value = `(${column})`;
            cell.font = { bold:true, size:9, name:'Times New Roman' };
            cell.alignment = { horizontal:'center', vertical:'middle' };
            cell.border = border;
        }
        ws.getRow(5).height = 31;
        ws.getRow(6).height = 25;
        ws.getRow(7).height = 17;
        ws.pageSetup.printTitlesRow = '5:7';

        const totRow = ws.addRow(['Tổng','','','',summary.opening,summary.increase,summary.decrease,summary.inspection,summary.using,summary.broken,summary.lost,summary.difference,'']);
        totRow.eachCell(c => { c.font = { bold:true }; c.fill = hFill('FFE8E8E8'); c.border = border; });

        groupedAssets.forEach((g, idx) => {
            const r = ws.addRow([idx+1, g.name, g.type, g.unit, g.openingQty, g.increaseQty || '-', g.decreaseQty || '-', g.inspectionQty, g.usingQty, g.brokenQty, g.lostQty, g.differenceQty, g.department]);
            r.eachCell((c, column) => {
                c.border = border;
                c.font = { size:9, name:'Times New Roman' };
                c.alignment = { vertical:'middle', wrapText:true, horizontal: [1, 4, 5, 6, 7, 8, 9, 10, 11, 12].includes(column) ? 'center' : 'left' };
            });
            const wrappedLines = Math.max(
                Math.ceil((g.name || '').length / 28),
                Math.ceil((g.type || '').length / 24),
                Math.ceil((g.department || '').length / 34),
                1,
            );
            r.height = Math.max(18, wrappedLines * 12);
        });

        const fRow = ws.rowCount + 2;
        ws.mergeCells(fRow, 10, fRow, 13);
        ws.getCell(fRow, 10).value = dateFooterStr;
        ws.getCell(fRow, 10).font = { italic:true, size:10, name:'Times New Roman' };
        ws.getCell(fRow, 10).alignment = { horizontal:'center' };

        const sRow = fRow + 1;
        ws.mergeCells(sRow, 5, sRow, 9); ws.getCell(sRow,5).value = 'NHÂN VIÊN QLTS ĐƠN VỊ';
        ws.mergeCells(sRow, 10, sRow, 13); ws.getCell(sRow,10).value = 'LÃNH ĐẠO ĐƠN VỊ';
        [ws.getCell(sRow,5), ws.getCell(sRow,10)].forEach(c => {
            c.font = { bold:true, size:10, name:'Times New Roman' };
            c.alignment = { horizontal:'center' };
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `BaoCao_${reportType}_T${month}.xlsx`;
        a.click();
    };

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML;
        if (!printContents) return;
        const w = window.open('', '_blank', 'width=1200,height=800');
        if (!w) return;
        w.document.write(`
            <html><head><meta charset="utf-8"/><title>In Báo Cáo Tổng Hợp</title>
            <style>
                /* Reserve a stable bottom area for handwritten signatures. */
                @page { size: A4 landscape; margin: 20mm 15mm 22mm 20mm; }
                body { font-family: 'Times New Roman', serif; font-size: 10.5pt; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: auto; }
                th, td { border: 1px solid #000; padding: 4px 3px; text-align: center; vertical-align: middle; word-wrap: break-word; font-size: 8.5pt; }
                th { background: #e0e0e0; font-weight: bold; }
                .footer-container {
                    margin-top: 12mm;
                    min-height: 46mm;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .sig-date { text-align: right; font-style: italic; margin-bottom: 5px; padding-right: 50px; font-size: 10pt; }
                .sig-grid { display: flex; justify-content: space-between; text-align: center; width: 100%; }
                .sig-box { width: 32%; min-height: 34mm; display: inline-block; vertical-align: top; }
                .sig-title { font-weight: bold; font-size: 10.5pt; }
                .sig-note { font-style: italic; font-size: 9pt; }
                /* Flex layout for print */
                .print-header { display: flex; justify-content: space-between; width: 100%; }
                .print-header-side { text-align: center; width: 45%; }
            </style></head>
            <body>${printContents}</body></html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 500);
    };

    const colStyle: React.CSSProperties = { border: '1px solid #000', padding: '4px 3px', textAlign: 'center', fontSize: '8.5pt', fontFamily: 'Times New Roman' };
    const headerStyle: React.CSSProperties = { ...colStyle, backgroundColor: '#e0e0e0', fontWeight: 'bold' };

    return (
        <Box sx={{ p: { xs: 1, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 3 }} className="no-print">
                <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight={700} sx={{ flexGrow: 1 }}>
                    Báo cáo {reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}
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
            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 4 }, border: '1px solid #ddd', minWidth: '800px' }} ref={printRef}>
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

                <div style={{ textAlign: 'center', margin: '32px 0', fontFamily: 'Times New Roman' }}>
                    <div style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '14pt' }}>
                        {reportType === 'TBVP' ? 'TỔNG HỢP TBVP VÀ SỰ BIẾN ĐỘNG' : 'BÁO CÁO TỔNG HỢP TÀI SẢN CCDC-TSNT'}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                        Kỳ báo cáo tháng {String(month).padStart(2,'0')} năm {year}
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman' }}>
                    <thead>
                        <tr>
                            <th style={headerStyle} rowSpan={2}>STT</th>
                            <th style={headerStyle} rowSpan={2}>Tên tài sản</th>
                            <th style={headerStyle} rowSpan={2}>Loại tài sản</th>
                            <th style={headerStyle} rowSpan={2}>ĐVT</th>
                            <th style={headerStyle} rowSpan={2}>Số lượng sổ sách</th>
                            <th style={headerStyle} colSpan={2}>BIẾN ĐỘNG THÁNG: {month}</th>
                            <th style={headerStyle} rowSpan={2}>Số lượng kiểm</th>
                            <th style={headerStyle} colSpan={3}>Tình trạng</th>
                            <th style={headerStyle} rowSpan={2}>Chênh lệch</th>
                            <th style={headerStyle} rowSpan={2}>Ghi chú</th>
                        </tr>
                        <tr>
                            <th style={headerStyle}>Tăng</th>
                            <th style={headerStyle}>Giảm</th>
                            <th style={headerStyle}>Tốt</th>
                            <th style={headerStyle}>Hỏng</th>
                            <th style={headerStyle}>Thất thoát</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td style={colStyle}>Tổng</td><td colSpan={3} style={colStyle}></td>
                            <td style={colStyle}>{summary.opening}</td>
                            <td style={colStyle}>{summary.increase}</td>
                            <td style={colStyle}>{summary.decrease}</td>
                            <td style={colStyle}>{summary.inspection}</td><td style={colStyle}>{summary.using}</td>
                            <td style={colStyle}>{summary.broken}</td><td style={colStyle}>{summary.lost}</td><td style={colStyle}>{summary.difference}</td>
                            <td style={colStyle}></td>
                        </tr>
                        {groupedAssets.map((g, i) => (
                            <tr key={i}>
                                <td style={colStyle}>{i + 1}</td>
                                <td style={{ ...colStyle, textAlign: 'left' }}>{g.name}</td>
                                <td style={{ ...colStyle, textAlign: 'left' }}>{g.type}</td>
                                <td style={colStyle}>{g.unit}</td>
                                <td style={colStyle}>{g.openingQty}</td>
                                <td style={colStyle}>{g.increaseQty || '-'}</td>
                                <td style={colStyle}>{g.decreaseQty || '-'}</td>
                                <td style={colStyle}>{g.inspectionQty}</td>
                                <td style={colStyle}>{g.usingQty}</td>
                                <td style={colStyle}>{g.brokenQty}</td>
                                <td style={colStyle}>{g.lostQty}</td>
                                <td style={colStyle}>{g.differenceQty}</td>
                                <td style={{ ...colStyle, textAlign: 'left', fontSize: '8pt' }}>{g.department}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Robust Printed Footer */}
                <div className="footer-container" style={{ fontFamily: 'Times New Roman' }}>
                    <div className="sig-date" style={{ textAlign: 'right', fontStyle: 'italic', marginBottom: '5px', paddingRight: '50px' }}>
                        {dateFooterStr}
                    </div>
                    <div className="sig-grid" style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                        <div className="sig-box" style={{ width: '45%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>NHÂN VIÊN QLTS ĐƠN VỊ</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                        <div className="sig-box" style={{ width: '45%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>LÃNH ĐẠO ĐƠN VỊ</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                    </div>
                </div>
            </Paper>
            </Box>
        </Box>
    );
};

export default AssetMonthlyReport;
