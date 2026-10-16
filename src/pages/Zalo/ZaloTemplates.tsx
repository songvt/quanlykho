import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Button, CircularProgress, Chip } from '@mui/material';
import { Sync, CloudDownload } from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';

const API_TEMPLATES = '/api/zalo?action=templates';
const API_SYNC = '/api/zalo?action=sync_templates';

interface Template {
    id: number;
    template_id: string;
    template_name: string;
    status: string;
    is_active: boolean;
    last_synced_at: string;
}

const ZaloTemplates: React.FC = () => {
    const { notify, success, error: notifyError } = useNotification();
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [templates, setTemplates] = useState<Template[]>([]);

    useEffect(() => {
        fetchTemplates();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Load templates once on mount.

    const fetchTemplates = async () => {
        setLoading(true);
        try {
            const res = await fetch(API_TEMPLATES);
            const json = await res.json();
            if (json.success && json.data) {
                setTemplates(json.data);
            }
        } catch (error) {
            notify('Không thể tải danh sách template', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch(API_SYNC, { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                success('Đã tải và lưu danh sách Template thành công!');
                fetchTemplates();
            } else {
                notifyError(json.error || 'Lỗi khi tải template');
            }
        } catch (error) {
            notifyError('Lỗi kết nối máy chủ');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
                        Quản lý Template ZNS
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Danh sách các mẫu tin nhắn đã được duyệt trên Zalo Official Account.
                    </Typography>
                </Box>
                <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={syncing ? <CircularProgress size={20} color="inherit" /> : <Sync />}
                    onClick={handleSync}
                    disabled={syncing}
                    sx={{ boxShadow: 'none' }}
                >
                    Đồng bộ từ Zalo
                </Button>
            </Box>

            <TableContainer component={Paper} sx={{ borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>ID Template</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Tên Template</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Cập nhật lần cuối</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 6 }}>
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : templates.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 6, color: '#64748b' }}>
                                    <CloudDownload sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                                    <Typography>Chưa có template nào. Vui lòng bấm Đồng bộ.</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            templates.map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell>{row.template_id}</TableCell>
                                    <TableCell>{row.template_name}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={row.is_active ? 'Đã duyệt' : 'Chưa duyệt / Bị từ chối'} 
                                            color={row.is_active ? 'success' : 'default'} 
                                            size="small"
                                            sx={{ fontWeight: 500 }}
                                        />
                                    </TableCell>
                                    <TableCell>{new Date(row.last_synced_at).toLocaleString('vi-VN')}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default ZaloTemplates;
