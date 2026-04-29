import React, { useState, useRef, useCallback } from 'react';
import {
    Box, Typography, Paper, Button, TextField, Grid, Stack,
    Chip, IconButton, Alert, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow
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
import { useReactToPrint } from 'react-to-print';
import { readExcelFile } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import { parseSerialInput } from '../utils/serialParser';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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

// ─── Main Component ───────────────────────────────────────────────────────────
const QRGenerator = () => {
    const { success, error: notifyError } = useNotification();
    const [dataRows, setDataRows] = useState<QRDataRow[]>([]);
    const [manualDistrict, setManualDistrict] = useState('Q12');
    const [manualBox, setManualBox] = useState('THUNG 01');
    const [manualSerials, setManualSerials] = useState('');
    const [docTitle, setDocTitle] = useState('THU HỒI');
    const [showPreview, setShowPreview] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'Ma_QR_Code',
    });

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            const pdf = new jsPDF("l", "mm", "a4");
            const pages = document.querySelectorAll('.pdf-page');
            
            if (pages.length === 0) {
                notifyError("Không có dữ liệu để xuất");
                setIsExporting(false);
                return;
            }
            
            for (let i = 0; i < pages.length; i++) {
                const pageEl = pages[i] as HTMLElement;
                const canvas = await html2canvas(pageEl, { scale: 3, useCORS: true, logging: false });
                const imgData = canvas.toDataURL("image/png");
                
                if (i > 0) pdf.addPage();
                
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            }
            
            pdf.save("Ma_QR_Code.pdf");
            success("Xuất PDF thành công!");
        } catch (error) {
            console.error(error);
            notifyError("Lỗi khi xuất PDF. Vui lòng thử lại.");
        } finally {
            setIsExporting(false);
        }
    };

    // ─── Parse Excel rows ──────────────────────────────────────────────────
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

    // ─── Drag & Drop ───────────────────────────────────────────────────────
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault(); setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            await parseExcelRows(file);
        } else { notifyError('Vui lòng thả file .xlsx hoặc .xls'); }
    };

    // ─── Manual Add ────────────────────────────────────────────────────────
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

    // ─── Grouped + QR chunks ───────────────────────────────────────────────
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
        // Build QR chunks per box
        map.forEach(g => { g.qrChunks = buildQRChunks(g.serials); });
        return Array.from(map.values()).sort((a, b) => a.boxNumber.localeCompare(b.boxNumber));
    }, [dataRows]);

    const totalQRCodes = groupedBoxes.reduce((sum, g) => sum + g.qrChunks.length, 0);

    const pairedBoxes = React.useMemo(() => {
        const pairs = [];
        for (let i = 0; i < groupedBoxes.length; i += 2) {
            pairs.push(groupedBoxes.slice(i, i + 2));
        }
        return pairs;
    }, [groupedBoxes]);

    // ─── Remove a specific row ─────────────────────────────────────────────
    const removeSerial = (serial: string) => setDataRows(prev => prev.filter(r => r.serial_code !== serial));

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
            {/* ── Page Header ── */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode2Icon sx={{ color: 'white', fontSize: 26 }} />
                    </Box>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>Tạo Mã QR Code</Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>Mỗi mã QR chứa tối đa {MAX_SERIALS_PER_QR} serial</Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}
                        sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}>
                        Tải file mẫu
                    </Button>
                    {dataRows.length > 0 && (
                        <>
                            <Button size="small" variant="outlined" startIcon={<PreviewIcon />}
                                onClick={() => setShowPreview(v => !v)} color="info">
                                {showPreview ? 'Ẩn preview' : 'Xem dữ liệu'}
                            </Button>
                            <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}
                                onClick={() => { setDataRows([]); success('Đã xóa tất cả dữ liệu'); }}>
                                Xóa tất cả
                            </Button>
                            <Button size="small" variant="contained" startIcon={<PictureAsPdfIcon />}
                                onClick={handleExportPDF} disabled={isExporting}
                                sx={{ bgcolor: '#d97706', '&:hover': { bgcolor: '#b45309' } }}>
                                {isExporting ? 'Đang xuất...' : 'Xuất PDF'}
                            </Button>
                            <Button size="small" variant="contained" startIcon={<PrintIcon />}
                                onClick={() => handlePrint()} disabled={isExporting}
                                sx={{ bgcolor: '#2563eb', borderRadius: '10px', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 600 }}>
                                In ({totalQRCodes} QR)
                            </Button>
                        </>
                    )}
                </Stack>
            </Box>

            {/* ── Summary chips ── */}
            {dataRows.length > 0 && (
                <Stack direction="row" spacing={1.5} mb={3} flexWrap="wrap">
                    <Chip icon={<InventoryIcon />} label={`${dataRows.length} serials`} color="primary" variant="outlined" />
                    <Chip icon={<QrCode2Icon />} label={`${groupedBoxes.length} thùng`} color="success" variant="outlined" />
                    <Chip icon={<QrCode2Icon />} label={`${totalQRCodes} mã QR`} sx={{ borderColor: '#f59e0b', color: '#f59e0b' }} variant="outlined" />
                </Stack>
            )}

            <Grid container spacing={3} mb={3}>
                {/* ── Import Excel Panel ── */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 3, height: '100%', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight={600} mb={0.5} sx={{ color: '#0f172a' }}>📂 Import từ Excel</Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            File cần có cột: <b>serial_code</b>, <b>Number_Thung</b>, <b>District</b>
                        </Typography>

                        {/* Drag & Drop Zone */}
                        <Box
                            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            sx={{
                                border: `2px dashed ${isDragOver ? '#2563eb' : '#e2e8f0'}`,
                                borderRadius: '12px', p: 4, textAlign: 'center', cursor: 'pointer',
                                bgcolor: isDragOver ? alpha('#2563eb', 0.05) : '#f8fafc',
                                transition: 'all 0.3s ease',
                                '&:hover': { borderColor: '#2563eb', bgcolor: alpha('#2563eb', 0.02) }
                            }}>
                            <UploadFileIcon sx={{ fontSize: 48, color: isDragOver ? '#2563eb' : '#94a3b8', mb: 1 }} />
                            <Typography fontWeight={700} color={isDragOver ? '#2563eb' : '#475569'}>
                                {isDragOver ? 'Thả file vào đây!' : 'Kéo thả file hoặc click để chọn'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>Chấp nhận định dạng .xlsx, .xls</Typography>
                            <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
                        </Box>
                    </Paper>
                </Grid>

                {/* ── Manual Input Panel ── */}
                <Grid size={{ xs: 12, md: 6 }}>
                    <Paper elevation={0} sx={{ p: 3, height: '100%', border: '1px solid #e2e8f0', borderRadius: 3 }}>
                        <Typography variant="h6" fontWeight={600} mb={0.5} sx={{ color: '#0f172a' }}>⌨️ Nhập / Quét trực tiếp</Typography>
                        <Typography variant="body2" color="text.secondary" mb={2}>
                            Mỗi serial 1 dòng hoặc cách bằng dấu phẩy, Enter
                        </Typography>
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="Khu vực (District)" size="small"
                                    value={manualDistrict} onChange={e => setManualDistrict(e.target.value)}
                                    placeholder="VD: Q12, Q1..." />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <TextField fullWidth label="Số Thùng" size="small"
                                    value={manualBox} onChange={e => setManualBox(e.target.value)}
                                    placeholder="VD: THUNG 01" />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <TextField fullWidth label="Serials" size="small" multiline rows={4}
                                    value={manualSerials} onChange={e => setManualSerials(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); handleManualAdd(); } }}
                                    placeholder="SN001&#10;SN002&#10;SN003"
                                />
                            </Grid>
                            <Grid size={{ xs: 12 }}>
                                <Button fullWidth variant="contained" startIcon={<AddCircleOutlineIcon />}
                                    onClick={handleManualAdd}
                                    sx={{ bgcolor: '#2563eb', borderRadius: '10px', py: 1.2, '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700 }}>
                                    Thêm vào danh sách (Ctrl+Enter)
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>
            </Grid>

            {/* ── Data Preview Table ── */}
            {showPreview && dataRows.length > 0 && (
                <Paper elevation={0} sx={{ mb: 3, border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <Box sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography fontWeight={600} color="#0f172a">Dữ liệu đã nhập ({dataRows.length} serials)</Typography>
                    </Box>
                    <TableContainer sx={{ maxHeight: 320 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }}>#</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }}>Serial Code</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }}>Thùng</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }}>Khu vực</TableCell>
                                    <TableCell sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {dataRows.slice(0, 200).map((row, idx) => (
                                    <TableRow key={row.serial_code} hover>
                                        <TableCell sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 500 }}>{row.serial_code}</TableCell>
                                        <TableCell>{row.Number_Thung}</TableCell>
                                        <TableCell><Chip label={row.District} size="small" /></TableCell>
                                        <TableCell>
                                            <IconButton size="small" color="error" onClick={() => removeSerial(row.serial_code)}>
                                                <DeleteOutlineIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    {dataRows.length > 200 && (
                        <Alert severity="info" sx={{ borderRadius: 0 }}>Hiển thị 200/{dataRows.length} dòng. In để xem tất cả QR.</Alert>
                    )}
                </Paper>
            )}

            {/* ── QR Preview Area ── */}
            {groupedBoxes.length === 0 ? (
                <Paper elevation={0} sx={{ p: 8, textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 3, bgcolor: '#f8fafc' }}>
                    <QrCode2Icon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" fontWeight={500}>Chưa có dữ liệu</Typography>
                    <Typography variant="body2" color="text.secondary">Import file Excel hoặc nhập serial để tạo mã QR</Typography>
                </Paper>
            ) : (
                <>
                    <Box mb={2} display="flex" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
                        <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="h6" fontWeight={600} color="#0f172a">Bảng QR Code</Typography>
                            <Chip label={`${groupedBoxes.length} thùng · ${totalQRCodes} mã QR`} size="small" color="primary" />
                        </Box>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <TextField size="small" label="Tiêu đề in" value={docTitle} onChange={e => setDocTitle(e.target.value)}
                                sx={{ width: 140, bgcolor: 'white', '& .MuiOutlinedInput-root': { height: 36 } }} />
                            <Button variant="contained" startIcon={<PictureAsPdfIcon />}
                                onClick={handleExportPDF} disabled={isExporting}
                                sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 600, height: 36 }}>
                                {isExporting ? 'Đang xuất...' : 'Xuất PDF'}
                            </Button>
                            <Button variant="contained" startIcon={<PrintIcon />}
                                onClick={() => handlePrint()} disabled={isExporting}
                                sx={{ bgcolor: '#2563eb', borderRadius: '10px', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700, height: 40, textTransform: 'none' }}>
                                In Trực Tiếp
                            </Button>
                        </Stack>
                    </Box>

                    {/* Printable Area */}
                    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                        <Box ref={printRef} sx={{ p: { xs: 1, md: 3 }, bgcolor: 'white' }}>
                            <style type="text/css" media="print">{`
                                @page { size: A4 landscape; margin: 8mm; }
                                @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                            `}</style>

                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                {pairedBoxes.map((pair, pageIndex) => (
                                    <Box key={pageIndex} className="pdf-page"
                                        sx={{ 
                                            display: 'flex', 
                                            flexDirection: 'column', 
                                            gap: 8, 
                                            p: 2, // Padding for PDF capture border
                                            bgcolor: 'white',
                                            pageBreakAfter: pageIndex < pairedBoxes.length - 1 ? 'always' : 'auto',
                                            ...(pageIndex < pairedBoxes.length - 1 && { mb: 4 })
                                        }}>
                                        {pair.map((group) => {
                                            const boxLabel = group.boxNumber.replace(/THUNG/i, '').trim();
                                            return (
                                                <TableContainer key={group.key} component={Paper} elevation={0}
                                                    sx={{ border: '2px solid #1a1a1a', pageBreakInside: 'avoid', mb: pair.length === 1 ? 'auto' : 0 }}>
                                                    <Table sx={{ '& td, & th': { border: '1px solid #555', padding: '8px 12px' } }}>
                                                        <TableBody>
                                                            <TableRow>
                                                                {/* ─ Info Column ─ */}
                                                                <TableCell sx={{ width: 260, verticalAlign: 'top', p: '0 !important', border: '1px solid #555 !important' }}>
                                                                    <Box sx={{ borderBottom: '2px solid #1a1a1a', py: 1, px: 1.5, bgcolor: '#2563eb', color: 'white', fontWeight: 900, fontSize: '1.1rem', textAlign: 'center', letterSpacing: 1 }}>
                                                                        {group.district.toUpperCase()} – {docTitle.toUpperCase()}
                                                                    </Box>
                                                                    <Box sx={{ borderBottom: '1px solid #555', py: 0.3, px: 1.5 }}>
                                                                        <Typography fontSize="0.8rem" color="text.secondary" display="block">SỐ THÙNG</Typography>
                                                                        <Typography fontWeight={700} fontSize="1.2rem">{boxLabel || group.boxNumber}</Typography>
                                                                    </Box>
                                                                    <Box sx={{ borderBottom: '1px solid #555', py: 0.3, px: 1.5 }}>
                                                                        <Typography fontSize="0.8rem" color="text.secondary" display="block">SỐ LƯỢNG</Typography>
                                                                        <Typography fontWeight={700} fontSize="1.2rem">{group.totalQuantity} serial</Typography>
                                                                    </Box>
                                                                    <Box sx={{ borderBottom: '1px solid #555', py: 0.3, px: 1.5 }}>
                                                                        <Typography fontSize="0.8rem" color="text.secondary" display="block">SỐ MÃ QR</Typography>
                                                                        <Typography fontWeight={700} fontSize="1.2rem">{group.qrChunks.length} mã</Typography>
                                                                    </Box>
                                                                    <Box sx={{ py: 0.3, px: 1.5 }}>
                                                                        <Typography fontSize="0.8rem" color="text.secondary" display="block">GHI CHÚ</Typography>
                                                                        <Typography fontSize="1.1rem" fontWeight={600}>SỐ PHIẾU: ________</Typography>
                                                                    </Box>
                                                                </TableCell>

                                                                {/* ─ QR Code Columns ─ */}
                                                                {group.qrChunks.map((chunk) => (
                                                                    <TableCell key={chunk.label} sx={{ textAlign: 'center', verticalAlign: 'middle', minWidth: 200, py: 1 }}>
                                                                        <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                                            <Typography fontWeight={800} fontSize="0.9rem" color="#0b3d2b">
                                                                                {chunk.label}
                                                                            </Typography>
                                                                            <Chip label={`${chunk.serials.length}/${MAX_SERIALS_PER_QR}`} size="small"
                                                                                sx={{ fontSize: '0.7rem', height: 18, bgcolor: chunk.serials.length === MAX_SERIALS_PER_QR ? '#dcfce7' : '#fef9c3' }} />
                                                                        </Box>
                                                                        <Box display="flex" justifyContent="center">
                                                                            <QRCodeSVG value={chunk.qrValue} size={110} level="M" includeMargin={false} />
                                                                        </Box>
                                                                    </TableCell>
                                                                ))}

                                                                {/* ─ Fill empty cells (min 3 QR columns look) ─ */}
                                                                {group.qrChunks.length < 3 && Array.from({ length: 3 - group.qrChunks.length }).map((_, i) => (
                                                                    <TableCell key={`empty-${i}`} sx={{ minWidth: 180, color: '#e2e8f0', textAlign: 'center', verticalAlign: 'middle' }}>
                                                                        <QrCode2Icon sx={{ fontSize: 60, opacity: 0.15 }} />
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        </TableBody>
                                                    </Table>
                                                </TableContainer>
                                            );
                                        })}
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Paper>
                </>
            )}
        </Box>
    );
};

export default QRGenerator;
