import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import VoiceSearchButton from '../components/VoiceSearchButton';
import { useDebounce } from '../hooks/useDebounce';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory, selectProductStock, selectStockMap } from '../store/slices/inventorySlice';
import { addInboundTransaction, fetchTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, importInboundTransactions, syncInStock } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import type { Transaction } from '../types';
import {
    Button, TextField, FormControl, FormHelperText, Checkbox, Chip,
    Typography, Box, CircularProgress, Paper, Stack, Dialog, DialogContent, DialogTitle, Autocomplete,
    IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Tooltip, DialogActions, InputAdornment, MenuItem, Grid,
    Card, CardContent, Divider, useMediaQuery, useTheme
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SyncIcon from '@mui/icons-material/Sync';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import QRScanner from '../components/QRScanner';
import { readExcelFile, generateInboundTemplate } from '../utils/excelUtils';
import { useScanDetection } from '../hooks/useScanDetection';
import { playBeep } from '../utils/audio';
import { parseSerialInput, filterNewSerials } from '../utils/serialParser';
import SerialChips from '../components/Common/SerialChips';
import { useNotification } from '../contexts/NotificationContext';
import TableSkeleton from '../components/Common/TableSkeleton';


export const Inbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products, status } = useSelector((state: RootState) => state.products);
    const { profile } = useSelector((state: RootState) => state.auth);
    const stockMap = useSelector(selectStockMap);
    const { items: transactions, status: txStatus } = useSelector((state: RootState) => state.transactions);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

    const { success, error: notifyError } = useNotification();
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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

    // Refs để tránh stale closure khi quét nhanh liên tiếp
    const scannedSerialsRef = useRef<string[]>([]);
    const notifyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingCountRef = useRef(0);

    // Sync ref khi state thay đổi
    useEffect(() => { scannedSerialsRef.current = scannedSerials; }, [scannedSerials]);

    // Scanner state
    const [showScanner, setShowScanner] = useState(false);

    // List State
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isSyncing, setIsSyncing] = useState(false);

    // Edit Dialog State
    const [editDialog, setEditDialog] = useState(false);
    const [editItem, setEditItem] = useState<Transaction | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Delete Dialog State
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Transaction | null>(null);

    // Bulk selection state
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
    const [isBulkDeleting, setIsBulkDeleting] = useState(false);

    useEffect(() => {
        if (status === 'idle') dispatch(fetchProducts());
        if (txStatus === 'idle') dispatch(fetchTransactions());
        dispatch(fetchInventory());
    }, [status, txStatus, dispatch]);

    const handlePhysicalScan = useCallback((code: string) => {
        playBeep();
        handleScanSuccess(code);
    }, [selectedProduct, products]);
    useScanDetection(handlePhysicalScan);

    const handleSave = async () => {
        if (!selectedProduct) {
            notifyError('Vui lòng chọn sản phẩm');
            return;
        }
        if (isSaving) return;

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

        setIsSaving(true);
        try {
            if (isSerialized) {
                const bulkData = serialList.map(code => ({
                    product_id: selectedProduct,
                    quantity: 1,
                    serial_code: code,
                    unit_price: Number(price),
                    district: district.trim() || undefined,
                    item_status: itemStatus.trim() || undefined
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
                    item_status: itemStatus.trim() || undefined
                })).unwrap();
                success('Nhập kho thành công!');
            }

            setSerial('');
            setScannedSerials([]);
            setQuantity(1);
            setDistrict('');
            setItemStatus('');
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (err: any) {
            notifyError(err.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    // parseSerialInput và tryDetectMultipleSerials đã được chuyển sang utils/serialParser.ts
    // Import trực tiếp từ module để tái sử dụng cho cả Outbound và EmployeeReturns


    const handleScanSuccess = (decodedText: string) => {
        const product = products.find(p => p.id === selectedProduct);
        const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';

        if (isSerialized) {
            // Parse 2D barcode - hỗ trợ GS1/DataMatrix/QR và tự tách serial ghép
            const newCodes = parseSerialInput(decodedText);

            // Đọc từ ref để tránh stale closure khi quét nhanh liên tiếp
            const currentSerials = scannedSerialsRef.current;
            const uniqueNewCodes = filterNewSerials(newCodes, currentSerials);

            if (uniqueNewCodes.length > 0) {
                // Cập nhật ref ngay lập tức (không chờ re-render)
                scannedSerialsRef.current = [...currentSerials, ...uniqueNewCodes];

                // Gom batch update cho state
                pendingCountRef.current += uniqueNewCodes.length;
                setScannedSerials(scannedSerialsRef.current);
                setQuantity(scannedSerialsRef.current.length);

                // Debounce notification 400ms sau lần quét cuối
                if (notifyTimerRef.current) clearTimeout(notifyTimerRef.current);
                notifyTimerRef.current = setTimeout(() => {
                    const count = pendingCountRef.current;
                    const total = scannedSerialsRef.current.length;
                    success(`✅ Đã thêm ${count} serial — Tổng: ${total}`);
                    pendingCountRef.current = 0;
                }, 400);

                if (showScanner) setShowScanner(false);
            } else {
                // Tất cả serial đã tồn tại
                const msg = newCodes.length === 1
                    ? `⚠️ Serial đã tồn tại: ${newCodes[0]}`
                    : `⚠️ ${newCodes.length} serial đã tồn tại`;
                notifyError(msg);
                if (showScanner) setShowScanner(false);
            }
        } else {
            setSerial(decodedText);
            setShowScanner(false);
            success('Đã quét mã thành công!');
        }
    };

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
            if (uniqueNewCodes.length < newCodes.length) {
                success(`Đã thêm ${uniqueNewCodes.length} serial mới. Bỏ qua ${newCodes.length - uniqueNewCodes.length} trùng lặp.`);
            } else {
                success(`Đã thêm ${uniqueNewCodes.length} serial.`);
            }
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
    const filteredTransactions = useMemo(() => {
        const searchStr = debouncedSearchTerm.toLowerCase();
        
        // 1. Phân quyền: Nhân viên chỉ thấy giao dịch của mình
        const userTransactions = transactions.filter(t => {
            if (isAdmin) return true;
            // Với Inbound, employee là người quét -> check created_by or user_id
            const anyT = t as any;
            const isOwner = anyT.user_id === profile?.auth_user_id || 
                            anyT.user_name === profile?.full_name || 
                            anyT.created_by === profile?.auth_user_id ||
                            anyT.created_by === profile?.email;
            return isOwner;
        });

        // 2. Lọc theo search term
        return userTransactions
            .filter(t => t.type === 'inbound')
            .filter(t => {
                if (!searchStr) return true;
                return (
                    t.product?.name?.toLowerCase().includes(searchStr) ||
                    t.product?.item_code?.toLowerCase().includes(searchStr) ||
                    (t.serial_code && t.serial_code.toLowerCase().includes(searchStr)) ||
                    (t.district && t.district.toLowerCase().includes(searchStr))
                );
            });
    }, [transactions, debouncedSearchTerm, isAdmin, profile]);

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
            success('Cập nhật thành công!');
            setEditDialog(false);
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            notifyError(error.message || 'Lỗi cập nhật');
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
            success('Xóa thành công!');
            setDeleteDialog(false);
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            notifyError(error.message || 'Lỗi khi xóa');
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(paginatedTransactions.map(t => t.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev =>
            checked ? [...prev, id] : prev.filter(i => i !== id)
        );
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        setIsBulkDeleting(true);
        try {
            await dispatch(bulkDeleteTransactions({ ids: selectedIds, type: 'inbound' })).unwrap();
            success(`Đã xóa ${selectedIds.length} giao dịch thành công!`);
            setSelectedIds([]);
            setBulkDeleteDialog(false);
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            notifyError(error.message || 'Lỗi khi xóa hàng loạt');
        } finally {
            setIsBulkDeleting(false);
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
                    <Button 
                        variant="contained" 
                        color="secondary" 
                        startIcon={isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />} 
                        onClick={async () => {
                            try {
                                setIsSyncing(true);
                                const res = await dispatch(syncInStock()).unwrap();
                                success(res.message || 'Đồng bộ thành công!');
                            } catch (error: any) {
                                notifyError('Lỗi đồng bộ: ' + (error.message || 'Không xác định'));
                            } finally {
                                setIsSyncing(false);
                            }
                        }}
                        disabled={isSyncing}
                        size="small" 
                        sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                    >
                        {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ kho tổng'}
                    </Button>
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

                                            dispatch(fetchTransactions());
                                            dispatch(fetchInventory());

                                            success(`Đã nhập thành công ${mappedData.length} giao dịch!`);
                                        }
                                    } catch (error: any) {
                                        console.error('Import failed:', error);
                                        notifyError(`Lỗi: ${error.message}`);
                                    }
                                    e.target.value = '';
                                }
                            }}
                        />
                    </Button>
                </Stack>
            )}

            <Paper elevation={0} sx={{ p: { xs: 2, sm: 4, md: 6 }, maxWidth: 1000, mx: 'auto', borderRadius: { xs: 2, sm: 5 }, border: '1px solid', borderColor: 'divider', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <Grid container spacing={3}>
                    <Grid size={12}>
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
                            fullWidth
                            label="Số lượng"
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(Number(e.target.value))}
                            inputProps={{ min: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                            size="small"
                            disabled={products.find(p => p.id === selectedProduct)?.category?.toLowerCase() === 'hàng hóa'}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            label="Đơn giá nhập"
                            type="number"
                            value={price}
                            onChange={e => setPrice(Number(e.target.value))}
                            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            select
                            label="Trạng thái hàng"
                            value={itemStatus}
                            onChange={e => setItemStatus(e.target.value)}
                            size="small"
                        >
                            <MenuItem value=""><em>-- Chọn trạng thái --</em></MenuItem>
                            <MenuItem value="Hàng mới">Hàng mới</MenuItem>
                            <MenuItem value="Hàng thu hồi bảo hành">Hàng thu hồi bảo hành</MenuItem>
                            <MenuItem value="Hàng thu hồi">Hàng thu hồi</MenuItem>
                        </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            fullWidth
                            select
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
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
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
                                        size="small"
                                    />
                                    <Button
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => setShowScanner(true)}
                                        startIcon={<QrCodeScannerIcon />}
                                        sx={{ height: 40, px: 3, borderRadius: 2, whiteSpace: 'nowrap' }}
                                    >
                                        Quét QR
                                    </Button>
                                </Stack>

                                <SerialChips 
                                    serials={scannedSerials} 
                                    onRemove={handleRemoveSerial} 
                                    maxVisible={12} 
                                />
                                
                                {scannedSerials.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" display="block" textAlign="center" py={1}>
                                        Chưa có serial nào được quét. Số lượng sẽ tự động cập nhật theo số serial.
                                    </Typography>
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
                                    setPrice(0);
                                    setDistrict('');
                                    setItemStatus('');
                                }}
                                sx={{ minWidth: 120, py: 1.2, borderRadius: 3, fontWeight: 700, textTransform: 'none' }}
                            >
                                Hủy
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                size="large"
                                onClick={handleSave}
                                disabled={status === 'loading' || isSaving}
                                startIcon={isSaving ? <CircularProgress size={18} color="inherit" /> : undefined}
                                sx={{ minWidth: 150, py: 1.2, borderRadius: 3, fontWeight: 700, textTransform: 'none', boxShadow: 'none' }}
                            >
                                {isSaving ? 'Đang lưu...' : 'Nhập Kho'}
                            </Button>
                        </Box>
                    </Grid>
                </Grid>
            </Paper>


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

            {/* List of Inbound Transactions */}
            <Box mt={6}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                    <Typography variant="h5" fontWeight="bold">
                        Danh sách hàng hóa đã nhập
                        {filteredTransactions.length > 0 && (
                            <Chip label={filteredTransactions.length} size="small" color="primary" sx={{ ml: 1.5, fontWeight: 700, fontSize: '0.8rem' }} />
                        )}
                    </Typography>
                    {selectedIds.length > 0 && (
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => setBulkDeleteDialog(true)}
                            sx={{ fontWeight: 700, borderRadius: 2 }}
                        >
                            Xóa {selectedIds.length} mục đã chọn
                        </Button>
                    )}
                </Box>
                <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                    <Box p={2} borderBottom="1px solid" borderColor="divider" display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                        <TextField
                            placeholder="Tìm kiếm theo Tên SP, Serial, Quận/Huyện..."
                            size="small"
                            value={searchTerm}
                            onChange={e => {
                                setSearchTerm(e.target.value);
                                setPage(0);
                            }}
                            sx={{ width: { xs: '100%', sm: 350 } }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                                endAdornment: <VoiceSearchButton onResult={setSearchTerm} />,
                                sx: { borderRadius: 2 }
                            }}
                        />
                        {selectedIds.length > 0 && (
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" color="text.secondary">Đã chọn: <b>{selectedIds.length}</b></Typography>
                                <Button size="small" color="inherit" onClick={() => setSelectedIds([])}>Đỏ chọn</Button>
                            </Box>
                        )}
                    </Box>
                    {isMobile ? (
                        <Box p={2}>
                            {txStatus === 'loading' ? (
                                <Box display="flex" justifyContent="center"><CircularProgress /></Box>
                            ) : paginatedTransactions.length > 0 ? (
                                <Stack spacing={2}>
                                    {paginatedTransactions.map((row, idx) => (
                                        <Card key={row.id ? `card-${row.id}` : `inbound-card-${idx}`} variant="outlined" sx={{ borderRadius: 2, borderColor: selectedIds.includes(row.id) ? 'primary.main' : 'divider', bgcolor: selectedIds.includes(row.id) ? 'primary.50' : 'white' }}>
                                            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                                    <Box display="flex" alignItems="center" gap={1}>
                                                        <Checkbox size="small" sx={{ p: 0 }} checked={selectedIds.includes(row.id)} onChange={e => handleSelectOne(row.id, e.target.checked)} />
                                                        <Typography variant="subtitle2" fontWeight="bold" color="primary">{row.product?.name || 'Unknown'}</Typography>
                                                    </Box>
                                                    <Typography variant="body2" fontWeight="bold">SL: {row.quantity}</Typography>
                                                </Box>
                                                <Divider sx={{ my: 1 }} />
                                                <Grid container spacing={1}>
                                                    <Grid size={6}>
                                                        <Typography variant="caption" color="text.secondary">Serial</Typography>
                                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{row.serial_code || '-'}</Typography>
                                                    </Grid>
                                                    <Grid size={6}>
                                                        <Typography variant="caption" color="text.secondary">Quận/Huyện</Typography>
                                                        <Typography variant="body2">{row.district || '-'}</Typography>
                                                    </Grid>
                                                    <Grid size={6}>
                                                        <Typography variant="caption" color="text.secondary">Đơn giá</Typography>
                                                        <Typography variant="body2">{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</Typography>
                                                    </Grid>
                                                    <Grid size={6}>
                                                        <Typography variant="caption" color="text.secondary">Trạng thái</Typography>
                                                        <Typography variant="body2">{row.item_status || '-'}</Typography>
                                                    </Grid>
                                                    <Grid size={12}>
                                                        <Typography variant="caption" color="text.secondary">Thời gian: {new Date(row.date || row.inbound_date || '').toLocaleString('vi-VN')}</Typography>
                                                    </Grid>
                                                </Grid>
                                                <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
                                                    <Button size="small" startIcon={<EditIcon />} onClick={() => handleEditClick(row)}>Sửa</Button>
                                                    <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDeleteClick(row)}>Xóa</Button>
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </Stack>
                            ) : (
                                <Typography textAlign="center" color="text.secondary" py={3}>Không có dữ liệu</Typography>
                            )}
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table sx={{ minWidth: 800 }}>
                                <TableHead sx={{ bgcolor: 'grey.50' }}>
                                    <TableRow>
                                        <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                            <Checkbox
                                                size="small"
                                                indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedTransactions.length}
                                                checked={paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.includes(t.id))}
                                                onChange={e => handleSelectAll(e.target.checked)}
                                            />
                                        </TableCell>
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
                                    {txStatus === 'loading' ? (
                                        <TableSkeleton columns={9} rows={rowsPerPage} />
                                    ) : paginatedTransactions.length > 0 ? (
                                        paginatedTransactions.map((row, idx) => (
                                            <TableRow
                                                key={row.id ? `row-${row.id}` : `inbound-row-${idx}`}
                                                hover
                                                selected={selectedIds.includes(row.id)}
                                                sx={{ '&.Mui-selected': { bgcolor: 'primary.50' } }}
                                            >
                                                <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={selectedIds.includes(row.id)}
                                                        onChange={e => handleSelectOne(row.id, e.target.checked)}
                                                    />
                                                </TableCell>
                                                <TableCell>{new Date(row.date || row.inbound_date || '').toLocaleString('vi-VN')}</TableCell>
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
                                            <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                Không có dữ liệu
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
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
                            select
                            label="Quận/Huyện"
                            fullWidth
                            size="small"
                            value={editData.district || ''}
                            onChange={(e) => setEditData({ ...editData, district: e.target.value })}
                        >
                            <MenuItem value=""><em>-- Chọn quận/huyện --</em></MenuItem>
                            <MenuItem value="Q12">Q12</MenuItem>
                            <MenuItem value="HMN">HMN</MenuItem>
                            <MenuItem value="CCI">CCI</MenuItem>
                        </TextField>
                        <TextField
                            select
                            label="Trạng thái hàng"
                            fullWidth
                            size="small"
                            value={editData.item_status || ''}
                            onChange={(e) => setEditData({ ...editData, item_status: e.target.value })}
                        >
                            <MenuItem value=""><em>-- Chọn trạng thái --</em></MenuItem>
                            <MenuItem value="Hàng mới">Hàng mới</MenuItem>
                            <MenuItem value="Hàng thu hồi bảo hành">Hàng thu hồi bảo hành</MenuItem>
                            <MenuItem value="Hàng thu hồi">Hàng thu hồi</MenuItem>
                        </TextField>
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

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={bulkDeleteDialog} onClose={() => !isBulkDeleting && setBulkDeleteDialog(false)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    ⚠️ Xác nhận xóa hàng loạt
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Bạn sắp xóa <b>{selectedIds.length} giao dịch</b>. Hành động này <b>không thể hoàn tác</b> và sẽ ảnh hưởng đến số lượng tồn kho.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                        Chắc chắn muốn tiếp tục?
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button
                        onClick={() => setBulkDeleteDialog(false)}
                        color="inherit"
                        variant="outlined"
                        disabled={isBulkDeleting}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleBulkDelete}
                        color="error"
                        variant="contained"
                        disabled={isBulkDeleting}
                        startIcon={isBulkDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteIcon />}
                    >
                        {isBulkDeleting ? 'Đang xóa...' : `Xóa ${selectedIds.length} mục`}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>

    );
}

// Remove default export to avoid confusion
// export default Inbound;
