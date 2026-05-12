import React, { useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Grid, Stack,
    Chip, IconButton, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress
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
        return [{ label: 'Mã QR', serials: limited, qrValue: limited.join('\n') }];
    }

    // Two QR codes
    const chunk1 = limited.slice(0, MAX_SERIALS_PER_QR);
    const chunk2 = limited.slice(MAX_SERIALS_PER_QR);
    return [
        { label: 'QR 1', serials: chunk1, qrValue: chunk1.join('\n') },
        { label: 'QR 2', serials: chunk2, qrValue: chunk2.join('\n') },
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
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
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
    
    const printRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            height: 98mm; 
            border: 4px solid #1e293b; 
            margin-bottom: 4mm; 
            background: white;
            display: flex;
            flex-direction: column;
            page-break-inside: avoid;
            position: relative;
            box-shadow: 0 0 10px rgba(0,0,0,0.05);
            overflow: hidden;
        }
        .label-wrapper:last-child {
            margin-bottom: 0;
        }
        @media print {
            .page-break { page-break-after: always; height: 0; border: none; margin: 0; }
            .label-wrapper { box-shadow: none; border-color: black; }
        }
        .header-text-print { 
            font-size: 18pt; 
            font-weight: bold; 
            text-align: center; 
            text-transform: uppercase;
            line-height: 1.4;
            margin-bottom: 0;
            letter-spacing: 1px;
            background-color: #1e293b !important;
            color: white !important;
            padding: 8px 0;
            border-radius: 4px 4px 0 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .row-print {
            display: flex;
            border-bottom: 2px solid #334155;
            flex: 1;
            min-height: 0;
        }
        .row-print:last-child {
            border-bottom: none;
        }
        .label-cell-print { 
            font-size: 15pt; 
            font-weight: bold; 
            background-color: #f8fafc !important;
            width: 180px;
            color: #475569;
            text-transform: uppercase;
            display: flex;
            align-items: center;
            justify-content: center;
            border-right: 2px solid #334155;
            padding: 0 10px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .value-cell-print { 
            font-size: 20pt; 
            font-weight: bold; 
            text-align: center;
            color: #0f172a;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 15px;
            word-break: break-all;
        }
        .value-cell-print-lg { 
            font-size: 38pt; 
            font-weight: bold; 
            text-align: center;
            color: #000;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .qr-container {
            /* unused - kept for compat */
        }
        .label-body {
            display: flex;
            flex-direction: row;
            flex: 1;
            min-height: 0;
        }
        .label-rows {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }
        .qr-column {
            display: flex;
            flex-direction: column;
            border-left: 2px solid #334155;
            width: 150px;
            flex-shrink: 0;
        }
        .qr-cell {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1;
            padding: 4px;
            background: white;
        }
        .qr-cell + .qr-cell {
            border-top: 2px solid #334155;
        }
        .qr-label {
            font-size: 7pt;
            font-weight: bold;
            color: #475569;
            text-align: center;
            margin-bottom: 2px;
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
        notifyError("Đang xuất PDF đúng định dạng A4 Ngang... Vui lòng đợi.");
        
        try {
            const pdf = new jsPDF("l", "mm", "a4");
            const printArea = printRef.current;
            if (!printArea) return;

            const wrappers = printArea.querySelectorAll('.label-wrapper');
            const A4_WIDTH_PX = 1200;
            const A4_HEIGHT_PX = Math.round(A4_WIDTH_PX / 1.4142); // Exact A4 Landscape ratio

            for (let i = 0; i < wrappers.length; i += 2) {
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
                pairWrapper.style.justifyContent = 'space-around';
                
                pairWrapper.appendChild(wrappers[i].cloneNode(true));
                if (wrappers[i+1]) {
                    pairWrapper.appendChild(wrappers[i+1].cloneNode(true));
                }
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
                    // Map image exactly to A4 dimensions in mm without stretching
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
                // Case-insensitive key lookup
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
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode2Icon sx={{ color: 'white', fontSize: 26 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a' }}>TẠO QR_CODE</Typography>
                        <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 700 }}>
                            Thiết kế bởi Võ Thanh Song - LH: 0988.229.082
                        </Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
                        Tải file mẫu HCM
                    </Button>
                    {dataRows.length > 0 && (
                        <>
                            <Button size="small" variant="outlined" startIcon={<PreviewIcon />} onClick={() => setShowPreview(v => !v)}>
                                {showPreview ? 'Ẩn' : 'Xem'} dữ liệu
                            </Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setDataRows([])}>
                                Xóa hết
                            </Button>
                            <Button size="small" variant="contained" startIcon={<PictureAsPdfIcon />} onClick={handleExportPDF} disabled={isExporting} sx={{ bgcolor: '#d97706' }}>
                                Xuất PDF
                            </Button>
                            <Button size="small" variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={isPrinting} sx={{ bgcolor: 'black' }}>
                                In Tem ({totalQRCodes})
                            </Button>
                        </>
                    )}
                </Stack>
            </Box>

            <Grid container spacing={3} mb={3}>
                {/* Import */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight={600} mb={1}>📂 Import Excel</Typography>
                        <Box
                            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={async e => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) await parseExcelRows(f); }}
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                border: `2px dashed ${isDragOver ? 'black' : '#e2e8f0'}`,
                                borderRadius: '12px', p: 4, textAlign: 'center', cursor: 'pointer',
                                bgcolor: isDragOver ? alpha('#000', 0.05) : '#f8fafc',
                                transition: 'all 0.3s'
                            }}>
                            <UploadFileIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 1 }} />
                            <Typography fontWeight={700}>Click hoặc kéo thả file Excel vào đây</Typography>
                            <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
                        </Box>
                    </Paper>
                </Grid>

                {/* Manual */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight={600} mb={1}>⌨️ Nhập thủ công</Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="THÙNG" size="small" value={manualThung} onChange={e => setManualThung(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="Thiết bị" size="small" value={manualThietBi} onChange={e => setManualThietBi(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="Tình Trạng" size="small" value={manualTinhTrang} onChange={e => setManualTinhTrang(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="Tiêu đề" size="small" value={manualTieuDe} onChange={e => setManualTieuDe(e.target.value)} />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField fullWidth label="Serials (QR)" size="small" multiline rows={2} value={manualSerials} onChange={e => setManualSerials(e.target.value)} placeholder="Nhập danh sách serial..." />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Button fullWidth variant="contained" onClick={handleManualAdd} sx={{ bgcolor: 'black' }}>Thêm</Button>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>

            {/* Labels Preview (On-screen) */}
            {dataRows.length > 0 && (
                <Box sx={{ mt: 4, mb: 6 }}>
                    <Typography variant="h6" fontWeight={700} mb={2} display="flex" alignItems="center" gap={1}>
                        <PreviewIcon color="primary" /> Xem trước tem in ({groupedBoxes.length} tem)
                    </Typography>
                    
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 4, 
                            bgcolor: '#f1f5f9', 
                            borderRadius: 4, 
                            border: '1px solid #e2e8f0',
                            maxHeight: '800px',
                            overflowY: 'auto'
                        }}
                    >
                        <Box ref={printRef} sx={{ bgcolor: 'white', p: 0, mx: 'auto', width: 'fit-content' }}>
                            <style>{printStyles}</style>
                            {/* We split groupedBoxes into pages of 2 labels each */}
                            {Array.from({ length: Math.ceil(groupedBoxes.length / 2) }).map((_, pageIdx) => (
                                <div className="print-container" key={pageIdx}>
                                    {[0, 1].map(offset => {
                                        const groupIdx = pageIdx * 2 + offset;
                                        const group = groupedBoxes[groupIdx];
                                        if (!group) return null;

                                        // 1 tem = 1 group, hiển thị tất cả QR codes của box này
                                        return (
                                            <div className="label-wrapper" key={groupIdx}>
                                                {/* Header */}
                                                <div className="header-text-print">
                                                    {group.tieu_de || 'TIÊU ĐỀ'}
                                                </div>

                                                {/* Label body: left rows + right QR column */}
                                                <div className="label-body">
                                                    <div className="label-rows">
                                                        {/* Row 1: THÙNG */}
                                                        <div className="row-print" style={{ flex: '3' }}>
                                                            <div className="label-cell-print">THÙNG</div>
                                                            <div className="value-cell-print-lg">{group.thung}</div>
                                                        </div>

                                                        {/* Row 2: Số lượng */}
                                                        <div className="row-print">
                                                            <div className="label-cell-print">Số lượng</div>
                                                            <div className="value-cell-print-lg">{group.totalQuantity}</div>
                                                        </div>

                                                        {/* Row 3: Thiết bị */}
                                                        <div className="row-print">
                                                            <div className="label-cell-print">Thiết bị</div>
                                                            <div className="value-cell-print">{group.thiet_bi}</div>
                                                        </div>

                                                        {/* Row 4: Tình trạng */}
                                                        <div className="row-print">
                                                            <div className="label-cell-print">Tình trạng</div>
                                                            <div className="value-cell-print">{group.tinh_trang}</div>
                                                        </div>
                                                    </div>

                                                    {/* Right QR column: 1 or 2 stacked cells */}
                                                    <div className="qr-column">
                                                        {group.qrChunks.map((qc, qi) => (
                                                            <div className="qr-cell" key={qi}>
                                                                {group.qrChunks.length > 1 && (
                                                                    <div className="qr-label">{qc.label}</div>
                                                                )}
                                                                <QRCodeSVG
                                                                    value={qc.qrValue}
                                                                    size={group.qrChunks.length > 1 ? 78 : 110}
                                                                    level="L"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {pageIdx < Math.ceil(groupedBoxes.length / 2) - 1 && <div className="page-break" />}
                                </div>
                            ))}
                        </Box>
                    </Paper>
                </Box>
            )}

            {/* Table Preview */}
            {showPreview && dataRows.length > 0 && (
                <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" mb={1}>Chi tiết danh sách serial:</Typography>
                    <TableContainer component={Paper} sx={{ mb: 3, maxHeight: 300, border: '1px solid #e2e8f0' }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell>THÙNG</TableCell>
                                    <TableCell>Thiết bị</TableCell>
                                    <TableCell>QR</TableCell>
                                    <TableCell>Tình Trạng</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dataRows.map((row, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell>{row.thung}</TableCell>
                                        <TableCell>{row.thiet_bi}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>{row.serial}</TableCell>
                                        <TableCell>{row.tinh_trang}</TableCell>
                                        <TableCell>
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
