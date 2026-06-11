import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Card, Chip, Tooltip, Alert
} from '@mui/material';
import { RefreshCw, Eye, FileText, CheckCircle2 } from 'lucide-react';
import type { RootState } from '../../store';
import { formatDate } from '../../utils/dateUtils';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
    'Nháp': { label: 'Bản nháp', color: 'default' },
    'Chờ ký': { label: 'Chờ ký', color: 'info' },
    'Đang ký': { label: 'Đang ký duyệt', color: 'warning' },
    'Hoàn thành': { label: 'Đã hoàn thành', color: 'success' },
    'Từ chối': { label: 'Bị từ chối', color: 'error' },
    'Thu hồi': { label: 'Đã thu hồi', color: 'secondary' }
};

const ProcessedTrinhKy: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchProcessedDocs = async () => {
        if (!profile?.id) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/trinhky?scope=processed&userId=${profile.id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch processed list');
            setDocuments(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải danh sách hồ sơ đã xử lý');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProcessedDocs();
    }, [profile]);

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            <Box mb={4}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                    HỒ SƠ ĐÃ XỬ LÝ
                </Typography>
                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem', mt: 0.5 }}>
                    Các hồ sơ, tài liệu mà đồng chí đã tham gia ký duyệt hoặc luân chuyển xử lý
                </Typography>
            </Box>

            {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                {isLoading ? (
                    <Box sx={{ p: 5, textAlign: 'center' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--brand-primary)" />
                        <Typography sx={{ mt: 1.5, color: 'var(--text-secondary)' }}>Đang tải danh sách hồ sơ...</Typography>
                    </Box>
                ) : (
                    <Table size="medium">
                        <TableHead sx={{ bgcolor: 'var(--bg-default)' }}>
                            <TableRow>
                                <TableCell align="center" width="5%">STT</TableCell>
                                <TableCell width="15%">Mã hồ sơ</TableCell>
                                <TableCell width="35%">Tiêu đề trình ký</TableCell>
                                <TableCell width="15%">Người tạo</TableCell>
                                <TableCell width="15%">Ngày tạo</TableCell>
                                <TableCell align="center" width="10%">Trạng thái</TableCell>
                                <TableCell align="center" width="10%">Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {documents.map((doc, idx) => {
                                const statusMeta = STATUS_MAP[doc.trang_thai] || { label: doc.trang_thai, color: 'default' };
                                return (
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
                                            <Chip label={statusMeta.label} color={statusMeta.color} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Tooltip title="Xem chi tiết">
                                                <IconButton size="small" color="primary" onClick={() => navigate(`/trinh-ky/detail/${doc.id}`)}>
                                                    <Eye size={16} />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {documents.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6, color: 'var(--text-secondary)' }}>
                                        Chưa có hồ sơ nào đã xử lý
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

export default ProcessedTrinhKy;
