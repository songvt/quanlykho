
import {
    Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Autocomplete, Chip, Alert, Checkbox, Stack, Grid, useTheme, useMediaQuery,
    Card, CardContent, Tooltip, CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import DeleteIcon from '@mui/icons-material/Delete';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

import { fetchReturns, addReturns, deleteReturns } from '../../store/slices/returnsSlice';
import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchInventory, selectStockMap } from '../../store/slices/inventorySlice';
import { fetchTransactions } from '../../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../../store';
import QRScanner from '../../components/QRScanner';
import ReturnsReportPreview from '../../components/Reports/ReturnsReportPreview';
import ProductSearchDialog from '../../components/ProductSearchDialog';
import { exportStandardReport } from '../../utils/excelUtils';
import { parseSerialInput, filterNewSerials } from '../../utils/serialParser';
import { useNotification } from '../../contexts/NotificationContext';
import SerialChips from '../../components/Common/SerialChips';
import TableSkeleton from '../../components/Common/TableSkeleton';
import { playBeep } from '../../utils/audio';
import { useScanDetection } from '../../hooks/useScanDetection';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { usePermission } from '../../hooks/usePermission';
import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GoogleSheetService } from '../../services/GoogleSheetService';

const REASONS = ['Hàng tồn lâu', 'Hàng mới hỏng', 'Hàng thu hồi khách hàng rời mạng', 'Trả hàng KH nâng cấp Mesh'];

const sendTelegramNotification = async (
    title: string,
    transactions: any[],
    productsMap: Record<string, string>,
    employeeName: string
) => {
    if (!transactions || transactions.length === 0) return;

    try {
        const groups: Record<string, any> = {};
        transactions.forEach(t => {
            const pId = t.product_id;
            const pName = productsMap[pId] || 'Unknown';
            const reason = t.reason || '';
            const key = `${pId}_${employeeName}_${reason}`;
            if (!groups[key]) {
                groups[key] = { pName, receiver: employeeName, reason, qty: 0, serials: [] };
            }
            groups[key].qty += Number(t.quantity || 1);
            if (t.serial_code) groups[key].serials.push(t.serial_code);
        });

        const escapeHtml = (text: string) => {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        };

        let msg = `✅ <b>${escapeHtml(title)}</b>\n`;
        msg += `📅 Ngày: ${new Date().toLocaleString('vi-VN')}\n\n`;

        Object.values(groups).forEach(g => {
            msg += `👤 Nhân viên trả: <b>${escapeHtml(g.receiver)}</b>\n`;
            msg += `📦 Sản phẩm: <b>${escapeHtml(g.pName)}</b>\n`;
            msg += `🔢 Số lượng: <b>${g.qty}</b>\n`;
            if (g.serials.length > 0) {
                msg += `🔤 Serial: ${escapeHtml(g.serials.slice(0, 10).join(', '))}${g.serials.length > 10 ? `... (+${g.serials.length - 10} nữa)` : ''}\n`;
            }
            if (g.reason) {
                msg += `📝 Lý do: <i>${escapeHtml(g.reason)}</i>\n`;
            }
            msg += `---------------------\n`;
        });

        const txIds = transactions.map(t => t.id).filter(id => id && !id.startsWith('temp-')).slice(0, 3).join(', ');
        if (txIds) msg += `🆔 Mã GD: <code>${escapeHtml(txIds)}${transactions.length > 3 ? '...' : ''}</code>`;

        const response = await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: msg })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Telegram API Error:', err);
        }
    } catch (error) {
        console.error('Failed to send telegram message:', error);
    }
};

const EmployeeReturns = () => {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Selectors
    const { items: returns, status: returnsStatus } = useSelector((state: RootState) => state.returns);
    const { items: products } = useSelector((state: RootState) => state.products);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { status: inventoryStatus } = useSelector((state: RootState) => state.inventory);
    const stockMap = useSelector(selectStockMap);
    const { hasPermission } = usePermission();
    const { success, error: notifyError } = useNotification();

    // Scan Detection
    useScanDetection((code: string) => {
        const p = products.find(prod => prod.id === selectedProduct);
        if (p?.category?.toLowerCase() === 'hàng hóa') {
            const scannedSerials = parseSerialInput(code);
            if (scannedSerials.length > 0) {
                playBeep(800);
                setSerials(prev => {
                    const uniqueNew = filterNewSerials(scannedSerials, prev);
                    return [...prev, ...uniqueNew];
                });
            }
        }
    }, { minLength: 3 });

    // Local State
    const [openCreate, setOpenCreate] = useState(false);
    const [openPreview, setOpenPreview] = useState(false);
    const [openScanner, setOpenScanner] = useState(false);
    const [openProductSearch, setOpenProductSearch] = useState(false);
    const [isUploadingDrive, setIsUploadingDrive] = useState(false);
    const [resolvedReceiverName, setResolvedReceiverName] = useState('');

    const handleUploadDrive = async () => {
        const element = document.getElementById('returns-report-content');
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
            
            // Employee name for naming
            const empName = previewEmployeeName.replace(/\s+/g, '_');
            const fileName = `BBNK_${empName}_${dateStr}.pdf`;

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
        if (inventoryStatus === 'idle') dispatch(fetchInventory());
    }, [inventoryStatus, dispatch]);

    // Derived Data
    const product = products.find(p => p.id === selectedProduct);
    const isAdmin = profile?.role === 'admin';
    const hasSerials = serials.length > 0;

    const visibleReturns = useMemo(() => {
        if (isAdmin) return returns;
        return returns.filter(r => r.employee?.full_name === profile?.full_name || r.employee_id === profile?.id || r.created_by === profile?.auth_user_id);
    }, [returns, isAdmin, profile]);


    // Update quantity if serials are present
    useEffect(() => {
        if (hasSerials) {
            setQuantity(serials.length);
        }
    }, [serials, hasSerials]);

    const handleScanSuccess = useCallback((decodedText: string) => {
        const newCodes = parseSerialInput(decodedText);
        if (newCodes.length > 0) {
            setSerials(prev => {
                const uniqueNew = filterNewSerials(newCodes, prev);
                if (uniqueNew.length > 0) {
                    success(`Đã quét thành công: ${uniqueNew.length} serial`);
                    return [...prev, ...uniqueNew];
                } else {
                    notifyError("Serial này đã có trong danh sách.");
                    return prev;
                }
            });
            setOpenScanner(false);
        }
    }, [success, notifyError]);

    const handleAddManualSerial = () => {
        if (!manualSerial.trim()) return;
        handleScanSuccess(manualSerial);
        setManualSerial('');
    };

    const handleRemoveSerial = (code: string) => {
        setSerials(serials.filter(s => s !== code));
    };

    const handleSave = async () => {
        if (!selectedProduct) {
            notifyError('Vui lòng chọn sản phẩm');
            return;
        }

        const p = products.find(prod => prod.id === selectedProduct);
        const isProductGoods = p?.category?.toLowerCase() === 'hàng hóa';

        // Validation
        if (isProductGoods) {
            if (serials.length === 0 && !manualSerial.trim()) {
                notifyError('Hàng hóa yêu cầu phải có Serial!');
                return;
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
            const createdReturns = await dispatch(addReturns(returnsData)).unwrap();
            success(`Đã tạo ${returnsData.length} phiếu trả hàng thành công!`);
            
            // Notification
            const productsMap: Record<string, string> = {};
            products.forEach(p => productsMap[p.id] = p.name);
            const dataToNotify = Array.isArray(createdReturns) && createdReturns.length > 0 ? createdReturns : returnsData;
            sendTelegramNotification('TRẢ KHO THÀNH CÔNG', dataToNotify, productsMap, profile?.full_name || profile?.username || 'Unknown');

            setOpenCreate(false);
            // Reset form
            setSelectedProduct(null);
            setSerials([]);
            setManualSerial('');
            setQuantity(1);
            setReason(REASONS[0]);
            dispatch(fetchReturns());
            dispatch(fetchTransactions());
            dispatch(fetchInventory());
        } catch (error: any) {
            notifyError('Lỗi: ' + error.message);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(visibleReturns.map((r: any) => r.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const previewData = visibleReturns
        .filter((r: any) => selectedIds.includes(r.id))
        .map((r: any) => ({
            item_code: r.product?.item_code,
            product_name: r.product?.name,
            unit: r.product?.unit,
            quantity: r.quantity,
            unit_price: r.unit_price,
            serial_code: r.serial_code || '',
            reason: r.reason
        }));

    const previewEmployeeName = visibleReturns.find((r: any) => selectedIds.includes(r.id))?.employee?.full_name || 'N/A';
    const receiverName = resolvedReceiverName || 'Võ Thanh Song';

    // --- Admin Handlers (Delete & Export) ---
    const handleDelete = async () => {
        try {
            await dispatch(deleteReturns(selectedIds)).unwrap();
            success(`Đã xóa ${selectedIds.length} phiếu trả hàng thành công!`);
            setSelectedIds([]);
        } catch (error: any) {
            notifyError('Lỗi xóa: ' + error.message);
        }
    };

    const handleExportExcel = async () => {
        const dataToExport = visibleReturns.map((r: any, idx: number) => ({
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
        <Box p={{ xs: 1, sm: 3 }}>
            <Box display="flex" flexDirection={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3} gap={2}>
                <Typography variant="h5" fontWeight="bold" color="primary" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                    QUẢN LÝ TRẢ HÀNG (EMPLOYEE RETURNS)
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
                    {isAdmin && (
                        <>
                            <Button
                                variant="contained"
                                color="success" // Excel color
                                startIcon={<FileDownloadIcon />}
                                onClick={handleExportExcel}
                                fullWidth={isMobile}
                            >
                                Xuất Excel
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<DeleteIcon />}
                                disabled={selectedIds.length === 0}
                                onClick={handleDelete}
                                fullWidth={isMobile}
                            >
                                Xóa ({selectedIds.length})
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<PrintIcon />}
                        disabled={selectedIds.length === 0}
                        onClick={async () => {
                            let rName = 'Võ Thanh Song';
                            try {
                                const districtConfigs = await GoogleSheetService.getDistrictStorekeepers();
                                const firstTx = visibleReturns.find((r: any) => selectedIds.includes(r.id));
                                const empDistrict = firstTx?.employee?.district || '';
                                if (empDistrict) {
                                    const { matchDistrict } = await import('../../utils/format');
                                    const config = districtConfigs.find((c: any) => matchDistrict(empDistrict, c.district));
                                    if (config) {
                                        rName = config.storekeeper_name;
                                    }
                                }
                            } catch(e) { console.error('Failed to resolve storekeeper', e); }
                            setResolvedReceiverName(rName);
                            setOpenPreview(true);
                        }}
                        fullWidth={isMobile}
                    >
                        In Biên Bản ({selectedIds.length})
                    </Button>


                    {hasPermission('returns.create') && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setOpenCreate(true)}
                            fullWidth={isMobile}
                        >
                            Tạo Phiếu Trả
                        </Button>
                    )}
                </Stack>
            </Box>


            {isMobile ? (
                // Mobile View: Cards
                <Stack spacing={2}>
                    {visibleReturns.length === 0 ? (
                        <Typography align="center" py={4} color="text.secondary">Chưa có dữ liệu trả hàng</Typography>
                    ) : (
                        visibleReturns.map((row: any) => (
                            <Card key={row.id} variant="outlined" sx={{ position: 'relative', bgcolor: selectedIds.includes(row.id) ? 'action.selected' : 'background.paper' }}>
                                <CardContent sx={{ pb: 1 }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                        <Checkbox
                                            checked={selectedIds.includes(row.id)}
                                            onChange={() => handleSelectOne(row.id)}
                                            sx={{ p: 0, mr: 1 }}
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            {new Date(row.return_date).toLocaleDateString('vi-VN')}
                                        </Typography>
                                    </Box>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        {row.product?.name}
                                    </Typography>
                                    <Stack spacing={0.5} mt={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Mã: <Box component="span" color="text.primary">{row.product?.item_code}</Box>
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            NV: <Box component="span" color="text.primary">{row.employee?.full_name}</Box>
                                        </Typography>
                                        {row.serial_code && (
                                            <Typography variant="body2" color="text.secondary">
                                                Serial: <Box component="span" color="primary.main" fontWeight={500}>{row.serial_code}</Box>
                                            </Typography>
                                        )}
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body2" color="text.secondary">
                                                SL: <Box component="span" fontWeight="bold">{row.quantity}</Box>
                                            </Typography>
                                            <Chip label={row.reason} size="small" color={row.reason === 'Hàng mới hỏng' ? 'error' : 'default'} sx={{ height: 24, fontSize: '0.75rem' }} />
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </Stack>
            ) : (
                // Desktop View: Table
                <Paper elevation={0} sx={{ border: '1px solid #eee' }}>
                    <TableContainer>
                        <Table>
                            <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={visibleReturns.length > 0 && selectedIds.length === visibleReturns.length}
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
                                {returnsStatus === 'loading' ? (
                                    <TableSkeleton columns={10} rows={10} />
                                ) : visibleReturns.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} align="center" sx={{ py: 3 }}>
                                            Chưa có dữ liệu trả hàng
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    visibleReturns.map((row: any) => (
                                        <TableRow key={row.id} hover selected={selectedIds.includes(row.id)}>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={selectedIds.includes(row.id)}
                                                    onChange={() => handleSelectOne(row.id)}
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
            )}

            {/* Create Dialog */}
            <Dialog
                open={openCreate}
                onClose={() => setOpenCreate(false)}
                maxWidth="sm"
                fullWidth
                fullScreen={isMobile}
            >
                <DialogTitle>Tạo Phiếu Trả Hàng</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} pt={1}>
                        <Box display="flex" gap={1}>
                            <Autocomplete
                                fullWidth
                                options={products}
                                getOptionLabel={(option) => `${option.name} (${option.item_code}) - Tồn: ${stockMap[option.id] || 0}`}
                                value={products.find(p => p.id === selectedProduct) || null}
                                onChange={(_, newValue) => setSelectedProduct(newValue?.id || null)}
                                renderInput={(params) => <TextField {...params} label="Chọn Vật Tư / Hàng Hóa" />}
                            />
                            <Button variant="outlined" onClick={() => setOpenProductSearch(true)} sx={{ minWidth: 50 }}>
                                <SearchIcon />
                            </Button>
                        </Box>

                        {/* Serial Input Area */}
                        {product?.category?.toLowerCase() === 'hàng hóa' && (
                            <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'grey.50' }}>
                                <Typography variant="subtitle2" gutterBottom fontWeight="bold">Quét/Nhập Serial ({serials.length})</Typography>

                                <Grid container spacing={1} alignItems="center" mb={2}>
                                    <Grid size={8}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Serial Code"
                                            value={manualSerial}
                                            onChange={(e) => setManualSerial(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddManualSerial();
                                                }
                                            }}
                                            placeholder="Quét mã..."
                                        />
                                    </Grid>
                                    <Grid size={2}>
                                        <Tooltip title="Thêm">
                                            <Button variant="contained" onClick={handleAddManualSerial} sx={{ height: 40, minWidth: 40, p: 0, borderRadius: 2 }}>
                                                <AddIcon />
                                            </Button>
                                        </Tooltip>
                                    </Grid>
                                    <Grid size={2}>
                                        <Tooltip title="Mở Camera">
                                            <Button variant="outlined" color="primary" onClick={() => setOpenScanner(true)} sx={{ height: 40, minWidth: 40, p: 0, borderRadius: 2 }}>
                                                <QrCodeScannerIcon />
                                            </Button>
                                        </Tooltip>
                                    </Grid>
                                </Grid>

                                <SerialChips
                                    serials={serials}
                                    onRemove={handleRemoveSerial}
                                    maxVisible={8}
                                />
                                
                                {serials.length === 0 && (
                                    <Typography variant="caption" color="text.secondary" display="block" textAlign="center" py={1}>
                                        Chưa có serial nào. Số lượng sẽ lấy theo số serial.
                                    </Typography>
                                )}
                            </Box>
                        )}


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
            <Dialog open={openScanner} onClose={() => setOpenScanner(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
                <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', color: 'primary.main' }}>
                    QUÉT MÃ TRẢ KHO
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <QRScanner
                        onScanSuccess={handleScanSuccess}
                        onScanFailure={() => { }}
                    />
                    <Box p={2} textAlign="center">
                        <Button variant="outlined" onClick={() => setOpenScanner(false)}>Đóng Camera</Button>
                    </Box>
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
                    <Box id="returns-report-content" sx={{ p: 1, bgcolor: 'white' }}>
                        <ReturnsReportPreview
                            data={previewData}
                            employeeName={previewEmployeeName}
                            date={new Date().toISOString()} // Print date is now
                            receiverName={receiverName}
                        />
                    </Box>
                </DialogContent>
                <DialogActions className="no-print">
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
                    <Button variant="contained" color="info" startIcon={<PrintIcon />} onClick={() => window.print()}>
                        In Ngay
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
