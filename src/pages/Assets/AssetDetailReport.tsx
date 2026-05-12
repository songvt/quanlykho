import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box, Typography, Button, Select, MenuItem, FormControl,
    InputLabel, Paper, Stack, CircularProgress, useMediaQuery, useTheme
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ExcelJS from 'exceljs';
import { fetchAssets } from '../../store/slices/assetsSlice';
import type { AppDispatch, RootState } from '../../store';
import type { Asset } from '../../types';

interface Props {
    reportType: 'CCDC' | 'TBVP';
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

const AssetDetailReport: React.FC<Props> = ({ reportType }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: allAssets, status } = useSelector((s: RootState) => s.assets);

    useEffect(() => {
        if (allAssets.length === 0 && status === 'idle') {
            dispatch(fetchAssets());
        }
    }, [allAssets.length, status, dispatch]);

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const printRef = useRef<HTMLDivElement>(null);

    const assets = useMemo(() => {
        return allAssets.filter((a: Asset) => {
            const typeCode = (a.asset_type || '').trim().toUpperCase();
            const grpCode  = (a.asset_group || '').trim().toUpperCase();
            if (reportType === 'CCDC') {
                return typeCode.startsWith('CCDC') || typeCode.startsWith('TSNT') ||
                       grpCode.startsWith('CCDC') || grpCode.startsWith('TSNT');
            } else {
                return typeCode.startsWith('TBVP') || grpCode.startsWith('TBVP');
            }
        });
    }, [allAssets, reportType]);

    const dateFooterStr = `TP.Hồ Chí Minh, ngày ${now.getDate().toString().padStart(2, '0')} tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const handleExportExcel = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('ChiTiet');
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
            const r = ws.addRow([
                idx+1, a.asset_code || '-', a.asset_name, a.asset_type, a.status,
                a.user_employee_code||'-', a.user_employee_name||'-',
                a.manager_code||'-', a.manager_name||'-',
                a.receipt_date ? new Date(a.receipt_date).toLocaleDateString('vi-VN') : '-',
                0, 0, a.location_code||'-', a.location_name||'-', reportType
            ]);
            r.eachCell(c => { c.border = border; c.font = { size:9, name:'Times New Roman' }; c.alignment = { vertical:'middle', wrapText:true }; });
        });

        const fRow = ws.rowCount + 2;
        ws.mergeCells(fRow, 12, fRow, 15);
        ws.getCell(fRow, 12).value = dateFooterStr;
        ws.getCell(fRow, 12).font = { italic:true, size:10, name:'Times New Roman' };
        ws.getCell(fRow, 12).alignment = { horizontal:'center' };

        const sRow = fRow + 1;
        ws.mergeCells(sRow, 1, sRow, 3); ws.getCell(sRow,1).value = 'TTVH';
        ws.mergeCells(sRow, 5, sRow, 8); ws.getCell(sRow,5).value = 'LÃNH ĐẠO ĐƠN VỊ';
        ws.mergeCells(sRow, 11, sRow, 15); ws.getCell(sRow,11).value = 'NHÂN VIÊN QLTS ĐƠN VỊ';
        [ws.getCell(sRow,1), ws.getCell(sRow,5), ws.getCell(sRow,11)].forEach(c => {
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
                @page { size: A3 landscape; margin: 5mm; }
                body { font-family: 'Times New Roman', serif; font-size: 10pt; margin: 0; padding: 0; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
                th, td { border: 1px solid #000; padding: 2px; text-align: center; vertical-align: middle; word-wrap: break-word; font-size: 8.5pt; }
                th { background: #e0e0e0; font-weight: bold; }
                .footer-container { margin-top: 30px; }
                .sig-date { text-align: right; font-style: italic; margin-bottom: 5px; padding-right: 50px; font-size: 10.5pt; }
                .sig-grid { display: flex; justify-content: space-between; text-align: center; width: 100%; }
                .sig-box { width: 32%; display: inline-block; vertical-align: top; }
                .sig-title { font-weight: bold; font-size: 11pt; }
                .sig-note { font-style: italic; font-size: 9.5pt; }
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

    const colStyle: React.CSSProperties = { border: '1px solid #000', padding: '3px', textAlign: 'center', fontSize: '8.5pt', fontFamily: 'Times New Roman' };
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
                    {!isMobile && <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>In</Button>}
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
                        BÁO CÁO CHI TIẾT TÀI SẢN {reportType === 'CCDC' ? 'CCDC-TSNT' : 'TBVP'}
                    </div>
                    <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>
                        Kỳ báo cáo tháng {String(month).padStart(2,'0')} năm {year}
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Times New Roman' }}>
                    <thead>
                        <tr>
                            <th style={{...headerStyle, width: 30}}>STT</th>
                            <th style={{...headerStyle, width: 90}}>Mã tài sản</th>
                            <th style={{...headerStyle, width: 180}}>Tên tài sản</th>
                            <th style={{...headerStyle, width: 100}}>Loại tài sản</th>
                            <th style={{...headerStyle, width: 80}}>Tình trạng</th>
                            <th style={{...headerStyle, width: 60}}>Mã người SD</th>
                            <th style={{...headerStyle, width: 120}}>Tên người SD</th>
                            <th style={{...headerStyle, width: 60}}>Mã người QL</th>
                            <th style={{...headerStyle, width: 120}}>Tên người QL</th>
                            <th style={{...headerStyle, width: 80}}>Ngày nhận</th>
                            <th style={{...headerStyle, width: 50}}>Tăng TS</th>
                            <th style={{...headerStyle, width: 50}}>Giảm TS</th>
                            <th style={{...headerStyle, width: 80}}>Mã đơn vị</th>
                            <th style={{...headerStyle, width: 150}}>Tên đơn vị</th>
                            <th style={{...headerStyle, width: 60}}>Ghi chú</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((a, i) => (
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
                                <td style={colStyle}>0</td>
                                <td style={colStyle}>0</td>
                                <td style={colStyle}>{a.location_code || '-'}</td>
                                <td style={{ ...colStyle, textAlign: 'left', fontSize: '8pt' }}>{a.location_name || '-'}</td>
                                <td style={colStyle}>{reportType}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="footer-container" style={{ marginTop: '30px', fontFamily: 'Times New Roman' }}>
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

export default AssetDetailReport;
