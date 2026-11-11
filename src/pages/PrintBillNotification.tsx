import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
    Box, Typography, Button, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, 
    Stack, Alert, CircularProgress, IconButton, TextField, 
    InputAdornment, Tooltip, Card, CardContent, Divider,
    useMediaQuery, useTheme, Chip
} from '@mui/material';
import { 
    Download as DownloadIcon, 
    Upload as UploadIcon, 
    Print as PrintIcon, 
    Delete as DeleteIcon,
    Search as SearchIcon,
    Share as ShareIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    Payment as PaymentIcon,
    CloudSync as CloudSyncIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import ExcelJS from 'exceljs';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import BillTemplateA5 from '../components/BillTemplateA5';
import type { BillData } from '../components/BillTemplateA5';
import BankQrCard from '../components/BankQrCard';
import { parseExcelNumber, numberToWordsVN, formatNumber } from '../utils/numberUtils';
import { supabase } from '../config/supabase';

const STORAGE_KEY = 'PRINT_BILL_NOTIFICATION_DATA';
const DB_STATUS_TAG = 'bill_notification_item';

const PrintBillNotification: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Khởi tạo state data từ localStorage (để hiển thị tức thì nếu có cache)
    const [data, setData] = useState<BillData[]>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {
            console.error('Không thể đọc dữ liệu lưu từ localStorage:', e);
        }
        return [];
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [syncingDb, setSyncingDb] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [exportingSingleId, setExportingSingleId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const qrCardRef = useRef<HTMLDivElement>(null);

    // Tải dữ liệu từ Database Supabase về (đồng bộ giữa Web và Mobile)
    const fetchBillsFromDatabase = useCallback(async (silent = false) => {
        try {
            if (!silent) setSyncingDb(true);
            const { data: records, error: dbError } = await supabase
                .from('zalo_notification_logs')
                .select('*')
                .eq('status', DB_STATUS_TAG)
                .order('created_at', { ascending: true });

            if (dbError) {
                console.error('Lỗi khi tải danh sách từ database:', dbError);
                return;
            }

            if (records) {
                const loadedBills: BillData[] = records
                    .map(r => r.params as BillData)
                    .filter((item): item is BillData => !!item && !!item.customerName);

                setData(loadedBills);
                if (loadedBills.length > 0) {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(loadedBills));
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (err: any) {
            console.error('Lỗi khi kết nối database:', err);
        } finally {
            if (!silent) setSyncingDb(false);
        }
    }, []);

    // Tự động tải từ Database khi mở màn hình
    useEffect(() => {
        fetchBillsFromDatabase();
    }, [fetchBillsFromDatabase]);

    // Mẫu branch config (có thể thay đổi nếu cần)
    const branchConfig = {
        branchName: 'VIETTEL QUẬN 12',
        branchAddress: '50 TRƯƠNG THỊ HOA PHƯỜNG TÂN THỚI HIỆP Q12',
        branchContact: 'ĐT- ZALO 0979 092 604 – 0987 268 794',
        branchServices: 'THU CƯỚC –LẮP ĐẶT INTERNET – SIM SỐ ĐẸP'
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mau_In_Thong_Bao');

        worksheet.columns = [
            { header: 'Khách Hàng', key: 'customerName', width: 25 },
            { header: 'Địa Chỉ', key: 'address', width: 40 },
            { header: 'Thuê Bao', key: 'phone', width: 15 },
            { header: 'Dịch Vụ & Tháng', key: 'serviceMonth', width: 30 },
            { header: 'Số Tiền', key: 'amount', width: 15 },
            { header: 'Ngày In', key: 'dateString', width: 25 },
            { header: 'Nhân Viên', key: 'collectorName', width: 20 },
            { header: 'SĐT NV', key: 'collectorPhone', width: 15 },
        ];

        // Add dummy data
        worksheet.addRow({
            customerName: 'Nguyễn Lê Nin Đa',
            address: '23H Nguyễn ảnh Thủ, Khu phố 3, P. Hiệp Thành',
            phone: '977719919',
            serviceMonth: 'INTERNET TRẢ SAU THÁNG 06/2026',
            amount: '400,000Đ',
            dateString: 'TP. HCM, ngày 10 tháng 07 năm 2026',
            collectorName: 'ĐỖ THỊ NGỌC MAI',
            collectorPhone: '0979092604'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Mau_In_Thong_Bao.xlsx';
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            
            const parsedData: BillData[] = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const getVal = (col: number) => {
                    const val = row.getCell(col).value;
                    if (val && typeof val === 'object' && 'richText' in val) {
                        return val.richText.map((rt: any) => rt.text).join('');
                    }
                    return val ? val.toString() : '';
                };

                const customerName = getVal(1);
                if (!customerName) return; // Bỏ qua dòng trống

                const rawAmount = getVal(5);
                const parsedAmountNum = parseExcelNumber(rawAmount);

                parsedData.push({
                    id: Math.random().toString(36).substr(2, 9),
                    customerName: getVal(1),
                    address: getVal(2),
                    phone: getVal(3),
                    serviceMonth: getVal(4),
                    amount: formatNumber(parsedAmountNum),
                    amountInWords: numberToWordsVN(parsedAmountNum),
                    dateString: getVal(6),
                    collectorName: getVal(7),
                    collectorPhone: getVal(8),
                    ...branchConfig
                });
            });

            setData(parsedData);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedData));

            // Lưu đồng bộ lên Database Supabase để máy tính và điện thoại đều có chung dữ liệu
            try {
                // Xóa danh sách cũ trên DB trước khi chèn danh sách mới
                await supabase.from('zalo_notification_logs').delete().eq('status', DB_STATUS_TAG);

                if (parsedData.length > 0) {
                    const dbPayload = parsedData.map(item => ({
                        id: crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36)),
                        recipient_phone: item.phone || '',
                        status: DB_STATUS_TAG,
                        error_message: item.id, // Lưu bill ID
                        params: item
                    }));

                    const { error: insertErr } = await supabase.from('zalo_notification_logs').insert(dbPayload);
                    if (insertErr) {
                        console.error('Lỗi khi lưu danh sách vào Database:', insertErr);
                    }
                }
            } catch (dbErr) {
                console.error('Không thể đồng bộ vào database:', dbErr);
            }
        } catch (err: any) {
            console.error('Excel parse error:', err);
            setError('Lỗi khi đọc file Excel. Vui lòng đảm bảo đúng định dạng mẫu.');
        } finally {
            setLoading(false);
            e.target.value = '';
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'In_Thong_Bao_Cuoc',
        pageStyle: `
            @page {
                size: 210mm 148mm !important;
                margin: 0 !important;
            }
            @media print {
                html, body {
                    width: 210mm !important;
                    height: 148mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #fff !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .bill-print-container {
                    display: block !important;
                    position: static !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 210mm !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .bill-page-item {
                    width: 210mm !important;
                    height: 148mm !important;
                    max-height: 148mm !important;
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
            }
        `
    });

    // Xuất tất cả các hóa đơn thành 1 file PDF A5
    const handleExportPdf = async () => {
        if (!printRef.current || data.length === 0) return;
        setExportingPdf(true);
        setError(null);
        try {
            const bills = Array.from(printRef.current.querySelectorAll<HTMLElement>('[data-bill-page]'));
            if (!bills.length) throw new Error('Không tìm thấy nội dung thông báo để xuất PDF.');

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5', compress: true });
            for (const [index, bill] of bills.entries()) {
                const canvas = await html2canvas(bill, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    windowWidth: bill.scrollWidth,
                    windowHeight: bill.scrollHeight,
                });
                if (index > 0) pdf.addPage('a5', 'landscape');
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 148.5, undefined, 'FAST');
            }
            pdf.save(`Thong_bao_cuoc_A5_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err: any) {
            console.error('PDF export error:', err);
            setError(err.message || 'Không thể xuất file PDF. Vui lòng thử lại.');
        } finally {
            setExportingPdf(false);
        }
    };

    // Tạo file PDF cho 1 khách hàng cụ thể với tốc độ tối ưu
    const generateSinglePdf = async (billItem: BillData): Promise<{ blob: Blob; fileName: string }> => {
        if (!printRef.current) throw new Error('Không tìm thấy vùng in.');
        const billEl = printRef.current.querySelector<HTMLElement>(`[data-bill-id="${billItem.id}"]`);
        if (!billEl) throw new Error('Không tìm thấy phần tử hóa đơn của khách hàng này.');

        // Tối ưu tốc độ: scale: 1.5, tắt logging và các tùy chọn nặng nề để render siêu tốc
        const canvas = await html2canvas(billEl, {
            scale: 1.5,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            removeContainer: true,
            windowWidth: billEl.scrollWidth,
            windowHeight: billEl.scrollHeight,
        });

        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5', compress: false });
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, 148.5, undefined, 'FAST');
        
        const cleanName = (billItem.customerName || 'KH').trim().replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
        const fileName = `Thong_Bao_Cuoc_${cleanName}_${billItem.phone || ''}.pdf`;
        const blob = pdf.output('blob');
        return { blob, fileName };
    };

    // Tải file PDF đơn lẻ của 1 khách hàng
    const handleDownloadSinglePdf = async (billItem: BillData) => {
        setExportingSingleId(billItem.id);
        setError(null);
        try {
            const { blob, fileName } = await generateSinglePdf(billItem);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Lỗi khi tải PDF đơn lẻ:', err);
            setError(err.message || 'Không thể tải file PDF khách hàng này.');
        } finally {
            setExportingSingleId(null);
        }
    };

    // Tạo file ảnh thẻ QR Ngân Hàng siêu nét với tốc độ cực nhanh (để Zalo tự nhận diện hiện nút "Chuyển tiền / Chuyển khoản")
    const generateQrCardImage = async (billItem: BillData): Promise<{ blob: Blob; fileName: string }> => {
        if (!qrCardRef.current) throw new Error('Không tìm thấy vùng thẻ QR.');
        const cardEl = qrCardRef.current.querySelector<HTMLElement>(`[data-qr-card-id="${billItem.id}"]`);
        if (!cardEl) throw new Error('Không tìm thấy phần tử thẻ QR của khách hàng này.');

        // Scale 2x trên kích thước 420x264 cho ra ảnh 840x528 pixel cực kỳ sắc nét mà xử lý chỉ mất ~100ms
        const canvas = await html2canvas(cardEl, {
            scale: 2,
            useCORS: true,
            backgroundColor: null,
            logging: false,
            removeContainer: true,
            windowWidth: 420,
            windowHeight: 264,
        });

        const cleanName = (billItem.customerName || 'KH').trim().replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
        const fileName = `MBBank_QR_${cleanName}_${billItem.phone || ''}.png`;

        const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Không thể tạo file ảnh QR.'));
            }, 'image/png');
        });

        return { blob, fileName };
    };

    // Chia sẻ thông báo cước + ảnh thẻ mã QR qua Zalo (hiện nút Chuyển tiền / Chuyển khoản)
    const handleShareZalo = async (billItem: BillData) => {
        setSharingId(billItem.id);
        setError(null);
        try {
            // Chuẩn hóa nội dung tin nhắn gửi kèm
            const shareText = `Kính gửi Quý khách ${billItem.customerName},\nViettel xin gửi Thông báo cước dịch vụ:\n- Thuê bao: ${billItem.phone}\n- Kỳ cước: ${billItem.serviceMonth}\n- Số tiền cần thanh toán: ${billItem.amount} đ\nTrân trọng cảm ơn Quý khách!`;

            // Tự động sao chép sẵn vào Clipboard ngay lập tức để dán ngay trên ô chat Zalo nếu cần
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(shareText);
                } catch (clipErr) {
                    console.log('Clipboard copy note:', clipErr);
                }
            }

            // Tạo file ảnh thẻ QR Ngân hàng MB Bank (Zalo sẽ tự động nhận diện và hiện nút "Chuyển tiền / Chuyển khoản" trực tiếp trên ảnh)
            const { blob, fileName } = await generateQrCardImage(billItem);
            const imageFile = new File([blob], fileName, { type: 'image/png' });

            // Popup Web Share Sheet hệ thống: Chia sẻ dạng ảnh PNG + text để Zalo hiển thị ảnh xem trước và nhận diện nút chuyển tiền
            if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
                try {
                    await navigator.share({
                        title: shareText,
                        text: shareText,
                        files: [imageFile],
                    });
                    return;
                } catch (shareErr: any) {
                    if (shareErr.name === 'AbortError') return;
                    console.warn('Share ảnh QR thất bại, thử share text:', shareErr);
                }
            }

            // Fallback chỉ share Text nếu thiết bị không hỗ trợ chia sẻ tệp ảnh trực tiếp
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: `Thông Báo Cước - ${billItem.customerName}`,
                        text: shareText,
                    });
                    return;
                } catch (shareTextErr: any) {
                    if (shareTextErr.name === 'AbortError') return;
                }
            }

            // Fallback mở Zalo Web trên máy tính
            window.open('https://chat.zalo.me', '_blank');
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error('Lỗi chia sẻ Zalo:', err);
                window.open('https://chat.zalo.me', '_blank');
            }
        } finally {
            setSharingId(null);
        }
    };

    const clearData = async () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách? Thao tác này sẽ xóa dữ liệu trên cả máy tính và điện thoại.')) {
            setData([]);
            localStorage.removeItem(STORAGE_KEY);
            try {
                await supabase.from('zalo_notification_logs').delete().eq('status', DB_STATUS_TAG);
            } catch (err) {
                console.error('Lỗi khi xóa danh sách trên Database:', err);
            }
        }
    };

    // Xóa đơn lẻ 1 khách hàng
    const handleDeleteSingle = async (billItem: BillData) => {
        if (window.confirm(`Bạn có chắc muốn xóa khách hàng "${billItem.customerName}" khỏi danh sách?`)) {
            setData(prev => {
                const next = prev.filter(item => item.id !== billItem.id);
                if (next.length === 0) {
                    localStorage.removeItem(STORAGE_KEY);
                } else {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                }
                return next;
            });

            // Đồng bộ xóa trên Database
            try {
                await supabase.from('zalo_notification_logs').delete().match({
                    status: DB_STATUS_TAG,
                    error_message: billItem.id
                });
            } catch (err) {
                console.error('Lỗi khi xóa trên Database:', err);
            }
        }
    };

    // Lọc danh sách theo thanh tìm kiếm
    const filteredData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const term = searchTerm.toLowerCase().trim();
        return data.filter(item => 
            (item.customerName || '').toLowerCase().includes(term) ||
            (item.phone || '').toLowerCase().includes(term) ||
            (item.address || '').toLowerCase().includes(term) ||
            (item.serviceMonth || '').toLowerCase().includes(term) ||
            (item.amount || '').toLowerCase().includes(term) ||
            (item.collectorName || '').toLowerCase().includes(term)
        );
    }, [data, searchTerm]);

    return (
        <Box sx={{ p: { xs: 1.5, sm: 2.5, md: 3 } }}>
            {/* Top Toolbar */}
            <Box sx={{ 
                display: 'flex', 
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between', 
                alignItems: { xs: 'stretch', sm: 'center' }, 
                mb: 2, 
                gap: 1.5 
            }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 'bold' }}>
                            In Thông Báo Cước A5
                        </Typography>
                        {syncingDb && (
                            <Tooltip title="Đang đồng bộ cơ sở dữ liệu...">
                                <CircularProgress size={18} color="info" />
                            </Tooltip>
                        )}
                    </Stack>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Làm mới từ Database">
                            <IconButton size="small" onClick={() => fetchBillsFromDatabase()} disabled={syncingDb}>
                                <RefreshIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        {data.length > 0 && isMobile && (
                            <IconButton color="error" size="small" onClick={clearData} title="Xóa tất cả">
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                </Box>
                
                {/* Nút hành động toolbar */}
                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'auto auto auto auto auto' }, 
                    gap: 1,
                    alignItems: 'center'
                }}>
                    <Button
                        variant="outlined"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadTemplate}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        Tải File Mẫu
                    </Button>
                    
                    <Button
                        variant="contained"
                        component="label"
                        size={isMobile ? "small" : "medium"}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <UploadIcon />}
                        disabled={loading}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        Nhập Excel
                        <input
                            type="file"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                        />
                    </Button>
                    
                    <Button
                        variant="contained"
                        color="secondary"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<PrintIcon />}
                        disabled={data.length === 0}
                        onClick={() => handlePrint()}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        In {data.length > 0 ? `(${data.length})` : ''}
                    </Button>

                    <Button
                        variant="contained"
                        color="error"
                        size={isMobile ? "small" : "medium"}
                        startIcon={exportingPdf ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
                        disabled={data.length === 0 || exportingPdf}
                        onClick={handleExportPdf}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        {exportingPdf ? 'Đang xuất...' : `Xuất PDF${data.length > 0 ? ` (${data.length})` : ''}`}
                    </Button>
                    
                    {data.length > 0 && !isMobile && (
                        <IconButton color="error" onClick={clearData} title="Xóa toàn bộ danh sách">
                            <DeleteIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* Thanh tìm kiếm & thống kê số lượng */}
            {data.length > 0 && (
                <Box sx={{ 
                    mb: 2, 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 1
                }}>
                    <TextField
                        size="small"
                        fullWidth={isMobile}
                        placeholder="Tìm tên khách hàng, thuê bao, số tiền..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        sx={{ 
                            width: { xs: '100%', sm: 380 },
                            bgcolor: 'background.paper',
                            borderRadius: 1
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: { xs: 'right', sm: 'left' } }}>
                        Tìm thấy: <b>{filteredData.length}</b> / {data.length} khách hàng
                    </Typography>
                </Box>
            )}

            {/* GIAO DIỆN MOBILE: Card List (Dễ nhìn, bấm thao tác tiện dụng trên điện thoại) */}
            {isMobile ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filteredData.length === 0 ? (
                        <Paper sx={{ p: 3, textAlign: 'center' }}>
                            <Typography color="text.secondary" variant="body2">
                                {data.length === 0 
                                    ? 'Chưa có dữ liệu. Vui lòng tải file mẫu và nhập liệu từ Excel.' 
                                    : 'Không tìm thấy khách hàng nào khớp với từ khóa tìm kiếm.'}
                            </Typography>
                        </Paper>
                    ) : (
                        filteredData.map((row, index) => (
                            <Card key={row.id} variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    {/* Hàng trên: STT + Tên KH + Số tiền */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Chip label={index + 1} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }} />
                                            <Typography sx={{ fontWeight: 'bold', fontSize: '15px' }}>
                                                {row.customerName}
                                            </Typography>
                                        </Box>
                                        <Typography sx={{ fontWeight: 800, color: '#ee0033', fontSize: '16px' }}>
                                            {row.amount} đ
                                        </Typography>
                                    </Box>

                                    {/* Thông tin chi tiết */}
                                    <Stack spacing={0.6} sx={{ fontSize: '13px', color: 'text.secondary', mb: 1.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PhoneIcon sx={{ fontSize: 15, color: '#3b82f6' }} />
                                            <span>Thuê bao (Account): <Box component="span" sx={{ color: 'text.primary', fontWeight: 700, fontFamily: 'monospace', fontSize: '13.5px' }}>{row.phone}</Box></span>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                            <LocationIcon sx={{ fontSize: 15, color: 'text.secondary', mt: 0.3 }} />
                                            <span style={{ lineHeight: 1.25 }}>{row.address}</span>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <PaymentIcon sx={{ fontSize: 15, color: '#10b981' }} />
                                            <span>{row.serviceMonth}</span>
                                        </Box>
                                    </Stack>

                                    <Divider sx={{ mb: 1 }} />

                                    {/* Hàng dưới: Các nút bấm thao tác lớn dễ chạm trên màn hình cảm ứng */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" color="text.secondary">
                                            NV: {row.collectorName}
                                        </Typography>

                                        <Stack direction="row" spacing={1}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                color="primary"
                                                startIcon={exportingSingleId === row.id ? <CircularProgress size={14} /> : <PictureAsPdfIcon fontSize="small" />}
                                                disabled={exportingSingleId === row.id}
                                                onClick={() => handleDownloadSinglePdf(row)}
                                                sx={{ py: 0.4, px: 1, fontSize: '12px' }}
                                            >
                                                Tải PDF
                                            </Button>

                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={sharingId === row.id ? <CircularProgress size={14} color="inherit" /> : <ShareIcon fontSize="small" />}
                                                disabled={sharingId === row.id}
                                                onClick={() => handleShareZalo(row)}
                                                sx={{ bgcolor: '#0068ff', '&:hover': { bgcolor: '#0055d4' }, py: 0.4, px: 1, fontSize: '12px' }}
                                            >
                                                Zalo
                                            </Button>

                                            <IconButton 
                                                size="small" 
                                                color="error"
                                                onClick={() => handleDeleteSingle(row)}
                                                title="Xóa khách hàng"
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </Box>
            ) : (
                /* GIAO DIỆN DESKTOP: Bảng chi tiết */
                <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 'calc(100vh - 270px)' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ width: 50 }}><b>STT</b></TableCell>
                                    <TableCell><b>Khách Hàng</b></TableCell>
                                    <TableCell><b>Thuê Bao</b></TableCell>
                                    <TableCell><b>Địa Chỉ</b></TableCell>
                                    <TableCell><b>Dịch Vụ & Tháng</b></TableCell>
                                    <TableCell align="right"><b>Số Tiền</b></TableCell>
                                    <TableCell><b>Bằng Chữ</b></TableCell>
                                    <TableCell><b>Nhân Viên</b></TableCell>
                                    <TableCell align="center" sx={{ minWidth: 120 }}><b>Thao Tác</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                                            {data.length === 0 
                                                ? 'Chưa có dữ liệu. Vui lòng tải file mẫu và nhập liệu từ Excel.' 
                                                : 'Không tìm thấy khách hàng nào khớp với từ khóa tìm kiếm.'}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredData.map((row, index) => (
                                        <TableRow hover key={row.id}>
                                            <TableCell align="center">{index + 1}</TableCell>
                                            <TableCell sx={{ fontWeight: 600 }}>{row.customerName}</TableCell>
                                            <TableCell sx={{ fontFamily: 'monospace' }}>{row.phone}</TableCell>
                                            <TableCell sx={{ maxWidth: 260 }}>{row.address}</TableCell>
                                            <TableCell>{row.serviceMonth}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: '#ee0033' }}>
                                                {row.amount} đ
                                            </TableCell>
                                            <TableCell sx={{ fontStyle: 'italic', fontSize: '13px' }}>{row.amountInWords}</TableCell>
                                            <TableCell>{row.collectorName}</TableCell>
                                            <TableCell align="center">
                                                <Stack direction="row" spacing={0.5} justifyContent="center">
                                                    {/* Nút tải PDF đơn lẻ */}
                                                    <Tooltip title="Tải file PDF đơn lẻ" arrow>
                                                        <span>
                                                            <IconButton 
                                                                size="small" 
                                                                color="primary"
                                                                disabled={exportingSingleId === row.id}
                                                                onClick={() => handleDownloadSinglePdf(row)}
                                                            >
                                                                {exportingSingleId === row.id ? (
                                                                    <CircularProgress size={18} />
                                                                ) : (
                                                                    <PictureAsPdfIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>

                                                    {/* Nút chia sẻ qua Zalo */}
                                                    <Tooltip title="Chia sẻ thông báo cước qua Zalo" arrow>
                                                        <span>
                                                            <IconButton 
                                                                size="small" 
                                                                sx={{ color: '#0068ff' }}
                                                                disabled={sharingId === row.id}
                                                                onClick={() => handleShareZalo(row)}
                                                            >
                                                                {sharingId === row.id ? (
                                                                    <CircularProgress size={18} />
                                                                ) : (
                                                                    <ShareIcon fontSize="small" />
                                                                )}
                                                            </IconButton>
                                                        </span>
                                                    </Tooltip>

                                                    {/* Nút xóa đơn lẻ khách hàng */}
                                                    <Tooltip title="Xóa khách hàng này" arrow>
                                                        <IconButton 
                                                            size="small" 
                                                            color="error"
                                                            onClick={() => handleDeleteSingle(row)}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}

            {/* Kept offscreen rather than display:none so html2canvas can create an A5 PDF and QR Card Image. */}
            <Box className="bill-print-container" sx={{ position: 'fixed', left: '-10000px', top: 0, width: '210mm', bgcolor: '#fff', pointerEvents: 'none', zIndex: -1 }}>
                <div ref={printRef}>
                    {data.map((item) => (
                        <div key={item.id} data-bill-page="true" data-bill-id={item.id} className="bill-page-item" style={{ width: '210mm', height: '148mm', overflow: 'hidden', background: '#fff', boxSizing: 'border-box' }}>
                            <BillTemplateA5 data={item} />
                        </div>
                    ))}
                </div>
                <div ref={qrCardRef}>
                    {data.map((item) => (
                        <div key={item.id} data-qr-card-id={item.id} style={{ width: '420px', height: '264px', background: 'transparent', display: 'inline-block' }}>
                            <BankQrCard data={item} />
                        </div>
                    ))}
                </div>
            </Box>
        </Box>
    );
};

export default PrintBillNotification;
