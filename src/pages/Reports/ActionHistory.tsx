import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Chip, CircularProgress,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button
} from '@mui/material';
// Removed date-fns since it's not installed
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import { GoogleSheetService } from '../../services/GoogleSheetService';

interface ActionLog {
    id: string;
    created_at: string;
    action: string;
    doc_title: string;
    total_serials: number;
    total_qrs: number;
    created_by: string;
    details: any;
}

const getActionColor = (action: string) => {
    if (action === 'LOGIN') return 'success';
    if (action.includes('PRINT')) return 'primary';
    if (action.includes('EXPORT_PDF')) return 'secondary';
    return 'default';
};

const getActionLabel = (action: string) => {
    switch(action) {
        case 'LOGIN': return 'Đăng nhập';
        case 'PRINT': return 'In QR (Chuẩn)';
        case 'PRINT_HCM': return 'In QR (HCM)';
        case 'EXPORT_PDF': return 'Xuất PDF (Chuẩn)';
        case 'EXPORT_PDF_HCM': return 'Xuất PDF (HCM)';
        default: return action;
    }
};

const ActionHistory: React.FC = () => {
    const [logs, setLogs] = useState<ActionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDetails, setSelectedDetails] = useState<any>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await GoogleSheetService.getActionLogs();
            setLogs(data || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b' }}>
                    LỊCH SỬ TÁC ĐỘNG
                </Typography>
                <IconButton onClick={fetchLogs} disabled={loading} color="primary" sx={{ background: '#f1f5f9' }}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Thời gian</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Người dùng</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Hành động</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Chi tiết</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                    <CircularProgress size={30} />
                                </TableCell>
                            </TableRow>
                        ) : logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Chưa có lịch sử nào
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id} hover>
                                    <TableCell>
                                        {(() => {
                                            try {
                                                return log.created_at 
                                                    ? new Date(log.created_at).toLocaleString('vi-VN', { 
                                                        year: 'numeric', month: '2-digit', day: '2-digit', 
                                                        hour: '2-digit', minute: '2-digit', second: '2-digit' 
                                                    }) 
                                                    : 'N/A';
                                            } catch (e) {
                                                return 'Lỗi ngày';
                                            }
                                        })()}
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={600}>{log.created_by}</Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={getActionLabel(log.action)} 
                                            color={getActionColor(log.action) as any} 
                                            size="small" 
                                            sx={{ fontWeight: 600, minWidth: 120 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {log.action === 'LOGIN' ? (
                                            <Typography variant="body2" color="text.secondary">Đăng nhập vào hệ thống</Typography>
                                        ) : (
                                            <Box display="flex" alignItems="center" gap={1}>
                                                <Typography variant="body2">
                                                    Tiêu đề: <b>{log.doc_title}</b> | Mã: <b>{log.total_qrs}</b>
                                                </Typography>
                                                {log.details && (
                                                    <Tooltip title="Xem chi tiết">
                                                        <IconButton size="small" onClick={() => setSelectedDetails(log.details)}>
                                                            <InfoIcon fontSize="small" color="info" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={Boolean(selectedDetails)} onClose={() => setSelectedDetails(null)} maxWidth="sm" fullWidth>
                <DialogTitle>Chi tiết thùng/thiết bị in</DialogTitle>
                <DialogContent dividers>
                    {selectedDetails ? (
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>
                            {JSON.stringify(selectedDetails, null, 2)}
                        </pre>
                    ) : (
                        <Typography>Không có dữ liệu chi tiết</Typography>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSelectedDetails(null)}>Đóng</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ActionHistory;
