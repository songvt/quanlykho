import React, { useState, useCallback } from 'react';
import {
    Box, Button, TextField, Autocomplete,
    Paper, Stack, Grid, MenuItem, CircularProgress
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { addOutboundTransaction, fetchTransactionsForce, importOutboundTransactions } from '../../store/slices/transactionsSlice';
import { selectProductStock, selectDetailedStock } from '../../store/slices/inventorySlice';
import { useNotification } from '../../contexts/NotificationContext';
import { parseSerialInput, filterNewSerials } from '../../utils/serialParser';
import { playBeep } from '../../utils/audio';
import { useScanDetection } from '../../hooks/useScanDetection';
import SerialChips from '../Common/SerialChips';
import QRScanner from '../QRScanner';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import StockDisplay from '../../pages/Outbound/StockDisplay';
import { sendTelegramNotification } from '../../pages/Outbound/outboundTelegram';

interface OutboundFormProps {
    onSuccess?: (newTransactions: any[]) => void;
}

const OutboundForm: React.FC<OutboundFormProps> = ({ onSuccess }) => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products } = useSelector((state: RootState) => state.products);
    const { items: employees } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const { success, error: notifyError } = useNotification();

    // Form state
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [serial, setSerial] = useState('');
    const [receiver, setReceiver] = useState(isAdmin ? '' : (profile?.full_name || ''));
    const [district, setDistrict] = useState(profile?.district || '');
    const [itemStatus, setItemStatus] = useState('Hàng mới');
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [showScanner, setShowScanner] = useState(false);

    const currentTotalStock = useSelector((state: RootState) => selectProductStock(state, selectedProduct));
    const currentDetailedStock = useSelector((state: RootState) => 
        selectDetailedStock(state, selectedProduct, district, itemStatus)
    );

    const handleScanSuccess = useCallback((decodedText: string) => {
        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        if (isSerialized) {
            const newCodes = parseSerialInput(decodedText);
            setScannedSerials(prev => {
                const uniqueNewCodes = filterNewSerials(newCodes, prev);
                if (uniqueNewCodes.length === 0) {
                    notifyError('Các serial này đã được thêm.');
                    return prev;
                }
                const newer = [...prev, ...uniqueNewCodes];
                setQuantity(newer.length);
                success(`Đã thêm ${uniqueNewCodes.length} serial`);
                return newer;
            });
            setShowScanner(false);
        } else {
            setSerial(decodedText);
            setShowScanner(false);
            success('Đã quét mã thành công!');
        }
    }, [selectedProduct, products, success, notifyError]);

    useScanDetection((code) => {
        playBeep();
        handleScanSuccess(code);
    });

    const handleManualAddSerial = () => {
        if (!serial.trim()) return;
        const newCodes = parseSerialInput(serial);
        if (newCodes.length === 0) return;
        setScannedSerials(prev => {
            const uniqueNewCodes = filterNewSerials(newCodes, prev);
            if (uniqueNewCodes.length === 0) {
                notifyError('Serial đã tồn tại.');
                return prev;
            }
            const newer = [...prev, ...uniqueNewCodes];
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

    const handleSave = async () => {
        if (!selectedProduct) return notifyError('Vui lòng chọn sản phẩm');
        if (!receiver) return notifyError('Vui lòng nhập người nhận');
        
        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';
        const serialList = isSerialized ? (scannedSerials.length > 0 ? scannedSerials : parseSerialInput(serial)) : [];
        const totalQuantity = isSerialized ? serialList.length : Number(quantity);

        if (isSerialized && serialList.length === 0) return notifyError('Vui lòng quét serial');
        
        if (totalQuantity > currentTotalStock) {
            if (!isAdmin) {
                return notifyError(`Vượt quá tổng tồn kho (${currentTotalStock})`);
            } else {
                // Admin can proceed but gets a warning
                success(`⚠️ Tổng tồn kho không đủ (Có: ${currentTotalStock}) — Đang xuất âm!`);
            }
        }
        
        if (isAdmin && district && totalQuantity > currentDetailedStock) {
             success(`⚠️ Kho "${district}" không đủ tồn (Có: ${currentDetailedStock}) — Đang xuất âm!`);
        }

        setIsSaving(true);
        try {
            const newTransactions: any[] = [];
            const price = product?.unit_price || 0;
            const productName = product?.name || selectedProduct;

            if (isSerialized) {
                const txPayloads = serialList.map(code => ({
                    product_id: selectedProduct, 
                    quantity: 1, 
                    serial_code: code,
                    group_name: receiver,
                    receiver_name: receiver,
                    receiver_group: receiver,
                    unit_price: price, 
                    district, 
                    item_status: itemStatus,
                    user_id: profile?.id,
                    created_by: profile?.full_name || profile?.username || profile?.email || 'system'
                }));
                
                // Sử dụng bulk thunk để tối ưu hiệu suất
                const res = await dispatch(importOutboundTransactions(txPayloads)).unwrap();
                const items = Array.isArray(res) ? res : [res];
                items.forEach(item => newTransactions.push({ ...item, product_name: productName }));
            } else {
                const res = await dispatch(addOutboundTransaction({
                    product_id: selectedProduct, quantity: totalQuantity,
                    group_name: receiver, 
                    receiver_name: receiver,
                    receiver_group: receiver,
                    unit_price: price, district, item_status: itemStatus,
                    user_id: profile?.id,
                    created_by: profile?.full_name || profile?.username || profile?.email || 'system'
                })).unwrap();
                newTransactions.push({ ...res, product_name: productName });
            }

            if (newTransactions.length > 0) {
                const productsMap: Record<string, string> = {};
                products.forEach(p => productsMap[p.id] = p.name);
                sendTelegramNotification('XUẤT KHO THÀNH CÔNG', newTransactions, productsMap, receiver);
                onSuccess?.(newTransactions);
                dispatch(fetchTransactionsForce()); // Refresh list
            }

            success('Xuất kho thành công!');
            setScannedSerials([]);
            setSerial('');
            setQuantity(1);
        } catch (err: any) {
            notifyError(err.message || 'Lỗi khi xuất kho');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                    <Box display="flex" gap={1}>
                        <Autocomplete
                            fullWidth options={products}
                            getOptionLabel={(option) => `${option.name} (${option.item_code})`}
                            value={products.find(p => p.id === selectedProduct) || null}
                            onChange={(_, nv) => { setSelectedProduct(nv?.id || ''); setScannedSerials([]); setQuantity(1); }}
                            renderInput={(params) => <TextField {...params} label="Chọn sản phẩm" size="small" />}
                        />
                    </Box>
                    {selectedProduct && <Box mt={1}><StockDisplay productId={selectedProduct} /></Box>}
                </Grid>

                <Grid size={{ xs: 12, md: 2 }}>
                    <TextField
                        fullWidth label="Số lượng" type="number" value={quantity}
                        onChange={e => setQuantity(Number(e.target.value))} size="small"
                        disabled={products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa'}
                    />
                </Grid>

                <Grid size={{ xs: 12, md: 4 }}>
                    <Autocomplete
                        fullWidth options={employees} freeSolo
                        getOptionLabel={(option: any) => typeof option === 'string' ? option : `${option.full_name} (${option.username || ''})`}
                        value={receiver}
                        onInputChange={(_, nv) => setReceiver(nv)}
                        onChange={(_, nv: any) => {
                            if (typeof nv === 'object' && nv) {
                                setReceiver(nv.full_name || '');
                                setDistrict(nv.district || '');
                            }
                        }}
                        renderInput={(params) => <TextField {...params} label="Người nhận" size="small" />}
                    />
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth select label="Kho xuất (Quận/Huyện)" value={district}
                        onChange={e => setDistrict(e.target.value)} size="small"
                    >
                        <MenuItem value=""><em>-- Toàn hệ thống --</em></MenuItem>
                        <MenuItem value="Q12">Q12</MenuItem>
                        <MenuItem value="HMN">HMN</MenuItem>
                        <MenuItem value="CCI">CCI</MenuItem>
                    </TextField>
                </Grid>

                <Grid size={{ xs: 12, md: 3 }}>
                    <TextField
                        fullWidth select label="Trạng thái hàng" value={itemStatus}
                        onChange={e => setItemStatus(e.target.value)} size="small"
                    >
                        <MenuItem value="Hàng mới">Hàng mới</MenuItem>
                        <MenuItem value="Hàng thu hồi">Hàng thu hồi</MenuItem>
                    </TextField>
                </Grid>

                {products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa' && (
                    <Grid size={{ xs: 12 }}>
                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                            <Stack direction="row" spacing={1} mb={1}>
                                <TextField
                                    fullWidth label="Serial Code" value={serial} onChange={e => setSerial(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleManualAddSerial()} size="small"
                                />
                                <Button variant="outlined" onClick={() => setShowScanner(true)}><QrCodeScannerIcon /></Button>
                            </Stack>
                            <SerialChips serials={scannedSerials} onRemove={handleRemoveSerial} />
                        </Paper>
                    </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                    <Box display="flex" justifyContent="flex-end">
                        <Button
                            variant="contained" size="large" onClick={handleSave} disabled={isSaving}
                            startIcon={isSaving && <CircularProgress size={20} />}
                        >
                            {isSaving ? 'Đang xử lý...' : 'Xác Nhận Xuất Kho'}
                        </Button>
                    </Box>
                </Grid>
            </Grid>

            <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', color: 'primary.main' }}>
                    QUÉT MÃ QR / SERIAL
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <QRScanner onScanSuccess={handleScanSuccess} onScanFailure={() => {}} height={400} />
                    <Box p={2} textAlign="center">
                        <Button variant="outlined" onClick={() => setShowScanner(false)}>Đóng Camera</Button>
                    </Box>
                </DialogContent>
            </Dialog>
        </Paper>
    );
};

export default OutboundForm;
