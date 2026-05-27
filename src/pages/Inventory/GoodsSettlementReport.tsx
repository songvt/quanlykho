import React, { useState, useMemo, useEffect } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Button,
    TextField, IconButton, Tooltip, Divider, MenuItem, Select, FormControl, InputLabel,
    CircularProgress
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
import { setInventoryReportData, setDetailedOutboundData, setGoodsInitialBalances } from '../../store/slices/settlementSlice';
import { useNotification } from '../../contexts/NotificationContext';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import { readExcelFile } from '../../utils/excelUtils';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatNumber, formatCurrency, parseExcelNumber } from '../../utils/numberUtils';
import { checkIsSameMonth } from '../../utils/dateUtils';
import {
    applyFrozenMovementsFromHistory,
    createGoodsFindStandardKey,
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
    return_qty: number;
    return_amount: number;
    final_qty: number;
    final_amount: number;
}

import { STANDARD_GOODS_31_DATA, STANDARD_GOODS_31_NAMES as STANDARD_GOODS_31 } from '../../config/settlementData';

const goodsFindStandardKey = createGoodsFindStandardKey(STANDARD_GOODS_31_DATA);

const GoodsSettlementReport: React.FC = () => {
    const dispatch = useDispatch();
    const { success, error, info } = useNotification();
    
    const { inventoryReportData, detailedOutboundData, initialBalances, profile } = useSelector((state: RootState) => ({

        inventoryReportData: state.settlement?.inventoryReportData || [],
        detailedOutboundData: state.settlement?.detailedOutboundData || [],
        initialBalances: state.settlement?.goodsInitialBalances || {},
        profile: state.auth?.profile
    }));
    
    const [selectedMonth, setSelectedMonth] = useState(() => {
        // Dùng chung key với màn hình Vật tư để đồng bộ tháng
        const saved = localStorage.getItem('settlement_selected_month');
        if (saved) return saved;
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
        // Lưu vào cả 2 key để đồng bộ với Vật tư
        localStorage.setItem('settlement_selected_month', selectedMonth);
        localStorage.setItem('settlement_goods_selected_month', selectedMonth);
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
    const [goodsItems, setGoodsItems] = useState<Set<string>>(new Set());
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



    const handleReloadStandardBalances = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn nạp lại tồn đầu kỳ chuẩn cho 31 mặt hàng hàng hóa? Thao tác này sẽ ghi đè số dư đầu kỳ hiện tại.')) return;
        
        setIsSaving(true);
        try {
            // Tạm thời set số dư mở đầu = 0 cho các mặt hàng, bạn có thể thiết lập số dư theo API sau
            const standardBalances = STANDARD_GOODS_31_DATA.map(item => ({
                item_name: item.name,
                item_code: item.code,
                sap_item_code: item.sap_item_code,
                unit: item.unit,
                unit_price: item.unit_price,
                opening_qty: 0,
                opening_amount: 0
            }));

            const payload = standardBalances.map(item => ({
                month: monthKey,
                item_code: item.item_code,
                item_name: item.item_name,
                unit: item.unit,
                unit_price: item.unit_price,
                opening_qty: item.opening_qty,
                opening_amount: item.opening_amount,
                inbound_qty: 0,
                inbound_amount: 0,
                outbound_qty: 0,
                outbound_amount: 0,
                return_qty: 0,
                return_amount: 0,
                closing_qty: item.opening_qty,
                closing_amount: item.opening_amount,
                sap_item_code: item.sap_item_code,
                finance_item_name: item.item_name
            }));

            await GoogleSheetService.saveSettlementHistory(payload);
            
            // Refresh history
            const data = await GoogleSheetService.getSettlementHistory(monthKey);
            const historyMap: Record<string, any> = {};
            data.forEach((item: any) => {
                historyMap[item.item_name] = item;
            });
            setHistoricalData(historyMap);
            
            success(`Đã nạp lại ${payload.length} mặt hàng tồn đầu kỳ chuẩn cho tháng ${selectedMonth}.`);
        } catch (err: any) {
            error('Lỗi khi nạp lại tồn đầu: ' + err.message);
        } finally {
            setIsSaving(false);
        }
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
                const goods = (products || [])
                    .filter((p: any) => {
                        const cat = (p.category || '').toLowerCase();
                        return cat.includes('h\u00e0ng h\u00f3a') || cat.includes('hanghoa') || cat.includes('hang hoa');
                    })
                    .map((p: any) => p.item_code);
                setGoodsItems(new Set(goods));

                // Luôn load tồn cuối tháng trước làm đầu kỳ trước, sau đó mới áp history hiện tại
                // Thứ tự: prevClosing → historyMap → overwrite đúng đầu kỳ
                await loadPreviousBalances(products || []);

                const historyMap = historyRecordsToMap(history || []);

                if (invData && invData.length > 0) dispatch(setInventoryReportData(invData));
                else dispatch(setInventoryReportData([]));

                if (outData && outData.length > 0) dispatch(setDetailedOutboundData(outData));
                else dispatch(setDetailedOutboundData([]));

                setHistoricalData(historyMap);

            } catch (err) {
                console.error('Lỗi khi tải dữ liệu khởi tạo:', err);
            } finally {
                setIsInitialLoading(false);
            }
        };
        fetchInitialData();
    }, [monthKey]);

    // Nhận products làm tham số để dùng ngay khi allProducts chưa được set vào state
    const loadPreviousBalances = async (productsList?: any[]) => {
        setIsLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const prevDate = new Date(year, month - 2, 1);
            const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

            const prevHistory = await GoogleSheetService.getSettlementHistory(prevMonthStr);
            const productsToUse = productsList || allProducts;

            if (prevHistory && prevHistory.length > 0) {
                const newInitialBalances: Record<string, { quantity: number; amount: number; unit_price?: number }> = {};
                prevHistory.forEach((item: any) => {
                    const product = productsToUse.find((p: any) => p.item_code === item.item_code || p.name === item.item_name);
                    const cat = (product?.category || '').toLowerCase();
                    const isStandard = STANDARD_GOODS_31.some((name: string) => name.trim().toLowerCase() === item.item_name?.trim().toLowerCase());

                    if (cat.includes('h\u00e0ng h\u00f3a') || cat.includes('hang hoa') || isStandard) {
                        // Lấy closing_qty tháng trước làm đầu kỳ tháng hiện tại
                        newInitialBalances[item.item_code || item.item_name] = {
                            quantity: Number(item.closing_qty) || 0,
                            amount: Number(item.closing_amount) || 0,
                            unit_price: Number(item.unit_price) || 0
                        };
                    }
                });
                dispatch(setGoodsInitialBalances(newInitialBalances));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const settlementRows = useMemo(() => {
        if (isInitialLoading) return [];
        const rowsMap: Record<string, SettlementRow> = {};

        const ultraNormalize = (str: string) => {
            return (str || '').normalize('NFC').toLowerCase()
                .replace(/[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi, '') 
                .trim();
        };

        const stripPrefixes = (name: string) => {
            let n = name.trim();
            const prefixes = [
                /^tm_/i, /^kd_/i, /^fullbox kd_/i, /^fullbox /i, 
                /^bh_/i, /^uc\d_/i, /^th\d_/i, /^thiết bị /i, /^thân /i
            ];
            let changed = true;
            while (changed) {
                changed = false;
                for (const p of prefixes) {
                    if (p.test(n)) {
                        n = n.replace(p, '').trim();
                        changed = true;
                    }
                }
            }
            return n;
        };

        // BẢN ĐỒ MÃ CHUẨN: Để map từ item_code sang tên chuẩn
        const standardCodeMap = new Map<string, string>();
        STANDARD_GOODS_31_DATA.forEach(item => {
            if (item.code) {
                standardCodeMap.set(item.code.trim().toLowerCase(), item.name);
            }
        });

        const findStandardKey = (name: string, code?: string) => {
            // 1. Nếu có mã và mã khớp với danh mục chuẩn -> Ưu tiên tuyệt đối
            if (code) {
                const normalizedCode = code.trim().toLowerCase();
                if (standardCodeMap.has(normalizedCode)) {
                    return standardCodeMap.get(normalizedCode)!;
                }
            }

            if (!name) return null;
            const normalizedName = name.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
            const strippedName = stripPrefixes(name.normalize('NFC')).toLowerCase();
            const ultraName = ultraNormalize(strippedName);
            
            // 2. Khớp chính xác hoặc khớp sau khi stripped/ultra
            const exactMatch = STANDARD_GOODS_31_DATA.find(item => {
                const sLow = item.name.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
                const sStripped = stripPrefixes(item.name.normalize('NFC')).toLowerCase();
                return sLow === normalizedName || 
                       sStripped === strippedName ||
                       ultraNormalize(sStripped) === ultraName;
            });
            if (exactMatch) return exactMatch.name;

            // 3. XÓA BỎ MATCH TƯƠNG ĐỐI (startsWith) VÌ GÂY TRÙNG LẶP SAI LỆCH
            return null;
        };



        // 1. Nạp dữ liệu lịch sử đầu tiên để lấy tồn đầu
        const loadedKeys = new Set<string>();
        
        Object.values(historicalData).forEach(hist => {
            const name = hist.item_name;
            const code = hist.item_code || '';
            
            // BỘ LỌC NGHIÊM NGẶT: Chỉ lấy Hàng hóa
            const product = allProducts.find(p => p.item_code === code || p.name === name);
            const cat = (product?.category || '').toLowerCase();
            const isStandard = STANDARD_GOODS_31.some(s => s.trim().toLowerCase() === name.trim().toLowerCase());
            const isMaterial = cat.includes('vật tư') || cat === 'vt';
            const hasOpening = Number(hist.opening_qty) > 0;
            
            if (isMaterial && !isStandard) return;
            if (!cat.includes('hàng hóa') && !cat.includes('hang hoa') && !isStandard && !hasOpening) return;

            const key = findStandardKey(name, code) || name;
            loadedKeys.add(key);
            
            if (!rowsMap[key]) {
                // ƯU TIÊN initialBalances (closing tháng trước) - nguồn chính xác nhất
                // hist.opening_qty có thể sai nếu tháng này chưa từng lưu đúng
                const initBal = initialBalances[code] || initialBalances[name] || initialBalances[key];
                rowsMap[key] = {
                    item_code: code,
                    item_name: key,
                    item_name_finance: hist.finance_item_name || '',
                    sap_code: hist.sap_item_code || '',
                    sap_name: hist.sap_item_name || '',
                    unit: hist.unit || 'Cái',
                    unit_price: Number(initBal?.unit_price) || Number(hist.unit_price) || 0,
                    // Nếu có initialBalances (từ closing tháng trước) → dùng, không thì fallback sang hist
                    initial_qty: initBal !== undefined ? (Number(initBal.quantity) || 0) : (Number(hist.opening_qty) || 0),
                    initial_amount: initBal !== undefined ? (Number(initBal.amount) || 0) : (Number(hist.opening_amount) || 0),
                    inbound_qty: 0, inbound_amount: 0,
                    outbound_qty: 0, outbound_amount: 0,
                    return_qty: 0, return_amount: 0,
                    final_qty: 0, final_amount: 0,
                };
            }
        });

        STANDARD_GOODS_31_DATA.forEach(item => {
            const name = item.name;
            if (loadedKeys.has(name)) return; // Đã có từ lịch sử
            
            const standardProduct = allProducts.find(p => p.item_code === item.code);
            const finalCode = item.code || standardProduct?.item_code || "";
            // Luôn dùng initialBalances (closing tháng trước) làm đầu kỳ
            const initBal = initialBalances[finalCode] || initialBalances[name];

            rowsMap[name] = {
                item_code: finalCode,
                item_name: name,
                item_name_finance: "",
                sap_code: "",
                sap_name: "",
                unit: standardProduct?.unit || 'Cái',
                unit_price: Number(initBal?.unit_price) || Number(standardProduct?.unit_price) || 0,
                initial_qty: Number(initBal?.quantity) || 0,
                initial_amount: Number(initBal?.amount) || 0,
                inbound_qty: 0, inbound_amount: 0,
                outbound_qty: 0, outbound_amount: 0,
                return_qty: 0, return_amount: 0,
                final_qty: 0, final_amount: 0,
            };
        });

        // 3. Xử lý dữ liệu nhập xuất (Báo cáo tổng hợp XNT)
        const filteredInventory = inventoryReportData;


        filteredInventory.forEach(item => {
            const rawName = (item.bccs_item || item.item_name || "").trim();
            const rawCode = (item.item_code || "").trim();
            if (!rawName && !rawCode) return;

            let key = findStandardKey(rawName, rawCode);

            // Nếu không khớp trực tiếp với 31 mặt hàng chuẩn:
            // Vẫn giữ lại nếu cột DM/Ghi chú chứa "hàng hóa"
            if (!key) {
                const excelCat = String(item.note || '').toLowerCase();
                if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) {
                    key = rawName;
                }
            }

            // Chỉ thêm vào nếu khớp danh mục chuẩn hoặc là hàng hóa phát sinh ngoài danh mục
            if (key) {
                if (!rowsMap[key]) {
                    rowsMap[key] = {
                        item_code: rawCode,
                        item_name: key,
                        item_name_finance: item.finance_item || "",
                        sap_code: "",
                        sap_name: "",
                        unit: item.unit || "Cái",
                        unit_price: Number(item.unit_price) || 0,
                        initial_qty: 0,
                        initial_amount: 0,
                        inbound_qty: 0, inbound_amount: 0,
                        outbound_qty: 0, outbound_amount: 0,
                        return_qty: 0, return_amount: 0,
                        final_qty: 0, final_amount: 0,
                    };
                }

                const qty = parseExcelNumber(item.quantity);
                const amt = parseExcelNumber(item.total_amount);
                const type = (item.transaction_type || '').toLowerCase();
                
                if (type.includes('nhập')) {
                    rowsMap[key].inbound_qty += qty;
                    rowsMap[key].inbound_amount += amt;
                } else if (type.includes('xuất')) {
                    rowsMap[key].return_qty += qty;
                    rowsMap[key].return_amount += amt;
                }
            }
            return true;
        });

        // 4. Xử lý chi tiết xuất
        let lastItemName = '';
        let lastItemCode = '';
        let lastDate: any = null;

        detailedOutboundData.forEach(item => {
            let itemName = (item.item_name || '').trim();
            let itemCode = (item.item_code || '').trim();
            let stockDate = item.stock_out_date;

            if (!itemName && !itemCode) {
                itemName = lastItemName;
                itemCode = lastItemCode;
            }
            if (!stockDate) stockDate = lastDate;
            if (itemName) lastItemName = itemName;
            if (itemCode) lastItemCode = itemCode;
            if (stockDate) lastDate = stockDate;

            if (!itemName && !itemCode) return;

            let key = findStandardKey(itemName, itemCode);

            // Nếu không khớp trực tiếp với 31 mặt hàng:
            // Chỉ thêm vào nếu cột Loại Mặt hàng chứa "hàng hóa"
            if (!key) {
                const excelCat = String(item.item_type || '').toLowerCase();
                if (excelCat.includes('hàng hóa') || excelCat.includes('hang hoa')) {
                    key = itemName;
                }
            }

            if (key) {
                if (!rowsMap[key]) {
                    rowsMap[key] = {
                        item_code: itemCode,
                        item_name: key, // Dùng key làm tên hiển thị
                        item_name_finance: item.finance_item || "",
                        sap_code: item.sap_item_code || "",
                        sap_name: item.sap_item_name || "",
                        unit: item.unit || "Cái",
                        unit_price: Number(item.cost_price) || 0,
                        initial_qty: 0,
                        initial_amount: 0,
                        inbound_qty: 0,
                        inbound_amount: 0,
                        outbound_qty: 0,
                        outbound_amount: 0,
                        return_qty: 0,
                        return_amount: 0,
                        final_qty: 0,
                        final_amount: 0,
                    };
                }
                const qWithin = parseExcelNumber(item.qty_within_limit);
                const qOver = parseExcelNumber(item.qty_over_limit);
                const qTotal = parseExcelNumber(item.qty_total);
                // Ưu tiên qty_total nếu có (là tổng hợp), nếu không thì cộng within + over
                const qty = qTotal || (qWithin + qOver);
                const amount = parseExcelNumber(item.total_amount);
                const type = (item.transaction_type || '').toLowerCase();

                if (type.includes('trả') || type.includes('thu hồi') || type.includes('thu hoi') || 
                    type.includes('điều chuyển') || type.includes('dieu chuyen') || type.includes('chuyển kho') || qty < 0) {
                    rowsMap[key].return_qty += Math.abs(qty);
                    rowsMap[key].return_amount += Math.abs(amount);
                } else {
                    rowsMap[key].outbound_qty += qty;
                    rowsMap[key].outbound_amount += amount;
                }
            }
        });

        const useFrozen = isMovementsFrozen(monthKey, 'goods');

        // 4. Tính toán tồn cuối và trả về duy nhất theo Tên
        const finalRows = Object.values(rowsMap).map(row => {
            if (useFrozen) {
                applyFrozenMovementsFromHistory(row, historicalData, true);
            } else {
                row.final_qty = row.initial_qty + row.inbound_qty - row.outbound_qty - row.return_qty;
                row.final_amount =
                    row.initial_amount + row.inbound_amount - row.outbound_amount - row.return_amount;
            }
            return row;
        });

        // LỌC CUỐI CÙNG: Đảm bảo Tên vật tư hàng hóa là duy nhất
        const finalUniqueMap = new Map<string, SettlementRow>();
        
        finalRows.forEach(row => {
            const isStandard = STANDARD_GOODS_31.includes(row.item_name);
            const hasData = row.initial_qty !== 0 || row.inbound_qty !== 0 || row.outbound_qty !== 0 || row.return_qty !== 0;
            
            if (isStandard || hasData) {
                const nameKey = row.item_name.trim();
                // Chỉ lấy dòng đầu tiên gặp được cho mỗi tên, không lấy dòng thứ hai trùng tên
                if (!finalUniqueMap.has(nameKey)) {
                    finalUniqueMap.set(nameKey, row);
                }
            }
        });

        return Array.from(finalUniqueMap.values()).sort((a, b) => {
            const idxA = STANDARD_GOODS_31.indexOf(a.item_name);
            const idxB = STANDARD_GOODS_31.indexOf(b.item_name);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.item_name.localeCompare(b.item_name, 'vi');
        });
    }, [inventoryReportData, detailedOutboundData, selectedMonth, historicalData, initialBalances, allProducts, isInitialLoading]);




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
            await GoogleSheetService.clearSettlementMovements(monthKey, historicalData, 'goods');
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
                return_qty: row.return_qty,
                return_amount: row.return_amount,
                closing_qty: tempInitial.quantity + row.inbound_qty - row.outbound_qty - row.return_qty,
                closing_amount: tempInitial.amount + row.inbound_amount - row.outbound_amount - row.return_amount,
                sap_item_code: tempInitial.sap_code,
                finance_item_name: tempInitial.finance_name,
            }]);
            setHistoricalData(prev => ({
                ...prev,
                [name]: { ...prev[name], opening_qty: tempInitial.quantity, opening_amount: tempInitial.amount, unit_price: tempInitial.price, sap_item_code: tempInitial.sap_code, finance_item_name: tempInitial.finance_name }
            }));
            setEditingInitial(null);
            success(`Đã cập nhật tồn đầu kỳ cho ${name}.`);
        } catch (err: any) {
            error('Lỗi khi lưu: ' + err.message);
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
                return_qty: row.return_qty,
                return_amount: row.return_amount,
                closing_qty: row.final_qty,
                closing_amount: row.final_amount,
                sap_item_code: row.sap_code,
                finance_item_name: row.item_name_finance,
            }));
            await GoogleSheetService.saveSettlementHistory(payload);
            markMovementsFrozen(monthKey, 'goods');
            await reloadHistory();
            success(`Đã chốt quyết toán Hàng hóa tháng ${monthKey}.`);
        } catch (err: any) {
            console.error('Save error:', err);
            error('Lỗi khi chốt tháng: ' + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Quyet_Toan_Hang_Hoa');

        // 1. COMPANY & SLOGAN HEADERS
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT';
        sheet.getCell('A1').font = { bold: true, size: 11 };
        sheet.getCell('A1').alignment = { horizontal: 'center' };

        sheet.mergeCells('A2:E2');
        sheet.getCell('A2').value = 'TRUNG TÂM QUẬN 12';
        sheet.getCell('A2').font = { bold: true, size: 11 };
        sheet.getCell('A2').alignment = { horizontal: 'center' };

        sheet.mergeCells('K1:P1');
        sheet.getCell('K1').value = 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM';
        sheet.getCell('K1').font = { bold: true, size: 11 };
        sheet.getCell('K1').alignment = { horizontal: 'center' };

        sheet.mergeCells('K2:P2');
        sheet.getCell('K2').value = 'Độc lập - Tự do - Hạnh phúc';
        sheet.getCell('K2').font = { italic: true, size: 10 };
        sheet.getCell('K2').alignment = { horizontal: 'center' };

        // 2. MAIN TITLE
        sheet.mergeCells('A4:P4');
        const titleCell = sheet.getCell('A4');
        titleCell.value = 'BIÊN BẢN XÁC NHẬN CÔNG NỢ HÀNG HÓA';
        titleCell.font = { bold: true, size: 18 };
        titleCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A5:P5');
        const subTitleCell = sheet.getCell('A5');
        subTitleCell.value = '(Tài khoản 1412.01 - Tạm ứng vật tư - VTT)';
        subTitleCell.font = { italic: true, size: 11 };
        subTitleCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A6:P6');
        const monthCell = sheet.getCell('A6');
        monthCell.value = `Tháng quyết toán: ${selectedMonth.split('-').reverse().join('/')}`;
        monthCell.font = { size: 11 };
        monthCell.alignment = { horizontal: 'center' };

        sheet.mergeCells('A7:P7');
        const targetCell = sheet.getCell('A7');
        targetCell.value = 'Đối tượng tạm ứng: ACT - TRUNG TÂM QUẬN 12';
        targetCell.font = { bold: true, size: 11 };
        targetCell.alignment = { horizontal: 'center' };

        // Columns Headers
        const headerRow1 = [
            'TT', 'TÊN VẬT TƯ, HÀNG HÓA', 'MÃ VT, HÀNG HÓA', 'MÃ MH HẠCH TOÁN', 'TÊN MH HẠCH TOÁN', 'ĐVT', 'ĐƠN GIÁ',
            'DƯ ĐẦU KỲ', '', 'NHẬP TRONG KỲ', '', 'XUẤT TRONG KỲ', '', 'TRẢ KHO', '', 'TỒN CUỐI KỲ', ''
        ];
        const headerRow2 = [
            '', '', '', '', '', '', '',
            'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền', 'Số lượng', 'Thành tiền'
        ];

        sheet.addRow(headerRow1);
        sheet.addRow(headerRow2);
        
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
            'TỔNG CỘNG', '', '', '', '', '', 
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
            if (colNumber >= 7) {
                cell.numFmt = '#,##0';
                cell.alignment = { horizontal: 'right' };
            }
        });
        sheet.mergeCells(`A${summaryRow.number}:F${summaryRow.number}`);

        // 4. SIGNATURES
        sheet.addRow([]); sheet.addRow([]);
        const signRow1 = sheet.addRow(['', 'NHÂN VIÊN KHO', '', '', '', '', '', '', '', '', 'TP.Hồ Chí Minh, ngày ' + new Date().getDate() + ' tháng ' + (new Date().getMonth() + 1) + ' năm ' + new Date().getFullYear()]);
        const signRow2 = sheet.addRow(['', '(Ký, họ tên)', '', '', '', '', '', '', '', '', 'P. GIÁM ĐỐC QUẬN']);
        const signRow3 = sheet.addRow(['', '', '', '', '', '', '', '', '', '', '(Ký, họ tên, đóng dấu)']);
        
        [signRow1, signRow2, signRow3].forEach(sr => {
            sr.getCell(2).font = { bold: true };
            sr.getCell(11).font = { bold: true };
            sr.getCell(2).alignment = { horizontal: 'center' };
            sr.getCell(11).alignment = { horizontal: 'center' };
        });
        
        sheet.addRow([]); sheet.addRow([]); sheet.addRow([]);
        const nameRow = sheet.addRow(['', profile?.full_name || '', '', '', '', '', '', '', '', '', '']);
        nameRow.getCell(2).font = { bold: true };
        nameRow.getCell(2).alignment = { horizontal: 'center' };
        nameRow.getCell(11).alignment = { horizontal: 'center' };

        // Auto width
        sheet.columns.forEach(col => { col.width = 15; });
        sheet.getColumn(2).width = 30;

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
        saveAs(new Blob([buffer]), `Quyet_Toan_Hang_Hoa_${selectedMonth}.xlsx`);
        success('Đã xuất file Excel thành công.');
    };

    const handleExportPDF = async () => {
        const input = document.getElementById('goods-settlement-content');
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
                    const clonedInput = clonedDoc.getElementById('goods-settlement-content');
                    if (clonedInput) {
                        clonedInput.style.width = '1600px';
                        clonedInput.style.padding = '40px';
                        clonedInput.style.backgroundColor = 'white';
                        clonedInput.style.overflow = 'visible';
                        clonedInput.style.display = 'block';
                        
                        // Áp dụng font Times New Roman cho toàn bộ bản in
                        clonedInput.style.fontFamily = '"Times New Roman", Times, serif';
                        
                        // Xử lý tiêu đề và các phần tử không viền
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
                            (mainTable as any).style.tableLayout = 'auto';
                            const cells = mainTable.querySelectorAll('th, td');
                            cells.forEach((cell: any) => {
                                cell.style.border = '1px solid black';
                                cell.style.padding = '2px 1.5px';
                                cell.style.fontSize = '6.5pt'; // Siêu nhỏ cho bảng 17 cột hàng hóa
                                cell.style.color = 'black';
                                cell.style.fontFamily = '"Times New Roman", Times, serif';
                                cell.style.minWidth = 'auto';
                                cell.style.whiteSpace = 'normal';
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
            pdf.save(`Quyet_Toan_Hang_Hoa_${selectedMonth}.pdf`);
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
            options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return options;
    }, []);

    return (
        <Box sx={{ pb: 10 }}>
            <Paper sx={{ p: 2, mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, '@media print': { display: 'none' } }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>QUYẾT TOÁN HÀNG HÓA - ĐÃ CẬP NHẬT v3</Typography>
                        <Typography variant="body2" color="text.secondary">Dành riêng cho phân hệ Hàng hóa (Thiết bị, Wifi, Camera...).</Typography>
                    </Box>

                    <Tooltip title="Nạp lại tồn đầu kỳ chuẩn cho 31 mặt hàng">
                        <IconButton onClick={handleReloadStandardBalances} color="warning" size="small">
                            <HistoryIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                        <InputLabel>Chọn tháng</InputLabel>
                        <Select value={selectedMonth} label="Chọn tháng" onChange={(e) => setSelectedMonth(e.target.value)}>
                            {monthOptions.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button 
                        variant="outlined" 
                        startIcon={isLoading ? <CircularProgress size={16} /> : <HistoryIcon />} 
                        onClick={() => loadPreviousBalances()}
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
                    <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>In Biên bản (A4)</Button>
                </Box>
            </Paper>

            <Box id="goods-settlement-content" sx={{ fontFamily: '"Times New Roman", Times, serif' }}>
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
                    <Typography variant="h5" align="center" sx={{ fontWeight: 800, mt: 3 }}>BIÊN BẢN XÁC NHẬN CÔNG NỢ HÀNG HÓA</Typography>
                    <Typography variant="body2" align="center" sx={{ fontStyle: 'italic' }}>(Tài khoản 1412.01 - Tạm ứng vật tư - VTT)</Typography>
                    <Typography variant="body2" align="center">Tháng quyết toán: {selectedMonth.split('-').reverse().join('/')}</Typography>
                    <Typography variant="body2" align="center" sx={{ fontWeight: 700 }}>Đối tượng tạm ứng: ACT - TRUNG TÂM QUẬN 12</Typography>
                </Box>

            <Box component="div" sx={{ 
                borderRadius: 0,
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
                    '& th, & td': { 
                        border: '1px solid #e0e0e0', 
                        padding: '4px 6px',
                        fontSize: '0.72rem',
                        whiteSpace: 'nowrap',
                        fontFamily: '"Times New Roman", Times, serif',
                        '@media print': {
                            border: '1px solid black',
                            fontSize: '0.52rem',
                            padding: '2px 1.5px',
                            minWidth: 'auto !important',
                            whiteSpace: 'normal !important'
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
                        {settlementRows.map((row, index) => (
                            <TableRow key={row.item_code} hover>
                                <TableCell align="center">{index + 1}</TableCell>
                                <TableCell sx={{ fontWeight: 600, whiteSpace: 'normal !important', minWidth: 200 }}>{row.item_name}</TableCell>
                                <TableCell>{row.item_code}</TableCell>
                                <TableCell>{row.sap_code || '---'}</TableCell>
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
                                <TableCell align="right">{formatNumber(row.unit_price)}</TableCell>
                                
                                {/* 1. DƯ ĐẦU KỲ */}
                                <TableCell align="center">
                                    {editingInitial === row.item_name ? (
                                        <TextField size="small" type="number" value={tempInitial.quantity} onChange={(e) => setTempInitial({...tempInitial, quantity: Number(e.target.value), amount: Number(e.target.value) * tempInitial.price})} sx={{ width: 60 }} />
                                    ) : (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                                            {formatNumber(row.initial_qty)}
                                            <IconButton size="small" onClick={() => { setEditingInitial(row.item_name); setTempInitial({ quantity: row.initial_qty, amount: row.initial_amount, price: row.unit_price, sap_code: row.sap_code, finance_name: row.item_name_finance }); }} className="no-print"><EditIcon sx={{ fontSize: 12 }} /></IconButton>
                                        </Box>
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    {editingInitial === row.item_name ? (
                                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                                            <TextField size="small" type="number" value={tempInitial.amount} onChange={(e) => setTempInitial({...tempInitial, amount: Number(e.target.value)})} sx={{ width: 100 }} />
                                            <IconButton size="small" color="primary" onClick={() => handleSaveInitial(row.item_name)}><SaveIcon sx={{ fontSize: 14 }} /></IconButton>
                                        </Box>
                                    ) : (
                                        formatNumber(row.initial_amount)
                                    )}
                                </TableCell>

                                {/* 2. NHẬP TRONG KỲ */}
                                <TableCell align="center">{row.inbound_qty ? formatNumber(row.inbound_qty) : '-'}</TableCell>
                                <TableCell align="right">{formatNumber(row.inbound_amount)}</TableCell>

                                {/* 3. XUẤT TRONG KỲ */}
                                <TableCell align="center">{row.outbound_qty ? formatNumber(row.outbound_qty) : '-'}</TableCell>
                                <TableCell align="right">{formatNumber(row.outbound_amount)}</TableCell>

                                {/* 4. TRẢ KHO */}
                                <TableCell align="center">{row.return_qty ? formatNumber(row.return_qty) : '-'}</TableCell>
                                <TableCell align="right">{formatNumber(row.return_amount)}</TableCell>

                                {/* 5. TỒN CUỐI KỲ */}
                                <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f0f9ff' }}>{formatNumber(row.final_qty)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#f0f9ff' }}>{formatNumber(row.final_amount)}</TableCell>
                            </TableRow>
                        ))}
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

            <style>{`
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
                    /* Force parent containers to expand while preserving flex layouts where needed */
                    #root, main {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                        position: static !important;
                    }
                    .no-print, button, .MuiInputBase-root, .MuiFormControl-root, .MuiTablePagination-root, .MuiAppBar-root, .MuiDrawer-root, #chatbot-root, .MuiBackdrop-root {
                        display: none !important;
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
                    thead {
                        display: table-header-group !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                    th, td {
                        border: 1px solid #000 !important;
                        padding: 2px 1.5px !important;
                        font-size: 6.5pt !important;
                        word-break: break-word !important;
                        min-width: auto !important;
                        white-space: normal !important;
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
            `}</style>
        </Box>
    );
};



export default GoodsSettlementReport;
