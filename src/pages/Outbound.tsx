import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { addOutboundTransaction } from '../store/slices/transactionsSlice';
import { fetchInventory, selectProductStock } from '../store/slices/inventorySlice';
import { fetchEmployees } from '../store/slices/employeesSlice';
import { fetchOrders, updateOrderStatus } from '../store/slices/ordersSlice';
import type { RootState, AppDispatch } from '../store';
import {
    Button, TextField, FormControl,
    Typography, Box, Alert, CircularProgress, Paper, Stack, FormHelperText, Dialog, DialogContent, DialogTitle, Autocomplete,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, DialogActions, List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import QRScanner from '../components/QRScanner';
import { readExcelFile, generateOutboundTemplate } from '../utils/excelUtils';
import { importOutboundTransactions } from '../store/slices/transactionsSlice';
import type { Order } from '../types';

export const Outbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const { items: orders, status: orderStatus } = useSelector((state: RootState) => state.orders);
    const { profile } = useSelector((state: RootState) => state.auth);
    const inventoryStatus = useSelector((state: RootState) => state.inventory.status);
    const isAdmin = profile?.role === 'admin';

    // Form state (Admin)
    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [serial, setSerial] = useState('');
    const [receiver, setReceiver] = useState(isAdmin ? '' : (profile?.full_name || profile?.username || profile?.email || ''));

    const [district, setDistrict] = useState(''); // Added District
    const [itemStatus, setItemStatus] = useState(''); // Added Item Status
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

    // Scanner state
    const [showScanner, setShowScanner] = useState(false);

    // Staff Fulfillment State
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [openFulfillDialog, setOpenFulfillDialog] = useState(false);
    const [scannedSerials, setScannedSerials] = useState<string[]>([]); // For multi-scan
    const [isProductVerified, setIsProductVerified] = useState(false); // For non-serialized

    // Get current stock (for Admin form or specific checks)
    const currentStock = useSelector((state: RootState) => selectProductStock(state, selectedProduct));


    useEffect(() => {
        if (status === 'idle') dispatch(fetchProducts());
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
        if (orderStatus === 'idle') dispatch(fetchOrders());
        if (isAdmin && employeeStatus === 'idle') dispatch(fetchEmployees());
    }, [status, inventoryStatus, employeeStatus, orderStatus, dispatch, isAdmin]);

    // Admin Direct Save
    const handleAdminSave = async () => {
        if (!selectedProduct) {
            setNotification({ type: 'error', message: 'Vui lòng chọn sản phẩm' });
            return;
        }
        if (!receiver) {
            setNotification({ type: 'error', message: 'Vui lòng nhập người/đơn vị nhận' });
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        let serialList: string[] = [];
        if (isSerialized) {
            // Priority: scannedSerials (multi-scan) > serial (manual text input)
            if (scannedSerials.length > 0) {
                serialList = [...scannedSerials];
            } else if (serial.trim()) {
                serialList = serial.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s !== '');
            }

            if (serialList.length === 0) {
                setNotification({ type: 'error', message: 'Vui lòng nhập hoặc quét số Serial cho Hàng hóa' });
                return;
            }
        }

        const totalQuantity = isSerialized ? serialList.length : Number(quantity);

        // Detailed Stock Check
        // If district is provided, we check against that specific stock.
        // Item Status is hidden but logic remains supported if we ever default it.
        // Note: If no district is entered, we might need to rely on total stock or allow it.
        // But the requirement implies strict check by district.
        // We use `currentDetailedStock` for validation

        // We use `currentDetailedStock` for validation
        // Detail Stock check removed as District is Destination
        // if (totalQuantity > currentDetailedStock) { ... }

        // Basic sanity check against total stock (redundant but safe)
        // Basic sanity check against total stock
        // Update: Admins can bypass this check to allow negative stock
        if (!isAdmin && totalQuantity > currentStock) {
            setNotification({ type: 'error', message: `Số lượng xuất (${totalQuantity}) vượt quá tổng tồn kho (${currentStock})` });
            return;
        }

        // For non-serialized, ensure quantity is valid
        if (!isSerialized && totalQuantity <= 0) {
            setNotification({ type: 'error', message: 'Số lượng phải lớn hơn 0' });
            return;
        }

        try {
            await executeOutbound(selectedProduct, totalQuantity, serialList, receiver, product?.unit_price || 0, isSerialized, district, itemStatus);

            // Reset form
            setSerial('');
            setScannedSerials([]); // Reset scanned list
            setQuantity(1);
            if (isAdmin) setReceiver('');
            setDistrict(''); // Reset district
            setItemStatus('');
            setNotification({ type: 'success', message: 'Xuất kho thành công!' });
        } catch (err: any) {
            setNotification({ type: 'error', message: err.message || 'Có lỗi xảy ra' });
        }
    };

    // We need store access for validation logic inside handleAdminSave? 
    // Actually currentDetailedStock is from selector, so we can use it directly in handleAdminSave scope.
    // But we need to make sure we imported `store` to use `selectDetailedStock(store.getState()...)` if we want fresh state, 
    // or rely on component re-render. Relying on `currentDetailedStock` variable is safer in React logic IF dependencies are correct.
    // The `handleAdminSave` function closes over `currentDetailedStock`.
    // Let's add `import { store } from '../store';` to the top imports block if not there to be super safe? 
    // No, standard react `useSelector` value is fine.

    // Shared Outbound Logic
    const executeOutbound = async (prodId: string, qty: number, serials: string[], receiverName: string, price: number, isSerialized: boolean, districtVal?: string, itemStatusVal?: string) => {
        if (isSerialized && serials.length > 0) {
            // Create one transaction per serial
            for (const code of serials) {
                await dispatch(addOutboundTransaction({
                    product_id: prodId,
                    quantity: 1,
                    serial_code: code,
                    group_name: receiverName,
                    unit_price: price,
                    district: districtVal,
                    item_status: itemStatusVal, // Added item_status
                    user_id: profile?.id
                })).unwrap();
            }
        } else {
            // Non-serialized
            await dispatch(addOutboundTransaction({
                product_id: prodId,
                quantity: qty,
                serial_code: undefined,
                group_name: receiverName,
                unit_price: price,
                district: districtVal,
                item_status: itemStatusVal, // Added item_status
                user_id: profile?.id
            })).unwrap();
        }
        dispatch(fetchInventory());
        dispatch(fetchOrders()); // Update orders if any affected
    };

    const handleScanSuccess = (decodedText: string) => {
        // If in fulfillment dialog (Staff)
        if (openFulfillDialog && selectedOrder) {
            const product = products.find(p => p.id === selectedOrder.product_id);
            const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

            if (isSerialized) {
                if (scannedSerials.includes(decodedText)) return;
                if (scannedSerials.length >= selectedOrder.quantity) {
                    setShowScanner(false);
                    return;
                }
                setScannedSerials(prev => [...prev, decodedText]);
                if (scannedSerials.length + 1 >= selectedOrder.quantity) {
                    setShowScanner(false);
                    setNotification({ type: 'success', message: 'Đã quét đủ số lượng serial theo đơn hàng!' });
                }
            } else {
                if (decodedText === product?.item_code || decodedText === product?.id) {
                    setIsProductVerified(true);
                    setShowScanner(false);
                    setNotification({ type: 'success', message: 'Đã xác thực sản phẩm!' });
                }
            }
        } else if (isAdmin) {
            // Admin Direct Form
            // If a product is selected, check if it is Serialized
            const product = products.find(p => p.id === selectedProduct);
            const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

            if (isSerialized) {
                // allow continuous scanning
                if (!scannedSerials.includes(decodedText)) {
                    setScannedSerials(prev => {
                        const newer = [...prev, decodedText];
                        // Auto update quantity field to match scan count
                        setQuantity(newer.length);
                        return newer;
                    });
                    setNotification({ type: 'success', message: `Đã thêm: ${decodedText}` });
                    // Do NOT close scanner
                } else {
                    setNotification({ type: 'error', message: `Đã quét rồi: ${decodedText}` });
                }
            } else {
                // Non-serialized or no product selected yet -> just fill the text field?
                // Or if no product selected, maybe we try to find product by code?
                // Current logic: simple fill
                setSerial(decodedText);
                setShowScanner(false);
                setNotification({ type: 'success', message: 'Đã quét mã thành công!' });
            }
        }
    };

    // Staff Fulfillment Logic
    const handleOpenFulfill = (order: Order) => {
        setSelectedOrder(order);
        setSerial(''); // Reset manual input
        setScannedSerials([]);
        setIsProductVerified(false);
        setOpenFulfillDialog(true);
    };

    const handleManualAddSerial = () => {
        if (!serial.trim()) return;
        if (scannedSerials.includes(serial.trim())) {
            alert('Serial này đã được thêm.');
            return;
        }

        // Check limit only for Fulfillment
        if (openFulfillDialog && selectedOrder && scannedSerials.length >= selectedOrder.quantity) {
            alert('Đã đủ số lượng serial.');
            return;
        }

        setScannedSerials(prev => {
            const newer = [...prev, serial.trim()];
            if (!openFulfillDialog) setQuantity(newer.length); // Admin mode update qty
            return newer;
        });
        setSerial('');
    };

    const handleRemoveSerial = (code: string) => {
        setScannedSerials(prev => {
            const newer = prev.filter(s => s !== code);
            if (!openFulfillDialog) setQuantity(newer.length > 0 ? newer.length : 1);
            return newer;
        });
    };

    // Correct way to get stock for the fulfill dialog
    const fulfillmentStock = useSelector((state: RootState) => selectedOrder ? selectProductStock(state, selectedOrder.product_id) : 0);

    const handleFulfillOrder = async () => {
        if (!selectedOrder) return;
        const product = products.find(p => p.id === selectedOrder.product_id);
        if (!product) return;

        const isSerialized = product.category?.toLowerCase() === 'hàng hóa';

        if (selectedOrder.quantity > fulfillmentStock) {
            alert(`Tồn kho không đủ! Yêu cầu: ${selectedOrder.quantity}, Tồn: ${fulfillmentStock}`);
            return;
        }

        // Validate Serial count
        if (isSerialized) {
            if (scannedSerials.length !== selectedOrder.quantity) {
                if (!window.confirm(`Bạn mới quét ${scannedSerials.length}/${selectedOrder.quantity} serial. Bạn có muốn hoàn thành với số lượng này không? (Lưu ý: Logic hiện tại yêu cầu đủ số lượng)`)) {
                    return;
                }
                // Currently enforce full fulfillment based on user request "scan max 4 times" -> implies aiming for 4.
                // If we want partial, we'd need to update order quantity or split order. 
                // For now, let's strictly require matching count for simplicity unless user insists otherwise.
                alert(`Vui lòng quét đủ ${selectedOrder.quantity} serial.`);
                return;
            }
        } else {
            // Non-serialized: Maybe require verification?
            // "Vật tư thì chỉ cần quét 1 lần" -> We can assume verification is implicit if they hit 'Confirm',
            // or we can enforce isProductVerified. Let's not be too strict unless requested.
        }

        try {
            await executeOutbound(
                selectedOrder.product_id,
                selectedOrder.quantity,
                scannedSerials, // Pass the array 
                selectedOrder.requester_group,
                product.unit_price || 0,
                isSerialized,
                undefined, // District undefined for fulfillment for now
                undefined // Item Status undefined for fulfillment for now
            );

            // Update Order Status
            await dispatch(updateOrderStatus({ id: selectedOrder.id, status: 'completed' })).unwrap();

            setOpenFulfillDialog(false);
            setNotification({ type: 'success', message: 'Đã xuất kho và hoàn tất đơn hàng!' });
            setSelectedOrder(null);
            dispatch(fetchOrders()); // Refresh list
        } catch (err: any) {
            setNotification({ type: 'error', message: err.message || 'Lỗi khi xuất kho' });
        }
    };

    if (status === 'loading' || inventoryStatus === 'loading') return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    // ----------------------
    // STAFF VIEW: APPROVED ORDERS
    // ----------------------
    if (!isAdmin) {
        const staffName = profile?.full_name || profile?.username || '';
        const myApprovedOrders = orders.filter(o =>
            o.status === 'approved' &&
            o.requester_group === staffName
        );

        return (
            <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100vw', overflowX: 'hidden' }}>
                <Box mb={{ xs: 2, sm: 4 }} textAlign="center">
                    <Typography variant="h3" fontWeight="bold" color="text.primary" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}>Xuất Kho (Đơn Hàng)</Typography>
                    <Typography variant="h6" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}>Danh sách các đơn hàng đã được duyệt chờ xuất kho</Typography>
                </Box>

                {notification && (
                    <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 3, maxWidth: 800, mx: 'auto' }}>
                        {notification.message}
                    </Alert>
                )}

                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 1200, mx: 'auto', borderRadius: 3 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                            <TableRow>
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Ngày đặt</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Sản phẩm</TableCell>
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>SL Yêu cầu</TableCell>
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Trạng thái</TableCell>
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {myApprovedOrders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                        Không có đơn hàng nào chờ xuất kho.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                myApprovedOrders.map(order => {
                                    const product = products.find(p => p.id === order.product_id);
                                    return (
                                        <TableRow key={order.id} hover>
                                            <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{new Date(order.order_date).toLocaleDateString('vi-VN')}</TableCell>
                                            <TableCell>
                                                <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{product?.name || 'Unknown'}</Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>{product?.item_code}</Typography>
                                            </TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{order.quantity}</TableCell>
                                            <TableCell align="center">
                                                <Chip label="Đã duyệt" color="success" size="small" icon={<CheckCircleIcon />} sx={{ height: 24, fontSize: '0.75rem' }} />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    variant="contained"
                                                    color="secondary"
                                                    size="small"
                                                    onClick={() => handleOpenFulfill(order)}
                                                    sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, minWidth: 64 }}
                                                >
                                                    Xuất kho
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Fulfillment Dialog */}
                <Dialog open={openFulfillDialog} onClose={() => setOpenFulfillDialog(false)} fullWidth maxWidth="sm">
                    <DialogTitle>Xác nhận Xuất Kho</DialogTitle>
                    <DialogContent>
                        {selectedOrder && (
                            <Stack spacing={3} sx={{ mt: 1 }}>
                                <Alert severity="info" icon={<CheckCircleIcon />}>
                                    Đang xuất kho cho đơn hàng: <b>{selectedOrder.quantity} {products.find(p => p.id === selectedOrder.product_id)?.name}</b>
                                </Alert>

                                {products.find(p => p.id === selectedOrder.product_id)?.category?.toLowerCase() === 'hàng hóa' ? (
                                    <Box>
                                        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                                            <TextField
                                                fullWidth
                                                label="Nhập Serial"
                                                value={serial}
                                                onChange={e => setSerial(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleManualAddSerial();
                                                    }
                                                }}
                                                placeholder="Quét mã hoặc nhập tay rồi Enter"
                                                helperText={`Đã quét: ${scannedSerials.length} / ${selectedOrder.quantity}`}
                                            />
                                            <IconButton onClick={() => setShowScanner(true)} color="secondary" sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}>
                                                <QrCodeScannerIcon fontSize="large" />
                                            </IconButton>
                                        </Stack>

                                        {/* List of scanned serials */}
                                        <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50' }}>
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
                                                {scannedSerials.length === 0 && (
                                                    <Typography variant="body2" color="text.secondary" p={2} textAlign="center">Chưa có serial nào được quét.</Typography>
                                                )}
                                            </List>
                                        </Paper>
                                    </Box>
                                ) : (
                                    // Non-serialized: Verification Mode
                                    <Box textAlign="center" py={2}>
                                        <Typography gutterBottom>Sản phẩm này không yêu cầu Serial.</Typography>
                                        {isProductVerified ? (
                                            <Alert severity="success">Đã xác thực đúng sản phẩm!</Alert>
                                        ) : (
                                            <Button
                                                variant="outlined"
                                                startIcon={<QrCodeScannerIcon />}
                                                onClick={() => setShowScanner(true)}
                                            >
                                                Quét mã sản phẩm để xác thực (Tùy chọn)
                                            </Button>
                                        )}
                                    </Box>
                                )}
                            </Stack>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenFulfillDialog(false)}>Hủy</Button>
                        <Button
                            onClick={handleFulfillOrder}
                            variant="contained"
                            color="secondary"
                            disabled={!selectedOrder || fulfillmentStock < selectedOrder.quantity || (
                                products.find(p => p.id === selectedOrder.product_id)?.category?.toLowerCase() === 'hàng hóa' && scannedSerials.length !== selectedOrder.quantity
                            )}
                        >
                            Hoàn tất Xuất Kho
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Shared Scanner Dialog */}
                <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Quét Mã QR/Mã Vạch</DialogTitle>
                    <DialogContent>
                        <QRScanner
                            onScanSuccess={handleScanSuccess}
                            onScanFailure={(err) => console.log(err)}
                        />
                        <Box textAlign="center" mt={3}>
                            <Button onClick={() => setShowScanner(false)} color="inherit">Đóng</Button>
                        </Box>
                    </DialogContent>
                </Dialog>
            </Box>
        );
    }

    // ----------------------
    // ADMIN VIEW: DIRECT FORM
    // ----------------------
    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: 1000, mx: 'auto', zoom: { xs: 0.85, md: 1 } }}>
            <Box mb={{ xs: 3, md: 5 }} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h3" fontWeight="900" gutterBottom sx={{
                    fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(45deg, #d32f2f 30%, #ff5252 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '1px'
                }}>
                    XUẤT HÀNG HÓA (ADMIN)
                </Typography>
                <Typography variant="h6" color="text.secondary" fontWeight="normal" sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}>Tạo phiếu xuất kho trực tiếp</Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={2} mb={3}>
                <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={generateOutboundTemplate} size="small" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
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
                                    const mappedData = json.map((row: any) => {
                                        const product = products.find(p => p.item_code === row['MA_HANG']);
                                        if (!product) throw new Error(`Không tìm thấy sản phẩm có mã: ${row['MA_HANG']}`);
                                        if (product?.category?.toLowerCase() === 'hàng hóa' && !row['SERIAL']) {
                                            throw new Error(`Sản phẩm ${row['MA_HANG']} (${product.name}) là Hàng hóa nên bắt buộc phải có Serial.`);
                                        }
                                        let groupName = row['EMAIL_NGUOI_NHAN'] || row['GHI_CHU'] || 'Unknown';
                                        return {
                                            product_id: product.id,
                                            quantity: Number(row['SO_LUONG'] || 0),
                                            receiver_group: groupName,
                                            serial_code: row['SERIAL'] ? String(row['SERIAL']) : undefined,
                                            district: row['QUAN_HUYEN'] ? String(row['QUAN_HUYEN']) : undefined, // Added district
                                            item_status: row['TRANG_THAI_HANG'] ? String(row['TRANG_THAI_HANG']) : undefined, // Added item_status
                                            unit_price: product.unit_price || 0
                                        };
                                    });

                                    if (mappedData.length > 0) {
                                        await dispatch(importOutboundTransactions(mappedData)).unwrap();
                                        dispatch(fetchInventory());
                                        alert(`Đã xuất thành công ${mappedData.length} giao dịch!`);
                                        setNotification({ type: 'success', message: `Đã xuất ${mappedData.length} giao dịch từ Excel!` });
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

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 4, md: 6 }, borderRadius: { xs: 2, sm: 5 }, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                {notification && (
                    <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 3, borderRadius: 2 }}>
                        {notification.message}
                    </Alert>
                )}

                <Stack spacing={4}>
                    <FormControl fullWidth error={quantity > currentStock} size="small">
                        <Autocomplete
                            options={products}
                            getOptionLabel={(option) => `${option.name} - ${option.item_code}`}
                            value={products.find(p => p.id === selectedProduct) || null}
                            onChange={(_, newValue) => {
                                setSelectedProduct(newValue ? newValue.id : '');
                                setScannedSerials([]); // Clear scans on product change
                                setSerial('');
                                setQuantity(1);
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Tên vật tư hàng hóa"
                                    placeholder="Tìm kiếm vật tư..."
                                    error={quantity > currentStock}
                                    size="small"
                                />
                            )}
                            PaperComponent={({ children }) => (
                                <Paper elevation={8} sx={{ borderRadius: 2 }}>{children}</Paper>
                            )}
                        />
                        {selectedProduct && (
                            <FormHelperText sx={{ display: 'flex', alignItems: 'center', mt: 1, fontSize: '0.9rem' }}>
                                <Box component="span" sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: currentStock > 0 ? 'success.main' : 'error.main', mr: 1 }} />
                                Tồn kho: <Box component="span" fontWeight="bold" ml={0.5}>{currentStock}</Box>
                            </FormHelperText>
                        )}
                    </FormControl>

                    <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={{ xs: 2, md: 4 }}>
                        <TextField
                            fullWidth
                            label="Số lượng xuất"
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                            error={quantity > currentStock}
                            InputProps={{ sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                            InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                            size="small"
                        />

                        {isAdmin ? (
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => (typeof option === 'string' ? option : option.full_name)}
                                value={employees.find(e => e.full_name === receiver) || null}
                                onChange={(_, newValue) => {
                                    if (newValue) {
                                        const val = typeof newValue === 'string' ? newValue : newValue.full_name;
                                        setReceiver(val);
                                        // Auto-fill District
                                        if (typeof newValue !== 'string' && newValue.district) {
                                            setDistrict(newValue.district);
                                        }
                                    } else {
                                        setReceiver('');
                                        setDistrict('');
                                    }
                                }}
                                freeSolo
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Nhân viên nhận hàng"
                                        placeholder="Tìm kiếm nhân viên..."
                                        InputLabelProps={{ style: { fontSize: '0.9rem' } }}
                                        onChange={(e) => setReceiver(e.target.value)}
                                        size="small"
                                    />
                                )}
                                PaperComponent={({ children }) => (
                                    <Paper elevation={8} sx={{ borderRadius: 2 }}>{children}</Paper>
                                )}
                            />
                        ) : (
                            <TextField
                                fullWidth
                                label="Nhân viên nhận hàng"
                                value={receiver}
                                InputProps={{ readOnly: true, sx: { borderRadius: 2, height: { xs: 40, sm: 56 }, fontSize: { xs: '0.875rem', md: '1rem' } } }}
                                InputLabelProps={{ sx: { fontSize: { xs: '0.875rem', md: '1rem' }, top: { xs: -5, sm: 0 } } }}
                                disabled
                                size="small"
                            />
                        )}
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

                    {/* Item Status Hidden as requested */}
                    {/* <TextField
                        fullWidth
                        label="Trạng thái hàng"
                        value={itemStatus}
                        onChange={e => setItemStatus(e.target.value)}
                         // ... props
                    /> */}

                    {/* Serial Input Section for Admin */}
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
                                    color="secondary"
                                    onClick={() => setShowScanner(true)}
                                    startIcon={<QrCodeScannerIcon />}
                                    sx={{ height: { xs: 40, sm: 56 }, px: { xs: 2, md: 3 }, borderRadius: 2, whiteSpace: 'nowrap', fontSize: { xs: '0.875rem', md: '1rem' }, width: { xs: '100%', sm: 'auto' } }}
                                >
                                    Quét QR
                                </Button>
                            </Stack>

                            {/* List of scanned serials for Admin */}
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
                                setScannedSerials([]);
                                if (isAdmin) setReceiver('');
                                setDistrict('');
                                setItemStatus('');
                            }}
                            sx={{ py: { xs: 1.5, sm: 2 }, borderRadius: 3, fontSize: { xs: '0.9rem', sm: '1.1rem' }, fontWeight: 700, textTransform: 'none' }}
                        >
                            Hủy
                        </Button>
                        <Button
                            variant="contained"
                            color="secondary"
                            size="large"
                            fullWidth
                            onClick={handleAdminSave}
                            disabled={(status as string) === 'loading'}
                            sx={{ py: { xs: 1.5, sm: 2 }, borderRadius: 3, fontSize: { xs: '0.9rem', sm: '1.1rem' }, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                        >
                            Xuất Kho
                        </Button>
                    </Stack>
                </Stack>

                <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, m: 2 } }}>
                    <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main', textAlign: 'center' }}>
                        QUÉT MÃ QR/MÃ VẠCH
                    </DialogTitle>
                    <DialogContent>
                        <QRScanner
                            onScanSuccess={handleScanSuccess}
                            onScanFailure={(err) => console.log(err)}
                        />
                        <Box textAlign="center" mt={3}>
                            <Button onClick={() => setShowScanner(false)} color="inherit">Đóng</Button>
                        </Box>
                    </DialogContent>
                </Dialog>
            </Paper>
        </Box>
    );
}
