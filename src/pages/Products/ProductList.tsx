import React, { useEffect, useState, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Stack,
    Alert, Tooltip, Checkbox, FormControl, InputLabel, Select, MenuItem, TablePagination, Chip, useMediaQuery, useTheme, Card, CardContent, Divider
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import SearchIcon from '@mui/icons-material/Search';
import { fetchProducts, addNewProduct, updateProduct, deleteProduct, deleteProducts, importProducts } from '../../store/slices/productsSlice';
import { fetchInventory, selectStockMap } from '../../store/slices/inventorySlice';
import { fetchTransactions } from '../../store/slices/transactionsSlice';
import TableSkeleton from '../../components/Common/TableSkeleton';
import { useNotification } from '../../contexts/NotificationContext';
import { generateProductTemplate, readExcelFile } from '../../utils/excelUtils';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { RootState, AppDispatch } from '../../store';
import type { Product } from '../../types';
import { usePermission } from '../../hooks/usePermission';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import { useTabVisibility } from '../../hooks/useTabVisibility';
import VoiceSearchButton from '../../components/VoiceSearchButton';

const ProductList = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status, error } = useSelector((state: RootState) => state.products);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const stockMap = useSelector(selectStockMap);
    const { hasPermission } = usePermission();
    const { success, error: notifyError } = useNotification();
    const canManage = hasPermission('inventory.manage');
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [openDialog, setOpenDialog] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [searchParams, setSearchParams] = useSearchParams();
    const filterParam = searchParams.get('filter');

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmState, setConfirmState] = useState<{
        open: boolean; title: string; message: string; onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    
    // Pagination states
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Reset page when filter/search changes
    useEffect(() => {
        setPage(0);
    }, [debouncedSearchTerm, filterParam]);

    useEffect(() => {
        if (status === 'idle') dispatch(fetchProducts());
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
    }, [status, inventoryStatus, dispatch]);

    // Tự động refresh khi quay lại tab (sau 5 phút stale)
    useTabVisibility(() => {
        dispatch(fetchProducts());
        dispatch(fetchInventory());
        dispatch(fetchTransactions());
    }, 5 * 60 * 1000);

    const handleOpenAdd = () => {
        setCurrentProduct({
            item_code: '',
            name: '',
            category: 'General',
            unit_price: 0,
            unit: 'Cái'
        });
        setIsEditMode(false);
        setOpenDialog(true);
    };

    const handleOpenEdit = (product: Product) => {
        setCurrentProduct({ ...product });
        setIsEditMode(true);
        setOpenDialog(true);
    };

    const handleDelete = (id: string, name: string) => {
        setConfirmState({
            open: true,
            title: 'Xóa sản phẩm',
            message: `Xóa "${name}"? Nếu sản phẩm đã có giao dịch phát sinh, hành động này không thể hoàn tác.`,
            onConfirm: async () => {
                setActionLoading(true);
                try {
                    await dispatch(deleteProduct(id)).unwrap();
                    success('Đã xóa sản phẩm thành công!');
                } catch (err: any) {
                    notifyError(err.message || 'Lỗi khi xóa sản phẩm');
                } finally {
                    setActionLoading(false);
                    setConfirmState(s => ({ ...s, open: false }));
                }
            }
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredProducts.map(p => p.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id));
        }
    };

    const handleBulkDelete = () => {
        setConfirmState({
            open: true,
            title: `Xóa ${selectedIds.length} sản phẩm`,
            message: `Bạn có chắc muốn xóa ${selectedIds.length} sản phẩm đã chọn? Hành động này không thể hoàn tác.`,
            onConfirm: async () => {
                setActionLoading(true);
                try {
                    await dispatch(deleteProducts(selectedIds)).unwrap();
                    setSelectedIds([]);
                    success(`Đã xóa ${selectedIds.length} sản phẩm thành công!`);
                } catch (err: any) {
                    notifyError(err.message || 'Lỗi khi xóa hàng loạt.');
                } finally {
                    setActionLoading(false);
                    setConfirmState(s => ({ ...s, open: false }));
                }
            }
        });
    };

    const handleSave = async () => {
        if (!currentProduct.name || !currentProduct.item_code) {
            notifyError('Vui lòng điền tên và mã sản phẩm');
            return;
        }

        try {
            if (isEditMode && currentProduct.id) {
                await dispatch(updateProduct(currentProduct as Product)).unwrap();
                success('Cập nhật thành công!');
            } else {
                await dispatch(addNewProduct(currentProduct as Omit<Product, 'id'>)).unwrap();
                success('Thêm mới thành công!');
            }
            setOpenDialog(false);
        } catch (err: any) {
            notifyError(err.message || 'Lỗi khi lưu sản phẩm');
        }
    };

    const filteredProducts = useMemo(() => {
        const lowerTerm = debouncedSearchTerm.toLowerCase();
        let result = products.filter(p =>
            (p.name?.toLowerCase() || '').includes(lowerTerm) ||
            (p.item_code?.toLowerCase() || '').includes(lowerTerm)
        );

        if (filterParam === 'low_stock') {
            result = result.filter(p => {
                const qty = stockMap[p.id] || 0;
                return qty > 0 && qty < 10;
            });
        } else if (filterParam === 'out_of_stock') {
            result = result.filter(p => {
                const qty = stockMap[p.id] || 0;
                return qty <= 0;
            });
        } else if (filterParam === 'negative_stock') {
            result = result.filter(p => (stockMap[p.id] || 0) < 0);
        }

        return result;
    }, [products, debouncedSearchTerm, filterParam, stockMap]);

    // Danh sách sản phẩm tồn kho âm (để hiển thị cảnh báo)
    const negativeStockProducts = useMemo(() =>
        products.filter(p => (stockMap[p.id] || 0) < 0),
    [products, stockMap]);

    if (status === 'failed') return <Alert severity="error">{error}</Alert>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={{ xs: 2, sm: 4 }} spacing={2}>
                <Box>
                    <Typography variant="h4" sx={{
                        fontWeight: 900,
                        fontSize: { xs: '1.5rem', sm: '2.125rem' },
                        textTransform: 'uppercase',
                        background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '-0.02em',
                        mb: 0.5
                    }}>
                        DANH SÁCH HÀNG HÓA
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 500 }}>
                        Quản lý danh mục sản phẩm và theo dõi tồn kho trực tuyến
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} width={{ xs: '100%', sm: 'auto' }} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                    {canManage && (
                        <>
                            {selectedIds.length > 0 && (
                                <Button
                                    variant="contained"
                                    color="error"
                                    size="small"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleBulkDelete}
                                    sx={{ borderRadius: 2, flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                                >
                                    Xóa ({selectedIds.length})
                                </Button>
                            )}
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<FileDownloadIcon />}
                                onClick={generateProductTemplate}
                                sx={{ borderRadius: 2, flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                            >
                                Tải mẫu
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                component="label"
                                startIcon={<UploadFileIcon />}
                                sx={{ borderRadius: 2, flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                            >
                                Nhập Excel
                                <input
                                    type="file"
                                    hidden
                                    accept=".xlsx, .xls"
                                    onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            try {
                                                const originalData = await readExcelFile(e.target.files[0]);
                                                // Map Vietnamese headers to English keys
                                                const mappedData = originalData.map((row: any) => ({
                                                    item_code: row['MA_HANG'],
                                                    name: row['TEN_HANG_HOA'],
                                                    category: row['LOAI_DM'] || 'General',
                                                    unit_price: Number(row['DON_GIA']) || 0,
                                                    unit: row['DON_VI'] || 'Cái',
                                                    type: row['LOAI_HANG']
                                                })).filter(p => p.item_code && p.name); // Basic validation

                                                if (mappedData.length > 0) {
                                                    try {
                                                        await dispatch(importProducts(mappedData)).unwrap();
                                                        success(`Đã nhập thành công ${mappedData.length} sản phẩm!`);
                                                        // Reset input only on success or if we want to allow retry
                                                        e.target.value = '';
                                                    } catch (err: any) {
                                                        console.error('Import failed:', err);
                                                        notifyError(`Lỗi khi nhập dữ liệu: ${err.message || JSON.stringify(err)}`);
                                                    }
                                                } else {
                                                    notifyError('Không tìm thấy dữ liệu hợp lệ trong file. Vui lòng kiểm tra lại các cột.');
                                                }
                                            } catch (error) {
                                                console.error('Import failed:', error);
                                                notifyError('Lỗi khi nhập file. Vui lòng kiểm tra định dạng.');
                                            }
                                            // Reset input value to allow re-uploading same file
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </Button>
                        </>
                    )}
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleOpenAdd}
                        sx={{ px: 2, py: 1, borderRadius: 2, flex: { xs: 1, sm: 'none' }, whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                        Thêm mới
                    </Button>
                </Stack>
            </Stack>

            {/* Cảnh báo tồn kho âm */}
            {negativeStockProducts.length > 0 && (
                <Alert
                    severity="error"
                    icon={<WarningAmberRoundedIcon />}
                    sx={{ mb: 2, borderRadius: 2, alignItems: 'flex-start' }}
                    action={
                        <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ whiteSpace: 'nowrap', mt: 0.5 }}
                            onClick={() => {
                                searchParams.set('filter', 'negative_stock');
                                setSearchParams(searchParams);
                            }}
                        >
                            Xem danh sách ({negativeStockProducts.length})
                        </Button>
                    }
                >
                    <Typography fontWeight={700} variant="body2">
                        Cảnh báo: {negativeStockProducts.length} sản phẩm đang tồn kho âm!
                    </Typography>
                    <Typography variant="caption" color="error.dark">
                        {negativeStockProducts.slice(0, 3).map(p => p.name).join(', ')}
                        {negativeStockProducts.length > 3 ? ` và ${negativeStockProducts.length - 3} sản phẩm khác...` : ''}
                    </Typography>
                </Alert>
            )}

            <Paper elevation={0} sx={{ 
                mb: 3, 
                p: 2, 
                borderRadius: '16px', 
                display: 'flex', 
                gap: 2, 
                alignItems: 'center',
                border: '1px solid #e2e8f0',
                bgcolor: 'white'
            }}>
                <TextField
                    sx={{ 
                        flexGrow: 1, 
                        '& .MuiOutlinedInput-root': { 
                            backgroundColor: '#f8fafc', 
                            '& fieldset': { border: 'none' }, 
                            '&:hover fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: '1px solid #2563eb' }
                        } 
                    }}
                    placeholder="Tìm kiếm sản phẩm theo mã SKU, tên..."
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ color: '#94a3b8', mr: 1, fontSize: 20 }} />,
                        endAdornment: <VoiceSearchButton onResult={setSearchTerm} />
                    }}
                />
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <Select
                        value={filterParam || 'all'}
                        onChange={(e) => {
                            if (e.target.value === 'all') {
                                searchParams.delete('filter');
                            } else {
                                searchParams.set('filter', e.target.value as string);
                            }
                            setSearchParams(searchParams);
                        }}
                        displayEmpty
                        sx={{ 
                            borderRadius: '10px',
                            bgcolor: '#f8fafc',
                            '& fieldset': { border: 'none' },
                            '&.Mui-focused fieldset': { border: '1px solid #2563eb' }
                        }}
                    >
                        <MenuItem value="all">Tất cả sản phẩm</MenuItem>
                        <MenuItem value="low_stock">Sắp hết hàng</MenuItem>
                        <MenuItem value="out_of_stock">Hết hàng</MenuItem>
                        <MenuItem value="negative_stock">
                            <Box display="flex" alignItems="center" gap={0.5}>
                                <WarningAmberRoundedIcon fontSize="small" sx={{ color: 'error.main' }} />
                                Tồn kho âm
                                {negativeStockProducts.length > 0 && (
                                    <Chip label={negativeStockProducts.length} size="small" color="error" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem' }} />
                                )}
                            </Box>
                        </MenuItem>
                    </Select>
                </FormControl>
            </Paper>

            {status === 'loading' ? (
                <TableSkeleton columns={canManage ? 8 : 7} rows={10} />
            ) : isMobile ? (
                <Box>
                    {filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product) => {
                        const isSelected = selectedIds.includes(product.id);
                        const qty = stockMap[product.id] || 0;
                        return (
                            <Card key={product.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {canManage && (
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                                                    size="small"
                                                    sx={{ p: 0 }}
                                                />
                                            )}
                                            <Typography variant="subtitle1" fontWeight="bold" color="primary.main">
                                                {product.item_code}
                                            </Typography>
                                        </Box>
                                        <Box sx={{
                                            bgcolor: 'primary.50', color: 'primary.700',
                                            py: 0.25, px: 1, borderRadius: 1.5,
                                            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase'
                                        }}>
                                            {product.category}
                                        </Box>
                                    </Stack>
                                    
                                    <Typography variant="body1" fontWeight="600" mb={1}>
                                        {product.name}
                                    </Typography>
                                    
                                    <Divider sx={{ my: 1 }} />
                                    
                                    <Stack direction="row" justifyContent="space-between" mb={0.5}>
                                        <Typography variant="body2" color="text.secondary">Đơn giá:</Typography>
                                        <Typography variant="body2" fontWeight="600">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.unit_price)} / {product.unit}
                                        </Typography>
                                    </Stack>
                                    
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" color="text.secondary">Tồn kho:</Typography>
                                        {qty < 0 ? (
                                            <Box display="inline-flex" alignItems="center" gap={0.5}
                                                sx={{
                                                    bgcolor: '#fef2f2', color: '#dc2626',
                                                    px: 1, py: 0.25, borderRadius: 1, border: '1px solid #fecaca',
                                                    fontWeight: 700, fontSize: '12px'
                                                }}
                                            >
                                                <WarningAmberRoundedIcon sx={{ fontSize: 14 }} /> {qty}
                                            </Box>
                                        ) : (
                                            <Typography variant="body2" fontWeight={700} color={qty === 0 ? 'error.main' : qty < 10 ? 'warning.main' : 'success.main'}>
                                                {qty}
                                            </Typography>
                                        )}
                                    </Stack>

                                    {canManage && (
                                        <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<EditIcon />}
                                                onClick={() => handleOpenEdit(product)}
                                                sx={{ borderRadius: 2, textTransform: 'none', py: 0.5 }}
                                            >
                                                Sửa
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                startIcon={<DeleteIcon />}
                                                onClick={() => handleDelete(product.id, product.name)}
                                                sx={{ borderRadius: 2, textTransform: 'none', py: 0.5 }}
                                            >
                                                Xóa
                                            </Button>
                                        </Stack>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                    {filteredProducts.length === 0 && (
                        <Box py={4} textAlign="center">
                            <Typography color="text.secondary" variant="body1" fontWeight={500}>Không tìm thấy sản phẩm nào</Typography>
                        </Box>
                    )}
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto', border: '1px solid #e2e8f0' }}>
                    <Table size="small" sx={{ minWidth: 800 }}>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                {canManage && (
                                    <TableCell padding="checkbox" sx={{ pl: 3 }}>
                                        <Checkbox
                                            checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                                            indeterminate={selectedIds.length > 0 && selectedIds.length < filteredProducts.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            size="small"
                                        />
                                    </TableCell>
                                )}
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>MÃ SKU</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>TÊN SẢN PHẨM</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>DANH MỤC</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>ĐƠN GIÁ</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>ĐVT</TableCell>
                                <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>TỒN KHO</TableCell>
                                {canManage && (
                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 800, color: '#475569', py: 2.5 }}>THAO TÁC</TableCell>
                                )}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((product) => {
                                const isSelected = selectedIds.includes(product.id);
                                return (
                                    <TableRow 
                                        key={product.id} 
                                        sx={{ 
                                            transition: 'all 0.2s', 
                                            bgcolor: isSelected ? '#eff6ff' : 'inherit',
                                            '&:hover': { bgcolor: '#f1f5f9' }
                                        }}
                                    >
                                        {canManage && (
                                            <TableCell padding="checkbox" sx={{ pl: 3 }}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ py: 2 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#2563eb', fontSize: '0.875rem' }}>{product.item_code}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 2 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b', fontSize: '0.875rem' }}>{product.name}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 2 }}>
                                            <Chip 
                                                label={product.category} 
                                                size="small"
                                                sx={{ 
                                                    fontWeight: 700, 
                                                    fontSize: '10px', 
                                                    bgcolor: product.category === 'Hàng hóa' ? '#f0f9ff' : '#f5f3ff',
                                                    color: product.category === 'Hàng hóa' ? '#0369a1' : '#6d28d9',
                                                    border: 'none',
                                                    borderRadius: '6px'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 2 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.875rem', color: '#0f172a' }}>
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.unit_price)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: 2, fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>{product.unit}</TableCell>
                                        <TableCell
                                            align="right"
                                            sx={{ py: 2 }}
                                        >
                                            {(() => {
                                                const qty = stockMap[product.id] || 0;
                                                if (qty < 0) {
                                                    return (
                                                        <Tooltip title="Tồn kho âm — cần kiểm tra xuất nhập!" arrow>
                                                            <Box display="inline-flex" alignItems="center" gap={0.5}
                                                                sx={{
                                                                    bgcolor: '#fef2f2', color: '#dc2626',
                                                                    px: 1.25, py: 0.5, borderRadius: '6px',
                                                                    fontWeight: 800, fontSize: '0.875rem', cursor: 'help'
                                                                }}
                                                            >
                                                                <WarningAmberRoundedIcon sx={{ fontSize: 16 }} />
                                                                {qty}
                                                            </Box>
                                                        </Tooltip>
                                                    );
                                                }
                                                return (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ 
                                                            fontWeight: 800, 
                                                            fontSize: '0.875rem',
                                                            color: qty === 0 ? '#ef4444' : qty < 10 ? '#f59e0b' : '#10b981'
                                                        }}
                                                    >
                                                        {qty}
                                                    </Typography>
                                                );
                                            })()}
                                        </TableCell>
                                        {canManage && (
                                            <TableCell align="center" sx={{ py: 2 }}>
                                                <Stack direction="row" spacing={1} justifyContent="center">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEdit(product)}
                                                        sx={{ color: '#2563eb', bgcolor: '#f8fafc', '&:hover': { bgcolor: '#eff6ff' } }}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDelete(product.id, product.name)}
                                                        sx={{ color: '#ef4444', bgcolor: '#f8fafc', '&:hover': { bgcolor: '#fef2f2' } }}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                )
                            })}
                            {filteredProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={canManage ? 8 : 7} align="center" sx={{ py: 8 }}>
                                        <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
                                             <Typography color="text.secondary" variant="body1" fontWeight={500}>Không tìm thấy sản phẩm nào</Typography>
                                             <Typography color="text.disabled" variant="body2">Hãy thử thay đổi từ khóa hoặc bộ lọc</Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredProducts.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Số dòng mỗi trang:"
                labelDisplayedRows={({ from, to, count }) => `${from}–${to} của ${count !== -1 ? count : `hơn ${to}`}`}
            />

            {/* Add/Edit Dialog */}
            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 3 }
                }}
            >
                <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
                    <Typography variant="h6" fontWeight="900" sx={{ textTransform: 'uppercase', color: 'primary.main' }}>
                        {isEditMode ? 'CẬP NHẬT SẢN PHẨM' : 'THÊM SẢN PHẨM MỚI'}
                    </Typography>
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Mã Hàng (SKU)"
                            fullWidth
                            variant="outlined"
                            value={currentProduct.item_code}
                            onChange={(e) => setCurrentProduct({ ...currentProduct, item_code: e.target.value })}
                            InputProps={{ sx: { borderRadius: 2 } }}
                        />
                        <TextField
                            label="Tên Hàng Hóa"
                            fullWidth
                            variant="outlined"
                            value={currentProduct.name}
                            onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                            InputProps={{ sx: { borderRadius: 2 } }}
                        />
                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth>
                                <InputLabel id="category-label">Danh Mục</InputLabel>
                                <Select
                                    labelId="category-label"
                                    id="category-select"
                                    value={currentProduct.category}
                                    label="Danh Mục"
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, category: e.target.value })}
                                    sx={{ borderRadius: 2 }}
                                >
                                    <MenuItem value="Vật tư">Vật tư</MenuItem>
                                    <MenuItem value="Hàng hóa">Hàng hóa</MenuItem>
                                </Select>
                            </FormControl>
                            <TextField
                                label="Đơn Vị"
                                fullWidth
                                variant="outlined"
                                value={currentProduct.unit}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, unit: e.target.value })}
                                InputProps={{ sx: { borderRadius: 2 } }}
                            />
                        </Stack>
                        <TextField
                            label="Đơn Giá"
                            type="number"
                            fullWidth
                            variant="outlined"
                            value={currentProduct.unit_price}
                            onChange={(e) => setCurrentProduct({ ...currentProduct, unit_price: Number(e.target.value) })}
                            InputProps={{ sx: { borderRadius: 2 } }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => setOpenDialog(false)} sx={{ color: 'text.secondary', fontWeight: 600 }}>Hủy bỏ</Button>
                    <Button onClick={handleSave} variant="contained" color="primary" sx={{ px: 3, py: 1, borderRadius: 2, fontWeight: 600 }}>
                        {isEditMode ? 'Lưu thay đổi' : 'Tạo mới'}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Xóa ngay"
                severity="danger"
                loading={actionLoading}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
            />
        </Box>
    );
};

export default ProductList;
