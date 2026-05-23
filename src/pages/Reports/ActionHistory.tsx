import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Chip, CircularProgress,
    IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Divider, Grid, Avatar
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import EventNoteIcon from '@mui/icons-material/EventNote';
import PersonIcon from '@mui/icons-material/Person';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import PageHeader from '../../components/Common/PageHeader';

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

interface AssetLog {
    id: string;
    created_at: string;
    asset_code: string;
    asset_name: string;
    action: string;
    details: string;
    employee_name: string;
    department: string;
    performed_by: string;
}

const getActionColor = (action: string) => {
    switch (action) {
        case 'LOGIN':
            return { bg: 'rgba(16, 185, 129, 0.08)', color: '#059669', border: '#10b98130', label: 'Đăng nhập' };
        case 'PRINT':
        case 'PRINT_HCM':
            return { 
                bg: 'rgba(59, 130, 246, 0.08)', 
                color: '#2563eb', 
                border: '#3b82f630', 
                label: action === 'PRINT_HCM' ? 'In QR (HCM)' : 'In QR (Chuẩn)' 
            };
        case 'EXPORT_PDF':
        case 'EXPORT_PDF_HCM':
            return { 
                bg: 'rgba(139, 92, 246, 0.08)', 
                color: '#7c3aed', 
                border: '#8b5cf630', 
                label: action === 'EXPORT_PDF_HCM' ? 'Xuất PDF (HCM)' : 'Xuất PDF (Chuẩn)' 
            };
        case 'Cấp phát':
            return { bg: 'rgba(79, 70, 229, 0.08)', color: '#4f46e5', border: '#4f46e530', label: 'Cấp phát' };
        case 'Thu hồi':
            return { bg: 'rgba(245, 158, 11, 0.08)', color: '#d97706', border: '#f59e0b30', label: 'Thu hồi' };
        case 'Điều chuyển':
            return { bg: 'rgba(20, 184, 166, 0.08)', color: '#0d9488', border: '#14b8a630', label: 'Điều chuyển' };
        case 'Tăng':
            return { bg: 'rgba(16, 185, 129, 0.08)', color: '#059669', border: '#10b98130', label: 'Tăng tài sản' };
        case 'Giảm':
            return { bg: 'rgba(239, 68, 68, 0.08)', color: '#dc2626', border: '#ef444430', label: 'Giảm tài sản' };
        default:
            return { bg: 'rgba(100, 116, 139, 0.08)', color: '#475569', border: '#64748b30', label: action };
    }
};

const ActionHistory: React.FC = () => {
    const [tabValue, setTabValue] = useState(0);
    const [qrLogs, setQrLogs] = useState<ActionLog[]>([]);
    const [assetLogs, setAssetLogs] = useState<AssetLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDetails, setSelectedDetails] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (tabValue === 0) {
                const data = await GoogleSheetService.getActionLogs();
                setQrLogs(data || []);
            } else {
                const data = await GoogleSheetService.getAssetLogs();
                setAssetLogs(data || []);
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [tabValue]);

    // Parse details block to display neatly
    const renderParsedDetails = (details: any) => {
        if (!details) return <Typography color="text.secondary">Không có dữ liệu chi tiết</Typography>;
        
        let parsed: any = null;
        try {
            parsed = typeof details === 'string' ? JSON.parse(details) : details;
        } catch (e) {
            parsed = details;
        }

        if (Array.isArray(parsed)) {
            return (
                <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                        Danh sách các Thùng / Hộp thiết bị được xử lý:
                    </Typography>
                    <Grid container spacing={2}>
                        {parsed.map((item: any, idx: number) => (
                            <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                                <Paper sx={{ 
                                    p: 2, 
                                    borderRadius: '12px', 
                                    bgcolor: '#f8fafc', 
                                    border: '1px solid #e2e8f0',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    boxShadow: 'none'
                                }}>
                                    <Box sx={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', bgcolor: '#4f46e5' }} />
                                    <Box display="flex" justifyContent="space-between" alignItems="center">
                                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                                            THÙNG / HỘP SỐ {item.box || item.BoxNumber || (idx + 1)}
                                        </Typography>
                                        {item.district && (
                                            <Chip 
                                                label={item.district} 
                                                size="small" 
                                                sx={{ 
                                                    height: 18, 
                                                    fontSize: '0.65rem', 
                                                    fontWeight: 800, 
                                                    bgcolor: 'rgba(79, 70, 229, 0.08)', 
                                                    color: '#4f46e5',
                                                    border: '1px solid rgba(79, 70, 229, 0.15)'
                                                }} 
                                            />
                                        )}
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', mt: 1, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                                        {item.count || item.totalQuantity || 0}
                                        <Typography component="span" variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                                            thiết bị
                                        </Typography>
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            );
        }

        if (typeof parsed === 'object') {
            return (
                <Box component="pre" sx={{ 
                    m: 0, 
                    p: 2, 
                    borderRadius: '8px', 
                    bgcolor: '#f8fafc', 
                    border: '1px solid #e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                }}>
                    {JSON.stringify(parsed, null, 2)}
                </Box>
            );
        }

        return (
            <Typography variant="body1" sx={{ color: '#334155', lineHeight: 1.6 }}>
                {String(parsed)}
            </Typography>
        );
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
            
            {/* Top Header Card */}
            <PageHeader 
                title="Nhật Ký Hoạt Động" 
                subtitle="Giám sát trực tiếp các thay đổi, biến động tài sản & hoạt động phát sinh mã QR" 
                icon={<HistoryIcon sx={{ fontSize: 32, color: 'white' }} />}
                gradientType="dark" 
                actions={
                    <IconButton 
                        onClick={fetchData} 
                        disabled={loading} 
                        sx={{ 
                            bgcolor: 'rgba(255, 255, 255, 0.08)', 
                            color: '#ffffff',
                            backdropFilter: 'blur(12px)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            p: 1.5,
                            '&:hover': { 
                                bgcolor: 'rgba(255, 255, 255, 0.18)',
                                transform: 'rotate(45deg)'
                            },
                            '&:active': { transform: 'scale(0.95)' },
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    >
                        <RefreshIcon sx={{ 
                            fontSize: 24,
                            animation: loading ? 'spin 1.5s linear infinite' : 'none',
                            '@keyframes spin': {
                                '0%': { transform: 'rotate(0deg)' },
                                '100%': { transform: 'rotate(360deg)' }
                            }
                        }} />
                    </IconButton>
                }
            />

            {/* Custom Pill tab selector */}
            <Box sx={{ 
                display: 'inline-flex', 
                p: 0.6, 
                bgcolor: '#f1f5f9', 
                borderRadius: '16px', 
                mb: 4,
                border: '1px solid #e2e8f0',
                gap: 0.5
            }}>
                <Button 
                    onClick={() => setTabValue(0)}
                    startIcon={<QrCode2Icon />}
                    sx={{
                        px: 3,
                        py: 1.2,
                        borderRadius: '12px',
                        color: tabValue === 0 ? '#4f46e5' : '#64748b',
                        bgcolor: tabValue === 0 ? '#ffffff' : 'transparent',
                        boxShadow: tabValue === 0 ? '0 10px 15px -3px rgba(79, 70, 229, 0.1), 0 4px 6px -4px rgba(79, 70, 229, 0.1)' : 'none',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        '&:hover': {
                            bgcolor: tabValue === 0 ? '#ffffff' : 'rgba(0,0,0,0.02)'
                        },
                        transition: 'all 0.25s ease'
                    }}
                >
                    In QR & Xuất PDF
                </Button>
                <Button 
                    onClick={() => setTabValue(1)}
                    startIcon={<SwapHorizIcon />}
                    sx={{
                        px: 3,
                        py: 1.2,
                        borderRadius: '12px',
                        color: tabValue === 1 ? '#4f46e5' : '#64748b',
                        bgcolor: tabValue === 1 ? '#ffffff' : 'transparent',
                        boxShadow: tabValue === 1 ? '0 10px 15px -3px rgba(79, 70, 229, 0.1), 0 4px 6px -4px rgba(79, 70, 229, 0.1)' : 'none',
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        '&:hover': {
                            bgcolor: tabValue === 1 ? '#ffffff' : 'rgba(0,0,0,0.02)'
                        },
                        transition: 'all 0.25s ease'
                    }}
                >
                    Biến động tài sản
                </Button>
            </Box>

            {/* Main Log Table */}
            <TableContainer component={Paper} sx={{ 
                borderRadius: '20px', 
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
            }}>
                <Table size="medium">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', py: 2 }}>
                                <Box display="flex" alignItems="center" gap={0.5}><EventNoteIcon sx={{ fontSize: 16 }} /> Thời gian</Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', py: 2 }}>
                                Hành động
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', py: 2 }}>
                                <Box display="flex" alignItems="center" gap={0.5}><PersonIcon sx={{ fontSize: 16 }} /> {tabValue === 0 ? 'Người dùng' : 'Tài sản'}</Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase', py: 2 }}>
                                Chi tiết tác động
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 8 }}>
                                    <CircularProgress size={36} thickness={4} sx={{ color: '#4f46e5' }} />
                                    <Typography variant="body2" sx={{ mt: 2, color: '#64748b', fontWeight: 500 }}>
                                        Đang tải dữ liệu lịch sử...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (tabValue === 0 ? qrLogs : assetLogs).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 10 }}>
                                    <Typography variant="h6" sx={{ color: '#94a3b8', fontWeight: 700 }}>
                                        Chưa có dữ liệu lịch sử
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#cbd5e1', mt: 0.5 }}>
                                        Các hoạt động hệ thống phát sinh sẽ hiển thị tại đây
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            (tabValue === 0 ? qrLogs : assetLogs).map((log: any) => {
                                const cfg = getActionColor(log.action);
                                return (
                                    <TableRow key={log.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc !important' } }}>
                                        {/* Date column */}
                                        <TableCell sx={{ whiteSpace: 'nowrap', py: 2, fontWeight: 500, color: '#334155' }}>
                                            {log.created_at ? new Date(log.created_at).toLocaleString('vi-VN') : 'N/A'}
                                        </TableCell>
                                        
                                        {/* Action Badge */}
                                        <TableCell sx={{ py: 2 }}>
                                            <Box sx={{ 
                                                display: 'inline-flex', 
                                                alignItems: 'center', 
                                                px: 1.8, 
                                                py: 0.6, 
                                                borderRadius: '20px', 
                                                bgcolor: cfg.bg, 
                                                color: cfg.color, 
                                                fontSize: '0.75rem', 
                                                fontWeight: 800,
                                                border: `1px solid ${cfg.border}`
                                            }}>
                                                {cfg.label}
                                            </Box>
                                        </TableCell>

                                        {/* Subject / Owner column */}
                                        <TableCell sx={{ py: 2 }}>
                                            {tabValue === 0 ? (
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <AccountCircleIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                                        {log.created_by}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Box>
                                                    <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                                        {log.asset_name}
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, bgcolor: '#f1f5f9', px: 1, py: 0.2, borderRadius: '4px', display: 'inline-block', mt: 0.5 }}>
                                                        Mã: {log.asset_code}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </TableCell>

                                        {/* Details description */}
                                        <TableCell sx={{ py: 2 }}>
                                            {tabValue === 0 ? (
                                                log.action === 'LOGIN' ? (
                                                    <Typography variant="body2" sx={{ color: '#64748b' }}>Đăng nhập vào hệ thống</Typography>
                                                ) : (
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#334155' }}>
                                                                {log.doc_title}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500, display: 'block', mt: 0.5 }}>
                                                                Tổng số: <b>{log.total_qrs} mã QR</b> ({log.total_serials} dòng dữ liệu)
                                                            </Typography>
                                                        </Box>
                                                        {log.details && (
                                                            <Tooltip title="Xem chi tiết thiết bị">
                                                                <IconButton 
                                                                    size="small" 
                                                                    onClick={() => setSelectedDetails(log.details)}
                                                                    sx={{ 
                                                                        bgcolor: 'rgba(79, 70, 229, 0.05)', 
                                                                        color: '#4f46e5',
                                                                        '&:hover': { bgcolor: 'rgba(79, 70, 229, 0.15)' }
                                                                    }}
                                                                >
                                                                    <InfoIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        )}
                                                    </Box>
                                                )
                                            ) : (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                    <Box display="flex" alignItems="center" gap={0.5}>
                                                        <Typography variant="body2" sx={{ color: '#475569' }}>
                                                            Tác nhân: <b>{log.performed_by || 'Hệ thống'}</b>
                                                        </Typography>
                                                    </Box>
                                                    {log.details ? (
                                                        <Paper variant="outlined" sx={{ p: 1, bgcolor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px', mt: 0.5 }}>
                                                            <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                                                                {log.details}
                                                            </Typography>
                                                        </Paper>
                                                    ) : (
                                                        log.employee_name && (
                                                            <Paper variant="outlined" sx={{ p: 1, bgcolor: '#f8fafc', borderColor: '#e2e8f0', borderRadius: '8px', mt: 0.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <ArrowForwardIcon sx={{ fontSize: 14, color: '#4f46e5' }} />
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 600 }}>
                                                                        Người nhận: {log.employee_name}
                                                                    </Typography>
                                                                    {log.department && (
                                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                                            Bộ phận: {log.department}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </Paper>
                                                        )
                                                    )}
                                                </Box>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Luxury Interactive Details Dialog */}
            <Dialog 
                open={Boolean(selectedDetails)} 
                onClose={() => setSelectedDetails(null)} 
                maxWidth="sm" 
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '20px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        border: '1px solid #e2e8f0'
                    }
                }}
            >
                <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5' }}>
                        <QrCode2Icon />
                    </Avatar>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b', lineHeight: 1.2 }}>
                            Chi tiết Thiết bị In Ấn
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                            Thông tin phân rã mã vạch theo thùng hộp hàng
                        </Typography>
                    </Box>
                </DialogTitle>
                <Divider sx={{ mx: 3 }} />
                <DialogContent sx={{ p: 3 }}>
                    {renderParsedDetails(selectedDetails)}
                </DialogContent>
                <Divider sx={{ mx: 3 }} />
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button 
                        onClick={() => setSelectedDetails(null)}
                        variant="contained"
                        sx={{
                            borderRadius: '12px',
                            bgcolor: '#1e293b',
                            px: 3,
                            py: 1,
                            textTransform: 'none',
                            fontWeight: 700,
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#0f172a', boxShadow: 'none' }
                        }}
                    >
                        Đóng
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ActionHistory;
