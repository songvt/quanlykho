import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    Box, Paper, Typography, TextField, Grid, MenuItem, Button, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Card, Chip, Tooltip, TablePagination, Alert
} from '@mui/material';
import { 
    Search, RefreshCw, Download, FileSpreadsheet, Eye, Edit, 
    RotateCcw, FileText, Trash2, Printer, Plus 
} from 'lucide-react';
import type { RootState } from '../../store';
import { formatDate } from '../../utils/dateUtils';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
    'Nháp': { label: 'Bản nháp', color: 'default' },
    'Chờ ký': { label: 'Chờ ký', color: 'info' },
    'Đang ký': { label: 'Đang ký duyệt', color: 'warning' },
    'Hoàn thành': { label: 'Đã hoàn thành', color: 'success' },
    'Từ chối': { label: 'Bị từ chối', color: 'error' },
    'Thu hồi': { label: 'Đã thu hồi', color: 'secondary' }
};

const LOAI_HOSO_LIST = ['Tờ trình', 'Công văn', 'Quyết định', 'Hợp đồng', 'Báo cáo', 'Khác'];

const ListTrinhKy: React.FC = () => {
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);

    // Search & Filter state
    const [keyword, setKeyword] = useState('');
    const [status, setStatus] = useState('');
    const [loaiHoSo, setLoaiHoSo] = useState('');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');

    // Table state
    const [documents, setDocuments] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const fetchDocuments = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const queryParams = new URLSearchParams({
                userId: profile?.id || '',
                role: profile?.role || '',
                scope: 'list',
                keyword,
                status,
                loai_hoso: loaiHoSo,
                fromDate,
                toDate
            });

            const res = await fetch(`/api/trinhky?${queryParams.toString()}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');

            setDocuments(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải danh sách hồ sơ trình ký');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (profile?.id) {
            fetchDocuments();
        }
    }, [profile]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(0);
        fetchDocuments();
    };

    const handleReset = () => {
        setKeyword('');
        setStatus('');
        setLoaiHoSo('');
        setFromDate('');
        setToDate('');
        setPage(0);
        setTimeout(() => {
            fetchDocuments();
        }, 100);
    };

    // Actions
    const handleRecall = async (hosoId: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn thu hồi hồ sơ trình ký này?')) return;
        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'workflow_action',
                    payload: {
                        hoso_id: hosoId,
                        user_id: profile?.id,
                        action_type: 'thu_hoi',
                        comment: 'Thu hồi hồ sơ từ danh sách quản lý'
                    }
                })
            });
            if (!res.ok) throw new Error('Recall failed');
            fetchDocuments();
        } catch (err: any) {
            alert(`Lỗi thu hồi: ${err.message}`);
        }
    };

    const handleDelete = async (hosoId: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa hồ sơ này? (Soft Delete)')) return;
        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'workflow_action',
                    payload: {
                        hoso_id: hosoId,
                        user_id: profile?.id,
                        action_type: 'xoa_hoso'
                    }
                })
            });
            if (!res.ok) throw new Error('Delete failed');
            fetchDocuments();
        } catch (err: any) {
            alert(`Lỗi xóa: ${err.message}`);
        }
    };

    // Export Excel using exceljs
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Danh sách hồ sơ trình ký');
        
        sheet.columns = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Mã hồ sơ', key: 'so_hoso', width: 20 },
            { header: 'Tiêu đề trình ký', key: 'tieu_de', width: 40 },
            { header: 'Loại hồ sơ', key: 'loai_hoso', width: 18 },
            { header: 'Người tạo', key: 'nguoi_tao', width: 25 },
            { header: 'Ngày tạo', key: 'ngay_tao', width: 18 },
            { header: 'Trạng thái', key: 'trang_thai', width: 15 },
            { header: 'Độ khẩn', key: 'do_khan', width: 15 },
            { header: 'Độ mật', key: 'do_mat', width: 15 }
        ];

        // Format Header
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
        sheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'EF4444' }
        };

        documents.forEach((doc, idx) => {
            sheet.addRow({
                stt: idx + 1,
                so_hoso: doc.so_hoso,
                tieu_de: doc.tieu_de,
                loai_hoso: doc.loai_hoso,
                nguoi_tao: doc.creator?.full_name || 'N/A',
                ngay_tao: formatDate(doc.ngay_tao),
                trang_thai: doc.trang_thai,
                do_khan: doc.do_khan,
                do_mat: doc.do_mat
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Danh_sach_trinh_ky_${Date.now()}.xlsx`);
    };

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            {/* Red header Viettel VOffice style */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        QUẢN LÝ HỒ SƠ TRÌNH KÝ
                    </Typography>
                    <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Tra cứu, theo dõi tiến độ và xử lý toàn bộ hồ sơ trình ký nội bộ
                    </Typography>
                </Box>
                {profile?.permissions?.includes('trinhky.create') || profile?.role === 'admin' ? (
                    <Button
                        variant="contained"
                        startIcon={<Plus size={16} />}
                        onClick={() => navigate('/trinh-ky/create')}
                        sx={{
                            borderRadius: '10px',
                            textTransform: 'none',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #EF4444 0%, #b91c1c 100%)',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
                            }
                        }}
                    >
                        Tạo trình ký mới
                    </Button>
                ) : null}
            </Box>

            {errorMsg && <Alert severity="error" sx={{ mb: 3 }}>{errorMsg}</Alert>}

            {/* Filter Section Card */}
            <Card sx={{ p: 3, mb: 4, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <form onSubmit={handleSearch}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 4, md: 3 }}>
                            <TextField
                                fullWidth
                                label="Từ khóa tìm kiếm"
                                placeholder="Tiêu đề, mã hồ sơ..."
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                            <TextField
                                select
                                fullWidth
                                label="Loại hồ sơ"
                                value={loaiHoSo}
                                onChange={(e) => setLoaiHoSo(e.target.value)}
                                size="small"
                            >
                                <MenuItem value="">-- Tất cả --</MenuItem>
                                {LOAI_HOSO_LIST.map(item => (
                                    <MenuItem key={item} value={item}>{item}</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4, md: 2 }}>
                            <TextField
                                select
                                fullWidth
                                label="Trạng thái"
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                size="small"
                            >
                                <MenuItem value="">-- Tất cả --</MenuItem>
                                {Object.entries(STATUS_MAP).map(([key, value]) => (
                                    <MenuItem key={key} value={key}>{value.label}</MenuItem>
                                ))}
                            </TextField>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Từ ngày"
                                InputLabelProps={{ shrink: true }}
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 2.5 }}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Đến ngày"
                                InputLabelProps={{ shrink: true }}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                size="small"
                            />
                        </Grid>
                        
                        <Grid size={{ xs: 12 }} display="flex" justifyContent="flex-end" gap={1.5} sx={{ mt: 1 }}>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                startIcon={<Search size={16} />}
                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                                Tìm kiếm
                            </Button>
                            <Button 
                                variant="outlined" 
                                startIcon={<RefreshCw size={16} />} 
                                onClick={handleReset}
                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                                Làm mới
                            </Button>
                            <Button 
                                variant="outlined" 
                                color="success" 
                                startIcon={<FileSpreadsheet size={16} />} 
                                onClick={handleExportExcel}
                                sx={{ textTransform: 'none', borderRadius: '8px' }}
                            >
                                Xuất Excel
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </Card>

            {/* List Data Table */}
            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-soft)', overflow: 'hidden' }}>
                {isLoading ? (
                    <Box sx={{ p: 5, textAlign: 'center' }}>
                        <RefreshCw className="animate-spin" size={32} color="var(--brand-primary)" />
                        <Typography sx={{ mt: 1.5, color: 'var(--text-secondary)' }}>Đang tải dữ liệu hồ sơ trình ký...</Typography>
                    </Box>
                ) : (
                    <>
                        <Table size="medium">
                            <TableHead sx={{ bgcolor: 'var(--bg-default)' }}>
                                <TableRow>
                                    <TableCell align="center" width="5%">STT</TableCell>
                                    <TableCell width="12%">Mã hồ sơ</TableCell>
                                    <TableCell width="35%">Tiêu đề trình ký</TableCell>
                                    <TableCell width="12%">Người tạo</TableCell>
                                    <TableCell width="12%">Ngày tạo</TableCell>
                                    <TableCell align="center" width="10%">Trạng thái</TableCell>
                                    <TableCell width="15%">Người duyệt hiện tại</TableCell>
                                    <TableCell align="center" width="12%">Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {documents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((doc, index) => {
                                    const stt = page * rowsPerPage + index + 1;
                                    const statusMeta = STATUS_MAP[doc.trang_thai] || { label: doc.trang_thai, color: 'default' };

                                    const canEdit = doc.nguoi_tao === profile?.id && (doc.trang_thai === 'Nháp' || doc.trang_thai === 'Thu hồi' || doc.trang_thai === 'Từ chối');
                                    const canRecall = doc.nguoi_tao === profile?.id && doc.trang_thai === 'Đang ký';
                                    const canDelete = doc.nguoi_tao === profile?.id && (doc.trang_thai === 'Nháp' || doc.trang_thai === 'Thu hồi');

                                    return (
                                        <TableRow key={doc.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                            <TableCell align="center">{stt}</TableCell>
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
                                            <TableCell>
                                                <Typography sx={{ fontSize: '0.8rem', fontStyle: doc.current_signer === 'N/A' ? 'italic' : 'normal' }}>
                                                    {doc.current_signer}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box display="flex" justifyContent="center" gap={0.5}>
                                                    <Tooltip title="Xem chi tiết">
                                                        <IconButton size="small" color="primary" onClick={() => navigate(`/trinh-ky/detail/${doc.id}`)}>
                                                            <Eye size={16} />
                                                        </IconButton>
                                                    </Tooltip>

                                                    {canEdit && (
                                                        <Tooltip title="Chỉnh sửa">
                                                            <IconButton size="small" color="warning" onClick={() => navigate(`/trinh-ky/detail/${doc.id}`)}>
                                                                <Edit size={16} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {canRecall && (
                                                        <Tooltip title="Thu hồi">
                                                            <IconButton size="small" color="secondary" onClick={() => handleRecall(doc.id)}>
                                                                <RotateCcw size={16} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}

                                                    {canDelete && (
                                                        <Tooltip title="Xóa">
                                                            <IconButton size="small" color="error" onClick={() => handleDelete(doc.id)}>
                                                                <Trash2 size={16} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}

                                {documents.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'var(--text-secondary)' }}>
                                            Không tìm thấy hồ sơ trình ký nào
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        
                        <TablePagination
                            component="div"
                            count={documents.length}
                            page={page}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                            labelRowsPerPage="Hàng mỗi trang"
                        />
                    </>
                )}
            </TableContainer>
        </Box>
    );
};

export default ListTrinhKy;
