import React, { useState, useRef, useCallback } from 'react';
import { 
    Box, Paper, Typography, Grid, Stack, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, Button, 
    IconButton, Card, CardContent, Divider 
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import KeyboardIcon from '@mui/icons-material/KeyboardOutlined';
import BarChartIcon from '@mui/icons-material/BarChart';
import { readExcelFile } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { GoogleSheetService } from '../services/GoogleSheetService';
import JsBarcode from 'jsbarcode';

// ─── Barcode Sub-component ──────────────────────────────────────────────────
interface BarcodeValueProps {
    value: string;
}

const BarcodeValue: React.FC<BarcodeValueProps> = ({ value }) => {
    const svgRef = useRef<SVGSVGElement>(null);

    React.useEffect(() => {
        if (svgRef.current) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: 'CODE128',
                    displayValue: false,
                    height: 38,
                    width: 1.0,
                    margin: 0,
                    background: 'transparent',
                });
            } catch (err) {
                console.error('Lỗi tạo Barcode Code 128:', err);
            }
        }
    }, [value]);

    return <svg ref={svgRef} style={{ width: '100%', height: 'auto', maxHeight: '40px' }} />;
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface BarcodeDataRow {
    khu_vuc: string;      // Tầng 1
    ten_vat_tu: string;   // Tầng 2
    ma_vat_tu: string;    // Tầng 3
    ma_barcode: string;   // Tầng 4
}

const BARCODE_STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
        font-family: 'Times New Roman', Times, serif; 
        background: white; 
        padding: 0;
        margin: 0;
    }
    @page { size: A4 landscape; margin: 0; }
    .barcode-pdf-page {
        width: 297mm;
        height: 210mm;
        padding: 6mm 8mm;
        background-color: white;
        box-sizing: border-box;
        page-break-inside: avoid;
        page-break-after: always;
    }
    .barcode-pdf-page:last-child {
        page-break-after: avoid !important;
    }
    .grid-4x4 {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-template-rows: repeat(4, 1fr);
        width: 100%;
        height: 100%;
        border: 1.5px solid #000000;
        padding: 1mm;
        gap: 1mm;
        box-sizing: border-box;
    }
    .barcode-cell {
        border: 1.5px solid #000000;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
        text-align: center;
        background-color: #ffffff;
        overflow: hidden;
        height: 100%;
    }
    .cell-header {
        height: 15%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
        font-weight: bold;
        color: #000000;
        background-color: #f2f2f2;
        border-bottom: 1.5px solid #000000;
        text-transform: uppercase;
    }
    .cell-description {
        height: 32%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.95rem;
        font-weight: 500;
        color: #000000;
        padding: 2px 6px;
        border-bottom: 1.5px solid #000000;
        line-height: 1.25;
        word-break: break-word;
        overflow: hidden;
        text-align: center;
    }
    .cell-sku {
        height: 13%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        font-weight: bold;
        color: #000000;
        border-bottom: 1.5px solid #000000;
    }
    .cell-barcode-area {
        height: 40%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 4px 6px 2px 6px;
        background: #ffffff;
    }
    .cell-barcode-text {
        font-size: 1.15rem;
        font-weight: bold;
        color: #000000;
        margin-top: 1px;
        letter-spacing: 2px;
    }
`;

const BarcodeGenerator = () => {
    const { success, error: notifyError } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { profile: currentUser } = useSelector((state: RootState) => state.auth);

    const [dataRows, setDataRows] = useState<BarcodeDataRow[]>([]);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [docTitle, setDocTitle] = useState('PHIẾU IN BARCODE 4X4');

    // ─── Manual Add Inputs ───
    const [manualKhuVuc, setManualKhuVuc] = useState('N260');
    const [manualTenVatTu, setManualTenVatTu] = useState('');
    const [manualMaVatTu, setManualMaVatTu] = useState('');
    const [manualBarcode, setManualBarcode] = useState('');

    // ─── Excel Template ───
    const downloadTemplate = async () => {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Barcode_Template');
        ws.columns = [
            { header: 'Khu_Vuc', key: 'Khu_Vuc', width: 15 },
            { header: 'Ten_Vat_Tu', key: 'Ten_Vat_Tu', width: 35 },
            { header: 'Ma_Vat_Tu', key: 'Ma_Vat_Tu', width: 20 },
            { header: 'Ma_Barcode', key: 'Ma_Barcode', width: 25 },
        ];
        const headerRow = ws.getRow(1);
        headerRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { horizontal: 'center' };
        });

        // Sample row
        ws.addRow({
            Khu_Vuc: 'N260',
            Ten_Vat_Tu: 'Radio Unit_AHEGB_NSN_1800 FDD; 2100 FDD',
            Ma_Vat_Tu: '200001567',
            Ma_Barcode: 'EA204150368'
        });

        const buf = await wb.xlsx.writeBuffer();
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Barcode_Import_Template.xlsx');
        success('Đã tải file Excel mẫu!');
    };

    // ─── Excel Processing ───
    const parseExcelRows = useCallback(async (file: File) => {
        try {
            const json = await readExcelFile(file);
            const parsed: BarcodeDataRow[] = [];
            json.forEach((row: any) => {
                const barcode = String(row['Ma_Barcode'] || row['BARCODE'] || row['ma_barcode'] || '').trim();
                if (barcode) {
                    parsed.push({
                        khu_vuc: String(row['Khu_Vuc'] || row['KHU_VUC'] || row['khu_vuc'] || 'N260').trim(),
                        ten_vat_tu: String(row['Ten_Vat_Tu'] || row['TEN_VAT_TU'] || row['ten_vat_tu'] || '').trim(),
                        ma_vat_tu: String(row['Ma_Vat_Tu'] || row['MA_VAT_TU'] || row['ma_vat_tu'] || '').trim(),
                        ma_barcode: barcode
                    });
                }
            });

            if (parsed.length === 0) {
                notifyError('Không tìm thấy dữ liệu Barcode hợp lệ trong file');
                return;
            }

            setDataRows(prev => {
                const existing = new Set(prev.map(r => r.ma_barcode));
                const unique = parsed.filter(r => !existing.has(r.ma_barcode));
                success(`Đã thêm ${unique.length} vật tư từ file Excel (bỏ qua ${parsed.length - unique.length} trùng)`);
                return [...prev, ...unique];
            });
        } catch (err: any) {
            notifyError('Lỗi đọc file Excel: ' + err.message);
        }
    }, [success, notifyError]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            await parseExcelRows(e.target.files[0]);
            e.target.value = '';
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
            await parseExcelRows(file);
        } else {
            notifyError('Vui lòng thả file có định dạng .xlsx hoặc .xls');
        }
    };

    const handleManualAdd = () => {
        if (!manualBarcode.trim()) {
            notifyError('Vui lòng nhập mã Barcode');
            return;
        }
        const newRow: BarcodeDataRow = {
            khu_vuc: manualKhuVuc.trim() || 'N260',
            ten_vat_tu: manualTenVatTu.trim() || 'VẬT TƯ MỚI',
            ma_vat_tu: manualMaVatTu.trim() || 'N/A',
            ma_barcode: manualBarcode.trim()
        };

        if (dataRows.some(r => r.ma_barcode === newRow.ma_barcode)) {
            notifyError('Mã Barcode này đã tồn tại trong danh sách');
            return;
        }

        setDataRows(prev => [...prev, newRow]);
        success('Đã thêm 1 vật tư thành công!');
        setManualBarcode('');
        setManualTenVatTu('');
        setManualMaVatTu('');
    };

    const removeRow = (barcode: string) => {
        setDataRows(prev => prev.filter(r => r.ma_barcode !== barcode));
    };

    const clearAll = () => {
        setDataRows([]);
        success('Đã xóa toàn bộ danh sách!');
    };

    // ─── Group Data into Pages (16 items per page) ──────────────────────────
    const itemsPerPage = 16;
    const pages: BarcodeDataRow[][] = [];
    for (let i = 0; i < dataRows.length; i += itemsPerPage) {
        const pageItems = dataRows.slice(i, i + itemsPerPage);
        // Fill the remaining spots of the last page with default "0" data
        while (pageItems.length < itemsPerPage) {
            pageItems.push({
                khu_vuc: '0',
                ten_vat_tu: '0',
                ma_vat_tu: '0',
                ma_barcode: '0'
            });
        }
        pages.push(pageItems);
    }

    // ─── Web Print (Browser Native) ──────────────────────────────────────────
    const handlePrint = () => {
        if (dataRows.length === 0) {
            notifyError('Danh sách trống, không thể in!');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            notifyError('Không thể mở cửa sổ in. Vui lòng tắt chặn Pop-up của trình duyệt.');
            return;
        }

        // Build HTML content for print
        let htmlContent = `
            <html>
            <head>
                <title>${docTitle}</title>
                <style>${BARCODE_STYLES}</style>
            </head>
            <body>
        `;

        pages.forEach((pageItems, pageIdx) => {
            htmlContent += `<div class="barcode-pdf-page">`;
            htmlContent += `<div class="grid-4x4">`;

            pageItems.forEach((item) => {
                htmlContent += `
                    <div class="barcode-cell">
                        <div class="cell-header">${item.khu_vuc}</div>
                        <div class="cell-description">${item.ten_vat_tu}</div>
                        <div class="cell-sku">${item.ma_vat_tu}</div>
                        <div class="cell-barcode-area">
                            <svg class="barcode-svg" data-value="${item.ma_barcode}"></svg>
                            <div class="cell-barcode-text">${item.ma_barcode}</div>
                        </div>
                    </div>
                `;
            });

            htmlContent += `</div>`; // grid-4x4
            htmlContent += `</div>`; // barcode-pdf-page
        });

        htmlContent += `
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
            <script>
                window.onload = function() {
                    const svgs = document.querySelectorAll('.barcode-svg');
                    svgs.forEach(svg => {
                        const val = svg.getAttribute('data-value');
                        try {
                            JsBarcode(svg, val, {
                                format: 'CODE128',
                                displayValue: false,
                                height: 38,
                                width: 1.0,
                                margin: 0,
                                background: 'transparent'
                            });
                        } catch(e) {
                            console.error(e);
                        }
                    });
                    setTimeout(() => {
                        window.print();
                        window.close();
                    }, 500);
                };
            </script>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // ─── Export PDF (html2canvas + jsPDF) ────────────────────────────────────
    const handleExportPDF = async () => {
        if (dataRows.length === 0) {
            notifyError('Danh sách trống, không thể xuất PDF!');
            return;
        }
        setIsExporting(true);
        try {
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const A4_WIDTH_PX = 1123;  // landscape A4 standard px
            const A4_HEIGHT_PX = 794;

            for (let i = 0; i < pages.length; i++) {
                const tempContainer = document.createElement('div');
                tempContainer.style.position = 'fixed';
                tempContainer.style.top = '-9999px';
                tempContainer.style.left = '-9999px';
                tempContainer.style.width = `${A4_WIDTH_PX}px`;
                tempContainer.style.height = `${A4_HEIGHT_PX}px`;
                tempContainer.style.backgroundColor = '#ffffff';

                // Add styling to temporary container
                const styleEl = document.createElement('style');
                styleEl.innerText = BARCODE_STYLES;
                tempContainer.appendChild(styleEl);

                // Add grid and cells
                const pageEl = document.createElement('div');
                pageEl.className = 'barcode-pdf-page';
                pageEl.style.width = '100%';
                pageEl.style.height = '100%';

                const gridEl = document.createElement('div');
                gridEl.className = 'grid-4x4';
                gridEl.style.width = '100%';
                gridEl.style.height = '100%';

                pages[i].forEach(item => {
                    const cell = document.createElement('div');
                    cell.className = 'barcode-cell';
                    cell.innerHTML = `
                        <div class="cell-header">${item.khu_vuc}</div>
                        <div class="cell-description">${item.ten_vat_tu}</div>
                        <div class="cell-sku">${item.ma_vat_tu}</div>
                        <div class="cell-barcode-area">
                            <svg class="barcode-svg" data-value="${item.ma_barcode}"></svg>
                            <div class="cell-barcode-text">${item.ma_barcode}</div>
                        </div>
                    `;
                    gridEl.appendChild(cell);
                });

                pageEl.appendChild(gridEl);
                tempContainer.appendChild(pageEl);
                document.body.appendChild(tempContainer);

                // Initialize barcodes inside temp container using local JsBarcode
                const svgs = tempContainer.querySelectorAll('.barcode-svg');
                svgs.forEach((svg: any) => {
                    const val = svg.getAttribute('data-value');
                    try {
                        JsBarcode(svg, val, {
                            format: 'CODE128',
                            displayValue: false,
                            height: 38,
                            width: 1.0,
                            margin: 0,
                            background: 'transparent'
                        });
                    } catch(e) {
                        console.error(e);
                    }
                });

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
                    const imgData = canvas.toDataURL('image/png');
                    if (i > 0) pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
                }
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            pdf.save(`${docTitle.replace(/\s+/g, '_')}.pdf`);
            success('Xuất PDF thành công!');

            try {
                await GoogleSheetService.saveQRLog({
                    action: 'EXPORT_PDF_BARCODE_4X4',
                    doc_title: docTitle,
                    total_serials: dataRows.length,
                    total_qrs: pages.length * 16,
                    created_by: currentUser?.email || currentUser?.id,
                    details: [{ box: 'A4_BARCODE_128_4X4', district: 'ALL', count: dataRows.length }]
                });
            } catch (e) {
                console.error('Lỗi lưu log:', e);
            }
        } catch (error) {
            console.error(error);
            notifyError('Lỗi khi xuất PDF. Vui lòng thử lại.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Box sx={{ maxWidth: 1400, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
            {/* ── Page Header ── */}
            <Paper 
                elevation={3} 
                sx={{ 
                    p: { xs: 2.5, md: 4 }, 
                    mb: 4, 
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #0d9488 50%, #0f766e 100%)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(13, 148, 136, 0.3)',
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
                                    boxShadow: '0 8px 32px 0 rgba(13, 148, 136, 0.15)',
                                }}
                            >
                                <BarChartIcon sx={{ color: '#ffffff', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography 
                                    variant="h4" 
                                    sx={{ 
                                        fontWeight: 900, 
                                        color: '#ffffff', 
                                        letterSpacing: '-0.03em',
                                        fontSize: { xs: '1.65rem', md: '2.1rem' }
                                    }}
                                >
                                    TẠO MÃ VẠCH VHKT
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
                                    Tạo tem vạch Code 128 tự động xếp 16 tem/A4 ngang. Hỗ trợ import Excel.
                                </Typography>
                            </Box>
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }} sx={{ textAlign: { md: 'right' } }}>
                        <Button 
                            variant="outlined" 
                            startIcon={<DownloadIcon />} 
                            onClick={downloadTemplate}
                            sx={{ 
                                color: 'white', 
                                borderColor: 'rgba(255,255,255,0.6)', 
                                '&:hover': { borderColor: 'white', background: 'rgba(255,255,255,0.1)' } 
                            }}
                        >
                            Tải Excel mẫu
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* ── Main Operations ── */}
            <Grid container spacing={3}>
                {/* 1. Left Operations Column (Import and Manual Add) */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Stack spacing={3}>
                        {/* Drag & Drop Import */}
                        <Card elevation={2} sx={{ borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
                                    Import từ Excel
                                </Typography>
                                <Box
                                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                                    onDragLeave={() => setIsDragOver(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    sx={{
                                        border: '2px dashed',
                                        borderColor: isDragOver ? 'teal.main' : 'grey.300',
                                        borderRadius: '8px',
                                        p: 4,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        background: isDragOver ? '#e6f4f1' : '#fafafa',
                                        transition: 'all 0.2s ease-in-out',
                                        '&:hover': { borderColor: 'teal.main', background: '#f0f9f8' }
                                    }}
                                >
                                    <CloudUploadIcon sx={{ fontSize: 48, color: '#0d9488', mb: 1, opacity: 0.8 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                                        Kéo thả file Excel tại đây hoặc nhấp để tải lên
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                                        Hỗ trợ định dạng: .xlsx, .xls
                                    </Typography>
                                </Box>
                                <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileChange} />
                            </CardContent>
                        </Card>

                        {/* Manual Form */}
                        <Card elevation={2} sx={{ borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
                                    Thêm thủ công
                                </Typography>
                                <Stack spacing={2}>
                                    <input 
                                        type="text" 
                                        placeholder="Khu Vực (VD: N260)" 
                                        value={manualKhuVuc} 
                                        onChange={(e) => setManualKhuVuc(e.target.value)} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
                                    />
                                    <textarea 
                                        placeholder="Tên/Mô tả vật tư" 
                                        value={manualTenVatTu} 
                                        onChange={(e) => setManualTenVatTu(e.target.value)} 
                                        rows={2}
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', fontFamily: 'inherit' }}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Mã Vật Tư / SKU" 
                                        value={manualMaVatTu} 
                                        onChange={(e) => setManualMaVatTu(e.target.value)} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
                                    />
                                    <input 
                                        type="text" 
                                        placeholder="Mã Barcode (Code 128)" 
                                        value={manualBarcode} 
                                        onChange={(e) => setManualBarcode(e.target.value)} 
                                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', fontWeight: 'bold' }}
                                    />
                                    <Button 
                                        variant="contained" 
                                        color="primary" 
                                        fullWidth 
                                        startIcon={<KeyboardIcon />} 
                                        onClick={handleManualAdd}
                                        sx={{ color: 'white', fontWeight: 'bold', py: 1.2 }}
                                    >
                                        Thêm vào danh sách
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                {/* 2. Right Data Preview & Actions */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Card elevation={2} sx={{ borderRadius: '12px', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            {/* Toolbar */}
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 800, color: 'text.primary' }}>
                                    Danh sách nhãn in ({dataRows.length} vật tư)
                                </Typography>
                                <Stack direction="row" spacing={1.5}>
                                    {dataRows.length > 0 && (
                                        <>
                                            <Button 
                                                variant="contained" 
                                                color="primary" 
                                                startIcon={<PrintIcon />} 
                                                onClick={handlePrint}
                                                sx={{ color: 'white', fontWeight: 'bold' }}
                                            >
                                                In ngay (4x4)
                                            </Button>
                                            <Button 
                                                variant="contained" 
                                                color="secondary" 
                                                startIcon={<PictureAsPdfIcon />} 
                                                onClick={handleExportPDF}
                                                disabled={isExporting}
                                                sx={{ fontWeight: 'bold' }}
                                            >
                                                {isExporting ? 'Đang xuất...' : 'Xuất PDF'}
                                            </Button>
                                            <IconButton color="error" onClick={clearAll} title="Xóa toàn bộ">
                                                <DeleteIcon />
                                            </IconButton>
                                        </>
                                    )}
                                </Stack>
                            </Stack>

                            {/* Table */}
                            {dataRows.length === 0 ? (
                                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8 }}>
                                    <BarChartIcon sx={{ fontSize: 72, color: 'grey.300', mb: 2 }} />
                                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                        Chưa có dữ liệu vật tư. Vui lòng import file Excel hoặc thêm thủ công.
                                    </Typography>
                                </Box>
                            ) : (
                                <TableContainer sx={{ maxHeight: 500, flexGrow: 1 }}>
                                    <Table stickyHeader size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 'bold' }}>STT</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Khu Vực</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Tên Vật Tư</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Mã Vật Tư</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Mã Barcode</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold' }}>Hình ảnh mã vạch</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', align: 'center' }}>Hành động</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {dataRows.map((row, idx) => (
                                                <TableRow key={row.ma_barcode + idx} hover>
                                                    <TableCell>{idx + 1}</TableCell>
                                                    <TableCell>{row.khu_vuc}</TableCell>
                                                    <TableCell sx={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.ten_vat_tu}>
                                                        {row.ten_vat_tu}
                                                    </TableCell>
                                                    <TableCell>{row.ma_vat_tu}</TableCell>
                                                    <TableCell sx={{ fontWeight: 'bold' }}>{row.ma_barcode}</TableCell>
                                                    <TableCell sx={{ minWidth: 120 }}>
                                                        <BarcodeValue value={row.ma_barcode} />
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton size="small" color="error" onClick={() => removeRow(row.ma_barcode)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* ─── Visual Preview Mode ─── */}
            {dataRows.length > 0 && (
                <Box sx={{ mt: 5, p: 3, border: '1px solid #ddd', borderRadius: '12px', background: '#fafafa' }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PrintIcon /> BẢN XEM TRƯỚC TRANG IN A4 (MẪU 4X4 - Landscape)
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        {pages.map((pageItems, pageIdx) => (
                            <Paper 
                                key={pageIdx} 
                                elevation={4} 
                                sx={{ 
                                    width: '840px', // Scaling down for preview on web UI
                                    height: '594px', 
                                    padding: '16px 20px', 
                                    background: '#ffffff',
                                    border: '1px solid #999',
                                    boxSizing: 'border-box',
                                    display: 'flex',
                                    flexDirection: 'column',
                                }}
                            >
                                <Typography variant="caption" sx={{ color: 'grey.500', mb: 1, display: 'block', textAlign: 'right' }}>
                                    Trang {pageIdx + 1} / {pages.length}
                                </Typography>
                                <Box 
                                    sx={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(4, 1fr)', 
                                        gridTemplateRows: 'repeat(4, 1fr)', 
                                        width: '100%', 
                                        height: '92%', 
                                        border: '1.5px solid #000000',
                                        padding: '4px',
                                        gap: '4px',
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    {pageItems.map((item, itemIdx) => (
                                        <Box 
                                            key={itemIdx}
                                            sx={{ 
                                                border: '1.5px solid #000000', 
                                                display: 'flex', 
                                                flexDirection: 'column', 
                                                justifyContent: 'space-between',
                                                boxSizing: 'border-box',
                                                textAlign: 'center',
                                                height: '100%',
                                                overflow: 'hidden'
                                            }}
                                        >
                                            <Box sx={{ fontSize: '0.9rem', fontWeight: 'bold', borderBottom: '1.5px solid #000000', padding: '1px 2px', background: '#f2f2f2', textTransform: 'uppercase', height: '18px', lineHeight: '16px' }}>
                                                {item.khu_vuc}
                                            </Box>
                                            <Box sx={{ fontSize: '0.65rem', padding: '2px 4px', flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1.5px solid #000000', lineHeight: 1.2, wordBreak: 'break-word', maxHeight: '36px', overflow: 'hidden' }}>
                                                {item.ten_vat_tu}
                                            </Box>
                                            <Box sx={{ fontSize: '0.8rem', fontWeight: 'bold', borderBottom: '1.5px solid #000000', padding: '1px 2px', height: '16px', lineHeight: '14px' }}>
                                                {item.ma_vat_tu}
                                            </Box>
                                            <Box sx={{ padding: '2px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                                <BarcodeValue value={item.ma_barcode} />
                                                <Box sx={{ fontSize: '0.75rem', fontWeight: 'bold', marginTop: '1px', letterSpacing: '1px' }}>
                                                    {item.ma_barcode}
                                                </Box>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        ))}
                    </Box>
                </Box>
            )}
        </Box>
    );
};

export default BarcodeGenerator;
