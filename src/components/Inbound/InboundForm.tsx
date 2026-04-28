import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box, Button, TextField, FormControl, FormHelperText, Autocomplete,
    Paper, Stack, Grid, MenuItem, CircularProgress, Typography
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { addInboundTransaction, importInboundTransactions, fetchTransactionsForce } from '../../store/slices/transactionsSlice';
import { selectProductStock, selectStockMap } from '../../store/slices/inventorySlice';
import { useNotification } from '../../contexts/NotificationContext';
import { parseSerialInput, filterNewSerials } from '../../utils/serialParser';
import { playBeep } from '../../utils/audio';
import { useScanDetection } from '../../hooks/useScanDetection';
import SerialChips from '../Common/SerialChips';
import QRScanner from '../QRScanner';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';

interface InboundFormProps {
    onSuccess?: () => void;
}

const InboundForm: React.FC<InboundFormProps> = ({ onSuccess }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products } = useSelector((state: RootState) => state.products);
    const stockMap = useSelector(selectStockMap);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { success, error: notifyError } = useNotification();

    // Form state
    const [selectedProduct, setSelectedProduct] = useState('');
    const currentStock = useSelector((state: RootState) => selectProductStock(state, selectedProduct));
    const [quantity, setQuantity] = useState(1);
    const [serial, setSerial] = useState('');
    const [price, setPrice] = useState(0);
    const [district, setDistrict] = useState('');
    const [itemStatus, setItemStatus] = useState('');
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const scannedSerialsRef = useRef<string[]>([]);
    const pendingCountRef = useRef(0);
    const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => { scannedSerialsRef.current = scannedSerials; }, [scannedSerials]);

    const handleScanSuccess = useCallback((decodedText: string) => {
        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        if (isSerialized) {
            const newCodes = parseSerialInput(decodedText);
            const currentSerials = scannedSerialsRef.current;
            const uniqueNewCodes = filterNewSerials(newCodes, currentSerials);

            if (uniqueNewCodes.length > 0) {
                scannedSerialsRef.current = [...currentSerials, ...uniqueNewCodes];
                pendingCountRef.current += uniqueNewCodes.length;
                setScannedSerials(scannedSerialsRef.current);
                setQuantity(scannedSerialsRef.current.length);

                if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
                notifyTimerRef.current = setTimeout(() => {
                    success(`✅ Đã thêm ${pendingCountRef.current} serial — Tổng: ${scannedSerialsRef.current.length}`);
                    pendingCountRef.current = 0;
                }, 400);

                if (showScanner) setShowScanner(false);
            } else {
                notifyError(newCodes.length === 1 ? `⚠️ Serial đã tồn tại: ${newCodes[0]}` : `⚠️ ${newCodes.length} serial đã tồn tại`);
                if (showScanner) setShowScanner(false);
            }
        } else {
            setSerial(decodedText);
            setShowScanner(false);
            success('Đã quét mã thành công!');
        }
    }, [selectedProduct, products, showScanner, success, notifyError]);

    const handlePhysicalScan = useCallback((code: string) => {
        playBeep();
        handleScanSuccess(code);
    }, [handleScanSuccess]);

    useScanDetection(handlePhysicalScan);

    const handleManualAddSerial = () => {
        if (!serial.trim()) return;
        const newCodes = parseSerialInput(serial);
        if (newCodes.length === 0) return;

        setScannedSerials(prev => {
            const uniqueNewCodes = newCodes.filter(code => !prev.includes(code));
            if (uniqueNewCodes.length === 0) {
                notifyError('Tất cả serial này đã được thêm rồi.');
                return prev;
            }
            const newer = [...prev, ...uniqueNewCodes];
            setQuantity(newer.length);
            success(`Đã thêm ${uniqueNewCodes.length} serial.`);
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

    const resetForm = () => {
        setSelectedProduct('');
        setQuantity(1);
        setSerial('');
        setScannedSerials([]);
        setPrice(0);
        setDistrict('');
        setItemStatus('');
    };

    const handleSave = async () => {
        if (!selectedProduct) {
            notifyError('Vui lòng chọn sản phẩm');
            return;
        }
        if (isSaving) return;

        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        let serialList = isSerialized ? (scannedSerials.length > 0 ? scannedSerials : parseSerialInput(serial)) : [];
        if (isSerialized && serialList.length === 0) {
            notifyError('Vui lòng nhập hoặc quét số Serial cho Hàng hóa');
            return;
        }

        setIsSaving(true);
        try {
            const creator = profile?.full_name || profile?.username || profile?.email || 'system';
            if (isSerialized) {
                const bulkData = serialList.map(code => ({
                    product_id: selectedProduct,
                    quantity: 1,
                    serial_code: code,
                    unit_price: Number(price),
                    district: district.trim() || undefined,
                    item_status: itemStatus.trim() || undefined,
                    created_by: creator
                }));
                await dispatch(importInboundTransactions(bulkData)).unwrap();
                success(`Đã nhập kho thành công ${bulkData.length} serial!`);
            } else {
                await dispatch(addInboundTransaction({
                    product_id: selectedProduct,
                    quantity: Number(quantity),
                    serial_code: serial.trim() || undefined,
                    unit_price: Number(price),
                    district: district.trim() || undefined,
                    item_status: itemStatus.trim() || undefined,
                    created_by: creator
                })).unwrap();
                success('Nhập kho thành công!');
            }
            resetForm();
            onSuccess?.();
            dispatch(fetchTransactionsForce()); // Refresh list
        } catch (err: any) {
            notifyError(err.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    const isSerializedProduct = products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa';

    return (
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 }, borderRadius: { xs: 2, sm: 5 }, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
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
                                <TextField {...params} label="Tên vật tư hàng hóa" placeholder="Tìm kiếm vật tư..." size="small" />
                            )}
                        />
                        {selectedProduct && (
                            <FormHelperText sx={{ mt: 1, fontSize: '0.9rem', color: 'primary.main', fontWeight: 600 }}>
                                Tồn kho hiện tại: {currentStock}
                            </FormHelperText>
                        )}
                    </FormControl>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        fullWidth label="Số lượng" type="number" value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))}
                        inputProps={{ min: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                        size="small" disabled={isSerializedProduct}
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        fullWidth label="Đơn giá nhập" type="number" value={price}
                        onChange={e => setPrice(Number(e.target.value))}
                        inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }} size="small"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        fullWidth select label="Trạng thái hàng" value={itemStatus}
                        onChange={e => setItemStatus(e.target.value)} size="small"
                    >
                        <MenuItem value=""><em>-- Chọn trạng thái --</em></MenuItem>
                        <MenuItem value="Hàng mới">Hàng mới</MenuItem>
                        <MenuItem value="Hàng thu hồi bảo hành">Hàng thu hồi bảo hành</MenuItem>
                        <MenuItem value="Hàng thu hồi">Hàng thu hồi</MenuItem>
                    </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        fullWidth select label="Quận/Huyện" value={district}
                        onChange={e => setDistrict(e.target.value)} size="small"
                    >
                        <MenuItem value=""><em>-- Chọn quận/huyện --</em></MenuItem>
                        <MenuItem value="Q12">Q12</MenuItem>
                        <MenuItem value="HMN">HMN</MenuItem>
                        <MenuItem value="CCI">CCI</MenuItem>
                    </TextField>
                </Grid>

                {isSerializedProduct && (
                    <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
                                <TextField
                                    fullWidth label="Serial / QR Code (Bắt buộc)" required value={serial}
                                    onChange={e => setSerial(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleManualAddSerial(); } }}
                                    placeholder="Quét mã hoặc nhập tay rồi Enter" size="small"
                                />
                                <Button
                                    variant="outlined" color="primary" onClick={() => setShowScanner(true)}
                                    startIcon={<QrCodeScannerIcon />}
                                    sx={{ height: 40, px: 3, borderRadius: 2, whiteSpace: 'nowrap' }}
                                >
                                    Quét QR
                                </Button>
                            </Stack>
                            <SerialChips serials={scannedSerials} onRemove={handleRemoveSerial} maxVisible={12} />
                            {scannedSerials.length === 0 && (
                                <Typography variant="caption" color="text.secondary" display="block" textAlign="center" py={1}>
                                    Chưa có serial nào được quét. Số lượng sẽ tự động cập nhật theo số serial.
                                </Typography>
                            )}
                        </Paper>
                    </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                    <Box display="flex" justifyContent="flex-end" gap={2} mt={2}>
                        <Button
                            variant="outlined" color="inherit" size="large" onClick={resetForm}
                            sx={{ minWidth: 120, py: 1.2, borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="contained" color="primary" size="large" onClick={handleSave}
                            disabled={isSaving}
                            startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
                            sx={{ minWidth: 150, py: 1.2, borderRadius: 3, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                        >
                            {isSaving ? 'Đang lưu...' : 'Nhập Kho'}
                        </Button>
                    </Box>
                </Grid>
            </Grid>

            <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main', textAlign: 'center' }}>
                    QUÉT MÃ QR/MÃ VẠCH
                </DialogTitle>
                <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                    <QRScanner onScanSuccess={handleScanSuccess} onScanFailure={() => { }} height={400} />
                    <Box textAlign="center" p={2}>
                        <Button onClick={() => setShowScanner(false)} variant="outlined" color="inherit">Đóng Camera</Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </Paper>
    );
};

export default InboundForm;
