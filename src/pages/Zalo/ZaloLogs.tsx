import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Tooltip, IconButton } from '@mui/material';
import { Refresh, InfoOutlined } from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';

const API_LOGS = '/api/zalo?action=logs';

interface Log {
    id: string;
    recipient_phone: string;
    status: string;
    error_message?: string;
    created_at: string;
    sent_at?: string;
    zalo_campaigns?: { name: string };
    zalo_templates?: { template_name: string };
    params?: any;
}

const ZaloLogs: React.FC = () => {
    const { notify, success, error: notifyError } = useNotification();
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch(API_LOGS);
            const json = await res.json();
            if (json.success && json.data) {
                setLogs(json.data);
            }
        } catch (error) {
            notifyError('Lỗi tải dữ liệu logs');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch(status) {
            case 'pending': return 'default';
            case 'sent': return 'primary';
            case 'delivered': return 'success';
            case 'read': return 'info';
            case 'failed': return 'error';
            case 'retrying': return 'warning';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        switch(status) {
            case 'pending': return 'Chờ gửi';
            case 'sent': return 'Đã gửi (Zalo)';
            case 'delivered': return 'Đã nhận';
            case 'read': return 'Đã xem';
            case 'failed': return 'Lỗi';
            case 'retrying': return 'Đang thử lại';
            default: return status;
        }
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
                        Lịch sử gửi ZNS
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Theo dõi trạng thái gửi tin nhắn đến từng số điện thoại.
                    </Typography>
                </Box>
                <IconButton onClick={fetchLogs} disabled={loading} color="primary" sx={{ bgcolor: '#eff6ff' }}>
                    {loading ? <CircularProgress size={24} /> : <Refresh />}
                </IconButton>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>SĐT Nhận</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Chiến dịch / Template</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Nội dung gửi</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Thời gian tạo</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Lỗi (Nếu có)</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 6, color: '#64748b' }}>Chưa có log gửi tin.</TableCell>
                            </TableRow>
                        ) : (
                            logs.map(log => (
                                <TableRow key={log.id} hover>
                                    <TableCell sx={{ fontFamily: 'monospace' }}>{log.recipient_phone}</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={500}>{log.zalo_campaigns?.name || 'Gửi lẻ'}</Typography>
                                        <Typography variant="caption" color="text.secondary">{log.zalo_templates?.template_name}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 350, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                        {log.params?.message || (log.params ? (typeof log.params === 'string' ? log.params : JSON.stringify(log.params)) : '')}
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={getStatusLabel(log.status)} 
                                            color={getStatusColor(log.status) as any} 
                                            size="small" 
                                            variant={log.status === 'pending' ? 'outlined' : 'filled'}
                                            sx={{ fontSize: '0.75rem', height: 24 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2">{new Date(log.created_at).toLocaleString('vi-VN')}</Typography>
                                        {log.sent_at && (
                                            <Typography variant="caption" color="text.secondary" display="block">
                                                Gửi lúc: {new Date(log.sent_at).toLocaleTimeString('vi-VN')}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {log.error_message && (
                                            <Tooltip title={log.error_message}>
                                                <Typography variant="body2" color="error" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    <InfoOutlined sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.5 }} />
                                                    {log.error_message}
                                                </Typography>
                                            </Tooltip>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ZaloLogs;
