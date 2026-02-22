import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Stack,
    CircularProgress, Alert, Tooltip, Checkbox, FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { fetchProducts, addNewProduct, updateProduct, deleteProduct, deleteProducts, importProducts } from '../../store/slices/productsSlice';
import { generateProductTemplate, readExcelFile } from '../../utils/excelUtils';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { RootState, AppDispatch } from '../../store';
import type { Product } from '../../types';
import { usePermission } from '../../hooks/usePermission';

const ProductList = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status, error } = useSelector((state: RootState) => state.products);
    const { hasPermission } = usePermission();
    const canManage = hasPermission('inventory.manage');

    const [openDialog, setOpenDialog] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchProducts());
        }
    }, [status, dispatch]);

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

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa sản phẩm này? hành động này không thể hoàn tác nếu đã có giao dịch phát sinh.')) {
            await dispatch(deleteProduct(id));
        }
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

    const handleBulkDelete = async () => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} sản phẩm đã chọn? Hành động này không thể hoàn tác.`)) {
            try {
                // @ts-ignore
                await dispatch(deleteProducts(selectedIds)).unwrap();
                setSelectedIds([]);
                alert('Đã xóa thành công!');
            } catch (err) {
                console.error('Bulk delete failed:', err);
                alert('Lỗi khi xóa hàng loạt.');
            }
        }
    };

    const handleSave = async () => {
        if (!currentProduct.name || !currentProduct.item_code) {
            alert('Vui lòng điền tên và mã sản phẩm');
            return;
        }

        if (isEditMode && currentProduct.id) {
            await dispatch(updateProduct(currentProduct as Product));
        } else {
            await dispatch(addNewProduct(currentProduct as Omit<Product, 'id'>));
        }
        setOpenDialog(false);
    };

    const filteredProducts = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return products.filter(p =>
            (p.name?.toLowerCase() || '').includes(lowerTerm) ||
            (p.item_code?.toLowerCase() || '').includes(lowerTerm)
        );
    }, [products, searchTerm]);

    if (status === 'loading') return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
    if (status === 'failed') return <Alert severity="error">{error}</Alert>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={{ xs: 2, sm: 4 }} spacing={2}>
                <Box>
                    <Typography variant="h4" fontWeight="900" sx={{
                        fontSize: { xs: '1.5rem', sm: '2.125rem' },
                        textTransform: 'uppercase',
                        background: 'linear-gradient(45deg, #1e4b9b 30%, #0f2b5b 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '0.5px',
                        textShadow: '0 2px 10px rgba(15, 43, 91, 0.2)'
                    }}>
                        DANH SÁCH HÀNG HÓA
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, mt: 0.5 }}>Quản lý danh sách sản phẩm và tồn kho</Typography>
                </Box>
                {/* ... buttons stack ... */}
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
                                                        alert(`Đã nhập thành công ${mappedData.length} sản phẩm!`);
                                                        // Reset input only on success or if we want to allow retry
                                                        e.target.value = '';
                                                    } catch (err: any) {
                                                        console.error('Import failed:', err);
                                                        alert(`Lỗi khi nhập dữ liệu: ${err.message || JSON.stringify(err)}`);
                                                    }
                                                } else {
                                                    alert('Không tìm thấy dữ liệu hợp lệ trong file. Vui lòng kiểm tra lại các cột.');
                                                }
                                            } catch (error) {
                                                console.error('Import failed:', error);
                                                alert('Lỗi khi nhập file. Vui lòng kiểm tra định dạng.');
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

            <Paper sx={{ mb: 2, p: 1.5, borderRadius: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Tìm kiếm sản phẩm..."
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    InputProps={{
                        startAdornment: <Box component="span" sx={{ color: 'text.secondary', mr: 1, display: 'flex' }}><svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></Box>
                    }}
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            backgroundColor: '#f8fafc',
                            '& fieldset': { borderColor: '#e2e8f0' },
                            '&:hover fieldset': { borderColor: '#cbd5e1' },
                        }
                    }}
                />
            </Paper>

            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                        <TableRow>
                            {canManage && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={filteredProducts.length > 0 && selectedIds.length === filteredProducts.length}
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < filteredProducts.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>Mã SKU</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>Tên Sản Phẩm</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>Danh Mục</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>Đơn Giá</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>ĐVT</TableCell>
                            {canManage && (
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: '13px', fontWeight: 600, color: 'text.secondary', py: 1.5 }}>Hành động</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredProducts.map((product) => {
                            const isSelected = selectedIds.includes(product.id);
                            return (
                                <TableRow key={product.id} hover sx={{ transition: 'all 0.2s', bgcolor: isSelected ? 'action.selected' : 'inherit' }}>
                                    {canManage && (
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={isSelected}
                                                onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                                                size="small"
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell sx={{ py: 1 }}>
                                        <Typography variant="body2" fontWeight="600" color="primary.main" sx={{ fontSize: '14px' }}>{product.item_code}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Typography variant="body2" fontWeight="500" sx={{ fontSize: '14px' }}>{product.name}</Typography>
                                    </TableCell>
                                    <TableCell sx={{ py: 1 }}>
                                        <Box sx={{
                                            bgcolor: 'primary.50', color: 'primary.700',
                                            py: 0.25, px: 1, borderRadius: 10, display: 'inline-block',
                                            fontSize: '12px', fontWeight: 600
                                        }}>
                                            {product.category}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 1 }}>
                                        <Typography variant="body2" fontWeight="600" sx={{ fontSize: '14px' }}>
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.unit_price)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ py: 1, fontSize: '14px' }}>{product.unit}</TableCell>
                                    {canManage && (
                                        <TableCell align="center" sx={{ py: 1 }}>
                                            <Stack direction="row" spacing={0.5} justifyContent="center">
                                                <Tooltip title="Chỉnh sửa">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEdit(product)}
                                                        sx={{ color: 'primary.main', bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' }, padding: 0.5 }}
                                                    >
                                                        <EditIcon sx={{ fontSize: '1rem' }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Xóa">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDelete(product.id)}
                                                        sx={{ color: 'error.main', bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' }, padding: 0.5 }}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: '1rem' }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    )}
                                </TableRow>
                            )
                        })}
                        {filteredProducts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={canManage ? 7 : 6} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary" variant="body2">Không tìm thấy sản phẩm nào.</Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

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
        </Box>
    );
};

export default ProductList;
