import { useEffect, useState, useMemo } from 'react';
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

import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchInventory } from '../../store/slices/inventorySlice';
import { fetchTransactions, deleteTransaction } from '../../store/slices/transactionsSlice';
import { fetchOrders } from '../../store/slices/ordersSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';

import { exportHandoverMinutes, exportStandardReport } from '../../utils/excelUtils';
import type { ReportColumn } from '../../utils/excelUtils';
import HandoverPreview from '../../components/Reports/HandoverPreview';
import { formatCurrency } from '../../utils/format';

const Reports = () => {
    const dispatch = useDispatch<AppDispatch>();

    // Selectors
    const { items: products, status: productsStatus } = useSelector((state: RootState) => state.products);
    const { stockMap } = useSelector((state: RootState) => state.inventory);
    const { items: transactions, status } = useSelector((state: RootState) => state.transactions);
    const { items: orders } = useSelector((state: RootState) => state.orders);
    const { items: employees } = useSelector((state: RootState) => state.employees);
    // Access profile for role checks
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin';

    // State for Handover Dialog
    const [openHandover, setOpenHandover] = useState(false);
    // handoverBase and handoverLocation unused, removed.
    // Auto-fill for Staff
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(
        isAdmin ? null : (profile?.full_name || profile?.username || profile?.email || '')
    );
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);

    // State for Preview
    const [openHandoverPreview, setOpenHandoverPreview] = useState(false);
    const [previewData, setPreviewData] = useState<any[]>([]);

    // State for Stock Card Report
    const [openStockCard, setOpenStockCard] = useState(false);
    const [stockStartDate, setStockStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [stockEndDate, setStockEndDate] = useState(new Date().toISOString().split('T')[0]);

    // State for Period Report
    const [openPeriodReport, setOpenPeriodReport] = useState(false);
    const [periodType, setPeriodType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
    const [cStart, setCStart] = useState(new Date().toISOString().split('T')[0]);
    const [cEnd, setCEnd] = useState(new Date().toISOString().split('T')[0]);

    const [selectedTab, setSelectedTab] = useState(0);

    // Data Management State
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterType, setFilterType] = useState<'all' | 'inbound' | 'outbound'>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [deleteProcessing, setDeleteProcessing] = useState(false);

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

    // Filter transactions for Management Tab
    const managementTransactions = useMemo(() => {
        return transactions.filter(t => {
            if (!startDate && !endDate) return false; // Only show if filtered
            const tDate = new Date(t.date).toISOString().split('T')[0];
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
            alert(`Đã xóa ${selectedIds.length} giao dịch thành công!`);
            setSelectedIds([]);
            setOpenDeleteConfirm(false);
        } catch (err) {
            console.error(err);
            alert('Có lỗi xảy ra khi xóa dữ liệu.');
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
        if (products.length === 0) return alert('Không có dữ liệu sản phẩm');

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
            `Bao_cao_ton_kho_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`,
            'BÁO CÁO TỒN KHO CHI TIẾT',
            columns,
            reporterName
        );
    };

    const handleExportTransactions = () => {
        if (transactions.length === 0) return alert('Không có dữ liệu giao dịch');

        const columns: ReportColumn[] = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' },
            { header: 'MÃ GIAO DỊCH', key: 'id', width: 15 },
            { header: 'LOẠI', key: 'type', width: 12, align: 'center' },
            { header: 'NGÀY', key: 'date', width: 20, align: 'center' },
            { header: 'SẢN PHẨM', key: 'product', width: 25 },
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
            { header: 'TRẠNG THÁI', key: 'item_status', width: 15, align: 'center' },
            { header: 'QUẬN/HUYỆN', key: 'district', width: 15, align: 'center' },
            { header: 'NGƯỜI NHẬN', key: 'partner', width: 20 },
            { header: 'NGƯỜI THỰC HIỆN', key: 'user', width: 20 },
            { header: 'SERIAL', key: 'serial', width: 15 },
        ];

        const data = transactions.map(t => ({
            id: t.id.substring(0, 8), // Shorten ID for better display
            type: t.type === 'inbound' ? 'Nhập kho' : 'Xuất kho',
            date: new Date(t.date).toLocaleString('vi-VN'),
            product: t.product?.name || t.product_id,
            quantity: t.quantity,
            item_status: t.item_status || '',
            district: t.district || '',
            partner: t.group_name || 'N/A',
            user: t.user_name || 'N/A',
            serial: t.serial_code || ''
        }));

        exportStandardReport(
            data,
            `Lich_su_giao_dich_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`,
            'LỊCH SỬ GIAO DỊCH XUẤT NHẬP KHO',
            columns,
            reporterName
        );
    };

    const handleExportOrders = () => {
        if (orders.length === 0) return alert('Không có dữ liệu đơn hàng');

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
            return {
                id: o.id.substring(0, 8),
                date: new Date(o.order_date).toLocaleString('vi-VN'),
                requester: o.requester_group,
                product: o.product?.name || o.product_id,
                quantity: o.quantity,
                status: statusText
            };
        });

        exportStandardReport(
            data,
            `Danh_sach_don_hang_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}`,
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

    const getHandoverData = () => {
        if (!selectedEmployee) { alert('Vui lòng chọn nhân viên nhận bàn giao'); return null; }
        if (!selectedDate) { alert('Vui lòng chọn ngày xuất kho'); return null; }

        // Filter transactions
        const filtered = transactions.filter(t => {
            if (t.type !== 'outbound') return false;

            // Check Date (Compare YYYY-MM-DD)
            const tDate = new Date(t.date).toISOString().split('T')[0];
            if (tDate !== selectedDate) return false;

            // Check Employee (fuzzy match name or exact match depending on data)
            return t.group_name?.toLowerCase().includes(selectedEmployee.toLowerCase());
        });

        if (filtered.length === 0) {
            alert(`Không tìm thấy phiếu xuất kho nào cho nhân viên "${selectedEmployee}" vào ngày ${selectedDate}.`);
            return null;
        }

        // Prepare data
        return filtered.map(t => ({
            item_code: t.product?.item_code || 'N/A',
            product_name: t.product?.name || 'Sản phẩm đã xóa',
            unit: t.product?.unit || 'Cái',
            quantity: t.quantity,
            unit_price: t.unit_price,
            serial_code: t.serial_code,
            note: t.group_name,
            district: t.district, // Added
            item_status: t.item_status // Added
        }));
    };

    const handleExportHandover = () => {
        const exportData = getHandoverData();
        if (exportData && selectedEmployee) {
            // Find employee to get phone number
            const receiverObj = employees.find(e => e.full_name === selectedEmployee);
            const receiverPhone = receiverObj?.phone_number || '';
            const senderPhone = profile?.phone_number || '';

            exportHandoverMinutes(exportData, selectedEmployee, selectedDate, reporterName, senderPhone, receiverPhone);
            setOpenHandover(false);
        }
    };

    const handlePreviewHandover = () => {
        const handoverData = getHandoverData();
        if (handoverData) {
            setPreviewData(handoverData);
            setOpenHandoverPreview(true);
            setOpenHandover(false);
        }
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
            alert('Không có dữ liệu giao dịch trong khoảng thời gian này.');
            return;
        }

        const reportData = filtered.map((t, index) => {
            const product = products.find(p => p.id === t.product_id);
            return {
                stt: index + 1,
                date: new Date(t.date).toLocaleDateString('vi-VN'),
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
            { header: 'SỐ LƯỢNG', key: 'quantity', width: 10, align: 'center' },
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

    const ReportCard = ({ title, desc, icon, color, onClick }: any) => (
        <Card sx={{
            height: '100%',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 0.2s',
            border: '1px solid',
            borderColor: 'divider',
            minWidth: 300, // Prevent squashing
            '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: (theme) => `0 10px 20px -5px ${(theme.palette as any)[color].main}20`,
                borderColor: `${color}.main`
            }
        }}>
            <CardContent sx={{ flexGrow: 1, p: 3, textAlign: 'center' }}>
                <Box sx={{
                    display: 'inline-flex',
                    p: 1.5,
                    borderRadius: '12px',
                    bgcolor: (theme) => `${(theme.palette as any)[color].main}15`,
                    color: `${color}.main`,
                    mb: 2
                }}>
                    {icon}
                </Box>
                <Typography variant="h6" fontWeight="700" gutterBottom sx={{ fontSize: '1.1rem' }}>{title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>{desc}</Typography>
            </CardContent>
            <CardActions sx={{ p: 2, pt: 0, justifyContent: 'center' }}>
                <Button
                    variant="outlined"
                    color={color}
                    size="small"
                    startIcon={<DownloadIcon fontSize="small" />}
                    onClick={onClick}
                    sx={{
                        borderRadius: 2,
                        px: 3,
                        fontWeight: 600,
                        textTransform: 'none',
                        borderWidth: 1.5,
                        '&:hover': { borderWidth: 1.5 }
                    }}
                >
                    Xuất Excel
                </Button>
            </CardActions>
        </Card>
    );

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', maxWidth: 1000, mx: 'auto', width: '100%', overflowX: 'hidden', zoom: { xs: 0.85, md: 1 } }}>
            <Box mb={{ xs: 2, sm: 4 }} textAlign="center">
                <Typography variant="h4" fontWeight="900" mb={1} sx={{
                    fontSize: { xs: '1.75rem', sm: '2.5rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(45deg, #0d47a1 30%, #1976d2 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '1px'
                }}>
                    BÁO CÁO & THỐNG KÊ
                </Typography>
                <Typography variant="body2" color="text.secondary" maxWidth={600} mx="auto" sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                    Trung tâm xuất dữ liệu và báo cáo quản trị kho.
                </Typography>
            </Box>

            <Tabs
                value={selectedTab}
                onChange={(_, newValue) => setSelectedTab(newValue)}
                centered
                sx={{ mb: { xs: 2, sm: 4 }, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { fontSize: { xs: '0.75rem', sm: '0.875rem' }, minHeight: 48, px: 1 } }}
            >
                <Tab label="Báo cáo chung" />
                <Tab label="Báo cáo Đơn hàng" />
                {isAdmin && <Tab label="Quản lý dữ liệu" sx={{ color: 'error.main' }} />}
            </Tabs>

            {selectedTab === 0 && (
                <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center" maxWidth={1200} mx="auto">
                    {isAdmin && (
                        <>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Báo Cáo Tồn Kho"
                                    desc="Danh sách tồn kho, giá trị và số lượng."
                                    icon={<InventoryIcon />}
                                    color="primary"
                                    onClick={handleExportInventory}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Nhập / Xuất"
                                    desc="Báo cáo chi tiết giao dịch theo thời gian."
                                    icon={<AssessmentIcon />}
                                    color="info"
                                    onClick={() => setOpenPeriodReport(true)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <ReportCard
                                    title="Lịch Sử Giao Dịch"
                                    desc="Log toàn bộ các hoạt động nhập xuất."
                                    icon={<ReceiptIcon />}
                                    color="secondary"
                                    onClick={() => handleExportTransactions()}
                                />
                            </Grid>
                        </>
                    )}

                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <ReportCard
                            title="Biên Bản Bàn Giao"
                            desc="In biên bản bàn giao phiếu xuất kho."
                            icon={<AssignmentIndIcon />}
                            color="warning"
                            onClick={() => setOpenHandover(true)}
                        />
                    </Grid>

                    {isAdmin && (
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <ReportCard
                                title="Thẻ Kho"
                                desc="Chi tiết biến động của từng mặt hàng."
                                icon={<AssignmentIcon />}
                                color="error"
                                onClick={() => setOpenStockCard(true)}
                            />
                        </Grid>
                    )}
                </Grid>
            )}

            {selectedTab === 1 && (
                <Grid container spacing={{ xs: 2, sm: 3 }} justifyContent="center" maxWidth={1200} mx="auto">
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                        <ReportCard
                            title="Đơn Hàng"
                            desc="Danh sách và trạng thái các đơn hàng."
                            icon={<ShoppingCartIcon />}
                            color="success"
                            onClick={handleExportOrders}
                        />
                    </Grid>
                </Grid>
            )}

            {/* Tab 3: Data Management (Admin Only) */}
            {selectedTab === 2 && isAdmin && (
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
            )}

            {/* Handover Dialog */}
            <Dialog
                open={openHandover}
                onClose={() => setOpenHandover(false)}
                PaperProps={{ sx: { borderRadius: 4, width: '100%', maxWidth: 500 } }}
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 900, pt: 4, textTransform: 'uppercase', color: 'primary.main' }}>
                    XUẤT BIÊN BẢN BÀN GIAO
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} mt={1}>
                        <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Chọn nhân viên và ngày để lọc các phiếu xuất kho tương ứng.
                        </Alert>
                        {isAdmin ? (
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => option.full_name || ''}
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
                <DialogActions sx={{ p: 4, pt: 0, justifyContent: 'center' }}>
                    <Button
                        onClick={() => setOpenHandover(false)}
                        sx={{ color: 'text.secondary', fontWeight: 600, mr: 2 }}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleExportHandover}
                        variant="contained"
                        color="info"
                        startIcon={<DownloadIcon />}
                        sx={{
                            borderRadius: 3, px: 4, py: 1, fontWeight: 700,
                            boxShadow: '0 4px 12px rgba(2, 136, 209, 0.25)'
                        }}
                    >
                        Xuất File Excel
                    </Button>
                    <Button
                        onClick={handlePreviewHandover}
                        variant="outlined"
                        color="primary"
                        sx={{
                            borderRadius: 3, px: 3, py: 1, fontWeight: 700, ml: 2
                        }}
                    >
                        Xem Trước
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
                <Box position="relative">
                    <Button
                        onClick={() => setOpenHandoverPreview(false)}
                        sx={{ position: 'absolute', right: 0, top: -40, color: 'white', fontWeight: 'bold' }}
                    >
                        Đóng
                    </Button>
                    <HandoverPreview
                        data={previewData}
                        employeeName={selectedEmployee || ''}
                        date={selectedDate}
                        reporterName={reporterName}
                    />
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
        </Box>
    );
};

export default Reports;
