import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { 
    Box, Typography, Button, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, 
    Stack, Alert, CircularProgress, IconButton, TextField, 
    InputAdornment, Tooltip, Card, CardContent, Divider,
    useMediaQuery, useTheme, Chip, TablePagination,
    Dialog, DialogTitle, DialogContent, DialogActions,
    LinearProgress, Menu, MenuItem, TableSortLabel
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
    ContactPhone as ContactPhoneIcon,
    Sms as SmsIcon,
    LocationOn as LocationIcon,
    Payment as PaymentIcon,
    Refresh as RefreshIcon,
    NavigateBefore as PrevIcon,
    NavigateNext as NextIcon,
    CheckCircle as SuccessIcon,
    ArrowDropDown as ArrowDropDownIcon,
    FileDownload as FileDownloadIcon
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

    // Phân trang & Sắp xếp
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    // Thao tác đơn lẻ (Render On-Demand, KHÔNG render ngầm hàng ngàn bản ghi)
    const [exportingSingleId, setExportingSingleId] = useState<string | null>(null);
    const [sharingId, setSharingId] = useState<string | null>(null);
    const [activeQrItem, setActiveQrItem] = useState<BillData | null>(null);
    const [activePdfItem, setActivePdfItem] = useState<BillData | null>(null);

    // In ấn, Xuất PDF & Xuất Excel hàng loạt
    const [itemsToPrint, setItemsToPrint] = useState<BillData[]>([]);
    const [printMenuAnchor, setPrintMenuAnchor] = useState<null | HTMLElement>(null);
    const [pdfMenuAnchor, setPdfMenuAnchor] = useState<null | HTMLElement>(null);
    const [excelMenuAnchor, setExcelMenuAnchor] = useState<null | HTMLElement>(null);
    const [exportingExcel, setExportingExcel] = useState(false);
    
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
            { header: 'Thuê Bao', key: 'phone', width: 22 },
            { header: 'Số Liên Hệ', key: 'contactPhone', width: 18 },
            { header: 'Địa Chỉ', key: 'address', width: 40 },
            { header: 'Dịch Vụ & Tháng', key: 'serviceMonth', width: 30 },
            { header: 'Số Tiền', key: 'amount', width: 15 },
            { header: 'Ngày In', key: 'dateString', width: 25 },
            { header: 'Nhân Viên', key: 'collectorName', width: 20 },
            { header: 'SĐT NV', key: 'collectorPhone', width: 15 },
        ];

        worksheet.addRow({
            customerName: 'Nguyễn Thụy Ngọc Thanh',
            phone: 't008_gftth_thanhntn232',
            contactPhone: '0979092604',
            address: '118/8 HT43 P. Hiệp Thành Q.12 TPHCM',
            serviceMonth: 'Dịch Vụ Viễn Thông Tháng 10/2026',
            amount: '250.000 đ',
            dateString: 'TP. HCM, ngày 10 tháng 10 năm 2026',
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

    // Nhập file Excel (Hỗ trợ tự động nhận diện cột linh hoạt & chia batch 100 dòng an toàn)
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
            
            // Quét tìm vị trí cột dựa trên tiêu đề ở dòng 1
            const normalizeHeader = (str: string) => {
                return (str || '')
                    .toLowerCase()
                    .replace(/đ/g, 'd')
                    .replace(/Đ/g, 'd')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]/g, '');
            };

            const isPhoneKeyword = (h: string) => 
                h.includes('sdt') || h.includes('dienthoai') || h.includes('phone') || h.includes('mobile') || h.includes('tel');

            const headerMap: { [key: string]: number } = {};
            const firstRow = worksheet.getRow(1);
            firstRow.eachCell((cell, colNumber) => {
                const headerVal = normalizeHeader(cell.value ? cell.value.toString() : '');
                if (!headerVal) return;

                // 1. Tên Khách Hàng
                if (headerVal.includes('khachhang') || headerVal.includes('tenkh') || headerVal.includes('hoten') || (headerVal.includes('khach') && !isPhoneKeyword(headerVal))) {
                    headerMap.customerName = colNumber;
                } 
                // 2. Thuê Bao (Mã thuê bao / tài khoản đường truyền)
                else if (headerVal.includes('thuebao') || headerVal.includes('mathuebao') || headerVal.includes('taikhoan') || headerVal.includes('account')) {
                    headerMap.phone = colNumber;
                } 
                // 3. Nhân Viên (Phân tách rõ Tên nhân viên vs SĐT nhân viên)
                else if (headerVal.includes('nhanvien') || headerVal.includes('thungan') || headerVal === 'nv' || headerVal.includes('nvthu')) {
                    if (isPhoneKeyword(headerVal)) {
                        headerMap.collectorPhone = colNumber;
                    } else {
                        headerMap.collectorName = colNumber;
                    }
                }
                // 4. SĐT NV khi viết tắt sdtnv, phonenv, dtnv...
                else if (headerVal.includes('sdtnv') || headerVal.includes('dtnv') || headerVal.includes('phonenv') || headerVal.includes('dienthoainv')) {
                    headerMap.collectorPhone = colNumber;
                }
                // 5. Số liên hệ của khách hàng
                else if (headerVal.includes('lienhe') || headerVal.includes('sdtkh') || headerVal.includes('dienthoaikh') || headerVal.includes('contact')) {
                    headerMap.contactPhone = colNumber;
                } 
                // 6. Địa Chỉ
                else if (headerVal.includes('diachi') || headerVal.includes('iachi') || headerVal.includes('address') || headerVal.includes('noio') || headerVal === 'dc' || headerVal === 'dia') {
                    headerMap.address = colNumber;
                } 
                // 7. Dịch Vụ & Kỳ Cước Tháng
                else if (headerVal.includes('dichvu') || headerVal.includes('thang') || headerVal.includes('kycuoc')) {
                    headerMap.serviceMonth = colNumber;
                } 
                // 8. Số Tiền
                else if (headerVal.includes('sotien') || headerVal.includes('tien') || headerVal.includes('cuoc')) {
                    headerMap.amount = colNumber;
                } 
                // 9. Ngày In
                else if (headerVal.includes('ngayin') || headerVal.includes('ngay')) {
                    headerMap.dateString = colNumber;
                } 
                // 10. Bắt trường hợp cột điện thoại dự phòng
                else if (isPhoneKeyword(headerVal)) {
                    if (!headerMap.contactPhone) {
                        headerMap.contactPhone = colNumber;
                    }
                }
            });

            const hasHeaderMapping = !!(headerMap.customerName && (headerMap.amount || headerMap.phone));

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const getVal = (col: number) => {
                    if (col <= 0) return '';
                    const val = row.getCell(col).value;
                    if (val && typeof val === 'object' && 'richText' in val) {
                        return val.richText.map((rt: any) => rt.text).join('').trim();
                    }
                    return val ? val.toString().trim() : '';
                };

                const customerName = hasHeaderMapping && headerMap.customerName 
                    ? getVal(headerMap.customerName) 
                    : getVal(1);
                if (!customerName) return; // Bỏ qua dòng trống

                let address = '';
                let phone = '';
                let contactPhone = '';
                let serviceMonth = '';
                let rawAmount = '';
                let dateString = '';
                let collectorName = '';
                let collectorPhone = '';

                if (hasHeaderMapping) {
                    address = headerMap.address ? getVal(headerMap.address) : '';
                    phone = headerMap.phone ? getVal(headerMap.phone) : '';
                    contactPhone = headerMap.contactPhone ? getVal(headerMap.contactPhone) : '';
                    serviceMonth = headerMap.serviceMonth ? getVal(headerMap.serviceMonth) : '';
                    rawAmount = headerMap.amount ? getVal(headerMap.amount) : '';
                    dateString = headerMap.dateString ? getVal(headerMap.dateString) : '';
                    collectorName = headerMap.collectorName ? getVal(headerMap.collectorName) : '';
                    collectorPhone = headerMap.collectorPhone ? getVal(headerMap.collectorPhone) : '';
                } else {
                    // Fallback theo mẫu cột nếu không nhận diện được tiêu đề
                    const col2 = getVal(2);
                    const looksLikeAddress = (s: string) => /đường|phường|quận|kp|khu phố|ấp|thành phố|tphcm|hcm|p\.|q\./i.test(s);

                    if (looksLikeAddress(col2)) {
                        // Mẫu cũ: 1: Khách Hàng, 2: Địa Chỉ, 3: Thuê Bao...
                        address = col2;
                        phone = getVal(3);
                        if (row.actualCellCount >= 9) {
                            contactPhone = getVal(4);
                            serviceMonth = getVal(5);
                            rawAmount = getVal(6);
                            dateString = getVal(7);
                            collectorName = getVal(8);
                            collectorPhone = getVal(9);
                        } else {
                            contactPhone = '';
                            serviceMonth = getVal(4);
                            rawAmount = getVal(5);
                            dateString = getVal(6);
                            collectorName = getVal(7);
                            collectorPhone = getVal(8);
                        }
                    } else {
                        // Mẫu mới: 1: Khách Hàng, 2: Thuê Bao, 3: Số Liên Hệ, 4: Địa Chỉ...
                        phone = col2;
                        contactPhone = getVal(3);
                        address = getVal(4);
                        serviceMonth = getVal(5);
                        rawAmount = getVal(6);
                        dateString = getVal(7);
                        collectorName = getVal(8);
                        collectorPhone = getVal(9);
                    }
                }

                // Tự động kiểm tra và hoán đổi nếu collectorName nhận nhầm số điện thoại (ví dụ: '0979092604')
                const phonePattern = /^[0-9+() -]{8,15}$/;
                const nameLooksLikePhone = phonePattern.test((collectorName || '').trim());
                const phoneLooksLikeName = (collectorPhone || '').trim().length > 0 && !phonePattern.test((collectorPhone || '').trim());

                if (nameLooksLikePhone && phoneLooksLikeName) {
                    const temp = collectorName;
                    collectorName = collectorPhone;
                    collectorPhone = temp;
                } else if (nameLooksLikePhone && !collectorPhone) {
                    collectorPhone = collectorName;
                    collectorName = '';
                }

                const parsedAmountNum = parseExcelNumber(rawAmount);

                parsedData.push({
                    id: Math.random().toString(36).substring(2, 11),
                    customerName: toTitleCase(customerName),
                    address: address,
                    phone: phone,
                    contactPhone: contactPhone,
                    serviceMonth: toTitleCase(serviceMonth),
                    amount: formatNumber(parsedAmountNum),
                    amountInWords: numberToWordsVN(parsedAmountNum),
                    dateString: dateString,
                    collectorName: toTitleCase(collectorName),
                    collectorPhone: collectorPhone,
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
                recipient_phone: item.contactPhone || item.phone || '',
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

    // Gửi tin nhắn SMS tới Số liên hệ của khách hàng
    const handleSendSms = (billItem: BillData) => {
        setError(null);
        const contact = (billItem.contactPhone || '').trim();
        const fallbackPhone = (billItem.phone || '').trim();
        
        // Kiểm tra xem chuỗi có phải số điện thoại thuần túy không (tránh lấy mã thuê bao dạng chữ)
        const isPhoneNumber = (val: string) => /^[0-9+() -]{6,15}$/.test(val) && !/[a-zA-Z_]/.test(val);
        
        let targetPhone = '';
        if (contact) {
            targetPhone = contact.replace(/[^0-9+]/g, '');
        } else if (isPhoneNumber(fallbackPhone)) {
            targetPhone = fallbackPhone.replace(/[^0-9+]/g, '');
        }

        const displayAmount = billItem.amount?.toLowerCase().includes('đ')
            ? billItem.amount
            : `${billItem.amount} đ`;

        const smsContent = `Kính gửi Quý khách ${toTitleCase(billItem.customerName)},\nViettel xin gửi Thông báo cước dịch vụ:\n- Thuê bao: ${billItem.phone}\n- Kỳ cước: ${toTitleCase(billItem.serviceMonth)}\n- Số tiền cần thanh toán: ${displayAmount}\nTrân trọng cảm ơn Quý khách!`;

        // 1. Luôn sao chép nội dung tin nhắn vào clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(smsContent).catch(() => {});
        }

        if (!targetPhone) {
            setSuccessMessage(`Đã sao chép nội dung tin nhắn của "${toTitleCase(billItem.customerName)}" vào bộ nhớ tạm! (Khách hàng chưa có Số liên hệ)`);
            return;
        }

        // 2. Mở ứng dụng SMS của thiết bị
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const smsUrl = isIOS 
            ? `sms:${targetPhone}&body=${encodeURIComponent(smsContent)}`
            : `sms:${targetPhone}?body=${encodeURIComponent(smsContent)}`;

        try {
            window.location.href = smsUrl;
        } catch (_) {
            window.open(smsUrl, '_self');
        }

        setSuccessMessage(`Đã sao chép nội dung và mở SMS gửi đến ${targetPhone}!`);
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

    // Xuất dữ liệu ra file Excel chuyên nghiệp
    const handleExportExcel = async (listToExport: BillData[]) => {
        setExcelMenuAnchor(null);
        if (!listToExport || listToExport.length === 0) return;

        setExportingExcel(true);
        setError(null);

        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Danh_Sach_Cuoc');

            // Định nghĩa cột
            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Khách Hàng', key: 'customerName', width: 26 },
                { header: 'Thuê Bao', key: 'phone', width: 22 },
                { header: 'Số Liên Hệ', key: 'contactPhone', width: 16 },
                { header: 'Địa Chỉ', key: 'address', width: 40 },
                { header: 'Dịch Vụ & Tháng', key: 'serviceMonth', width: 28 },
                { header: 'Số Tiền', key: 'amount', width: 16 },
                { header: 'Bằng Chữ', key: 'amountInWords', width: 36 },
                { header: 'Ngày In', key: 'dateString', width: 25 },
                { header: 'Nhân Viên', key: 'collectorName', width: 22 },
                { header: 'SĐT NV', key: 'collectorPhone', width: 16 },
            ];

            // Style dòng tiêu đề
            const headerRow = worksheet.getRow(1);
            headerRow.height = 28;
            headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF107C41' } // Màu xanh Excel
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                    right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                };
            });

            // Thêm từng dòng dữ liệu
            listToExport.forEach((item, idx) => {
                const row = worksheet.addRow({
                    stt: idx + 1,
                    customerName: toTitleCase(item.customerName || ''),
                    phone: item.phone || '',
                    contactPhone: item.contactPhone || '',
                    address: item.address || '',
                    serviceMonth: toTitleCase(item.serviceMonth || ''),
                    amount: item.amount ? (item.amount.toLowerCase().includes('đ') ? item.amount : `${item.amount} đ`) : '',
                    amountInWords: item.amountInWords || '',
                    dateString: item.dateString || '',
                    collectorName: toTitleCase(item.collectorName || ''),
                    collectorPhone: item.collectorPhone || ''
                });

                row.height = 22;
                row.font = { name: 'Arial', size: 10 };
                row.alignment = { vertical: 'middle' };

                // Căn lề từng cột
                row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };
                row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };
                row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };
                row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
                row.getCell(11).alignment = { vertical: 'middle', horizontal: 'center' };

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                    };
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            link.download = `Danh_Sach_Cuoc_${listToExport.length}_KH_${dateStr}.xlsx`;
            link.click();
            window.URL.revokeObjectURL(url);

            setSuccessMessage(`Đã xuất thành công file Excel gồm ${listToExport.length} khách hàng!`);
        } catch (err: any) {
            console.error('Lỗi khi xuất file Excel:', err);
            setError(err.message || 'Không thể xuất file Excel.');
        } finally {
            setExportingExcel(false);
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

    // Lọc danh sách theo từ khóa tìm kiếm & Sắp xếp theo tên khách hàng
    const filteredData = useMemo(() => {
        let result = data;
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(item => 
                (item.customerName || '').toLowerCase().includes(term) ||
                (item.phone || '').toLowerCase().includes(term) ||
                (item.contactPhone || '').toLowerCase().includes(term) ||
                (item.address || '').toLowerCase().includes(term) ||
                (item.serviceMonth || '').toLowerCase().includes(term) ||
                (item.amount || '').toLowerCase().includes(term) ||
                (item.collectorName || '').toLowerCase().includes(term)
            );
        }

        if (sortOrder) {
            result = [...result].sort((a, b) => {
                const nameA = (a.customerName || '').trim();
                const nameB = (b.customerName || '').trim();
                const cmp = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
                return sortOrder === 'asc' ? cmp : -cmp;
            });
        }

        return result;
    }, [data, searchTerm, sortOrder]);

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
                    display: 'flex', 
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    justifyContent: { xs: 'stretch', sm: 'flex-end' },
                    '& .MuiButton-root': {
                        height: 38,
                        borderRadius: '8px',
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: { xs: '12.5px', sm: '13.5px' },
                        px: { xs: 1.2, sm: 1.8 },
                        whiteSpace: 'nowrap',
                        boxShadow: 'none',
                    }
                }}>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
                        onClick={handleDownloadTemplate}
                        sx={{
                            borderColor: 'divider',
                            color: 'text.primary',
                            bgcolor: 'background.paper',
                            '&:hover': {
                                bgcolor: 'action.hover',
                                borderColor: 'text.secondary'
                            }
                        }}
                    >
                        Tải File Mẫu
                    </Button>
                    
                    <Button
                        variant="contained"
                        component="label"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <UploadIcon sx={{ fontSize: 18 }} />}
                        sx={{
                            bgcolor: '#2563eb',
                            color: '#fff',
                            '&:hover': { bgcolor: '#1d4ed8' }
                        }}
                    >
                        Nhập Excel
                        <input
                            type="file"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                        />
                    </Button>

                    {/* Menu Xuất Excel */}
                    <Button
                        variant="contained"
                        disabled={data.length === 0 || exportingExcel}
                        startIcon={exportingExcel ? <CircularProgress size={16} color="inherit" /> : <FileDownloadIcon sx={{ fontSize: 18 }} />}
                        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
                        onClick={(e) => setExcelMenuAnchor(e.currentTarget)}
                        sx={{ 
                            bgcolor: '#107c41', 
                            color: '#fff',
                            '&:hover': { bgcolor: '#0e6937' }
                        }}
                    >
                        {exportingExcel ? 'Đang xuất...' : `Xuất Excel ${data.length > 0 ? `(${data.length})` : ''}`}
                    </Button>
                    <Menu
                        anchorEl={excelMenuAnchor}
                        open={Boolean(excelMenuAnchor)}
                        onClose={() => setExcelMenuAnchor(null)}
                    >
                        <MenuItem onClick={() => handleExportExcel(paginatedData)}>
                            Xuất Excel trang hiện tại ({paginatedData.length} khách hàng)
                        </MenuItem>
                        <MenuItem onClick={() => handleExportExcel(filteredData)}>
                            Xuất Excel tất cả ({filteredData.length} khách hàng)
                        </MenuItem>
                    </Menu>
                    
                    {/* Menu In ấn */}
                    <Button
                        variant="contained"
                        disabled={data.length === 0}
                        startIcon={<PrintIcon sx={{ fontSize: 18 }} />}
                        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
                        onClick={(e) => setPrintMenuAnchor(e.currentTarget)}
                        sx={{ 
                            bgcolor: '#475569',
                            color: '#fff',
                            '&:hover': { bgcolor: '#334155' }
                        }}
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
                        disabled={data.length === 0 || exportingPdf}
                        startIcon={exportingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon sx={{ fontSize: 18 }} />}
                        endIcon={<ArrowDropDownIcon sx={{ fontSize: 18 }} />}
                        onClick={(e) => setPdfMenuAnchor(e.currentTarget)}
                        sx={{ 
                            bgcolor: '#ee0033',
                            color: '#fff',
                            '&:hover': { bgcolor: '#cc002d' }
                        }}
                    >
                        {exportingPdf ? 'Đang xuất...' : `Xuất PDF ${data.length > 0 ? `(${data.length})` : ''}`}
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
                        <Tooltip title="Xóa toàn bộ danh sách" arrow>
                            <IconButton 
                                onClick={clearData}
                                sx={{ 
                                    height: 38,
                                    width: 38,
                                    borderRadius: '8px',
                                    color: '#ef4444',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                    bgcolor: 'rgba(239, 68, 68, 0.08)',
                                    '&:hover': {
                                        bgcolor: 'rgba(239, 68, 68, 0.18)',
                                        borderColor: '#ef4444'
                                    }
                                }}
                            >
                                <DeleteIcon sx={{ fontSize: 19 }} />
                            </IconButton>
                        </Tooltip>
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
                        placeholder="Tìm tên khách hàng, thuê bao, số liên hệ, số tiền..."
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
                                            {row.contactPhone && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <ContactPhoneIcon sx={{ fontSize: 15, color: '#0284c7' }} />
                                                    <span>Số liên hệ: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600, fontSize: '14px' }}>{row.contactPhone}</Box></span>
                                                </Box>
                                            )}
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
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                            <Typography variant="caption" color="text.secondary">
                                                NV: {toTitleCase(row.collectorName)}
                                            </Typography>

                                            <Stack direction="row" spacing={0.8} alignItems="center">
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    color="primary"
                                                    startIcon={exportingSingleId === row.id ? <CircularProgress size={14} /> : <PictureAsPdfIcon fontSize="small" />}
                                                    disabled={exportingSingleId === row.id}
                                                    onClick={() => handleDownloadSinglePdf(row)}
                                                    sx={{ py: 0.4, px: 0.9, fontSize: '11.5px' }}
                                                >
                                                    PDF
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
                                                        py: 0.5, 
                                                        px: 1.1, 
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        touchAction: 'manipulation',
                                                        minHeight: '34px',
                                                        boxShadow: '0 2px 6px rgba(0, 104, 255, 0.3)'
                                                    }}
                                                >
                                                    Zalo
                                                </Button>

                                                <Button
                                                    variant="contained"
                                                    size="small"
                                                    startIcon={<SmsIcon fontSize="small" />}
                                                    onClick={() => handleSendSms(row)}
                                                    sx={{ 
                                                        bgcolor: '#10b981', 
                                                        '&:hover': { bgcolor: '#059669' }, 
                                                        py: 0.5, 
                                                        px: 1.1, 
                                                        fontSize: '11.5px',
                                                        fontWeight: 600,
                                                        touchAction: 'manipulation',
                                                        minHeight: '34px',
                                                        boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)'
                                                    }}
                                                >
                                                    SMS
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
                                <TableRow sx={{ bgcolor: 'action.hover' }}>
                                    <TableCell align="center" sx={{ width: 50, minWidth: 50, fontSize: '13px', fontWeight: 700, py: 1.2 }}>STT</TableCell>
                                    <TableCell sx={{ width: 140, minWidth: 120, maxWidth: 160, py: 1.2 }}>
                                        <TableSortLabel
                                            active={true}
                                            direction={sortOrder}
                                            onClick={() => {
                                                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                                                setPage(0);
                                            }}
                                            sx={{
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                '&.MuiTableSortLabel-root': { color: 'inherit' },
                                                '&.MuiTableSortLabel-root:hover': { color: 'primary.main' },
                                                '& .MuiTableSortLabel-icon': { color: 'primary.main !important' }
                                            }}
                                        >
                                            Khách Hàng
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={{ width: 155, minWidth: 140, fontSize: '13px', fontWeight: 700, py: 1.2, whiteSpace: 'nowrap' }}>Thuê Bao</TableCell>
                                    <TableCell sx={{ width: 125, minWidth: 110, fontSize: '13px', fontWeight: 700, py: 1.2, whiteSpace: 'nowrap' }}>Số Liên Hệ</TableCell>
                                    <TableCell sx={{ minWidth: 220, fontSize: '13px', fontWeight: 700, py: 1.2 }}>Địa Chỉ</TableCell>
                                    <TableCell sx={{ width: 180, minWidth: 160, fontSize: '13px', fontWeight: 700, py: 1.2, whiteSpace: 'nowrap' }}>Dịch Vụ & Tháng</TableCell>
                                    <TableCell align="right" sx={{ width: 105, minWidth: 95, fontSize: '13px', fontWeight: 700, py: 1.2, whiteSpace: 'nowrap' }}>Số Tiền</TableCell>
                                    <TableCell sx={{ minWidth: 180, fontSize: '13px', fontWeight: 700, py: 1.2 }}>Bằng Chữ</TableCell>
                                    <TableCell sx={{ width: 140, minWidth: 130, fontSize: '13px', fontWeight: 700, py: 1.2, whiteSpace: 'nowrap' }}>Nhân Viên</TableCell>
                                    <TableCell align="center" sx={{ width: 145, minWidth: 140, fontSize: '13px', fontWeight: 700, py: 1.2 }}>Thao Tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
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
                                                <TableCell align="center" sx={{ fontSize: '13.5px', color: 'text.secondary' }}>{globalIndex}</TableCell>
                                                <TableCell sx={{ 
                                                    width: 140, 
                                                    minWidth: 120, 
                                                    maxWidth: 160, 
                                                    fontWeight: 600, 
                                                    fontSize: '13.5px', 
                                                    lineHeight: 1.35,
                                                    whiteSpace: 'normal',
                                                    wordBreak: 'break-word',
                                                    pr: 1
                                                }}>
                                                    {toTitleCase(row.customerName)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    {row.phone}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '13.5px', fontWeight: 500, color: row.contactPhone ? '#0284c7' : 'text.disabled', whiteSpace: 'nowrap' }}>
                                                    {row.contactPhone || '-'}
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 300, fontSize: '13.5px', lineHeight: 1.35 }}>
                                                    {row.address}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                                                    {toTitleCase(row.serviceMonth)}
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 700, color: '#ee0033', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                                                    {row.amount} đ
                                                </TableCell>
                                                <TableCell sx={{ fontStyle: 'italic', fontSize: '13.5px', color: 'text.secondary', lineHeight: 1.35 }}>
                                                    {row.amountInWords}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '13.5px', whiteSpace: 'nowrap' }}>
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

                                                        <Tooltip title={row.contactPhone ? `Gửi SMS đến ${row.contactPhone}` : 'Gửi tin nhắn SMS'} arrow>
                                                            <span>
                                                                <IconButton 
                                                                    size="small" 
                                                                    sx={{ color: '#10b981' }}
                                                                    onClick={() => handleSendSms(row)}
                                                                >
                                                                    <SmsIcon fontSize="small" />
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
