
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Autocomplete, Chip, Alert, Checkbox, Stack, Grid
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

import { fetchReturns, addReturns, deleteReturns } from '../../store/slices/returnsSlice';
import { fetchProducts } from '../../store/slices/productsSlice';
import type { RootState, AppDispatch } from '../../store';
import QRScanner from '../../components/QRScanner';
import ReturnsReportPreview from '../../components/Reports/ReturnsReportPreview';
import ProductSearchDialog from '../../components/ProductSearchDialog';
import { exportStandardReport } from '../../utils/excelUtils';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

const REASONS = ['Hàng tồn lâu', 'Hàng mới hỏng', 'Hàng thu hồi khách hàng rời mạng'];

const EmployeeReturns = () => {
    const dispatch = useDispatch<AppDispatch>();

    // Selectors
    const { items: returns } = useSelector((state: RootState) => state.returns);
    const { items: products } = useSelector((state: RootState) => state.products);
    const { profile } = useSelector((state: RootState) => state.auth);

    // Local State
    const [openCreate, setOpenCreate] = useState(false);
    const [openPreview, setOpenPreview] = useState(false);
    const [openScanner, setOpenScanner] = useState(false);
    const [openProductSearch, setOpenProductSearch] = useState(false);

    // Form State
    const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
    const [serials, setSerials] = useState<string[]>([]); // Changed to array
    const [manualSerial, setManualSerial] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [reason, setReason] = useState(REASONS[0]);
    // Allow Admin to choose employee, Staff is self
    const [selectedEmployee] = useState<string>(profile?.id || '');

    // Selection for Report
    const [selectedIds, setSelectedIds] = useState<string[]>([]);



    useEffect(() => {
        dispatch(fetchReturns());
        dispatch(fetchProducts());
    }, [dispatch]);

    // Derived Data
    const product = products.find(p => p.id === selectedProduct);
    const isAdmin = profile?.role === 'admin';
    const hasSerials = serials.length > 0;

    // Update quantity if serials are present
    useEffect(() => {
        if (hasSerials) {
            setQuantity(serials.length);
        }
    }, [serials, hasSerials]);

    const handleAddManualSerial = () => {
        if (manualSerial.trim()) {
            if (!serials.includes(manualSerial.trim())) {
                setSerials([...serials, manualSerial.trim()]);
                setManualSerial('');
            } else {
                alert('Serial này đã có trong danh sách!');
            }
        }
    };

    const handleRemoveSerial = (code: string) => {
        setSerials(serials.filter(s => s !== code));
    };

    const handleSave = async () => {
        if (!selectedProduct) {
            alert('Vui lòng chọn sản phẩm');
            return;
        }

        const p = products.find(prod => prod.id === selectedProduct);
        const isProductGoods = p?.category === 'Hàng hóa';

        // Validation
        if (isProductGoods) {
            if (serials.length === 0 && !manualSerial) {
                // Try manual serial as last resort if user forgot to click Add
                if (manualSerial) {
                    setSerials([manualSerial]); // Proceed with this logic? Better explicitly ask.
                    // But for UX, if simple input, let's just use it?
                    // If manualSerial is there but serials empty, treat as 1 item.
                } else {
                    alert('Hàng hóa yêu cầu phải có Serial!');
                    return;
                }
            }
        }

        // Prepare Data
        let returnsData: any[] = [];

        if (serials.length > 0) {
            // Priority to scanned serials
            returnsData = serials.map(code => ({
                product_id: selectedProduct,
                serial_code: code,
                quantity: 1, // Each serial is 1 unit
                reason: reason as any,
                unit_price: product?.unit_price || 0,
                employee_id: isAdmin ? selectedEmployee : profile?.id,
                created_by: profile?.auth_user_id
            }));
        } else if (manualSerial) {
            // Single manual serial
            returnsData.push({
                product_id: selectedProduct,
                serial_code: manualSerial,
                quantity: 1,
                reason: reason as any,
                unit_price: product?.unit_price || 0,
                employee_id: isAdmin ? selectedEmployee : profile?.id,
                created_by: profile?.auth_user_id
            });
        } else {
            // No serial (Non-goods), use Quantity
            returnsData.push({
                product_id: selectedProduct,
                serial_code: '',
                quantity: quantity,
                reason: reason as any,
                unit_price: product?.unit_price || 0,
                employee_id: isAdmin ? selectedEmployee : profile?.id,
                created_by: profile?.auth_user_id
            });
        }

        try {
            await dispatch(addReturns(returnsData)).unwrap();
            alert(`Đã tạo ${returnsData.length} phiếu trả hàng thành công!`);
            setOpenCreate(false);
            // Reset form
            setSelectedProduct(null);
            setSerials([]);
            setManualSerial('');
            setQuantity(1);
            setReason(REASONS[0]);
            dispatch(fetchReturns()); // Refresh
        } catch (error: any) {
            alert('Lỗi: ' + error.message);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(returns.map(r => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const previewData = returns
        .filter(r => selectedIds.includes(r.id))
        .map(r => ({
            item_code: r.product?.item_code,
            product_name: r.product?.name,
            unit: r.product?.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            serial_code: r.serial_code || '',
            reason: r.reason
        }));

    const previewEmployeeName = returns.find(r => selectedIds.includes(r.id))?.employee?.full_name || 'N/A';
    const receiverName = 'Võ Thanh Song';

    // --- Admin Handlers (Delete & Export) ---
    const handleDelete = async () => {
        if (!window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} phiếu trả hàng này không?`)) return;

        try {
            await dispatch(deleteReturns(selectedIds)).unwrap();
            alert('Đã xóa thành công!');
            setSelectedIds([]); // Clear selection
        } catch (error: any) {
            alert('Lỗi xóa: ' + error.message);
        }
    };

    const handleExportExcel = async () => {
        const dataToExport = returns.map((r, idx) => ({
            stt: idx + 1,
            created_at: new Date(r.created_at || r.return_date).toLocaleDateString('vi-VN'),
            employee: r.employee?.full_name || 'N/A',
            product_code: r.product?.item_code || '',
            product_name: r.product?.name || '',
            serial: r.serial_code || '',
            qty: r.quantity,
            price: r.unit_price,
            total: r.total_price,
            reason: r.reason
        }));

        const columns = [
            { header: 'STT', key: 'stt', width: 5, align: 'center' as const },
            { header: 'Ngày', key: 'created_at', width: 15, align: 'center' as const },
            { header: 'Nhân Viên', key: 'employee', width: 25 },
            { header: 'Mã Hàng', key: 'product_code', width: 15 },
            { header: 'Tên Hàng Hóa', key: 'product_name', width: 40 },
            { header: 'Serial', key: 'serial', width: 25 },
            { header: 'SL', key: 'qty', width: 5, align: 'center' as const },
            { header: 'Lý Do', key: 'reason', width: 20 },
        ];

        await exportStandardReport(
            dataToExport,
            `DS_TraHang_${new Date().getTime()}`,
            'DANH SÁCH TRẢ HÀNG',
            columns,
            profile?.full_name || 'Admin'
        );
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold" color="primary">
                    QUẢN LÝ TRẢ HÀNG (EMPLOYEE RETURNS)
                </Typography>
                <Stack direction="row" spacing={2}>
                    {isAdmin && (
                        <>
                            <Button
                                variant="contained"
                                color="success" // Excel color
                                startIcon={<FileDownloadIcon />}
                                onClick={handleExportExcel}
                            >
                                Xuất Excel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<DeleteIcon />}
                                disabled={selectedIds.length === 0}
                                onClick={handleDelete}
                            >
                                Xóa ({selectedIds.length})
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        disabled={selectedIds.length === 0}
                        onClick={() => setOpenPreview(true)}
                    >
                        In Biên Bản ({selectedIds.length})
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenCreate(true)}
                    >
                        Tạo Phiếu Trả
                    </Button>
                </Stack>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #eee' }}>
                <TableContainer>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={returns.length > 0 && selectedIds.length === returns.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell>Ngày Trả</TableCell>
                                <TableCell>Nhân Viên</TableCell>
                                <TableCell>Mã Hàng</TableCell>
                                <TableCell>Tên Hàng</TableCell>
                                <TableCell>Serial</TableCell>
                                <TableCell>Lý Do</TableCell>
                                <TableCell align="right">Số Lượng</TableCell>
                                <TableCell align="right">Đơn Giá</TableCell>
                                <TableCell align="right">Thành Tiền</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {returns.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                                        Chưa có dữ liệu trả hàng
                                    </TableCell>
                                </TableRow>
                            ) : (
                                returns.map((row) => (
                                    <TableRow key={row.id} hover selected={selectedIds.includes(row.id)}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={selectedIds.includes(row.id)}
                                                onChange={() => {
                                                    setSelectedIds(prev =>
                                                        prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(row.return_date).toLocaleDateString('vi-VN')}</TableCell>
                                        <TableCell>{row.employee?.full_name}</TableCell>
                                        <TableCell>{row.product?.item_code}</TableCell>
                                        <TableCell>{row.product?.name}</TableCell>
                                        <TableCell>{row.serial_code}</TableCell>
                                        <TableCell>
                                            <Chip label={row.reason} size="small" color={row.reason === 'Hàng mới hỏng' ? 'error' : 'default'} />
                                        </TableCell>
                                        <TableCell align="right">{row.quantity}</TableCell>
                                        <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(row.unit_price)}</TableCell>
                                        <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(row.total_price)}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Create Dialog */}
            <Dialog open={openCreate} onClose={() => setOpenCreate(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Tạo Phiếu Trả Hàng</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} pt={1}>
                        <Box display="flex" gap={1}>
                            <Autocomplete
                                fullWidth
                                options={products}
                                getOptionLabel={(option) => `${option.name} - ${option.item_code}`}
                                value={products.find(p => p.id === selectedProduct) || null}
                                onChange={(_, newValue) => setSelectedProduct(newValue?.id || null)}
                                renderInput={(params) => <TextField {...params} label="Chọn Vật Tư / Hàng Hóa" />}
                            />
                            <Button variant="outlined" onClick={() => setOpenProductSearch(true)} sx={{ minWidth: 50 }}>
                                <SearchIcon />
                            </Button>
                        </Box>

                        {/* Serial Input Area */}
                        <Box sx={{ p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
                            <Typography variant="subtitle2" gutterBottom>Danh sách Serial ({serials.length})</Typography>

                            <Grid container spacing={1} alignItems="center" mb={1}>
                                <Grid size={{ xs: 8 }}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Nhập/Quét Serial"
                                        value={manualSerial}
                                        onChange={(e) => setManualSerial(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddManualSerial();
                                            }
                                        }}
                                        helperText="Nhấn Enter để thêm"
                                    />
                                </Grid>
                                <Grid size={{ xs: 2 }}>
                                    <Button variant="contained" onClick={handleAddManualSerial} sx={{ height: 40, minWidth: 40 }}>
                                        <AddIcon />
                                    </Button>
                                </Grid>
                                <Grid size={{ xs: 2 }}>
                                    <Button variant="outlined" color="primary" onClick={() => setOpenScanner(true)} sx={{ height: 40, minWidth: 40 }}>
                                        <QrCodeScannerIcon />
                                    </Button>
                                </Grid>
                            </Grid>

                            {/* Serial List */}
                            <Box sx={{ maxHeight: 150, overflowY: 'auto' }}>
                                {serials.map((s, index) => (
                                    <Chip
                                        key={index}
                                        label={s}
                                        onDelete={() => handleRemoveSerial(s)}
                                        sx={{ m: 0.5 }}
                                    />
                                ))}
                                {serials.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" fontStyle="italic">Chưa có serial nào được thêm.</Typography>
                                )}
                            </Box>
                        </Box>


                        <TextField
                            label="Số Lượng"
                            type="number"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            inputProps={{ min: 1 }}
                            disabled={hasSerials} // Disable quantity editing if serials are present
                            helperText={hasSerials ? "Số lượng tự động tính theo số serial" : "Nhập số lượng (nếu không quản lý serial)"}
                        />

                        <TextField
                            select
                            label="Lý Do Trả"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            SelectProps={{ native: true }}
                        >
                            {REASONS.map((r) => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </TextField>

                        {product && (
                            <Alert severity="info" icon={false}>
                                Đơn giá vốn: {new Intl.NumberFormat('vi-VN').format(product.unit_price)} đ
                            </Alert>
                        )}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreate(false)}>Hủy</Button>
                    <Button variant="contained" onClick={handleSave}>Lưu Phiếu</Button>
                </DialogActions>
            </Dialog>

            {/* QR Scanner */}
            <Dialog open={openScanner} onClose={() => setOpenScanner(false)} fullWidth maxWidth="sm">
                <DialogContent sx={{ p: 0 }}>
                    <QRScanner
                        onScanSuccess={(decodedText) => {
                            // Split scannned text by space, newline, comma, semicolon
                            const newCodes = decodedText.split(/[\s,;\n]+/).map(s => s.trim()).filter(s => s !== '');

                            if (newCodes.length > 0) {
                                setSerials(prev => {
                                    const uniqueNew = newCodes.filter(c => !prev.includes(c));
                                    if (uniqueNew.length > 0) {
                                        // Optional: Toast message logic here?
                                        // Since we don't have local notification state in this component visible in Dialog?
                                        // Actually there is no notification state in EmployeeReturns.
                                        // Maybe just alert? Or silent add?
                                        // User asked for logic application "ap dung cho tat ca".
                                        // It implies "auto close" too.
                                        setTimeout(() => setOpenScanner(false), 200); // Small delay or immediate
                                        return [...prev, ...uniqueNew];
                                    }
                                    return prev;
                                });
                                // If duplications only? Close anyway?
                                setOpenScanner(false);
                            }
                        }}
                        onScanFailure={() => { }}
                    />
                    <Button fullWidth onClick={() => setOpenScanner(false)} sx={{ mt: 1 }}>Đóng (Hoàn tất quét)</Button>
                </DialogContent>
            </Dialog>

            {/* Product Search */}
            <ProductSearchDialog
                open={openProductSearch}
                onClose={() => setOpenProductSearch(false)}
                products={products}
                onSelect={(p) => {
                    setSelectedProduct(p.id);
                    setOpenProductSearch(false);
                }}
            />

            {/* Preview Report Dialog */}
            <Dialog open={openPreview} onClose={() => setOpenPreview(false)} maxWidth="lg" fullWidth scroll="body">
                <DialogTitle className="no-print">
                    Xem Trước Biên Bản
                </DialogTitle>
                <DialogContent>
                    <Box id="print-area">
                        <ReturnsReportPreview
                            data={previewData}
                            employeeName={previewEmployeeName}
                            date={new Date().toISOString()} // Print date is now
                            receiverName={receiverName}
                        />
                    </Box>
                </DialogContent>
                <DialogActions className="no-print">
                    <Button variant="contained" color="info" startIcon={<PrintIcon />} onClick={() => window.print()}>
                        In / Lưu PDF
                    </Button>
                    <Button onClick={() => setOpenPreview(false)}>
                        Đóng
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default EmployeeReturns;
