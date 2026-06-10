import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Checkbox, TablePagination,
    Stack, TextField, InputAdornment, useMediaQuery, useTheme, Chip, Divider, Tooltip, Badge
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
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: assets, status } = useSelector((state: RootState) => state.assets);
    const { success, error: notifyError } = useNotification();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    
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
        let list = brokenAssets;
        
        if (categoryFilter === 'ccdc') {
            list = list.filter(a => {
                const group = (a.asset_group || '').toLowerCase();
                const type = (a.asset_type || '').toLowerCase();
                return group.includes('ccdc') || type.includes('ccdc');
            });
        } else if (categoryFilter === 'tbvp') {
            list = list.filter(a => {
                const group = (a.asset_group || '').toLowerCase();
                const type = (a.asset_type || '').toLowerCase();
                return group.includes('tbvp') || type.includes('tbvp');
            });
        }

        if (!searchTerm.trim()) return list;
        const s = searchTerm.toLowerCase();
        return list.filter(a => 
            a.asset_code.toLowerCase().includes(s) ||
            a.asset_name.toLowerCase().includes(s) ||
            (a.user_employee_name || '').toLowerCase().includes(s)
        );
    }, [brokenAssets, searchTerm, categoryFilter]);

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
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" mb={2} spacing={1.5} alignItems={{ sm: 'center' }}>
                <Box>
                    <Typography 
                        variant={isMobile ? 'h6' : 'h5'}
                        fontWeight={900} 
                        color="error"
                        sx={{ 
                             textTransform: 'uppercase',
                             letterSpacing: '0.02em',
                             display: 'flex',
                             alignItems: 'center',
                             gap: 1
                        }}
                    >
                        <FilterListIcon sx={{ fontSize: isMobile ? 22 : 28 }} />
                        {isMobile ? 'CCDC-TBVP HỎNG' : 'BÁO CÁO CCDC-TBVP HỎNG'}
                    </Typography>
                    {!isMobile && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
                            Danh sách các tài sản có tình trạng là "Hỏng" trong hệ thống
                        </Typography>
                    )}
                </Box>
                
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Xuất Excel" arrow>
                        <Button
                            variant="outlined"
                            color="success"
                            onClick={handleExportExcel}
                            sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '10px', p: 0 }}
                        >
                            <FileDownloadIcon sx={{ fontSize: 24 }} />
                        </Button>
                    </Tooltip>
                    <Tooltip title={`In (${selectedIds.length})`} arrow>
                        <span>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={() => setPrintModalOpen(true)}
                                disabled={selectedIds.length === 0}
                                sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '10px', p: 0 }}
                            >
                                <Badge badgeContent={selectedIds.length} color="error" overlap="circular">
                                    <PrintIcon sx={{ fontSize: 24 }} />
                                </Badge>
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            <Paper sx={{ p: 1.5, mb: 2, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Tìm theo mã, tên TS, người sử dụng..."
                    size="small"
                    fullWidth={isMobile}
                    sx={{ flex: isMobile ? 'none' : 1, width: isMobile ? '100%' : undefined, bgcolor: '#f8fafc' }}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon color="action" fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                />
                <TextField
                    select
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={{ width: isMobile ? '100%' : 220, bgcolor: 'white' }}
                >
                    <option value="all">Tất cả danh mục (CCDC & TBVP)</option>
                    <option value="ccdc">Công cụ dụng cụ (CCDC)</option>
                    <option value="tbvp">Thiết bị văn phòng (TBVP)</option>
                </TextField>
                <Chip label={`${filteredAssets.length} bản ghi`} size="small" variant="outlined" />
            </Paper>

            {status === 'loading' ? (
                <TableSkeleton columns={7} rows={10} />
            ) : isMobile ? (
                <Box>
                    <Paper sx={{ px: 2, py: 1, mb: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                            checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length}
                            indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAssets.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            size="small"
                        />
                        <Typography variant="body2" color="text.secondary">Chọn tất cả</Typography>
                    </Paper>
                    <Stack spacing={1.5}>
                        {filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((asset, index) => (
                            <Paper
                                key={asset.id}
                                elevation={selectedIds.includes(asset.id) ? 3 : 1}
                                onClick={() => handleSelectOne(asset.id, !selectedIds.includes(asset.id))}
                                sx={{
                                    borderRadius: 3,
                                    border: selectedIds.includes(asset.id) ? '2px solid #ef4444' : '1px solid #fee2e2',
                                    overflow: 'hidden', cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                <Box sx={{ px: 2, py: 1, bgcolor: selectedIds.includes(asset.id) ? '#fef2f2' : '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Checkbox checked={selectedIds.includes(asset.id)} size="small" onClick={(e) => e.stopPropagation()} onChange={(e) => handleSelectOne(asset.id, e.target.checked)} />
                                        <Typography variant="caption" fontWeight={700} color="text.secondary">#{page * rowsPerPage + index + 1}</Typography>
                                        <Typography variant="body2" fontWeight={700} color="primary.main">{asset.asset_code}</Typography>
                                    </Stack>
                                    <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: '#fee2e2', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700 }}>
                                        HỎNG
                                    </Box>
                                </Box>
                                <Divider />
                                <Box sx={{ px: 2, py: 1.5 }}>
                                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>{asset.asset_name}</Typography>
                                    <Stack spacing={0.25}>
                                        {asset.status_description && (
                                            <Typography variant="caption" color="error.main">⚠️ {asset.status_description}</Typography>
                                        )}
                                        {asset.user_employee_name && (
                                            <Typography variant="caption" color="text.secondary">👤 {asset.user_employee_name} {asset.user_type ? `- ${asset.user_type}` : ''}</Typography>
                                        )}
                                        {asset.location_name && (
                                            <Typography variant="caption" color="text.secondary">🏢 {asset.location_name}</Typography>
                                        )}
                                    </Stack>
                                </Box>
                            </Paper>
                        ))}
                        {filteredAssets.length === 0 && (
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                                <Typography color="text.secondary">Không tìm thấy tài sản nào có tình trạng "Hỏng".</Typography>
                            </Paper>
                        )}
                    </Stack>
                    <TablePagination component="div" count={filteredAssets.length} rowsPerPage={rowsPerPage} page={page}
                        onPageChange={(_, p) => setPage(p)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[10, 25]} labelRowsPerPage="" />
                </Box>
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
                                <TableRow key={asset.id} hover selected={selectedIds.includes(asset.id)}
                                    onClick={() => handleSelectOne(asset.id, !selectedIds.includes(asset.id))}
                                    sx={{ cursor: 'pointer' }}
                                >
                                    <TableCell padding="checkbox">
                                        <Checkbox checked={selectedIds.includes(asset.id)}
                                            onChange={(e) => { e.stopPropagation(); handleSelectOne(asset.id, e.target.checked); }} />
                                    </TableCell>
                                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                    <TableCell sx={{ fontWeight: 600, color: 'primary.main' }}>{asset.asset_code}</TableCell>
                                    <TableCell>{asset.asset_name}</TableCell>
                                    <TableCell>{asset.quantity || 1}</TableCell>
                                    <TableCell>{asset.user_employee_name || '-'}</TableCell>
                                    <TableCell>
                                        <Box component="span" sx={{ px: 1, py: 0.5, borderRadius: 1, bgcolor: '#fee2e2', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
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
                                    <TableCell colSpan={10} align="center" sx={{ py: 8 }}>
                                        <Typography variant="body1" color="text.secondary">Không tìm thấy tài sản nào có tình trạng "Hỏng".</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination component="div" count={filteredAssets.length} rowsPerPage={rowsPerPage} page={page}
                        onPageChange={(_, p) => setPage(p)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        labelRowsPerPage="Số dòng mỗi trang:" />
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
