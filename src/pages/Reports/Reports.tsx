import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Typography, Button, Card, CardContent, CardActions, Stack, Grid, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Autocomplete, Alert, FormControl, InputLabel, Select, MenuItem,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, Tab, Tabs, Paper
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DownloadIcon from '@mui/icons-material/Download';
import InventoryIcon from '@mui/icons-material/Inventory';
import ReceiptIcon from '@mui/icons-material/Receipt';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningIcon from '@mui/icons-material/Warning';
import PrintIcon from '@mui/icons-material/Print';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
    Warehouse, 
    ArrowUpDown, 
    History, 
    FileSignature, 
    Users, 
    FileSpreadsheet, 
    MapPin, 
    Hourglass, 
    ShoppingCart,
    Download
} from 'lucide-react';

import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchInventory, selectStockMap, selectDetailedStockMap } from '../../store/slices/inventorySlice';
import { fetchOrders } from '../../store/slices/ordersSlice';
import { fetchTransactions, deleteTransaction } from '../../store/slices/transactionsSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';
import { exportHandoverMinutesV2, exportStandardReport } from '../../utils/excelUtils';
import type { ReportColumn } from '../../utils/excelUtils';
import HandoverPreview from '../../components/Reports/HandoverPreview';
import ReturnsReportPreview from '../../components/Reports/ReturnsReportPreview';
import { formatCurrency, getLocalYYYYMMDD, matchDistrict, formatPhone } from '../../utils/format';
import { formatDate, parseDate } from '../../utils/dateUtils';
import PageHeader from '../../components/Common/PageHeader';
import { AppButton } from '../../components/Common/AppButton';

const Reports = () => {
    const dispatch = useDispatch<AppDispatch>();

    // Selectors
    const { items: products, status: productsStatus } = useSelector((state: RootState) => state.products);
    const stockMap = useSelector(selectStockMap);
    const detailedStockMap = useSelector(selectDetailedStockMap);
    const { items: transactions, status } = useSelector((state: RootState) => state.transactions);
    const { items: returns } = useSelector((state: RootState) => state.returns);
    const { items: orders } = useSelector((state: RootState) => state.orders);
    const { items: employees } = useSelector((state: RootState) => state.employees);
    // Access profile for role checks
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin';

    // State for Handover Dialog
    const [openHandover, setOpenHandover] = useState(false);
    const [handoverType, setHandoverType] = useState<'inbound' | 'outbound'>('outbound');
    // Auto-fill for Staff
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(
        isAdmin ? null : (profile?.full_name || profile?.username || profile?.email || '')
    );
    const [selectedDate, setSelectedDate] = useState<string>(getLocalYYYYMMDD());

    // State for Preview
    const [openHandoverPreview, setOpenHandoverPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isExportingPDF, setIsExportingPDF] = useState(false);

    // State for Stock Card Report
    const [openStockCard, setOpenStockCard] = useState(false);
    const [stockStartDate, setStockStartDate] = useState(getLocalYYYYMMDD());
    const [stockEndDate, setStockEndDate] = useState(getLocalYYYYMMDD());

    // State for period report
    const [openPeriodReport, setOpenPeriodReport] = useState(false);
    const [periodType, setPeriodType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [cStart, setCStart] = useState(getLocalYYYYMMDD());
    const [cEnd, setCEnd] = useState(getLocalYYYYMMDD());

    // State for Employee Report
    const [openEmployeeReport, setOpenEmployeeReport] = useState(false);
    const [employeeReportType, setEmployeeReportType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [employeeReportTimeRange, setEmployeeReportTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [employeeReportStart, setEmployeeReportStart] = useState(getLocalYYYYMMDD());
    const [employeeReportEnd, setEmployeeReportEnd] = useState(getLocalYYYYMMDD());
    const [reportEmployeeId, setReportEmployeeId] = useState<string | null>(null);

    const [selectedTab, setSelectedTab] = useState(0);

    // Data Management State
    const [startDate, setStartDate] = useState(getLocalYYYYMMDD());
    const [endDate, setEndDate] = useState(getLocalYYYYMMDD());
    const [filterType, setFilterType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [deleteProcessing, setDeleteProcessing] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);

    // Initial Fetch
    useEffect(() => {
        dispatch(fetchProducts());
        dispatch(fetchInventory());
        dispatch(fetchTransactions());
        dispatch(fetchOrders());
        if (isAdmin) dispatch(fetchEmployees());
    }, [dispatch, isAdmin]);

    useEffect(() => {
        if (status === 'idle') dispatch(fetchTransactions());
        if (productsStatus === 'idle') dispatch(fetchProducts());
    }, [status, productsStatus, dispatch]);

    const parseSafeDate = (val: any) => {
        if (!val) return null;
        return parseDate(val);
    };

    const getHandoverData = () => {
        if (handoverType === 'inbound') {
            return returns.filter(r => {
                const dateVal = r.return_date || (r as any).date || (r as any).inbound_date;
                const parsedDate = parseSafeDate(dateVal) || parseSafeDate(r.created_at);
                if (!parsedDate) return false;
                
                const dStr = getLocalYYYYMMDD(parsedDate);
                const empName = (r.employee?.full_name || (r as any).user_name || '').trim();
                const matchUser = selectedEmployee ? (empName.toLowerCase() === selectedEmployee.toLowerCase()) : true;
                return dStr === selectedDate && matchUser;
            }).map((r: any) => ({
                item_code: r.product?.item_code || 'N/A',
                product_name: r.product?.name || 'Sản phẩm đã xóa',
                unit: r.product?.unit || 'Cái',
                quantity: r.quantity,
                unit_price: r.unit_price,
                serial_code: r.serial_code,
                note: r.reason || '',
                district: r.employee?.district || '',
                item_status: r.item_status || 'Hàng thu hồi',
                date: r.created_at || r.return_date,
                type: 'inbound'
            }));
        }

        return transactions.filter(t => {
            const dateVal = (t as any).outbound_date || t.date;
            const parsedDate = parseSafeDate(dateVal) || parseSafeDate((t as any).created_at);
            if (!parsedDate) return false;
            
            const dStr = getLocalYYYYMMDD(parsedDate);
            const empName = (t.group_name || (t as any).receiver_group || '').trim();
            const matchUser = selectedEmployee ? (empName.toLowerCase() === selectedEmployee.toLowerCase()) : true;
            return t.type === 'outbound' && dStr === selectedDate && matchUser;
        }).map(t => ({
             item_code: t.product?.item_code || 'N/A',
            product_name: t.product?.name || 'Sản phẩm đã xóa',
            unit: t.product?.unit || 'Cái',
            quantity: t.quantity,
            unit_price: t.unit_price,
            serial_code: t.serial_code,
            note: t.group_name || t.receiver_group,
            district: t.district,
            item_status: t.item_status,
            date: t.date,
            type: 'outbound'
        }));
    };

    // Filter transactions for Management Tab
    const managementTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (!startDate && !endDate) return false; // Only show if filtered
            const dateVal = t.date || (t as any).outbound_date || (t as any).inbound_date;
            const parsedDate = parseSafeDate(dateVal) || parseSafeDate((t as any).created_at);
            if (!parsedDate) return false;
            
            const tDate = getLocalYYYYMMDD(parsedDate);
            if (startDate && tDate < startDate) return false;
            if (endDate && tDate > endDate) return false;
            if (filterType !== 'all' && t.type !== filterType) return false;
            return true;
        });
    }, [transactions, startDate, endDate, filterType]);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(managementTransactions.map(t => t.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        setDeleteProcessing(true);
        try {
            for (const id of selectedIds) {
                const transaction = transactions.find(t => t.id === id);
                if (transaction) {
                    await dispatch(deleteTransaction({ id, type: transaction.type })).unwrap();
                }
            }
            // Refetch inventory to update counts
            dispatch(fetchInventory());
            setNotification({ type: 'success', message: `Đã xóa ${selectedIds.length} giao dịch thành công!` });
            setSelectedIds([]);
            setOpenDeleteConfirm(false);
        } catch (err) {
            console.error(err);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xóa dữ liệu.' });
        } finally {
            setDeleteProcessing(false);
        }
    };

    // Ensure selectedEmployee is set for staff even if profile loads late
    useEffect(() => {
        if (!isAdmin && profile) {
            setSelectedEmployee(profile.full_name || profile.username || profile.email || '');
        }
    }, [isAdmin, profile]);

    // Get current user from auth state (already accessed above)
    const reporterName = profile?.full_name || profile?.username || profile?.email || 'Admin';

    const handleExportInventory = () => {
        if (products.length === 0) { setNotification({ type: 'error', message: 'Không có dữ liệu sản phẩm' }); return; }

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'MÃ SKU', key: 'item_code', width: 15 },
            { header: 'TÊN SẢN PHẨM', key: 'name', width: 30 },
            { header: 'DANH MỤC', key: 'category', width: 15 },
            { header: 'ĐƠN VỊ', key: 'unit', width: 10, align: 'center' },
            { header: 'ĐƠN GIÁ', key: 'unit_price_formatted', width: 15, align: 'right' },
            { header: 'TỒN KHO', key: 'stock', width: 10, align: 'center' },
        ];

        const data = products.map(p => ({
            item_code: p.item_code,
            name: p.name,
            category: p.category,
            unit: p.unit,
            unit_price_formatted: formatCurrency(p.unit_price),
            stock: stockMap[p.id] || 0
        }));

        exportStandardReport(
            data,
            `Bao_cao_ton_kho_${formatDate(new Date()).replace(/\//g, '-')}`,
            'BÁO CÁO TỒN KHO CHI TIẾT',
            columns,
            reporterName
        );
    };

    const handleExportTransactions = () => {
        if (transactions.length === 0) { setNotification({ type: 'error', message: 'Không có dữ liệu giao dịch' }); return; }

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'MÃ GIAO DỊCH', key: 'id', width: 15 },
            { header: 'LOẠI', key: 'type', width: 12, align: 'center' },
            { header: 'NGÀY', key: 'date', width: 20, align: 'center' },
            { header: 'SẢN PHẨM', key: 'product', width: 25 },
            { header: 'ĐƠN GIÁ', key: 'price', width: 15, align: 'right' },
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
            { header: 'THÀNH TIỀN', key: 'total', width: 15, align: 'right' },
            { header: 'TRẠNG THÁI', key: 'item_status', width: 15, align: 'center' },
            { header: 'QUẬN/HUYỆN', key: 'district', width: 15, align: 'center' },
            { header: 'NGƯỜI NHẬN', key: 'partner', width: 20 },
            { header: 'NGƯỜI THỰC HIỆN', key: 'user', width: 20 },
            { header: 'SERIAL', key: 'serial', width: 15 },
        ];

        const data = transactions.map(t => ({
            id: t.id.substring(0, 8), // Shorten ID for better display
            type: t.type === 'inbound' ? 'Nhập kho' : 'Xuất kho',
            date: formatDate(t.date || (t as any).outbound_date || (t as any).inbound_date),
            product: t.product?.name || t.product_id,
            price: formatCurrency(t.unit_price || 0),
            quantity: t.quantity,
            total: formatCurrency((t.quantity || 0) * (t.unit_price || 0)),
            item_status: t.item_status || '',
            district: t.district || '',
            partner: t.group_name || 'N/A',
            user: t.user_name || 'N/A',
            serial: t.serial_code || ''
        }));

        exportStandardReport(
            data,
            `Lich_su_giao_dich_${formatDate(new Date()).replace(/\//g, '-')}`,
            'LỊCH SỬ GIAO DỊCH XUẤT NHẬP KHO',
            columns,
            reporterName
        );
    };

    const handleExportOrders = () => {
        if (orders.length === 0) { setNotification({ type: 'error', message: 'Không có dữ liệu đơn hàng' }); return; }

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'MÃ ĐƠN', key: 'id', width: 15 },
            { header: 'NGÀY ĐẶT', key: 'date', width: 20, align: 'center' },
            { header: 'NGƯỜI YÊU CẦU', key: 'requester', width: 20 },
            { header: 'SẢN PHẨM', key: 'product', width: 25 },
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
            { header: 'TRẠNG THÁI', key: 'status', width: 15, align: 'center' },
        ];

        const data = orders.map(o => {
            let statusText: string = o.status;
            switch (o.status) {
                case 'pending': statusText = 'Chờ duyệt'; break;
                case 'approved': statusText = 'Đã duyệt'; break;
                case 'completed': statusText = 'Hoàn thành'; break;
                case 'rejected': statusText = 'Từ chối'; break;
                default: statusText = o.status;
            }
            const productObj = products.find(p => p.id === o.product_id);
            const d = new Date(o.order_date);
            const formattedDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

            return {
                id: o.id.substring(0, 8),
                date: formattedDate,
                requester: o.requester_group,
                product: productObj ? productObj.name : (o.product?.name || o.product_id),
                quantity: o.quantity,
                status: statusText
            };
        });

        exportStandardReport(
            data,
            `Danh_sach_don_hang_${formatDate(new Date()).replace(/\//g, '-')}`,
            'DANH SÁCH ĐƠN HÀNG',
            columns,
            reporterName
        );
    };

    const handleExportStockCard = () => {
        // Calculate Stock Card Data
        const startDate = new Date(stockStartDate);
        const endDate = new Date(stockEndDate);
        endDate.setHours(23, 59, 59, 999); // Include entire end day

        const reportData = products.map(product => {
            let openingStock = 0;
            let importPeriod = 0;
            let exportPeriod = 0;

            // Filter transactions for this product
            const productTrans = transactions.filter(t => t.product_id === product.id);

            productTrans.forEach(t => {
                const tDate = new Date(t.date);

                // Opening Stock: Transactions BEFORE start date
                if (tDate < startDate) {
                    if (t.type === 'inbound') openingStock += t.quantity;
                    else openingStock -= t.quantity;
                }
                // Period Transactions: Inside range
                else if (tDate <= endDate) {
                    if (t.type === 'inbound') importPeriod += t.quantity;
                    else exportPeriod -= t.quantity;
                }
            });

            const closingStock = openingStock + importPeriod - exportPeriod;

            return {
                item_code: product.item_code,
                name: product.name,
                unit: product.unit,
                opening: openingStock,
                import: importPeriod,
                export: exportPeriod,
                closing: closingStock
            };
        }).filter(item => !(item.opening === 0 && item.import === 0 && item.export === 0 && item.closing === 0));

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'MÃ HÀNG', key: 'item_code', width: 15 },
            { header: 'TÊN HÀNG HÓA', key: 'name', width: 30 },
            { header: 'ĐVT', key: 'unit', width: 8, align: 'center' },
            { header: 'TỒN ĐẦU', key: 'opening', width: 10, align: 'center' },
            { header: 'NHẬP', key: 'import', width: 10, align: 'center' },
            { header: 'XUẤT', key: 'export', width: 10, align: 'center' },
            { header: 'TỒN CUỐI', key: 'closing', width: 10, align: 'center' },
        ];

        exportStandardReport(
            reportData,
            `Bao_cao_xuat_nhap_ton_${stockStartDate}_${stockEndDate}`,
            `BÁO CÁO XUẤT NHẬP TỒN (${stockStartDate} - ${stockEndDate})`,
            columns,
            reporterName
        );
        setOpenStockCard(false);
    };

    const handleExportStockByDistrict = () => {
        if (products.length === 0) { setNotification({ type: 'error', message: 'Không có dữ liệu sản phẩm' }); return; }

        // detailedStockMap keys: `${productId}|${districtKey}|${statusKey}`
        // Group by District -> Product
        const data: any[] = [];

        // We iterate products to ensure we list essential items, but stock is in map.
        // Actually, let's iterate detailedStockMap to find where items are.
        // But iterating map keys is better for "what exists".
        // HOWEVER, user might want to see specific products. 
        // Let's iterate keys of detailedStockMap to capture all non-zero stock locations.

        Object.entries(detailedStockMap).forEach(([key, quantity]) => {
            if (quantity <= 0) return; // Skip zero/negative stock for report clarity? User might want to see 0? 
            // Usually stock report shows what is available.

            const [productId, district, status] = key.split('|');
            const product = products.find(p => p.id === productId);

            if (product) {
                data.push({
                    item_code: product.item_code,
                    name: product.name,
                    district: district || 'Chưa phân loại',
                    item_status: status || 'N/A',
                    quantity: quantity,
                    unit: product.unit
                });
            }
        });

        if (data.length === 0) { setNotification({ type: 'error', message: 'Không có dữ liệu tồn kho chi tiết theo khu vực' }); return; }

        // Sort by District then Name
        data.sort((a, b) => {
            if (a.district === b.district) return a.name.localeCompare(b.name);
            return a.district.localeCompare(b.district);
        });

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'QUẬN/HUYỆN', key: 'district', width: 15, align: 'center' },
            { header: 'MÃ HÀNG', key: 'item_code', width: 15 },
            { header: 'TÊN HÀNG HÓA', key: 'name', width: 30 },
            { header: 'TRẠNG THÁI', key: 'item_status', width: 15, align: 'center' },
            { header: 'ĐVT', key: 'unit', width: 10, align: 'center' },
            { header: 'TỒN KHO', key: 'quantity', width: 12, align: 'center' },
        ];

        exportStandardReport(
            data.map((item, index) => ({ ...item, stt: index + 1 })),
            `Ton_kho_theo_quan_${formatDate(new Date()).replace(/\//g, '-')}`,
            'BÁO CÁO TỒN KHO THEO KHU VỰC',
            columns,
            reporterName
        );
    };

    const calculateReportNumber = (targetDate: string, targetEmployee: string) => {
        const [year, month] = targetDate.split('-');
        const currentMonthPrefix = `${year}-${month}`;

        const uniqueHandovers = new Set<string>();
        if (handoverType === 'inbound') {
            returns.forEach(r => {
                const d = r.created_at || r.return_date || '';
                if (d && getLocalYYYYMMDD(new Date(d)).startsWith(currentMonthPrefix)) {
                    const dateStr = getLocalYYYYMMDD(new Date(d));
                    const empName = (r.employee?.full_name || '').toLowerCase().trim();
                    if (empName) {
                        uniqueHandovers.add(`${dateStr}|${empName}`);
                    }
                }
            });
        } else {
            transactions.forEach(t => {
                if (t.type === 'outbound' && getLocalYYYYMMDD(t.date).startsWith(currentMonthPrefix)) {
                    const dateStr = getLocalYYYYMMDD(t.date);
                    const empName = (t.group_name || t.receiver_group || t.user_name || '').toLowerCase().trim();
                    if (empName) {
                        uniqueHandovers.add(`${dateStr}|${empName}`);
                    }
                }
            });
        }

        const sortedHandovers = Array.from(uniqueHandovers).sort();
        const targetEmpStr = targetEmployee.toLowerCase().trim();
        
        // Find the index of the matching combination
        const matchIndex = sortedHandovers.findIndex(h => h.startsWith(`${targetDate}|`) && h.includes(targetEmpStr));
        
        if (matchIndex !== -1) {
            return matchIndex + 1;
        }
        return sortedHandovers.length + 1;
    };

    const handleExportHandover = async () => {
        const exportData = getHandoverData();
        if (exportData.length === 0) {
            setNotification({ type: 'error', message: `Không tìm thấy phiếu ${handoverType === 'inbound' ? 'nhập' : 'xuất'} kho nào cho nhân viên "${selectedEmployee}" vào ngày ${selectedDate}.` });
            return;
        }

        // Prepare data
        const formattedData = exportData;

        // Find employee to get phone number
        const receiverObj = employees.find(e => e.full_name === selectedEmployee);
        const receiverPhone = receiverObj?.phone_number || '';
        const senderPhone = profile?.phone_number || '';
        const empDistrict = receiverObj?.district || '';

        // Resolve Sender (Reporter) Name based on District
        let resolvedSenderName = reporterName;
        const firstItemWithDistrict = formattedData.find(i => i.district);
        const transactionDistrict = firstItemWithDistrict?.district || '';
        const searchDistrict = empDistrict || transactionDistrict;

        if (searchDistrict) {
            try {
                const { GoogleSheetService } = await import('../../services/GoogleSheetService');
                const dConfigs = await GoogleSheetService.getDistrictStorekeepers();
                const config = dConfigs.find((c: any) => matchDistrict(searchDistrict, c.district));
                if (config) {
                    resolvedSenderName = config.storekeeper_name;
                }
            } catch (e) {
                console.error('Failed to parse GS configs for handover export', e);
            }
        }

        const num = calculateReportNumber(selectedDate, selectedEmployee || '');
        const reportNumber = num.toString();

        try {
            await exportHandoverMinutesV2(formattedData, selectedEmployee || 'N/A', selectedDate, resolvedSenderName, formatPhone(senderPhone), formatPhone(receiverPhone), reportNumber);
        } catch (error: any) {
            console.error(error);
            setNotification({ type: 'error', message: "Lỗi xuất báo cáo: " + (error?.message || JSON.stringify(error)) });
        }
        setOpenHandover(false);
    };

    // State for dynamic sender in preview
    const [previewSenderName, setPreviewSenderName] = useState('');
    const [previewSenderPhone, setPreviewSenderPhone] = useState('');
    const [previewReceiverPhone, setPreviewReceiverPhone] = useState('');
    const [previewReportNumber, setPreviewReportNumber] = useState(1);

    const handlePreviewHandover = async (autoPrint = false) => {
        const handoverData = getHandoverData();
        if (handoverData.length === 0) {
            setNotification({ type: 'error', message: `Không tìm thấy phiếu ${handoverType === 'inbound' ? 'nhập' : 'xuất'} kho nào cho nhân viên "${selectedEmployee}" vào ngày ${selectedDate}.` });
            return;
        }

        const formattedData = handoverData;

        // Resolve Sender (Reporter) Name & Phone based on District logic
        let resolvedSenderName = reporterName;
        // Default Profile Phones
        const senderPh = profile?.phone_number || '';

        // Find employee phone
        const receiverObj = employees.find(e => e.full_name === selectedEmployee);
        const receiverPh = receiverObj?.phone_number || '';
        const empDistrict = receiverObj?.district || '';

        const firstItemWithDistrict = formattedData.find(i => i.district);
        const transactionDistrict = firstItemWithDistrict?.district || '';
        const searchDistrict = empDistrict || transactionDistrict;

        if (searchDistrict) {
            try {
                const { GoogleSheetService } = await import('../../services/GoogleSheetService');
                const dConfigs = await GoogleSheetService.getDistrictStorekeepers();
                const config = dConfigs.find((c: any) => matchDistrict(searchDistrict, c.district));
                if (config) {
                    resolvedSenderName = config.storekeeper_name;
                }
            } catch (e) {
                console.error('Failed to parse GS configs for handover preview', e);
            }
        }

        const num = calculateReportNumber(selectedDate, selectedEmployee || '');
        setPreviewSenderName(resolvedSenderName);
        setPreviewSenderPhone(formatPhone(senderPh));
        setPreviewReceiverPhone(formatPhone(receiverPh));
        setPreviewReportNumber(num);

        setPreviewData(formattedData);
        setOpenHandoverPreview(true);
        setOpenHandover(false);

        if (autoPrint) {
            setTimeout(() => {
                handlePrint();
            }, 500); // 500ms allows the modal to finish animating in
        }
    };

    const handleExportPDF = async () => {
        const handoverData = getHandoverData();
        if (handoverData.length === 0) {
            setNotification({ type: 'error', message: `Không tìm thấy phiếu ${handoverType === 'inbound' ? 'nhập' : 'xuất'} kho nào cho nhân viên "${selectedEmployee}" vào ngày ${selectedDate}.` });
            return;
        }

        const formattedData = handoverData;

        // Resolve Sender (Reporter) Name & Phone based on District logic
        let resolvedSenderName = reporterName;
        const senderPh = profile?.phone_number || '';
        const receiverObj = employees.find(e => e.full_name === selectedEmployee);
        const receiverPh = receiverObj?.phone_number || '';
        const empDistrict = receiverObj?.district || '';

        const firstItemWithDistrict = formattedData.find(i => i.district);
        const transactionDistrict = firstItemWithDistrict?.district || '';
        const searchDistrict = empDistrict || transactionDistrict;

        if (searchDistrict) {
            try {
                const { GoogleSheetService } = await import('../../services/GoogleSheetService');
                const dConfigs = await GoogleSheetService.getDistrictStorekeepers();
                const config = dConfigs.find((c: any) => matchDistrict(searchDistrict, c.district));
                if (config) {
                    resolvedSenderName = config.storekeeper_name;
                }
            } catch (e) {
                console.error('Failed to parse GS configs for handover export pdf', e);
            }
        }

        const num = calculateReportNumber(selectedDate, selectedEmployee || '');
        setPreviewSenderName(resolvedSenderName);
        setPreviewSenderPhone(formatPhone(senderPh));
        setPreviewReceiverPhone(formatPhone(receiverPh));
        setPreviewReportNumber(num);
        setPreviewData(formattedData);
        setIsExportingPDF(true);

        setTimeout(async () => {
            const input = document.getElementById('hidden-pdf-container');
            if (!input) {
                setIsExportingPDF(false);
                return;
            }
            try {
                // Safe resolution of constructors
                const html2canvasFn = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
                const jsPDFClass = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).jsPDF || (jsPDF as any).default;

                if (!html2canvasFn) {
                    throw new Error('html2canvas library is not loaded correctly.');
                }
                if (!jsPDFClass) {
                    throw new Error('jsPDF library is not loaded correctly.');
                }

                const canvas = await html2canvasFn(input, { 
                    scale: 2, 
                    useCORS: true,
                    windowWidth: 1000,
                    width: 900
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDFClass('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
                
                const [yyyy, mm, dd] = selectedDate.split('-');
                const dateFormatted = `${dd}${mm}${yyyy}`;
                const prefix = handoverType === 'inbound' ? 'BBNK' : 'BBXK';
                const empName = selectedEmployee ? selectedEmployee.trim() : 'NhanVien';
                const fileName = `${prefix}_${empName} ${dateFormatted}.pdf`;
                pdf.save(fileName);

                // Auto-upload to Google Drive
                try {
                    const pdfBlob = pdf.output('blob');
                    const reader = new FileReader();
                    reader.readAsDataURL(pdfBlob);
                    reader.onloadend = async () => {
                        const base64Data = (reader.result as string).split(',')[1];
                        const driveFileName = `${prefix}_${empName.replace(/\s+/g, '_')}_${dateFormatted}.pdf`;
                        try {
                            const response = await fetch('/api/drive_upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    fileName: driveFileName,
                                    mimeType: 'application/pdf',
                                    fileData: base64Data
                                })
                            });
                            const result = await response.json();
                            if (response.ok) {
                                setNotification({ type: 'success', message: `Đã xuất file PDF và tự động lưu lên Google Drive thành công.` });
                            } else {
                                const errMsg = result.details || result.error || 'Server error';
                                setNotification({ type: 'error', message: `Đã xuất PDF về máy thành công nhưng lỗi lưu Google Drive: ${errMsg}` });
                            }
                        } catch (uploadErr: any) {
                            console.error('Drive upload failed:', uploadErr);
                            setNotification({ type: 'error', message: `Đã xuất PDF về máy thành công nhưng lỗi kết nối Drive: ${uploadErr.message}` });
                        }
                    };
                } catch (blobErr: any) {
                    console.error('Failed to generate PDF blob for Drive:', blobErr);
                }
            } catch (error: any) {
                console.error("Error exporting PDF:", error);
                setNotification({ type: 'error', message: 'Lỗi xuất PDF: ' + (error?.message || error) });
            } finally {
                setIsExportingPDF(false);
                setOpenHandover(false);
            }
        }, 800);
    };

    const handlePrint = () => {
        const [yyyy, mm, dd] = selectedDate.split('-');
        const dateFormatted = `${dd}${mm}${yyyy}`;
        const prefix = handoverType === 'inbound' ? 'BBNK' : 'BBXK';
        const empName = selectedEmployee ? selectedEmployee.trim() : 'NhanVien';
        const newTitle = `${prefix}_${empName} ${dateFormatted}`;

        const originalTitle = document.title;
        document.title = newTitle;
        window.print();
        
        // Restore title after print dialog closes
        setTimeout(() => {
            document.title = originalTitle;
        }, 500);
    };

    const handleExportPeriodReport = () => {
        let start = new Date();
        let end = new Date();

        if (timeRange === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (timeRange === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (timeRange === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        } else {
            start = new Date(cStart);
            start.setHours(0, 0, 0, 0);
            end = new Date(cEnd);
            end.setHours(23, 59, 59, 999);
        }

        const filtered = transactions.filter(t => {
            const d = new Date(t.date);
            const matchDate = d >= start && d <= end;
            const matchType = periodType === 'all' ? true : t.type === periodType;
            return matchDate && matchType;
        });

        if (filtered.length === 0) {
            setNotification({ type: 'error', message: 'Không có dữ liệu giao dịch trong khoảng thời gian này.' });
            return;
        }

        const reportData = filtered.map((t, index) => {
            const product = products.find(p => p.id === t.product_id);
            return {
                stt: index + 1,
                date: formatDate(t.date),
                type: t.type === 'inbound' ? 'Nhập' : 'Xuất',
                item_code: product?.item_code || '',
                name: product?.name || '',
                quantity: t.quantity,
                unit: product?.unit || '',
                item_status: t.item_status || '',
                district: t.district || '',
                serial: t.serial_code || '',
                receiver: t.group_name || t.user_name || '',
                price: t.unit_price || 0,
                total: (t.quantity * (t.unit_price || 0))
            };
        });

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'NGÀY', key: 'date', width: 12, align: 'center' },
            { header: 'LOẠI', key: 'type', width: 10, align: 'center' },
            { header: 'MÃ HÀNG', key: 'item_code', width: 15 },
            { header: 'TÊN HÀNG', key: 'name', width: 30 },
            { header: 'ĐVT', key: 'unit', width: 8, align: 'center' },
            { header: 'ĐƠN GIÁ', key: 'price', width: 15, align: 'right' },
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
            { header: 'THÀNH TIỀN', key: 'total', width: 15, align: 'right' },
            { header: 'TRẠNG THÁI', key: 'item_status', width: 15, align: 'center' },
            { header: 'QUẬN/HUYỆN', key: 'district', width: 15, align: 'center' },
            { header: 'SERIAL', key: 'serial', width: 20 },
            { header: 'NGƯỜI NHẬN / GHI CHÚ', key: 'receiver', width: 25 },
        ];

        exportStandardReport(
            reportData,
            `Bao_cao_${periodType}_${timeRange}_${new Date().getTime()}`,
            `BÁO CÁO ${periodType === 'all' ? 'NHẬP XUẤT' : (periodType === 'inbound' ? 'NHẬP KHO' : 'XUẤT KHO')}`,
            columns,
            reporterName
        );
        setOpenPeriodReport(false);
    };

    const handleExportEmployeeReport = () => {
        let start = new Date();
        let end = new Date();

        if (employeeReportTimeRange === 'today') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else if (employeeReportTimeRange === 'week') {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        } else if (employeeReportTimeRange === 'month') {
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            end.setHours(23, 59, 59, 999);
        } else {
            start = new Date(employeeReportStart);
            start.setHours(0, 0, 0, 0);
            end = new Date(employeeReportEnd);
            end.setHours(23, 59, 59, 999);
        }

        const filtered = transactions.filter(t => {
            const d = new Date(t.date);
            const matchDate = d >= start && d <= end;
            const matchType = employeeReportType === 'all' ? true : t.type === employeeReportType;

            // Check employee ID
            let matchEmployee = true;
            if (reportEmployeeId) {
                // Assuming 'employees' has the ID. If not perfectly linked, filter by Name
                const selectedEmp = employees.find(e => e.id === reportEmployeeId);
                const empName = selectedEmp?.full_name || '';

                matchEmployee = ((t as any).created_by === reportEmployeeId) ||
                    Boolean(t.user_name && t.user_name.includes(empName)) ||
                    Boolean(t.group_name && t.group_name.includes(empName));
            }

            return matchDate && matchType && matchEmployee;
        });

        if (filtered.length === 0) {
            setNotification({ type: 'error', message: 'Không có dữ liệu giao dịch cho nhân viên này trong khoảng thời gian đã chọn.' });
            return;
        }

        const reportData = filtered.map((t, index) => {
            const product = products.find(p => p.id === t.product_id);
            return {
                stt: index + 1,
                date: new Date(t.date).toLocaleDateString('vi-VN'),
                type: t.type === 'inbound' ? 'Nhập' : 'Xuất',
                emp_name: t.user_name || (t as any).created_by || '',
                item_code: product?.item_code || '',
                name: product?.name || '',
                quantity: t.quantity,
                unit: product?.unit || '',
                price: t.unit_price || 0,
                total: (t.quantity * (t.unit_price || 0)),
                serial: t.serial_code || '',
                receiver: t.group_name || ''
            };
        });

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'NGÀY', key: 'date', width: 12, align: 'center' },
            { header: 'LOẠI', key: 'type', width: 10, align: 'center' },
            { header: 'NHÂN VIÊN', key: 'emp_name', width: 25 },
            { header: 'MÃ HÀNG', key: 'item_code', width: 15 },
            { header: 'TÊN HÀNG', key: 'name', width: 30 },
            { header: 'ĐVT', key: 'unit', width: 8, align: 'center' },
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
            { header: 'ĐƠN GIÁ', key: 'price', width: 15, align: 'right' },
            { header: 'THÀNH TIỀN', key: 'total', width: 15, align: 'right' },
            { header: 'SERIAL', key: 'serial', width: 20 },
            { header: 'BÊN NHẬN/GIAO', key: 'receiver', width: 25 },
        ];

        const empName = reportEmployeeId ? employees.find(e => e.id === reportEmployeeId)?.full_name || 'NV' : 'TAT_CA';
        exportStandardReport(
            reportData,
            `Bao_cao_NV_${empName}_${employeeReportType}_${new Date().getTime()}`,
            `BÁO CÁO GIAO DỊCH NHÂN VIÊN: ${reportEmployeeId ? empName.toUpperCase() : 'TẤT CẢ'}`,
            columns,
            reporterName
        );
        setOpenEmployeeReport(false);
    };

    const handleExportFifoAging = async () => {
        try {
            const data = await import('../../services/GoogleSheetService').then(m => m.GoogleSheetService.getFifoInventoryAging());
            if (!data || data.length === 0) {
                setNotification({ type: 'error', message: 'Không có dữ liệu hàng tồn kho quá hạn (theo FIFO).' });
                return;
            }

            const columns: ReportColumn[] = [
                { header: 'STT', key: 'stt', width: 6, align: 'center' },
                { header: 'MÃ HÀNG', key: 'item_code', width: 15 },
                { header: 'TÊN HÀNG', key: 'product_name', width: 30 },
                { header: 'SERIAL', key: 'serial_code', width: 20 },
                { header: 'NGÀY NHẬP', key: 'inbound_date', width: 15, align: 'center' },
                { header: 'TUỔI KHO (NGÀY)', key: 'days_in_stock', width: 12, align: 'center' },
                { header: 'SỐ LƯỢNG TỒN', key: 'quantity_remaining', width: 15, align: 'right' },
            ];

            const reportData = data.map((item, index) => ({
                stt: index + 1,
                item_code: item.item_code,
                product_name: item.product_name,
                serial_code: item.serial_code || '',
                inbound_date: new Date(item.inbound_date).toLocaleDateString('vi-VN'),
                days_in_stock: item.days_in_stock,
                quantity_remaining: item.quantity_remaining
            }));

            exportStandardReport(
                reportData,
                `Bao_cao_tuoi_kho_FIFO_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`,
                'BÁO CÁO TUỔI KHO (FIFO)',
                columns,
                reporterName
            );

        } catch (error) {
            console.error(error);
            setNotification({ type: 'error', message: 'Lỗi khi tải báo cáo FIFO.' });
        }
    };

    const ReportCard = ({ title, desc, icon, color, category: customCategory, onClick }: any) => {
        const themeColor = color || 'primary';
        
        // Premium curated color schemes (using modern gradient & solid values)
        const colors: Record<string, { 
            main: string; 
            bg: string; 
            gradient: string; 
            glow: string;
            text: string;
        }> = {
            primary: {
                main: '#2563EB',
                bg: 'rgba(37, 99, 235, 0.06)',
                gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
                glow: 'rgba(37, 99, 235, 0.12)',
                text: '#1E40AF'
            },
            secondary: {
                main: '#7C3AED',
                bg: 'rgba(124, 58, 237, 0.06)',
                gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                glow: 'rgba(124, 58, 237, 0.12)',
                text: '#5B21B6'
            },
            success: {
                main: '#059669',
                bg: 'rgba(5, 150, 105, 0.06)',
                gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
                glow: 'rgba(5, 150, 105, 0.12)',
                text: '#065F46'
            },
            warning: {
                main: '#D97706',
                bg: 'rgba(217, 119, 6, 0.06)',
                gradient: 'linear-gradient(135deg, #F59E0B 0%, #B45309 100%)',
                glow: 'rgba(217, 119, 6, 0.12)',
                text: '#92400E'
            },
            info: {
                main: '#0891B2',
                bg: 'rgba(8, 145, 178, 0.06)',
                gradient: 'linear-gradient(135deg, #06B6D4 0%, #0E7490 100%)',
                glow: 'rgba(8, 145, 178, 0.12)',
                text: '#075985'
            },
            error: {
                main: '#DC2626',
                bg: 'rgba(220, 38, 38, 0.06)',
                gradient: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
                glow: 'rgba(220, 38, 38, 0.12)',
                text: '#991B1B'
            },
        };

        const activeColor = colors[themeColor] || colors.primary;

        let category = customCategory || 'Báo cáo';
        if (!customCategory) {
            if (title.includes('Tồn Kho') || title.includes('Tồn kho')) {
                category = 'Tồn kho';
            } else if (title.includes('Nhập Kho') || title.includes('Nhập kho')) {
                category = 'Biên bản nhập kho';
            } else if (title.includes('Xuất Kho') || title.includes('Xuất kho')) {
                category = 'Biên bản xuất kho';
            } else if (title.includes('Bàn Giao') || title.includes('Bàn giao')) {
                category = 'Biên bản';
            } else if (title.includes('Nhập / Xuất') || title.includes('Giao Dịch') || title.includes('Thẻ Kho')) {
                category = 'Giao dịch';
            } else if (title.includes('Nhân Viên') || title.includes('Nhân viên')) {
                category = 'Nhân sự';
            } else if (title.includes('FIFO') || title.includes('Tuổi Kho')) {
                category = 'Cảnh báo';
            } else if (title.includes('Đơn Hàng') || title.includes('Đơn hàng')) {
                category = 'Đơn hàng';
            }
        }

        return (
            <Card 
                onClick={onClick}
                sx={{
                    height: '100%',
                    borderRadius: '20px',
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#ffffff',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.03), 0 8px 10px -6px rgba(15, 23, 42, 0.03)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: `0 20px 25px -5px ${activeColor.glow}, 0 10px 10px -5px rgba(0, 0, 0, 0.02)`,
                        borderColor: activeColor.main,
                        '& .card-icon-container': {
                            transform: 'scale(1.1) rotate(4deg)',
                            boxShadow: `0 8px 20px ${activeColor.glow}`,
                        },
                        '& .card-action-btn': {
                            background: activeColor.gradient,
                            color: '#ffffff',
                            transform: 'scale(1.05)',
                        }
                    },
                    '&:active': {
                        transform: 'translateY(-2px)',
                    }
                }}
            >
                {/* Visual Accent - Top gradient line */}
                <Box sx={{
                    height: '4px',
                    width: '100%',
                    background: activeColor.gradient,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }} />

                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'row', sm: 'column' }, 
                    p: { xs: 2.5, sm: 3.5 },
                    pt: { xs: 3, sm: 4.5 },
                    height: '100%',
                    width: '100%',
                    boxSizing: 'border-box',
                    gap: { xs: 2, sm: 3 },
                    alignItems: { xs: 'center', sm: 'stretch' }
                }}>
                    {/* Icon Container */}
                    <Box 
                        className="card-icon-container"
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: { xs: 46, sm: 54 },
                            height: { xs: 46, sm: 54 },
                            minWidth: { xs: 46, sm: 54 },
                            borderRadius: '14px',
                            background: activeColor.bg,
                            color: activeColor.text,
                            transition: 'all 0.3s ease',
                            '& svg': {
                                fontSize: { xs: '1.4rem', sm: '1.75rem' }
                            }
                        }}
                    >
                        {icon}
                    </Box>

                    {/* Content Area */}
                    <Box sx={{ 
                        flexGrow: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'flex-start',
                        gap: 0.5,
                        overflow: 'hidden'
                    }}>
                        {/* Category Pill */}
                        <Typography 
                            variant="caption" 
                            sx={{
                                fontWeight: 750,
                                textTransform: 'uppercase',
                                letterSpacing: '0.8px',
                                px: 1.2,
                                py: 0.3,
                                borderRadius: '10px',
                                bgcolor: activeColor.bg,
                                color: activeColor.text,
                                fontSize: '0.65rem',
                                display: 'inline-flex',
                                width: 'fit-content'
                            }}
                        >
                            {category}
                        </Typography>

                        {/* Title */}
                        <Typography 
                            variant="h6" 
                            fontWeight="800" 
                            sx={{ 
                                fontSize: { xs: '0.95rem', sm: '1.15rem' }, 
                                color: '#0F172A',
                                lineHeight: 1.3,
                                letterSpacing: '-0.3px',
                                mt: 0.5
                            }}
                        >
                            {title}
                        </Typography>

                        {/* Description */}
                        <Typography 
                            variant="body2" 
                            sx={{ 
                                fontSize: { xs: '0.775rem', sm: '0.85rem' }, 
                                color: '#475569', 
                                lineHeight: 1.4,
                                display: '-webkit-box',
                                WebkitLineBreak: 'anywhere',
                                WebkitLineClamp: { xs: 2, sm: 3 },
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                            }}
                        >
                            {desc}
                        </Typography>
                    </Box>

                    {/* Action Button Container */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignSelf: { xs: 'center', sm: 'flex-end' },
                        mt: { sm: 'auto' },
                        justifyContent: 'flex-end',
                        pl: { xs: 1, sm: 0 }
                    }}>
                        <Box
                            className="card-action-btn"
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: { xs: 34, sm: 38 },
                                height: { xs: 34, sm: 38 },
                                borderRadius: '50%',
                                border: `1.5px solid ${activeColor.bg}`,
                                color: activeColor.text,
                                bgcolor: 'transparent',
                                transition: 'all 0.3s ease',
                                '& svg': {
                                    fontSize: '1.1rem'
                                }
                            }}
                        >
                            <Download size={16} />
                        </Box>
                    </Box>
                </Box>
            </Card>
        );
    };

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', maxWidth: 1200, mx: 'auto', width: '100%', overflowX: 'hidden', zoom: { xs: 0.85, md: 1 } }}>
            <PageHeader 
                title="Báo cáo & Thống kê"
                subtitle="Trung tâm quản trị dữ liệu, biên bản bàn giao và phân tích tồn kho của ACT."
                icon={<AssessmentIcon sx={{ fontSize: 30, color: 'white' }} />}
                gradientType="blue"
            />

            {notification && (
                <Alert
                    severity={notification.type}
                    onClose={() => setNotification(null)}
                    sx={{ mb: 3, borderRadius: '12px' }}
                >
                    {notification.message}
                </Alert>
            )}

            {/* Premium Pill Tabs Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 3, sm: 5 } }}>
                <Box sx={{
                    display: 'inline-flex',
                    bgcolor: 'rgba(15, 23, 42, 0.05)',
                    borderRadius: '24px',
                    p: '6px',
                    gap: 1
                }}>
                    <Button
                        onClick={() => setSelectedTab(0)}
                        sx={{
                            borderRadius: '18px',
                            px: { xs: 2.5, sm: 3.5 },
                            py: 1,
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            textTransform: 'none',
                            bgcolor: selectedTab === 0 ? '#ffffff' : 'transparent',
                            color: selectedTab === 0 ? 'primary.main' : 'text.secondary',
                            boxShadow: selectedTab === 0 ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none',
                            '&:hover': {
                                bgcolor: selectedTab === 0 ? '#ffffff' : 'rgba(15, 23, 42, 0.08)',
                            },
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        Báo cáo chung
                    </Button>
                    <Button
                        onClick={() => setSelectedTab(1)}
                        sx={{
                            borderRadius: '18px',
                            px: { xs: 2.5, sm: 3.5 },
                            py: 1,
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            textTransform: 'none',
                            bgcolor: selectedTab === 1 ? '#ffffff' : 'transparent',
                            color: selectedTab === 1 ? 'primary.main' : 'text.secondary',
                            boxShadow: selectedTab === 1 ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none',
                            '&:hover': {
                                bgcolor: selectedTab === 1 ? '#ffffff' : 'rgba(15, 23, 42, 0.08)',
                            },
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        Báo cáo Đơn hàng
                    </Button>
                    {isAdmin && (
                        <Button
                            onClick={() => setSelectedTab(2)}
                            sx={{
                                borderRadius: '18px',
                                px: { xs: 2.5, sm: 3.5 },
                                py: 1,
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                textTransform: 'none',
                                bgcolor: selectedTab === 2 ? '#ffffff' : 'transparent',
                                color: selectedTab === 2 ? 'error.main' : 'text.secondary',
                                boxShadow: selectedTab === 2 ? '0 4px 12px rgba(0, 0, 0, 0.05)' : 'none',
                                '&:hover': {
                                    bgcolor: selectedTab === 2 ? '#ffffff' : 'rgba(15, 23, 42, 0.08)',
                                },
                                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                        >
                            Quản lý dữ liệu
                        </Button>
                    )}
                </Box>
            </Box>

            {selectedTab === 0 && (
                <Grid container spacing={{ xs: 2.5, sm: 3.5 }} justifyContent="center" maxWidth={1200} mx="auto">
                    {isAdmin && (
                        <>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Báo Cáo Tồn Kho"
                                    desc="Danh sách tồn kho chi tiết, giá trị tổng tài sản và số lượng khả dụng."
                                    icon={<Warehouse size={20} />}
                                    color="primary"
                                    onClick={handleExportInventory}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Nhập / Xuất"
                                    desc="Báo cáo phân tích dòng chảy giao dịch chi tiết theo thời gian."
                                    icon={<ArrowUpDown size={20} />}
                                    color="info"
                                    onClick={() => setOpenPeriodReport(true)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Lịch Sử Giao Dịch"
                                    desc="Toàn bộ nhật ký (log) các hoạt động xuất nhập trong toàn hệ thống."
                                    icon={<History size={20} />}
                                    color="secondary"
                                    onClick={() => handleExportTransactions()}
                                />
                            </Grid>
                        </>
                    )}

                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <ReportCard
                            title="Biên Bản Bàn Giao"
                            category="Biên bản nhập kho"
                            desc="In và xuất biên bản giao nhận thiết bị cho các phiếu nhập kho."
                            icon={<FileSignature size={20} />}
                            color="success"
                            onClick={() => { setHandoverType('inbound'); setOpenHandover(true); }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <ReportCard
                            title="Biên Bản Bàn Giao"
                            category="Biên bản xuất kho"
                            desc="In và xuất biên bản giao nhận thiết bị cho các phiếu xuất kho."
                            icon={<FileSignature size={20} />}
                            color="warning"
                            onClick={() => { setHandoverType('outbound'); setOpenHandover(true); }}
                        />
                    </Grid>

                    {isAdmin && (
                        <>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Theo Nhân Viên"
                                    desc="Báo cáo thống kê hiệu suất xuất nhập chi tiết theo từng nhân sự."
                                    icon={<Users size={20} />}
                                    color="info"
                                    onClick={() => setOpenEmployeeReport(true)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Thẻ Kho"
                                    desc="Theo dõi chi tiết lịch sử biến động số lượng của từng mã sản phẩm."
                                    icon={<FileSpreadsheet size={20} />}
                                    color="error"
                                    onClick={() => setOpenStockCard(true)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Tồn Kho Theo Quận"
                                    desc="Báo cáo phân vùng trữ lượng tồn kho thực tế theo từng chi nhánh quận."
                                    icon={<MapPin size={20} />}
                                    color="success"
                                    onClick={handleExportStockByDistrict}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Tuổi Kho"
                                    category="Tuổi kho (FIFO)"
                                    desc="Cảnh báo hạn lưu kho của hàng hóa dựa trên nguyên tắc FIFO."
                                    icon={<Hourglass size={20} />}
                                    color="secondary"
                                    onClick={handleExportFifoAging}
                                />
                            </Grid>
                        </>
                    )}
                </Grid>
            )}

            {selectedTab === 1 && (
                <Grid container spacing={{ xs: 2.5, sm: 3.5 }} justifyContent="center" maxWidth={1200} mx="auto">
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <ReportCard
                            title="Đơn Hàng"
                            desc="Danh sách tổng hợp và tiến độ duyệt các đơn hàng yêu cầu cấp phát."
                            icon={<ShoppingCart size={20} />}
                            color="success"
                            onClick={handleExportOrders}
                        />
                    </Grid>
                </Grid>
            )}

            {/* Tab 3: Data Management (Admin Only) */}
            {
                selectedTab === 2 && isAdmin && (
                    <Box maxWidth={1200} mx="auto">
                        <Alert severity="warning" sx={{ mb: 2, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                            <Typography fontWeight="bold" sx={{ fontSize: 'inherit' }}>CẢNH BÁO QUAN TRỌNG:</Typography>
                            Hệ thống tính toán tồn kho dựa trên lịch sử nhập/xuất.
                            <br />
                            Việc xóa các giao dịch cũ sẽ làm <b>THAY ĐỔI SỐ LƯỢNG TỒN KHO HIỆN TẠI</b>.
                            <br />
                            Chỉ thực hiện khi bạn thực sự hiểu rõ hậu quả.
                        </Alert>

                        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
                            <Grid container spacing={2} alignItems="center">
                                {/* ... filter inputs ... */}
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField
                                        label="Từ ngày"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <TextField
                                        label="Đến ngày"
                                        type="date"
                                        fullWidth
                                        InputLabelProps={{ shrink: true }}
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        size="small"
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Loại giao dịch</InputLabel>
                                        <Select
                                            value={filterType}
                                            label="Loại giao dịch"
                                            onChange={(e) => setFilterType(e.target.value as any)}
                                        >
                                            <MenuItem value="all">Tất cả</MenuItem>
                                            <MenuItem value="inbound">Nhập kho</MenuItem>
                                            <MenuItem value="outbound">Xuất kho</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, md: 3 }}>
                                    <Box display="flex" justifyContent="flex-end">
                                        <Button
                                            variant="contained"
                                            color="error"
                                            startIcon={<DeleteIcon />}
                                            disabled={selectedIds.length === 0}
                                            onClick={() => setOpenDeleteConfirm(true)}
                                            size="medium"
                                            fullWidth
                                            sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem' } }}
                                        >
                                            Xóa ({selectedIds.length})
                                        </Button>
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>

                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={managementTransactions.length > 0 && selectedIds.length === managementTransactions.length}
                                                indeterminate={selectedIds.length > 0 && selectedIds.length < managementTransactions.length}
                                                onChange={handleSelectAll}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell width={100} sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Loại</TableCell>
                                        <TableCell width={120} sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Ngày</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Sản phẩm</TableCell>
                                        <TableCell width={80} sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Serial</TableCell>
                                        <TableCell width={100} align="right" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Số lượng</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Quận/Huyện</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Trạng thái</TableCell>
                                        <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' }, py: 1 }}>Đối tác/Ghi chú</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {managementTransactions.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary', fontSize: '0.875rem' }}>
                                                Vui lòng chọn khoảng thời gian để xem dữ liệu
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        managementTransactions.map((t) => (
                                            <TableRow key={t.id} hover selected={selectedIds.includes(t.id)}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        checked={selectedIds.includes(t.id)}
                                                        onChange={() => handleSelectOne(t.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{
                                                        color: t.type === 'inbound' ? 'success.main' : 'error.main',
                                                        fontWeight: 'bold',
                                                        fontSize: '0.8rem',
                                                        border: '1px solid',
                                                        borderColor: t.type === 'inbound' ? 'success.light' : 'error.light',
                                                        borderRadius: 1,
                                                        textAlign: 'center',
                                                        py: 0.5
                                                    }}>
                                                        {t.type === 'inbound' ? 'NHẬP' : 'XUẤT'}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{new Date(t.date).toLocaleDateString('vi-VN')}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight="500">{t.product?.name}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{t.product?.item_code}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontFamily="monospace">{t.serial_code || '-'}</Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                    {t.quantity}
                                                </TableCell>
                                                <TableCell>{t.district || '-'}</TableCell>
                                                <TableCell>{t.item_status || '-'}</TableCell>
                                                <TableCell>{t.group_name || '-'}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Confirmation Dialog */}
                        <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
                            <DialogTitle sx={{ color: 'error.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <WarningIcon /> Xác nhận xóa dữ liệu
                            </DialogTitle>
                            <DialogContent>
                                <Typography gutterBottom>
                                    Bạn đang chuẩn bị xóa <b>{selectedIds.length}</b> giao dịch.
                                </Typography>
                                <Alert severity="error" sx={{ mt: 2 }}>
                                    Hành động này sẽ cập nhật lại số lượng tồn kho hiện tại.
                                    Nếu bạn xóa phiếu Nhập, tồn kho sẽ GIẢM.
                                    Nếu bạn xóa phiếu Xuất, tồn kho sẽ TĂNG.
                                </Alert>
                                <Typography sx={{ mt: 2, fontStyle: 'italic' }}>
                                    Bạn có chắc chắn muốn tiếp tục không?
                                </Typography>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setOpenDeleteConfirm(false)} color="inherit">Hủy bỏ</Button>
                                <Button
                                    onClick={handleDeleteSelected}
                                    variant="contained"
                                    color="error"
                                    disabled={deleteProcessing}
                                >
                                    {deleteProcessing ? 'Đang xóa...' : 'Xác nhận Xóa'}
                                </Button>
                            </DialogActions>
                        </Dialog>
                    </Box>
                )
            }

            {/* Handover Dialog */}
            <Dialog
                open={openHandover}
                onClose={() => setOpenHandover(false)}
                PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 500 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 900, pt: 4, textTransform: 'uppercase', color: handoverType === 'inbound' ? 'success.main' : 'primary.main' }}>
                    XUẤT BIÊN BẢN BÀN GIAO {handoverType === 'inbound' ? 'NHẬP KHO' : 'XUẤT KHO'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} mt={1}>
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Chọn nhân viên và ngày để lọc các phiếu {handoverType === 'inbound' ? 'nhập' : 'xuất'} kho tương ứng.
                        </Alert>
                        {isAdmin ? (
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => {
                                    const name = option.full_name || '';
                                    return name.replace(/\(\s*\)/g, '').trim();
                                }}
                                value={employees.find(e => e.full_name === selectedEmployee) || null}
                                onChange={(_, newValue) => {
                                    setSelectedEmployee(newValue ? newValue.full_name : null);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Nhân viên nhận bàn giao"
                                        variant="outlined"
                                        fullWidth
                                        InputProps={{ ...params.InputProps, sx: { borderRadius: 2 } }}
                                    />
                                )}
                            />
                        ) : (
                            <TextField
                                label="Nhân viên nhận bàn giao"
                                variant="outlined"
                                fullWidth
                                value={selectedEmployee || ''}
                                InputProps={{ readOnly: true, sx: { borderRadius: 2 } }}
                                disabled
                            />
                        )}
                        <TextField
                            label="Ngày xuất kho"
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            fullWidth
                            InputLabelProps={{ shrink: true }}
                            InputProps={{ sx: { borderRadius: 2 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0, gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* Shared button style for uniformity */}
                    <Button
                        onClick={() => setOpenHandover(false)}
                        variant="outlined"
                        color="inherit"
                        sx={{
                            borderRadius: 2.5, px: 3, py: 1,
                            fontWeight: 600, textTransform: 'none',
                            minWidth: 90, fontSize: '0.875rem',
                            color: 'text.secondary', borderColor: 'divider',
                        }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExportHandover}
                        variant="contained"
                        color="info"
                        startIcon={<DownloadIcon />}
                        sx={{
                            borderRadius: 2.5, px: 3, py: 1,
                            fontWeight: 700, textTransform: 'none',
                            minWidth: 150, fontSize: '0.875rem',
                            boxShadow: '0 4px 12px rgba(2, 136, 209, 0.25)',
                        }}
                    >
                        Xuất File Excel
                    </Button>
                    <Button
                        onClick={handleExportPDF}
                        variant="contained"
                        color="error"
                        startIcon={<PictureAsPdfIcon />}
                        sx={{
                            borderRadius: 2.5, px: 3, py: 1,
                            fontWeight: 700, textTransform: 'none',
                            minWidth: 120, fontSize: '0.875rem',
                            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.25)',
                        }}
                    >
                        Xuất File PDF
                    </Button>
                    <Button
                        onClick={() => handlePreviewHandover(false)}
                        variant="outlined"
                        color="primary"
                        startIcon={<PrintIcon />}
                        sx={{
                            borderRadius: 2.5, px: 3, py: 1,
                            fontWeight: 700, textTransform: 'none',
                            minWidth: 120, fontSize: '0.875rem',
                        }}
                    >
                        Xem Trước & In
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Preview Modal */}
            <Dialog
                open={openHandoverPreview}
                onClose={() => setOpenHandoverPreview(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}
            >
                <Box>
                    <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mb: 2 }} className="no-print">
                        <Button
                            variant="contained"
                            color="info"
                            startIcon={<PrintIcon />}
                            onClick={handlePrint}
                            sx={{ fontWeight: 'bold' }}
                        >
                            In / Xuất PDF
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            onClick={() => setOpenHandoverPreview(false)}
                            sx={{ fontWeight: 'bold' }}
                        >
                            Đóng
                        </Button>
                    </Stack>
                    {handoverType === 'inbound' ? (
                        <ReturnsReportPreview
                            data={previewData}
                            employeeName={selectedEmployee || ''}
                            date={selectedDate}
                            receiverName={previewSenderName}
                        />
                    ) : (
                        <HandoverPreview
                            data={previewData}
                            employeeName={selectedEmployee || ''}
                            date={selectedDate}
                            reporterName={previewSenderName}
                            senderPhone={previewSenderPhone}
                            receiverPhone={previewReceiverPhone}
                            reportNumber={previewReportNumber}
                        />
                    )}
                </Box>
            </Dialog>

            {/* Stock Card Dialog */}
            <Dialog
                open={openStockCard}
                onClose={() => setOpenStockCard(false)}
                PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 500 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, pt: 4 }}>
                    Xuất Báo Cáo Thẻ Kho
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} mt={1}>
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Chọn khoảng thời gian để tính toán số liệu Nhập - Xuất - Tồn.
                        </Alert>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="Từ ngày"
                                type="date"
                                value={stockStartDate}
                                onChange={(e) => setStockStartDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                InputProps={{ sx: { borderRadius: 2 } }}
                            />
                            <TextField
                                label="Đến ngày"
                                type="date"
                                value={stockEndDate}
                                onChange={(e) => setStockEndDate(e.target.value)}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                                InputProps={{ sx: { borderRadius: 2 } }}
                            />
                        </Stack>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center' }}>
                    <Button
                        onClick={() => setOpenStockCard(false)}
                        sx={{ color: 'text.secondary', fontWeight: 600, mr: 2 }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExportStockCard}
                        variant="contained"
                        color="success"
                        startIcon={<DownloadIcon />}
                        sx={{
                            borderRadius: 3, px: 4, py: 1, fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)'
                        }}
                    >
                        Xuất Report
                    </Button>
                </DialogActions>
            </Dialog>

            {/* NEW: Period Report Dialog */}
            <Dialog
                open={openPeriodReport}
                onClose={() => setOpenPeriodReport(false)}
                PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 500 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 800, pt: 4 }}>
                    Báo Cáo Nhập / Xuất
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} mt={1}>
                        <FormControl>
                            <InputLabel>Loại Giao Dịch</InputLabel>
                            <Select
                                value={periodType}
                                label="Loại Giao Dịch"
                                onChange={(e) => setPeriodType(e.target.value as any)}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="all">Tất cả (Nhập & Xuất)</MenuItem>
                                <MenuItem value="inbound">Nhập Kho</MenuItem>
                                <MenuItem value="outbound">Xuất Kho</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl>
                            <InputLabel>Thời Gian</InputLabel>
                            <Select
                                value={timeRange}
                                label="Thời Gian"
                                onChange={(e) => setTimeRange(e.target.value as any)}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="today">Hôm nay</MenuItem>
                                <MenuItem value="week">Tuần này</MenuItem>
                                <MenuItem value="month">Tháng này</MenuItem>
                                <MenuItem value="custom">Tùy chỉnh</MenuItem>
                            </Select>
                        </FormControl>

                        {timeRange === 'custom' && (
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Từ ngày"
                                    type="date"
                                    value={cStart}
                                    onChange={(e) => setCStart(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{ sx: { borderRadius: 2 } }}
                                />
                                <TextField
                                    label="Đến ngày"
                                    type="date"
                                    value={cEnd}
                                    onChange={(e) => setCEnd(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{ sx: { borderRadius: 2 } }}
                                />
                            </Stack>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center' }}>
                    <Button
                        onClick={() => setOpenPeriodReport(false)}
                        sx={{ color: 'text.secondary', fontWeight: 600, mr: 2 }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExportPeriodReport}
                        variant="contained"
                        color="error" // Red
                        startIcon={<DownloadIcon />}
                        sx={{
                            borderRadius: 3, px: 4, py: 1, fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(211, 47, 47, 0.25)'
                        }}
                    >
                        Xuất Report
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Employee Report Dialog */}
            <Dialog
                open={openEmployeeReport}
                onClose={() => setOpenEmployeeReport(false)}
                PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 450 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 900, pt: 4, textTransform: 'uppercase', color: 'info.main' }}>
                    BÁO CÁO NHẬP XUẤT THEO NHÂN VIÊN
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} mt={1}>
                        <Autocomplete
                            options={employees}
                            getOptionLabel={(option) => option.full_name || ''}
                            value={employees.find(e => e.id === reportEmployeeId) || null}
                            onChange={(_, newValue) => setReportEmployeeId(newValue ? newValue.id : null)}
                            renderInput={(params) => <TextField {...params} label="Chọn Nhân Viên (Để trống = Tất cả)" variant="outlined" InputProps={{ ...params.InputProps, sx: { borderRadius: 2 } }} />}
                            fullWidth
                        />
                        <FormControl>
                            <InputLabel>Loại Giao Dịch</InputLabel>
                            <Select
                                value={employeeReportType}
                                label="Loại Giao Dịch"
                                onChange={(e) => setEmployeeReportType(e.target.value as any)}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="all">Tất cả Nhập / Xuất</MenuItem>
                                <MenuItem value="inbound">Chỉ Nhập Kho</MenuItem>
                                <MenuItem value="outbound">Chỉ Xuất Kho</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl>
                            <InputLabel>Thời Gian</InputLabel>
                            <Select
                                value={employeeReportTimeRange}
                                label="Thời Gian"
                                onChange={(e) => setEmployeeReportTimeRange(e.target.value as any)}
                                sx={{ borderRadius: 2 }}
                            >
                                <MenuItem value="today">Hôm nay</MenuItem>
                                <MenuItem value="week">Tuần này</MenuItem>
                                <MenuItem value="month">Tháng này</MenuItem>
                                <MenuItem value="custom">Tùy chỉnh</MenuItem>
                            </Select>
                        </FormControl>

                        {employeeReportTimeRange === 'custom' && (
                            <Stack direction="row" spacing={2}>
                                <TextField
                                    label="Từ ngày"
                                    type="date"
                                    value={employeeReportStart}
                                    onChange={(e) => setEmployeeReportStart(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{ sx: { borderRadius: 2 } }}
                                />
                                <TextField
                                    label="Đến ngày"
                                    type="date"
                                    value={employeeReportEnd}
                                    onChange={(e) => setEmployeeReportEnd(e.target.value)}
                                    fullWidth
                                    InputLabelProps={{ shrink: true }}
                                    InputProps={{ sx: { borderRadius: 2 } }}
                                />
                            </Stack>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center' }}>
                    <Button onClick={() => setOpenEmployeeReport(false)} sx={{ color: 'text.secondary', fontWeight: 600, mr: 2 }}>
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExportEmployeeReport}
                        variant="contained"
                        color="info"
                        startIcon={<DownloadIcon />}
                        sx={{ borderRadius: 3, px: 4, py: 1, fontWeight: 700, boxShadow: '0 4px 12px rgba(2, 136, 209, 0.25)' }}
                    >
                        Tải Excel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Hidden container for PDF Generation */}
            {previewData && (
                <Box sx={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '900px', zIndex: -1000, pointerEvents: 'none' }}>
                    <div id="hidden-pdf-container" style={{ padding: '30px', background: 'white' }}>
                        {handoverType === 'inbound' ? (
                            <ReturnsReportPreview
                                data={previewData}
                                employeeName={selectedEmployee || ''}
                                date={selectedDate}
                                receiverName={previewSenderName}
                            />
                        ) : (
                            <HandoverPreview
                                data={previewData}
                                employeeName={selectedEmployee || ''}
                                date={selectedDate}
                                reporterName={previewSenderName}
                                senderPhone={previewSenderPhone}
                                receiverPhone={previewReceiverPhone}
                                reportNumber={previewReportNumber}
                            />
                        )}
                    </div>
                </Box>
            )}
        </Box >
    );
};

export default Reports;
