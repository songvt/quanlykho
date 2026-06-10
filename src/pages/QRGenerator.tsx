import React, { useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Grid, Stack,
    Chip, IconButton, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress,
    Tabs, Tab, Card, CardContent, Divider, Tooltip, Zoom
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
    serial_code: string;
    Number_Thung: string;
    District: string;
}

interface QRChunk {
    label: string;   // "QR-1", "QR-2"...
    serials: string[];
    qrValue: string;
}

interface GroupedBox {
    key: string;
    boxNumber: string;
    district: string;
    totalQuantity: number;
    serials: string[];
    qrChunks: QRChunk[];
}

const MAX_SERIALS_PER_QR = 27;

// ─── Helper: split serials evenly into chunks of max 27 ───────────────────────
const buildQRChunks = (serials: string[]): QRChunk[] => {
    const chunks: QRChunk[] = [];
    if (serials.length === 0) return chunks;
    
    // Tối đa 80 serials cho 1 thùng
    const limitedSerials = serials.slice(0, 80);
    
    // Tính số lượng mã QR cần tạo, mỗi mã tối đa 27 serial
    const numQRs = Math.ceil(limitedSerials.length / MAX_SERIALS_PER_QR);
    const baseSize = Math.floor(limitedSerials.length / numQRs);
    const remainder = limitedSerials.length % numQRs;
    
    let currentIndex = 0;
    for (let i = 0; i < numQRs; i++) {
        // Phân bổ đều: ưu tiên cộng thêm 1 vào các phần đầu
        const chunkSize = i < remainder ? baseSize + 1 : baseSize;
        const slice = limitedSerials.slice(currentIndex, currentIndex + chunkSize);
        currentIndex += chunkSize;
        
        chunks.push({
            label: `QR-${i + 1}`,
            serials: slice,
            qrValue: slice.join('\n'),
        });
    }
    return chunks;
};

// ─── Helper: generate sample Excel template ───────────────────────────────────
const downloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('QR_Template');
    ws.columns = [
        { header: 'serial_code', key: 'serial_code', width: 20 },
        { header: 'Number_Thung', key: 'Number_Thung', width: 15 },
        { header: 'District', key: 'District', width: 12 },
    ];
    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0b3d2b' } };
        cell.alignment = { horizontal: 'center' };
    });
    // Sample data
    const samples = [
        { serial_code: 'SN00001', Number_Thung: 'THUNG 01', District: 'Q12' },
        { serial_code: 'SN00002', Number_Thung: 'THUNG 01', District: 'Q12' },
        { serial_code: 'SN00003', Number_Thung: 'THUNG 02', District: 'Q1' },
    ];
    samples.forEach(r => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'QR_Import_Template.xlsx');
};

const QR_STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Times New Roman', Times, serif; 
        background: white; 
        padding: 5mm;
    }
    @page { size: A4 landscape; margin: 5mm; }
    .pdf-page {
        width: 297mm;
        height: 210mm;
        padding: 4mm 5mm;
        background-color: white;
        display: flex;
        flex-direction: column;
        gap: 8mm;
        box-sizing: border-box;
        page-break-inside: avoid;
        page-break-after: always;
    }
    .label-wrapper { 
        width: 100%;
        height: 94mm;
        border: 3.5px solid #000000;
        display: flex;
        background: white;
        page-break-inside: avoid;
        border-radius: 4px;
        position: relative;
        overflow: hidden;
    }
    .info-col {
        width: 290px;
        border-right: 3.5px solid #000000;
        display: flex;
        flex-direction: column;
        background-color: #ffffff;
    }
    .blue-header {
        background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%) !important;
        color: white !important;
        padding: 12px 10px;
        font-weight: 900;
        font-size: 1.35rem;
        text-align: center;
        border-bottom: 3.5px solid #000000;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .info-row {
        padding: 8px 14px;
        border-bottom: 1.5px dashed #000000;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .info-row:last-child { 
        border-bottom: none; 
        background-color: #fafafa;
    }
    .label-text { 
        font-size: 0.8rem; 
        color: #333333; 
        font-weight: bold;
        text-transform: uppercase; 
        margin-bottom: 3px; 
        letter-spacing: 0.5px;
    }
    .value-text { 
        font-size: 1.5rem; 
        font-weight: 900; 
        color: #000000;
    }
    .qr-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-right: 1.5px solid #000000;
        padding: 12px;
        background-color: #ffffff;
    }
    .qr-col:last-child { border-right: none; }
    
    .qr-header {
        margin-bottom: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
    }
    .qr-label-title {
        font-weight: 900; 
        font-size: 1.15rem;
        color: #000000;
    }
    .qr-label-badge {
        font-size: 0.8rem; 
        padding: 3px 9px; 
        border-radius: 12px; 
        background-color: #e2e8f0; 
        color: #000000;
        font-weight: 800;
        border: 1px solid #cbd5e1;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }
    .watermark {
        position: absolute;
        bottom: 2px;
        left: 10px;
        font-size: 0.6rem;
        color: #94a3b8;
        font-weight: bold;
        letter-spacing: 1px;
    }
    
    @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .label-wrapper { border: 3.5px solid black !important; }
        .info-col { border-right: 3.5px solid black !important; }
        .blue-header { border-bottom: 3.5px solid black !important; background-color: #2563eb !important; }
        .info-row { border-bottom: 1.5px dashed black !important; }
        .info-row:last-child { border-bottom: none !important; }
        .qr-col { border-right: 1.5px solid black !important; }
        .qr-col:last-child { border-right: none !important; }
        .qr-label-badge { border: 1px solid black !important; background-color: #f1f5f9 !important; }
    }
`;

// ─── Main Component ───────────────────────────────────────────────────────────
const QRGenerator = () => {
    const { profile: currentUser } = useSelector((state: RootState) => state.auth);
    const { success, error: notifyError } = useNotification();
    const [dataRows, setDataRows] = useState<QRDataRow[]>([]);
    const [manualDistrict, setManualDistrict] = useState('Q12');
    const [manualBox, setManualBox] = useState('THUNG 01');
    const [manualSerials, setManualSerials] = useState('');
    const [docTitle, setDocTitle] = useState('THU HỒI');
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

    const groupedBoxes = React.useMemo<GroupedBox[]>(() => {
        const map = new Map<string, GroupedBox>();
        dataRows.forEach(row => {
            const key = `${row.District}__${row.Number_Thung}`;
            if (!map.has(key)) {
                map.set(key, { key, boxNumber: row.Number_Thung, district: row.District, totalQuantity: 0, serials: [], qrChunks: [] });
            }
            const g = map.get(key)!;
            if (!g.serials.includes(row.serial_code)) {
                g.serials.push(row.serial_code);
                g.totalQuantity++;
            }
        });
        map.forEach(g => { g.qrChunks = buildQRChunks(g.serials); });
        return Array.from(map.values()).sort((a, b) => a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true }));
    }, [dataRows]);

    const totalQRCodes = groupedBoxes.reduce((sum, g) => sum + g.qrChunks.length, 0);

    const pairedBoxes = React.useMemo(() => {
        const pairs = [];
        for (let i = 0; i < groupedBoxes.length; i += 2) {
            pairs.push(groupedBoxes.slice(i, i + 2));
        }
        return pairs;
    }, [groupedBoxes]);

    const handlePrint = useCallback(async () => {
        const el = printRef.current;
        if (!el) { notifyError('Không tìm thấy nội dung để in'); return; }
        setIsPrinting(true);
        setTimeout(() => {
            try {
                const printWindow = window.open('', '_blank', 'width=1200,height=800');
                if (!printWindow) {
                    notifyError('Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup và thử lại.');
                    setIsPrinting(false);
                    return;
                }
                const htmlContent = el.innerHTML;
                printWindow.document.write(`<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Mã QR Code</title>
  <style>${QR_STYLES}</style>
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
                setTimeout(() => {
                    if (!printWindow.closed) {
                        printWindow.focus();
                        printWindow.print();
                        printWindow.close();
                    }
                    setIsPrinting(false);
                }, 3000);
            } catch (err) {
                console.error('Print error:', err);
                notifyError('Lỗi khi mở cửa sổ in. Vui lòng thử lại.');
                setIsPrinting(false);
            }
        }, 100);

        try {
            await GoogleSheetService.saveQRLog({
                action: 'PRINT',
                doc_title: docTitle,
                total_serials: dataRows.length,
                total_qrs: totalQRCodes,
                created_by: currentUser?.email || currentUser?.id,
                details: groupedBoxes.map(g => ({ box: g.boxNumber, district: g.district, count: g.totalQuantity }))
            });
        } catch (e) {
            console.error('Lỗi lưu log:', e);
        }
    }, [notifyError, docTitle, dataRows.length, totalQRCodes, groupedBoxes, currentUser]);

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const pdf = new jsPDF("l", "mm", "a4");
            const printArea = printRef.current;
            if (!printArea) {
                notifyError("Không tìm thấy nội dung để xuất");
                setIsExporting(false);
                return;
            }
            
            const pages = printArea.querySelectorAll('.pdf-page');
            if (pages.length === 0) {
                notifyError("Không có dữ liệu để xuất");
                setIsExporting(false);
                return;
            }

            const A4_WIDTH_PX = 1200;
            const A4_HEIGHT_PX = Math.round(A4_WIDTH_PX / 1.4142); // 849px
            
            for (let i = 0; i < pages.length; i++) {
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
                styleTag.textContent = QR_STYLES;
                tempContainer.appendChild(styleTag);
                
                const clonedPage = pages[i].cloneNode(true) as HTMLElement;
                clonedPage.style.margin = '0';
                clonedPage.style.padding = '4mm 5mm';
                clonedPage.style.width = '100%';
                clonedPage.style.height = '100%';
                clonedPage.style.display = 'flex';
                clonedPage.style.flexDirection = 'column';
                clonedPage.style.gap = '8mm';
                
                tempContainer.appendChild(clonedPage);
                document.body.appendChild(tempContainer);
                
                await new Promise(resolve => setTimeout(resolve, 600));
                
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
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            
            pdf.save("Ma_QR_Code.pdf");
            success("Xuất PDF thành công!");

            try {
                await GoogleSheetService.saveQRLog({
                    action: 'EXPORT_PDF',
                    doc_title: docTitle,
                    total_serials: dataRows.length,
                    total_qrs: totalQRCodes,
                    created_by: currentUser?.email || currentUser?.id,
                    details: groupedBoxes.map(g => ({ box: g.boxNumber, district: g.district, count: g.totalQuantity }))
                });
            } catch (e) {
                console.error('Lỗi lưu log:', e);
            }
        } catch (error) {
            console.error(error);
            notifyError("Lỗi khi xuất PDF. Vui lòng thử lại.");
        } finally {
            setIsExporting(false);
        }
    };

    const parseExcelRows = useCallback(async (file: File) => {
        try {
            const json = await readExcelFile(file);
            const parsed: QRDataRow[] = [];
            json.forEach((row: any) => {
                const serial = String(row['serial_code'] || row['SERIAL'] || '').trim();
                if (serial) {
                    parsed.push({
                        serial_code: serial,
                        Number_Thung: String(row['Number_Thung'] || row['THUNG'] || 'THUNG 01').trim(),
                        District: String(row['District'] || row['QUAN_HUYEN'] || 'Q12').trim(),
                    });
                }
            });
            if (parsed.length === 0) { notifyError('File không có dữ liệu serial hợp lệ'); return; }
            setDataRows(prev => {
                const existing = new Set(prev.map(r => r.serial_code));
                const unique = parsed.filter(r => !existing.has(r.serial_code));
                success(`Đã thêm ${unique.length} serial (bỏ qua ${parsed.length - unique.length} trùng)`);
                return [...prev, ...unique];
            });
        } catch (err: any) {
            notifyError('Lỗi đọc file: ' + err.message);
        }
    }, [success, notifyError]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) { await parseExcelRows(e.target.files[0]); e.target.value = ''; }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            await parseExcelRows(file);
        } else { notifyError('Vui lòng thả file .xlsx hoặc .xls'); }
    };

    const handleManualAdd = () => {
        const serials = parseSerialInput(manualSerials);
        if (!serials.length) { notifyError('Vui lòng nhập ít nhất 1 serial'); return; }
        const newRows: QRDataRow[] = serials.map(s => ({
            serial_code: s,
            Number_Thung: manualBox.trim() || 'THUNG 01',
            District: manualDistrict.trim() || 'Q12',
        }));
        setDataRows(prev => {
            const existing = new Set(prev.map(r => r.serial_code));
            const unique = newRows.filter(r => !existing.has(r.serial_code));
            if (unique.length < newRows.length) notifyError(`Bỏ qua ${newRows.length - unique.length} serial trùng`);
            success(`Đã thêm ${unique.length} serial`);
            return [...prev, ...unique];
        });
        setManualSerials('');
    };

    const removeSerial = (serial: string) => setDataRows(prev => prev.filter(r => r.serial_code !== serial));

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
            
            {/* ── Page Header (Beautiful Glassmorphism Gradient Card) ── */}
            <Paper 
                elevation={3} 
                sx={{ 
                    p: { xs: 2.5, md: 4 }, 
                    mb: 4, 
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1d4ed8 100%)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(37, 99, 235, 0.3)',
                    '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -50,
                        right: -50,
                        width: 200,
                        height: 200,
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.1)',
                        filter: 'blur(30px)',
                    }
                }}
            >
                <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box 
                                sx={{ 
                                    width: 56, 
                                    height: 56, 
                                    borderRadius: '16px', 
                                    background: 'rgba(255, 255, 255, 0.18)', 
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
                                    animation: 'pulse 2s infinite',
                                    '@keyframes pulse': {
                                        '0%': { transform: 'scale(1)' },
                                        '50%': { transform: 'scale(1.05)' },
                                        '100%': { transform: 'scale(1)' }
                                    }
                                }}
                            >
                                <QrCode2Icon sx={{ color: '#ffffff', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography 
                                    variant="h4" 
                                    sx={{ 
                                        fontWeight: 900, 
                                        color: '#ffffff', 
                                        letterSpacing: '-0.03em',
                                        textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                        fontSize: { xs: '1.75rem', md: '2.25rem' }
                                    }}
                                >
                                    TẠO MÃ QR CODE CHUẨN
                                </Typography>
                                <Typography 
                                    variant="body1" 
                                    sx={{ 
                                        color: 'rgba(255, 255, 255, 0.85)', 
                                        fontWeight: 500, 
                                        mt: 0.5,
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    Hệ thống tự động phân tách tối đa {MAX_SERIALS_PER_QR} serials / 1 QR code
                                </Typography>
                            </Box>
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                            <Button 
                                variant="contained" 
                                startIcon={<DownloadIcon />} 
                                onClick={downloadTemplate}
                                sx={{ 
                                    borderRadius: '12px', 
                                    textTransform: 'none', 
                                    fontWeight: 700,
                                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    backdropFilter: 'blur(5px)',
                                    px: 2.5,
                                    py: 1,
                                    '&:hover': { 
                                        bgcolor: 'rgba(255, 255, 255, 0.35)',
                                        border: '1px solid rgba(255,255,255,0.5)',
                                        transform: 'translateY(-2px)'
                                    } 
                                }}
                            >
                                File Mẫu Chuẩn
                            </Button>
                            
                            {dataRows.length > 0 && (
                                <Button 
                                    variant="contained" 
                                    color="error" 
                                    startIcon={<DeleteOutlineIcon />}
                                    onClick={() => { setDataRows([]); success('Đã xóa toàn bộ dữ liệu'); }}
                                    sx={{ 
                                        borderRadius: '12px', 
                                        textTransform: 'none', 
                                        fontWeight: 700,
                                        px: 2.5,
                                        py: 1,
                                        boxShadow: '0 8px 20px -6px rgba(239, 68, 68, 0.5)',
                                        '&:hover': {
                                            transform: 'translateY(-2px)'
                                        }
                                    }}
                                >
                                    Xóa Toàn Bộ
                                </Button>
                            )}
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>

            {/* ── Dashboard Stats Widget (Premium Cards) ── */}
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
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(37, 99, 235, 0.08)', borderColor: '#bfdbfe' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(37, 99, 235, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <InventoryIcon color="primary" sx={{ fontSize: 30 }} />
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
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(16, 185, 129, 0.08)', borderColor: '#a7f3d0' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(16, 185, 129, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <LocalShippingIcon sx={{ color: '#10b981', fontSize: 30 }} />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Tổng Số Thùng
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 900, color: '#0f172a', mt: 0.5 }}>
                                        {groupedBoxes.length} <span style={{ fontSize: '1rem', fontWeight: 500, color: '#64748b' }}>thùng</span>
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
                                '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 20px rgba(245, 158, 11, 0.08)', borderColor: '#fde68a' }
                            }}
                        >
                            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3, '&:last-child': { pb: 3 } }}>
                                <Box sx={{ p: 2, borderRadius: '12px', bgcolor: 'rgba(245, 158, 11, 0.08)', mr: 2.5, display: 'flex' }}>
                                    <QrCode2Icon sx={{ color: '#f59e0b', fontSize: 30 }} />
                                </Box>
                                <Box>
                                    <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Mã QR Cần Tạo
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

            {/* ── Input Panels & Mode Selection (Tabs) ── */}
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
                                    '& .MuiTab-root': { py: 2, fontWeight: 700, fontSize: '0.95rem', textTransform: 'none', letterSpacing: '0.3px' },
                                    '& .Mui-selected': { color: '#2563eb' },
                                    '& .MuiTabs-indicator': { height: '3px', borderRadius: '3px' }
                                }}
                            >
                                <Tab icon={<UploadFileIcon />} iconPosition="start" label="Import File Excel" />
                                <Tab icon={<KeyboardIcon />} iconPosition="start" label="Nhập Thủ Công / Quét" />
                            </Tabs>
                        </Box>

                        <Box sx={{ p: { xs: 3, md: 4 } }}>
                            
                            {/* TAB 0: Excel Import */}
                            {activeTab === 0 && (
                                <Box>
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                            📂 Tải Dữ Liệu Từ Excel
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <InfoIcon sx={{ fontSize: 16 }} /> File tải lên cần chứa các cột bắt buộc: <b>serial_code</b>, <b>Number_Thung</b>, <b>District</b>
                                        </Typography>
                                    </Box>

                                    {/* Advanced Drag & Drop Zone */}
                                    <Box
                                        onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        sx={{
                                            border: `2.5px dashed ${isDragOver ? '#2563eb' : '#cbd5e1'}`,
                                            borderRadius: '16px', 
                                            p: { xs: 4, md: 6 }, 
                                            textAlign: 'center', 
                                            cursor: 'pointer',
                                            bgcolor: isDragOver ? alpha('#2563eb', 0.04) : '#f8fafc',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            boxShadow: isDragOver ? '0 10px 20px rgba(37, 99, 235, 0.05)' : 'none',
                                            '&:hover': { 
                                                borderColor: '#2563eb', 
                                                bgcolor: alpha('#2563eb', 0.02),
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
                                                bgcolor: isDragOver ? 'rgba(37, 99, 235, 0.1)' : '#e2e8f0', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                mb: 2,
                                                transition: 'all 0.3s'
                                            }}
                                        >
                                            <UploadFileIcon sx={{ fontSize: 36, color: isDragOver ? '#2563eb' : '#475569' }} />
                                        </Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#334155', mb: 1, fontSize: '1.05rem' }}>
                                            {isDragOver ? 'Thả File Excel Tại Đây!' : 'Kéo thả file Excel vào đây hoặc click để chọn'}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                                            Hỗ trợ các định dạng tiêu chuẩn: <b>.xlsx, .xls</b>
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                            * Hệ thống tự động phát hiện, gộp nhóm và loại bỏ các mã trùng lặp.
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
                                            ⌨️ Nhập Serials Thủ Công
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                            Thích hợp để quét trực tiếp bằng máy quét hoặc nhập tay nhanh danh sách.
                                        </Typography>
                                    </Box>

                                    <Grid container spacing={2.5}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Khu vực (District)" 
                                                variant="outlined"
                                                value={manualDistrict} 
                                                onChange={e => setManualDistrict(e.target.value)}
                                                placeholder="Ví dụ: Q12, Q1, Q3..." 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Số Thùng" 
                                                variant="outlined"
                                                value={manualBox} 
                                                onChange={e => setManualBox(e.target.value)}
                                                placeholder="Ví dụ: THUNG 01" 
                                                InputProps={{ sx: { borderRadius: '10px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <TextField 
                                                fullWidth 
                                                label="Danh Sách Serials" 
                                                variant="outlined"
                                                multiline 
                                                rows={4}
                                                value={manualSerials} 
                                                onChange={e => setManualSerials(e.target.value)}
                                                onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleManualAdd(); } }}
                                                placeholder="Nhập hoặc quét các mã serial. Phân tách bằng phím xuống dòng (Enter) hoặc dấu phẩy."
                                                helperText="Mẹo: Nhấn phím Ctrl + Enter để thêm nhanh danh sách."
                                                InputProps={{ sx: { borderRadius: '12px' } }}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <Button 
                                                fullWidth 
                                                variant="contained" 
                                                startIcon={<AddCircleOutlineIcon />}
                                                onClick={handleManualAdd}
                                                sx={{ 
                                                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                                    borderRadius: '12px', 
                                                    py: 1.5, 
                                                    fontWeight: 700,
                                                    fontSize: '0.95rem',
                                                    boxShadow: '0 8px 20px -6px rgba(37, 99, 235, 0.4)',
                                                    '&:hover': { 
                                                        background: 'linear-gradient(135deg, #1d4ed8 0%, #1d4ed8 100%)',
                                                        transform: 'translateY(-1px)'
                                                    } 
                                                }}
                                            >
                                                Thêm Vào Danh Sách Đợi
                                            </Button>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                        </Box>
                    </Paper>
                </Grid>

                {/* ── Documentation & Tips Card (Highly Vivid Visuals) ── */}
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
                                <ListAltIcon color="primary" /> Quy trình tạo tem in QR
                            </Typography>
                            
                            <Stack spacing={2.5} sx={{ mt: 1 }}>
                                <Box display="flex" gap={2}>
                                    <Box 
                                        sx={{ 
                                            width: 28, 
                                            height: 28, 
                                            borderRadius: '50%', 
                                            bgcolor: 'rgba(37, 99, 235, 0.1)', 
                                            color: '#2563eb', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontWeight: 800,
                                            flexShrink: 0
                                        }}
                                    >
                                        1
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>Cung cấp danh sách</Typography>
                                        <Typography variant="body2" color="text.secondary">Import file Excel theo mẫu hoặc nhập trực tiếp serials bằng máy quét.</Typography>
                                    </Box>
                                </Box>

                                <Box display="flex" gap={2}>
                                    <Box 
                                        sx={{ 
                                            width: 28, 
                                            height: 28, 
                                            borderRadius: '50%', 
                                            bgcolor: 'rgba(37, 99, 235, 0.1)', 
                                            color: '#2563eb', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontWeight: 800,
                                            flexShrink: 0
                                        }}
                                    >
                                        2
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>Kiểm tra & Biên tập</Typography>
                                        <Typography variant="body2" color="text.secondary">Xem lại danh sách, xóa dòng thừa hoặc chỉnh sửa nếu cần tại bảng preview.</Typography>
                                    </Box>
                                </Box>

                                <Box display="flex" gap={2}>
                                    <Box 
                                        sx={{ 
                                            width: 28, 
                                            height: 28, 
                                            borderRadius: '50%', 
                                            bgcolor: 'rgba(37, 99, 235, 0.1)', 
                                            color: '#2563eb', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontWeight: 800,
                                            flexShrink: 0
                                        }}
                                    >
                                        3
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>Xem trước & Cấu hình tem</Typography>
                                        <Typography variant="body2" color="text.secondary">Nhập tiêu đề in (ví dụ: Thu Hồi, Trả Kho) và xem trước hình dáng tem nhãn nhắm tới sự vừa vặn.</Typography>
                                    </Box>
                                </Box>

                                <Box display="flex" gap={2}>
                                    <Box 
                                        sx={{ 
                                            width: 28, 
                                            height: 28, 
                                            borderRadius: '50%', 
                                            bgcolor: 'rgba(37, 99, 235, 0.1)', 
                                            color: '#2563eb', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            fontWeight: 800,
                                            flexShrink: 0
                                        }}
                                    >
                                        4
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>In hoặc Xuất PDF</Typography>
                                        <Typography variant="body2" color="text.secondary">Nhấp nút in trực tiếp hoặc xuất file PDF khổ A4 ngang, sẵn sàng dán lên kiện hàng.</Typography>
                                    </Box>
                                </Box>
                            </Stack>
                        </Box>

                        {dataRows.length > 0 && (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f1f5f9' }}>
                                <Alert severity="success" icon={<CheckCircleIcon sx={{ fontSize: 20 }} />} sx={{ borderRadius: '12px' }}>
                                    Hệ thống đã sẵn sàng với <b>{dataRows.length} serials</b> và phân bổ thành <b>{totalQRCodes} tem in</b>.
                                </Alert>
                            </Box>
                        )}
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Data Preview Section ── */}
            {dataRows.length > 0 && (
                <Paper 
                    elevation={0} 
                    sx={{ 
                        mb: 4, 
                        border: '1px solid #e2e8f0', 
                        borderRadius: '20px', 
                        overflow: 'hidden',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.02)'
                    }}
                >
                    <Box 
                        sx={{ 
                            px: 3, 
                            py: 2.5, 
                            bgcolor: '#f8fafc', 
                            borderBottom: '1px solid #e2e8f0', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 1
                        }}
                    >
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '1.05rem' }}>
                                Bảng xem trước danh sách serials chờ in
                            </Typography>
                            <Chip label={`${dataRows.length} serials`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                        </Stack>
                        
                        <Button 
                            size="small" 
                            variant="outlined" 
                            startIcon={<PreviewIcon />}
                            onClick={() => setShowPreview(v => !v)} 
                            color={showPreview ? "primary" : "info"}
                            sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700 }}
                        >
                            {showPreview ? 'Thu Gọn Bảng' : 'Hiển Thị Bảng Chi Tiết'}
                        </Button>
                    </Box>

                    {showPreview && (
                        <Box>
                            <TableContainer sx={{ maxHeight: 350 }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}># STT</TableCell>
                                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}>Mã Serial Code</TableCell>
                                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}>Ký Hiệu Số Thùng</TableCell>
                                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}>Khu Vực (District)</TableCell>
                                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f1f5f9', align: 'center', textAlign: 'center' }}>Thao Tác</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {dataRows.slice(0, 200).map((row, idx) => (
                                            <TableRow key={row.serial_code} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                <TableCell sx={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600 }}>{idx + 1}</TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>{row.serial_code}</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>{row.Number_Thung}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={row.District} 
                                                        size="small" 
                                                        sx={{ 
                                                            bgcolor: 'rgba(37, 99, 235, 0.06)', 
                                                            color: '#2563eb', 
                                                            fontWeight: 700,
                                                            borderRadius: '6px'
                                                        }} 
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <Tooltip title="Xóa serial này khỏi danh sách chờ in">
                                                        <IconButton size="small" color="error" onClick={() => removeSerial(row.serial_code)}>
                                                            <DeleteOutlineIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {dataRows.length > 200 && (
                                <Alert severity="info" sx={{ borderRadius: 0, border: 'none', borderTop: '1px solid #e2e8f0', fontWeight: 500 }}>
                                    Hệ thống đang hiển thị 200/{dataRows.length} serials để tối ưu tốc độ trình duyệt. Toàn bộ {dataRows.length} serials vẫn được dán nhãn đầy đủ khi in hoặc xuất PDF.
                                </Alert>
                            )}
                        </Box>
                    )}
                </Paper>
            )}

            {/* ── Tem In QR Preview & Printable Area ── */}
            {groupedBoxes.length === 0 ? (
                <Paper 
                    elevation={0} 
                    sx={{ 
                        p: { xs: 6, md: 10 }, 
                        textAlign: 'center', 
                        border: '2px dashed #cbd5e1', 
                        borderRadius: '24px', 
                        bgcolor: '#f8fafc',
                        transition: 'all 0.3s'
                    }}
                >
                    <QrCode2Icon sx={{ fontSize: 80, color: '#cbd5e1', mb: 2, display: 'inline-block' }} />
                    <Typography variant="h5" color="text.primary" fontWeight={800} mb={1}>
                        Chưa có dữ liệu chờ tạo tem QR
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', fontWeight: 500 }}>
                        Vui lòng tải lên file Excel hoặc nhập serial trực tiếp ở bảng phía trên để hệ thống tạo danh sách nhãn in chuyên nghiệp.
                    </Typography>
                </Paper>
            ) : (
                <Box>
                    
                    {/* Header of Printable Area */}
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
                            gap: 2.5
                        }}
                    >
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                                Nhãn Tem QR Code Sẵn Sàng ({groupedBoxes.length} thùng)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                                Nhãn in thiết kế tối ưu A4 ngang, sắc nét, hỗ trợ quét đa vùng.
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" gap={1}>
                            <TextField 
                                size="small" 
                                label="Tiêu đề nhãn" 
                                value={docTitle} 
                                onChange={e => setDocTitle(e.target.value)}
                                sx={{ 
                                    width: 160, 
                                    bgcolor: 'white',
                                    '& .MuiOutlinedInput-root': { borderRadius: '10px' }
                                }} 
                            />
                            
                            <Button 
                                variant="contained" 
                                startIcon={<PictureAsPdfIcon />}
                                onClick={handleExportPDF} 
                                disabled={isExporting}
                                sx={{ 
                                    bgcolor: '#d97706', 
                                    borderRadius: '10px',
                                    py: 1,
                                    px: 2.5,
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    '&:hover': { bgcolor: '#b45309', transform: 'translateY(-1px)' } 
                                }}
                            >
                                {isExporting ? 'Đang tạo PDF...' : 'Xuất File PDF'}
                            </Button>

                            <Button 
                                variant="contained"
                                startIcon={isPrinting ? <CircularProgress size={18} color="inherit" /> : <PrintIcon />}
                                onClick={handlePrint} 
                                disabled={isExporting || isPrinting}
                                sx={{ 
                                    background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
                                    borderRadius: '10px', 
                                    py: 1,
                                    px: 2.5,
                                    textTransform: 'none', 
                                    fontWeight: 800,
                                    boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)',
                                    '&:hover': { 
                                        background: 'linear-gradient(135deg, #1d4ed8 0%, #1d4ed8 100%)',
                                        transform: 'translateY(-1px)' 
                                    } 
                                }}
                            >
                                {isPrinting ? 'Đang chuẩn bị...' : `In Ngay (${totalQRCodes} QR)`}
                            </Button>
                        </Stack>
                    </Paper>

                    {/* Printable Tem in HTML Area Container */}
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: { xs: 1.5, sm: 3, md: 4 }, 
                            bgcolor: '#eaeef6', 
                            borderRadius: '24px', 
                            border: '1px solid #cbd5e1',
                            maxHeight: '900px',
                            overflowY: 'auto'
                        }}
                    >
                        <Box 
                            ref={printRef} 
                            sx={{ 
                                bgcolor: 'white', 
                                p: 2, 
                                mx: 'auto', 
                                width: 'fit-content',
                                borderRadius: '8px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
                            }}
                        >
                            <style type="text/css">{QR_STYLES}</style>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {pairedBoxes.map((pair, pageIndex) => (
                                    <div key={pageIndex} className="pdf-page"
                                        style={{ 
                                            pageBreakAfter: pageIndex < pairedBoxes.length - 1 ? 'always' : 'auto',
                                            marginBottom: pageIndex < pairedBoxes.length - 1 ? '16mm' : '0'
                                        }}>
                                        {pair.map((group) => {
                                            const boxLabel = group.boxNumber.replace(/THUNG/i, '').trim();
                                            return (
                                                <div key={group.key} className="label-wrapper">
                                                    {/* Brand Watermark Watermarked */}
                                                    <span className="watermark">BSG WAREHOUSE LOGISTICS SYSTEM</span>
                                                    
                                                    {/* ─ Info Column ─ */}
                                                    <div className="info-col">
                                                        <div className="blue-header">
                                                            {group.district.toUpperCase()} – {docTitle.toUpperCase()}
                                                        </div>
                                                        <div className="info-row">
                                                            <div className="label-text">Số Thùng</div>
                                                            <div className="value-text" style={{ fontSize: '1.65rem' }}>{boxLabel || group.boxNumber}</div>
                                                        </div>
                                                        <div className="info-row">
                                                            <div className="label-text">Số Lượng</div>
                                                            <div className="value-text" style={{ color: '#1d4ed8' }}>{group.totalQuantity} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#333' }}>serial</span></div>
                                                        </div>
                                                        <div className="info-row">
                                                            <div className="label-text">Mã QR</div>
                                                            <div className="value-text">{group.qrChunks.length} <span style={{ fontSize: '1rem', fontWeight: 'normal', color: '#333' }}>mã</span></div>
                                                        </div>
                                                        <div className="info-row">
                                                            <div className="label-text">Ký Nhận / Ghi Chú</div>
                                                            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#3f3f46', marginTop: '3px' }}>SỐ PHIẾU: ________</div>
                                                        </div>
                                                    </div>

                                                    {/* ─ QR Code Columns ─ */}
                                                    {group.qrChunks.map((chunk) => (
                                                        <div key={chunk.label} className="qr-col">
                                                            <div className="qr-header">
                                                                <span className="qr-label-title">
                                                                    {chunk.label}
                                                                </span>
                                                                <span className="qr-label-badge">
                                                                    {chunk.serials.length}/{MAX_SERIALS_PER_QR}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '5px', border: '1px solid #f1f5f9', borderRadius: '8px', backgroundColor: '#fafafa' }}>
                                                                <QRCodeSVG value={chunk.qrValue} size={135} level="M" includeMargin={false} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </Box>
                    </Paper>
                </Box>
            )}
        </Box>
    );
};

export default QRGenerator;
