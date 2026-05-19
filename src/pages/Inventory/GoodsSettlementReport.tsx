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

// DANH MỤC CHUẨN 31 MẶT HÀNG HÀNG HÓA KÈM MÃ VẬT TƯ
const STANDARD_GOODS_31_DATA = [
    { name: "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", code: "ZXHN_HV3601P_UCT" },
    { name: "Home Wifi 6 VHT 32X6V1", code: "HWF_vAP_32X6V1" },
    { name: "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3", code: "TM_STB2C-IP826_UC3" },
    { name: "Camera trong nhà HC24", code: "CAMPTZ_T3_HC24" },
    { name: "Điện thoại IP GXP1610", code: "IP_GXP1610" },
    { name: "ONT wifi 6 VHT vGP-42X6V1", code: "42X6V1" },
    { name: "ONT GWN7062G cho KHDN", code: "GWN7062G" },
    { name: "Home Wifi chuẩn Wifi 6_HV3601P", code: "ZXHN_HV3601P" },
    { name: "Camera trong nhà HC23 3M_UCTT", code: "CAMPTZ_JF_HC23_3M UCTT" },
    { name: "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT", code: "ZXHN_F6601P_UCTT" },
    { name: "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", code: "TM_ATV_IP952_UC3" },
    { name: "ONT wifi 6 VHT vGP-42X6V1_UCTT", code: "42X6V1_UCTT" },
    { name: "Thiết bị ONT XS0426GP", code: "XS0426GP" },
    { name: "ONT WiFi 6 NPE3036GV", code: "NPE3036GV" },
    { name: "Home WiFi 6 NR3053", code: "HWF_NR3053" },
    { name: "ONT WiFi 6 NPE3036GV_UCTT", code: "NPE3036GV_UCTT" },
    { name: "Card Gateway 4 cổng FXS_UCTT", code: "ATA4C_UCTT" },
    { name: "STB Android TV 4K AV1_ZTE_B866V6M", code: "AV1_ZTE_B866V6M" },
    { name: "TM_Home Wifi 6 VHT 32X6V1_UC1", code: "TM_HWF_vAP_32X6V1_UC1" },
    { name: "TM_ONT Dualband vG-421WD_UC3", code: "TM_VT-421WD_UC3" },
    { name: "Home Wifi 6 ZTE HV3601P_V9.3_UCTT", code: "HWF_ZTE3601P_V9.3_UCTT" },
    { name: "Fullbox KD_ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_TH2", code: "ZXHN_F6601P_Fullbox_TH2" },
    { name: "Home WiFi 6 NR3053_UCTT", code: "HWF_NR3053_UCTT" },
    { name: "TM_ATV-SKYWORTH- HP40A-STB Android TV 4K_BH_UC3", code: "TM_ATV-SKYWORTH-HP40A_BH_UC3" },
    { name: "TM_Homewifi Dualband ZTE H196A_BH_UC2", code: "TM_HWF_H196A_BH_UC2" },
    { name: "Thân Camera trong nhà HC23 3M_TH2_UCTT", code: "CAMPTZ_JF_HC23_3M_TH2_TM_UCTT" },
    { name: "Camera ngoài trời HC34_3M", code: "CAMMOD_T3_HC34_3M" },
    { name: "Cảm biến khói wifi PA-443", code: "PA443" },
    { name: "KD_TBĐC Settopbox_STB Android 4K_ATV_IP952_Fullbox_TH3", code: "ATV_IP952_Fullbox_TH3" },
    { name: "KD_TBĐC Settopbox_STB Android TV 4K_TV360_ATV_SDMC_DV9135_Fullbox_TH3", code: "TV360_ATV_SDMC_DV9135_Fullbox_TH3" },
    { name: "TM_TV360_ATV_ICTECH_IP151N _STB Android TV 4K_UC3", code: "TM_TV360_ATV_ICTECH_IP151N_UC3" }
];

const STANDARD_GOODS_31 = STANDARD_GOODS_31_DATA.map(item => item.name);
const goodsFindStandardKey = createGoodsFindStandardKey(STANDARD_GOODS_31_DATA);

const GoodsSettlementReport: React.FC = () => {
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
        const saved = localStorage.getItem('settlement_goods_selected_month');
        if (saved) return saved;
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    useEffect(() => {
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

    const syncMovementsAndReload = async (invData: any[], outData: any[], historyMap: Record<string, any>) => {
        await GoogleSheetService.syncSettlementMovements(monthKey, invData, outData, 'goods', historyMap, {
            findStandardKey: goodsFindStandardKey,
        });
        return reloadHistory();
    };

    const handleReloadStandardBalances = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn nạp lại tồn đầu kỳ chuẩn cho 31 mặt hàng hàng hóa? Thao tác này sẽ ghi đè số dư đầu kỳ hiện tại.')) return;
        
        setIsSaving(true);
        try {
            const standardBalances = [
                { item_name: "Home Wifi chuẩn Wifi 6_HV3601P_UCTT", item_code: "ZXHN_HV3601P_UCT", sap_item_code: "01040849135", unit: "Chiếc", unit_price: 350000, opening_qty: 7, opening_amount: 2450000 },
                { item_name: "Home Wifi 6 VHT 32X6V1", item_code: "HWF_vAP_32X6V1", sap_item_code: "01040853629", unit: "Cái", unit_price: 413000, opening_qty: 39, opening_amount: 16107000 },
                { item_name: "TM_TBĐC Settopbox 2 chiều IP Hisense IP826_UC3", item_code: "TM_STB2C-IP826_UC3", sap_item_code: "010406237", unit: "Chiếc", unit_price: 30000, opening_qty: 5, opening_amount: 150000 },
                { item_name: "Camera trong nhà HC24", item_code: "CAMPTZ_T3_HC24", sap_item_code: "01040860843", unit: "Bộ", unit_price: 260000, opening_qty: 118, opening_amount: 30680000 },
                { item_name: "Điện thoại IP GXP1610", item_code: "IP_GXP1610", sap_item_code: "01071279", unit: "Chiếc", unit_price: 590000, opening_qty: 2, opening_amount: 1180000 },
                { item_name: "ONT wifi 6 VHT vGP-42X6V1", item_code: "42X6V1", sap_item_code: "01040853628", unit: "Cái", unit_price: 550000, opening_qty: 1137, opening_amount: 625350000 },
                { item_name: "ONT GWN7062G cho KHDN", item_code: "GWN7062G", sap_item_code: "01040850031", unit: "Cái", unit_price: 1690000, opening_qty: 5, opening_amount: 8450000 },
                { item_name: "Home Wifi chuẩn Wifi 6_HV3601P", item_code: "ZXHN_HV3601P", sap_item_code: "01040849135", unit: "Cái", unit_price: 350000, opening_qty: 20, opening_amount: 7000000 },
                { item_name: "Camera trong nhà HC23 3M_UCTT", item_code: "CAMPTZ_JF_HC23_3M UCTT", sap_item_code: "01040849169", unit: "Bộ", unit_price: 313000, opening_qty: 2, opening_amount: 626000 },
                { item_name: "ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_UCTT", item_code: "ZXHN_F6601P_UCTT", sap_item_code: "01040849134", unit: "Chiếc", unit_price: 470000, opening_qty: 19, opening_amount: 8930000 },
                { item_name: "TM_ATV_HISENSE_IP952_STB Android TV 4K_UC3", item_code: "TM_ATV_IP952_UC3", sap_item_code: "500002651", unit: "Cái", unit_price: 156333, opening_qty: 7, opening_amount: 1094331 },
                { item_name: "ONT wifi 6 VHT vGP-42X6V1_UCTT", item_code: "42X6V1_UCTT", sap_item_code: "", unit: "Cái", unit_price: 550000, opening_qty: 184, opening_amount: 101200000 },
                { item_name: "Thiết bị ONT XS0426GP", item_code: "XS0426GP", sap_item_code: "", unit: "Cái", unit_price: 1196000, opening_qty: 52, opening_amount: 62192000 },
                { item_name: "ONT WiFi 6 NPE3036GV", item_code: "NPE3036GV", sap_item_code: "", unit: "Cái", unit_price: 392000, opening_qty: 173, opening_amount: 86500000 },
                { item_name: "Home WiFi 6 NR3053", item_code: "HWF_NR3053", sap_item_code: "", unit: "Cái", unit_price: 500000, opening_qty: 538, opening_amount: 210896000 },
                { item_name: "ONT WiFi 6 NPE3036GV_UCTT", item_code: "NPE3036GV_UCTT", sap_item_code: "", unit: "Cái", unit_price: 500000, opening_qty: 12, opening_amount: 6000000 },
                { item_name: "Card Gateway 4 cổng FXS_UCTT", item_code: "ATA4C_UCTT", sap_item_code: "", unit: "Cái", unit_price: 2230000, opening_qty: 1, opening_amount: 2230000 },
                { item_name: "STB Android TV 4K AV1_ZTE_B866V6M", item_code: "AV1_ZTE_B866V6M", sap_item_code: "", unit: "Cái", unit_price: 483300, opening_qty: 268, opening_amount: 129524400 },
                { item_name: "TM_Home Wifi 6 VHT 32X6V1_UC1", item_code: "TM_HWF_vAP_32X6V1_UC1", sap_item_code: "", unit: "Cái", unit_price: 413000, opening_qty: 7, opening_amount: 2891000 },
                { item_name: "TM_ONT Dualband vG-421WD_UC3", item_code: "TM_VT-421WD_UC3", sap_item_code: "", unit: "Cái", unit_price: 45455, opening_qty: 2, opening_amount: 90910 },
                { item_name: "Home Wifi 6 ZTE HV3601P_V9.3_UCTT", item_code: "HWF_ZTE3601P_V9.3_UCTT", sap_item_code: "", unit: "Cái", unit_price: 375000, opening_qty: 10, opening_amount: 3750000 },
                { item_name: "Fullbox KD_ONT 4 cổng Dualband Wifi 6 ZTE_F6601P_TH2", item_code: "ZXHN_F6601P_Fullbox_TH2", sap_item_code: "", unit: "Cái", unit_price: 142000, opening_qty: 35, opening_amount: 4970000 },
                { item_name: "Home WiFi 6 NR3053_UCTT", item_code: "HWF_NR3053_UCTT", sap_item_code: "", unit: "Cái", unit_price: 392000, opening_qty: 8, opening_amount: 3136000 },
                { item_name: "TM_ATV-SKYWORTH- HP40A-STB Android TV 4K_BH_UC3", item_code: "TM_ATV-SKYWORTH-HP40A_BH_UC3", sap_item_code: "", unit: "Cái", unit_price: 86800, opening_qty: 1, opening_amount: 86800 },
                { item_name: "TM_Homewifi Dualband ZTE H196A_BH_UC2", item_code: "TM_HWF_H196A_BH_UC2", sap_item_code: "", unit: "Cái", unit_price: 64800, opening_qty: 101, opening_amount: 6544800 },
                { item_name: "Thân Camera trong nhà HC23 3M_TH2_UCTT", item_code: "CAMPTZ_JF_HC23_3M_TH2_TM_UCTT", sap_item_code: "", unit: "Cái", unit_price: 27137, opening_qty: 8, opening_amount: 217096 },
                { item_name: "Camera ngoài trời HC34_3M", item_code: "CAMMOD_T3_HC34_3M", sap_item_code: "", unit: "Cái", unit_price: 402000, opening_qty: 61, opening_amount: 24522000 },
                { item_name: "Cảm biến khói wifi PA-443", item_code: "PA443", sap_item_code: "", unit: "Cái", unit_price: 274000, opening_qty: 168, opening_amount: 46032000 },
                { item_name: "KD_TBĐC Settopbox_STB Android 4K_ATV_IP952_Fullbox_TH3", item_code: "ATV_IP952_Fullbox_TH3", sap_item_code: "", unit: "Cái", unit_price: 273680, opening_qty: 57, opening_amount: 15599760 },
                { item_name: "KD_TBĐC Settopbox_STB Android TV 4K_TV360_ATV_SDMC_DV9135_Fullbox_TH3", item_code: "TV360_ATV_SDMC_DV9135_Fullbox_TH3", sap_item_code: "", unit: "Cái", unit_price: 284300, opening_qty: 32, opening_amount: 9097600 },
                { item_name: "TM_TV360_ATV_ICTECH_IP151N _STB Android TV 4K_UC3", item_code: "TM_TV360_ATV_ICTECH_IP151N_UC3", sap_item_code: "", unit: "Cái", unit_price: 150000, opening_qty: 30, opening_amount: 4500000 }
            ];

            const payload = standardBalances.map(item => ({
                month: selectedMonth,
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
            const data = await GoogleSheetService.getSettlementHistory(selectedMonth);
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
                        return cat.includes('hàng hóa') || cat.includes('hanghoa') || cat.includes('hang hoa');
                    })
                    .map((p: any) => p.item_code);
                setGoodsItems(new Set(goods));

                let historyMap = historyRecordsToMap(history || []);

                if (invData && invData.length > 0) dispatch(setInventoryReportData(invData));
                else dispatch(setInventoryReportData([]));

                if (outData && outData.length > 0) dispatch(setDetailedOutboundData(outData));
                else dispatch(setDetailedOutboundData([]));

                const hasDetail = (invData?.length || 0) > 0 || (outData?.length || 0) > 0;
                if (hasDetail && !isMovementsFrozen(monthKey, 'goods')) {
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

    const loadPreviousBalances = async () => {
        setIsLoading(true);
        try {
            const [year, month] = selectedMonth.split('-').map(Number);
            const prevDate = new Date(year, month - 2, 1);
            const prevMonthStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

            info(`Đang kiểm tra số dư tồn cuối tháng ${prevMonthStr}...`);
            const prevHistory = await GoogleSheetService.getSettlementHistory(prevMonthStr);

            if (prevHistory && prevHistory.length > 0) {
                const newInitialBalances: Record<string, { quantity: number; amount: number; unit_price?: number }> = {};
                prevHistory.forEach((item: any) => {
                    const product = allProducts.find(p => p.item_code === item.item_code || p.name === item.item_name);
                    const cat = (product?.category || '').toLowerCase();
                    const isStandard = STANDARD_GOODS_31.some(name => name.trim().toLowerCase() === item.item_name?.trim().toLowerCase());

                    if (cat.includes('hàng hóa') || cat.includes('hang hoa') || isStandard) {
                        newInitialBalances[item.item_code || item.item_name] = {
                            quantity: Number(item.closing_qty) || 0,
                            amount: Number(item.closing_amount) || 0,
                            unit_price: Number(item.unit_price) || 0
                        };
                    }
                });
                dispatch(setInitialBalances(newInitialBalances));
                success(`Đã tự động chuyển tồn cuối ${prevMonthStr} sang đầu kỳ ${selectedMonth}.`);
            } else {
                info(`Không tìm thấy dữ liệu chốt tháng ${prevMonthStr}. Bạn có thể nhập thủ công.`);
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
                rowsMap[key] = {
                    item_code: code,
                    item_name: key,
                    item_name_finance: hist.finance_item_name || '',
                    sap_code: hist.sap_item_code || '',
                    sap_name: hist.sap_item_name || '',
                    unit: hist.unit || 'Cái',
                    unit_price: Number(hist.unit_price) || 0,
                    initial_qty: Number(hist.opening_qty) || 0,
                    initial_amount: Number(hist.opening_amount) || 0,
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
        const filteredInventory = inventoryReportData.filter(item => {
            const date = item.actual_date || item.voucher_date;
            return date ? checkIsSameMonth(date, selectedMonth) : true;
        });

        filteredInventory.forEach(item => {
            const rawName = (item.bccs_item || item.item_name || "").trim();
            const rawCode = (item.item_code || "").trim();
            if (!rawName && !rawCode) return;

            const key = findStandardKey(rawName, rawCode);

            // Chỉ thêm vào nếu khớp với danh mục chuẩn (31 mặt hàng)
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
            
            const isMonth = (stockDate && stockDate !== 'null' && stockDate !== 'undefined') ? checkIsSameMonth(stockDate, selectedMonth) : true;
            if (!isMonth) return;

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
                const qty = (qWithin + qOver) || qTotal;
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


    const handleInventoryImport = async (data: any[]) => {
        setIsLoading(true);
        try {
            await GoogleSheetService.saveSettlementInventory(monthKey, data);
            dispatch(setInventoryReportData(data));
            const historyMap = await syncMovementsAndReload(data, detailedOutboundData, historicalData);
            setHistoricalData(historyMap);
            success(`Đã lưu và chốt dữ liệu Nhập Xuất Hàng hóa tháng ${monthKey}.`);
        } catch (err: any) {
            error('Lỗi khi lưu dữ liệu: ' + err.message);
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
            success(`Đã lưu và chốt ${data.length} dòng Xuất Hàng hóa tháng ${monthKey}. Cột XUẤT TRONG KỲ giữ nguyên khi tải lại.`);
        } catch (err: any) {
            error('Lỗi khi lưu dữ liệu: ' + err.message);
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
                    <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                    <InventoryReportImport onImport={handleInventoryImport} />
                    <OutboundReportImport onImport={handleOutboundImport} />
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

// --- Reuse imports from MonthlySettlement ---
const InventoryReportImport: React.FC<{ onImport: (data: any[]) => Promise<void> }> = ({ onImport }) => {
    const [loading, setLoading] = useState(false);
    const { error } = useNotification();

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLoading(true);
        try {
            const data = await readExcelFile(file);
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
                    item_code: findVal(['Mã mặt hàng', 'Ma mat hang', 'Mã hàng', 'Mã VT']),
                    bccs_item: findVal(['Mặt hàng BCCS', 'Mat hang BCCS', 'Tên hàng BCCS', 'TÊN VẬT TƯ, HÀNG HÓA', 'Mặt hàng']),
                    transaction_type: findVal(['Loại giao dịch', 'Loai giao dich', 'Loại GD']),
                    quantity: Number(findVal(['Số lượng', 'So luong', 'SL'])) || 0,
                    unit_price: Number(findVal(['Đơn giá', 'Don gia', 'ĐG'])) || 0,
                    total_amount: Number(findVal(['Thành tiền', 'Thanh tien', 'TT'])) || 0,
                    voucher_date: findVal(['Ngày lập phiếu', 'Ngay lap phieu', 'Ngày chứng từ', 'Ngày lập']),
                    actual_date: findVal(['Ngày thực nhập/xuất', 'Ngay thuc nhap xuat', 'Ngày thực tế', 'Ngày thực hiện']),
                    note: findVal(['DM', 'Ghi chú', 'Ghi chu'])
                };
            });
            await onImport(mapped.filter(i => i.item_code || i.bccs_item));
        } catch (err: any) { error('Lỗi file: ' + err.message); } finally { setLoading(false); }
    };

    return (
        <Button component="label" variant="outlined" size="small" startIcon={loading ? <CircularProgress size={16} /> : <UploadFileIcon />} disabled={loading}>
            Nhập Xuất
            <input type="file" hidden accept=".xlsx, .xls" onChange={handleFile} />
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
                    item_code: findVal(['Mã mặt hàng', 'Ma mat hang', 'Mã hàng', 'Mã VT', 'Mã MH hạch toán', 'Mã hạch toán', 'Mã kế toán', 'Ma MH hach toan']),
                    item_name: findVal(['Mặt hàng', 'TÊN VẬT TƯ, HÀNG HÓA', 'Mat hang', 'Tên hàng', 'Tên VT', 'Tên vật tư', 'Tên hàng hóa', 'Tên mặt hàng', 'Tên hàng BCCS', 'Tên MH hạch toán', 'Tên hạch toán']),
                    finance_item: findVal(['Mặt hàng tài chính', 'Mat hang tai chinh', 'Tên hàng TC', 'Mặt hàng hạch toán']),
                    item_type: findVal(['Loại Mặt hàng', 'Loai Mat hang']),
                    qty_within_limit: findVal(['Số lượng (trong hạn mức)', 'SL (trong HM)', 'SL', 'Số lượng', 'SL xuất', 'Số lượng xuất', 'Số lượng cấp', 'Số lượng cấp phát', 'Số lượng thực tế', 'Số lượng thực xuất', 'SL thực tế', 'SL thực xuất']),
                    qty_over_limit: findVal(['Số lượng (vượt hạn mức)', 'SL (vuot HM)', 'Số lượng (ngoài hạn mức)', 'SL (ngoai HM)', 'Số lượng (ngoài HM)']),
                    qty_total: findVal(['Số lượng tổng', 'SL tổng', 'Tổng cộng', 'Tổng số lượng', 'Số lượng thực xuất']),
                    total_amount: findVal(['Thành tiền', 'Thanh tien', 'TT']),
                    stock_out_date: findVal(['Ngày trừ kho', 'Ngay tru kho', 'Ngày xuất', 'Ngày', 'Ngày thực nhập/xuất']),
                    cost_price: findVal(['Đơn giá (giá vốn)', 'Don gia (gia von)', 'Đơn giá', 'Giá vốn', 'Đơn giá xuất'])
                };
            });
            await onImport(mapped.filter(i => i.item_code || i.item_name));
        } catch (err: any) { error('Lỗi file: ' + err.message); } finally { setLoading(false); }
    };

    return (
        <Button component="label" variant="outlined" size="small" startIcon={loading ? <CircularProgress size={16} /> : <UploadFileIcon />} disabled={loading}>
            Chi tiết Xuất
            <input type="file" hidden accept=".xlsx, .xls" onChange={handleFile} />
        </Button>
    );
};

export default GoodsSettlementReport;
