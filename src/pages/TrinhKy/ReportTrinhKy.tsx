import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Box, Paper, Typography, Grid, Card, LinearProgress, Alert, Button } from '@mui/material';
import { FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw, FileBarChart2, Printer } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { RootState } from '../../store';

const COLORS = ['#2563EB', '#F59E0B', '#10B981', '#EF4444', '#64748B'];

const ReportTrinhKy: React.FC = () => {
    const { profile } = useSelector((state: RootState) => state.auth);
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchStats = async () => {
        if (!profile?.id) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'stats',
                    payload: { userId: profile.id }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch statistics');
            setStats(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải báo cáo thống kê');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [profile]);

    const chartData = stats ? [
        { name: 'Hoàn thành', value: stats.total_completed, color: '#10B981' },
        { name: 'Đang ký', value: stats.total_signing, color: '#F59E0B' },
        { name: 'Chờ ký duyệt', value: stats.total_waiting, color: '#3B82F6' },
        { name: 'Từ chối', value: stats.total_rejected, color: '#EF4444' },
        { name: 'Bản nháp/Khác', value: stats.total_draft, color: '#64748B' }
    ].filter(d => d.value > 0) : [];

    const handlePrint = () => {
        window.print();
    };

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        BÁO CÁO THỐNG KÊ TRÌNH KÝ NỘI BỘ
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Phân tích số liệu, tỉ lệ xử lý hồ sơ trình ký toàn hệ thống
                    </Typography>
                </Box>
                <Box display="flex" gap={1}>
                    <Button variant="outlined" startIcon={<Printer size={16} />} onClick={handlePrint} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                        In báo cáo
                    </Button>
                    <Button variant="contained" startIcon={<RefreshCw size={16} />} onClick={fetchStats} disabled={isLoading} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                        Tải lại
                    </Button>
                </Box>
            </Box>

            {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}
            {isLoading && <LinearProgress sx={{ mb: 3, borderRadius: 1 }} />}

            {stats && (
                <>
                    {/* Metric Cards Grid */}
                    <Grid container spacing={3} mb={4}>
                        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                            <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, bgcolor: 'rgba(37, 99, 235, 0.1)', color: '#2563EB', borderRadius: '8px' }}>
                                    <FileText size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Tổng hồ sơ</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800 }}>{stats.total_hoso}</Typography>
                                </Box>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                            <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', borderRadius: '8px' }}>
                                    <Clock size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Hồ sơ chờ ký</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#3B82F6' }}>{stats.total_waiting}</Typography>
                                </Box>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                            <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B', borderRadius: '8px' }}>
                                    <RefreshCw size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Đang ký duyệt</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#F59E0B' }}>{stats.total_signing}</Typography>
                                </Box>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                            <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10B981', borderRadius: '8px' }}>
                                    <CheckCircle2 size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Đã hoàn thành</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#10B981' }}>{stats.total_completed}</Typography>
                                </Box>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
                            <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 2 }}>
                                <Box sx={{ p: 1, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', borderRadius: '8px' }}>
                                    <AlertTriangle size={24} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>Bị từ chối</Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#EF4444' }}>{stats.total_rejected}</Typography>
                                </Box>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Charts grid */}
                    <Grid container spacing={4}>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', height: '100%' }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                                    Biểu đồ phân bố trạng thái
                                </Typography>
                                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    {chartData.map((entry: any, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <Typography color="textSecondary">Chưa có đủ dữ liệu vẽ biểu đồ</Typography>
                                    )}
                                </Box>
                                {/* Legend */}
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mt: 2 }}>
                                    {chartData.map((d: any, idx: number) => (
                                        <Box key={idx} display="flex" alignItems="center" gap={0.5}>
                                            <Box sx={{ width: 10, height: 10, bgcolor: d.color, borderRadius: '50%' }} />
                                            <Typography sx={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {d.name}: {d.value}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            </Card>
                        </Grid>
                        <Grid size={{ xs: 12, md: 6 }}>
                            <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', height: '100%' }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
                                    Số lượng luân chuyển chi tiết
                                </Typography>
                                <Box sx={{ height: 300 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: -20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                            <YAxis />
                                            <RechartsTooltip />
                                            <Bar dataKey="value" fill="#EF4444" radius={[4, 4, 0, 0]}>
                                                {chartData.map((entry: any, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </Box>
                            </Card>
                        </Grid>
                    </Grid>
                </>
            )}
        </Box>
    );
};

export default ReportTrinhKy;
