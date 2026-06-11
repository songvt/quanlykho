import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Card, Chip, Tooltip, Alert
} from '@mui/material';
import { RefreshCw, Eye, CheckSquare, Search, FileText } from 'lucide-react';
import type { RootState } from '../../store';
import { formatDate } from '../../utils/dateUtils';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
    'Chờ ký': { label: 'Chờ ký', color: 'info' },
    'Đang ký': { label: 'Đang ký duyệt', color: 'warning' }
};

const PendingTrinhKy: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchPendingDocs = async () => {
        if (!profile?.id) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/trinhky?scope=pending&userId=${profile.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch pending list');
            setDocuments(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải danh sách hồ sơ chờ ký');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingDocs();
    }, [profile]);

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            <Box mb={4}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                    DANH SÁCH HỒ SƠ CHỜ KÝ DUYỆT
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem', mt: 0.5 }}>
                    Các tài liệu, tờ trình đang chờ chữ ký của đồng chí để chuyển tiếp workflow
                </Typography>
            </Box>

            {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                {isLoading ? (
                    <Box sx={{ p: 5, textAlign: 'center' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--brand-primary)" />
                        <Typography sx={{ mt: 1.5, color: 'var(--text-secondary)' }}>Đang tải hồ sơ chờ xử lý...</Typography>
                    </Box>
                ) : (
                    <Table size="medium">
                        <TableHead sx={{ bgcolor: 'var(--bg-default)' }}>
                            <TableRow>
                                <TableCell align="center" width="5%">STT</TableCell>
                                <TableCell width="15%">Mã hồ sơ</TableCell>
                                <TableCell width="40%">Tiêu đề trình ký</TableCell>
                                <TableCell width="15%">Người tạo</TableCell>
                                <TableCell width="15%">Ngày tạo</TableCell>
                                <TableCell align="center" width="10%">Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {documents.map((doc, idx) => (
                                <TableRow key={doc.id} hover>
                                    <TableCell align="center">{idx + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: 'var(--brand-primary)' }}>{doc.so_hoso}</TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{doc.tieu_de}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{doc.loai_hoso}</Typography>
                                    </TableCell>
                                    <TableCell>{doc.creator?.full_name || 'N/A'}</TableCell>
                                    <TableCell>{formatDate(doc.ngay_tao)}</TableCell>
                                    <TableCell align="center">
                                        <Box display="flex" justifyContent="center" gap={1}>
                                            <Tooltip title="Xem & Ký duyệt">
                                                <IconButton size="small" color="error" onClick={() => navigate(`/trinh-ky/approve/${doc.id}`)}>
                                                    <CheckSquare size={16} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Xem chi tiết">
                                                <IconButton size="small" color="primary" onClick={() => navigate(`/trinh-ky/detail/${doc.id}`)}>
                                                    <Eye size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {documents.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'var(--text-secondary)' }}>
                                        Đồng chí không có hồ sơ nào đang chờ ký duyệt
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </TableContainer>
        </Box>
    );
};

export default PendingTrinhKy;
