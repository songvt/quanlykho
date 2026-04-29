import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { addOutboundTransaction, fetchTransactions } from '../store/slices/transactionsSlice';
import { fetchInventory, selectProductStock } from '../store/slices/inventorySlice';
import { fetchEmployees } from '../store/slices/employeesSlice';
import { fetchOrders, updateOrderStatus } from '../store/slices/ordersSlice';
import type { RootState, AppDispatch } from '../store';
import {
    Button, Typography, Box, CircularProgress, Stack, Dialog, DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import type { Order } from '../types';
import { useNotification } from '../contexts/NotificationContext';
import PrintIcon from '@mui/icons-material/Print';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import OutboundReportPreview from '../components/Reports/OutboundReportPreview';
import FulfillOrderDialog from './Outbound/FulfillOrderDialog';
import StaffOutboundView from './Outbound/StaffOutboundView';
import OutboundForm from '../components/Outbound/OutboundForm';
import OutboundList from '../components/Outbound/OutboundList';
import ApprovedOrdersList from '../components/Outbound/ApprovedOrdersList';
import QRScanner from '../components/QRScanner';

export const Outbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { items: orders } = useSelector((state: RootState) => state.orders);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: transactions } = useSelector((state: RootState) => state.transactions);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

    const { success, error: notifyError } = useNotification();
    const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>([]);
    const [openPrintPreview, setOpenPrintPreview] = useState(false);
    const [resolvedDelivererName, setResolvedDelivererName] = useState('');

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [openFulfillDialog, setOpenFulfillDialog] = useState(false);
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [serialInput, setSerialInput] = useState('');
    const [isProductVerified, setIsProductVerified] = useState(false);
    const fulfillmentStock = useSelector((state: RootState) => selectProductStock(state, selectedOrder?.product_id || ''));

    useEffect(() => {
        if (status === 'idle') dispatch(fetchProducts());
        dispatch(fetchInventory());
        dispatch(fetchOrders());
        dispatch(fetchTransactions());
        if (isAdmin) dispatch(fetchEmployees());
    }, [status, dispatch, isAdmin]);

    const handleOpenFulfill = (order: Order) => {
        setSelectedOrder(order);
        setScannedSerials([]);
        setSerialInput('');
        setIsProductVerified(false);
        setOpenFulfillDialog(true);
    };

    const handleManualAddSerial = () => {
        if (!serialInput.trim()) return;
        const newSerials = serialInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        setScannedSerials(prev => {
            const unique = newSerials.filter(s => !prev.includes(s));
            return [...prev, ...unique];
        });
        setSerialInput('');
    };

    const handleFulfillOrder = async () => {
        if (!selectedOrder) return;
        try {
            // Thực hiện xuất kho trước
            const product = products.find(p => p.id === selectedOrder.product_id);
            const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';
            const price = product?.unit_price || 0;
            
            if (isSerialized) {
                for (const code of scannedSerials) {
                    await dispatch(addOutboundTransaction({
                        product_id: selectedOrder.product_id,
                        quantity: 1,
                        serial_code: code,
                        group_name: selectedOrder.requester_group,
                        receiver_name: selectedOrder.requester_name || selectedOrder.requester_group,
                        receiver_group: selectedOrder.requester_group,
                        unit_price: price,
                        district: 'Q12',
                        item_status: 'Hàng mới',
                        user_id: profile?.id,
                        created_by: profile?.full_name || profile?.username || profile?.email || 'system'
                    })).unwrap();
                }
            } else {
                await dispatch(addOutboundTransaction({
                    product_id: selectedOrder.product_id,
                    quantity: selectedOrder.quantity,
                    group_name: selectedOrder.requester_group,
                    receiver_name: selectedOrder.requester_name || selectedOrder.requester_group,
                    receiver_group: selectedOrder.requester_group,
                    unit_price: price,
                    district: 'Q12',
                    item_status: 'Hàng mới',
                    user_id: profile?.id,
                    created_by: profile?.full_name || profile?.username || profile?.email || 'system'
                })).unwrap();
            }

            // Cập nhật trạng thái đơn hàng
            await dispatch(updateOrderStatus({ id: selectedOrder.id, status: 'completed' })).unwrap();
            
            setOpenFulfillDialog(false);
            success('Đã hoàn tất xuất kho và cập nhật đơn hàng!');
            setSelectedOrder(null);
            dispatch(fetchInventory());
            dispatch(fetchTransactions());
        } catch (err: any) { notifyError(err.message); }
    };

    if (status === 'loading') return <Box display="flex" justifyContent="center" p={8}><CircularProgress /></Box>;

    if (!isAdmin) {
        const staffName = profile?.full_name || '';
        const myApproved = orders.filter(o => o.status === 'approved' && o.requester_group === staffName);
        const myCompleted = orders.filter(o => o.status === 'completed' && o.requester_group === staffName);
        return <StaffOutboundView approvedOrders={myApproved} completedOrders={myCompleted} products={products} onFulfill={handleOpenFulfill} />;
    }

    const allApprovedOrders = orders.filter(o => o.status === 'approved');

    const [showScanner, setShowScanner] = useState(false);

    const handleScanSuccess = (decodedText: string) => {
        const newSerials = decodedText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
        setScannedSerials(prev => {
            const unique = newSerials.filter(s => !prev.includes(s));
            return [...prev, ...unique];
        });
        setShowScanner(false);
        success(`Đã quét thành công: ${decodedText}`);
    };

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: 1200, mx: 'auto' }}>
            <ApprovedOrdersList orders={allApprovedOrders} products={products} onFulfill={handleOpenFulfill} />

            <Box mb={{ xs: 3, md: 5 }} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4" component="h1" sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                    mb: 1
                }}>
                    XUẤT HÀNG HÓA
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b', textAlign: 'center', fontWeight: 500 }}>
                    Quản lý phiếu xuất kho, cấp phát thiết bị và in ấn biên bản bàn giao
                </Typography>
            </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={2} mb={4}>
                    <Button
                        variant="contained" color="secondary" startIcon={<PrintIcon />}
                        disabled={selectedPrintIds.length === 0}
                        onClick={() => {
                            setOpenPrintPreview(true);
                            setResolvedDelivererName(profile?.full_name || 'Admin');
                        }}
                    >
                        In Biên Bản ({selectedPrintIds.length})
                    </Button>
                    <Button variant="contained" component="label" startIcon={<UploadFileIcon />} size="small">
                        Nhập Excel
                        <input type="file" hidden accept=".xlsx, .xls" onChange={async () => {
                            // ... existing excel logic
                        }} />
                    </Button>
                </Stack>
            
            <OutboundForm />

            <OutboundList 
                transactions={transactions.filter(t => t.type === 'outbound')}
                selectedIds={selectedPrintIds}
                onSelectChange={setSelectedPrintIds}
            />

            {/* Dialogs */}
            <FulfillOrderDialog
                open={openFulfillDialog}
                order={selectedOrder}
                products={products}
                scannedSerials={scannedSerials}
                serial={serialInput}
                isProductVerified={isProductVerified}
                fulfillmentStock={fulfillmentStock}
                onClose={() => setOpenFulfillDialog(false)}
                onConfirm={handleFulfillOrder}
                onSerialChange={setSerialInput}
                onManualAddSerial={handleManualAddSerial}
                onRemoveSerial={(code) => setScannedSerials(prev => prev.filter(s => s !== code))}
                onOpenScanner={() => setShowScanner(true)}
            />

            <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', color: 'primary.main' }}>
                    QUÉT MÃ SERIAL
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <QRScanner onScanSuccess={handleScanSuccess} onScanFailure={() => {}} height={400} />
                    <Box p={2} textAlign="center">
                        <Button onClick={() => setShowScanner(false)} variant="outlined">Đóng Camera</Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <Dialog open={openPrintPreview} onClose={() => setOpenPrintPreview(false)} maxWidth="lg" fullWidth>
                <DialogTitle>Xem trước biên bản xuất kho</DialogTitle>
                <DialogContent>
                    <OutboundReportPreview
                        data={transactions
                            .filter(t => selectedPrintIds.includes(t.id))
                            .map(t => ({
                                product_name: t.product_name || t.product?.name || 'N/A',
                                unit: t.product?.unit || 'Cái',
                                quantity: t.quantity,
                                unit_price: t.unit_price,
                                serial_code: t.serial_code || '-'
                            }))
                        }
                        delivererName={resolvedDelivererName}
                        date={new Date().toISOString()}
                        receiverName={(() => {
                            const first = transactions.find(t => selectedPrintIds.includes(t.id));
                            return first?.receiver_name || first?.full_name || first?.group_name || first?.receiver_group || (first as any)?.receiver || 'Khách hàng';
                        })()}
                        reportNumber={1}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPrintPreview(false)}>Đóng</Button>
                    <Button variant="contained" color="primary" onClick={() => window.print()}>In Biên Bản</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
