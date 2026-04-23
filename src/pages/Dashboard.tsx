import { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, List, ListItem, ListItemText, Chip, Grid, IconButton, Tooltip
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    TrendingUp as TrendingUpIcon,
    TrendingDown as TrendingDownIcon,
    Inventory2Outlined as InventoryIcon,
    WarningAmberOutlined as WarningIcon,
    ErrorOutline as ErrorIcon,
    LocalShippingOutlined as ShippingIcon,
    RefreshOutlined as RefreshIcon,
} from '@mui/icons-material';
import {
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import type { RootState, AppDispatch } from '../store';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchTransactions } from '../store/slices/transactionsSlice';
import { fetchInventory, selectStockMap } from '../store/slices/inventorySlice';
import { fetchOrders } from '../store/slices/ordersSlice';
import type { DashboardStats } from '../types';
import React from 'react';
import DashboardSkeleton from './DashboardSkeleton';
import { useTabVisibility } from '../hooks/useTabVisibility';

const MetricCard = ({ title, value, subtitle, icon, color, trend, onClick }: any) => (
    <Paper 
        elevation={0} 
        onClick={onClick}
        sx={{ 
            p: { xs: 2, sm: 2.5 }, 
            borderRadius: 2, 
            border: '1px solid #e2e8f0',
            bgcolor: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            height: '100%',
            position: 'relative',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': onClick ? {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                borderColor: color
            } : {}
        }}
    >
        <Box display="flex" alignItems="center" gap={1} mb={1}>
            {icon && <Box sx={{ color: color, display: 'flex' }}>{React.cloneElement(icon, { sx: { fontSize: 18 }})}</Box>}
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.5px' }}>
                {title.toUpperCase()}
            </Typography>
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 800, color: color, mb: 1, fontSize: '1.75rem' }}>
            {value}
        </Typography>
        {subtitle && (
            <Box display="flex" alignItems="center" gap={0.5}>
                {trend === 'up' && <TrendingUpIcon sx={{ color: '#10b981', fontSize: 14 }} />}
                {trend === 'down' && <TrendingDownIcon sx={{ color: '#ef4444', fontSize: 14 }} />}
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 500 }}>
                    {subtitle}
                </Typography>
            </Box>
        )}
    </Paper>
);

import { fetchEmployees } from '../store/slices/employeesSlice';

const Dashboard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { items: products, status: productStatus } = useSelector((state: RootState) => state.products);
    const { items: transactions, status: transactionStatus } = useSelector((state: RootState) => state.transactions);
    const { items: orders, status: orderStatus } = useSelector((state: RootState) => state.orders);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const stockMap = useSelector(selectStockMap);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const isLoading = productStatus === 'loading' || transactionStatus === 'loading' || inventoryStatus === 'loading';

    const refreshAll = useCallback(() => {
        dispatch(fetchProducts());
        dispatch(fetchTransactions());
        dispatch(fetchOrders());
        dispatch(fetchInventory());
        dispatch(fetchEmployees());
        setLastUpdated(new Date());
    }, [dispatch]);

    useEffect(() => {
        if (productStatus === 'idle') dispatch(fetchProducts());
        if (transactionStatus === 'idle') dispatch(fetchTransactions());
        if (orderStatus === 'idle') dispatch(fetchOrders());
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
        if (employeeStatus === 'idle') dispatch(fetchEmployees());
        setLastUpdated(new Date());
    }, [productStatus, transactionStatus, inventoryStatus, orderStatus, employeeStatus, dispatch]);

    // Chỉ fetch lại khi tab active và dữ liệu đã stale quá 5 phút
    useTabVisibility(refreshAll, 5 * 60 * 1000);

    const stats = useMemo(() => {
        if (!products.length && !transactions.length) return null;

        let total_inventory = 0;
        let low_stock_items = 0;
        let out_of_stock_items = 0;
        // Đơn hàng pending/approved đang giữ hàng (chưa xuất thực tế)
        const reservedByProduct: Record<string, number> = {};
        orders.forEach(o => {
            if (o.status === 'pending' || o.status === 'approved') {
                reservedByProduct[o.product_id] = (reservedByProduct[o.product_id] || 0) + Number(o.quantity || 0);
            }
        });

        products.forEach(p => {
            // stockMap đã trừ pending/approved orders rồi (trong inventorySlice)
            const qty = stockMap[p.id] || 0;
            total_inventory += Math.max(0, qty); // chỉ tính dương
            if (qty <= 0) out_of_stock_items++;
            else if (qty < 10) low_stock_items++;
        });

        // Tổng đang đặt hàng
        const total_reserved = Object.values(reservedByProduct).reduce((a, b) => a + b, 0);

        const recent_transactions = [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);

        const weekly_stats: { date: string, inbound: number, outbound: number }[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            weekly_stats.push({ date: dateStr, inbound: 0, outbound: 0 });
        }

        transactions.forEach(t => {
            const tDate = new Date(t.date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
            const dayStat = weekly_stats.find(w => w.date === tDate);
            if (dayStat) {
                if (t.type === 'inbound') dayStat.inbound += t.quantity;
                else dayStat.outbound += t.quantity;
            }
        });

        const normalizeCategory = (cat: string) => {
            const trimmed = cat.trim();
            if (!trimmed) return 'Khác';
            // Capitalize first letter, lower case the rest for consistent grouping
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        };

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            const cat = normalizeCategory(p.category || 'Khác');
            catMap[cat] = (catMap[cat] || 0) + 1;
        });
        const category_stats = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);

        return {
            total_products: products.length,
            total_inventory,
            total_reserved,
            low_stock_items,
            out_of_stock_items,
            recent_transactions,
            weekly_stats,
            category_stats
        } as DashboardStats & { total_reserved: number };

    }, [products, transactions, orders, stockMap]);

    if (isLoading && !stats) return <DashboardSkeleton />;

    if (!stats) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={4} minHeight="50vh">
                <WarningIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2 }} />
                <Typography variant="h6" color="#475569" gutterBottom>
                    Không có dữ liệu
                </Typography>
                <Typography variant="body2" color="#64748b" align="center" sx={{ maxWidth: 400 }}>
                    Chưa có sản phẩm hoặc giao dịch nào trong hệ thống.
                </Typography>
            </Box>
        );
    }

    const pieData = stats.category_stats.length > 0
        ? stats.category_stats.map((c, i) => ({
            name: c.name || 'Khác',
            value: Number(c.value),
            color: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5]
        }))
        : [{ name: 'Chưa có dữ liệu', value: 1, color: '#e2e8f0' }];

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
            <Box mb={4} display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
                <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-1px' }}>
                        Tổng quan
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', mt: 0.5 }}>
                        {lastUpdated
                            ? `Cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Cập nhật hiệu suất tồn kho thời gian thực'
                        }
                    </Typography>
                </Box>
                <Tooltip title="Làm mới dữ liệu">
                    <IconButton
                        onClick={refreshAll}
                        disabled={isLoading}
                        sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5 }}
                    >
                        <RefreshIcon sx={{ fontSize: 20, color: isLoading ? '#94a3b8' : '#475569' }} />
                    </IconButton>
                </Tooltip>
            </Box>

            <Grid container spacing={2} mb={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="TỔNG SẢN PHẨM" 
                        value={stats.total_products} 
                        icon={<InventoryIcon />} 
                        color="#0f766e"
                        subtitle="Tất cả danh mục hệ thống"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="TỒN KHO KHẢ DỤNG" 
                        value={stats.total_inventory.toLocaleString('vi-VN')} 
                        icon={<ShippingIcon />} 
                        color="#10b981"
                        subtitle={`Đang giữ: ${(stats as any).total_reserved?.toLocaleString('vi-VN') || 0} (chờ xuất)`}
                        trend="up"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="SẮP HẾT HÀNG" 
                        value={stats.low_stock_items} 
                        icon={<WarningIcon />} 
                        color="#f59e0b"
                        subtitle="Dưới 10 sản phẩm"
                        onClick={() => navigate('/products?filter=low_stock')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="HẾT HÀNG" 
                        value={stats.out_of_stock_items} 
                        icon={<ErrorIcon />} 
                        color="#ef4444"
                        subtitle="Kho đã cạn kiệt"
                        onClick={() => navigate('/products?filter=out_of_stock')}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: 420, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a' }}>Biến động nhập/xuất (7 ngày qua)</Typography>
                            <Chip size="small" label="Hàng ngày" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 500 }} />
                        </Box>
                        <Box sx={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.weekly_stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <RechartsTooltip 
                                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', backgroundColor: 'white' }} 
                                        itemStyle={{ fontWeight: 600 }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#475569' }} iconType="circle" />
                                    <Area type="monotone" dataKey="inbound" name="Nhập kho" stroke="#10b981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={2.5} />
                                    <Area type="monotone" dataKey="outbound" name="Xuất kho" stroke="#3b82f6" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2.5} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: 420, border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a', mb: 1 }}>Cơ cấu danh mục</Typography>
                        <Box sx={{ height: 300, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={4}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569' }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <Box sx={{
                                position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
                                textAlign: 'center'
                            }}>
                                <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f172a' }}>{stats.total_products}</Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>Sản phẩm</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                    <Paper elevation={0} sx={{ p: 0, borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                        <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#0f172a' }}>Hoạt động gần đây</Typography>
                            <Chip label="Trực tiếp" size="small" sx={{ bgcolor: alpha('#10b981', 0.1), color: '#10b981', fontWeight: 600, border: 'none' }} />
                        </Box>
                        <List sx={{ p: 0 }}>
                            {stats.recent_transactions.length === 0 ? (
                                <ListItem>
                                    <ListItemText primary="Không tìm thấy giao dịch gần đây" sx={{ color: '#64748b', textAlign: 'center', py: 3 }} />
                                </ListItem>
                            ) : stats.recent_transactions.map((t, idx) => (
                                <ListItem key={t.id ? `tx-${t.id}` : `recent-tx-${idx}`} divider sx={{ py: 2, px: 3, '&:hover': { bgcolor: '#f8fafc' }, transition: '0.2s', borderBottom: idx === stats.recent_transactions.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                    <Box sx={{
                                        p: 1.5, borderRadius: '50%', mr: 2.5,
                                        bgcolor: t.type === 'inbound' ? alpha('#10b981', 0.1) : alpha('#3b82f6', 0.1),
                                        color: t.type === 'inbound' ? '#10b981' : '#3b82f6',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        {t.type === 'inbound' ? <TrendingUpIcon fontSize="small" /> : <TrendingDownIcon fontSize="small" />}
                                    </Box>
                                    <ListItemText
                                        primary={<Typography sx={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{t.product?.name || (t as any).product_name || `Product #${t.product_id}`}</Typography>}
                                        secondary={t.date ? new Date(t.date).toLocaleString('vi-VN', { timeStyle: 'short', dateStyle: 'medium' }) : 'N/A'}
                                        secondaryTypographyProps={{ sx: { color: '#64748b', fontSize: '0.8rem', mt: 0.5 } }}
                                    />
                                    <Box textAlign="right">
                                        <Typography variant="body1" sx={{ fontWeight: 700, color: t.type === 'inbound' ? '#10b981' : '#0f172a' }}>
                                            {t.type === 'inbound' ? '+' : '-'}{t.quantity} sản phẩm
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block' }}>
                                            {t.group_name || 'Kho chính'}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                            NV: {employees.find(e => e.id === (t as any).created_by || e.auth_user_id === (t as any).created_by)?.full_name || (t as any).created_by || 'Khuyết danh'}
                                        </Typography>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
