import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { addOutboundTransaction, fetchTransactions, importOutboundTransactions } from '../store/slices/transactionsSlice';
import { fetchInventory, selectProductStock, selectDetailedStock } from '../store/slices/inventorySlice';
import { fetchEmployees } from '../store/slices/employeesSlice';
import { fetchOrders, updateOrderStatus } from '../store/slices/ordersSlice';
import type { RootState, AppDispatch } from '../store';
import {
    Button, TextField, Checkbox, Chip,
    Typography, Box, Paper, Stack, Dialog, DialogContent, DialogTitle, Autocomplete,
    IconButton, CircularProgress, InputAdornment,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Grid, MenuItem,
    Card, CardContent, Divider, useMediaQuery, useTheme
} from '@mui/material';
import type { Order } from '../types';
import SerialChips from '../components/Common/SerialChips';
import { useNotification } from '../contexts/NotificationContext';
import PrintIcon from '@mui/icons-material/Print';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import QRScanner from '../components/QRScanner';
import { readExcelFile, generateOutboundTemplate } from '../utils/excelUtils';
import { parseSerialInput, filterNewSerials } from '../utils/serialParser';
import { useScanDetection } from '../hooks/useScanDetection';
import { playBeep } from '../utils/audio';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import VoiceSearchButton from '../components/VoiceSearchButton';

import ProductSearchDialog from '../components/ProductSearchDialog';
import OutboundReportPreview from '../components/Reports/OutboundReportPreview';
import SearchIcon from '@mui/icons-material/Search';
import { GoogleSheetService as SupabaseService } from '../services/GoogleSheetService';
import { matchDistrict } from '../utils/format';
import StockDisplay from './Outbound/StockDisplay';
import { sendTelegramNotification } from './Outbound/outboundTelegram';
import FulfillOrderDialog from './Outbound/FulfillOrderDialog';
import StaffOutboundView from './Outbound/StaffOutboundView';



export const Outbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const { items: orders, status: orderStatus } = useSelector((state: RootState) => state.orders);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const { items: allTransactions } = useSelector((state: RootState) => state.transactions);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [selectedProduct, setSelectedProduct] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [serial, setSerial] = useState('');
    const [receiver, setReceiver] = useState(isAdmin ? '' : (profile?.full_name || profile?.username || profile?.email || ''));

    const [district, setDistrict] = useState(profile?.district || '');
    const [itemStatus, setItemStatus] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const { success, error: notifyError } = useNotification();

    const [showScanner, setShowScanner] = useState(false);
    const [showProductSearch, setShowProductSearch] = useState(false);

    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [selectedPrintIds, setSelectedPrintIds] = useState<string[]>([]);
    const [openPrintPreview, setOpenPrintPreview] = useState(false);
    const [reportNumber, setReportNumber] = useState(1);
    const [resolvedDelivererName, setResolvedDelivererName] = useState('');
    const [isUploadingDrive, setIsUploadingDrive] = useState(false);

    const [outboundSearch, setOutboundSearch] = useState('');
    const [outboundPage, setOutboundPage] = useState(0);
    const [outboundRowsPerPage, setOutboundRowsPerPage] = useState(10);

    const handleUploadDrive = async () => {
        const element = document.getElementById('outbound-report-content');
        if (!element) return;
        setIsUploadingDrive(true);
        try {
            const canvas = await html2canvas(element, { scale: 2, useCORS: true });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const pdfBlob = pdf.output('blob');
            
            const dateObj = new Date();
            const dateStr = `${String(dateObj.getDate()).padStart(2, '0')}${String(dateObj.getMonth() + 1).padStart(2, '0')}${dateObj.getFullYear()}`;
            const receiverNameStr = Array.from(new Set(recentTransactions.filter(t => selectedPrintIds.includes(t.id)).map(t => t.group_name || t.receiver_group))).join('_');
            const fileName = `BBXK_${receiverNameStr}_${dateStr}.pdf`;

            const reader = new FileReader();
            reader.readAsDataURL(pdfBlob);
            reader.onloadend = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                try {
                    const response = await fetch('/api/drive_upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileName,
                            mimeType: 'application/pdf',
                            fileData: base64Data
                        })
                    });

                    const result = await response.json();
                    if (response.ok) {
                        success(`Lưu Drive thành công: ${fileName}`);
                    } else {
                        const errorMessage = result.details || result.error || 'Server error';
                        notifyError(`Lỗi lưu Drive: ${errorMessage}`);
                    }
                } catch (error: any) {
                    console.error('Drive upload failed', error);
                    notifyError(`Lỗi lưu Drive: ${error.message || 'Mất kết nối server'}`);
                } finally {
                    setIsUploadingDrive(false);
                }
            };
            
        } catch (error: any) {
            console.error('PDF creation failed', error);
            notifyError(`Lỗi xử lý PDF: ${error.message}`);
            setIsUploadingDrive(false);
        }
    };

    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [openFulfillDialog, setOpenFulfillDialog] = useState(false);
    const [scannedSerials, setScannedSerials] = useState<string[]>([]);
    const [isProductVerified, setIsProductVerified] = useState(false);

    const currentTotalStock = useSelector((state: RootState) => selectProductStock(state, selectedProduct));

    const currentDetailedStock = useSelector((state: RootState) =>
        selectDetailedStock(state, selectedProduct, district, itemStatus)
    );

    useEffect(() => {
        if (status === 'idle') dispatch(fetchProducts());
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
        if (orderStatus === 'idle') dispatch(fetchOrders());
        if (isAdmin && employeeStatus === 'idle') dispatch(fetchEmployees());
        dispatch(fetchTransactions());

        // District configs logic removed as it was producing unused variables. 
        // Logic for loading storekeepers should be re-added only if used.
    }, [status, inventoryStatus, employeeStatus, orderStatus, dispatch, isAdmin]);

    useScanDetection((code) => {
        playBeep();
        handleScanSuccess(code);
    });

    const handleAdminSave = async () => {
        if (!selectedProduct) {
            notifyError('Vui lòng chọn sản phẩm');
            return;
        }
        if (!receiver) {
            notifyError('Vui lòng nhập người/đơn vị nhận');
            return;
        }

        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        let serialList: string[] = [];
        if (isSerialized) {
            if (scannedSerials.length > 0) {
                serialList = [...scannedSerials];
            } else if (serial.trim()) {
                serialList = parseSerialInput(serial);
            }

            if (serialList.length === 0) {
                notifyError('Vui lòng nhập hoặc quét số Serial cho Hàng hóa');
                return;
            }
        }

        const totalQuantity = isSerialized ? serialList.length : Number(quantity);

        if (!isAdmin) {
            if (totalQuantity > currentTotalStock) {
                notifyError(`Số lượng xuất (${totalQuantity}) vượt quá tổng tồn kho (${currentTotalStock})`);
                return;
            }
        } else {
            if (district && totalQuantity > currentDetailedStock) {
                notifyError(`⚠️ Kho "${district}" không đủ tồn (Có: ${currentDetailedStock}, Cần: ${totalQuantity}) — Đang xuất âm!`);
            }

            if (totalQuantity > currentTotalStock) {
                notifyError(`⚠️ CẢNH BÁO: Xuất âm tổng kho (Tồn: ${currentTotalStock}, Xuất: ${totalQuantity})!`);
            }
        }

        if (!isSerialized && totalQuantity <= 0) {
            notifyError('Số lượng phải lớn hơn 0');
            return;
        }

        try {
            setIsSaving(true);
            await executeOutbound(selectedProduct, totalQuantity, serialList, receiver, product?.unit_price || 0, isSerialized, district, itemStatus);

            setSerial('');
            setScannedSerials([]);
            setQuantity(1);
            if (isAdmin) setReceiver('');
            setDistrict('');
            setItemStatus('');
            success('Xuất kho thành công!');
        } catch (err: any) {
            notifyError(err.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    const executeOutbound = async (prodId: string, qty: number, serials: string[], receiverName: string, price: number, isSerialized: boolean, districtVal?: string, itemStatusVal?: string) => {
        const newTransactions: any[] = [];
        const timenow = new Date().toISOString();
        const productName = products.find(p => p.id === prodId)?.name || prodId;

        if (isSerialized && serials.length > 0) {
            for (const code of serials) {
                const unwrapped = await dispatch(addOutboundTransaction({
                    product_id: prodId,
                    quantity: 1,
                    serial_code: code,
                    group_name: receiverName,
                    unit_price: price,
                    district: districtVal,
                    item_status: itemStatusVal,
                    user_id: profile?.id
                })).unwrap();
                
                const apiItem = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;

                newTransactions.push({
                    id: apiItem?.id || apiItem?.['id'] || ('temp-' + Math.random()),
                    product_id: prodId,
                    product_name: productName,
                    quantity: 1,
                    serial_code: code,
                    group_name: receiverName,
                    unit_price: price,
                    total_price: price,
                    date: timenow,
                    district: districtVal,
                    item_status: itemStatusVal
                });
            }
        } else {
            const unwrapped = await dispatch(addOutboundTransaction({
                product_id: prodId,
                quantity: qty,
                serial_code: undefined,
                group_name: receiverName,
                unit_price: price,
                district: districtVal,
                item_status: itemStatusVal,
                user_id: profile?.id
            })).unwrap();
            
            const apiItem = Array.isArray(unwrapped) ? unwrapped[0] : unwrapped;

            newTransactions.push({
                id: apiItem?.id || apiItem?.['id'] || ('temp-' + Math.random()),
                product_id: prodId,
                product_name: productName,
                quantity: qty,
                serial_code: undefined,
                group_name: receiverName,
                unit_price: price,
                total_price: price * qty,
                date: timenow,
                district: districtVal,
                item_status: itemStatusVal
            });
        }

        if (newTransactions.length > 0) {
            setRecentTransactions(prev => [...newTransactions, ...prev]);

            const productsMap: Record<string, string> = {};
            products.forEach(p => { productsMap[p.id] = p.name; });
            productsMap[prodId] = productName;

            sendTelegramNotification('XUẤT KHO THÀNH CÔNG', newTransactions, productsMap, receiverName);
        }

        dispatch(fetchInventory());
        dispatch(fetchOrders());
        dispatch(fetchTransactions());
    };

    const handleScanSuccess = (decodedText: string) => {
        if (openFulfillDialog && selectedOrder) {
            const product = products.find(p => p.id === selectedOrder.product_id);
            const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

            if (isSerialized) {
                const newCodes = parseSerialInput(decodedText);
                if (newCodes.length === 0) return;
                const uniqueNewCodes = filterNewSerials(newCodes, scannedSerials);
                if (uniqueNewCodes.length === 0) return;
                const needed = Number(selectedOrder.quantity) - scannedSerials.length;
                if (needed <= 0) {
                    setShowScanner(false);
                    return;
                }
                const taking = uniqueNewCodes.slice(0, needed);
                setScannedSerials(prev => {
                    const newer = [...prev, ...taking];
                    if (newer.length >= Number(selectedOrder.quantity)) {
                        setShowScanner(false);
                        success('Đã quét đủ số lượng serial theo đơn hàng!');
                    } else {
                        success(`Đã thêm ${taking.length} serial. Còn thiếu: ${Number(selectedOrder.quantity) - newer.length}`);
                    }
                    return newer;
                });
            } else {
                if (decodedText === product?.item_code || decodedText === product?.id) {
                    setIsProductVerified(true);
                    setShowScanner(false);
                    success('Đã xác thực sản phẩm!');
                }
            }
        } else if (isAdmin) {
            const product = products.find(p => p.id === selectedProduct);
            const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

            if (isSerialized) {
                const newCodes = parseSerialInput(decodedText);
                let addedCount = 0;
                setScannedSerials(prev => {
                    const uniqueNewCodes = filterNewSerials(newCodes, prev);
                    if (uniqueNewCodes.length === 0) return prev;
                    addedCount = uniqueNewCodes.length;
                    const newer = [...prev, ...uniqueNewCodes];
                    setQuantity(newer.length);
                    return newer;
                });
                if (addedCount > 0) {
                    success(`Đã thêm ${addedCount} serial`);
                    setShowScanner(false);
                } else {
                    notifyError(`Các serial này đã quét rồi`);
                    setShowScanner(false);
                }
            } else {
                setSerial(decodedText);
                setShowScanner(false);
                success('Đã quét mã thành công!');
            }
        }
    };

    const handleOpenFulfill = (order: Order) => {
        setSelectedOrder(order);
        setSerial('');
        setScannedSerials([]);
        setIsProductVerified(false);
        setOpenFulfillDialog(true);
    };

    const handleManualAddSerial = () => {
        if (!serial.trim()) return;
        const newCodes = parseSerialInput(serial);
        if (newCodes.length === 0) return;
        setScannedSerials(prev => {
            const uniqueNewCodes = filterNewSerials(newCodes, prev);
            if (uniqueNewCodes.length === 0) {
                notifyError('Tất cả serial này đã được thêm.');
                return prev;
            }
            let taking = uniqueNewCodes;
            if (openFulfillDialog && selectedOrder) {
                const needed = Number(selectedOrder.quantity) - prev.length;
                if (needed <= 0) {
                    notifyError('Đã đủ số lượng serial.');
                    return prev;
                }
                if (taking.length > needed) {
                    taking = taking.slice(0, needed);
                    notifyError(`Sẽ chỉ thêm ${needed} serial để đủ số lượng đơn hàng.`);
                }
            }
            const newer = [...prev, ...taking];
            if (!openFulfillDialog) setQuantity(newer.length);
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

    const fulfillmentStock = useSelector((state: RootState) => {
        if (!selectedOrder) return 0;
        // selectProductStock already deducts 'approved' orders. Since we are fulfilling THIS order,
        // we add its quantity back to check against the real physical stock available.
        return selectProductStock(state, selectedOrder.product_id) + Number(selectedOrder.quantity || 0);
    });

    const handleFulfillOrder = async () => {
        if (!selectedOrder) return;
        const product = products.find(p => p.id === selectedOrder.product_id);
        if (!product) return;
        const isSerialized = product.category?.toLowerCase() === 'hàng hóa';
        if (Number(selectedOrder.quantity) > fulfillmentStock) {
            notifyError(`Tồn kho không đủ! Yêu cầu: ${selectedOrder.quantity}, Tồn: ${fulfillmentStock}`);
            return;
        }
        if (isSerialized) {
            if (scannedSerials.length !== Number(selectedOrder.quantity)) {
                notifyError(`Vui lòng quét đủ ${selectedOrder.quantity} serial.`);
                return;
            }
        }
        try {
            const requesterEmployee = employees.find(e =>
                e.full_name === selectedOrder.requester_group ||
                e.username === selectedOrder.requester_group
            );
            const requesterDistrict = requesterEmployee?.district || undefined;
            await executeOutbound(
                selectedOrder.product_id,
                Number(selectedOrder.quantity),
                scannedSerials,
                selectedOrder.requester_group,
                product.unit_price || 0,
                isSerialized,
                requesterDistrict,
                undefined
            );
            await dispatch(updateOrderStatus({ id: selectedOrder.id, status: 'completed' })).unwrap();
            setOpenFulfillDialog(false);
            success('Đã xuất kho và hoàn tất đơn hàng!');
            setSelectedOrder(null);
            dispatch(fetchOrders());
        } catch (err: any) {
            notifyError(err.message || 'Lỗi cập nhật');
        }
    };

    if (status === 'loading' || inventoryStatus === 'loading') return (
        <Box display="flex" justifyContent="center" alignItems="center" p={8} gap={2}>
            <CircularProgress />
            <Box component="span" sx={{ fontSize: '1.2rem', color: 'text.secondary', fontWeight: 500 }}>
                Đang tải dữ liệu...
            </Box>
        </Box>
    );

    if (!isAdmin) {
        const staffName = profile?.full_name || profile?.username || '';
        const myApprovedOrders = orders.filter(o =>
            o.status === 'approved' && o.requester_group === staffName
        );
        const myCompletedOrders = orders.filter(o =>
            o.status === 'completed' && o.requester_group === staffName
        );

        return (
            <>
                <StaffOutboundView
                    approvedOrders={myApprovedOrders}
                    completedOrders={myCompletedOrders}
                    products={products}
                    onFulfill={handleOpenFulfill}
                />

                <FulfillOrderDialog
                    open={openFulfillDialog}
                    order={selectedOrder}
                    products={products}
                    scannedSerials={scannedSerials}
                    serial={serial}
                    isProductVerified={isProductVerified}
                    fulfillmentStock={fulfillmentStock}
                    onClose={() => setOpenFulfillDialog(false)}
                    onConfirm={handleFulfillOrder}
                    onSerialChange={setSerial}
                    onManualAddSerial={handleManualAddSerial}
                    onRemoveSerial={handleRemoveSerial}
                    onOpenScanner={() => setShowScanner(true)}
                />

                <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, m: 2 } }}>
                    <DialogTitle sx={{ fontWeight: 900, textTransform: 'uppercase', color: 'primary.main', textAlign: 'center' }}>
                        QUÉT MÃ QR/MÃ VẠCH
                    </DialogTitle>
                    <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                        <QRScanner onScanSuccess={handleScanSuccess} onScanFailure={() => {}} height={400} />
                        <Box textAlign="center" p={2}>
                            <Button onClick={() => setShowScanner(false)} variant="outlined" color="inherit">Đóng Camera</Button>
                        </Box>
                    </DialogContent>
                </Dialog>
            </>
        );
    }

    const allApprovedOrders = orders.filter(o => o.status === 'approved');

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: 1200, mx: 'auto' }}>
            {allApprovedOrders.length > 0 && (
                <Box mb={4}>
                    <Typography variant="h6" gutterBottom fontWeight="bold" color="error">
                        ĐƠN HÀNG CẦN XUẤT KHO ({allApprovedOrders.length})
                    </Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f0f0f0' }}>
                                <TableRow>
                                    <TableCell>Người/Đơn vị yêu cầu</TableCell>
                                    <TableCell>Sản phẩm</TableCell>
                                    <TableCell align="center">SL Yêu cầu</TableCell>
                                    <TableCell align="center">Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {allApprovedOrders.map(order => (
                                    <TableRow key={order.id}>
                                        <TableCell>{order.requester_group}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="600">
                                                {products.find(p => p.id === order.product_id)?.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" fontWeight="bold" color="primary">
                                                {order.quantity}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                variant="contained"
                                                color="secondary"
                                                size="small"
                                                onClick={() => handleOpenFulfill(order)}
                                            >
                                                Xuất Kho
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            <Box mb={3} display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'start', sm: 'center' }} gap={2}>
                <Box>
                    <Typography variant="h5" fontWeight="700" color="primary">
                        XUẤT HÀNG HÓA KHO
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Tạo phiếu xuất kho trực tiếp (Admin)
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<PrintIcon />}
                        disabled={selectedPrintIds.length === 0}
                        onClick={async () => {
                            const receivers = new Set(recentTransactions.filter(t => selectedPrintIds.includes(t.id)).map(t => t.group_name || (t as any).receiver_group));
                            if (receivers.size > 1) {
                                notifyError(`⚠️ Đang in biên bản cho ${receivers.size} người nhận khác nhau!`);
                            }

                            const firstTx = recentTransactions.find(t => selectedPrintIds.includes(t.id));
                            if (firstTx) {
                                const dateVal = new Date(firstTx.date || new Date());
                                const receiverVal = firstTx.group_name || (firstTx as any).receiver_group || '';

                                let deliverer = profile?.full_name || 'Admin';
                                try {
                                    const { GoogleSheetService } = await import('../services/GoogleSheetService');
                                    const districtConfigs = await GoogleSheetService.getDistrictStorekeepers();
                                    const receiverObj = employees.find(e => e.full_name === receiverVal || e.username === receiverVal);
                                    const empDistrict = receiverObj?.district || '';
                                    const transactionDistrict = firstTx.district || '';
                                    const searchDistrict = transactionDistrict || empDistrict;

                                    if (searchDistrict) {
                                        const config = districtConfigs.find((c: any) => matchDistrict(searchDistrict, c.district));
                                        if (config) {
                                            deliverer = config.storekeeper_name;
                                        }
                                    }
                                } catch(e) { console.error('Failed to resolve storekeeper', e); }

                                setResolvedDelivererName(deliverer);
                                SupabaseService.getReportNumber(dateVal, receiverVal).then(num => {
                                    setReportNumber(num);
                                    setOpenPrintPreview(true);
                                });
                            } else {
                                setResolvedDelivererName(profile?.full_name || 'Admin');
                                setOpenPrintPreview(true);
                            }
                        }}
                        size="small"
                    >
                        In Biên Bản
                    </Button>
                    <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={generateOutboundTemplate} size="small">
                        Mẫu Excel
                    </Button>
                    <Button variant="contained" component="label" startIcon={<UploadFileIcon />} size="small">
                        Nhập Excel
                        <input
                            type="file"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={async (e) => {
                                setIsSaving(true);
                                try {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const json = await readExcelFile(file);
                                        const mappedData = json.map((row: any) => {
                                            const product = products.find(p => p.item_code === row['MA_HANG']);
                                            if (!product) throw new Error(`Không tìm thấy sản phẩm có mã: ${row['MA_HANG']}`);
                                            return {
                                                product_id: product.id,
                                                quantity: Number(row['SO_LUONG'] || 1),
                                                serial_code: row['SERIAL'],
                                                group_name: row['NGUOI_NHAN'] || '',
                                                unit_price: product.unit_price || 0,
                                                district: row['QUAN_HUYEN'] || '',
                                                item_status: row['TRANG_THAI'] || '',
                                                user_id: profile?.id
                                            };
                                        });

                                        if (mappedData.length > 0) {
                                            const resultAction = await dispatch(importOutboundTransactions(mappedData));
                                            if (importOutboundTransactions.fulfilled.match(resultAction)) {
                                                const importedItems = resultAction.payload;
                                                if (Array.isArray(importedItems)) {
                                                    setRecentTransactions(prev => [...importedItems, ...prev]);
                                                    const productsMap: Record<string, string> = {};
                                                    products.forEach(p => productsMap[p.id] = p.name);
                                                    sendTelegramNotification('NHẬP EXCEL XUẤT KHO', importedItems, productsMap);
                                                }
                                                dispatch(fetchInventory());
                                                success(`Đã xuất thành công ${mappedData.length} giao dịch!`);
                                            }
                                        }
                                    }
                                } catch (error: any) {
                                    console.error('Import failed:', error);
                                    notifyError(`Lỗi: ${error.message}`);
                                } finally {
                                    setIsSaving(false);
                                    if (e.target) e.target.value = '';
                                }
                            }}
                        />
                    </Button>
                </Stack>
            </Box>

            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Grid container spacing={2}>
                    <Grid size={12}>
                        <Box display="flex" gap={1}>
                            <Autocomplete
                                fullWidth
                                options={products}
                                getOptionLabel={(option) => typeof option === 'string' ? option : `${option.name} (${option.item_code})`}
                                value={products.find(p => p.id === selectedProduct) || null}
                                onChange={(_, newValue) => {
                                    setSelectedProduct(newValue?.id || '');
                                    setScannedSerials([]);
                                    setSerial('');
                                    setQuantity(1);
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn sản phẩm"
                                        placeholder="Gõ tên hoặc mã sản phẩm..."
                                        size="small"
                                    />
                                )}
                            />
                            <IconButton onClick={() => setShowProductSearch(true)} color="primary" sx={{ border: '1px solid', borderColor: 'divider' }}>
                                <SearchIcon />
                            </IconButton>
                        </Box>
                        {selectedProduct && (
                            <Box mt={1}>
                                <StockDisplay productId={selectedProduct} />
                            </Box>
                        )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 2 }}>
                        <TextField
                            fullWidth
                            label="Số lượng"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            inputProps={{ min: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        {isAdmin ? (
                            <Autocomplete
                                fullWidth
                                options={employees}
                                getOptionLabel={(option: any) => typeof option === 'string' ? option : `${option.full_name || ''} (${option.username || option.email || ''})`.trim()}
                                onChange={(_, newValue: any) => {
                                    if (typeof newValue === 'string') {
                                        setReceiver(newValue);
                                        setDistrict('');
                                    } else if (newValue) {
                                        setReceiver(newValue.full_name || newValue.username || '');
                                        setDistrict(newValue.district || '');
                                    } else {
                                        setReceiver('');
                                        setDistrict('');
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Người/Đơn vị nhận (Nhân viên)"
                                        placeholder="Chọn hoặc nhập tên..."
                                        size="small"
                                        onChange={e => setReceiver(e.target.value)}
                                    />
                                )}
                                freeSolo
                            />
                        ) : (
                            <TextField
                                fullWidth
                                label="Người nhận"
                                value={receiver}
                                disabled
                                size="small"
                            />
                        )}
                    </Grid>
                    <Grid size={{ xs: 12, md: 5 }}>
                        <TextField
                            select
                            fullWidth
                            label="Quận/Huyện"
                            value={district}
                            onChange={e => setDistrict(e.target.value)}
                            size="small"
                        >
                            <MenuItem value=""><em>-- Chọn quận/huyện --</em></MenuItem>
                            <MenuItem value="Q12">Q12</MenuItem>
                            <MenuItem value="HMN">HMN</MenuItem>
                            <MenuItem value="CCI">CCI</MenuItem>
                        </TextField>
                    </Grid>

                    {products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa' && (
                        <Grid size={12}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid size={{ xs: 12, md: 8 }}>
                                        <TextField
                                            fullWidth
                                            label="Serial / QR Code"
                                            value={serial}
                                            onChange={e => setSerial(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleManualAddSerial();
                                                }
                                            }}
                                            placeholder="Quét mã hoặc nhập tay rồi Enter"
                                            size="small"
                                            helperText={`Đã quét: ${scannedSerials.length} serial`}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 4 }}>
                                        <Button
                                            fullWidth
                                            variant="outlined"
                                            startIcon={<QrCodeScannerIcon />}
                                            onClick={() => setShowScanner(true)}
                                            size="large"
                                        >
                                            Mở Camera Quét
                                        </Button>
                                    </Grid>
                                </Grid>

                                <SerialChips 
                                    serials={scannedSerials} 
                                    onRemove={handleRemoveSerial} 
                                    maxVisible={15} 
                                />

                                {scannedSerials.length === 0 && (
                                    <Box textAlign="center" py={2}>
                                        <Typography variant="body2" color="text.secondary">Chưa có serial nào được quét.</Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Grid>
                    )}

                    <Grid size={12}>
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
                                    if (isAdmin) setReceiver('');
                                    setDistrict('');
                                    setItemStatus('');
                                }}
                                sx={{ minWidth: 120, py: { xs: 1, md: 1.5 }, borderRadius: 3, fontSize: { xs: '0.9rem', md: '1rem' }, fontWeight: 700, textTransform: 'none' }}
                            >
                                Hủy bỏ
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleAdminSave}
                                disabled={isSaving || (status as string) === 'loading'}
                                sx={{ minWidth: 150, py: { xs: 1, md: 1.5 }, borderRadius: 3, fontSize: { xs: '0.9rem', md: '1rem' }, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                            >
                                {isSaving ? 'Đang xử lý...' : 'Xuất Kho'}
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>

            <Dialog open={showScanner} onClose={() => setShowScanner(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, m: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, textAlign: 'center' }}>
                    QUÉT MÃ QR/MÃ VẠCH
                </DialogTitle>
                <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
                    <QRScanner
                        onScanSuccess={handleScanSuccess}
                        onScanFailure={() => { }}
                        height={400}
                    />
                    <Box textAlign="center" p={2}>
                        <Button onClick={() => setShowScanner(false)} variant="outlined">Đóng Camera</Button>
                    </Box>
                </DialogContent>
            </Dialog>

            <ProductSearchDialog
                open={showProductSearch}
                onClose={() => setShowProductSearch(false)}
                products={products}
                onSelect={(product) => {
                    setSelectedProduct(product.id || (product as any).ID || '');
                    setScannedSerials([]);
                    setSerial('');
                    setQuantity(1);
                    setShowProductSearch(false);
                }}
            />

            {recentTransactions.length > 0 && (
                <Box mt={4}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                        DANH SÁCH VỪA XUẤT (Phiên làm việc hiện tại)
                    </Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f0f0f0' }}>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={recentTransactions.length > 0 && selectedPrintIds.length === recentTransactions.length}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                                if (e.target.checked) setSelectedPrintIds(recentTransactions.map(t => t.id));
                                                else setSelectedPrintIds([]);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>Thời gian</TableCell>
                                    <TableCell>Người/Nhóm nhận</TableCell>
                                    <TableCell>Sản phẩm</TableCell>
                                    <TableCell>Serial</TableCell>
                                    <TableCell align="right">SL</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {recentTransactions.map((tx, idx) => {
                                    const p = products.find(prod => prod.id === tx.product_id);
                                    return (
                                        <TableRow key={tx.id ? `tx-${tx.id}` : `outbound-tx-${idx}`} hover selected={selectedPrintIds.includes(tx.id)}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedPrintIds.includes(tx.id)}
                                                    onChange={() => {
                                                        setSelectedPrintIds(prev =>
                                                            prev.includes(tx.id) ? prev.filter(id => id !== tx.id) : [...prev, tx.id]
                                                        );
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell>{tx.created_at ? new Date(tx.created_at).toLocaleTimeString('vi-VN') : (tx.date ? new Date(tx.date).toLocaleTimeString('vi-VN') : (tx.outbound_date ? new Date(tx.outbound_date).toLocaleTimeString('vi-VN') : '—'))}</TableCell>
                                            <TableCell>{tx.group_name || (tx as any).receiver_group}</TableCell>
                                            <TableCell>
                                                <Box>
                                                    <Typography variant="body2">{p?.name || 'Unknown'}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{p?.item_code}</Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{tx.serial_code}</TableCell>
                                            <TableCell align="right">{tx.quantity}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const outboundTxs = allTransactions.filter(t => {
                    const isOutbound = (t as any).type === 'outbound' || (t as any).outbound_date;
                    if (!isOutbound) return false;

                    // Admin/Manager: chỉ hiển thị giao dịch hôm nay
                    if (isAdmin) {
                        const dateVal = (t as any).outbound_date || t.date || (t as any).created_at;
                        if (!dateVal) return false;
                        const txDate = new Date(dateVal);
                        txDate.setHours(0, 0, 0, 0);
                        return txDate.getTime() === today.getTime();
                    }

                    // Nhân viên: chỉ thấy giao dịch của mình (toàn bộ lịch sử)
                    const anyT = t as any;
                    const myName = profile?.full_name || profile?.username || profile?.email || '';
                    return (
                        anyT.group_name === myName ||
                        anyT.receiver_group === myName ||
                        anyT.user_name === myName ||
                        anyT.user_id === profile?.id ||
                        anyT.user_id === profile?.auth_user_id ||
                        anyT.created_by === profile?.auth_user_id ||
                        anyT.created_by === profile?.email
                    );
                });


                const filteredOutbound = outboundTxs.filter(t => {
                    const p = products.find(prod => prod.id === t.product_id);
                    const searchLower = outboundSearch.toLowerCase();
                    return (
                        !outboundSearch ||
                        p?.name?.toLowerCase().includes(searchLower) ||
                        (t.serial_code || '').toLowerCase().includes(searchLower) ||
                        (t.group_name || (t as any).receiver_group || '').toLowerCase().includes(searchLower) ||
                        (t.district || '').toLowerCase().includes(searchLower)
                    );
                });
                const paginatedOutbound = filteredOutbound.slice(
                    outboundPage * outboundRowsPerPage,
                    outboundPage * outboundRowsPerPage + outboundRowsPerPage
                );
                return (
                    <Box mt={6}>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                            <Typography variant="h5" fontWeight="bold">
                                {isAdmin ? 'Danh sách hàng hóa đã xuất kho (Hôm nay)' : 'Giao dịch xuất kho của tôi'}
                                {filteredOutbound.length > 0 && (
                                    <Chip label={filteredOutbound.length} size="small" color="primary" sx={{ ml: 1.5, fontWeight: 700, fontSize: '0.8rem' }} />
                                )}
                            </Typography>
                        </Box>
                        <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                            <Box p={2} borderBottom="1px solid" borderColor="divider">
                                <TextField
                                    placeholder="Tìm kiếm theo Tên SP, Serial, Người nhận, Quận/Huyện..."
                                    size="small"
                                    value={outboundSearch}
                                    onChange={e => { setOutboundSearch(e.target.value); setOutboundPage(0); }}
                                    sx={{ width: { xs: '100%', sm: 380 } }}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                                        endAdornment: <VoiceSearchButton onResult={setOutboundSearch} />,
                                        sx: { borderRadius: 2 }
                                    }}
                                />
                            </Box>
                            {isMobile ? (
                                <Box p={2}>
                                    {paginatedOutbound.length > 0 ? (
                                        <Stack spacing={2}>
                                            {paginatedOutbound.map((row, idx) => {
                                                const p = products.find(prod => prod.id === row.product_id);
                                                const isSerialized = p?.category?.toLowerCase() === 'hàng hóa';
                                                const dateVal = (row as any).outbound_date || row.date || (row as any).created_at;
                                                return (
                                                    <Card key={(row as any).id ? `card-${(row as any).id}` : `card-idx-${idx}`} variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
                                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                                                <Box flex={1} mr={1}>
                                                                    <Typography variant="subtitle2" fontWeight="bold" color="primary">{p?.name || 'Unknown'}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{p?.item_code}</Typography>
                                                                    {!isSerialized && (
                                                                        <Chip label="Vật tư" size="small" color="default" sx={{ ml: 0.5, height: 16, fontSize: '0.65rem' }} />
                                                                    )}
                                                                </Box>
                                                                <Typography variant="body2" fontWeight="bold">SL: {row.quantity}</Typography>
                                                            </Box>
                                                            <Divider sx={{ my: 1 }} />
                                                            <Grid container spacing={1}>
                                                                <Grid size={6}>
                                                                    <Typography variant="caption" color="text.secondary">Người nhận</Typography>
                                                                    <Typography variant="body2">{(row as any).group_name || (row as any).receiver_group || '—'}</Typography>
                                                                </Grid>
                                                                <Grid size={6}>
                                                                    <Typography variant="caption" color="text.secondary">Quận/Huyện</Typography>
                                                                    <Typography variant="body2">{(row as any).district || '—'}</Typography>
                                                                </Grid>
                                                                <Grid size={6}>
                                                                    <Typography variant="caption" color="text.secondary">Đơn giá</Typography>
                                                                    <Typography variant="body2">{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</Typography>
                                                                </Grid>
                                                                <Grid size={6}>
                                                                    <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                                                                    <Typography variant="body2">{(row as any).item_status || '—'}</Typography>
                                                                </Grid>
                                                                {row.serial_code && (
                                                                    <Grid size={12}>
                                                                        <Typography variant="caption" color="text.secondary">Serial</Typography>
                                                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                                                            {row.serial_code}
                                                                        </Typography>
                                                                    </Grid>
                                                                )}
                                                                <Grid size={12}>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        Thời gian: {dateVal ? new Date(dateVal).toLocaleString('vi-VN') : '—'}
                                                                    </Typography>
                                                                </Grid>
                                                            </Grid>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </Stack>
                                    ) : (
                                        <Typography textAlign="center" color="text.secondary" py={3}>
                                            {outboundSearch ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu xuất kho'}
                                        </Typography>
                                    )}
                                </Box>
                            ) : (
                                <TableContainer>
                                    <Table sx={{ minWidth: 800 }}>
                                        <TableHead sx={{ bgcolor: 'grey.50' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 600 }}>Thời gian</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Tên vật tư</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Serial</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Người nhận</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Quận/Huyện</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">SL</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }} align="right">Đơn giá</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {paginatedOutbound.length > 0 ? (
                                                paginatedOutbound.map((row, idx) => {
                                                    const p = products.find(prod => prod.id === row.product_id);
                                                    const isSerialized = p?.category?.toLowerCase() === 'hàng hóa';
                                                    const dateVal = (row as any).outbound_date || row.date || (row as any).created_at;
                                                    return (
                                                        <TableRow key={(row as any).id ? `row-${(row as any).id}` : `row-idx-${idx}`} hover>
                                                            <TableCell>{dateVal ? new Date(dateVal).toLocaleString('vi-VN') : '—'}</TableCell>
                                                            <TableCell>
                                                                <Box>
                                                                    <Typography variant="body2" fontWeight={500}>{p?.name || 'Unknown'}</Typography>
                                                                    <Typography variant="caption" color="text.secondary">{p?.item_code}</Typography>
                                                                    {!isSerialized && (
                                                                        <Chip label="Vật tư" size="small" color="default" sx={{ ml: 0.5, height: 16, fontSize: '0.65rem' }} />
                                                                    )}
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell>
                                                                {row.serial_code
                                                                    ? <Chip label={row.serial_code} size="small" variant="outlined" color="primary" sx={{ fontSize: '0.75rem', height: 22 }} />
                                                                    : <Typography variant="caption" color="text.disabled">—</Typography>
                                                                }
                                                            </TableCell>
                                                            <TableCell>{(row as any).group_name || (row as any).receiver_group || '—'}</TableCell>
                                                            <TableCell>{(row as any).district || '—'}</TableCell>
                                                            <TableCell align="right"><b>{row.quantity}</b></TableCell>
                                                            <TableCell align="right">{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</TableCell>
                                                            <TableCell>{(row as any).item_status || '—'}</TableCell>
                                                        </TableRow>
                                                    );
                                                })
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                        {outboundSearch ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu xuất kho'}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}
                            <TablePagination
                                component="div"
                                count={filteredOutbound.length}
                                page={outboundPage}
                                onPageChange={(_, newPage) => setOutboundPage(newPage)}
                                rowsPerPage={outboundRowsPerPage}
                                onRowsPerPageChange={e => { setOutboundRowsPerPage(Number(e.target.value)); setOutboundPage(0); }}
                                rowsPerPageOptions={[10, 25, 50]}
                                labelRowsPerPage="Hiển thị:"
                                labelDisplayedRows={({ from, to, count }) => `${from}-${to} / ${count}`}
                            />
                        </Paper>
                    </Box>
                );
            })()}

            <FulfillOrderDialog
                open={openFulfillDialog}
                order={selectedOrder}
                products={products}
                scannedSerials={scannedSerials}
                serial={serial}
                isProductVerified={isProductVerified}
                fulfillmentStock={fulfillmentStock}
                onClose={() => setOpenFulfillDialog(false)}
                onConfirm={handleFulfillOrder}
                onSerialChange={setSerial}
                onManualAddSerial={handleManualAddSerial}
                onRemoveSerial={handleRemoveSerial}
                onOpenScanner={() => setShowScanner(true)}
            />

            <Dialog open={openPrintPreview} onClose={() => setOpenPrintPreview(false)} maxWidth="lg" fullWidth scroll="body">
                <DialogTitle className="no-print" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Xem Trước Biên Bản Xuất Kho
                    <Box>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={isUploadingDrive ? <CircularProgress size={20} color="inherit" /> : <CloudUploadIcon />}
                            onClick={handleUploadDrive}
                            disabled={isUploadingDrive}
                            sx={{ mr: 1 }}
                        >
                            {isUploadingDrive ? 'Đang lưu...' : 'Lưu Drive (PDF)'}
                        </Button>
                        <Button variant="contained" color="info" startIcon={<PrintIcon />} onClick={() => window.print()} sx={{ mr: 1 }}>
                            In Ngay
                        </Button>
                        <Button onClick={() => setOpenPrintPreview(false)} color="inherit">Đóng</Button>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box id="outbound-report-content" sx={{ p: 1, bgcolor: 'white' }}>
                        <OutboundReportPreview
                            data={recentTransactions
                                .filter(t => selectedPrintIds.includes(t.id))
                                .map(t => {
                                    const p = products.find(prod => prod.id === t.product_id);
                                    return {
                                        product_name: p ? p.name : 'Unknown',
                                        unit: p ? p.unit : '',
                                        quantity: t.quantity,
                                        unit_price: t.unit_price,
                                        serial_code: t.serial_code || '',
                                        item_status: t.item_status || ''
                                    };
                                })
                            }
                            delivererName={resolvedDelivererName || profile?.full_name || 'Admin'}
                            senderPhone={profile?.phone_number || ''}
                            date={new Date().toISOString()}
                            receiverName={Array.from(new Set(recentTransactions.filter(t => selectedPrintIds.includes(t.id)).map(t => t.group_name || t.receiver_group))).join(', ')}
                            reportNumber={reportNumber}
                        />
                    </Box>
                </DialogContent>
            </Dialog>
        </Box >
    );
};
