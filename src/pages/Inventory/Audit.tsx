import React, { useState, useEffect, useMemo } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, TextField, Button,
    Chip, Alert, Snackbar, CircularProgress, IconButton, TablePagination, Autocomplete, Grid, Dialog, DialogTitle, DialogContent,
    useTheme, useMediaQuery, Card, CardContent, Divider, Stack
} from '@mui/material';
import { Save as SaveIcon, Print as PrintIcon } from '@mui/icons-material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import InventoryIcon from '@mui/icons-material/Inventory';
import CloseIcon from '@mui/icons-material/Close';
import { AppButton } from '../../components/Common/AppButton';
import PageHeader from '../../components/Common/PageHeader';
import QRScanner from '../../components/QRScanner';
import { playBeep } from '../../utils/audio';
import { parseSerialInput, filterNewSerials } from '../../utils/serialParser';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { selectStockMap, selectDetailedStockMap } from '../../store/slices/inventorySlice';
import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchTransactions } from '../../store/slices/transactionsSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import { useNotification } from '../../contexts/NotificationContext';

interface AuditItem {
    product_id: string;
    item_code: string;
    name: string;
    category: string;
    system_qty: number;
    actual_qty: number | string;
    discrepancy: number;
    notes: string;
    scanned_serials: string[];
}

const Audit: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const products = useSelector((state: RootState) => state.products.items);
    const prodStatus = useSelector((state: RootState) => state.products.status);
    const transStatus = useSelector((state: RootState) => state.transactions.status);
    const { items: employees, status: empStatus } = useSelector((state: RootState) => state.employees);
    const stockMap = useSelector(selectStockMap);
    const detailedStockMap = useSelector(selectDetailedStockMap);
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role?.toLowerCase() === 'admin';
    const { success, error: notifyError } = useNotification();
    
    const [auditItems, setAuditItems] = useState<AuditItem[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(!isAdmin && profile ? profile.id : '');
    const [openScannerFor, setOpenScannerFor] = useState<string | null>(null);
    
    // Pagination state
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);

    const paginatedItems = useMemo(() => {
        return auditItems.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }, [auditItems, page, rowsPerPage]);

    useEffect(() => {
        if (prodStatus === 'idle') dispatch(fetchProducts());
        if (transStatus === 'idle') dispatch(fetchTransactions());
        if (empStatus === 'idle') dispatch(fetchEmployees());
    }, [prodStatus, transStatus, empStatus, dispatch]);

    const targetEmployee = employees.find(e => e.id === selectedEmployeeId);
    const targetDistrict = targetEmployee?.district || (isAdmin && !selectedEmployeeId ? '' : profile?.district || '');

    const getSystemQty = (productId: string) => {
        if (isAdmin && !selectedEmployeeId) {
            return stockMap[productId] || 0; // Total warehouse stock
        }
        // Specific district stock
        return detailedStockMap[`${productId}|${targetDistrict}|*ALL*`] || 0;
    };

    useEffect(() => {
        if (products.length > 0) {
            // Recalculate everything when district changes or data loads
            const newAuditItems: AuditItem[] = products.map(p => {
                const sysQty = getSystemQty(p.id);
                return {
                    product_id: p.id,
                    item_code: p.item_code,
                    name: p.name,
                    category: p.category || '',
                    system_qty: sysQty,
                    actual_qty: '',
                    discrepancy: 0,
                    notes: '',
                    scanned_serials: [] as string[]
                };
            }).filter(item => item.system_qty > 0); // CHỈ HIỂN THỊ CÁC MẶT HÀNG CÓ TỒN KHO > 0
            
            // Preserve entered values if any
            setAuditItems(prevItems => {
                if (prevItems.length === 0) return newAuditItems;
                
                const prevMap = new Map(prevItems.map(i => [i.product_id, i]));
                return newAuditItems.map(newItem => {
                    const existing = prevMap.get(newItem.product_id);
                    if (existing && (existing.actual_qty !== '' || existing.scanned_serials?.length > 0)) {
                        return {
                            ...newItem,
                            actual_qty: existing.actual_qty,
                            discrepancy: existing.actual_qty !== '' ? Number(existing.actual_qty) - newItem.system_qty : 0,
                            notes: existing.notes,
                            scanned_serials: existing.scanned_serials || []
                        };
                    }
                    return newItem;
                });
            });

            if (!title) {
                const empName = targetEmployee ? ` (${targetEmployee.full_name})` : '';
                setTitle(`Phiếu kiểm kê ngày ${new Date().toLocaleDateString('vi-VN')}${empName}`);
            }
        }
    }, [products, stockMap, detailedStockMap, selectedEmployeeId, targetDistrict]);

    const handleQtyChange = (productId: string, value: string) => {
        const val = value === '' ? '' : Number(value);
        setAuditItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                return {
                    ...item,
                    actual_qty: val,
                    discrepancy: val === '' ? 0 : (val as number) - item.system_qty
                };
            }
            return item;
        }));
    };

    const handleAddSerial = (productId: string, serial: string) => {
        const codes = parseSerialInput(serial);
        if (codes.length === 0) return;

        setAuditItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                const newSerials = filterNewSerials(codes, item.scanned_serials || []);
                if (newSerials.length > 0) {
                    const updatedSerials = [...(item.scanned_serials || []), ...newSerials];
                    const newActualQty = updatedSerials.length;
                    playBeep(800);
                    return {
                        ...item,
                        scanned_serials: updatedSerials,
                        actual_qty: newActualQty,
                        discrepancy: newActualQty - item.system_qty
                    };
                } else {
                    notifyError("Mã serial này đã được quét.");
                }
            }
            return item;
        }));
    };

    const handleNoteChange = (productId: string, value: string) => {
        setAuditItems(prev => prev.map(item => {
            if (item.product_id === productId) {
                return { ...item, notes: value };
            }
            return item;
        }));
    };

    const handleSave = async () => {
        const checkedItems = auditItems.filter(i => i.actual_qty !== '');
        if (checkedItems.length === 0) {
            notifyError('Vui lòng nhập số lượng thực tế cho ít nhất 1 vật tư để kiểm kê.');
            return;
        }

        if (!title.trim()) {
            notifyError('Vui lòng nhập tên phiếu kiểm kê.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                title,
                created_by: profile?.email || profile?.id,
                status: 'completed',
                details: checkedItems.map(item => ({
                    product_id: item.product_id,
                    item_code: item.item_code,
                    name: item.name,
                    system_qty: item.system_qty,
                    actual_qty: item.actual_qty,
                    discrepancy: item.discrepancy,
                    notes: item.notes,
                    scanned_serials: item.scanned_serials || []
                }))
            };

            const res = await fetch('/api/audits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                throw new Error(result.error || 'Lỗi lưu phiếu kiểm kê');
            }

            success('Đã lưu phiếu kiểm kê thành công!');
            
            // Auto print after successful save
            handlePrint(checkedItems);
            
            // Reset for next audit
            setAuditItems(products.map(p => ({
                product_id: p.id,
                item_code: p.item_code,
                name: p.name,
                category: p.category || '',
                system_qty: stockMap[p.id] || 0,
                actual_qty: '' as number | '',
                discrepancy: 0,
                notes: '',
                scanned_serials: [] as string[]
            })));

        } catch (error: any) {
            console.error(error);
            notifyError(error.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = (itemsToPrint = auditItems.filter(i => i.actual_qty !== '')) => {
        if (itemsToPrint.length === 0) {
            notifyError('Chưa có dữ liệu vật tư nào được kiểm kê để in.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            notifyError('Vui lòng cho phép popup để in biên bản.');
            return;
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Biên Bản Kiểm Kê</title>
                <style>
                    body { font-family: "Times New Roman", Times, serif; padding: 20px; color: #000; line-height: 1.4; }
                    .print-container { width: 100%; max-width: 1000px; margin: 0 auto; }
                    .company-header { display: flex; justify-content: space-between; margin-bottom: 30px; align-items: flex-start; }
                    .company-left { text-align: center; width: 45%; }
                    .company-right { text-align: center; width: 50%; }
                    .company-name { font-weight: bold; font-size: 13pt; text-transform: uppercase; margin: 0; }
                    .company-sub { font-weight: bold; font-size: 11pt; margin: 2px 0; }
                    .header-line { width: 60px; height: 1px; background: #000; margin: 5px auto; }
                    
                    .report-title { text-align: center; margin-bottom: 25px; margin-top: 10px; }
                    .report-title h1 { margin: 0; font-size: 20pt; text-transform: uppercase; font-weight: bold; }
                    .report-title p { margin: 5px 0; font-size: 12pt; font-style: italic; }
                    
                    .info-section { margin-bottom: 20px; font-size: 12pt; }
                    .info-row { margin-bottom: 5px; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11pt; }
                    th, td { border: 1px solid #000; padding: 8px 5px; text-align: center; }
                    th { background-color: #f2f2f2; font-weight: bold; text-transform: uppercase; }
                    .text-left { text-align: left; padding-left: 8px; }
                    
                    .signature-section { display: flex; justify-content: space-between; margin-top: 40px; page-break-inside: avoid; }
                    .signature-box { text-align: center; width: 30%; }
                    .signature-title { font-weight: bold; font-size: 12pt; margin-bottom: 80px; }
                    .signature-name { font-weight: bold; text-transform: uppercase; }
                    
                    @media print {
                        @page { size: A4 portrait; margin: 15mm; }
                        body { padding: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="company-header">
                        <div class="company-left">
                            <p class="company-name">CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</p>
                            <p class="company-sub">TRUNG TÂM ACT BẮC SÀI GÒN</p>
                            <div class="header-line"></div>
                        </div>
                        <div class="company-right">
                            <p class="company-name">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                            <p class="company-sub">Độc lập - Tự do - Hạnh phúc</p>
                            <div class="header-line"></div>
                        </div>
                    </div>

                    <div class="report-title">
                        <h1>BIÊN BẢN KIỂM KÊ VẬT TƯ</h1>
                        <p>(Thời điểm kiểm kê: ${new Date().toLocaleTimeString('vi-VN')} ngày ${new Date().toLocaleDateString('vi-VN')})</p>
                    </div>
                    
                    <div class="info-section">
                        <div class="info-row"><strong>Tiêu đề:</strong> ${title || 'Kiểm kê định kỳ'}</div>
                        <div class="info-row"><strong>Kho/Khu vực:</strong> ${targetDistrict || 'Tổng kho'}</div>
                        <div class="info-row"><strong>Người thực hiện:</strong> ${profile?.full_name || profile?.email || 'Nhân viên'}</div>
                    </div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th width="40">STT</th>
                                <th width="100">Mã vật tư</th>
                                <th class="text-left">Tên vật tư hàng hóa</th>
                                <th width="80">Tồn hệ thống</th>
                                <th width="80">Thực tế</th>
                                <th width="60">Chênh lệch</th>
                                <th width="150">Ghi chú / Serial</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${itemsToPrint.map((item, index) => `
                                <tr>
                                    <td>${index + 1}</td>
                                    <td>${item.item_code}</td>
                                    <td class="text-left">${item.name}</td>
                                    <td>${item.system_qty}</td>
                                    <td><strong>${item.actual_qty}</strong></td>
                                    <td style="color: ${item.discrepancy !== 0 ? (item.discrepancy > 0 ? 'blue' : 'red') : 'black'}">
                                        ${item.discrepancy !== 0 ? (item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy) : '0'}
                                    </td>
                                    <td class="text-left" style="font-size: 9pt;">
                                        ${item.notes || ''}
                                        ${(item.scanned_serials?.length || 0) > 0 ? `<div style="margin-top:2px;">SN: ${item.scanned_serials.join(', ')}</div>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="signature-section">
                        <div class="signature-box">
                            <div class="signature-title">Người kiểm kê</div>
                            <div class="signature-name">${profile?.full_name || ''}</div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-title">Thủ kho</div>
                            <div class="signature-name"></div>
                        </div>
                        <div class="signature-box">
                            <div class="signature-title">Trưởng đơn vị</div>
                            <div class="signature-name"></div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        
        printWindow.onload = () => {
            printWindow.focus();
            printWindow.print();
        };
    };

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', pb: 8 }}>
            {(prodStatus === 'loading' || transStatus === 'loading') && (
                <Box sx={{ width: '100%', mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" align="center" mb={1}>
                        Đang đồng bộ dữ liệu tồn kho...
                    </Typography>
                    <CircularProgress size={24} sx={{ display: 'block', mx: 'auto' }} />
                </Box>
            )}
            <PageHeader 
                title="Bảng Kiểm Kê Vật Tư"
                subtitle="Dành cho nhân viên kiểm kê số lượng thực tế tại kho so với hệ thống"
                icon={<InventoryIcon sx={{ fontSize: 30, color: 'white' }} />}
                gradientType="slate"
                actions={
                    <>
                        <AppButton 
                            variant="contained" 
                            onClick={() => handlePrint()}
                            sx={{ 
                                bgcolor: 'rgba(255, 255, 255, 0.15)', 
                                color: '#ffffff',
                                backdropFilter: 'blur(12px)',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                width: 46,
                                height: 46,
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.25)',
                                    transform: 'translateY(-2px)'
                                },
                                '&:active': { transform: 'scale(0.95)' }
                            }}
                            icon={<PrintIcon />}
                            title="In Biên Bản"
                        />
                        <AppButton 
                            variant="contained" 
                            onClick={handleSave}
                            disabled={isSaving}
                            sx={{ 
                                bgcolor: '#ffffff', 
                                color: '#334155',
                                width: 46,
                                height: 46,
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                    bgcolor: '#f8fafc',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 4px 12px rgba(255,255,255,0.2)'
                                },
                                '&:disabled': {
                                    bgcolor: 'rgba(255,255,255,0.3)',
                                    color: 'rgba(255,255,255,0.5)'
                                },
                                '&:active': { transform: 'scale(0.95)' }
                            }}
                            icon={<SaveIcon />}
                            title={isSaving ? 'Đang lưu...' : 'Lưu & In'}
                        />
                    </>
                }
            />

            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: isAdmin ? 8 : 12 }}>
                        <TextField 
                            label="Tên phiếu kiểm kê" 
                            variant="outlined" 
                            fullWidth 
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </Grid>
                    {isAdmin && (
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Autocomplete
                                fullWidth
                                options={employees}
                                getOptionLabel={(option) => `${option.full_name} (${option.district || 'Chưa gán kho'})`}
                                value={employees.find(e => e.id === selectedEmployeeId) || null}
                                onChange={(_, newValue) => {
                                    setSelectedEmployeeId(newValue?.id || '');
                                    setAuditItems([]); // Reset items to force re-render with new filter
                                }}
                                renderInput={(params) => <TextField {...params} label="Lọc tồn kho theo Nhân viên" />}
                            />
                        </Grid>
                    )}
                </Grid>
            </Paper>

            {isMobile ? (
                <Stack spacing={2}>
                    {paginatedItems.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                            <Typography color="text.secondary">
                                Không có dữ liệu tồn kho.
                            </Typography>
                        </Paper>
                    ) : (
                        paginatedItems.map((item) => (
                            <Card key={item.product_id} variant="outlined" sx={{ borderRadius: '16px', borderColor: '#e2e8f0', p: 2 }}>
                                <Stack spacing={1.5}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                        <Box sx={{ maxWidth: '70%' }}>
                                            <Typography variant="subtitle2" fontWeight="bold" sx={{ wordBreak: 'break-word' }}>
                                                {item.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                                Mã VT: <b>{item.item_code}</b>
                                            </Typography>
                                        </Box>
                                        <Chip 
                                            label={`Tồn HT: ${item.system_qty}`} 
                                            size="small" 
                                            sx={{ fontWeight: 600, bgcolor: '#f1f5f9' }} 
                                        />
                                    </Stack>

                                    <Divider />

                                    <Grid container spacing={2} alignItems="center">
                                        <Grid size={{ xs: 6 }}>
                                            <TextField 
                                                size="small" 
                                                type="number"
                                                label="Thực tế"
                                                value={item.actual_qty}
                                                onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                                                inputProps={{ min: 0 }}
                                                fullWidth
                                                placeholder="Số lượng..."
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 6 }} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                                                Lệch:
                                            </Typography>
                                            {item.actual_qty !== '' ? (
                                                <Typography 
                                                    fontWeight={700} 
                                                    color={item.discrepancy > 0 ? 'success.main' : item.discrepancy < 0 ? 'error.main' : 'text.primary'}
                                                >
                                                    {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                                                </Typography>
                                            ) : (
                                                <Typography color="text.secondary">-</Typography>
                                            )}
                                        </Grid>
                                    </Grid>

                                    {item.category?.toLowerCase() === 'hàng hóa' && (
                                        <Box display="flex" flexDirection="column" gap={0.5}>
                                            <Box display="flex" gap={0.5}>
                                                <TextField
                                                    size="small"
                                                    placeholder="Quét mã..."
                                                    fullWidth
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const val = (e.target as HTMLInputElement).value;
                                                            if (val.trim()) {
                                                                handleAddSerial(item.product_id, val.trim());
                                                                (e.target as HTMLInputElement).value = '';
                                                            }
                                                        }
                                                    }}
                                                />
                                                <IconButton 
                                                    color="primary" 
                                                    onClick={() => setOpenScannerFor(item.product_id)}
                                                    sx={{ 
                                                        border: '1px solid #e2e8f0', 
                                                        borderRadius: '8px', 
                                                        width: 40, 
                                                        height: 40 
                                                    }}
                                                >
                                                    <QrCodeScannerIcon />
                                                </IconButton>
                                            </Box>
                                            {(item.scanned_serials?.length || 0) > 0 && (
                                                <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>
                                                    Đã quét: <b>{item.scanned_serials.length}</b> serial ({item.scanned_serials.join(', ')})
                                                </Typography>
                                            )}
                                        </Box>
                                    )}

                                    <TextField 
                                        size="small" 
                                        fullWidth
                                        placeholder="Hỏng, thất lạc, đếm dư..."
                                        label="Ghi chú / Tình trạng"
                                        value={item.notes}
                                        onChange={(e) => handleNoteChange(item.product_id, e.target.value)}
                                    />
                                </Stack>
                            </Card>
                        ))
                    )}
                </Stack>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 2, border: '1px solid #e2e8f0' }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, width: '10%' }}>Mã VT</TableCell>
                                <TableCell sx={{ fontWeight: 700, width: '20%' }}>Tên vật tư</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, width: '10%' }}>Tồn HT</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, width: '10%' }}>Thực Tế</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, width: '10%' }}>Lệch</TableCell>
                                <TableCell sx={{ fontWeight: 700, width: '20%' }}>Serial / Quét QR</TableCell>
                                <TableCell sx={{ fontWeight: 700, width: '20%' }}>Ghi chú / Tình trạng</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paginatedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        Không có dữ liệu tồn kho.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedItems.map((item) => (
                                    <TableRow key={item.product_id} hover>
                                        <TableCell sx={{ fontWeight: 500 }}>{item.item_code}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                        <TableCell align="center">
                                            <Chip label={item.system_qty} color="default" sx={{ fontWeight: 600, minWidth: 60 }} />
                                        </TableCell>
                                        <TableCell align="center">
                                            <TextField 
                                                size="small" 
                                                type="number"
                                                value={item.actual_qty}
                                                onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                                                inputProps={{ min: 0 }}
                                                sx={{ width: 100 }}
                                                placeholder="Nhập..."
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            {item.actual_qty !== '' ? (
                                                <Typography 
                                                    fontWeight={700} 
                                                    color={item.discrepancy > 0 ? 'success.main' : item.discrepancy < 0 ? 'error.main' : 'text.primary'}
                                                >
                                                    {item.discrepancy > 0 ? `+${item.discrepancy}` : item.discrepancy}
                                                </Typography>
                                            ) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            {item.category?.toLowerCase() === 'hàng hóa' ? (
                                                <Box display="flex" flexDirection="column" gap={0.5}>
                                                    <Box display="flex" gap={0.5}>
                                                        <TextField
                                                            size="small"
                                                            placeholder="Quét mã..."
                                                            fullWidth
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    const val = (e.target as HTMLInputElement).value;
                                                                    if (val.trim()) {
                                                                        handleAddSerial(item.product_id, val.trim());
                                                                        (e.target as HTMLInputElement).value = '';
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <IconButton color="primary" size="small" onClick={() => setOpenScannerFor(item.product_id)}>
                                                            <QrCodeScannerIcon />
                                                        </IconButton>
                                                    </Box>
                                                    {(item.scanned_serials?.length || 0) > 0 && (
                                                        <Typography variant="caption" color="text.secondary">
                                                            Đã quét: <b>{item.scanned_serials.length}</b> serial
                                                        </Typography>
                                                    )}
                                                </Box>
                                            ) : (
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>-</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <TextField 
                                                size="small" 
                                                fullWidth
                                                placeholder="Hỏng, thất lạc, đếm dư..."
                                                value={item.notes}
                                                onChange={(e) => handleNoteChange(item.product_id, e.target.value)}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
            
            <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={auditItems.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                labelRowsPerPage="Số dòng mỗi trang:"
            />

            {openScannerFor && (
                <Dialog open={!!openScannerFor} onClose={() => setOpenScannerFor(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
                    <DialogTitle sx={{ fontWeight: 900, textAlign: 'center', color: 'primary.main' }}>
                        QUÉT QR SERIAL
                    </DialogTitle>
                    <DialogContent sx={{ p: 0 }}>
                        <QRScanner
                            onScanSuccess={(code) => {
                                handleAddSerial(openScannerFor, code);
                                // Optional: close scanner after 1 scan, or keep open. Keep open is better for multiple scans!
                            }}
                        />
                        <Box p={2} textAlign="center">
                            <AppButton onClick={() => setOpenScannerFor(null)} icon={<CloseIcon />} title="Đóng Camera" />
                        </Box>
                    </DialogContent>
                </Dialog>
            )}
        </Box>
    );
};

export default Audit;
