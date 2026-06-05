import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, List, ListItem, ListItemText, Grid, IconButton, Tooltip, Avatar,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Divider, Badge
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
    LayoutDashboard, Users, MonitorSmartphone, Warehouse, QrCode, History, MessageSquare, Settings,
    Package, ShoppingCart, ArrowDownToLine, Truck, CornerUpLeft, PieChart, CheckSquare,
    TrendingUp, TrendingDown, AlertCircle, RefreshCw, Info, Star, StarOff, MoreVertical,
    Activity, ChevronRight, Copyright
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart as RechartsPieChart, Pie, Cell, AreaChart, Area
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

// Premium SaaS Color Tokens
const COLORS = {
    primary: 'var(--brand-primary)',
    secondary: 'var(--brand-secondary)',
    success: 'var(--brand-success)',
    warning: 'var(--brand-warning)',
    danger: 'var(--brand-danger)',
    slate: 'var(--text-secondary)'
};

// ── Metric Card Component ──
const MetricCard = ({ title, value, subtitle, icon: Icon, color, trend, onClick }: any) => {
    return (
        <Box 
            onClick={onClick}
            sx={{ 
                p: 2.5, 
                borderRadius: '16px', 
                bgcolor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                position: 'relative',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                '&:hover': onClick ? {
                    borderColor: 'var(--brand-primary)',
                    boxShadow: 'var(--shadow-soft)',
                    transform: 'translateY(-2px)',
                } : {}
            }}
        >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {title}
                </Typography>
                {Icon && (
                    <Box sx={{ color, display: 'flex', p: 0.75, bgcolor: alpha(color, 0.1), borderRadius: '8px' }}>
                        <Icon size={18} />
                    </Box>
                )}
            </Box>
            
            <Typography sx={{ fontWeight: 800, color: 'var(--text-primary)', mb: 1, fontSize: '2rem', letterSpacing: '-0.5px' }}>
                {value}
            </Typography>
            
            {subtitle && (
                <Box display="flex" alignItems="center" gap={1} sx={{ mt: 'auto' }}>
                    {trend && (
                        <Box sx={{ display: 'flex', alignItems: 'center', color: trend === 'up' ? COLORS.success : COLORS.slate }}>
                            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        </Box>
                    )}
                    <Typography sx={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.8rem' }}>
                        {subtitle}
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

// ── Modules Data ──
const modulesData = [
    { id: 'assets', title: 'Tài sản', desc: 'Quản lý công cụ dụng cụ, thiết bị văn phòng.', color: '#0284c7', icon: <MonitorSmartphone />, path: '/assets' },
    { id: 'products', title: 'Hàng hóa', desc: 'Danh mục hàng hóa, vật tư.', color: '#0d9488', icon: <Package />, path: '/products' },
    { id: 'inbound', title: 'Nhập kho', desc: 'Nhập kho vật tư, thiết bị.', color: '#16a34a', icon: <ArrowDownToLine />, path: '/inbound' },
    { id: 'outbound', title: 'Xuất kho', desc: 'Xuất kho vật tư cho kỹ thuật.', color: '#ea580c', icon: <Truck />, path: '/outbound' },
    { id: 'orders', title: 'Đặt hàng', desc: 'Đăng ký phê duyệt đơn.', color: '#f97316', icon: <ShoppingCart />, path: '/orders' },
    { id: 'audit', title: 'Kiểm kê kho', desc: 'Đối soát tồn kho thực tế.', color: '#4f46e5', icon: <CheckSquare />, path: '/audit' },
    { id: 'qr-generator', title: 'Tạo QR code', desc: 'In mã QR sản phẩm.', color: '#2563eb', icon: <QrCode />, path: '/qr-generator' },
    { id: 'action-history', title: 'Lịch sử', desc: 'Nhật ký hệ thống.', color: '#4b5563', icon: <History />, path: '/action-history' },
    { id: 'admin-hr', title: 'Hành chính', desc: 'Quản lý nhân viên, chấm công.', color: '#059669', icon: <Users />, path: '/admin-hr' },
];

const Dashboard = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { items: products, status: productStatus } = useSelector((state: RootState) => state.products);
    const { items: transactions, status: transactionStatus } = useSelector((state: RootState) => state.transactions);
    const { items: orders, status: orderStatus } = useSelector((state: RootState) => state.orders);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const stockMap = useSelector(selectStockMap);
    
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [placeholderModule, setPlaceholderModule] = useState<string | null>(null);

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
    }, [productStatus, transactionStatus, inventoryStatus, orderStatus, employeeStatus, dispatch]);

    useTabVisibility(refreshAll, 5 * 60 * 1000);

    const greeting = useMemo(() => {
        const hr = new Date().getHours();
        let text = 'Good evening';
        if (hr < 12) text = 'Good morning';
        else if (hr < 18) text = 'Good afternoon';
        return `${text}, ${profile?.full_name?.split(' ')[0] || 'User'}`;
    }, [profile]);

    const stats = useMemo(() => {
        if (!products.length && !transactions.length) return null;

        let total_inventory = 0;
        let low_stock_items = 0;
        let out_of_stock_items = 0;
        
        products.forEach(p => {
            const qty = stockMap[p.id] || 0;
            total_inventory += Math.max(0, qty);
            if (qty <= 0) out_of_stock_items++;
            else if (qty < 10) low_stock_items++;
        });

        const recent_transactions = [...transactions]
            .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime())
            .slice(0, 8);

        const weekly_stats: { date: string, inbound: number, outbound: number }[] = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            weekly_stats.push({ date: formatDate(d).substring(0, 5), inbound: 0, outbound: 0 });
        }

        transactions.forEach(t => {
            const tDate = formatDate(t.date).substring(0, 5);
            const dayStat = weekly_stats.find(w => w.date === tDate);
            if (dayStat) {
                if (t.type === 'inbound') dayStat.inbound += t.quantity;
                else dayStat.outbound += t.quantity;
            }
        });

        const catMap: Record<string, number> = {};
        products.forEach(p => {
            const cat = (p.category || 'Khác').trim();
            catMap[cat] = (catMap[cat] || 0) + Math.max(0, stockMap[p.id] || 0);
        });
        const category_stats = Object.entries(catMap)
            .map(([name, value]) => ({ name, value }))
            .filter(c => c.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return {
            total_products: products.length,
            total_inventory,
            low_stock_items,
            out_of_stock_items,
            recent_transactions,
            weekly_stats,
            category_stats
        };
    }, [products, transactions, stockMap]);

    if (isLoading && !stats) return <DashboardSkeleton />;

    if (!stats) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={4} minHeight="50vh">
                <AlertCircle size={48} color="var(--text-secondary)" />
                <Typography sx={{ mt: 2, fontWeight: 600, color: 'var(--text-primary)' }}>Không có dữ liệu</Typography>
            </Box>
        );
    }

    const pieData = stats.category_stats.length > 0
        ? stats.category_stats.map((c, i) => ({
            name: c.name || 'Khác',
            value: Number(c.value),
            color: ['#10b981', '#4f46e5', '#f59e0b', '#f43f5e', '#8b5cf6'][i % 5]
        }))
        : [{ name: 'Trống', value: 1, color: '#e2e8f0' }];

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 4 }}>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.5rem', md: '2rem' }, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        {greeting}
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.9rem', mt: 0.5 }}>
                        Here's what's happening in your warehouse today.
                    </Typography>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 2 }}>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        Last updated: {lastUpdated.toLocaleTimeString()}
                    </Typography>
                    <IconButton onClick={refreshAll} disabled={isLoading} sx={{ bgcolor: 'var(--bg-default)', border: '1px solid var(--border-color)' }}>
                        <RefreshCw size={16} />
                    </IconButton>
                </Box>
            </Box>

            {/* Metrics */}
            <Grid container spacing={2.5} mb={5}>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard 
                        title="Tổng sản phẩm" 
                        value={stats.total_products} 
                        icon={Package} 
                        color={COLORS.primary}
                        subtitle="Danh mục hệ thống"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard 
                        title="Tồn kho hiện tại" 
                        value={formatNumber(stats.total_inventory)} 
                        icon={Warehouse} 
                        color={COLORS.success}
                        subtitle="Số lượng vật tư"
                        trend="up"
                        onClick={() => navigate('/products')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard 
                        title="Cảnh báo tồn kho" 
                        value={stats.low_stock_items} 
                        icon={AlertCircle} 
                        color={COLORS.warning}
                        subtitle="Sắp hết hàng (< 10)"
                        onClick={() => navigate('/products?filter=low_stock')}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
                    <MetricCard 
                        title="Hết hàng" 
                        value={stats.out_of_stock_items} 
                        icon={AlertCircle} 
                        color={COLORS.danger}
                        subtitle="Cần nhập hàng ngay"
                        onClick={() => navigate('/products?filter=out_of_stock')}
                    />
                </Grid>
            </Grid>

            <Grid container spacing={4} mb={4}>
                {/* Apps Grid */}
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Box sx={{ mb: 4 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 2, color: 'var(--text-primary)' }}>Apps & Modules</Typography>
                        <Grid container spacing={2}>
                            {modulesData.map(mod => (
                                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mod.id}>
                                    <Box 
                                        onClick={() => navigate(mod.path)}
                                        sx={{
                                            p: 2,
                                            borderRadius: '12px',
                                            bgcolor: 'var(--bg-default)',
                                            border: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            '&:hover': {
                                                bgcolor: 'var(--bg-card)',
                                                borderColor: mod.color,
                                                transform: 'translateY(-2px)',
                                                boxShadow: 'var(--shadow-soft)'
                                            }
                                        }}
                                    >
                                        <Box sx={{ color: mod.color, p: 1, bgcolor: alpha(mod.color, 0.1), borderRadius: '8px' }}>
                                            {React.cloneElement(mod.icon, { size: 20 })}
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{mod.title}</Typography>
                                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{mod.desc.slice(0, 30)}...</Typography>
                                        </Box>
                                    </Box>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    {/* Chart */}
                    <Box sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', bgcolor: 'var(--bg-card)' }}>
                        <Box display="flex" justifyContent="space-between" mb={3}>
                            <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Lưu lượng xuất nhập</Typography>
                            <Box sx={{ display: 'flex', gap: 2, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: '#10b981' }} /> Nhập kho</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Box sx={{ w: 8, h: 8, borderRadius: '50%', bgcolor: '#4f46e5' }} /> Xuất kho</span>
                            </Box>
                        </Box>
                        <Box sx={{ height: 300, width: '100%' }}>
                            <ResponsiveContainer>
                                <AreaChart data={stats.weekly_stats} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                                        <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/><stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-medium)', backgroundColor: 'var(--bg-card)' }} />
                                    <Area type="monotone" dataKey="inbound" stroke="#10b981" fill="url(#colorIn)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="outbound" stroke="#4f46e5" fill="url(#colorOut)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </Box>
                    </Box>
                </Grid>

                {/* Activity Feed */}
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Box sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', bgcolor: 'var(--bg-card)', height: '100%' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 3, color: 'var(--text-primary)' }}>Hoạt động gần đây</Typography>
                        
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {stats.recent_transactions.map((t, i) => (
                                <Box key={t.id || i} sx={{ display: 'flex', gap: 2, pb: 2, borderBottom: i !== stats.recent_transactions.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                    <Box sx={{ mt: 0.5, color: t.type === 'inbound' ? '#10b981' : '#4f46e5' }}>
                                        {t.type === 'inbound' ? <ArrowDownToLine size={18} /> : <Truck size={18} />}
                                    </Box>
                                    <Box sx={{ flex: 1 }}>
                                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {t.type === 'inbound' ? 'Nhập' : 'Xuất'} {formatNumber(t.quantity)} {t.product?.name || (t as any).product_name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)', mt: 0.5 }}>
                                            {formatDate(t.date)} • {t.group_name || 'Kho chính'}
                                        </Typography>
                                    </Box>
                                </Box>
                            ))}
                            {stats.recent_transactions.length === 0 && (
                                <Typography sx={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textAlign: 'center', py: 4 }}>
                                    Không có hoạt động nào
                                </Typography>
                            )}
                        </Box>
                        
                        {stats.recent_transactions.length > 0 && (
                            <Button 
                                fullWidth 
                                sx={{ mt: 2, textTransform: 'none', color: 'var(--text-secondary)', fontWeight: 600 }}
                                onClick={() => navigate('/action-history')}
                            >
                                Xem toàn bộ lịch sử
                            </Button>
                        )}
                    </Box>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
