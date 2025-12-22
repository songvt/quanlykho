import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory, selectProductStock } from '../store/slices/inventorySlice';
import { addInboundTransaction } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import {
    Button, TextField, FormControl, FormHelperText,
    Typography, Box, Alert, CircularProgress, Paper, Stack, Dialog, DialogContent, DialogTitle, Autocomplete,
    List, ListItem, ListItemText, ListItemSecondaryAction, IconButton
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import QRScanner from '../components/QRScanner';
import { readExcelFile, generateInboundTemplate } from '../utils/excelUtils';
import { useScanDetection } from '../hooks/useScanDetection';
import { playBeep } from '../utils/audio';
import { importInboundTransactions } from '../store/slices/transactionsSlice';

export const Inbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { profile } = useSelector((state: RootState) => state.auth);
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

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchProducts());
        }
        dispatch(fetchInventory());
    }, [status, dispatch]);

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
            if (scannedSerials.includes(decodedText)) {
                setNotification({ type: 'error', message: `Đã quét: ${decodedText}` });
                return;
            }
            setScannedSerials(prev => {
                const newer = [...prev, decodedText];
                setQuantity(newer.length);
                return newer;
            });
            setNotification({ type: 'success', message: `Đã thêm: ${decodedText}` });
            // Do NOT close scanner for continuous scanning
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

    if (status === 'loading' as string) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: 1000, mx: 'auto', width: '100%', overflowX: 'hidden', zoom: { xs: 0.85, md: 1 } }}>
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
                            getOptionLabel={(option) => `${option.name} - ${option.item_code}`}
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

                    <Stack direction="row" spacing={2}>
                        <Button
                            variant="outlined"
                            color="inherit"
                            size="large"
                            fullWidth
                            onClick={() => {
                                setSelectedProduct('');
                                setQuantity(1);
                                setSerial('');
                                setScannedSerials([]);
                                setPrice(0);
                                setDistrict('');
                                setItemStatus('');
                            }}
                            sx={{ py: { xs: 1.5, md: 2 }, borderRadius: 3, fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 700, textTransform: 'none' }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            size="large"
                            fullWidth
                            onClick={handleSave}
                            disabled={status === 'loading'}
                            sx={{ py: { xs: 1.5, md: 2 }, borderRadius: 3, fontSize: { xs: '1rem', md: '1.1rem' }, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                        >
                            Nhập Kho
                        </Button>
                    </Stack>
                </Stack>


                {/* Scanner Dialog */}
                <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                    <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main', textAlign: 'center' }}>
                        QUÉT MÃ QR/MÃ VẠCH
                    </DialogTitle>
                    <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                        <QRScanner
                            onScanSuccess={handleScanSuccess}
                            onScanFailure={(err) => console.log(err)}
                            height={400}
                        />
                        <Box textAlign="center" p={2}>
                            <Button onClick={() => setShowScanner(false)} variant="outlined" color="inherit">Đóng Camera</Button>
                        </Box>
                    </DialogContent>
                </Dialog>
            </Paper>
        </Box>
    );
}

// Remove default export to avoid confusion
// export default Inbound;
