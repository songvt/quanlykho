import { useEffect, useState } from 'react';
import {
    Box, Paper, Typography, List, ListItem, ListItemText, CircularProgress, Chip, Grid,
} from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import WarningIcon from '@mui/icons-material/Warning';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const Dashboard = () => {
    const [stats, setStats] = useState<import('../types').DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadStats = async () => {
            try {
                const data = await import('../services/SupabaseService').then(m => m.SupabaseService.getDashboardStats());
                setStats(data);
            } catch (error) {
                console.error('Failed to load dashboard stats', error);
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    if (loading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    if (!stats) {
        return (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={4} minHeight="50vh">
                <WarningIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                    Không thể tải dữ liệu Dashboard.
                </Typography>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                    Có thể bạn chưa cập nhật Cơ sở dữ liệu (SQL). Vui lòng chạy file migration để tạo hàm <code>get_dashboard_stats</code>.
                </Typography>
            </Box>
        );
    }

    const pieData = stats.category_stats.length > 0
        ? stats.category_stats.map((c, i) => ({
            name: c.name || 'Khác',
            value: Number(c.value),
            color: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'][i % 5]
        }))
        : [{ name: 'Chưa có dữ liệu', value: 1, color: '#E2E8F0' }];

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ bgcolor: '#F8FAFC', minHeight: '100vh', maxWidth: '100%', mx: 'auto' }}>
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



            {/* Charts Section */}
            <Grid container spacing={{ xs: 1, sm: 3 }} mb={{ xs: 2, sm: 4 }}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 4, height: 400, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <Typography variant="h6" fontWeight="700" mb={3}>Biến Động Nhập/Xuất (7 Ngày Qua)</Typography>
                        <ResponsiveContainer width="100%" height="90%">
                            <AreaChart data={stats.weekly_stats}>
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
                                <Typography variant="h4" fontWeight="bold">{stats.total_products}</Typography>
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
                            {stats.recent_transactions.map((t, idx) => (
                                <ListItem key={t.id || idx} divider sx={{ '&:hover': { bgcolor: '#F8FAFC' }, transition: '0.2s' }}>
                                    <Box sx={{
                                        p: 1.5, borderRadius: 3, mr: 2,
                                        bgcolor: t.type === 'inbound' ? '#ECFDF5' : '#EFF6FF',
                                        color: t.type === 'inbound' ? '#10B981' : '#3B82F6'
                                    }}>
                                        {t.type === 'inbound' ? <TrendingUpIcon /> : <SwapHorizIcon />}
                                    </Box>
                                    <ListItemText
                                        primary={<Typography fontWeight="600">{t.product?.name || (t as any).product_name || `Product #${t.product_id}`}</Typography>}
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
                            <Typography variant="h6" fontWeight="700" color="error">Cần Chú Ý ({stats.low_stock_items + stats.out_of_stock_items})</Typography>
                        </Box>
                        <Box p={3} textAlign="center">
                            <WarningIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1, opacity: 0.5 }} />
                            <Typography variant="body2" color="text.secondary">
                                Hiện tại có {stats.out_of_stock_items} sản phẩm hết hàng và {stats.low_stock_items} sản phẩm sắp hết.
                                <br />
                                Vui lòng kiểm tra báo cáo tồn kho chi tiết.
                            </Typography>
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default Dashboard;
