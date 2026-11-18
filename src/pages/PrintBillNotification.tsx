import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
    Box, Typography, Button, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, 
    Stack, Alert, CircularProgress, IconButton, TextField, 
    InputAdornment, Tooltip, Card, CardContent, Divider,
    useMediaQuery, useTheme, Chip, TablePagination,
    Dialog, DialogTitle, DialogContent, DialogActions,
    LinearProgress, Menu, MenuItem
} from '@mui/material';
import { 
    Download as DownloadIcon, 
    Upload as UploadIcon, 
    Print as PrintIcon, 
    Delete as DeleteIcon,
    Search as SearchIcon,
    Share as ShareIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    Payment as PaymentIcon,
    Refresh as RefreshIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    CheckCircle as SuccessIcon,
    ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import ExcelJS from 'exceljs';
import { useReactToPrint } from 'react-to-print';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import BillTemplateA5 from '../components/BillTemplateA5';
import type { BillData } from '../components/BillTemplateA5';
import BankQrCard from '../components/BankQrCard';
import { parseExcelNumber, numberToWordsVN, formatNumber } from '../utils/numberUtils';
import { toTitleCase } from '../utils/format';
import { supabase } from '../config/supabase';

const STORAGE_KEY = 'PRINT_BILL_NOTIFICATION_DATA';
const DB_STATUS_TAG = 'bill_notification_item';

// Giới hạn lưu cache local an toàn chống tràn bộ nhớ (QuotaExceededError) trên mobile
const safeSaveLocalStorage = (key: string, list: BillData[]) => {
    try {
        if (!list || list.length === 0) {
            localStorage.removeItem(key);
            return;
        }
        // Chỉ lưu tối đa 50 item để làm preview offline, tránh tràn hạn mức 5MB của trình duyệt
        const previewList = list.slice(0, 50);
        localStorage.setItem(key, JSON.stringify(previewList));
    } catch (e) {
        console.warn('LocalStorage đã đầy hoặc không được phép ghi:', e);
        try { localStorage.removeItem(key); } catch (_) {}
    }
};

const PrintBillNotification: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    // Khởi tạo state data từ cache an toàn
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
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Tiến trình import Excel lên đám mây
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number; message: string } | null>(null);

    // Phân trang
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    // Thao tác đơn lẻ (Render On-Demand, KHÔNG render ngầm hàng ngàn bản ghi)
    const [exportingSingleId, setExportingSingleId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);
    const [activeQrItem, setActiveQrItem] = useState<BillData | null>(null);
    const [activePdfItem, setActivePdfItem] = useState<BillData | null>(null);

    // In ấn & Xuất PDF hàng loạt
    const [itemsToPrint, setItemsToPrint] = useState<BillData[]>([]);
    const [printMenuAnchor, setPrintMenuAnchor] = useState<null | HTMLElement>(null);
    const [pdfMenuAnchor, setPdfMenuAnchor] = useState<null | HTMLElement>(null);
    
    // Tiến trình xuất PDF
    const [exportingPdf, setExportingPdf] = useState(false);
    const [pdfExportProgress, setPdfExportProgress] = useState<{ current: number; total: number } | null>(null);
    const cancelPdfExportRef = useRef(false);

    // Refs
    const printRef = useRef<HTMLDivElement>(null);
    const singleQrContainerRef = useRef<HTMLDivElement>(null);
    const singlePdfContainerRef = useRef<HTMLDivElement>(null);
    const qrImageCacheRef = useRef<Map<string, { blob: Blob; fileName: string }>>(new Map());

    // Mẫu branch config mặc định
    const branchConfig = useMemo(() => ({
        branchName: 'VIETTEL QUẬN 12',
        branchAddress: '50 TRƯƠNG THỊ HOA PHƯỜNG TÂN THỚI HIỆP Q12',
        branchContact: 'ĐT- ZALO 0979 092 604 – 0987 268 794',
        branchServices: 'THU CƯỚC –LẮP ĐẶT INTERNET – SIM SỐ ĐẸP'
    }), []);

    // Tải toàn bộ dữ liệu từ Database Supabase (Hỗ trợ phân trang vượt qua giới hạn 1,000 dòng mặc định)
    const fetchBillsFromDatabase = useCallback(async (silent = false) => {
        try {
            if (!silent) setSyncingDb(true);
            setError(null);

            let allRecords: any[] = [];
            let from = 0;
            const PAGE_SIZE = 1000;
            let hasMore = true;

            // Vòng lặp tải từng đợt 1000 dòng cho tới khi hết sạch toàn bộ dữ liệu
            while (hasMore) {
                const { data: records, error: dbError } = await supabase
                    .from('zalo_notification_logs')
                    .select('params, error_message, created_at')
                    .eq('status', DB_STATUS_TAG)
                    .order('created_at', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1);

                if (dbError) {
                    console.error('Lỗi khi tải danh sách từ database:', dbError);
                    setError('Không thể kết nối cơ sở dữ liệu để tải danh sách: ' + dbError.message);
                    break;
                }

                if (records && records.length > 0) {
                    allRecords = allRecords.concat(records);
                    if (records.length < PAGE_SIZE) {
                        hasMore = false;
                    } else {
                        from += PAGE_SIZE;
                    }
                } else {
                    hasMore = false;
                }
            }

            if (allRecords.length > 0) {
                const loadedBills: BillData[] = allRecords
                    .map(r => r.params as BillData)
                    .filter((item): item is BillData => !!item && !!item.customerName);

                setData(loadedBills);
                safeSaveLocalStorage(STORAGE_KEY, loadedBills);
            } else {
                setData([]);
                safeSaveLocalStorage(STORAGE_KEY, []);
            }
        } catch (err: any) {
            console.error('Lỗi khi kết nối database:', err);
            setError('Lỗi khi tải dữ liệu từ máy chủ.');
        } finally {
            if (!silent) setSyncingDb(false);
        }
    }, []);

    // Tự động tải từ Database khi mở màn hình
    useEffect(() => {
        fetchBillsFromDatabase();
    }, [fetchBillsFromDatabase]);

    // Tải file Excel mẫu
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

    // Nhập file Excel (Đã tối ưu chia batch 100 dòng & an toàn chống tràn bộ nhớ)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);
        setSuccessMessage(null);
        setUploadProgress({ current: 0, total: 0, message: 'Đang đọc và phân tích file Excel...' });

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
                    id: Math.random().toString(36).substring(2, 11),
                    customerName: toTitleCase(getVal(1)),
                    address: getVal(2),
                    phone: getVal(3),
                    serviceMonth: toTitleCase(getVal(4)),
                    amount: formatNumber(parsedAmountNum),
                    amountInWords: numberToWordsVN(parsedAmountNum),
                    dateString: getVal(6),
                    collectorName: toTitleCase(getVal(7)),
                    collectorPhone: getVal(8),
                    ...branchConfig
                });
            });

            if (parsedData.length === 0) {
                throw new Error('File Excel không có dữ liệu khách hàng hợp lệ.');
            }

            // Cập nhật State giao diện ngay lập tức
            setData(parsedData);
            setPage(0);
            safeSaveLocalStorage(STORAGE_KEY, parsedData);
            qrImageCacheRef.current.clear(); // Xóa cache ảnh cũ

            // Đồng bộ lên Supabase Database theo từng batch 100 bản ghi
            setUploadProgress({
                current: 0,
                total: parsedData.length,
                message: `Đã đọc ${parsedData.length} khách hàng. Đang chuẩn bị đồng bộ lên đám mây...`
            });

            // Xóa dữ liệu cũ
            const { error: delErr } = await supabase.from('zalo_notification_logs').delete().eq('status', DB_STATUS_TAG);
            if (delErr) {
                console.warn('Lỗi khi dọn dữ liệu cũ:', delErr);
            }

            const dbPayload = parsedData.map(item => ({
                id: crypto.randomUUID ? crypto.randomUUID() : (Math.random().toString(36).substring(2) + Date.now().toString(36)),
                recipient_phone: item.phone || '',
                status: DB_STATUS_TAG,
                error_message: item.id,
                params: item
            }));

            const BATCH_SIZE = 100;
            for (let i = 0; i < dbPayload.length; i += BATCH_SIZE) {
                const chunk = dbPayload.slice(i, i + BATCH_SIZE);
                const { error: insertErr } = await supabase.from('zalo_notification_logs').insert(chunk);
                if (insertErr) {
                    throw new Error(`Lỗi đồng bộ đám mây tại dòng ${i + 1}: ${insertErr.message}`);
                }
                const processed = Math.min(i + BATCH_SIZE, dbPayload.length);
                setUploadProgress({
                    current: processed,
                    total: dbPayload.length,
                    message: `Đang đồng bộ cơ sở dữ liệu: ${processed} / ${dbPayload.length} khách hàng...`
                });
            }

            setSuccessMessage(`Nhập thành công ${parsedData.length} khách hàng và đã đồng bộ lên hệ thống!`);
        } catch (err: any) {
            console.error('Lỗi khi import file Excel:', err);
            setError(err.message || 'Lỗi khi đọc file Excel. Vui lòng đảm bảo đúng định dạng mẫu.');
        } finally {
            setLoading(false);
            setUploadProgress(null);
            e.target.value = '';
        }
    };

    // react-to-print hook cấu hình chuẩn
    const reactToPrintFn = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'In_Thong_Bao_Cuoc',
        onAfterPrint: () => {
            setItemsToPrint([]);
        },
        onPrintError: () => {
            setItemsToPrint([]);
        },
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

    // Kích hoạt In ấn
    const startPrint = (list: BillData[]) => {
        setPrintMenuAnchor(null);
        if (!list || list.length === 0) return;
        setItemsToPrint(list);
        setTimeout(() => {
            reactToPrintFn();
        }, 120);
    };

    // Tạo file PDF cho 1 khách hàng cụ thể (On-Demand, chỉ mount 1 element duy nhất)
    const generateSinglePdf = async (billItem: BillData): Promise<{ blob: Blob; fileName: string }> => {
        setActivePdfItem(billItem);
        // Chờ DOM mount và vẽ xong
        await new Promise(r => setTimeout(r, 80));

        const billEl = singlePdfContainerRef.current;
        if (!billEl) {
            setActivePdfItem(null);
            throw new Error('Không thể khởi tạo vùng in hóa đơn.');
        }

        try {
            const canvas = await html2canvas(billEl, {
                scale: 1.5,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                removeContainer: true,
                windowWidth: billEl.scrollWidth || 794,
                windowHeight: billEl.scrollHeight || 559,
            });

            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5', compress: false });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 210, 148.5, undefined, 'FAST');
            
            const cleanName = (billItem.customerName || 'KH').trim().replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_');
            const fileName = `Thong_Bao_Cuoc_${cleanName}_${billItem.phone || ''}.pdf`;
            const blob = pdf.output('blob');
            return { blob, fileName };
        } finally {
            setActivePdfItem(null); // Giải phóng RAM ngay
        }
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

    // Tạo file ảnh thẻ QR Ngân Hàng sắc nét (On-Demand, chỉ mount 1 canvas duy nhất khi bấm)
    const generateQrCardImage = async (billItem: BillData): Promise<{ blob: Blob; fileName: string }> => {
        // Kiểm tra bộ nhớ cache
        const cached = qrImageCacheRef.current.get(billItem.id);
        if (cached) return cached;

        setActiveQrItem(billItem);
        // Chờ canvas QR code render xong
        await new Promise(r => setTimeout(r, 80));

        const cardEl = singleQrContainerRef.current;
        if (!cardEl) {
            setActiveQrItem(null);
            throw new Error('Không thể khởi tạo phần tử thẻ QR.');
        }

        try {
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

            const result = { blob, fileName };
            qrImageCacheRef.current.set(billItem.id, result);
            return result;
        } finally {
            setActiveQrItem(null); // Giải phóng canvas khỏi RAM ngay lập tức
        }
    };

    // Chia sẻ thông báo cước + ảnh thẻ mã QR qua Zalo
    const handleShareZalo = async (billItem: BillData) => {
        setSharingId(billItem.id);
        setError(null);

        const shareText = `Kính gửi Quý khách ${toTitleCase(billItem.customerName)},\nViettel xin gửi Thông báo cước dịch vụ:\n- Thuê bao: ${billItem.phone}\n- Kỳ cước: ${toTitleCase(billItem.serviceMonth)}\n- Số tiền cần thanh toán: ${billItem.amount} đ\nTrân trọng cảm ơn Quý khách!`;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareText).catch(() => {});
        }

        try {
            const { blob, fileName } = await generateQrCardImage(billItem);
            const imageFile = new File([blob], fileName, { type: 'image/png' });

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

    // Xuất PDF hàng loạt an toàn theo từng trang với thanh tiến trình
    const exportBatchPdf = async (listToExport: BillData[]) => {
        setPdfMenuAnchor(null);
        if (!listToExport || listToExport.length === 0) return;

        setExportingPdf(true);
        setError(null);
        cancelPdfExportRef.current = false;
        setPdfExportProgress({ current: 0, total: listToExport.length });

        try {
            const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5', compress: true });

            for (let i = 0; i < listToExport.length; i++) {
                if (cancelPdfExportRef.current) {
                    throw new Error('Đã hủy xuất PDF.');
                }

                const item = listToExport[i];
                setActivePdfItem(item);
                await new Promise(r => setTimeout(r, 60));

                const billEl = singlePdfContainerRef.current;
                if (!billEl) continue;

                const canvas = await html2canvas(billEl, {
                    scale: 1.3,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    removeContainer: true,
                    windowWidth: billEl.scrollWidth || 794,
                    windowHeight: billEl.scrollHeight || 559,
                });

                if (i > 0) pdf.addPage('a5', 'landscape');
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.8), 'JPEG', 0, 0, 210, 148.5, undefined, 'FAST');

                setPdfExportProgress({ current: i + 1, total: listToExport.length });

                // Nhường luồng cho UI thở
                await new Promise(r => setTimeout(r, 10));
            }

            setActivePdfItem(null);
            pdf.save(`Thong_bao_cuoc_${listToExport.length}_khach_hang_${new Date().toISOString().slice(0, 10)}.pdf`);
            setSuccessMessage(`Đã xuất thành công file PDF gồm ${listToExport.length} thông báo cước!`);
        } catch (err: any) {
            setActivePdfItem(null);
            if (err.message !== 'Đã hủy xuất PDF.') {
                console.error('Lỗi xuất PDF:', err);
                setError(err.message || 'Không thể xuất file PDF.');
            }
        } finally {
            setExportingPdf(false);
            setPdfExportProgress(null);
        }
    };

    // Xóa toàn bộ danh sách
    const clearData = async () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách? Thao tác này sẽ xóa dữ liệu trên cả máy tính và điện thoại.')) {
            setData([]);
            safeSaveLocalStorage(STORAGE_KEY, []);
            qrImageCacheRef.current.clear();
            try {
                await supabase.from('zalo_notification_logs').delete().eq('status', DB_STATUS_TAG);
                setSuccessMessage('Đã xóa toàn bộ dữ liệu thành công.');
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
                safeSaveLocalStorage(STORAGE_KEY, next);
                return next;
            });
            qrImageCacheRef.current.delete(billItem.id);

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

    // Lọc danh sách theo từ khóa tìm kiếm
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

    // Dữ liệu cho trang hiện tại (Tránh render ngàn phần tử vào DOM)
    const paginatedData = useMemo(() => {
        const start = page * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    const totalPages = Math.ceil(filteredData.length / rowsPerPage) || 1;

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
                    
                    {/* Menu In ấn */}
                    <Button
                        variant="contained"
                        color="secondary"
                        size={isMobile ? "small" : "medium"}
                        startIcon={<PrintIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        disabled={data.length === 0}
                        onClick={(e) => setPrintMenuAnchor(e.currentTarget)}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        In {data.length > 0 ? `(${data.length})` : ''}
                    </Button>
                    <Menu
                        anchorEl={printMenuAnchor}
                        open={Boolean(printMenuAnchor)}
                        onClose={() => setPrintMenuAnchor(null)}
                    >
                        <MenuItem onClick={() => startPrint(paginatedData)}>
                            In trang hiện tại ({paginatedData.length} khách hàng)
                        </MenuItem>
                        <MenuItem onClick={() => startPrint(filteredData)}>
                            In tất cả ({filteredData.length} khách hàng)
                        </MenuItem>
                    </Menu>

                    {/* Menu Xuất PDF */}
                    <Button
                        variant="contained"
                        color="error"
                        size={isMobile ? "small" : "medium"}
                        startIcon={exportingPdf ? <CircularProgress size={18} color="inherit" /> : <PictureAsPdfIcon />}
                        endIcon={<ArrowDropDownIcon />}
                        disabled={data.length === 0 || exportingPdf}
                        onClick={(e) => setPdfMenuAnchor(e.currentTarget)}
                        sx={{ fontSize: { xs: '12px', sm: '14px' }, py: { xs: 0.8, sm: 0.7 } }}
                    >
                        {exportingPdf ? 'Đang xuất...' : `Xuất PDF (${data.length})`}
                    </Button>
                    <Menu
                        anchorEl={pdfMenuAnchor}
                        open={Boolean(pdfMenuAnchor)}
                        onClose={() => setPdfMenuAnchor(null)}
                    >
                        <MenuItem onClick={() => exportBatchPdf(paginatedData)}>
                            Xuất PDF trang hiện tại ({paginatedData.length} khách hàng)
                        </MenuItem>
                        <MenuItem onClick={() => exportBatchPdf(filteredData)}>
                            Xuất PDF tất cả ({filteredData.length} khách hàng)
                        </MenuItem>
                    </Menu>
                    
                    {data.length > 0 && !isMobile && (
                        <IconButton color="error" onClick={clearData} title="Xóa toàn bộ danh sách">
                            <DeleteIcon />
                        </IconButton>
                    )}
                </Box>
            </Box>

            {/* Thông báo tiến trình Import Excel */}
            {uploadProgress && (
                <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.paper', borderRadius: 2 }}>
                    <Stack spacing={1}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {uploadProgress.message}
                            </Typography>
                            {uploadProgress.total > 0 && (
                                <Typography variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                                    {Math.round((uploadProgress.current / uploadProgress.total) * 100)}%
                                </Typography>
                            )}
                        </Box>
                        <LinearProgress 
                            variant={uploadProgress.total > 0 ? "determinate" : "indeterminate"} 
                            value={uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0} 
                            sx={{ height: 8, borderRadius: 4 }}
                        />
                    </Stack>
                </Paper>
            )}

            {/* Thông báo Lỗi / Thành công */}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {successMessage && (
                <Alert severity="success" icon={<SuccessIcon />} sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
                    {successMessage}
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
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(0);
                        }}
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
                        {filteredData.length > rowsPerPage && (
                            <span> (Trang {page + 1}/{totalPages})</span>
                        )}
                    </Typography>
                </Box>
            )}

            {/* GIAO DIỆN MOBILE: Card List phân trang mượt mà (Chỉ render 25-50 card/trang, tuyệt đối không crash) */}
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
                        paginatedData.map((row, index) => {
                            const globalIndex = page * rowsPerPage + index + 1;
                            return (
                                <Card key={row.id} variant="outlined" sx={{ borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        {/* Hàng trên: STT + Tên KH + Số tiền */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip label={globalIndex} size="small" sx={{ height: 20, fontSize: '11px', fontWeight: 'bold' }} />
                                                <Typography sx={{ fontWeight: 'bold', fontSize: '15px' }}>
                                                    {toTitleCase(row.customerName)}
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
                                                <span>Thuê bao: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '14px' }}>{row.phone}</Box></span>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                <LocationIcon sx={{ fontSize: 15, color: 'text.secondary', mt: 0.3 }} />
                                                <span style={{ lineHeight: 1.25 }}>{row.address}</span>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <PaymentIcon sx={{ fontSize: 15, color: '#10b981' }} />
                                                <span>{toTitleCase(row.serviceMonth)}</span>
                                            </Box>
                                        </Stack>

                                        <Divider sx={{ mb: 1 }} />

                                        {/* Hàng dưới: Nút bấm lớn dễ chạm */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="caption" color="text.secondary">
                                                NV: {toTitleCase(row.collectorName)}
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
                                                    sx={{ 
                                                        bgcolor: '#0068ff', 
                                                        '&:hover': { bgcolor: '#0055d4' }, 
                                                        py: 0.6, 
                                                        px: 1.5, 
                                                        fontSize: '12.5px',
                                                        fontWeight: 600,
                                                        touchAction: 'manipulation',
                                                        minHeight: '36px',
                                                        boxShadow: '0 2px 6px rgba(0, 104, 255, 0.3)'
                                                    }}
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
                            );
                        })
                    )}

                    {/* Thanh điều hướng phân trang Mobile */}
                    {filteredData.length > rowsPerPage && (
                        <Paper sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 2 }}>
                            <Button 
                                size="small" 
                                startIcon={<PrevIcon />}
                                disabled={page === 0}
                                onClick={() => setPage(p => Math.max(0, p - 1))}
                            >
                                Trước
                            </Button>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                Trang {page + 1} / {totalPages}
                            </Typography>
                            <Button 
                                size="small" 
                                endIcon={<NextIcon />}
                                disabled={page >= totalPages - 1}
                                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            >
                                Sau
                            </Button>
                        </Paper>
                    )}
                </Box>
            ) : (
                /* GIAO DIỆN DESKTOP: Bảng phân trang mượt mà */
                <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
                    <TableContainer sx={{ maxHeight: 'calc(100vh - 320px)' }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ width: 60 }}><b>STT</b></TableCell>
                                    <TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}><b>Khách Hàng</b></TableCell>
                                    <TableCell sx={{ minWidth: 160, whiteSpace: 'nowrap' }}><b>Thuê Bao</b></TableCell>
                                    <TableCell sx={{ minWidth: 240 }}><b>Địa Chỉ</b></TableCell>
                                    <TableCell sx={{ minWidth: 190, whiteSpace: 'nowrap' }}><b>Dịch Vụ & Tháng</b></TableCell>
                                    <TableCell align="right" sx={{ minWidth: 110, whiteSpace: 'nowrap' }}><b>Số Tiền</b></TableCell>
                                    <TableCell sx={{ minWidth: 200 }}><b>Bằng Chữ</b></TableCell>
                                    <TableCell sx={{ minWidth: 150, whiteSpace: 'nowrap' }}><b>Nhân Viên</b></TableCell>
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
                                    paginatedData.map((row, index) => {
                                        const globalIndex = page * rowsPerPage + index + 1;
                                        return (
                                            <TableRow hover key={row.id}>
                                                <TableCell align="center">{globalIndex}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                    {toTitleCase(row.customerName)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    {row.phone}
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 300, fontSize: '14px' }}>
                                                    {row.address}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '14px' }}>
                                                    {toTitleCase(row.serviceMonth)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700, color: '#ee0033', fontSize: '14.5px', whiteSpace: 'nowrap' }}>
                                                    {row.amount} đ
                                                </TableCell>
                                                <TableCell sx={{ fontStyle: 'italic', fontSize: '13.5px' }}>
                                                    {row.amountInWords}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '14px', whiteSpace: 'nowrap' }}>
                                                    {toTitleCase(row.collectorName)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    <Stack direction="row" spacing={0.5} justifyContent="center">
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
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination Bar Desktop */}
                    <TablePagination
                        rowsPerPageOptions={[25, 50, 100, 200]}
                        component="div"
                        count={filteredData.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        labelRowsPerPage="Số dòng/trang:"
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count !== -1 ? count : `hơn ${to}`}`}
                    />
                </Paper>
            )}

            {/* Dialog Tiến trình Xuất PDF */}
            <Dialog open={exportingPdf} disableEscapeKeyDown>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Đang tạo file PDF...</DialogTitle>
                <DialogContent sx={{ minWidth: { xs: 280, sm: 380 } }}>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                            Đang xử lý trang {pdfExportProgress?.current || 0} / {pdfExportProgress?.total || 0}...
                        </Typography>
                        <LinearProgress 
                            variant="determinate" 
                            value={pdfExportProgress?.total ? ((pdfExportProgress.current / pdfExportProgress.total) * 100) : 0} 
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button 
                        color="error" 
                        onClick={() => {
                            cancelPdfExportRef.current = true;
                        }}
                    >
                        Hủy
                    </Button>
                </DialogActions>
            </Dialog>

            {/* VÙNG RENDER ẨN TỐI ƯU SIÊU NHẸ (Chỉ mount khi người dùng thao tác, KHÔNG BAO GIỜ mount 1500 items ngầm) */}
            <div 
                style={{ 
                    position: 'fixed', 
                    left: '-9999px', 
                    top: '-9999px', 
                    width: '1px', 
                    height: '1px', 
                    overflow: 'hidden', 
                    opacity: 0, 
                    pointerEvents: 'none', 
                    zIndex: -9999 
                }}
            >
                {/* 1. Thẻ QR Ngân hàng MBBank đơn lẻ: Chỉ mount 1 canvas duy nhất khi bấm nút Zalo */}
                {activeQrItem && (
                    <div ref={singleQrContainerRef} style={{ width: '420px', height: '264px', background: 'transparent', display: 'inline-block' }}>
                        <BankQrCard data={activeQrItem} />
                    </div>
                )}

                {/* 2. Hóa đơn A5 đơn lẻ: Chỉ mount 1 element duy nhất khi bấm tải PDF đơn lẻ */}
                {activePdfItem && (
                    <div ref={singlePdfContainerRef} style={{ width: '210mm', height: '148mm', overflow: 'hidden', background: '#fff', boxSizing: 'border-box' }}>
                        <BillTemplateA5 data={activePdfItem} />
                    </div>
                )}

                {/* 3. Vùng In ấn: Chỉ mount khi người dùng bấm xác nhận In */}
                {itemsToPrint.length > 0 && (
                    <div ref={printRef} className="bill-print-container">
                        {itemsToPrint.map((item) => (
                            <div key={item.id} data-bill-page="true" className="bill-page-item" style={{ width: '210mm', height: '148mm', overflow: 'hidden', background: '#fff', boxSizing: 'border-box' }}>
                                <BillTemplateA5 data={item} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Box>
    );
};

export default PrintBillNotification;
