import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, List, ListItem, ListItemText, Chip, Grid, IconButton, Tooltip, Avatar
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
import { fetchEmployees } from '../store/slices/employeesSlice';

import DashboardSkeleton from './DashboardSkeleton';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { formatDate, parseDate } from '../utils/dateUtils';
import { formatNumber } from '../utils/numberUtils';

// Premium HSL semantic color palette
const COLORS = {
    primary: '#4f46e5',   // Aurora Indigo
    success: '#10b981',   // Emerald Mint
    warning: '#f59e0b',   // Vibrant Amber
    error: '#f43f5e',     // Rose Crimson
    slate: '#64748b'
};

const MetricCard = ({ title, value, subtitle, icon, color, trend, onClick }: any) => {
    const bgLight = alpha(color, 0.05);
    const borderLight = alpha(color, 0.12);

    return (
        <Paper 
            elevation={0} 
            onClick={onClick}
            sx={{ 
                p: { xs: 3, sm: 3.5 }, 
                borderRadius: '24px', 
                border: `1px solid ${borderLight}`,
                bgcolor: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '4px',
                    bgcolor: color,
                    opacity: 0.85,
                },
                '&:hover': onClick ? {
                    transform: 'translateY(-6px)',
                    boxShadow: `0 20px 30px -10px ${alpha(color, 0.16)}`,
                    borderColor: color,
                    '& .icon-box': {
                        transform: 'scale(1.1) rotate(5deg)',
                        bgcolor: alpha(color, 0.18),
                        boxShadow: `0 8px 20px -4px ${alpha(color, 0.3)}`
                    }
                } : {}
            }}
        >
            <Box display="flex" alignItems="center" gap={2} mb={2.5}>
                {icon && (
                    <Box className="icon-box" sx={{ 
                        color: color, 
                        display: 'flex', 
                        p: 1.5, 
                        bgcolor: bgLight, 
                        borderRadius: '16px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        border: `1px solid ${alpha(color, 0.08)}`
                    }}>
                        {React.cloneElement(icon, { sx: { fontSize: 24 }})}
                    </Box>
                )}
                <Typography variant="caption" sx={{ 
                    color: '#64748b', 
                    fontWeight: 800, 
                    letterSpacing: '1px',
                    fontFamily: '"Times New Roman", Times, serif',
                    textTransform: 'uppercase',
                    fontSize: '0.85rem'
                }}>
                    {title}
                </Typography>
            </Box>
            
            <Typography variant="h3" sx={{ 
                fontWeight: 900, 
                color: '#0f172a', 
                mb: 1.5, 
                fontSize: '2.75rem', 
                letterSpacing: '-1px',
                fontFamily: '"Times New Roman", Times, serif'
            }}>
                {value}
            </Typography>
            
            {subtitle && (
                <Box display="flex" alignItems="center" gap={1} sx={{ mt: 'auto' }}>
                    {trend && (
                        <Box sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            bgcolor: trend === 'up' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.06)',
                            p: 0.5,
                            borderRadius: '6px'
                        }}>
                            {trend === 'up' ? (
                                <TrendingUpIcon sx={{ color: COLORS.success, fontSize: 14 }} />
                            ) : (
                                <TrendingDownIcon sx={{ color: COLORS.slate, fontSize: 14 }} />
                            )}
                        </Box>
                    )}
                    <Typography variant="body2" sx={{ 
                        color: '#64748b', 
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        fontFamily: '"Times New Roman", Times, serif'
                    }}>
                        {subtitle}
                    </Typography>
                </Box>
            )}
        </Paper>
    );
};

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

    // Fetch again if tab becomes active and data is stale (> 5 minutes)
    useTabVisibility(refreshAll, 5 * 60 * 1000);

    const stats = useMemo(() => {
        if (!products.length && !transactions.length) return null;

        let total_inventory = 0;
        let low_stock_items = 0;
        let out_of_stock_items = 0;
        
        const reservedByProduct: Record<string, number> = {};
        orders.forEach(o => {
            if (o.status === 'pending' || o.status === 'approved') {
                reservedByProduct[o.product_id] = (reservedByProduct[o.product_id] || 0) + Number(o.quantity || 0);
            }
        });

        products.forEach(p => {
            const qty = stockMap[p.id] || 0;
            total_inventory += Math.max(0, qty); // only positive
            if (qty <= 0) out_of_stock_items++;
            else if (qty < 10) low_stock_items++;
        });

        const total_reserved = Object.values(reservedByProduct).reduce((a, b) => a + b, 0);

        const recent_transactions = [...transactions]
            .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
            .slice(0, 5);

        const weekly_stats: { date: string, inbound: number, outbound: number }[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = formatDate(d).substring(0, 5); // dd/mm
            weekly_stats.push({ date: dateStr, inbound: 0, outbound: 0 });
        }

        transactions.forEach(t => {
            const tDate = formatDate(t.date).substring(0, 5);
            const dayStat = weekly_stats.find(w => w.date === tDate);
            if (dayStat) {
                if (t.type === 'inbound') dayStat.inbound += t.quantity;
                else dayStat.outbound += t.quantity;
            }
        });

        const normalizeCategory = (cat: string) => {
            const trimmed = cat.trim();
            if (!trimmed) return 'Khác';
            return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
        };

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            const cat = normalizeCategory(p.category || 'Khác');
            const qty = stockMap[p.id] || 0;
            catMap[cat] = (catMap[cat] || 0) + Math.max(0, qty);
        });
        const category_stats = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const employeeMap: Record<string, string> = {};
        employees.forEach(e => {
            if (e.id) employeeMap[e.id] = e.full_name;
            if (e.auth_user_id) employeeMap[e.auth_user_id] = e.full_name;
        });

        return {
            total_products: products.length,
            total_inventory,
            total_reserved,
            low_stock_items,
            out_of_stock_items,
            recent_transactions,
            weekly_stats,
            category_stats,
            employeeMap
        };
    }, [products, transactions, orders, stockMap, employees]);

    if (isLoading && !stats) return <DashboardSkeleton />;

    if (!stats) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={4} minHeight="50vh">
                <WarningIcon sx={{ fontSize: 60, color: '#94a3b8', mb: 2 }} />
                <Typography variant="h6" color="#475569" gutterBottom sx={{ fontFamily: '"Times New Roman", Times, serif', fontWeight: 700 }}>
                    Không có dữ liệu
                </Typography>
                <Typography variant="body2" color="#64748b" align="center" sx={{ maxWidth: 400, fontFamily: '"Times New Roman", Times, serif' }}>
                    Chưa có sản phẩm hoặc giao dịch nào trong hệ thống.
                </Typography>
            </Box>
        );
    }

    const pieData = stats.category_stats.length > 0
        ? stats.category_stats.map((c, i) => ({
            name: c.name || 'Khác',
            value: Number(c.value),
            color: [COLORS.success, COLORS.primary, COLORS.warning, COLORS.error, '#8b5cf6'][i % 5]
        }))
        : [{ name: 'Chưa có dữ liệu', value: 1, color: '#e2e8f0' }];

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 2, md: 4 }, position: 'relative' }}>
            
            {/* Soft Ambient Background Light Blur Spot */}
            <Box sx={{
                position: 'absolute',
                top: '-15%',
                right: '5%',
                width: '450px',
                height: '450px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${alpha(COLORS.primary, 0.06)} 0%, rgba(255, 255, 255, 0) 70%)`,
                filter: 'blur(40px)',
                pointerEvents: 'none',
                zIndex: 0
            }} />

            {/* Top Dashboard Header Block */}
            <Box mb={5} display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={3} sx={{ position: 'relative', zIndex: 1 }}>
                <Box>
                    <Typography variant="h4" sx={{ 
                        fontWeight: 900, 
                        color: '#0f172a', 
                        letterSpacing: '-0.02em',
                        background: 'linear-gradient(135deg, #0f172a 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: { xs: '2rem', md: '2.75rem' },
                        fontFamily: '"Times New Roman", Times, serif'
                    }}>
                        Trung tâm điều khiển
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', mt: 0.8, fontWeight: 600, fontFamily: '"Times New Roman", Times, serif', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: COLORS.success, animation: 'pulse 2s infinite' }} />
                        {lastUpdated
                            ? `Dữ liệu cập nhật lúc ${lastUpdated.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                            : 'Theo dõi hiệu suất vận hành kho thời gian thực'
                        }
                    </Typography>
                </Box>
                <Tooltip title="Làm mới toàn bộ dữ liệu">
                    <IconButton
                        onClick={refreshAll}
                        disabled={isLoading}
                        sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.8)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid #e2e8f0', 
                            borderRadius: '16px', 
                            p: 2,
                            boxShadow: '0 4px 10px -4px rgba(0,0,0,0.05)',
                            transition: 'all 0.3s',
                            '&:hover': {
                                transform: 'rotate(45deg)',
                                bgcolor: '#f8fafc',
                                border: `1px solid ${COLORS.primary}`
                            }
                        }}
                    >
                        <RefreshIcon sx={{ 
                            fontSize: 22, 
                            color: isLoading ? '#94a3b8' : '#475569',
                            animation: isLoading ? 'spin 1.5s linear infinite' : 'none',
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' }
                            }
                        }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Premium Metric Grid */}
            <Grid container spacing={3} mb={4} sx={{ position: 'relative', zIndex: 1 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="TỔNG SẢN PHẨM" 
                        value={stats.total_products} 
                        icon={<InventoryIcon />} 
                        color={COLORS.primary}
                        subtitle="Tất cả danh mục hệ thống"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="TỒN KHO KHẢ DỤNG" 
                        value={formatNumber(stats.total_inventory)} 
                        icon={<ShippingIcon />} 
                        color={COLORS.success}
                        subtitle={`Đang giữ: ${formatNumber(stats.total_reserved || 0)} (chờ xuất)`}
                        trend="up"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="SẮP HẾT HÀNG" 
                        value={stats.low_stock_items} 
                        icon={<WarningIcon />} 
                        color={COLORS.warning}
                        subtitle="Dưới 10 sản phẩm"
                        onClick={() => navigate('/products?filter=low_stock')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <MetricCard 
                        title="HẾT HÀNG" 
                        value={stats.out_of_stock_items} 
                        icon={<ErrorIcon />} 
                        color={COLORS.error}
                        subtitle="Kho đã cạn kiệt"
                        onClick={() => navigate('/products?filter=out_of_stock')}
                    />
                </Grid>
            </Grid>

            {/* Graphs and Distribution Section */}
            <Grid container spacing={4} mb={4} sx={{ position: 'relative', zIndex: 1 }}>
                
                {/* Transaction Fluctuations Area Chart */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 4, 
                            borderRadius: '28px', 
                            height: 440, 
                            border: '1px solid rgba(226, 232, 240, 0.6)', 
                            bgcolor: 'rgba(255, 255, 255, 0.8)', 
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                        }}
                    >
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3.5}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', fontFamily: '"Times New Roman", Times, serif' }}>
                                Biến động giao dịch
                            </Typography>
                            <Chip size="small" label="7 ngày qua" sx={{ bgcolor: alpha(COLORS.primary, 0.06), color: COLORS.primary, fontWeight: 800, borderRadius: '8px', px: 1.5, py: 1.8, fontSize: '0.75rem', fontFamily: '"Times New Roman", Times, serif' }} />
                        </Box>
                        <Box sx={{ height: 320, width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.weekly_stats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.25} />
                                            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontFamily: '"Times New Roman", Times, serif', fontWeight: 500 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontFamily: '"Times New Roman", Times, serif', fontWeight: 500 }} />
                                    <RechartsTooltip 
                                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)', backgroundColor: 'white', fontFamily: '"Times New Roman", Times, serif' }} 
                                        itemStyle={{ fontWeight: 700 }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', color: '#475569', fontFamily: '"Times New Roman", Times, serif', fontWeight: 600 }} iconType="circle" />
                                    <Area type="monotone" dataKey="inbound" name="Nhập kho" stroke={COLORS.success} fillOpacity={1} fill="url(#colorIn)" strokeWidth={3} />
                                    <Area type="monotone" dataKey="outbound" name="Xuất kho" stroke={COLORS.primary} fillOpacity={1} fill="url(#colorOut)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Box>
                    </Paper>
                </Grid>

                {/* Stock Allocation Pie Chart */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 4, 
                            borderRadius: '28px', 
                            height: 440, 
                            border: '1px solid rgba(226, 232, 240, 0.6)', 
                            bgcolor: 'rgba(255, 255, 255, 0.8)', 
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, letterSpacing: '-0.5px', fontFamily: '"Times New Roman", Times, serif' }}>
                            Phân bổ tồn kho
                        </Typography>
                        <Box sx={{ height: 310, position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08)', fontFamily: '"Times New Roman", Times, serif' }} />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#475569', fontFamily: '"Times New Roman", Times, serif', fontWeight: 600 }} />
                                </PieChart>
                            </ResponsiveContainer>
                            <Box sx={{
                                position: 'absolute', top: '44%', left: '50%', transform: 'translate(-50%, -50%)',
                                textAlign: 'center'
                            }}>
                                <Typography variant="h3" sx={{ fontWeight: 900, color: '#0f172a', fontFamily: '"Times New Roman", Times, serif', letterSpacing: '-1px' }}>
                                    {formatNumber(stats.total_inventory)}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem', fontFamily: '"Times New Roman", Times, serif' }}>
                                    Tồn kho
                                </Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Bottom Real-time History logs */}
            <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1 }}>
                <Grid size={{ xs: 12 }}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 0, 
                            borderRadius: '28px', 
                            overflow: 'hidden', 
                            border: '1px solid rgba(226, 232, 240, 0.6)', 
                            bgcolor: 'rgba(255, 255, 255, 0.8)', 
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.02)'
                        }}
                    >
                        <Box sx={{ px: 4, py: 3, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', fontFamily: '"Times New Roman", Times, serif' }}>
                                Lịch sử hoạt động gần đây
                            </Typography>
                            <Chip label="Real-time" size="small" sx={{ bgcolor: alpha(COLORS.success, 0.08), color: COLORS.success, fontWeight: 800, borderRadius: '8px', px: 1.5, fontSize: '0.72rem', fontFamily: '"Times New Roman", Times, serif' }} />
                        </Box>
                        <List sx={{ p: 0 }}>
                            {stats.recent_transactions.length === 0 ? (
                                <ListItem>
                                    <ListItemText primary="Không tìm thấy giao dịch gần đây" sx={{ color: '#64748b', textAlign: 'center', py: 4, fontFamily: '"Times New Roman", Times, serif', fontWeight: 500 }} />
                                </ListItem>
                            ) : stats.recent_transactions.map((t, idx) => (
                                <ListItem 
                                    key={t.id ? `tx-${t.id}` : `recent-tx-${idx}`} 
                                    sx={{ 
                                        py: 2.5, 
                                        px: 4, 
                                        '&:hover': { bgcolor: 'rgba(248, 250, 252, 0.6)' }, 
                                        transition: '0.2s', 
                                        borderBottom: idx === stats.recent_transactions.length - 1 ? 'none' : '1px solid #f1f5f9' 
                                    }}
                                >
                                    <Avatar sx={{
                                        p: 1, borderRadius: '16px', mr: 2.5, width: 44, height: 44,
                                        bgcolor: t.type === 'inbound' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(79, 70, 229, 0.06)',
                                        color: t.type === 'inbound' ? COLORS.success : COLORS.primary,
                                    }}>
                                        {t.type === 'inbound' ? <TrendingUpIcon fontSize="medium" /> : <TrendingDownIcon fontSize="medium" />}
                                    </Avatar>
                                    <ListItemText
                                        primary={
                                            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.975rem', fontFamily: '"Times New Roman", Times, serif' }}>
                                                {t.product?.name || (t as any).product_name || `Sản phẩm #${t.product_id}`}
                                            </Typography>
                                        }
                                        secondary={
                                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.5, display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>
                                                {t.date ? formatDate(t.date) : 'N/A'}
                                            </Typography>
                                        }
                                    />
                                    <Box textAlign="right">
                                        <Typography variant="body1" sx={{ fontWeight: 800, color: t.type === 'inbound' ? COLORS.success : '#0f172a', fontFamily: '"Times New Roman", Times, serif', fontSize: '1.15rem' }}>
                                            {t.type === 'inbound' ? '+' : '-'}{formatNumber(t.quantity)} sản phẩm
                                        </Typography>
                                        <Box display="flex" flexDirection="column" gap={0.2} sx={{ mt: 0.5 }}>
                                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', fontSize: '0.75rem', fontFamily: '"Times New Roman", Times, serif' }}>
                                                {t.group_name || 'Kho chính'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 500, fontFamily: '"Times New Roman", Times, serif' }}>
                                                Nhân viên: {stats.employeeMap[(t as any).created_by] || (t as any).created_by || 'Khuyết danh'}
                                            </Typography>
                                        </Box>
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
