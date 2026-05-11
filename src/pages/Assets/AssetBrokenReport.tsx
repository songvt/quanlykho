import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Checkbox, TablePagination,
    Stack, TextField, InputAdornment
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';

import { fetchAssets } from '../../store/slices/assetsSlice';
import type { RootState, AppDispatch } from '../../store';
import TableSkeleton from '../../components/Common/TableSkeleton';
import AssetBrokenPrint from './AssetBrokenPrint';
import { exportStandardReport } from '../../utils/excelUtils';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useNotification } from '../../contexts/NotificationContext';

const AssetBrokenReport = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: assets, status } = useSelector((state: RootState) => state.assets);
    const { success, error: notifyError } = useNotification();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [printModalOpen, setPrintModalOpen] = useState(false);

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchAssets());
        }
    }, [status, dispatch]);

    // Filter assets with status "Hỏng" (case-insensitive)
    const brokenAssets = useMemo(() => {
        return assets.filter(a => 
            (a.status || '').toLowerCase().includes('hỏng')
        );
    }, [assets]);

    const filteredAssets = useMemo(() => {
        if (!searchTerm.trim()) return brokenAssets;
        const s = searchTerm.toLowerCase();
        return brokenAssets.filter(a => 
            a.asset_code.toLowerCase().includes(s) ||
            a.asset_name.toLowerCase().includes(s) ||
            (a.user_employee_name || '').toLowerCase().includes(s)
        );
    }, [brokenAssets, searchTerm]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(filteredAssets.map(a => a.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) setSelectedIds(prev => [...prev, id]);
        else setSelectedIds(prev => prev.filter(item => item !== id));
    };

    const selectedAssetsForPrint = useMemo(() => {
        return assets.filter(a => selectedIds.includes(a.id));
    }, [assets, selectedIds]);

    const handleExportExcel = async () => {
        const dataToExport = selectedIds.length > 0 ? selectedAssetsForPrint : filteredAssets;
        
        const cols = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' as const },
            { header: 'Mã tài sản', key: 'asset_code', width: 15 },
            { header: 'Tên tài sản', key: 'asset_name', width: 35 },
            { header: 'SL', key: 'quantity', width: 8, align: 'center' as const },
            { header: 'ĐV', key: 'unit', width: 8, align: 'center' as const },
            { header: 'Người sử dụng', key: 'user_employee_name', width: 25 },
            { header: 'Tình trạng', key: 'status', width: 15, align: 'center' as const },
            { header: 'Mô tả chi tiết', key: 'status_description', width: 30 },
            { header: 'Chức vụ', key: 'user_type', width: 15 },
            { header: 'Đơn vị', key: 'location_name', width: 20 },
        ];

        try {
            await exportStandardReport(
                dataToExport.map((item, idx) => ({ ...item, stt: idx + 1 })),
                `Bao_cao_CCDC_TBVP_hong_${new Date().getTime()}`,
                'DANH SÁCH CÔNG CỤ DỤNG CỤ - THIẾT BỊ VĂN PHÒNG HỎNG',
                cols
            );
            success('Xuất file Excel thành công!');
        } catch (err: any) {
            notifyError('Lỗi khi xuất Excel: ' + err.message);
        }
    };

    return (
        <Box p={{ xs: 1, sm: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" mb={3} spacing={2} alignItems="center">
                <Box>
                    <Typography 
                        variant="h4" 
                        fontWeight={900} 
                        color="error"
                        sx={{ 
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5
                        }}
                    >
                        <FilterListIcon sx={{ fontSize: 32 }} />
                        BÁO CÁO CCDC-TBVP HỎNG
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                        Danh sách các tài sản có tình trạng là "Hỏng" trong hệ thống
                    </Typography>
                </Box>
                
                <Stack direction="row" spacing={1}>
                    <Button
                        variant="outlined"
                        color="success"
                        startIcon={<FileDownloadIcon />}
                        onClick={handleExportExcel}
                        sx={{ borderRadius: 2 }}
                    >
                        Xuất Excel
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PrintIcon />}
                        onClick={() => setPrintModalOpen(true)}
                        disabled={selectedIds.length === 0}
                        sx={{ 
                            borderRadius: 2, 
                            px: 3,
                            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                        }}
                    >
                        In biên bản ({selectedIds.length})
                    </Button>
                </Stack>
            </Stack>

            <Paper sx={{ p: 2, mb: 3, borderRadius: 3, display: 'flex', gap: 2, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <TextField
                    placeholder="Tìm theo mã, tên tài sản hoặc người sử dụng..."
                    size="small"
                    fullWidth
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ bgcolor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
                />
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: 'text.secondary' }}>
                    Tổng số: {filteredAssets.length} bản ghi
                </Typography>
            </Paper>

            {status === 'loading' ? (
                <TableSkeleton columns={7} rows={10} />
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAssets.length}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>STT</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>MÃ TÀI SẢN</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>TÊN TÀI SẢN</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>SL</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>NGƯỜI SỬ DỤNG</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>TÌNH TRẠNG</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>MÔ TẢ CHI TIẾT</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>CHỨC VỤ</TableCell>
                                <TableCell sx={{ fontWeight: 700 }}>ĐƠN VỊ</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((asset, index) => (
                                <TableRow 
                                    key={asset.id} 
                                    hover 
                                    selected={selectedIds.includes(asset.id)}
                                    onClick={() => handleSelectOne(asset.id, !selectedIds.includes(asset.id))}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedIds.includes(asset.id)}
                                            onChange={(e) => {
                                                e.stopPropagation();
                                                handleSelectOne(asset.id, e.target.checked);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>{asset.asset_code}</TableCell>
                                    <TableCell>{asset.asset_name}</TableCell>
                                    <TableCell>{asset.quantity || 1}</TableCell>
                                    <TableCell>{asset.user_employee_name || '-'}</TableCell>
                                    <TableCell>
                                        <Box component="span" sx={{ 
                                            px: 1, py: 0.5, borderRadius: 1, 
                                            bgcolor: '#fee2e2', color: '#ef4444', 
                                            fontSize: '0.75rem', fontWeight: 700,
                                            textTransform: 'uppercase'
                                        }}>
                                            {asset.status}
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.875rem' }}>{asset.status_description || '-'}</TableCell>
                                    <TableCell>{asset.user_type || '-'}</TableCell>
                                    <TableCell>{asset.location_name || '-'}</TableCell>
                                </TableRow>
                            ))}
                            {filteredAssets.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                                        <Typography variant="body1" color="text.secondary">
                                            Không tìm thấy tài sản nào có tình trạng "Hỏng".
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredAssets.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(e, newPage) => setPage(newPage)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        labelRowsPerPage="Số dòng mỗi trang:"
                    />
                </TableContainer>
            )}

            {/* Print Dialog */}
            <AssetBrokenPrint
                open={printModalOpen}
                onClose={() => setPrintModalOpen(false)}
                assets={selectedAssetsForPrint}
            />
        </Box>
    );
};

export default AssetBrokenReport;
