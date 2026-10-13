import React, { useEffect, useMemo, useState } from 'react';
import {
    Box, Button, ButtonBase, Chip, CircularProgress, Dialog, DialogContent, DialogTitle,
    Divider, FormControl, IconButton, InputAdornment, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip,
    Typography,
} from '@mui/material';
import {
    Close as CloseIcon,
    FileDownload as FileDownloadIcon,
    Inventory2 as InventoryIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Warehouse as WarehouseIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import PageHeader from '../../components/Common/PageHeader';
import type { AppDispatch, RootState } from '../../store';
import { fetchProductsForce } from '../../store/slices/productsSlice';
import { fetchTransactionsForce } from '../../store/slices/transactionsSlice';
import { formatNumber } from '../../utils/numberUtils';
import type { Product, Transaction } from '../../types';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface StockMapRow {
    product: Product;
    warehouseType: string;
    itemStatus: string;
    availableQuantity: number;
    transactionCount: number;
    inboundQuantity: number;
    outboundQuantity: number;
}

const normalizeItemStatus = (value?: string) => String(value || '').trim() || 'Chưa xác định';

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
});

const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
};

const StockMap: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const { items: products, status: productStatus } = useSelector((state: RootState) => state.products);
    const { items: transactions, status: transactionStatus } = useSelector((state: RootState) => state.transactions);
    const [search, setSearch] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('');
    const [selectedRow, setSelectedRow] = useState<StockMapRow | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const refreshData = () => {
        dispatch(fetchProductsForce());
        // Tồn kho cần toàn bộ lịch sử, không dùng cửa sổ dữ liệu mặc định của danh sách giao dịch.
        dispatch(fetchTransactionsForce({ all: true }));
    };

    useEffect(() => {
        refreshData();
    // dispatch is stable from react-redux; only load once when opening this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const rows = useMemo<StockMapRow[]>(() => {
        const stockByProductWarehouse = new Map<string, StockMapRow>();
        // in_stock có thể có một dòng tổng (không serial) và nhiều dòng serial
        // chi tiết cho cùng mã hàng/kho/trạng thái. Dòng tổng là số lượng chuẩn; serial chỉ
        // dùng để truy vết, không được cộng lần thứ hai vào tồn.
        const aggregateInboundKeys = new Set(
            transactions
                .filter(transaction => {
                    const isOutbound = transaction.type === 'outbound' || Boolean(transaction.outbound_date);
                    return !isOutbound && Boolean(String(transaction.warehouse_type || '').trim()) && !String(transaction.serial_code || '').trim();
                })
                .map(transaction => `${transaction.product_id}|${String(transaction.warehouse_type || '').trim()}|${normalizeItemStatus(transaction.item_status)}`),
        );

        transactions.forEach(transaction => {
            if (!transaction.product_id) return;
            const product = products.find(item => item.id === transaction.product_id);
            if (!product) return;
            const warehouseType = String(transaction.warehouse_type || '').trim();
            // Không đoán mã kho cho giao dịch xuất không mang mã kho; các dòng đó
            // vẫn hiện trong chi tiết tổng, nhưng không thể phân bổ đáng tin cậy.
            if (!warehouseType) return;
            const itemStatus = normalizeItemStatus(transaction.item_status);
            const key = `${transaction.product_id}|${warehouseType}|${itemStatus}`;
            const existing = stockByProductWarehouse.get(key) || {
                product,
                warehouseType,
                itemStatus,
                availableQuantity: 0,
                transactionCount: 0,
                inboundQuantity: 0,
                outboundQuantity: 0,
            };
            const quantity = Number(transaction.quantity) || 0;
            const isOutbound = transaction.type === 'outbound' || Boolean(transaction.outbound_date);
            existing.transactionCount += 1;
            if (isOutbound) {
                existing.outboundQuantity += quantity;
                existing.availableQuantity -= quantity;
            } else {
                existing.inboundQuantity += quantity;
                const hasAggregate = aggregateInboundKeys.has(key);
                const isSerialDetail = Boolean(String(transaction.serial_code || '').trim());
                if (!hasAggregate || !isSerialDetail) existing.availableQuantity += quantity;
            }
            stockByProductWarehouse.set(key, existing);
        });
        return [...stockByProductWarehouse.values()]
            .filter(row => row.availableQuantity > 0 || row.transactionCount > 0)
            .sort((a, b) => a.warehouseType.localeCompare(b.warehouseType) || a.product.item_code.localeCompare(b.product.item_code) || a.itemStatus.localeCompare(b.itemStatus));
    }, [products, transactions]);

    const warehouseOptions = useMemo(() => Array.from(new Set(rows.map(row => row.warehouseType))).sort(), [rows]);

    const filteredRows = useMemo(() => {
        const keyword = search.trim().toLocaleLowerCase('vi-VN');
        return rows.filter(({ product, warehouseType }) =>
            (!warehouseFilter || warehouseType.trim().toUpperCase() === warehouseFilter.trim().toUpperCase())
            && (!keyword || (
                product.item_code.toLocaleLowerCase('vi-VN').includes(keyword)
            || product.name.toLocaleLowerCase('vi-VN').includes(keyword)
            || (product.category || '').toLocaleLowerCase('vi-VN').includes(keyword)
            )),
        );
    }, [rows, search, warehouseFilter]);

    const selectedTransactions = useMemo(() => {
        if (!selectedRow) return [];
        return transactions
            .filter(transaction => transaction.product_id === selectedRow.product.id && transaction.warehouse_type === selectedRow.warehouseType && normalizeItemStatus(transaction.item_status) === selectedRow.itemStatus)
            .sort((a, b) => new Date(b.date || b.inbound_date || b.outbound_date || 0).getTime() - new Date(a.date || a.inbound_date || a.outbound_date || 0).getTime());
    }, [selectedRow, transactions]);

    const totalAvailable = rows.reduce((sum, row) => sum + row.availableQuantity, 0);
    const totalProducts = new Set(rows.filter(row => row.availableQuantity > 0).map(row => row.product.id)).size;
    const totalTransactions = rows.reduce((sum, row) => sum + row.transactionCount, 0);
    const isLoading = transactionStatus === 'loading' || productStatus === 'loading';

    const styleExportSheet = (sheet: ExcelJS.Worksheet, title: string, headers: string[]) => {
        sheet.mergeCells(1, 1, 1, headers.length);
        const titleCell = sheet.getCell('A1');
        titleCell.value = title;
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 28;
        sheet.mergeCells(2, 1, 2, headers.length);
        sheet.getCell('A2').value = `Ngày xuất: ${new Date().toLocaleString('vi-VN')}`;
        sheet.getCell('A2').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF475569' } };
        sheet.getCell('A2').alignment = { horizontal: 'center' };
        const headerRow = sheet.getRow(4);
        headers.forEach((header, index) => { headerRow.getCell(index + 1).value = header; });
        headerRow.eachCell(cell => {
            cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
        });
        headerRow.height = 25;
        sheet.views = [{ state: 'frozen', ySplit: 4 }];
    };

    const applyExportDataStyle = (sheet: ExcelJS.Worksheet) => {
        for (let rowIndex = 5; rowIndex <= sheet.rowCount; rowIndex += 1) {
            const row = sheet.getRow(rowIndex);
            row.eachCell(cell => {
                cell.font = { name: 'Arial', size: 10 };
                cell.alignment = { vertical: 'middle', wrapText: true };
                cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
            });
        }
    };

    const exportSummary = async () => {
        if (!filteredRows.length) return;
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'GGS Warehouse';
            const sheet = workbook.addWorksheet('Tổng hợp tồn kho');
            const headers = ['STT', 'Mã kho', 'Mã hàng', 'Tên hàng hóa', 'ĐVT', 'Nhóm hàng', 'Trạng thái hàng', 'Tồn khả dụng', 'Số bản ghi'];
            styleExportSheet(sheet, 'BÁO CÁO TỔNG HỢP SƠ ĐỒ TỒN KHO', headers);
            sheet.columns = [{ width: 7 }, { width: 18 }, { width: 25 }, { width: 45 }, { width: 12 }, { width: 18 }, { width: 22 }, { width: 16 }, { width: 14 }];
            filteredRows.forEach((row, index) => sheet.addRow([
                index + 1, row.warehouseType, row.product.item_code, row.product.name, row.product.unit || 'Cái', row.product.category || '', row.itemStatus, row.availableQuantity, row.transactionCount,
            ]));
            applyExportDataStyle(sheet);
            sheet.getColumn(8).numFmt = '#,##0';
            sheet.autoFilter = { from: 'A4', to: `I${sheet.rowCount}` };
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Tong_hop_so_do_ton_kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } finally {
            setIsExporting(false);
        }
    };

    const exportDetail = async () => {
        if (!selectedRow || !selectedTransactions.length) return;
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'GGS Warehouse';
            const sheet = workbook.addWorksheet('Chi tiết mã hàng');
            const headers = ['STT', 'Mã kho', 'Mã hàng', 'Tên hàng hóa', 'Trạng thái hàng', 'Loại giao dịch', 'Ngày', 'Serial', 'Số lượng', 'Quận/Huyện', 'Người thực hiện'];
            styleExportSheet(sheet, `CHI TIẾT TỒN KHO — ${selectedRow.product.item_code}`, headers);
            sheet.columns = [{ width: 7 }, { width: 18 }, { width: 24 }, { width: 40 }, { width: 20 }, { width: 16 }, { width: 20 }, { width: 25 }, { width: 14 }, { width: 16 }, { width: 25 }];
            selectedTransactions.forEach((transaction, index) => {
                const isOutbound = transaction.type === 'outbound' || Boolean(transaction.outbound_date);
                sheet.addRow([index + 1, selectedRow.warehouseType, selectedRow.product.item_code, selectedRow.product.name, selectedRow.itemStatus, isOutbound ? 'Xuất kho' : 'Nhập kho', formatDate(transaction.date || transaction.inbound_date || transaction.outbound_date), transaction.serial_code || '', isOutbound ? -Number(transaction.quantity || 0) : Number(transaction.quantity || 0), transaction.district || '', transaction.created_by || transaction.user_name || '']);
            });
            applyExportDataStyle(sheet);
            sheet.getColumn(9).numFmt = '#,##0';
            sheet.autoFilter = { from: 'A4', to: `K${sheet.rowCount}` };
            const safeCode = selectedRow.product.item_code.replace(/[^a-zA-Z0-9_-]/g, '_');
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Chi_tiet_ton_kho_${safeCode}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Box sx={{ pb: 5 }}>
            <PageHeader
                title="Sơ đồ tồn kho"
                subtitle="Tổng quan tồn theo mã hàng và mã kho từ dữ liệu đã đồng bộ; chọn một dòng để xem các bản ghi liên quan."
                actions={<>
                    <Button
                        variant="outlined"
                        onClick={exportSummary}
                        startIcon={isExporting ? <CircularProgress size={16} /> : <FileDownloadIcon />}
                        disabled={isLoading || isExporting || !filteredRows.length}
                        sx={{
                            color: '#1D4ED8',
                            borderColor: '#93C5FD',
                            '&:hover': { bgcolor: '#EFF6FF', borderColor: '#2563EB' },
                            '&.Mui-disabled': { bgcolor: '#E2E8F0 !important', color: '#64748B !important', borderColor: '#CBD5E1 !important' },
                        }}
                    >Xuất Excel tổng</Button>
                    <Button variant="contained" onClick={refreshData} startIcon={<RefreshIcon />} disabled={isLoading || isExporting}>Làm mới dữ liệu</Button>
                </>}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
                {[
                    { label: 'Mã hàng còn tồn', value: totalProducts, icon: <InventoryIcon color="primary" /> },
                    { label: 'Tồn khả dụng', value: formatNumber(totalAvailable), icon: <WarehouseIcon color="success" /> },
                    { label: 'Bản ghi đang theo dõi', value: formatNumber(totalTransactions), icon: <InventoryIcon color="info" /> },
                ].map(card => (
                    <Paper key={card.label} variant="outlined" sx={{ flex: 1, p: { xs: 1.5, sm: 2.25 }, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <Box sx={{ display: 'grid', placeItems: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: 'action.hover' }}>{card.icon}</Box>
                        <Box>
                            <Typography variant="h5" fontWeight={800}>{card.value}</Typography>
                            <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                        </Box>
                    </Paper>
                ))}
            </Stack>

            <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                <Box sx={{ p: { xs: 1.25, sm: 2 }, display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
                    <TextField
                        size="small"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        placeholder="Tìm theo mã hàng, tên hàng, nhóm hàng..."
                        sx={{ minWidth: { xs: '100%', sm: 380 }, flex: { sm: '1 1 380px' } }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 190 }, flex: { sm: '0 0 190px' } }}>
                        <InputLabel id="warehouse-filter-label">Mã kho</InputLabel>
                        <Select labelId="warehouse-filter-label" value={warehouseFilter} label="Mã kho" onChange={event => setWarehouseFilter(event.target.value)}>
                            <MenuItem value="">Tất cả mã kho</MenuItem>
                            {warehouseOptions.map(warehouse => <MenuItem key={warehouse} value={warehouse}>{warehouse}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Typography variant="body2" color="text.secondary">Hiển thị {formatNumber(filteredRows.length)} mã hàng</Typography>
                </Box>
                <Divider />
                {isLoading && rows.length === 0 ? (
                    <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /><Typography sx={{ mt: 2 }} color="text.secondary">Đang tải dữ liệu tồn kho...</Typography></Box>
                ) : (
                    <>
                    <Box sx={{ display: { xs: 'block', md: 'none' }, p: 1 }}>
                        <Stack spacing={1}>
                            {filteredRows.map(row => (
                                <ButtonBase
                                    key={`${row.product.id}|${row.warehouseType}|${row.itemStatus}`}
                                    onClick={() => setSelectedRow(row)}
                                    sx={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 2, overflow: 'hidden' }}
                                >
                                    <Paper variant="outlined" sx={{ width: '100%', p: 1.5, borderRadius: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                                            <Box minWidth={0}>
                                                <Typography variant="caption" color="primary.main" fontWeight={800}>{row.product.item_code}</Typography>
                                                <Typography fontWeight={700} noWrap>{row.product.name}</Typography>
                                            </Box>
                                            <Chip label={formatNumber(row.availableQuantity)} color={row.availableQuantity > 0 ? 'success' : 'default'} size="small" sx={{ fontWeight: 800, flexShrink: 0 }} />
                                        </Stack>
                                        <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
                                            <Chip label={row.warehouseType} size="small" color="info" variant="outlined" />
                                            <Chip label={row.itemStatus} size="small" variant="outlined" color={row.itemStatus === 'Mới' ? 'success' : row.itemStatus === 'Lỗi' ? 'error' : 'default'} />
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>{row.product.unit || 'Cái'} · {formatNumber(row.transactionCount)} bản ghi · Chạm để xem chi tiết</Typography>
                                    </Paper>
                                </ButtonBase>
                            ))}
                            {filteredRows.length === 0 && <Typography align="center" color="text.secondary" sx={{ py: 6 }}>Không tìm thấy mã hàng phù hợp.</Typography>}
                        </Stack>
                    </Box>
                    <TableContainer sx={{ maxHeight: 620, display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
                        <Table stickyHeader size="small" aria-label="Sơ đồ tồn kho theo mã hàng">
                            <TableHead>
                                <TableRow>
                                    {['STT', 'Mã kho', 'Mã hàng', 'Tên hàng hóa', 'ĐVT', 'Nhóm hàng', 'Trạng thái hàng', 'Tồn khả dụng', 'Số bản ghi', ''].map(header => (
                                        <TableCell key={header} sx={{ fontWeight: 700, bgcolor: 'background.paper', whiteSpace: 'nowrap' }} align={header === 'Tồn khả dụng' || header === 'Số bản ghi' || header === 'STT' ? 'center' : undefined}>{header}</TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredRows.map((row, index) => (
                                    <TableRow
                                        hover
                                        key={`${row.product.id}|${row.warehouseType}|${row.itemStatus}`}
                                        onClick={() => setSelectedRow(row)}
                                        sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
                                    >
                                        <TableCell align="center">{index + 1}</TableCell>
                                        <TableCell><Chip label={row.warehouseType} size="small" color="info" variant="outlined" /></TableCell>
                                        <TableCell><Typography fontWeight={700} color="primary.main">{row.product.item_code}</Typography></TableCell>
                                        <TableCell><Typography fontWeight={600}>{row.product.name}</Typography></TableCell>
                                        <TableCell>{row.product.unit || 'Cái'}</TableCell>
                                        <TableCell>{row.product.category ? <Chip label={row.product.category} size="small" variant="outlined" /> : '—'}</TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                                <Chip label={row.itemStatus} size="small" variant="outlined" color={row.itemStatus === 'Mới' ? 'success' : row.itemStatus === 'Lỗi' ? 'error' : 'default'} />
                                            </Stack>
                                        </TableCell>
                                        <TableCell align="center"><Chip label={formatNumber(row.availableQuantity)} color={row.availableQuantity > 0 ? 'success' : 'default'} size="small" sx={{ fontWeight: 700, minWidth: 72 }} /></TableCell>
                                        <TableCell align="center">{formatNumber(row.transactionCount)}</TableCell>
                                        <TableCell align="right"><Tooltip title="Xem chi tiết bản ghi"><Button size="small" onClick={event => { event.stopPropagation(); setSelectedRow(row); }}>Chi tiết</Button></Tooltip></TableCell>
                                    </TableRow>
                                ))}
                                {filteredRows.length === 0 && (
                                    <TableRow><TableCell colSpan={10} align="center" sx={{ py: 8, color: 'text.secondary' }}>Không tìm thấy mã hàng phù hợp.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    </>
                )}
            </Paper>

            <Dialog open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} fullWidth maxWidth="lg" fullScreen={isMobile}>
                <DialogTitle sx={{ pr: 6 }}>
                    <Typography variant="overline" color="primary.main" fontWeight={700}>CHI TIẾT TỒN KHO</Typography>
                    <Typography variant="h6" fontWeight={800}>{selectedRow?.product.item_code} — {selectedRow?.product.name}</Typography>
                    <Typography variant="body2" color="text.secondary">Mã kho: <strong>{selectedRow?.warehouseType}</strong> · Tồn khả dụng: <strong>{formatNumber(selectedRow?.availableQuantity || 0)} {selectedRow?.product.unit || 'Cái'}</strong></Typography>
                    <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', right: 12, top: 12 }}>
                        <Tooltip title="Xuất Excel chi tiết mã hàng"><span><IconButton aria-label="Xuất Excel chi tiết" onClick={exportDetail} disabled={isExporting || !selectedTransactions.length} color="primary"><FileDownloadIcon /></IconButton></span></Tooltip>
                        <IconButton aria-label="Đóng" onClick={() => setSelectedRow(null)}><CloseIcon /></IconButton>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <TableContainer sx={{ maxHeight: isMobile ? 'calc(100vh - 160px)' : 520, overflowX: 'auto' }}>
                        <Table stickyHeader size="small" aria-label="Bản ghi tồn kho theo mã hàng">
                            <TableHead><TableRow>{['Loại', 'Ngày', 'Serial', 'Số lượng', 'Trạng thái', 'Quận/Huyện', 'Loại kho', 'Người thực hiện'].map(header => <TableCell key={header} sx={{ fontWeight: 700, bgcolor: 'background.paper', whiteSpace: 'nowrap' }}>{header}</TableCell>)}</TableRow></TableHead>
                            <TableBody>
                                {selectedTransactions.map((transaction: Transaction) => {
                                    const isOutbound = transaction.type === 'outbound' || Boolean(transaction.outbound_date);
                                    return <TableRow key={transaction.id} hover>
                                        <TableCell><Chip size="small" color={isOutbound ? 'warning' : 'success'} label={isOutbound ? 'Xuất kho' : 'Nhập kho'} /></TableCell>
                                        <TableCell>{formatDate(transaction.date || transaction.inbound_date || transaction.outbound_date)}</TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>{transaction.serial_code || '—'}</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 700, color: isOutbound ? 'warning.dark' : 'success.dark' }}>{isOutbound ? '−' : '+'}{formatNumber(Number(transaction.quantity) || 0)}</TableCell>
                                        <TableCell>{transaction.item_status || '—'}</TableCell>
                                        <TableCell>{transaction.district || '—'}</TableCell>
                                        <TableCell>{transaction.warehouse_type || '—'}</TableCell>
                                        <TableCell>{transaction.created_by || transaction.user_name || '—'}</TableCell>
                                    </TableRow>;
                                })}
                                {selectedTransactions.length === 0 && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>Chưa có bản ghi giao dịch cho mã hàng này.</TableCell></TableRow>}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default StockMap;
