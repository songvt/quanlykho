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

interface Props {
    reportType: 'CCDC' | 'TBVP';
}

const STATUS_USING = ['Đang sử dụng', 'Đang SD', 'Active'];
const STATUS_BROKEN = ['Hỏng', 'Hỏng hóc', 'Broken'];
const STATUS_UNUSED = ['Chưa sử dụng', 'Mới', 'New', 'Tồn kho'];
const STATUS_REPAIR = ['Đang bảo dưỡng', 'Sửa chữa', 'Bảo dưỡng', 'Maintenance'];

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

const AssetMonthlyReport: React.FC<Props> = ({ reportType }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: allAssets, logs: allLogs, status } = useSelector((s: RootState) => s.assets);

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchAssets());
            dispatch(fetchAssetLogs());
        }
    }, [status, dispatch]);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const printRef = useRef<HTMLDivElement>(null);

    const groupedAssets = useMemo(() => {
        const filtered = allAssets.filter((a: Asset) => {
            const typeCode = (a.asset_type || '').trim().toUpperCase();
            const grpCode  = (a.asset_group || '').trim().toUpperCase();
            if (reportType === 'CCDC') {
                return typeCode.startsWith('CCDC') || typeCode.startsWith('TSNT') ||
                       grpCode.startsWith('CCDC') || grpCode.startsWith('TSNT');
            } else {
                return typeCode.startsWith('TBVP') || grpCode.startsWith('TBVP');
            }
        });

        const groups: Record<string, any> = {};
        filtered.forEach(a => {
            const key = `${(a.asset_name || 'N/A').trim()}_${(a.asset_type || '').trim()}`;
            if (!groups[key]) {
                groups[key] = { 
                    name: a.asset_name, 
                    type: a.asset_type, 
                    totalQty: 0, 
                    usingQty: 0, 
                    brokenQty: 0, 
                    unusedQty: 0, 
                    repairQty: 0, 
                    increaseQty: 0,
                    decreaseQty: 0,
                    departments: new Set() 
                };
            }
            const qty = a.quantity || 0;
            groups[key].totalQty += qty;
            const s = (a.status || '').trim();
            if (STATUS_USING.some(prefix => s.includes(prefix))) groups[key].usingQty += qty;
            else if (STATUS_BROKEN.some(prefix => s.includes(prefix))) groups[key].brokenQty += qty;
            else if (STATUS_UNUSED.some(prefix => s.includes(prefix))) groups[key].unusedQty += qty;
            else if (STATUS_REPAIR.some(prefix => s.includes(prefix))) groups[key].repairQty += qty;
            else groups[key].usingQty += qty;
            
            if (a.location_name) groups[key].departments.add(a.location_name);
            else if (a.user_department_name) groups[key].departments.add(a.user_department_name);
            else if (a.management_unit_name) groups[key].departments.add(a.management_unit_name);
        });

        // Add increase/decrease from logs
        allLogs.forEach(log => {
            const logDate = new Date(log.created_at);
            if (logDate.getMonth() + 1 === month && logDate.getFullYear() === year) {
                const key = `${(log.asset_name || 'N/A').trim()}_${(log.asset_type || '').trim()}`;
                // We search by name/type since codes might change or be deleted
                // However, logs usually have name/type. Let's find matching group or create one
                let targetKey = key;
                if (!groups[targetKey]) {
                    // Try to find a group that starts with this name (legacy match)
                    const foundKey = Object.keys(groups).find(k => k.startsWith((log.asset_name || 'N/A').trim()));
                    if (foundKey) targetKey = foundKey;
                }

                if (groups[targetKey]) {
                    if (log.action === 'Tăng') groups[targetKey].increaseQty += 1;
                    if (log.action === 'Giảm') groups[targetKey].decreaseQty += 1;
                }
            }
        });

        return Object.values(groups).map(g => ({ 
            ...g, 
            openingQty: g.totalQty - g.increaseQty + g.decreaseQty,
            department: Array.from(g.departments).join(', ') || '-' 
        }));
    }, [allAssets, allLogs, reportType, month, year]);

    const summary = useMemo(() => {
        return groupedAssets.reduce((acc, g) => ({
            opening: acc.opening + (g.openingQty || 0),
            increase: acc.increase + (g.increaseQty || 0),
            decrease: acc.decrease + (g.decreaseQty || 0),
            total: acc.total + g.totalQty, 
            using: acc.using + g.usingQty, 
            broken: acc.broken + g.brokenQty, 
            unused: acc.unused + g.unusedQty, 
            repair: acc.repair + g.repairQty
        }), { opening: 0, increase: 0, decrease: 0, total: 0, using: 0, broken: 0, unused: 0, repair: 0 });
    }, [groupedAssets]);

    const currentDay   = now.getDate().toString().padStart(2, '0');
    const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
    const currentYear  = now.getFullYear();
    const dateFooterStr = `TP.Hồ Chí Minh, ngày ${currentDay} tháng ${currentMonth} năm ${currentYear}`;

    const prevMonthEnd   = new Date(year, month - 1, 0);
    const prevMonthLabel = `${prevMonthEnd.getDate().toString().padStart(2,'0')}/${(prevMonthEnd.getMonth()+1).toString().padStart(2,'0')}/${prevMonthEnd.getFullYear()}`;

    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('BaoCao');
        const border: Partial<ExcelJS.Borders> = { top:{style:'thin'}, bottom:{style:'thin'}, left:{style:'thin'}, right:{style:'thin'} };
        const hFill = (argb: string): ExcelJS.Fill => ({ type:'pattern', pattern:'solid', fgColor:{argb} });

        ws.mergeCells('A1:G1');
        ws.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT\nTRUNG TÂM ACT BẮC SÀI GÒN';
        ws.getCell('A1').font = { bold:true, size:11, name:'Times New Roman' };
        ws.mergeCells('H1:M1');
        ws.getCell('H1').value = `CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc`;
        ws.getCell('H1').font = { bold:true, size:11, name:'Times New Roman' };
        ws.getCell('H1').alignment = { horizontal:'center', vertical:'middle', wrapText:true };

        ws.mergeCells('A2:M2');
        ws.getCell('A2').value = `BÁO CÁO TỔNG HỢP TÀI SẢN ${reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}`;
        ws.getCell('A2').font = { bold:true, size:14, name:'Times New Roman' };
        ws.getCell('A2').alignment = { horizontal:'center' };

        ws.mergeCells('A3:M3');
        ws.getCell('A3').value = `Kỳ báo cáo tháng ${String(month).padStart(2,'0')} năm ${year}`;
        ws.getCell('A3').font = { italic:true, size:11, name:'Times New Roman' };
        ws.getCell('A3').alignment = { horizontal:'center' };

        const headers = [
            {label:'STT', width:6}, {label:'Loại tài sản', width:22}, {label:'Tên tài sản', width:35},
            {label:`SL ${prevMonthLabel}`, width:12}, {label:'Tăng', width:8}, {label:'Giảm', width:8},
            {label:'Tổng cộng', width:12}, {label:'Đang SD', width:12}, {label:'Hỏng', width:9},
            {label:'Chưa SD', width:10}, {label:'Bảo dưỡng', width:12}, {label:'Phòng/Ban', width:20}, {label:'Loại', width:8}
        ];
        headers.forEach((h, i) => {
            const cell = ws.getCell(5, i + 1);
            cell.value = h.label;
            cell.font = { bold:true, size:10, name:'Times New Roman' };
            cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
            cell.fill = hFill('FFD0D0D0');
            cell.border = border;
            ws.getColumn(i + 1).width = h.width;
        });

        const totRow = ws.addRow(['Tổng','','',summary.opening,summary.increase,summary.decrease,summary.total,summary.using,summary.broken,summary.unused,summary.repair,'','']);
        totRow.eachCell(c => { c.font = { bold:true }; c.fill = hFill('FFE8E8E8'); c.border = border; });

        groupedAssets.forEach((g, idx) => {
            const r = ws.addRow([idx+1, g.type, g.name, g.openingQty, g.increaseQty || '-', g.decreaseQty || '-', g.totalQty, g.usingQty, g.brokenQty, g.unusedQty, g.repairQty, g.department, reportType]);
            r.eachCell(c => { c.border = border; c.font = { size:10, name:'Times New Roman' }; });
        });

        const fRow = ws.rowCount + 2;
        ws.mergeCells(fRow, 10, fRow, 13);
        ws.getCell(fRow, 10).value = dateFooterStr;
        ws.getCell(fRow, 10).font = { italic:true, size:10, name:'Times New Roman' };
        ws.getCell(fRow, 10).alignment = { horizontal:'center' };

        const sRow = fRow + 1;
        ws.mergeCells(sRow, 1, sRow, 4); ws.getCell(sRow,1).value = 'TTVH';
        ws.mergeCells(sRow, 5, sRow, 9); ws.getCell(sRow,5).value = 'LÃNH ĐẠO ĐƠN VỊ';
        ws.mergeCells(sRow, 10, sRow, 13); ws.getCell(sRow,10).value = 'NHÂN VIÊN QLTS ĐƠN VỊ';
        [ws.getCell(sRow,1), ws.getCell(sRow,5), ws.getCell(sRow,10)].forEach(c => {
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
                @page { size: A4 landscape; margin: 8mm 6mm; }
                body { font-family: 'Times New Roman', serif; font-size: 10.5pt; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: auto; }
                th, td { border: 1px solid #000; padding: 4px 3px; text-align: center; vertical-align: middle; word-wrap: break-word; font-size: 8.5pt; }
                th { background: #e0e0e0; font-weight: bold; }
                .footer-container { margin-top: 40px; }
                .sig-date { text-align: right; font-style: italic; margin-bottom: 5px; padding-right: 50px; font-size: 10pt; }
                .sig-grid { display: flex; justify-content: space-between; text-align: center; width: 100%; }
                .sig-box { width: 32%; display: inline-block; vertical-align: top; }
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
                        BÁO CÁO TỔNG HỢP TÀI SẢN {reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                        Kỳ báo cáo tháng {String(month).padStart(2,'0')} năm {year}
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman' }}>
                    <thead>
                        <tr>
                            <th style={headerStyle} rowSpan={2}>STT</th>
                            <th style={headerStyle} rowSpan={2}>Loại tài sản</th>
                            <th style={headerStyle} rowSpan={2}>Tên tài sản</th>
                            <th style={headerStyle} rowSpan={2}>SL {prevMonthLabel}</th>
                            <th style={headerStyle} colSpan={2}>Số lượng thay đổi</th>
                            <th style={headerStyle} rowSpan={2}>Tổng cộng</th>
                            <th style={headerStyle} colSpan={4}>Số lượng hiện có</th>
                            <th style={headerStyle} rowSpan={2}>Phòng/Ban</th>
                        </tr>
                        <tr>
                            <th style={headerStyle}>Tăng</th>
                            <th style={headerStyle}>Giảm</th>
                            <th style={headerStyle}>Đang SD</th>
                            <th style={headerStyle}>Hỏng</th>
                            <th style={headerStyle}>Chưa SD</th>
                            <th style={headerStyle}>Bảo dưỡng</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                            <td style={colStyle}>Tổng</td><td colSpan={2} style={colStyle}></td>
                            <td style={colStyle}>{summary.opening}</td>
                            <td style={colStyle}>{summary.increase}</td>
                            <td style={colStyle}>{summary.decrease}</td>
                            <td style={colStyle}>{summary.total}</td><td style={colStyle}>{summary.using}</td>
                            <td style={colStyle}>{summary.broken}</td><td style={colStyle}>{summary.unused}</td><td style={colStyle}>{summary.repair}</td>
                            <td style={colStyle}></td>
                        </tr>
                        {groupedAssets.map((g, i) => (
                            <tr key={i}>
                                <td style={colStyle}>{i + 1}</td>
                                <td style={{ ...colStyle, textAlign: 'left' }}>{g.type}</td>
                                <td style={{ ...colStyle, textAlign: 'left' }}>{g.name}</td>
                                <td style={colStyle}>{g.openingQty}</td>
                                <td style={colStyle}>{g.increaseQty || '-'}</td>
                                <td style={colStyle}>{g.decreaseQty || '-'}</td>
                                <td style={colStyle}>{g.totalQty}</td>
                                <td style={colStyle}>{g.usingQty}</td>
                                <td style={colStyle}>{g.brokenQty}</td>
                                <td style={colStyle}>{g.unusedQty}</td>
                                <td style={colStyle}>{g.repairQty}</td>
                                <td style={{ ...colStyle, textAlign: 'left', fontSize: '8pt' }}>{g.department}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Robust Printed Footer */}
                <div className="footer-container" style={{ marginTop: '40px', fontFamily: 'Times New Roman' }}>
                    <div className="sig-date" style={{ textAlign: 'right', fontStyle: 'italic', marginBottom: '5px', paddingRight: '50px' }}>
                        {dateFooterStr}
                    </div>
                    <div className="sig-grid" style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
                        <div className="sig-box" style={{ width: '32%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>TTVH</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                        <div className="sig-box" style={{ width: '32%' }}>
                            <div className="sig-title" style={{ fontWeight: 'bold' }}>LÃNH ĐẠO ĐƠN VỊ</div>
                            <div className="sig-note" style={{ fontStyle: 'italic', fontSize: '9pt' }}>(Ký, ghi rõ họ tên)</div>
                        </div>
                        <div className="sig-box" style={{ width: '32%' }}>
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

export default AssetMonthlyReport;
