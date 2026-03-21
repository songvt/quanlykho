import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory, selectProductStock } from '../store/slices/inventorySlice';
import { addInboundTransaction, fetchTransactions, updateTransaction, deleteTransaction } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import type { Transaction } from '../types';
import {
    Button, TextField, FormControl, FormHelperText,
    Typography, Box, Alert, CircularProgress, Paper, Stack, Dialog, DialogContent, DialogTitle, Autocomplete,
    List, ListItem, ListItemText, ListItemSecondaryAction, IconButton,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Tooltip, DialogActions, InputAdornment
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import QRScanner from '../components/QRScanner';
import { readExcelFile, generateInboundTemplate } from '../utils/excelUtils';
import { useScanDetection } from '../hooks/useScanDetection';
import { playBeep } from '../utils/audio';
import { importInboundTransactions } from '../store/slices/transactionsSlice';

export const Inbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { stockMap } = useSelector((state: RootState) => state.inventory);
    const { items: transactions, status: txStatus } = useSelector((state: RootState) => state.transactions);
    const isAdmin = profile?.role === 'admin';

    // Form state
    const [selectedProduct, setSelectedProduct] = useState('');
    const currentStock = useSelector((state: RootState) => selectProductStock(state, selectedProduct));
    const [quantity, setQuantity] = useState(1);
    const [serial, setSerial] = useState('');
    const [price, setPrice] = useState(0);
    const [district, setDistrict] = useState(''); // Added District
    const [itemStatus, setItemStatus] = useState(''); // Added Item Status
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Scanner state
    const [showScanner, setShowScanner] = useState(false);

    // List State
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Edit Dialog State
    const [editDialog, setEditDialog] = useState(false);
    const [editItem, setEditItem] = useState<Transaction | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Delete Dialog State
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Transaction | null>(null);

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchProducts());
        }
        if (txStatus === 'idle') {
            dispatch(fetchTransactions());
        }
        dispatch(fetchInventory());
    }, [status, txStatus, dispatch]);

    // Physical Scanners (Keyboard Mode)
    useScanDetection((code) => {
        playBeep(); // Beep for physical scanner
        handleScanSuccess(code);
    });

    const handleSave = async () => {
        if (!selectedProduct) {
            setNotification({ type: 'error', message: 'Vui lòng chọn sản phẩm' });
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        // Parse serials
        let serialList: string[] = [];
        if (isSerialized) {
            // Priority: scannedSerials (multi-scan) > serial (manual text input)
            if (scannedSerials.length > 0) {
                serialList = [...scannedSerials];
            } else if (false) { // Original logic used `serial.trim()`, but `serial` state is removed. This branch will now effectively be dead.
                // serialList = serial.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s !== '');
            }

            if (serialList.length === 0) {
                setNotification({ type: 'error', message: 'Vui lòng nhập hoặc quét số Serial cho Hàng hóa' });
                return;
            }
        }

        try {
            if (isSerialized) {
                // Multi-serial Mode
                let successCount = 0;
                for (const code of serialList) {
                    await dispatch(addInboundTransaction({
                        product_id: selectedProduct,
                        quantity: 1, // Force quantity to 1 for each serial
                        serial_code: code,
                        unit_price: Number(price),
                        district: district.trim() || undefined,
                        item_status: itemStatus.trim() || undefined // Added item_status
                    })).unwrap();
                    successCount++;
                }
                setNotification({ type: 'success', message: `Đã nhập kho thành công ${successCount} serial!` });
            } else {
                // Single Item / Non-serialized Mode
                await dispatch(addInboundTransaction({
                    product_id: selectedProduct,
                    quantity: Number(quantity),
                    serial_code: serial.trim() || undefined,
                    unit_price: Number(price),
                    district: district.trim() || undefined,
                    item_status: itemStatus.trim() || undefined // Added item_status
                })).unwrap();
                setNotification({ type: 'success', message: 'Nhập kho thành công!' });
            }

            // Reset form
            setSerial('');
            setScannedSerials([]);
            setQuantity(1);
            setDistrict(''); // Reset district
            setItemStatus('');

            // Sync Global Redux State
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
            // Keep price? Maybe.
        } catch (err: any) {
            setNotification({ type: 'error', message: err.message || 'Có lỗi xảy ra' });
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        // Note: QRScanner plays beep internally. useScanDetection plays beep in its callback.
        // So we don't play beep here to avoid double-beep for camera.

        if (isSerialized) {
            // Split scannned text by space, newline, comma, semicolon
            const newCodes = decodedText.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s !== '');
            let addedCount = 0;

            setScannedSerials(prev => {
                const uniqueNewCodes = newCodes.filter(code => !prev.includes(code));
                if (uniqueNewCodes.length === 0) return prev;
                addedCount = uniqueNewCodes.length;
                const newer = [...prev, ...uniqueNewCodes];
                setQuantity(newer.length);
                return newer;
            });

            if (addedCount > 0) {
                setNotification({ type: 'success', message: `Đã thêm ${addedCount} serial: ${newCodes.join(', ')}` });
                setShowScanner(false); // Close scanner after success (batch scan complete)
            } else {
                setNotification({ type: 'error', message: `Các serial này đã tồn tại: ${decodedText}` });
                // Optional: Close scanner even if duplicate? User said "scan done then close".
                // Let's close it to be consistent with "scan done".
                setShowScanner(false);
            }
        } else {
            setSerial(decodedText);
            setShowScanner(false);
            setNotification({ type: 'success', message: 'Đã quét mã thành công!' });
        }
    };

    const handleManualAddSerial = () => {
        if (!serial.trim()) return;
        if (scannedSerials.includes(serial.trim())) {
            setNotification({ type: 'error', message: 'Serial này đã được thêm.' });
            return;
        }
        setScannedSerials(prev => {
            const newer = [...prev, serial.trim()];
            setQuantity(newer.length);
            return newer;
        });
        setSerial('');
    };

    const handleRemoveSerial = (code: string) => {
        setScannedSerials(prev => {
            const newer = prev.filter(s => s !== code);
            setQuantity(newer.length > 0 ? newer.length : 1);
            return newer;
        });
    };

    // List Handlers
    const filteredTransactions = transactions
        .filter(t => t.type === 'inbound')
        .filter(t => {
            const searchStr = searchTerm.toLowerCase();
            return (
                t.product?.name?.toLowerCase().includes(searchStr) ||
                t.product?.item_code?.toLowerCase().includes(searchStr) ||
                (t.serial_code && t.serial_code.toLowerCase().includes(searchStr)) ||
                (t.district && t.district.toLowerCase().includes(searchStr))
            );
        });

    const paginatedTransactions = filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleEditClick = (item: Transaction) => {
        setEditItem(item);
        setEditData({
            quantity: item.quantity,
            unit_price: item.unit_price,
            serial_code: item.serial_code || '',
            district: item.district || '',
            item_status: item.item_status || ''
        });
        setEditDialog(true);
    };

    const handleEditSave = async () => {
        if (!editItem) return;
        try {
            await dispatch(updateTransaction({
                id: editItem.id,
                type: 'inbound',
                payload: {
                    quantity: Number(editData.quantity),
                    unit_price: Number(editData.unit_price),
                    serial_code: editData.serial_code,
                    district: editData.district,
                    item_status: editData.item_status,
                }
            })).unwrap();
            setNotification({ type: 'success', message: 'Cập nhật thành công!' });
            setEditDialog(false);
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            setNotification({ type: 'error', message: error.message || 'Lỗi cập nhật' });
        }
    };

    const handleDeleteClick = (item: Transaction) => {
        setItemToDelete(item);
        setDeleteDialog(true);
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        try {
            await dispatch(deleteTransaction({ id: itemToDelete.id, type: 'inbound' })).unwrap();
            setNotification({ type: 'success', message: 'Xóa thành công!' });
            setDeleteDialog(false);
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            setNotification({ type: 'error', message: error.message || 'Lỗi khi xóa' });
        }
    };

    if (status === 'loading' as string) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto', width: '100%', overflowX: 'hidden' }}>
            <Box mb={{ xs: 3, md: 5 }} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4" component="h1" fontWeight="900" gutterBottom sx={{
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(45deg, #0288d1 30%, #26c6da 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '1px'
                }}>
                    NHẬP HÀNG HÓA
                </Typography>
                <Typography variant="subtitle1" color="text.secondary" fontWeight="normal" sx={{ fontSize: { xs: '0.8rem', sm: '0.9rem', md: '1.25rem' }, textAlign: 'center' }}>
                    Tạo phiếu nhập kho và cập nhật số lượng tồn
                </Typography>
            </Box>

            {isAdmin && (
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={2} mb={3}>
                    <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={generateInboundTemplate} size="small" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Tải mẫu Excel
                    </Button>
                    <Button variant="contained" component="label" startIcon={<UploadFileIcon />} size="small" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                        Nhập Excel
                        <input
                            type="file"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={async (e) => {
                                if (e.target.files && e.target.files[0]) {
                                    try {
                                        const json = await readExcelFile(e.target.files[0]);
                                        // Map data
                                        const mappedData = json.map((row: any) => {
                                            const product = products.find(p => p.item_code === row['MA_HANG']);
                                            if (!product) throw new Error(`Không tìm thấy sản phẩm có mã: ${row['MA_HANG']}`);

                                            // Validation: Require Serial for 'Hàng hóa'
                                            if (product?.category?.toLowerCase() === 'hàng hóa' && !row['SERIAL']) {
                                                throw new Error(`Sản phẩm ${row['MA_HANG']} (${product.name}) là Hàng hóa nên bắt buộc phải có Serial.`);
                                            }

                                            return {
                                                product_id: product.id,
                                                quantity: Number(row['SO_LUONG'] || 0),
                                                unit_price: Number(row['DON_GIA'] || product.unit_price || 0),
                                                serial_code: row['SERIAL'] ? String(row['SERIAL']) : undefined,
                                                district: row['QUAN_HUYEN'] ? String(row['QUAN_HUYEN']) : undefined, // Added district
                                                item_status: row['TRANG_THAI_HANG'] ? String(row['TRANG_THAI_HANG']) : undefined // Added item_status
                                                // total_price is a generated column, do not insert
                                            };
                                        });

                                        if (mappedData.length > 0) {
                                            await dispatch(importInboundTransactions(mappedData)).unwrap();

                                            // Sync Global Redux State
                                            dispatch(fetchTransactions());
                                            dispatch(fetchInventory());

                                            alert(`Đã nhập thành công ${mappedData.length} giao dịch!`);
                                            setNotification({ type: 'success', message: `Đã nhập ${mappedData.length} giao dịch từ Excel!` });
                                        }
                                    } catch (error: any) {
                                        console.error('Import failed:', error);
                                        alert(`Lỗi: ${error.message}`);
                                    }
                                    e.target.value = '';
                                }
                            }}
                        />
                    </Button>
                </Stack>
            )}

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 4, md: 6 }, maxWidth: 1000, mx: 'auto', borderRadius: { xs: 2, sm: 5 }, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                {notification && (
                    <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {notification.message}
                    </Alert>
                )}

                <Stack spacing={{ xs: 3, md: 4 }}>
                    <FormControl fullWidth size="small">
                        <Autocomplete
                            options={products}
                            getOptionLabel={(option) => `${option.name} (${option.item_code}) - Tồn: ${stockMap[option.id] || 0}`}
                            value={products.find(p => p.id === selectedProduct) || null}
                            onChange={(_, newValue) => {
                                if (newValue) {
                                    setSelectedProduct(newValue.id);
                                    setPrice(newValue.unit_price || 0);
                                    setScannedSerials([]);
                                    setSerial('');
                                    setQuantity(1);
                                } else {
                                    setSelectedProduct('');
                                    setPrice(0);
                                    setScannedSerials([]);
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Tên vật tư hàng hóa"
                                    placeholder="Tìm kiếm vật tư..."
                                    InputLabelProps={{ style: { fontSize: '0.9rem' } }}
                                    size="small"
                                />
                            )}
                            PaperComponent={({ children }) => (
                                <Paper elevation={8} sx={{ borderRadius: 2 }}>{children}</Paper>
                            )}
                        />
                        {selectedProduct && (
                            <FormHelperText sx={{ mt: 1, fontSize: '0.9rem', color: 'primary.main', fontWeight: 600 }}>
                                Tồn kho hiện tại: {currentStock}
                            </FormHelperText>
                        )}
                    </FormControl>

                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={{ xs: 2, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Số lượng"
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                            InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                            InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="Đơn giá nhập"
                            type="number"
                            value={price}
                            onChange={e => setPrice(Number(e.target.value))}
                            InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                            InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                            size="small"
                        />
                    </Box>
                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={{ xs: 2, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Trạng thái hàng"
                            value={itemStatus}
                            onChange={e => setItemStatus(e.target.value)}
                            InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                            InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                            size="small"
                            placeholder="Nhập trạng thái hàng (ví dụ: Mới, Cũ)..."
                        />

                        <TextField
                            fullWidth
                            label="Quận/Huyện"
                            value={district}
                            onChange={e => setDistrict(e.target.value)}
                            InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                            InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                            size="small"
                            placeholder="Nhập Quận/Huyện (nếu có)"
                        />
                    </Box>
                    {products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa' && (
                        <Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                                <TextField
                                    fullWidth
                                    label="Serial / QR Code (Bắt buộc)"
                                    required
                                    value={serial}
                                    onChange={e => setSerial(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleManualAddSerial();
                                        }
                                    }}
                                    placeholder="Quét mã hoặc nhập tay rồi Enter"
                                    InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                                    InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                                    size="small"
                                />
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => setShowScanner(true)}
                                    startIcon={<QrCodeScannerIcon />}
                                    sx={{ height: { xs: 40, sm: 56 }, px: { xs: 2, md: 3 }, borderRadius: 2, whiteSpace: 'nowrap', fontSize: { xs: '0.875rem', md: '1rem' }, width: { xs: '100%', sm: 'auto' } }}
                                >
                                    Quét QR
                                </Button>
                            </Stack>

                            {/* List of scanned serials */}
                            {scannedSerials.length > 0 && (
                                <Paper variant="outlined" sx={{ mt: 2, maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50' }}>
                                    <List dense>
                                        {scannedSerials.map((code, index) => (
                                            <ListItem key={index} divider>
                                                <ListItemText primary={`#${index + 1}: ${code}`} />
                                                <ListItemSecondaryAction>
                                                    <IconButton edge="end" size="small" onClick={() => handleRemoveSerial(code)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </ListItemSecondaryAction>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            )}
                            <FormHelperText sx={{ mt: 1 }}>* Số lượng sẽ tự động cập nhật theo số serial đã quét ({scannedSerials.length})</FormHelperText>
                        </Box>
                    )}

                    <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
                        <Button
                            variant="outlined"
                            color="inherit"
                            size="large"
                            onClick={() => {
                                setSelectedProduct('');
                                setQuantity(1);
                                setSerial('');
                                setScannedSerials([]);
                                setPrice(0);
                                setDistrict('');
                                setItemStatus('');
                            }}
                            sx={{ minWidth: 120, py: { xs: 1, md: 1.5 }, borderRadius: 3, fontSize: { xs: '0.9rem', md: '1rem' }, fontWeight: 700, textTransform: 'none' }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            onClick={handleSave}
                            disabled={status === 'loading'}
                            sx={{ minWidth: 150, py: { xs: 1, md: 1.5 }, borderRadius: 3, fontSize: { xs: '0.9rem', md: '1rem' }, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                        >
                            Nhập Kho
                        </Button>
                    </Box>
                </Stack>


                <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                    <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main', textAlign: 'center' }}>
                        QUÉT MÃ QR/MÃ VẠCH
                    </DialogTitle>
                    <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                        <QRScanner
                            onScanSuccess={handleScanSuccess}
                            onScanFailure={() => { }}
                            height={400}
                        />
                        <Box textAlign="center" p={2}>
                            <Button onClick={() => setShowScanner(false)} variant="outlined" color="inherit">Đóng Camera</Button>
                        </Box>
                    </DialogContent>
                </Dialog>
            </Paper>

            {/* List of Inbound Transactions */}
            <Box mt={6}>
                <Typography variant="h5" fontWeight="bold" mb={3}>Danh sách hàng hóa đã nhập</Typography>
                <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <Box p={2} borderBottom="1px solid" borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
                        <TextField
                            placeholder="Tìm kiếm theo Tên SP, Serial, Quận/Huyện..."
                            size="small"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            sx={{ width: { xs: '100%', sm: 350 } }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                                sx: { borderRadius: 2 }
                            }}
                        />
                    </Box>
                    <TableContainer>
                        <Table sx={{ minWidth: 800 }}>
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600 }}>Thời gian</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Tên vật tư</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Serial</TableCell>
                                    <TableCell sx={{ fontWeight: 600, align: 'right' }}>SL</TableCell>
                                    <TableCell sx={{ fontWeight: 600, align: 'right' }}>Đơn giá</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Quận/Huyện</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                                    <TableCell sx={{ fontWeight: 600, align: 'center' }}>Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((row) => (
                                        <TableRow key={row.id} hover>
                                            <TableCell>{new Date(row.date || (row as any).inbound_date || '').toLocaleString('vi-VN')}</TableCell>
                                            <TableCell>{row.product?.name || 'Unknown'}</TableCell>
                                            <TableCell>{row.serial_code || '-'}</TableCell>
                                            <TableCell align="right">{row.quantity}</TableCell>
                                            <TableCell align="right">{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</TableCell>
                                            <TableCell>{row.district || '-'}</TableCell>
                                            <TableCell>{row.item_status || '-'}</TableCell>
                                            <TableCell align="center">
                                                <Tooltip title="Sửa">
                                                    <IconButton color="primary" onClick={() => handleEditClick(row)} size="small">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Xóa">
                                                    <IconButton color="error" onClick={() => handleDeleteClick(row)} size="small">
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                            Không có dữ liệu
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <TablePagination
                        component="div"
                        count={filteredTransactions.length}
                        page={page}
                        onPageChange={(_, newPage) => setPage(newPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(e) => {
                            setRowsPerPage(parseInt(e.target.value, 10));
                            setPage(0);
                        }}
                        labelRowsPerPage="Số dòng / trang:"
                        labelDisplayedRows={({ from, to, count }) => `${from}-${to} trên ${count}`}
                    />
                </Paper>
            </Box>

            {/* Edit Dialog */}
            <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold' }}>Sửa Giao Dịch Nhập</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} pt={1}>
                        <TextField
                            label="Số lượng"
                            type="number"
                            fullWidth
                            size="small"
                            value={editData.quantity || ''}
                            onChange={(e) => setEditData({ ...editData, quantity: e.target.value })}
                        />
                        <TextField
                            label="Đơn giá"
                            type="number"
                            fullWidth
                            size="small"
                            value={editData.unit_price || ''}
                            onChange={(e) => setEditData({ ...editData, unit_price: e.target.value })}
                        />
                        <TextField
                            label="Serial Code"
                            fullWidth
                            size="small"
                            value={editData.serial_code || ''}
                            onChange={(e) => setEditData({ ...editData, serial_code: e.target.value })}
                        />
                        <TextField
                            label="Quận/Huyện"
                            fullWidth
                            size="small"
                            value={editData.district || ''}
                            onChange={(e) => setEditData({ ...editData, district: e.target.value })}
                        />
                        <TextField
                            label="Trạng thái hàng"
                            fullWidth
                            size="small"
                            value={editData.item_status || ''}
                            onChange={(e) => setEditData({ ...editData, item_status: e.target.value })}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setEditDialog(false)} color="inherit" variant="outlined">Hủy</Button>
                    <Button onClick={handleEditSave} color="primary" variant="contained">Cập nhật</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>Xác nhận xóa</DialogTitle>
                <DialogContent>
                    <Typography>Bạn có chắc chắn muốn xóa giao dịch này? Hành động này không thể hoàn tác và sẽ ảnh hưởng đến tồn kho.</Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDeleteDialog(false)} color="inherit">Hủy</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Xóa</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

// Remove default export to avoid confusion
// export default Inbound;
