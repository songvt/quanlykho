import React, { useState, useMemo } from 'react';
import { 
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Button,
    TextField, IconButton, InputAdornment, TablePagination,
    Chip, Tooltip
} from '@mui/material';
import { 
    CloudUpload as CloudUploadIcon, 
    FileDownload as FileDownloadIcon,
    Search as SearchIcon,
    FilterList as FilterListIcon,
    DeleteSweep as DeleteSweepIcon
} from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';
import { readExcelFile, exportToExcel } from '../../utils/excelUtils';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { setInventoryReportData } from '../../store/slices/settlementSlice';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import { formatNumber } from '../../utils/numberUtils';
import { normalizeSettlementMonth } from '../../utils/settlementAggregates';

interface InventoryReportItem {
    id?: string;
    unit_code: string;
    unit_name: string;
    transaction_type: string;
    order_number: string;
    employee_voucher: string;
    warehouse_voucher: string;
    bccs_item: string;
    finance_item: string;
    unit_price: number;
    quantity: number;
    total_amount: number;
    voucher_date: string;
    actual_date: string;
    employee_name: string;
    reason: string;
    note: string;
}

const InventoryReport: React.FC = () => {
    const dispatch = useDispatch();
    const storedData = useSelector((state: RootState) => state.settlement.inventoryReportData);
    const { success, error: notifyError } = useNotification();
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    React.useEffect(() => {
        const loadData = async () => {
            try {
                const now = new Date();
                const currentMonth = normalizeSettlementMonth(
                    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
                );
                const dbData = await GoogleSheetService.getSettlementInventory(currentMonth);
                if (dbData && dbData.length > 0) {
                    const sanitized = dbData.map((item: any) => ({
                        ...item,
                        voucher_date: formatValue(item.voucher_date),
                        actual_date: formatValue(item.actual_date)
                    }));
                    dispatch(setInventoryReportData(sanitized));
                }
            } catch (err) {
                console.error('Lỗi tải dữ liệu:', err);
            }
        };
        loadData();
    }, [dispatch]);



    const formatValue = (val: any): string => {
        if (val instanceof Date) {
            return val.toLocaleDateString('vi-VN');
        }
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') {
            try {
                return JSON.stringify(val);
            } catch (e) {
                return String(val);
            }
        }
        return String(val);
    };

    const handleImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const rawData = await readExcelFile(file);
            // Map excel columns to our interface
            // Expected headers: Mã đơn vị, Đơn vị, Loại giao dịch, Lệnh NXK, Số phiếu NV, Số phiếu NXK, Mặt hàng BCCS, Mặt hàng Tài chính, Đơn giá, Số lượng, Thành tiền, Ngày lập phiếu, Ngày thực nhập/xuất, Nhân viên, Lý do, DM
            const mappedData: InventoryReportItem[] = rawData.map((item: any, index: number) => ({
                id: `import-${Date.now()}-${index}`,
                unit_code: formatValue(item['Mã đơn vị']),
                unit_name: formatValue(item['Đơn vị']),
                transaction_type: formatValue(item['Loại giao dịch']),
                order_number: formatValue(item['Lệnh NXK']),
                employee_voucher: formatValue(item['Số phiếu NV']),
                warehouse_voucher: formatValue(item['Số phiếu NXK']),
                bccs_item: formatValue(item['Mặt hàng BCCS']),
                finance_item: formatValue(item['Mặt hàng Tài chính']),
                unit_price: Number(item['Đơn giá']) || 0,
                quantity: Number(item['Số lượng']) || 0,
                total_amount: Number(item['Thành tiền']) || 0,
                voucher_date: formatValue(item['Ngày lập phiếu']),
                actual_date: formatValue(item['Ngày thực nhập/xuất']),
                employee_name: formatValue(item['Nhân viên']),
                reason: formatValue(item['Lý do']),
                note: formatValue(item['DM'])
            }));

            // 1. Phân nhóm theo tháng để lưu xuống DB
            const monthsMap: Record<string, any[]> = {};
            mappedData.forEach(item => {
                const dateStr = item.actual_date || item.voucher_date;
                const dateParts = dateStr.split('/');
                if (dateParts.length === 3) {
                    const monthKey = normalizeSettlementMonth(`${dateParts[2]}-${dateParts[1]}`);
                    if (!monthsMap[monthKey]) monthsMap[monthKey] = [];
                    monthsMap[monthKey].push(item);
                }
            });

            // 2. Lưu từng tháng xuống DB
            for (const [month, payload] of Object.entries(monthsMap)) {
                await GoogleSheetService.saveSettlementInventory(month, payload);
            }

            // Đảm bảo dữ liệu trong Redux/State cũng là string
            const sanitizedData = mappedData.map(item => ({
                ...item,
                voucher_date: formatValue(item.voucher_date),
                actual_date: formatValue(item.actual_date)
            }));

            dispatch(setInventoryReportData(sanitizedData));
            success(`Đã import và lưu thành công ${sanitizedData.length} dòng dữ liệu vào Database.`);
        } catch (err: any) {
            console.error(err);
            notifyError('Lỗi khi xử lý file và lưu Database: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bao_Cao_Xuat_Nhap');
        
        const headers = [
            'Mã đơn vị', 'Đơn vị', 'Loại giao dịch', 'Lệnh NXK', 'Số phiếu NV', 
            'Số phiếu NXK', 'Mặt hàng BCCS', 'Mặt hàng Tài chính', 'Đơn giá', 
            'Số lượng', 'Thành tiền', 'Ngày lập phiếu', 'Ngày thực nhập/xuất', 
            'Nhân viên', 'Lý do', 'DM'
        ];
        
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Add a sample row
        sheet.addRow([
            'ACT_HCM', 'ACT Hồ Chí Minh', 'Nhập', 'PN_ACT_Q12_SONGVT_000400', 'PN000344', 
            'PN000344', 'Camera ngoài trời HC33_UCTT', 'Camera ngoài trời HC33', 690000, 
            2, 1380000, '14/04/2026', '14/04/2026', 
            'SONGVT_HCM_OSACT - Võ', 'Xuất hàng cho cấp dưới', 'Hàng hóa'
        ]);

        sheet.columns.forEach(column => {
            column.width = 20;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'Template_Bao_Cao_Xuat_Nhap_Kho.xlsx');
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return storedData;
        const s = searchTerm.toLowerCase();
        return storedData.filter(item => 
            item.unit_code.toLowerCase().includes(s) ||
            item.unit_name.toLowerCase().includes(s) ||
            item.warehouse_voucher.toLowerCase().includes(s) ||
            item.bccs_item.toLowerCase().includes(s) ||
            item.employee_name.toLowerCase().includes(s)
        );
    }, [storedData, searchTerm]);

    const paginatedData = useMemo(() => {
        return filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    return (
        <Box sx={{ pb: 4 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mb: 0.5 }}>
                        BÁO CÁO 17 - XNT
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Quản lý và theo dõi lịch sử xuất nhập kho từ file hệ thống.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {storedData.length > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            onClick={() => {
                                if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đang hiển thị?')) {
                                    dispatch(setInventoryReportData([]));
                                    setPage(0);
                                    success('Đã xóa toàn bộ dữ liệu.');
                                }
                            }}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                        >
                            Xóa tất cả
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<FileDownloadIcon />}
                        onClick={downloadTemplate}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                        Tải Template
                    </Button>
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUploadIcon />}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, bgcolor: '#2563eb' }}
                    >
                        Import Excel
                        <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    size="small"
                    placeholder="Tìm kiếm theo mã đơn vị, số phiếu, mặt hàng..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    sx={{ flexGrow: 1 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                    }}
                />
                <Tooltip title="Lọc nâng cao">
                    <IconButton>
                        <FilterListIcon />
                    </IconButton>
                </Tooltip>
            </Paper>

            <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <Table sx={{ minWidth: 2000 }} size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 60 }}>STT</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã đơn vị</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Đơn vị</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại giao dịch</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Lệnh NXK</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Số phiếu NV</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Số phiếu NXK</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mặt hàng BCCS</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mặt hàng Tài chính</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Đơn giá</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">Số lượng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Thành tiền</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Ngày lập phiếu</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Ngày thực nhập/xuất</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Nhân viên</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Lý do</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Ghi chú (DM)</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={17} align="center" sx={{ py: 8 }}>
                                    <Box sx={{ opacity: 0.5 }}>
                                        <CloudUploadIcon sx={{ fontSize: 48, mb: 1 }} />
                                        <Typography>Chưa có dữ liệu. Vui lòng import file Excel.</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item, index) => (
                                <TableRow key={item.id} hover>
                                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                    <TableCell>{item.unit_code}</TableCell>
                                    <TableCell>{item.unit_name}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={item.transaction_type} 
                                            size="small" 
                                            color={item.transaction_type === 'Nhập' ? 'success' : 'warning'}
                                            variant="outlined"
                                            sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{item.order_number}</TableCell>
                                    <TableCell>{item.employee_voucher}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.warehouse_voucher}</TableCell>
                                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Tooltip title={item.bccs_item}>
                                            <span>{item.bccs_item}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Tooltip title={item.finance_item}>
                                            <span>{item.finance_item}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell align="right">{formatNumber(item.unit_price)}</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700 }}>{formatNumber(item.quantity)}</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 700, color: '#2563eb' }}>{formatNumber(item.total_amount)}</TableCell>
                                    <TableCell>{item.voucher_date}</TableCell>
                                    <TableCell>{item.actual_date}</TableCell>
                                    <TableCell sx={{ maxWidth: 150, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Tooltip title={item.employee_name}>
                                            <span>{item.employee_name}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <Tooltip title={item.reason}>
                                            <span>{item.reason}</span>
                                        </Tooltip>
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={item.note} 
                                            size="small" 
                                            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 500 }}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                rowsPerPageOptions={[25, 50, 100]}
                component="div"
                count={filteredData.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                labelRowsPerPage="Số dòng mỗi trang:"
            />
        </Box>
    );
};

export default InventoryReport;
