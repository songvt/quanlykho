import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Card, CardContent, List, ListItem, ListItemText, CircularProgress, Chip, Grid,
} from '@mui/material';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory } from '../store/slices/inventorySlice';
import { fetchTransactions } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import InventoryIcon from '@mui/icons-material/Inventory';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const Dashboard = () => {
    const dispatch = useDispatch<AppDispatch>();

    // Selectors
    const { items: products, status: prodStatus } = useSelector((state: RootState) => state.products);
    const { stockMap, status: invStatus } = useSelector((state: RootState) => state.inventory);
    const { items: transactions, status: transStatus } = useSelector((state: RootState) => state.transactions);

    useEffect(() => {
        if (prodStatus === 'idle') dispatch(fetchProducts());
        if (invStatus === 'idle') dispatch(fetchInventory());
        if (transStatus === 'idle') dispatch(fetchTransactions());
    }, [dispatch, prodStatus, invStatus, transStatus]);

    const isLoading = prodStatus === 'loading' || invStatus === 'loading' || transStatus === 'loading';

    // Data Processing
    const totalProducts = products.length;

    // Inventory Status
    const inventoryStats = useMemo(() => {
        const stats = {
            inStock: 0,
            lowStock: 0,
            outOfStock: 0,
            totalItems: 0
        };
        const lowDetails: any[] = [];

        Object.entries(stockMap).forEach(([prodId, qty]) => {
            stats.totalItems += qty;
            if (qty === 0) {
                stats.outOfStock++;
                lowDetails.push({ id: prodId, qty: 0 });
            } else if (qty < 10) {
                stats.lowStock++;
                lowDetails.push({ id: prodId, qty });
            } else {
                stats.inStock++;
            }
        });
        return { stats, lowDetails };
    }, [stockMap]);

    const pieData = [
        { name: 'Còn hàng', value: inventoryStats.stats.inStock, color: '#10B981' }, // Emerald 500
        { name: 'Sắp hết', value: inventoryStats.stats.lowStock, color: '#F59E0B' }, // Amber 500
        { name: 'Hết hàng', value: inventoryStats.stats.outOfStock, color: '#EF4444' }, // Red 500
    ];

    // Transaction History (Last 7 Days)
    const transactionHistory = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d.toISOString().split('T')[0];
        }).reverse();

        const data = last7Days.map(date => ({
            date: date.split('-').slice(1).join('/'), // MM/DD
            fullDate: date,
            inbound: 0,
            outbound: 0
        }));

        transactions.forEach(t => {
            if (!t.date) return;
            const tDate = t.date.split('T')[0];
            const dayData = data.find(d => d.fullDate === tDate);
            if (dayData) {
                if (t.type === 'inbound') dayData.inbound += t.quantity;
                else dayData.outbound += t.quantity;
            }
        });

        return data;
    }, [transactions]);

    const todayTransactions = transactions.filter(t => {
        if (!t.date) return false;
        const tDate = new Date(t.date).toDateString();
        const today = new Date().toDateString();
        return tDate === today;
    }).length;

    // Recent Transactions (Last 5)
    const recentTransactions = [...transactions].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    }).slice(0, 5);

    if (isLoading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    const StatCard = ({ title, value, icon, gradient }: any) => (
        <Card sx={{
            height: '100%',
            borderRadius: 3,
            background: gradient,
            color: 'white',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <Box sx={{ position: 'absolute', top: -15, right: -15, opacity: 0.15, transform: 'rotate(15deg)' }}>
                {/* Clone icon to modify props if needed, or just wrap */}
                <Box sx={{ transform: 'scale(0.8)' }}>{icon}</Box>
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } }, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 1, sm: 2 } }}>
                    <Typography variant="subtitle2" sx={{ opacity: 0.95, fontWeight: 700, fontSize: { xs: '0.9rem', sm: '1rem' } }}>{title}</Typography>
                    <Typography variant="h3" fontWeight="bold" sx={{ fontSize: { xs: '1.75rem', sm: '3rem' }, lineHeight: 1 }}>{value}</Typography>
                </Box>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.2)', height: 4, borderRadius: 2, width: '100%' }} />
            </CardContent>
        </Card>
    );

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', maxWidth: 1000, mx: 'auto', zoom: { xs: 0.85, md: 1 } }}>
            <Box mb={{ xs: 2, sm: 4 }}>
                <Typography variant="h4" fontWeight="900" sx={{
                    fontSize: { xs: '1.5rem', sm: '2.125rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(45deg, #2563EB 30%, #4F46E5 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '0.5px'
                }}>
                    TỔNG QUAN KHO HÀNG
                </Typography>
                <Typography variant="body1" color="text.secondary" mt={1} sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>
                    Cập nhật tình hình hoạt động thời gian thực
                </Typography>
            </Box>

            {/* KPI Cards */}
            <Grid container spacing={{ xs: 1, sm: 3 }} mb={{ xs: 2, sm: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="TỔNG SẢN PHẨM"
                        value={totalProducts}
                        icon={<InventoryIcon sx={{ fontSize: 120 }} />}
                        gradient="linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="GIAO DỊCH HÔM NAY"
                        value={todayTransactions}
                        icon={<SwapHorizIcon sx={{ fontSize: 120 }} />}
                        gradient="linear-gradient(135deg, #10B981 0%, #059669 100%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="CẢNH BÁO HẾT HÀNG"
                        value={inventoryStats.stats.lowStock + inventoryStats.stats.outOfStock}
                        icon={<WarningIcon sx={{ fontSize: 120 }} />}
                        gradient="linear-gradient(135deg, #F59E0B 0%, #D97706 100%)"
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="TỔNG TỒN KHO"
                        value={inventoryStats.stats.totalItems}
                        icon={<TrendingUpIcon sx={{ fontSize: 120 }} />}
                        gradient="linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)"
                    />
                </Grid>
            </Grid>

            {/* Charts Section */}
            <Grid container spacing={{ xs: 1, sm: 3 }} mb={{ xs: 2, sm: 4 }}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, height: 400, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <Typography variant="h6" fontWeight="700" mb={3}>Biến Động Nhập/Xuất (7 Ngày Qua)</Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={transactionHistory}>
                                <defs>
                                    <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                <Legend />
                                <Area type="monotone" dataKey="inbound" name="Nhập kho" stroke="#10B981" fillOpacity={1} fill="url(#colorIn)" strokeWidth={2} />
                                <Area type="monotone" dataKey="outbound" name="Xuất kho" stroke="#3B82F6" fillOpacity={1} fill="url(#colorOut)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, height: 400, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <Typography variant="h6" fontWeight="700" mb={3}>Cơ Cấu Kho Hàng</Typography>
                        <Box sx={{ height: '70%', position: 'relative' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                            <Box sx={{
                                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                textAlign: 'center'
                            }}>
                                <Typography variant="h4" fontWeight="bold">{totalProducts}</Typography>
                                <Typography variant="caption" color="text.secondary">Sản phẩm</Typography>
                            </Box>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Bottom Section: Recent & Alerts */}
            <Grid container spacing={{ xs: 1, sm: 3 }}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper elevation={0} sx={{ p: 0, borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6" fontWeight="700">Giao Dịch Gần Đây</Typography>
                            <Chip label="Real-time" color="success" size="small" variant="outlined" />
                        </Box>
                        <List sx={{ p: 0 }}>
                            {recentTransactions.map((t, idx) => (
                                <ListItem key={t.id || idx} divider sx={{ '&:hover': { bgcolor: '#F8FAFC' }, transition: '0.2s' }}>
                                    <Box sx={{
                                        p: 1.5, borderRadius: 3, mr: 2,
                                        bgcolor: t.type === 'inbound' ? '#ECFDF5' : '#EFF6FF',
                                        color: t.type === 'inbound' ? '#10B981' : '#3B82F6'
                                    }}>
                                        {t.type === 'inbound' ? <TrendingUpIcon /> : <SwapHorizIcon />}
                                    </Box>
                                    <ListItemText
                                        primary={<Typography fontWeight="600">{t.product?.name || `Product \#${t.product_id}`}</Typography>}
                                        secondary={t.date ? new Date(t.date).toLocaleString('vi-VN') : 'N/A'}
                                    />
                                    <Box textAlign="right">
                                        <Typography variant="body1" fontWeight="700" color={t.type === 'inbound' ? 'success.main' : 'primary.main'}>
                                            {t.type === 'inbound' ? '+' : '-'}{t.quantity}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {t.group_name || 'Kho Chính'}
                                        </Typography>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper elevation={0} sx={{ p: 0, borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #F1F5F9' }}>
                            <Typography variant="h6" fontWeight="700" color="error">Cần Chú Ý ({inventoryStats.stats.lowStock + inventoryStats.stats.outOfStock})</Typography>
                        </Box>
                        <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                            {inventoryStats.lowDetails.map((item, idx) => {
                                const prod = products.find(p => p.id === item.id);
                                return (
                                    <ListItem key={idx} divider>
                                        <Box sx={{ mr: 2 }}>
                                            <CircularProgress
                                                variant="determinate"
                                                value={100}
                                                size={40}
                                                thickness={4}
                                                sx={{ color: item.qty === 0 ? '#EF4444' : '#F59E0B', opacity: 0.2 }}
                                            />
                                            <Box sx={{ position: 'absolute', mt: -4.5, ml: 1.6 }}>
                                                <WarningIcon sx={{ fontSize: 16, color: item.qty === 0 ? '#EF4444' : '#F59E0B' }} />
                                            </Box>
                                        </Box>
                                        <ListItemText
                                            primary={<Typography fontWeight="600" noWrap>{prod?.name || 'Unknown'}</Typography>}
                                            secondary={`Mã: ${prod?.item_code}`}
                                        />
                                        <Chip
                                            label={item.qty === 0 ? 'Hết hàng' : `Còn ${item.qty}`}
                                            color={item.qty === 0 ? 'error' : 'warning'}
                                            size="small"
                                            sx={{ fontWeight: 'bold' }}
                                        />
                                    </ListItem>
                                )
                            })}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
