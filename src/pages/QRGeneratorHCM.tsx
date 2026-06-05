import React, { useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Grid, Stack,
    Chip, IconButton, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress,
    Tabs, Tab, Card, CardContent, Tooltip, Zoom
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { QRCodeSVG } from 'qrcode.react';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PrintIcon from '@mui/icons-material/Print';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';

import { readExcelFile } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import { parseSerialInput } from '../utils/serialParser';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { GoogleSheetService } from '../services/GoogleSheetService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface QRDataRow {
    thung: string;        // THÙNG
    thiet_bi: string;     // Thiết bị
    serial: string;       // QR
    tinh_trang: string;   // Tình Trạng
    tieu_de: string;      // Tiêu đề
}

interface QRChunk {
    label: string;   
    serials: string[];
    qrValue: string;
}

interface GroupedBox {
    key: string;
    thung: string;
    thiet_bi: string;
    tinh_trang: string;
    tieu_de: string;
    totalQuantity: number;
    serials: string[];
    qrChunks: QRChunk[];
}

const MAX_SERIALS_PER_QR = 60;
const MAX_SERIALS_TOTAL  = 140; // hard cap per box

// ─── Helper: split serials into max 2 QR chunks ─────────────────────────────
const buildQRChunks = (serials: string[]): QRChunk[] => {
    if (serials.length === 0) return [];

    const limited = serials.slice(0, MAX_SERIALS_TOTAL);

    if (limited.length <= MAX_SERIALS_PER_QR) {
        // Single QR
        return [{ label: 'Mã QR Duy Nhất', serials: limited, qrValue: limited.join('\n') }];
    }

    // Two QR codes
    const chunk1 = limited.slice(0, MAX_SERIALS_PER_QR);
    const chunk2 = limited.slice(MAX_SERIALS_PER_QR);
    return [
        { label: 'Mã QR Số 1', serials: chunk1, qrValue: chunk1.join('\n') },
        { label: 'Mã QR Số 2', serials: chunk2, qrValue: chunk2.join('\n') },
    ];
};

// ─── Helper: generate sample Excel template ───────────────────────────────────
const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('QR_Template_HCM');
    ws.columns = [
        { header: 'THÙNG', key: 'thung', width: 15 },
        { header: 'Thiết bị', key: 'thiet_bi', width: 25 },
        { header: 'QR', key: 'serial', width: 25 },
        { header: 'Tình Trạng', key: 'tinh_trang', width: 20 },
        { header: 'Tiêu đề', key: 'tieu_de', width: 40 },
    ];
    
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        cell.alignment = { horizontal: 'center' };
    });

    const samples = [
        { thung: '0826', thiet_bi: 'ONT_H646EW', serial: 'GP1B1MG421B0579', tinh_trang: 'Hàng thu hồi', tieu_de: 'LDC 44.11.2025/VTT-ĐHBH ngày 07/11/2025' },
        { thung: '0826', thiet_bi: 'ONT_H646EW', serial: 'GR8D1MG421E8557', tinh_trang: 'Hàng thu hồi', tieu_de: 'LDC 44.11.2025/VTT-ĐHBH ngày 07/11/2025' },
    ];
    samples.forEach(r => ws.addRow(r));
    
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'QR_Import_Template_HCM.xlsx');
};

const QRGeneratorHCM = () => {
    const { profile: currentUser } = useSelector((state: RootState) => state.auth);
    const { success, error: notifyError } = useNotification();
    const [dataRows, setDataRows] = useState<QRDataRow[]>([]);
    
    // Manual inputs
    const [manualThung, setManualThung] = useState('0826');
    const [manualThietBi, setManualThietBi] = useState('ONT_H646EW');
    const [manualTinhTrang, setManualTinhTrang] = useState('Hàng thu hồi');
    const [manualTieuDe, setManualTieuDe] = useState('LDC 44.11.2025/VTT-ĐHBH ngày 01/11/2025');
    const [manualSerials, setManualSerials] = useState('');

    const [showPreview, setShowPreview] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    
    const printRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    // Engineered A4 layout styles for printing labels (highly stylized shipping look)
    const printStyles = `
        @page { size: A4 landscape; margin: 0; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; }
        
        .print-container { 
            width: 297mm;
            height: 210mm;
            background: white; 
            font-family: "Times New Roman", Times, serif;
            color: black;
            padding: 5mm;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }
        
        .label-wrapper { 
            width: 100%; 
            height: 200mm; 
            border: 4.5px solid #000000; 
            margin-bottom: 0; 
            background: white;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
            position: relative;
            box-shadow: 0 0 15px rgba(0,0,0,0.06);
            overflow: hidden;
            border-radius: 6px;
            font-family: "Times New Roman", Times, serif !important;
        }
        
        .label-wrapper:last-child {
            margin-bottom: 0;
        }
        
        @media print {
            .page-break { page-break-after: always; height: 0; border: none; margin: 0; }
            .label-wrapper { box-shadow: none; border-color: black !important; border: 4.5px solid black !important; }
        }
        
        .header-text-print { 
            font-size: 72pt; 
            font-weight: 900; 
            text-align: center; 
            text-transform: uppercase;
            line-height: 1.35;
            margin-bottom: 0;
            letter-spacing: 0.5px;
            background: white !important;
            color: black !important;
            padding: 5px 15px;
            border-bottom: 4.5px solid #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        
        .header-decor-line {
            height: 3px;
            width: 50px;
            background-color: black;
            display: inline-block;
        }
        
        .label-body {
            display: grid;
            grid-template-columns: 110mm 110mm 65mm;
            grid-template-rows: repeat(4, 1fr);
            flex: 1;
            min-height: 0;
            background: white;
        }
        
        .grid-cell {
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            background: white;
            border-bottom: 2px solid #000000;
            position: relative;
            isolation: isolate;
            contain: paint;
        }
        
        .grid-cell-label {
            justify-content: center;
            padding: 0 12px;
            font-size: 72pt;
            font-weight: 900;
            border-right: 2px solid #000000;
            z-index: 5;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #000000;
            text-align: center;
            white-space: nowrap;
        }
        
        .grid-cell-value {
            background-color: white !important; /* Premium softer yellow background */
            font-size: 72pt; 
            font-weight: 900; 
            text-align: center;
            padding: 0 12px;
            border-right: 2px solid #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            z-index: 10;
            white-space: nowrap;
            text-transform: uppercase;
            color: #000000;
        }
        
        .grid-cell-value-lg {
            background-color: white !important; /* Bold yellow for primary numbers */
            font-size: 72pt; 
            font-weight: 900; 
            text-align: center;
            border-right: 2px solid #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            z-index: 10;
            white-space: nowrap;
            text-transform: uppercase;
            color: #000000;
        }
        
        .grid-cell-qr {
            flex-direction: column;
            padding: 12px;
            border-right: none;
            background: white !important;
            z-index: 5;
            transform: translateZ(0);
        }
        
        .grid-cell-qr svg {
            shape-rendering: crispEdges;
            background: white !important;
        }
        
        /* Last row specific: remove bottom border */
        .label-body > .grid-cell:nth-last-child(-n+2) {
            border-bottom: none;
        }
        
        .qr-label-small {
            font-size: 9pt;
            font-weight: 900;
            margin-bottom: 6px;
            text-transform: uppercase;
            background-color: white;
            color: black;
            padding: 2px 10px;
            border-radius: 10px;
            border: 1px solid #000000;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .logistics-watermark {
            position: absolute;
            bottom: 4px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 7pt;
            color: #94a3b8;
            font-weight: bold;
            letter-spacing: 2px;
            text-transform: uppercase;
            white-space: nowrap;
            opacity: 0.8;
        }
    `;

    const groupedBoxes = React.useMemo<GroupedBox[]>(() => {
        const map = new Map<string, GroupedBox>();
        dataRows.forEach(row => {
            // Group strictly by box ID (thung) to ensure 1 box = 1 label
            const key = row.thung.trim().toUpperCase();
            if (!map.has(key)) {
                map.set(key, { 
                    key, 
                    thung: row.thung.trim(), 
                    thiet_bi: row.thiet_bi, 
                    tinh_trang: row.tinh_trang, 
                    tieu_de: row.tieu_de,
                    totalQuantity: 0, 
                    serials: [], 
                    qrChunks: [] 
                });
            }
            const g = map.get(key)!;
            if (!g.serials.includes(row.serial)) {
                g.serials.push(row.serial);
                g.totalQuantity++;
            }
        });
        map.forEach(g => { g.qrChunks = buildQRChunks(g.serials); });
        return Array.from(map.values()).sort((a, b) => a.thung.localeCompare(b.thung, undefined, { numeric: true }));
    }, [dataRows]);

    const totalQRCodes = groupedBoxes.reduce((sum, g) => sum + g.qrChunks.length, 0);

    const handlePrint = useCallback(async () => {
        const el = printRef.current;
        if (!el) { notifyError('Không tìm thấy nội dung để in'); return; }
        setIsPrinting(true);
        setTimeout(() => {
            try {
                const printWindow = window.open('', '_blank', 'width=1200,height=800');
                if (!printWindow) {
                    notifyError('Trình duyệt đã chặn cửa sổ in.');
                    setIsPrinting(false);
                    return;
                }
                const htmlContent = el.innerHTML;
                printWindow.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>In Tem QR Code HCM</title>
  <style>
    ${printStyles}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: white; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`);
                printWindow.document.close();
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                        setIsPrinting(false);
                    }, 500);
                };
            } catch (err) {
                console.error(err);
                setIsPrinting(false);
            }
        }, 100);

        // Lưu log in
        try {
            await GoogleSheetService.saveQRLog({
                action: 'PRINT_HCM',
                doc_title: dataRows[0]?.tieu_de || 'TEM_HCM',
                total_serials: dataRows.length,
                total_qrs: totalQRCodes,
                created_by: currentUser?.email || currentUser?.id,
                details: groupedBoxes.map(g => ({ box: g.thung, device: g.thiet_bi, count: g.totalQuantity }))
            });
        } catch (e) {
            console.error('Lỗi lưu log:', e);
        }
    }, [notifyError, dataRows, totalQRCodes, groupedBoxes, currentUser]);

    const handleExportPDF = async () => {
        if (!dataRows.length) return;
        setIsExporting(true);
        notifyError("Đang xuất PDF định dạng A4 ngang... Vui lòng đợi trong giây lát.");
        
        try {
            const pdf = new jsPDF("l", "mm", "a4");
            const printArea = printRef.current;
            if (!printArea) return;

            const wrappers = printArea.querySelectorAll('.label-wrapper');
            const A4_WIDTH_PX = 1200;
            const A4_HEIGHT_PX = Math.round(A4_WIDTH_PX / 1.4142); // Exact A4 Landscape ratio

            for (let i = 0; i < wrappers.length; i++) {
                const tempContainer = document.createElement('div');
                Object.assign(tempContainer.style, {
                    position: 'fixed', 
                    left: '-20000px', 
                    top: '0', 
                    width: `${A4_WIDTH_PX}px`, 
                    height: `${A4_HEIGHT_PX}px`,
                    background: 'white',
                    overflow: 'hidden'
                });
                
                const styleTag = document.createElement('style');
                styleTag.textContent = printStyles;
                tempContainer.appendChild(styleTag);
                
                const pairWrapper = document.createElement('div');
                pairWrapper.className = 'print-container';
                pairWrapper.style.padding = '5mm';
                pairWrapper.style.height = '100%';
                pairWrapper.style.display = 'flex';
                pairWrapper.style.flexDirection = 'column';
                pairWrapper.style.justifyContent = 'center';
                
                pairWrapper.appendChild(wrappers[i].cloneNode(true));
                tempContainer.appendChild(pairWrapper);
                document.body.appendChild(tempContainer);
                
                await new Promise(resolve => setTimeout(resolve, 800));
                
                const canvas = await html2canvas(tempContainer, { 
                    scale: 3, 
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    width: A4_WIDTH_PX,
                    height: A4_HEIGHT_PX
                });
                
                document.body.removeChild(tempContainer);
                
                if (canvas.width > 0) {
                    const imgData = canvas.toDataURL("image/png");
                    if (i > 0) pdf.addPage();
                    pdf.addImage(imgData, "PNG", 0, 0, 297, 210, undefined, 'FAST');
                }
                await new Promise(resolve => setTimeout(resolve, 60));
            }
            
            pdf.save("Tem_QR_HCM.pdf");
            success(`Đã xuất PDF thành công!`);

            // Lưu log xuất PDF
            try {
                await GoogleSheetService.saveQRLog({
                    action: 'EXPORT_PDF_HCM',
                    doc_title: dataRows[0]?.tieu_de || 'TEM_HCM',
                    total_serials: dataRows.length,
                    total_qrs: totalQRCodes,
                    created_by: currentUser?.email || currentUser?.id,
                    details: groupedBoxes.map(g => ({ box: g.thung, device: g.thiet_bi, count: g.totalQuantity }))
                });
            } catch (e) {
                console.error('Lỗi lưu log:', e);
            }
        } catch (error) {
            console.error(error);
            notifyError("Lỗi xuất PDF. Hãy dùng nút IN -> Lưu thành PDF.");
        } finally {
            setIsExporting(false);
        }
    };

    const parseExcelRows = useCallback(async (file: File) => {
        try {
            const json = await readExcelFile(file);
            if (!json || json.length === 0) {
                notifyError('Không tìm thấy dữ liệu trong file Excel');
                return;
            }

            const parsed: QRDataRow[] = [];
            json.forEach((row: any) => {
                const findValue = (possibleKeys: string[]) => {
                    const key = Object.keys(row).find(k => 
                        possibleKeys.some(pk => k.toLowerCase() === pk.toLowerCase())
                    );
                    return key ? String(row[key]).trim() : '';
                };

                const serial = findValue(['QR', 'serial_code', 'SERIAL', 'Mã QR', 'Serial']);
                
                if (serial && serial !== 'undefined' && serial !== 'null') {
                    parsed.push({
                        thung: findValue(['THÙNG', 'Number_Thung', 'Số thùng', 'Box']) || '0826',
                        thiet_bi: findValue(['Thiết bị', 'thiet_bi', 'Model', 'Device']) || 'ONT_H646EW',
                        serial: serial,
                        tinh_trang: findValue(['Tình Trạng', 'tinh_trang', 'Status']) || 'Hàng thu hồi',
                        tieu_de: findValue(['Tiêu đề', 'tieu_de', 'Title', 'Header']) || '',
                    });
                }
            });

            if (parsed.length === 0) {
                notifyError('Không tìm thấy cột "QR" hoặc "Serial" hợp lệ trong file');
                return;
            }

            setDataRows(prev => {
                const existing = new Set(prev.map(r => r.serial));
                const unique = parsed.filter(r => !existing.has(r.serial));
                
                if (unique.length > 0) {
                    success(`Đã thêm ${unique.length} dòng mới (Bỏ qua ${parsed.length - unique.length} dòng trùng lặp)`);
                } else {
                    notifyError(`Tất cả ${parsed.length} dòng trong file đều đã tồn tại trong danh sách hiện tại`);
                }
                return [...prev, ...unique];
            });
        } catch (err: any) {
            console.error('Import error:', err);
            notifyError('Lỗi đọc file: ' + err.message);
        }
    }, [success, notifyError]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) { await parseExcelRows(e.target.files[0]); e.target.value = ''; }
    };

    const handleManualAdd = () => {
        const serials = parseSerialInput(manualSerials);
        if (!serials.length) { notifyError('Vui lòng nhập ít nhất 1 serial'); return; }
        const newRows: QRDataRow[] = serials.map(s => ({
            thung: manualThung.trim(),
            thiet_bi: manualThietBi.trim(),
            serial: s,
            tinh_trang: manualTinhTrang.trim(),
            tieu_de: manualTieuDe.trim(),
        }));
        setDataRows(prev => {
            const existing = new Set(prev.map(r => r.serial));
            const unique = newRows.filter(r => !existing.has(r.serial));
            success(`Đã thêm ${unique.length} serial`);
            return [...prev, ...unique];
        });
        setManualSerials('');
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
            
            {/* ── Page Header (Sleek Dark Premium Card) ── */}
            <Paper 
                elevation={3} 
                sx={{ 
                    p: { xs: 2.5, md: 4 }, 
                    mb: 4, 
                    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -50,
                        right: -50,
                        width: 220,
                        height: 220,
                        borderRadius: '50%',
                        background: 'rgba(250, 204, 21, 0.08)',
                        filter: 'blur(35px)',
                    }
                }}
            >
                <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid size={{ xs: 12, md: 8 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box 
                                sx={{ 
                                    width: 56, 
                                    height: 56, 
                                    borderRadius: '16px', 
                                    background: 'rgba(255, 255, 255, 0.08)', 
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    animation: 'pulse-yellow 2.5s infinite',
                                    '@keyframes pulse-yellow': {
                                        '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.2)' },
                                        '50%': { transform: 'scale(1.04)', boxShadow: '0 0 15px 4px rgba(250, 204, 21, 0.15)' },
                                        '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(250, 204, 21, 0.2)' }
                                    }
                                }}
                            >
                                <QrCode2Icon sx={{ color: '#facc15', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography 
                                    variant="h4" 
                                    sx={{ 
                                        fontWeight: 900, 
                                        color: '#ffffff', 
                                        letterSpacing: '-0.02em',
                                        fontSize: { xs: '1.65rem', md: '2.1rem' }
                                    }}
                                >
                                    TẠO QR CODE CHI NHÁNH HCM
                                </Typography>
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: '#facc15', 
                                        fontWeight: 700, 
                                        mt: 0.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        fontSize: '0.875rem',
                                        letterSpacing: '0.5px'
                                    }}
                                >
                                    <SupportAgentIcon sx={{ fontSize: 18 }} /> THIẾT KẾ: VÕ THANH SONG - LH: 0988.229.082
                                </Typography>
                            </Box>
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                            <Button 
                                variant="contained" 
                                startIcon={<DownloadIcon />} 
                                onClick={downloadTemplate}
                                sx={{ 
                                    borderRadius: '12px', 
                                    textTransform: 'none', 
                                    fontWeight: 700,
                                    bgcolor: 'rgba(255, 255, 255, 0.1)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    px: 2,
                                    py: 1,
                                    '&:hover': { 
                                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                                        border: '1px solid rgba(255,255,255,0.4)',
                                        transform: 'translateY(-2px)'
                                    } 
                                }}
                            >
                                File Mẫu HCM
                            </Button>
                            
                            {dataRows.length > 0 && (
                                <Button 
                                    variant="contained" 
                                    color="error" 
                                    startIcon={<DeleteOutlineIcon />}
                                    onClick={() => { setDataRows([]); success('Đã xóa dữ liệu'); }}
                                    sx={{ 
                                        borderRadius: '12px', 
                                        textTransform: 'none', 
                                        fontWeight: 700,
                                        px: 2.5,
                                        py: 1,
                                        boxShadow: '0 8px 20px -6px rgba(239, 68, 68, 0.4)',
                                        '&:hover': { transform: 'translateY(-2px)' }
                                    }}
                                >
                                    Xóa Hết
                                </Button>
                            )}
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>

            {/* ── Dashboard Stats Widget (Premium Themed Cards) ── */}
            {dataRows.length > 0 && (
                <Grid container spacing={2.5} mb={4}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card 
                            sx={{ 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '16px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                                transition: 'all 0.3s ease',
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(245, 158, 11, 0.08)', borderColor: '#fde68a' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(245, 158, 11, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <InventoryIcon sx={{ color: '#d97706', fontSize: 30 }} />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Tổng Số Serials
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>
                                        {dataRows.length} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>mã</span>
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card 
                            sx={{ 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '16px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                                transition: 'all 0.3s ease',
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(15, 23, 42, 0.08)', borderColor: '#cbd5e1' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(15, 23, 42, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <LocalShippingIcon sx={{ color: '#1e293b', fontSize: 30 }} />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Tổng Số Thùng HCM
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>
                                        {groupedBoxes.length} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>tem in</span>
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Card 
                            sx={{ 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '16px',
                                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                                background: 'linear-gradient(to right, #ffffff, #f8fafc)',
                                transition: 'all 0.3s ease',
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(14, 165, 233, 0.08)', borderColor: '#bae6fd' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(14, 165, 233, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <QrCode2Icon sx={{ color: '#0ea5e9', fontSize: 30 }} />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Mã QR Cần Quét
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>
                                        {totalQRCodes} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>tem</span>
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* ── Input Panels & Tabs ── */}
            <Grid container spacing={3.5} mb={4}>
                
                {/* ── Data Input Card ── */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            borderRadius: '20px', 
                            border: '1px solid #e2e8f0', 
                            boxShadow: '0 6px 24px rgba(0,0,0,0.02)',
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', bgcolor: '#f8fafc', px: 2 }}>
                            <Tabs 
                                value={activeTab} 
                                onChange={handleTabChange} 
                                variant="fullWidth"
                                sx={{
                                    '& .MuiTab-root': { py: 2, fontWeight: 700, fontSize: '0.95rem', textTransform: 'none', color: '#64748b' },
                                    '& .Mui-selected': { color: '#0f172a' },
                                    '& .MuiTabs-indicator': { height: '3px', borderRadius: '3px', bgcolor: '#0f172a' }
                                }}
                            >
                                <Tab icon={<UploadFileIcon />} iconPosition="start" label="Import File Excel HCM" />
                                <Tab icon={<KeyboardIcon />} iconPosition="start" label="Nhập Tay Thủ Công" />
                            </Tabs>
                        </Box>

                        <Box sx={{ p: { xs: 3, md: 4 } }}>
                            
                            {/* TAB 0: Excel Import */}
                            {activeTab === 0 && (
                                <Box>
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            📂 Tải Excel Mẫu HCM
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <InfoIcon sx={{ fontSize: 16 }} /> File Excel cần chứa các cột hợp lệ: <b>THÙNG, Thiết bị, QR, Tình Trạng, Tiêu đề</b>
                                        </Typography>
                                    </Box>

                                    {/* Advanced Drag & Drop Zone */}
                                    <Box
                                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={async e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) await parseExcelRows(f); }}
                                        onClick={() => fileInputRef.current?.click()}
                                        sx={{
                                            border: `2.5px dashed ${isDragOver ? '#000000' : '#cbd5e1'}`,
                                            borderRadius: '16px', 
                                            p: { xs: 4, md: 6 }, 
                                            textAlign: 'center', 
                                            cursor: 'pointer',
                                            bgcolor: isDragOver ? alpha('#000000', 0.04) : '#f8fafc',
                                            transition: 'all 0.3s ease',
                                            '&:hover': { 
                                                borderColor: '#0f172a', 
                                                bgcolor: alpha('#0f172a', 0.01),
                                                transform: 'translateY(-2px)'
                                            }
                                        }}
                                    >
                                        <Box 
                                            sx={{ 
                                                mx: 'auto',
                                                width: 68, 
                                                height: 68, 
                                                borderRadius: '50%', 
                                                bgcolor: isDragOver ? 'rgba(15, 23, 42, 0.1)' : '#e2e8f0', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                mb: 2,
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <UploadFileIcon sx={{ fontSize: 36, color: isDragOver ? '#0f172a' : '#475569' }} />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', mb: 1, fontSize: '1.05rem' }}>
                                            {isDragOver ? 'Thả File Excel HCM Tại Đây!' : 'Click chọn hoặc kéo thả file Excel HCM vào đây'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                                            Chấp nhận các định dạng tiêu chuẩn: <b>.xlsx, .xls</b>
                                        </Typography>
                                        <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
                                    </Box>
                                </Box>
                            )}

                            {/* TAB 1: Manual Input */}
                            {activeTab === 1 && (
                                <Box>
                                    <Box sx={{ mb: 2.5 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                            ⌨️ Nhập Serials Thủ Công HCM
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Điền các thông tin thùng hàng và danh sách serials để tạo tem.
                                        </Typography>
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="THÙNG" 
                                                size="small" 
                                                value={manualThung} 
                                                onChange={e => setManualThung(e.target.value)} 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Thiết bị" 
                                                size="small" 
                                                value={manualThietBi} 
                                                onChange={e => setManualThietBi(e.target.value)} 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Tình Trạng" 
                                                size="small" 
                                                value={manualTinhTrang} 
                                                onChange={e => setManualTinhTrang(e.target.value)} 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Tiêu đề tem" 
                                                size="small" 
                                                value={manualTieuDe} 
                                                onChange={e => setManualTieuDe(e.target.value)} 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Danh Sách Serials (QR)" 
                                                size="small" 
                                                multiline 
                                                rows={3} 
                                                value={manualSerials} 
                                                onChange={e => setManualSerials(e.target.value)} 
                                                placeholder="Nhập danh sách serials (mỗi serial 1 dòng)..." 
                                                InputProps={{ sx: { borderRadius: '12px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button 
                                                fullWidth 
                                                variant="contained" 
                                                onClick={handleManualAdd} 
                                                sx={{ 
                                                    bgcolor: '#0f172a',
                                                    borderRadius: '12px', 
                                                    py: 1.3, 
                                                    fontWeight: 800,
                                                    boxShadow: '0 8px 16px rgba(15, 23, 42, 0.2)',
                                                    '&:hover': { bgcolor: '#1e293b', transform: 'translateY(-1px)' }
                                                }}
                                            >
                                                Thêm Tem Chờ In
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                        </Box>
                    </Paper>
                </Grid>

                {/* ── Rules & Specification ── */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: { xs: 3, md: 4 }, 
                            height: '100%', 
                            borderRadius: '20px', 
                            border: '1px solid #e2e8f0',
                            bgcolor: '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            boxShadow: '0 6px 24px rgba(0,0,0,0.02)',
                        }}
                    >
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <ListAltIcon sx={{ color: '#facc15' }} /> Tiêu chuẩn kỹ thuật tem in HCM
                            </Typography>
                            
                            <Stack spacing={2}>
                                <Box display="flex" gap={1.5} alignItems="flex-start">
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#facc15', mt: 1, flexShrink: 0 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        <b>Định dạng in ấn</b>: Bản in tối ưu khổ <b>A4 ngang</b> (Landscape). Thiết kế tem logistics cân đối tỉ lệ vàng.
                                    </Typography>
                                </Box>
                                <Box display="flex" gap={1.5} alignItems="flex-start">
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#facc15', mt: 1, flexShrink: 0 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        <b>Giới hạn QR Code</b>: Tối đa <b>{MAX_SERIALS_PER_QR} serials</b> cho 1 mã QR code.
                                    </Typography>
                                </Box>
                                <Box display="flex" gap={1.5} alignItems="flex-start">
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#facc15', mt: 1, flexShrink: 0 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        <b>Giới hạn Thùng hàng</b>: Tối đa <b>{MAX_SERIALS_TOTAL} serials</b> cho 1 Thùng hàng (Tự động tách thành mã QR kép khi vượt quá 60 serials).
                                    </Typography>
                                </Box>
                                <Box display="flex" gap={1.5} alignItems="flex-start">
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#facc15', mt: 1, flexShrink: 0 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        <b>Tự động tối ưu chữ</b>: Giao diện tem tự động thu nhỏ kích cỡ font chữ khi các trường thông tin (Thiết bị, Tình trạng) quá dài nhằm chống tràn tem.
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>

                        {dataRows.length > 0 && (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                                <Alert severity="warning" icon={<CheckCircleIcon sx={{ fontSize: 20, color: '#eab308' }} />} sx={{ borderRadius: '12px', bgcolor: 'rgba(250,204,21,0.06)', border: '1px solid rgba(250,204,21,0.2)', color: '#854d0e' }}>
                                    Đã sẵn sàng tạo <b>{groupedBoxes.length} tem in</b> đặc trưng CN HCM.
                                </Alert>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Interactive Printed Labels Preview ── */}
            {dataRows.length > 0 && (
                <Box sx={{ mt: 4, mb: 5 }}>
                    
                    <Paper 
                        elevation={0}
                        sx={{ 
                            p: 3, 
                            mb: 3, 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0', 
                            bgcolor: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 2
                        }}
                    >
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PreviewIcon color="primary" /> Xem Trước Tem In Tem CN HCM ({groupedBoxes.length} tem)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                                Nhãn in có viền sắc nét, màu sắc rực rỡ tương thích in laser grayscale.
                            </Typography>
                        </Box>
                        
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                            <Button 
                                variant="outlined" 
                                startIcon={<PreviewIcon />} 
                                onClick={() => setShowPreview(v => !v)}
                                sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, px: 2 }}
                            >
                                {showPreview ? 'Ẩn Bảng Serials' : 'Hiển Thị Bảng Serials'}
                            </Button>

                            <Button 
                                variant="contained" 
                                startIcon={<PictureAsPdfIcon />} 
                                onClick={handleExportPDF} 
                                disabled={isExporting} 
                                sx={{ 
                                    bgcolor: '#d97706',
                                    borderRadius: '10px',
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    px: 2.5,
                                    '&:hover': { bgcolor: '#b45309', transform: 'translateY(-1px)' }
                                }}
                            >
                                Xuất File PDF
                            </Button>
                            
                            <Button 
                                variant="contained" 
                                startIcon={<PrintIcon />} 
                                onClick={handlePrint} 
                                disabled={isPrinting} 
                                sx={{ 
                                    bgcolor: '#0f172a',
                                    borderRadius: '10px',
                                    fontWeight: 800,
                                    textTransform: 'none',
                                    px: 2.5,
                                    boxShadow: '0 8px 16px rgba(15, 23, 42, 0.25)',
                                    '&:hover': { bgcolor: '#1e293b', transform: 'translateY(-1px)' }
                                }}
                            >
                                In Tem Ngay
                            </Button>
                        </Stack>
                    </Paper>
                    
                    {/* Tem In Preview Container (A4 layout inside responsive shell) */}
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: { xs: 1.5, sm: 3, md: 4 }, 
                            bgcolor: '#f1f5f9', 
                            borderRadius: '24px', 
                            border: '1px solid #cbd5e1',
                            maxHeight: '900px',
                            overflowY: 'auto'
                        }}
                    >
                        <Box ref={printRef} sx={{ bgcolor: 'white', p: 0, mx: 'auto', width: 'fit-content', borderRadius: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
                            <style>{printStyles}</style>
                            
                            {groupedBoxes.map((group, groupIdx) => (
                                <div className="print-container" key={groupIdx}>
                                    <div className="label-wrapper">
                                        {/* Helper for auto-shrink font size */}
                                        {(() => {
                                            const SvgFitText = ({ text, fontSizePt, maxWidthPt }: { text: string, fontSizePt: number, maxWidthPt: number }) => {
                                                const len = text.length;
                                                const charRatio = 0.65;
                                                const estWidth = len * (fontSizePt * charRatio); 
                                                const needsSquash = estWidth > maxWidthPt;
                                                const finalFontSize = needsSquash ? Math.floor(fontSizePt * (maxWidthPt / estWidth)) : fontSizePt;
                                                
                                                return (
                                                    <div style={{ 
                                                        fontSize: `${finalFontSize}pt`, 
                                                        fontWeight: 900, 
                                                        fontFamily: '"Times New Roman", Times, serif',
                                                        color: 'black',
                                                        whiteSpace: 'nowrap',
                                                        lineHeight: 1
                                                    }}>
                                                        {text}
                                                    </div>
                                                );
                                            };

                                            const GRID_SIZE_LARGE = 65;
                                            const GRID_SIZE_SMALL = 65;
                                            const GRID_MAX_WIDTH = 290;
                                            const HEADER_SIZE = 72;
                                            const HEADER_MAX_WIDTH = 800;

                                            return (
                                                <>
                                                    {/* Header */}
                                                    <div className="header-text-print">
                                                        <span className="header-decor-line" style={{ margin: '0 15px' }}></span>
                                                        <SvgFitText text={group.tieu_de || 'TIÊU ĐỀ IN ẤN'} fontSizePt={HEADER_SIZE} maxWidthPt={HEADER_MAX_WIDTH} />
                                                        <span className="header-decor-line" style={{ margin: '0 15px' }}></span>
                                                    </div>

                                                    <div className="label-body">
                                                        {/* Row 1 */}
                                                        <div className="grid-cell grid-cell-label">
                                                            <SvgFitText text="THÙNG" fontSizePt={GRID_SIZE_LARGE} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        <div className="grid-cell grid-cell-value-lg">
                                                            <SvgFitText text={String(group.thung)} fontSizePt={GRID_SIZE_LARGE} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        <div className="grid-cell grid-cell-qr" style={{ gridRow: group.qrChunks.length > 1 ? 'span 2' : 'span 4', borderBottom: group.qrChunks.length > 1 ? '2.5px solid #000000' : 'none' }}>
                                                            {group.qrChunks[0] && (
                                                                <>
                                                                    <div style={{ width: '45mm', height: '45mm', minWidth: '45mm', minHeight: '45mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                        <QRCodeSVG value={group.qrChunks[0].qrValue} size={165} level="M" includeMargin={false} />
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>

                                                        {/* Row 2 */}
                                                        <div className="grid-cell grid-cell-label">
                                                            <SvgFitText text="SỐ LƯỢNG" fontSizePt={GRID_SIZE_LARGE} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        <div className="grid-cell grid-cell-value-lg">
                                                            <div style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'baseline', 
                                                                justifyContent: 'center',
                                                                gap: '6px',
                                                                fontSize: `${GRID_SIZE_LARGE}pt`, 
                                                                fontWeight: 900, 
                                                                fontFamily: '"Times New Roman", Times, serif',
                                                                color: 'black',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                <span>{group.totalQuantity}</span>
                                                                <span style={{ fontSize: '20pt', fontWeight: 'normal' }}>pcs</span>
                                                            </div>
                                                        </div>
                                                        {/* Col 3 is spanned from Row 1 */}

                                                        {/* Row 3 */}
                                                        <div className="grid-cell grid-cell-label">
                                                            <SvgFitText text="THIẾT BỊ" fontSizePt={GRID_SIZE_SMALL} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        <div className="grid-cell grid-cell-value">
                                                            <SvgFitText text={String(group.thiet_bi)} fontSizePt={GRID_SIZE_SMALL} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        {group.qrChunks.length > 1 ? (
                                                            <div className="grid-cell grid-cell-qr" style={{ gridRow: 'span 2', borderBottom: 'none' }}>
                                                                <div style={{ width: '45mm', height: '45mm', minWidth: '45mm', minHeight: '45mm', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <QRCodeSVG value={group.qrChunks[1].qrValue} size={165} level="M" includeMargin={false} />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            null // Spanned from Row 1
                                                        )}

                                                        {/* Row 4 */}
                                                        <div className="grid-cell grid-cell-label">
                                                            <SvgFitText text="TÌNH TRẠNG" fontSizePt={GRID_SIZE_SMALL} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                        <div className="grid-cell grid-cell-value" style={{ borderBottom: 'none' }}>
                                                            <SvgFitText text={String(group.tinh_trang)} fontSizePt={GRID_SIZE_SMALL} maxWidthPt={GRID_MAX_WIDTH} />
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                        
                                        {/* Watermark in bottom corner */}
                                        <div className="logistics-watermark">BSG Logistics HCM Division · Tem Nhãn Phân Phối Tiêu Chuẩn</div>
                                    </div>
                                    {groupIdx < groupedBoxes.length - 1 && <div className="page-break" />}
                                </div>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            )}

            {/* Table Preview Grid */}
            {showPreview && dataRows.length > 0 && (
                <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle2" sx={{ color: '#475569', mb: 1, fontWeight: 700 }}>Danh sách chi tiết các dòng chờ tạo tem ({dataRows.length} dòng):</Typography>
                    <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 350, border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>THÙNG</TableCell>
                                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Tên Thiết Bị</TableCell>
                                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Mã Serial (QR)</TableCell>
                                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Tình Trạng Hàng</TableCell>
                                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc', textAlign: 'center' }}>Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dataRows.map((row, idx) => (
                                    <TableRow key={idx} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                        <TableCell sx={{ fontWeight: 600 }}>{row.thung}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{row.thiet_bi}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{row.serial}</TableCell>
                                        <TableCell>
                                            <Chip label={row.tinh_trang} size="small" sx={{ fontWeight: 600, bgcolor: '#f1f5f9', color: '#475569', borderRadius: '6px' }} />
                                        </TableCell>
                                        <TableCell sx={{ textAlign: 'center' }}>
                                            <IconButton size="small" color="error" onClick={() => setDataRows(prev => prev.filter((_, i) => i !== idx))}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}
        </Box>
    );
};

export default QRGeneratorHCM;
