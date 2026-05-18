import React, { useState, useMemo, useEffect } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Button,
    TextField, IconButton, Tooltip, Divider, MenuItem, Select, FormControl, InputLabel,
    CircularProgress, Alert
} from '@mui/material';
import { 
    Print as PrintIcon,
    Refresh as RefreshIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    FileDownload as FileDownloadIcon,
    History as HistoryIcon,
    CheckCircle as CheckCircleIcon,
    DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { setInventoryReportData, setDetailedOutboundData, setInitialBalances } from '../../store/slices/settlementSlice';
import { useNotification } from '../../contexts/NotificationContext';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import { readExcelFile } from '../../utils/excelUtils';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatNumber, formatCurrency } from '../../utils/numberUtils';
import { checkIsSameMonth } from '../../utils/dateUtils';
import {
    applyFrozenMovementsFromHistory,
    historyRecordsToMap,
    isMovementsFrozen,
    markMovementsFrozen,
    normalizeSettlementMonth,
} from '../../utils/settlementAggregates';
interface SettlementRow {
    item_code: string;
    item_name: string;
    item_name_finance: string;
    sap_code: string;
    sap_name: string;
    unit: string;
    unit_price: number;
    initial_qty: number;
    initial_amount: number;
    inbound_qty: number;
    inbound_amount: number;
    outbound_qty: number;
    outbound_amount: number;
    usage_qty: number;
    usage_amount: number;
    return_qty: number;
    return_amount: number;
    final_qty: number;
    final_amount: number;
}

const MonthlySettlementReport: React.FC = () => {
    const dispatch = useDispatch();
    const { success, error, info } = useNotification();
    
    // Helper to safely parse numbers from Excel strings
    const parseExcelNumber = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        let str = String(val).trim();
        
        // Xử lý dấu phân cách hàng nghìn kiểu Việt Nam (75.944 -> 75944)
        if (str.includes('.') && !str.includes(',')) {
            const parts = str.split('.');
            if (parts.length > 1 && parts[parts.length - 1].length === 3) {
                str = str.replace(/\./g, '');
            }
        }
        
        // Xử lý số âm trong ngoặc đơn kiểu kế toán: (2) -> -2
        if (str.startsWith('(') && str.endsWith(')')) {
            str = '-' + str.substring(1, str.length - 1);
        }
        
        // Xử lý dấu phẩy (1,234.56 hoặc 75,944)
        str = str.replace(/,/g, '');
        return Number(str) || 0;
    };

    const { inventoryReportData, detailedOutboundData, initialBalances, profile } = useSelector((state: RootState) => ({
        inventoryReportData: state.settlement?.inventoryReportData || [],
        detailedOutboundData: state.settlement?.detailedOutboundData || [],
        initialBalances: state.settlement?.initialBalances || {},
        profile: state.auth?.profile
    }));
    
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const saved = localStorage.getItem('settlement_selected_month');
        if (saved) return saved;
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        localStorage.setItem('settlement_selected_month', selectedMonth);
    }, [selectedMonth]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingInitial, setEditingInitial] = useState<string | null>(null);
    const [tempInitial, setTempInitial] = useState({ 
        quantity: 0, 
        amount: 0, 
        price: 0,
        sap_code: '',
        finance_name: ''
    });
    const [supplyItems, setSupplyItems] = useState<Set<string>>(new Set());
    const [allProducts, setAllProducts] = useState<any[]>([]);
    const [historicalData, setHistoricalData] = useState<Record<string, any>>({});
    const [isInitialLoading, setIsInitialLoading] = useState(true);

    const monthKey = normalizeSettlementMonth(selectedMonth);

    const reloadHistory = async () => {
        const history = await GoogleSheetService.getSettlementHistory(monthKey);
        const historyMap = historyRecordsToMap(history || []);
        setHistoricalData(historyMap);
        return historyMap;
    };

    const syncMovementsAndReload = async (invData: any[], outData: any[], historyMap: Record<string, any>) => {
        await GoogleSheetService.syncSettlementMovements(monthKey, invData, outData, 'supply', historyMap);
        return reloadHistory();
    };

    // 1. Tải danh mục sản phẩm và dữ liệu lịch sử ban đầu
    useEffect(() => {
        const fetchInitialData = async () => {
            setIsInitialLoading(true);
            try {
                const [products, history, invData, outData] = await Promise.all([
                    GoogleSheetService.fetchProducts(),
                    GoogleSheetService.getSettlementHistory(monthKey),
                    GoogleSheetService.getSettlementInventory(monthKey),
                    GoogleSheetService.getSettlementOutbound(monthKey),
                ]);

                setAllProducts(products || []);
                const supplies = (products || [])
                    .filter((p: any) => {
                        const cat = (p.category || '').toLowerCase();
                        return cat.includes('vật tư') || cat.includes('vattu') || cat === 'vt';
                    })
                    .map((p: any) => p.item_code);
                setSupplyItems(new Set(supplies));

                let historyMap = historyRecordsToMap(history || []);

                if (invData && invData.length > 0) dispatch(setInventoryReportData(invData));
                else dispatch(setInventoryReportData([]));

                if (outData && outData.length > 0) dispatch(setDetailedOutboundData(outData));
                else dispatch(setDetailedOutboundData([]));

                const hasDetail = (invData?.length || 0) > 0 || (outData?.length || 0) > 0;
                if (hasDetail && !isMovementsFrozen(monthKey, 'supply')) {
                    historyMap = await syncMovementsAndReload(invData || [], outData || [], historyMap);
                }
                setHistoricalData(historyMap);

                if (Object.keys(historyMap).length === 0 && !hasDetail) {
                    await loadPreviousBalances();
                }
            } catch (err) {
                console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchInitialData();
    }, [monthKey]);

    // Fetch previous month's balance if needed
    const loadPreviousBalances = async () => {
        setIsLoading(true);
        try {
            // Calculate previous month
            const [year, month] = selectedMonth.split('-').map(Number);
            const prevDate = new Date(year, month - 2, 1);
            const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

            info(`Đang kiểm tra số dư tồn cuối tháng ${prevMonthStr}...`);
            const prevHistory = await GoogleSheetService.getSettlementHistory(prevMonthStr);

            if (prevHistory && prevHistory.length > 0) {
                const newInitialBalances: Record<string, { quantity: number; amount: number; unit_price?: number }> = {};
                prevHistory.forEach((item: any) => {
                    newInitialBalances[item.item_code] = {
                        quantity: Number(item.closing_qty) || 0,
                        amount: Number(item.closing_amount) || 0,
                        unit_price: Number(item.unit_price) || 0
                    };
                });
                dispatch(setInitialBalances(newInitialBalances));
                success(`Đã tự động chuyển tồn cuối ${prevMonthStr} sang đầu kỳ ${selectedMonth}.`);
            } else {
                info(`Không tìm thấy dữ liệu chốt tháng ${prevMonthStr}. Bạn có thể nhập thủ công.`);
            }
        } catch (err: any) {
            console.error('Failed to load previous balances:', err);
            error('Lỗi khi tải số dư đầu kỳ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const settlementRows = useMemo(() => {
        if (isInitialLoading) return [];
        const rowsMap: Record<string, SettlementRow> = {};

        // Helper to get or create row
        const getRow = (name: string, code: string, unit: string = 'Cái', price: number = 0) => {
            const normalizedName = (name || '').trim().replace(/\s+/g, ' ');
            const normalizedCode = (code || '').trim();
            
            // BƯỚC ĐỘT PHÁ: Tìm "Mã Chuẩn" từ DB hoặc Lịch sử để dùng làm Khóa gộp (Key)
            // Giúp gộp "Cáp quang 1 FO bọc chặt" (kế toán) và "Cáp quang bọc chặt 1FO..." (kỹ thuật) vào 1 dòng
            const standardProduct = allProducts.find(p => 
                (normalizedCode && (p.item_code === normalizedCode || p.id === normalizedCode)) ||
                (normalizedName && (p.name || '').trim().replace(/\s+/g, ' ') === normalizedName)
            );
            
            const standardHist = Object.values(historicalData).find(h => 
                (normalizedCode && (h.item_code === normalizedCode || h.sap_item_code === normalizedCode)) ||
                (normalizedName && (h.item_name || '').trim().replace(/\s+/g, ' ') === normalizedName) ||
                (normalizedName && (h.finance_item_name || '').trim().replace(/\s+/g, ' ') === normalizedName)
            );

            const finalCode = standardProduct?.item_code || standardHist?.item_code || normalizedCode;
            const finalName = standardProduct?.name || standardHist?.item_name || normalizedName;
            const key = finalCode || finalName;
            
            if (!rowsMap[key]) {
                const initBal = initialBalances[finalCode] || initialBalances[finalName];
                rowsMap[key] = {
                    item_code: finalCode,
                    item_name: finalName,
                    item_name_finance: standardHist?.finance_item_name || '',
                    sap_code: standardHist?.sap_item_code || '',
                    sap_name: '',
                    unit: unit || standardHist?.unit || 'Cái',
                    unit_price: price || initBal?.unit_price || Number(standardHist?.unit_price) || 0,
                    initial_qty: Number(standardHist?.opening_qty) || Number(initBal?.quantity) || 0,
                    initial_amount: Number(standardHist?.opening_amount) || Number(initBal?.amount) || 0,
                    inbound_qty: 0,
                    inbound_amount: 0,
                    outbound_qty: 0,
                    outbound_amount: 0,
                    usage_qty: 0,
                    usage_amount: 0,
                    return_qty: 0,
                    return_amount: 0,
                    final_qty: 0,
                    final_amount: 0,
                };
            }
            return rowsMap[key];
        };

        // LỌC VẬT TƯ: Sử dụng cột 'DM' (ghi chú) và 'Loại Mặt hàng' từ file Excel làm chuẩn
        const filteredInventory = inventoryReportData.filter(item => {
            const date = item.actual_date || item.voucher_date;
            const isMonth = date ? checkIsSameMonth(date, selectedMonth) : true;
            if (!isMonth) return false;

            const excelCat = String(item.note || '').toLowerCase();
            if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) {
                return false; // Nếu là Hàng hóa thì loại ra khỏi báo cáo Vật tư
            }
            return true;
        });

        const filteredOutbound = detailedOutboundData.filter(item => {
            // CẢI TIẾN: Nếu ngày bị trống (null/undefined/empty), vẫn giữ lại để tránh mất dữ liệu sau reload
            const stockDate = item.stock_out_date;
            const isMonth = (stockDate && stockDate !== 'null' && stockDate !== 'undefined') ? checkIsSameMonth(stockDate, selectedMonth) : true;
            if (!isMonth) return false;

            const excelCat = String(item.item_type || '').toLowerCase();
            // CHỈ lọc bỏ nếu CÓ chữ "hàng hóa". Nếu trống thì vẫn giữ lại để không bị thiếu số liệu.
            if (excelCat && (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa'))) {
                return false; 
            }
            return true;
        });


        // 1. Nạp tất cả các mặt hàng từ dữ liệu lịch sử (Tồn đầu kỳ gán cứng)
        Object.values(historicalData).forEach(hist => {
            const product = allProducts.find(p => 
                (hist.item_code && p.item_code === hist.item_code) || 
                (hist.item_name && p.name === hist.item_name)
            );
            const isStandardGoods = [
                "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", "Home Wifi 6 VHT 32X6V1", "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3",
                "Camera trong nhà HC24", "Điện thoại IP GXP1610", "ONT wifi 6 VHT vGP-42X6V1", "ONT GWN7062G cho KHDN",
                "Home Wifi chuẩn Wifi 6_HV3601P", "Camera trong nhà HC23 3M_UCTT", "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT",
                "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", "ONT wifi 6 VHT vGP-42X6V1_UCTT", "Thiết bị ONT XS0426GP",
                "ONT WiFi 6 NPE3036GV", "Home WiFi 6 NR3053", "ONT WiFi 6 NPE3036GV_UCTT", "STB Android TV 4K AV1_ZTE_B866V6M",
                "Camera ngoài trời HC34_3M", "Cảm biến khói wifi PA-443"
            ].some(s => s.trim().toLowerCase() === hist.item_name?.trim().toLowerCase());

            if (product) {
                const cat = (product.category || '').toLowerCase();
                if (cat.includes('hàng hóa') || cat.includes('hang hoa') || isStandardGoods) return;
            } else if (isStandardGoods) {
                return;
            }
            
            getRow(hist.item_name, hist.item_code, hist.unit, Number(hist.unit_price));
        });

        // 1b. Nạp thêm các mặt hàng từ Tồn đầu kỳ (carried over) nếu chưa có trong history
        Object.keys(initialBalances).forEach(code => {
            if (rowsMap[code]) return;
            
            // Tìm tên từ DB
            const product = allProducts.find(p => p.item_code === code || p.name === code);
            if (product) {
                const cat = (product.category || '').toLowerCase();
                const isStandardGoods = [
                    "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", "Home Wifi 6 VHT 32X6V1", "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3",
                    "Camera trong nhà HC24", "Điện thoại IP GXP1610", "ONT wifi 6 vGP-42X6V1", "ONT GWN7062G cho KHDN",
                    "Home Wifi chuẩn Wifi 6_HV3601P", "Camera trong nhà HC23 3M_UCTT", "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT",
                    "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", "ONT wifi 6 vGP-42X6V1_UCTT", "Thiết bị ONT XS0426GP",
                    "ONT WiFi 6 NPE3036GV", "Home WiFi 6 NR3053", "ONT WiFi 6 NPE3036GV_UCTT", "STB Android TV 4K AV1_ZTE_B866V6M",
                    "Camera ngoài trời HC34_3M", "Cảm biến khói wifi PA-443"
                ].some(s => s.trim().toLowerCase() === product.name?.trim().toLowerCase());

                if (cat.includes('hàng hóa') || cat.includes('hang hoa') || isStandardGoods) return;
                getRow(product.name, product.item_code, product.unit);
            } else {
                // Nếu không có trong DB, dùng luôn code làm tên
                getRow(code, code);
            }
        });

        // 2. Process Inventory Report Data (Báo cáo Xuất Nhập)
        filteredInventory.forEach(item => {
            let itemName = (item.bccs_item || '').trim();
            const itemCode = (item.item_code || '').trim();
            
            // KIỂM TRA DANH MỤC NGAY TỪ ĐẦU ĐỂ TRÁNH LỆCH SỐ (Lọc Hàng hóa khỏi Vật tư)
            // So khớp linh hoạt hơn với khoảng trắng và không phân biệt hoa thường
            const product = allProducts.find(p => 
                (itemCode && (p.item_code || '').trim() === itemCode) ||
                (itemName && (p.name || '').trim().replace(/\s+/g, ' ').toLowerCase().includes(itemName.toLowerCase().replace(/\s+/g, ' '))) ||
                (itemName && itemName.toLowerCase().replace(/\s+/g, ' ').includes((p.name || '').trim().toLowerCase().replace(/\s+/g, ' ')))
            );
            if (product) {
                const cat = (product.category || '').toLowerCase();
                if (cat.includes('hàng hóa') || cat.includes('hang hoa')) return;
            }

            // TRUY HỒI TÊN: Nếu thiếu tên nhưng có mã, thử tìm tên từ DB hoặc lịch sử
            if (!itemName && itemCode) {
                const p = allProducts.find(p => (p.item_code || '').trim() === itemCode);
                if (p) itemName = p.name;
                else {
                    const h = Object.values(historicalData).find(h => (h.item_code || '').trim() === itemCode);
                    if (h) itemName = h.item_name;
                }
            }

            if (!itemName) return;
            const row = getRow(itemName, itemCode, item.unit, parseExcelNumber(item.unit_price));
            row.item_name_finance = item.finance_item;
            
            const type = (item.transaction_type || '').toLowerCase();
            if (type.includes('nhập')) {
                row.inbound_qty += parseExcelNumber(item.quantity);
                row.inbound_amount += parseExcelNumber(item.total_amount);
            } else if (type.includes('xuất')) {
                // QUY TẮC: Bất kỳ phiếu "Xuất" nào trong Báo cáo Tổng hợp đều là TRẢ KHO
                row.return_qty += parseExcelNumber(item.quantity);
                row.return_amount += parseExcelNumber(item.total_amount);
            }
        });

        // Process Detailed Outbound Data (Báo cáo chi tiết Xuất trong kỳ)
        // Biến tạm để kế thừa dữ liệu từ dòng trên (đề phòng dòng trống do gộp ô/thiếu thông tin)
        let lastItemName = '';
        let lastItemCode = '';
        let lastDate: any = null;

        filteredOutbound.forEach(item => {
            let itemName = (item.item_name || '').trim();
            let itemCode = (item.item_code || '').trim();
            let stockDate = item.stock_out_date;

            // KẾ THỪA: Nếu dòng này trống, lấy từ dòng trên
            if (!itemName && !itemCode) {
                itemName = lastItemName;
                itemCode = lastItemCode;
            }
            if (!stockDate) stockDate = lastDate;

            // Cập nhật biến tạm cho dòng sau
            if (itemName) lastItemName = itemName;
            if (itemCode) lastItemCode = itemCode;
            if (stockDate) lastDate = stockDate;

            if (!itemName && !itemCode) return;
            
            // Kiểm tra lại ngày sau khi kế thừa
            const isMonth = stockDate ? checkIsSameMonth(stockDate, selectedMonth) : true;
            if (!isMonth) return;

            const row = getRow(itemName, itemCode, item.unit, parseExcelNumber(item.cost_price));
            row.item_name_finance = String(item.finance_item || row.item_name_finance || '');
            row.sap_code = String(item.sap_item_code || row.sap_code || '');
            
            // PHÂN LOẠI THÔNG MINH CHO CHI TIẾT XUẤT:
            const qWithin = parseExcelNumber(item.qty_within_limit);
            const qOver = parseExcelNumber(item.qty_over_limit);
            const qTotal = parseExcelNumber(item.qty_total);
            
            // Ưu tiên qty_total nếu có, nếu không thì cộng dồn within + over
            const qty = qTotal || (qWithin + qOver);
            const amount = parseExcelNumber(item.total_amount);
            
            const type = (item.transaction_type || '').toLowerCase();
            // Nếu là dòng trả hàng/điều chuyển hoặc số lượng âm -> Đưa vào TRẢ KHO
            if (type.includes('trả') || type.includes('thu hồi') || type.includes('thu hoi') || 
                type.includes('điều chuyển') || type.includes('dieu chuyen') || type.includes('chuyển kho') || qty < 0) {
                row.return_qty += Math.abs(qty);
                row.return_amount += Math.abs(amount);
            } else {
                row.outbound_qty += qty;
                row.outbound_amount += amount;
            }
        });

        const useFrozen = isMovementsFrozen(monthKey, 'supply');

        return Object.values(rowsMap).map(row => {
            if (useFrozen) {
                applyFrozenMovementsFromHistory(row, historicalData, true);
            } else {
                row.final_qty = row.initial_qty + row.inbound_qty - row.outbound_qty - row.return_qty;
                row.final_amount =
                    row.initial_amount + row.inbound_amount - row.outbound_amount - row.return_amount;
            }
            return row;
        });
    }, [inventoryReportData, detailedOutboundData, initialBalances, selectedMonth, historicalData, allProducts, isInitialLoading]);

    const missingProductsWarning = useMemo(() => {
        const missing = new Set<string>();
        
        inventoryReportData.forEach(item => {
            const isMonth = checkIsSameMonth(item.actual_date || item.voucher_date, selectedMonth);
            if (!isMonth) return;
            const excelCat = String(item.note || '').toLowerCase();
            if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) return; // Bỏ qua Hàng hóa

            const name = (item.bccs_item || '').trim();
            if (!name) return;
            
            const product = allProducts.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
            if (!product) missing.add(name);
        });

        detailedOutboundData.forEach(item => {
            const isMonth = item.stock_out_date ? checkIsSameMonth(item.stock_out_date, selectedMonth) : true;
            if (!isMonth) return;
            const excelCat = String(item.item_type || '').toLowerCase();
            if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) return; // Bỏ qua Hàng hóa

            const name = (item.item_name || '').trim();
            const code = (item.item_code || '').trim();
            if (!name && !code) return;
            
            const product = allProducts.find(p => 
                (code && (p.item_code || '').trim() === code) || 
                (name && (p.name || '').trim().toLowerCase() === name.toLowerCase())
            );
            if (!product) missing.add(name || code);
        });

        return Array.from(missing).filter(Boolean);
    }, [inventoryReportData, detailedOutboundData, allProducts, selectedMonth]);

    const handleInventoryImport = async (data: any[]) => {
        setIsLoading(true);
        try {
            await GoogleSheetService.saveSettlementInventory(monthKey, data);
            dispatch(setInventoryReportData(data));
            const historyMap = await syncMovementsAndReload(data, detailedOutboundData, historicalData);
            setHistoricalData(historyMap);
            success(`Đã lưu và chốt ${data.length} dòng Báo cáo Xuất Nhập tháng ${monthKey}. Số liệu cố định khi tải lại trang.`);
        } catch (err: any) {
            console.error('Import Error (Inventory):', err);
            error('Lỗi khi lưu dữ liệu Import: ' + (err.message || 'Không thể kết nối đến máy chủ.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOutboundImport = async (data: any[]) => {
        setIsLoading(true);
        try {
            await GoogleSheetService.saveSettlementOutbound(monthKey, data);
            dispatch(setDetailedOutboundData(data));
            const historyMap = await syncMovementsAndReload(inventoryReportData, data, historicalData);
            setHistoricalData(historyMap);
            success(`Đã lưu và chốt ${data.length} dòng Chi Tiết Xuất tháng ${monthKey}. Cột XUẤT TRONG KỲ giữ nguyên khi tải lại.`);
        } catch (err: any) {
            console.error('Import Error (Outbound):', err);
            error('Lỗi khi lưu dữ liệu Import: ' + (err.message || 'Không thể kết nối đến máy chủ.'));
        } finally {
            setIsLoading(false);
        }
    };

    const handleClearData = async () => {
        if (!window.confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu nhập xuất và chi tiết xuất của tháng ${monthKey}? Thao tác này không thể hoàn tác.`)) return;
        
        setIsLoading(true);
        try {
            await Promise.all([
                GoogleSheetService.clearSettlementData(monthKey, 'inventory'),
                GoogleSheetService.clearSettlementData(monthKey, 'outbound'),
            ]);
            dispatch(setInventoryReportData([]));
            dispatch(setDetailedOutboundData([]));
            await GoogleSheetService.clearSettlementMovements(monthKey, historicalData, 'supply');
            const historyMap = await reloadHistory();
            setHistoricalData(historyMap);
            success(`Đã xóa sạch dữ liệu chi tiết và reset số phát sinh tháng ${monthKey}.`);
        } catch (err: any) {
            error('Lỗi khi xóa: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveInitial = async (name: string) => {
        const row = settlementRows.find(r => r.item_name === name);
        if (!row) return;

        setIsSaving(true);
        try {
            // Lưu trực tiếp vào Database để persist dữ liệu nhập tay
            await GoogleSheetService.saveSettlementHistory([{
                month: monthKey,
                item_code: row.item_code,
                item_name: row.item_name,
                unit: row.unit,
                unit_price: tempInitial.price,
                opening_qty: tempInitial.quantity,
                opening_amount: tempInitial.amount,
                inbound_qty: row.inbound_qty,
                inbound_amount: row.inbound_amount,
                outbound_qty: row.outbound_qty,
                outbound_amount: row.outbound_amount,
                usage_qty: row.usage_qty,
                usage_amount: row.usage_amount,
                return_qty: row.return_qty,
                return_amount: row.return_amount,
                closing_qty: tempInitial.quantity + row.inbound_qty - row.outbound_qty - row.usage_qty - row.return_qty,
                closing_amount: tempInitial.amount + row.inbound_amount - row.outbound_amount - row.usage_amount - row.return_amount,
                sap_item_code: tempInitial.sap_code,
                finance_item_name: tempInitial.finance_name,
            }]);

            // Cập nhật state local để hiển thị ngay
            setHistoricalData(prev => ({
                ...prev,
                [name]: {
                    ...prev[name],
                    opening_qty: tempInitial.quantity,
                    opening_amount: tempInitial.amount,
                    unit_price: tempInitial.price,
                    sap_item_code: tempInitial.sap_code,
                    finance_item_name: tempInitial.finance_name
                }
            }));

            setEditingInitial(null);
            success(`Đã lưu thay đổi cho ${name} vào hệ thống.`);
        } catch (err: any) {
            console.error('Failed to save manual edit:', err);
            error('Lỗi khi lưu dữ liệu: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveSettlement = async () => {
        if (settlementRows.length === 0) {
            error('Không có dữ liệu để lưu.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = settlementRows.map(row => ({
                month: monthKey,
                item_code: row.item_code,
                item_name: row.item_name,
                unit: row.unit,
                unit_price: row.unit_price,
                opening_qty: row.initial_qty,
                opening_amount: row.initial_amount,
                inbound_qty: row.inbound_qty,
                inbound_amount: row.inbound_amount,
                outbound_qty: row.outbound_qty,
                outbound_amount: row.outbound_amount,
                usage_qty: row.usage_qty,
                usage_amount: row.usage_amount,
                return_qty: row.return_qty,
                return_amount: row.return_amount,
                closing_qty: row.final_qty,
                closing_amount: row.final_amount,
                sap_item_code: row.sap_code,
                finance_item_name: row.item_name_finance,
            }));

            await GoogleSheetService.saveSettlementHistory(payload);
            markMovementsFrozen(monthKey, 'supply');
            await reloadHistory();
            success(`Đã chốt và lưu dữ liệu tháng ${monthKey} thành công.`);
        } catch (err: any) {
            console.error('Failed to save settlement:', err);
            error('Lỗi khi lưu dữ liệu chốt tháng: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quyet_Toan_Vat_Tu');

        // 1. COMPANY & SLOGAN HEADERS
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT';
        sheet.getCell('A1').font = { bold: true, size: 11 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:E2');
        sheet.getCell('A2').value = 'TRUNG TÂM QUẬN 12';
        sheet.getCell('A2').font = { bold: true, size: 11 };
        sheet.getCell('A2').alignment = { horizontal: 'center' };

        sheet.mergeCells('N1:Q1');
        sheet.getCell('N1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        sheet.getCell('N1').font = { bold: true, size: 11 };
        sheet.getCell('N1').alignment = { horizontal: 'center' };

        sheet.mergeCells('N2:Q2');
        sheet.getCell('N2').value = 'Độc lập - Tự do - Hạnh phúc';
        sheet.getCell('N2').font = { italic: true, size: 10 };
        sheet.getCell('N2').alignment = { horizontal: 'center' };

        // 2. MAIN TITLE
        sheet.mergeCells('A4:Q4');
        const titleCell = sheet.getCell('A4');
        titleCell.value = 'BIÊN BẢN XÁC NHẬN CÔNG NỢ VẬT TƯ';
        titleCell.font = { bold: true, size: 18 };
        titleCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A5:Q5');
        const subTitleCell = sheet.getCell('A5');
        subTitleCell.value = '(Tài khoản 1412.01 - Tạm ứng vật tư - VTT)';
        subTitleCell.font = { italic: true, size: 11 };
        subTitleCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A6:Q6');
        const monthCell = sheet.getCell('A6');
        monthCell.value = `Tháng quyết toán: ${selectedMonth.split('-').reverse().join('/')}`;
        monthCell.font = { size: 11 };
        monthCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A7:Q7');
        const targetCell = sheet.getCell('A7');
        targetCell.value = 'Đối tượng tạm ứng: ACT - TRUNG TÂM QUẬN 12';
        targetCell.font = { bold: true, size: 11 };
        targetCell.alignment = { horizontal: 'center' };

        // 3. TABLE HEADERS (Start from Row 9)
        const headerRow1 = [
            'TT', 'TÊN VẬT TƯ, HÀNG HÓA', 'MÃ VT, HÀNG HÓA', 'MÃ MH HẠCH TOÁN', 'TÊN MH HẠCH TOÁN', 'ĐVT', 'ĐƠN GIÁ',
            'DƯ ĐẦU KỲ', '', 'NHẬP TRONG KỲ', '', 'XUẤT TRONG KỲ', '', 'TRẢ KHO', '', 'TỒN CUỐI KỲ', ''
        ];
        const headerRow2 = [
            '', '', '', '', '', '', '',
            'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền'
        ];

        const r1 = sheet.addRow(headerRow1);
        const r2 = sheet.addRow(headerRow2);
        
        // Adjust row indices because they are 1-based and we added titles above
        const headerRowIdx = 9;
        
        // Merge headers
        sheet.mergeCells(`A${headerRowIdx}:A${headerRowIdx+1}`); 
        sheet.mergeCells(`B${headerRowIdx}:B${headerRowIdx+1}`); 
        sheet.mergeCells(`C${headerRowIdx}:C${headerRowIdx+1}`); 
        sheet.mergeCells(`D${headerRowIdx}:D${headerRowIdx+1}`); 
        sheet.mergeCells(`E${headerRowIdx}:E${headerRowIdx+1}`); 
        sheet.mergeCells(`F${headerRowIdx}:F${headerRowIdx+1}`); 
        sheet.mergeCells(`G${headerRowIdx}:G${headerRowIdx+1}`);
        sheet.mergeCells(`H${headerRowIdx}:I${headerRowIdx}`); 
        sheet.mergeCells(`J${headerRowIdx}:K${headerRowIdx}`); 
        sheet.mergeCells(`L${headerRowIdx}:M${headerRowIdx}`); 
        sheet.mergeCells(`N${headerRowIdx}:O${headerRowIdx}`); 
        sheet.mergeCells(`P${headerRowIdx}:Q${headerRowIdx}`);

        // Styling headers
        [sheet.getRow(headerRowIdx), sheet.getRow(headerRowIdx+1)].forEach((r) => {
            r.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
                cell.font = { bold: true };
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            });
        });

        // Add Data
        settlementRows.forEach((row, index) => {
            const r = sheet.addRow([
                index + 1,
                row.item_name,
                row.item_code,
                row.sap_code,
                row.item_name_finance || row.sap_name || row.item_name,
                row.unit,
                row.unit_price,
                row.initial_qty,
                row.initial_amount,
                row.inbound_qty,
                row.inbound_amount,
                row.outbound_qty,
                row.outbound_amount,
                row.return_qty,
                row.return_amount,
                row.final_qty,
                row.final_amount
            ]);
            r.eachCell((cell, colNumber) => {
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                if (colNumber >= 7) {
                    cell.numFmt = '#,##0';
                    cell.alignment = { horizontal: 'right' };
                }
            });
        });

        // Summary Row
        const summaryRow = sheet.addRow([
            'TỔNG CỘNG', '', '', '', '', '', '',
            settlementRows.reduce((a, b) => a + (Number(b.initial_qty) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.initial_amount) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.inbound_qty) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.inbound_amount) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.outbound_qty) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.outbound_amount) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.return_qty) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.return_amount) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.final_qty) || 0), 0),
            settlementRows.reduce((a, b) => a + (Number(b.final_amount) || 0), 0),
        ]);
        summaryRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (colNumber >= 8) {
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right' };
            }
        });
        sheet.mergeCells(`A${summaryRow.number}:G${summaryRow.number}`);

        // 4. SIGNATURES
        const lastRow = summaryRow.number;
        sheet.addRow([]); // Gap
        sheet.addRow([]); // Gap
        
        const signRow1 = sheet.addRow(['', 'NHÂN VIÊN KHO', '', '', '', '', '', '', '', '', '', '', '', '', 'TP.Hồ Chí Minh, ngày ' + new Date().getDate() + ' tháng ' + (new Date().getMonth() + 1) + ' năm ' + new Date().getFullYear()]);
        const signRow2 = sheet.addRow(['', '(Ký, họ tên)', '', '', '', '', '', '', '', '', '', '', '', '', 'P. GIÁM ĐỐC QUẬN']);
        const signRow3 = sheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', '', '(Ký, họ tên, đóng dấu)']);
        
        [signRow1, signRow2, signRow3].forEach(sr => {
            sr.getCell(2).font = { bold: true };
            sr.getCell(15).font = { bold: true };
            sr.getCell(2).alignment = { horizontal: 'center' };
            sr.getCell(15).alignment = { horizontal: 'center' };
        });
        
        // Add full name after a gap
        sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);
        const nameRow = sheet.addRow(['', profile?.full_name || '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
        nameRow.getCell(2).font = { bold: true };
        nameRow.getCell(2).alignment = { horizontal: 'center' };
        nameRow.getCell(15).alignment = { horizontal: 'center' };
        nameRow.getCell(2).alignment = { horizontal: 'center' };
        nameRow.getCell(15).alignment = { horizontal: 'center' };

        // Auto width
        sheet.columns.forEach(col => { col.width = 15; });
        sheet.getColumn(2).width = 30;
        sheet.getColumn(5).width = 30;

        // Cấu hình in ấn A4 Ngang
        sheet.pageSetup = {
            orientation: 'landscape',
            paperSize: 9, // A4
            fitToPage: true,
            fitToHeight: 0,
            fitToWidth: 1,
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
        };

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Quyet_Toan_Vat_Tu_${selectedMonth}.xlsx`);
        success('Đã xuất file Excel thành công.');
    };

    const handleExportPDF = async () => {
        const input = document.getElementById('settlement-report-content');
        if (!input) return;
        
        info('Đang khởi tạo file PDF...');
        
        // Temporarily force show print-only elements and hide no-print elements for capture
        const printOnlyElements = input.querySelectorAll('.print-only');
        const noPrintElements = input.querySelectorAll('.no-print');
        
        printOnlyElements.forEach((el: any) => {
            el.style.display = 'block';
        });
        noPrintElements.forEach((el: any) => {
            el.style.display = 'none';
        });

        try {
            // Scroll to top to ensure clean capture
            window.scrollTo(0, 0);

            const canvas = await html2canvas(input, { 
                scale: 3, // Tăng độ nét
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                windowWidth: 1600, // Cố định chiều rộng để layout ổn định
                onclone: (clonedDoc) => {
                    const clonedInput = clonedDoc.getElementById('settlement-report-content');
                    if (clonedInput) {
                        clonedInput.style.width = '1600px';
                        clonedInput.style.padding = '40px';
                        clonedInput.style.backgroundColor = 'white';
                        clonedInput.style.overflow = 'visible';
                        clonedInput.style.display = 'block';
                        
                        // Áp dụng font Times New Roman cho toàn bộ bản in
                        clonedInput.style.fontFamily = '"Times New Roman", Times, serif';
                        
                        // Xử lý tiêu đề và các phần tử không viền (Header/Signature)
                        const layoutTables = clonedInput.querySelectorAll('.layout-table');
                        layoutTables.forEach((table: any) => {
                            table.style.border = 'none';
                            const cells = table.querySelectorAll('td, th');
                            cells.forEach((c: any) => {
                                c.style.border = 'none';
                                c.style.padding = '5px';
                            });
                        });

                        // Xử lý bảng dữ liệu chính
                        const mainTable = clonedInput.querySelector('table:not(.layout-table)');
                        if (mainTable) {
                            (mainTable as any).style.borderCollapse = 'collapse';
                            (mainTable as any).style.width = '100%';
                            const cells = mainTable.querySelectorAll('th, td');
                            cells.forEach((cell: any) => {
                                cell.style.border = '1px solid black';
                                cell.style.padding = '4px';
                                cell.style.fontSize = '9pt'; // Hơi nhỏ hơn cho Vật tư vì nhiều cột
                                cell.style.color = 'black';
                                cell.style.fontFamily = '"Times New Roman", Times, serif';
                            });
                        }

                        // Ẩn các phần tử không cần thiết
                        const noPrint = clonedInput.querySelectorAll('.no-print');
                        noPrint.forEach((el: any) => el.style.display = 'none');
                        
                        const printOnly = clonedInput.querySelectorAll('.print-only');
                        printOnly.forEach((el: any) => {
                            el.style.display = 'block';
                            el.style.visibility = 'visible';
                        });
                    }
                }
            });

            const imgData = canvas.toDataURL('image/png', 1.0);
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            
            // Tính toán tỷ lệ để vừa khít trang A4
            const imgWidth = pdfWidth - 20; // Margin 10mm mỗi bên
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Nếu cao quá trang thì scale lại theo chiều cao
            let finalWidth = imgWidth;
            let finalHeight = imgHeight;
            if (imgHeight > pdfHeight - 20) {
                finalHeight = pdfHeight - 20;
                finalWidth = (canvas.width * finalHeight) / canvas.height;
            }

            // Căn giữa
            const x = (pdfWidth - finalWidth) / 2;
            const y = 10;

            pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
            pdf.save(`Quyet_Toan_Vat_Tu_${selectedMonth}.pdf`);
            success('Đã xuất file PDF thành công (vừa trang A4).');
        } catch (err) {
            console.error('PDF export error:', err);
            error('Lỗi khi xuất file PDF.');
        } finally {
            // Restore original display state
            printOnlyElements.forEach((el: any) => {
                el.style.display = '';
            });
            noPrintElements.forEach((el: any) => {
                el.style.display = '';
            });
        }
    };

    const monthOptions = useMemo(() => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            options.push(mStr);
        }
        return options;
    }, []);

    return (
        <Box sx={{ pb: 10 }}>
            {/* Action Bar */}
            <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, '@media print': { display: 'none' } }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>QUYẾT TOÁN VẬT TƯ HÀNG THÁNG</Typography>
                        <Typography variant="body2" color="text.secondary">Dữ liệu tổng hợp từ Báo cáo Xuất Nhập và Chi Tiết Xuất.</Typography>
                    </Box>
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <InventoryReportImport onImport={handleInventoryImport} />
                    <OutboundReportImport onImport={handleOutboundImport} />
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Chọn tháng</InputLabel>
                        <Select
                            value={selectedMonth}
                            label="Chọn tháng"
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        >
                            {monthOptions.map(m => (
                                <MenuItem key={m} value={m}>{m}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <Button 
                        variant="outlined" 
                        startIcon={isLoading ? <CircularProgress size={16} /> : <HistoryIcon />} 
                        onClick={loadPreviousBalances}
                        disabled={isLoading}
                    >
                        Lấy tồn đầu kỳ
                    </Button>

                    <Button 
                        variant="contained" 
                        color="success"
                        startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleIcon />} 
                        onClick={handleSaveSettlement}
                        disabled={isSaving || settlementRows.length === 0}
                    >
                        Chốt & Lưu tháng
                    </Button>

                    <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} onClick={handleClearData} disabled={isLoading}>Xóa dữ liệu</Button>
                    <Button variant="outlined" color="success" startIcon={<FileDownloadIcon />} onClick={handleExportExcel}>Xuất Excel</Button>
                    <Button variant="outlined" color="primary" startIcon={<FileDownloadIcon />} onClick={handleExportPDF}>Xuất PDF</Button>
                    <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>In Báo Cáo (A4)</Button>
                </Box>
            </Paper>

            {missingProductsWarning.length > 0 && (
                <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Cảnh báo: Có {missingProductsWarning.length} mặt hàng Vật tư trong file import NHƯNG CHƯA TỒN TẠI trong bảng Danh mục Sản phẩm:
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                        {missingProductsWarning.join(', ')}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic', color: 'text.secondary' }}>
                        Vui lòng sang trang "Sản phẩm" để thêm các mã này vào hệ thống, điều này giúp hệ thống quản lý chuẩn xác hơn!
                    </Typography>
                </Alert>
            )}

            <Box id="settlement-report-content" sx={{ fontFamily: '"Times New Roman", Times, serif' }}>
                {/* Print Header - NO FRAME */}
                <Box className="print-only" sx={{ 
                    display: 'none', 
                    '@media print': { display: 'block', mb: 4 }
                }}>
                    <table className="layout-table" style={{ width: '100%', border: 'none', marginBottom: '16px' }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '50%', textAlign: 'center', border: 'none', verticalAlign: 'top' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>TRUNG TÂM QUẬN 12</Typography>
                                </td>
                                <td style={{ width: '50%', textAlign: 'center', border: 'none', verticalAlign: 'top' }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                                    <Typography variant="caption" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>Độc lập - Tự do - Hạnh phúc</Typography>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <Typography variant="h5" align="center" sx={{ fontWeight: 800, mt: 3 }}>BIÊN BẢN XÁC NHẬN CÔNG NỢ VẬT TƯ</Typography>
                    <Typography variant="body2" align="center" sx={{ fontStyle: 'italic' }}>(Tài khoản 1412.01 - Tạm ứng vật tư - VTT)</Typography>
                    <Typography variant="body2" align="center">Tháng quyết toán: {selectedMonth.split('-').reverse().join('/')}</Typography>
                    <Typography variant="body2" align="center" sx={{ fontWeight: 700 }}>Đối tượng tạm ứng: ACT - TRUNG TÂM QUẬN 12</Typography>
                </Box>

            <Box component="div" sx={{ 
                borderRadius: 0, 
                overflowX: 'auto', 
                border: 'none',
                '@media print': { 
                    boxShadow: 'none', 
                    border: 'none',
                    overflow: 'visible',
                    width: '100%'
                } 
            }}>
                <Table size="small" sx={{ 
                    minWidth: 1500,
                    fontFamily: '"Times New Roman", Times, serif',
                    '@media print': {
                        minWidth: '100%',
                        width: '100%',
                        tableLayout: 'auto'
                    },
                    '& .MuiTableCell-root': { 
                        border: '1px solid rgba(224, 224, 224, 1)',
                        fontSize: '0.72rem',
                        padding: '4px 6px',
                        whiteSpace: 'nowrap',
                        fontFamily: '"Times New Roman", Times, serif',
                        '@media print': { 
                            border: '1px solid black',
                            fontSize: '0.62rem',
                            padding: '2px 4px'
                        }
                    }
                }}>
                    <TableHead>
                        <TableRow sx={{ bgcolor: '#f8fafc', '@media print': { bgcolor: 'transparent' } }}>
                            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 800, minWidth: 40 }}>TT</TableCell>
                            <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 200, whiteSpace: 'normal !important' }}>TÊN VẬT TƯ, HÀNG HÓA</TableCell>
                            <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 100 }}>MÃ VT, HÀNG HÓA</TableCell>
                            <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 100 }}>MÃ MH HẠCH TOÁN</TableCell>
                            <TableCell rowSpan={2} sx={{ fontWeight: 800, minWidth: 200, whiteSpace: 'normal !important' }}>TÊN MH HẠCH TOÁN</TableCell>
                            <TableCell rowSpan={2} align="center" sx={{ fontWeight: 800, minWidth: 50 }}>ĐVT</TableCell>
                            <TableCell rowSpan={2} align="right" sx={{ fontWeight: 800, minWidth: 80 }}>ĐƠN GIÁ</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontWeight: 800 }}>DƯ ĐẦU KỲ</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontWeight: 800 }}>NHẬP TRONG KỲ</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontWeight: 800 }}>XUẤT TRONG KỲ</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontWeight: 800 }}>TRẢ KHO</TableCell>
                            <TableCell colSpan={2} align="center" sx={{ fontWeight: 800 }}>TỒN CUỐI KỲ</TableCell>
                        </TableRow>
                        <TableRow sx={{ bgcolor: '#f8fafc', '@media print': { bgcolor: 'transparent' } }}>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Số lượng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Thành tiền</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Số lượng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Thành tiền</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Số lượng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Thành tiền</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Số lượng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Thành tiền</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Số lượng</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>Thành tiền</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {settlementRows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={17} align="center" sx={{ py: 4 }}>Chưa có dữ liệu tổng hợp. Vui lòng import báo cáo.</TableCell>
                            </TableRow>
                        ) : (
                            settlementRows.map((row, index) => (
                                <TableRow key={row.item_code} hover>
                                    <TableCell align="center">{index + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal !important', minWidth: 200 }}>{row.item_name}</TableCell>
                                    <TableCell>{row.item_code}</TableCell>
                                    <TableCell>
                                        {editingInitial === row.item_name ? (
                                            <TextField 
                                                size="small" 
                                                value={tempInitial.sap_code} 
                                                onChange={(e) => setTempInitial({...tempInitial, sap_code: e.target.value})}
                                                sx={{ width: 100 }}
                                            />
                                        ) : (
                                            row.sap_code || '---'
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ whiteSpace: 'normal !important', minWidth: 200 }}>
                                        {editingInitial === row.item_name ? (
                                            <TextField 
                                                size="small" 
                                                value={tempInitial.finance_name} 
                                                onChange={(e) => setTempInitial({...tempInitial, finance_name: e.target.value})}
                                                sx={{ width: 150 }}
                                            />
                                        ) : (
                                            row.item_name_finance || row.sap_name || row.item_name
                                        )}
                                    </TableCell>
                                    <TableCell align="center">{row.unit}</TableCell>
                                    <TableCell align="right">
                                        {editingInitial === row.item_name ? (
                                            <TextField 
                                                size="small" 
                                                type="number"
                                                value={tempInitial.price} 
                                                onChange={(e) => setTempInitial({...tempInitial, price: Number(e.target.value), amount: Number(e.target.value) * tempInitial.quantity})}
                                                sx={{ width: 100 }}
                                            />
                                        ) : (
                                            formatNumber(row.unit_price)
                                        )}
                                    </TableCell>
                                    
                                    <TableCell align="center" sx={{ position: 'relative' }}>
                                        {editingInitial === row.item_name ? (
                                            <TextField 
                                                size="small" 
                                                type="number" 
                                                value={tempInitial.quantity} 
                                                onChange={(e) => setTempInitial({...tempInitial, quantity: Number(e.target.value), amount: Number(e.target.value) * tempInitial.price})}
                                                autoFocus
                                                sx={{ width: 60 }}
                                            />
                                        ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                                {formatNumber(row.initial_qty)}
                                                <IconButton 
                                                    className="no-print" 
                                                    size="small" 
                                                    onClick={() => {
                                                        setEditingInitial(row.item_name);
                                                        setTempInitial({ 
                                                            quantity: row.initial_qty, 
                                                            amount: row.initial_amount,
                                                            price: row.unit_price,
                                                            sap_code: row.sap_code,
                                                            finance_name: row.item_name_finance || row.item_name
                                                        });
                                                    }}
                                                    sx={{ '@media print': { display: 'none' } }}
                                                >
                                                    <EditIcon sx={{ fontSize: 12 }} />
                                                </IconButton>
                                            </Box>
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        {editingInitial === row.item_name ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <TextField 
                                                    size="small" 
                                                    type="number" 
                                                    value={tempInitial.amount} 
                                                    onChange={(e) => setTempInitial({...tempInitial, amount: Number(e.target.value)})}
                                                    sx={{ width: 100 }}
                                                />
                                                <IconButton size="small" color="primary" onClick={() => handleSaveInitial(row.item_name)} disabled={isSaving}>
                                                    {isSaving ? <CircularProgress size={14} /> : <SaveIcon sx={{ fontSize: 14 }} />}
                                                </IconButton>
                                            </Box>
                                        ) : (
                                            formatNumber(row.initial_amount)
                                        )}
                                    </TableCell>

                                    <TableCell align="center">{row.inbound_qty ? formatNumber(row.inbound_qty) : '-'}</TableCell>
                                    <TableCell align="right">{formatNumber(row.inbound_amount)}</TableCell>
                                    
                                    <TableCell align="center">{row.outbound_qty ? formatNumber(row.outbound_qty) : '-'}</TableCell>
                                    <TableCell align="right">{formatNumber(row.outbound_amount)}</TableCell>
                                    
                                    <TableCell align="center">{row.return_qty ? formatNumber(row.return_qty) : '-'}</TableCell>
                                    <TableCell align="right">{formatNumber(row.return_amount)}</TableCell>
                                    
                                    <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f0f9ff' }}>{formatNumber(row.final_qty)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#f0f9ff', color: '#0369a1' }}>{formatNumber(row.final_amount)}</TableCell>
                                </TableRow>
                            ))
                        )}
                        {/* Summary Row */}
                        <TableRow sx={{ bgcolor: '#f1f5f9', fontWeight: 800 }}>
                            <TableCell colSpan={7} align="center" sx={{ fontWeight: 800 }}>TỔNG CỘNG</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.initial_qty) || 0), 0))}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.initial_amount) || 0), 0))}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.inbound_qty) || 0), 0))}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.inbound_amount) || 0), 0))}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.outbound_qty) || 0), 0))}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.outbound_amount) || 0), 0))}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.return_qty) || 0), 0))}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.return_amount) || 0), 0))}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.final_qty) || 0), 0))}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 800 }}>{formatNumber(settlementRows.reduce((a, b) => a + (Number(b.final_amount) || 0), 0))}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </Box>

            {/* Signature Section - NO FRAME */}
            <Box className="print-only" sx={{ 
                display: 'none', 
                '@media print': { display: 'block', mt: 4, width: '100%' }
            }}>
                <table className="layout-table" style={{ width: '100%', marginTop: '32px', border: 'none' }}>
                    <tbody>
                        <tr>
                            <td style={{ width: '50%', textAlign: 'center', border: 'none', verticalAlign: 'top' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>NHÂN VIÊN KHO</Typography>
                                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#64748b' }}>(Ký, họ tên)</Typography>
                                <Box sx={{ mt: 10 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>{profile?.full_name}</Typography>
                                </Box>
                            </td>
                            <td style={{ width: '50%', textAlign: 'center', border: 'none', verticalAlign: 'top' }}>
                                <Typography variant="caption" sx={{ fontStyle: 'italic', mb: 0.5, display: 'block' }}>
                                    TP.Hồ Chí Minh, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                                </Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>P. GIÁM ĐỐC QUẬN</Typography>
                                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#64748b' }}>(Ký, họ tên, đóng dấu)</Typography>
                                <Box sx={{ mt: 10 }}>
                                    <Typography variant="body2">&nbsp;</Typography>
                                </Box>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </Box>
            </Box>

            {/* Global Print Styles to ensure clean output */}
            <style>
                {`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 10mm;
                    }
                    body {
                        background: white !important;
                        margin: 0;
                        padding: 0;
                    }
                    /* Force parent containers to expand */
                    #root, main, .MuiBox-root {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .no-print, button, .MuiInputBase-root, .MuiFormControl-root, .MuiTablePagination-root, .MuiAppBar-root, .MuiDrawer-root, #chatbot-root, .MuiBackdrop-root {
                        display: none !important;
                    }
                    /* Force parent containers to expand while preserving flex layouts where needed */
                    #root, main {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .MuiPaper-root {
                        box-shadow: none !important;
                        border: none !important;
                        overflow: visible !important;
                    }
                    .MuiTableContainer-root {
                        overflow: visible !important;
                        height: auto !important;
                        max-height: none !important;
                    }
                    table {
                        border-collapse: collapse !important;
                        width: 100% !important;
                        table-layout: auto !important;
                    }
                    /* Repeat headers on every page */
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                    th, td {
                        border: 1px solid #000 !important;
                        padding: 4px 6px !important;
                        font-size: 8pt !important;
                        word-break: break-word !important;
                    }
                    /* Remove borders for layout tables */
                    .layout-table, .layout-table th, .layout-table td {
                        border: none !important;
                    }
                    th {
                        background-color: #f1f5f9 !important;
                        -webkit-print-color-adjust: exact;
                        font-weight: bold !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                }
                `}
            </style>
        </Box>
    );
};

// --- Internal Import Components ---

const InventoryReportImport: React.FC<{ onImport: (data: any[]) => Promise<void> }> = ({ onImport }) => {
    const [loading, setLoading] = useState(false);
    const { error } = useNotification();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setLoading(true);
        try {
            const data = await readExcelFile(file);
            if (!data || data.length === 0) {
                error('File Excel không có dữ liệu hoặc định dạng không đúng.');
                return;
            }

            // Map BCCS columns (Hỗ trợ nhiều biến thể tên cột)
            const mapped = data.map((row: any) => {
                const findVal = (keys: string[]) => {
                    const normalizedRow = Object.keys(row).reduce((acc: any, k) => {
                        acc[k.trim().toLowerCase()] = row[k];
                        return acc;
                    }, {});
                    const key = keys.find(k => normalizedRow[k.toLowerCase()] !== undefined);
                    return key ? normalizedRow[key.toLowerCase()] : undefined;
                };

                return {
                    unit_code: findVal(['Mã đơn vị', 'Ma don vi', 'Mã ĐV']),
                    unit_name: findVal(['Đơn vị', 'Don vi', 'Tên đơn vị']),
                    transaction_type: findVal(['Loại giao dịch', 'Loai giao dich', 'Loại GD']),
                    order_number: findVal(['Lệnh NXK', 'Lenh NXK', 'Lệnh']),
                    employee_voucher: findVal(['Số phiếu NV', 'So phieu NV', 'Số phiếu']),
                    warehouse_voucher: findVal(['Số phiếu NXK', 'So phieu NXK', 'Số phiếu kho']),
                    item_code: findVal(['Mã mặt hàng', 'Ma mat hang', 'Mã hàng', 'Mã VT']),
                    bccs_item: findVal(['Mặt hàng BCCS', 'Mat hang BCCS', 'Tên hàng BCCS', 'TÊN VẬT TƯ, HÀNG HÓA', 'Mặt hàng']),
                    finance_item: findVal(['Mặt hàng tài chính', 'Mat hang tai chinh', 'Tên hàng TC', 'Mặt hàng hạch toán']),
                    unit: findVal(['Đơn vị tính', 'ĐVT', 'Don vi tinh', 'DVT', 'Unit']),
                    unit_price: findVal(['Đơn giá', 'Don gia', 'ĐG']),
                    quantity: findVal(['Số lượng', 'So luong', 'SL']),
                    total_amount: findVal(['Thành tiền', 'Thanh tien', 'TT']),
                    voucher_date: findVal(['Ngày lập phiếu', 'Ngay lap phieu', 'Ngày chứng từ', 'Ngày lập']),
                    actual_date: findVal(['Ngày thực nhập/xuất', 'Ngay thuc nhap xuat', 'Ngày thực tế', 'Ngày thực hiện']),
                    employee_name: findVal(['Nhân viên', 'Nhan vien', 'Người thực hiện']),
                    reason: findVal(['Lý do', 'Ly do']),
                    note: findVal(['DM', 'Ghi chú', 'Ghi chu'])
                };
            });

            // Lọc bỏ các dòng trắng hoàn toàn
            const validData = mapped.filter(item => item.item_code || item.bccs_item);
            
            if (validData.length === 0) {
                error('Không tìm thấy cột dữ liệu phù hợp trong file Excel. Vui lòng kiểm tra tiêu đề cột.');
                return;
            }

            await onImport(validData);
        } catch (err: any) {
            console.error('Error reading excel:', err);
            error('Lỗi đọc file Excel: ' + err.message);
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <Button 
            variant="outlined" 
            component="label" 
            startIcon={loading ? <CircularProgress size={20} /> : <UploadFileIcon />} 
            color="primary"
            disabled={loading}
        >
            {loading ? 'Đang xử lý...' : 'Import BC Xuất Nhập'}
            <input type="file" hidden onChange={handleFile} accept=".xlsx, .xls" disabled={loading} />
        </Button>
    );
};

const OutboundReportImport: React.FC<{ onImport: (data: any[]) => Promise<void> }> = ({ onImport }) => {
    const [loading, setLoading] = useState(false);
    const { error } = useNotification();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setLoading(true);
        try {
            const data = await readExcelFile(file);
            if (!data || data.length === 0) {
                error('File Excel không có dữ liệu hoặc định dạng không đúng.');
                return;
            }

            // Map Outbound columns (Hỗ trợ nhiều biến thể tên cột)
            const mapped = data.map((row: any) => {
                const findVal = (keys: string[]) => {
                    const normalizedRow = Object.keys(row).reduce((acc: any, k) => {
                        acc[k.trim().toLowerCase()] = row[k];
                        return acc;
                    }, {});
                    const key = keys.find(k => normalizedRow[k.toLowerCase()] !== undefined);
                    return key ? normalizedRow[key.toLowerCase()] : undefined;
                };

                return {
                    cost_center_unit: findVal(['Đơn vị giá vốn', 'Don vi gia von']),
                    cost_center: findVal(['Trung tâm giá vốn', 'Trung tam gia von']),
                    cost_center_store: findVal(['Cửa hàng giá vốn', 'Cua hang gia von']),
                    cost_center_employee_code: findVal(['Mã Nhân viên/Đại lý giá vốn', 'Ma NV/Dai ly gia von']),
                    stock_out_date: findVal(['Ngày trừ kho', 'Ngay tru kho', 'Ngày xuất', 'Ngày']),
                    channel_group: findVal(['Nhóm loại kênh', 'Nhom loai kenh']),
                    channel_type: findVal(['Loại kênh', 'Loai kenh']),
                    service: findVal(['Dịch vụ', 'Dich vu']),
                    transaction_type: findVal(['Loại giao dịch', 'Loai giao dich']),
                    item_code: findVal(['Mã mặt hàng', 'Ma mat hang', 'Mã hàng', 'Mã VT', 'Mã MH hạch toán', 'Mã hạch toán', 'Mã kế toán', 'Ma MH hach toan']),
                    item_name: findVal(['Mặt hàng', 'TÊN VẬT TƯ, HÀNG HÓA', 'Mat hang', 'Tên hàng', 'Tên VT', 'Tên vật tư', 'Tên hàng hóa', 'Tên mặt hàng', 'Tên hàng BCCS', 'Tên MH hạch toán', 'Tên hạch toán']),
                    finance_item: findVal(['Mặt hàng tài chính', 'Mat hang tai chinh', 'Tên hàng TC', 'Mặt hàng hạch toán']),
                    item_type: findVal(['Loại Mặt hàng', 'Loại mặt hàng', 'DM', 'Ghi chú']),
                    qty_within_limit: findVal(['Số lượng (trong hạn mức)', 'SL (trong HM)', 'SL', 'Số lượng', 'SL xuất', 'Số lượng xuất', 'Số lượng cấp', 'Số lượng cấp phát', 'Số lượng thực tế', 'Số lượng thực xuất', 'SL thực tế', 'SL thực xuất']),
                    qty_over_limit: findVal(['Số lượng (vượt hạn mức)', 'SL (vuot HM)', 'Số lượng (ngoài hạn mức)', 'SL (ngoai HM)', 'Số lượng (ngoài HM)']),
                    qty_total: findVal(['Số lượng tổng', 'SL tổng', 'Tổng cộng', 'Tổng số lượng', 'Số lượng thực xuất']),
                    cost_price: findVal(['Đơn giá (giá vốn)', 'Don gia (gia von)', 'Đơn giá', 'Giá vốn', 'Đơn giá xuất']),
                    total_amount: findVal(['Thành tiền', 'Thanh tien', 'TT']),
                    from_serial: findVal(['Từ Serial', 'Tu Serial']),
                    to_serial: findVal(['Đến Serial', 'Den Serial']),
                    item_status: findVal(['Trạng thái hàng', 'Trang thai hang']),
                    stock_out_voucher: findVal(['Mã phiếu xuất', 'Ma phieu xuat']),
                    transaction_code: findVal(['Mã giao dịch', 'Ma giao dich']),
                    management_unit: findVal(['Đơn vị quản lý hàng hóa', 'Don vi quan ly hang hoa']),
                    vtp_transaction_type: findVal(['Loại GD VTP', 'Loai GD VTP']),
                    case_code: findVal(['Mã vụ việc', 'Ma vu viec']),
                    case_name: findVal(['Tên vụ việc', 'Ten vu viec']),
                    document_number: findVal(['Số giấy tờ', 'So giay to']),
                    customer_group: findVal(['Nhóm Khách hàng', 'Nhom Khach hang']),
                    sap_item_code: findVal(['Mã mặt hàng SAP', 'Ma mat hang SAP', 'Mã SAP']),
                    sap_item_name: findVal(['Tên mặt hàng SAP', 'Ten mat hang SAP', 'Tên SAP']),
                    sap_sync_type: findVal(['Loại dữ liệu đồng bộ SAP', 'Loai du lieu dong bo SAP']),
                    impact_type: findVal(['LOẠI TÁC ĐỘNG', 'Loai tac dong']),
                    cost_allocation: findVal(['Phân bổ giá vốn', 'Phan bo gia von'])
                };
            });

            const validData = mapped.filter(item => item.item_code || item.item_name);

            if (validData.length === 0) {
                error('Không tìm thấy cột dữ liệu phù hợp trong file Excel. Vui lòng kiểm tra tiêu đề cột.');
                return;
            }

            await onImport(validData);
        } catch (err: any) {
            console.error('Error reading excel:', err);
            error('Lỗi đọc file Excel: ' + err.message);
        } finally {
            setLoading(false);
            e.target.value = ''; // Reset input
        }
    };

    return (
        <Button 
            variant="outlined" 
            component="label" 
            startIcon={loading ? <CircularProgress size={20} /> : <UploadFileIcon />} 
            color="secondary"
            disabled={loading}
        >
            {loading ? 'Đang xử lý...' : 'Import Chi Tiết Xuất'}
            <input type="file" hidden onChange={handleFile} accept=".xlsx, .xls" disabled={loading} />
        </Button>
    );
};

export default MonthlySettlementReport;
