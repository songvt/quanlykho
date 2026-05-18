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
import { readExcelFile } from '../../utils/excelUtils';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { setDetailedOutboundData } from '../../store/slices/settlementSlice';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import { formatNumber } from '../../utils/numberUtils';

interface DetailedOutboundItem {
    id?: string;
    cost_center_unit: string;
    cost_center: string;
    cost_center_store: string;
    cost_center_employee_code: string;
    stock_out_date: string;
    channel_group: string;
    channel_type: string;
    service: string;
    transaction_type: string;
    item_code: string;
    item_name: string;
    finance_item: string;
    item_type: string;
    qty_within_limit: number;
    qty_over_limit: number;
    qty_total: number;
    unit: string;
    cost_price: number;
    total_amount: number;
    from_serial: string;
    to_serial: string;
    item_status: string;
    stock_out_voucher: string;
    transaction_code: string;
    management_unit: string;
    vtp_transaction_type: string;
    case_code: string;
    case_name: string;
    document_number: string;
    customer_group: string;
    sap_item_code: string;
    sap_item_name: string;
    sap_sync_type: string;
    impact_type: string;
    cost_allocation: string;
}

const DetailedOutboundReport: React.FC = () => {
    const dispatch = useDispatch();
    const storedData = useSelector((state: RootState) => state.settlement.detailedOutboundData);
    const { success, error: notifyError } = useNotification();
    const [data, setData] = useState<DetailedOutboundItem[]>(storedData);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    React.useEffect(() => {
        const loadData = async () => {
            try {
                // Lấy dữ liệu tháng hiện tại làm mặc định (Định dạng chuẩn YYYY-MM)
                const now = new Date();
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                const dbData = await GoogleSheetService.getSettlementOutbound(currentMonth);
                if (dbData && dbData.length > 0) {
                    const sanitized = dbData.map((item: any) => ({
                        ...item,
                        stock_out_date: formatValue(item.stock_out_date)
                    }));
                    dispatch(setDetailedOutboundData(sanitized));
                }
            } catch (err) {
                console.error('Lỗi tải dữ liệu:', err);
            }
        };
        loadData();
    }, [dispatch]);

    React.useEffect(() => {
        setData(storedData);
    }, [storedData]);

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
            const mappedData: DetailedOutboundItem[] = rawData.map((item: any, index: number) => ({
                id: `import-detail-${Date.now()}-${index}`,
                cost_center_unit: formatValue(item['Đơn vị giá vốn']),
                cost_center: formatValue(item['Trung tâm giá vốn']),
                cost_center_store: formatValue(item['Cửa hàng giá vốn']),
                cost_center_employee_code: formatValue(item['Mã Nhân viên/Đại lý giá vốn']),
                stock_out_date: formatValue(item['Ngày trừ kho']),
                channel_group: formatValue(item['Nhóm loại kênh']),
                channel_type: formatValue(item['Loại kênh']),
                service: formatValue(item['Dịch vụ']),
                transaction_type: formatValue(item['Loại giao dịch']),
                item_code: formatValue(item['Mã mặt hàng']),
                item_name: formatValue(item['Mặt hàng']),
                finance_item: formatValue(item['Mặt hàng tài chính']),
                item_type: formatValue(item['Loại Mặt hàng'] || item['Loại mặt hàng'] || item['DM'] || item['Ghi chú']),
                qty_within_limit: Number(item['Số lượng (trong hạn mức)'] || item['SL (trong HM)'] || item['SL']) || 0,
                qty_over_limit: Number(item['Số lượng (vượt hạn mức)'] || item['SL (vuot HM)']) || 0,
                qty_total: Number(item['Số lượng tổng'] || item['SL tổng'] || item['Tổng cộng'] || item['Số lượng thực xuất'] || item['Tổng số lượng']) || 0,
                unit: formatValue(item['ĐVT'] || item['Đơn vị tính'] || item['Unit']),
                cost_price: Number(item['Đơn giá (giá vốn)'] || item['Đơn giá']) || 0,
                total_amount: Number(item['Thành tiền'] || item['TT']) || 0,
                from_serial: formatValue(item['Từ Serial']),
                to_serial: formatValue(item['Đến Serial']),
                item_status: formatValue(item['Trạng thái hàng']),
                stock_out_voucher: formatValue(item['Mã phiếu xuất']),
                transaction_code: formatValue(item['Mã giao dịch']),
                management_unit: formatValue(item['Đơn vị quản lý hàng hóa']),
                vtp_transaction_type: formatValue(item['Loại GD VTP']),
                case_code: formatValue(item['Mã vụ việc']),
                case_name: formatValue(item['Tên vụ việc']),
                document_number: formatValue(item['Số giấy tờ']),
                customer_group: formatValue(item['Nhóm Khách hàng']),
                sap_item_code: formatValue(item['Mã mặt hàng SAP']),
                sap_item_name: formatValue(item['Tên mặt hàng SAP']),
                sap_sync_type: formatValue(item['Loại dữ liệu đồng bộ SAP']),
                impact_type: formatValue(item['LOẠI TÁC ĐỘNG']),
                cost_allocation: formatValue(item['Phân bổ giá vốn'])
            }));

            // 1. Phân nhóm theo tháng để lưu xuống DB
            const monthsMap: Record<string, any[]> = {};
            mappedData.forEach(item => {
                const dateParts = item.stock_out_date.split('/');
                if (dateParts.length === 3) {
                    // Chuẩn hóa sang YYYY-MM để đồng bộ toàn hệ thống
                    const monthKey = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}`;
                    if (!monthsMap[monthKey]) monthsMap[monthKey] = [];
                    monthsMap[monthKey].push(item);
                }
            });

            // 2. Lưu từng tháng xuống DB
            for (const [month, payload] of Object.entries(monthsMap)) {
                await GoogleSheetService.saveSettlementOutbound(month, payload);
            }

            dispatch(setDetailedOutboundData(mappedData));
            success(`Đã import và lưu thành công ${mappedData.length} dòng dữ liệu vào Database.`);
        } catch (err: any) {
            console.error(err);
            notifyError('Lỗi khi xử lý file và lưu Database: ' + err.message);
        } finally {
            event.target.value = '';
        }
    };

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Chi_Tiet_Xuat');
        
        const headers = [
            'Đơn vị giá vốn', 'Trung tâm giá vốn', 'Cửa hàng giá vốn', 'Mã Nhân viên/Đại lý giá vốn',
            'Ngày trừ kho', 'Nhóm loại kênh', 'Loại kênh', 'Dịch vụ', 'Loại giao dịch',
            'Mã mặt hàng', 'Mặt hàng', 'Mặt hàng tài chính', 'Loại Mặt hàng',
            'Số lượng (trong hạn mức)', 'Số lượng (vượt hạn mức)', 'Đơn giá (giá vốn)', 'Thành tiền',
            'Từ Serial', 'Đến Serial', 'Trạng thái hàng', 'Mã phiếu xuất', 'Mã giao dịch',
            'Đơn vị quản lý hàng hóa', 'Loại GD VTP', 'Mã vụ việc', 'Tên vụ việc', 'Số giấy tờ',
            'Nhóm Khách hàng', 'Mã mặt hàng SAP', 'Tên mặt hàng SAP', 'Loại dữ liệu đồng bộ SAP',
            'LOẠI TÁC ĐỘNG', 'Phân bổ giá vốn'
        ];
        
        const headerRow = sheet.addRow(headers);
        headerRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });

        // Sample Row
        sheet.addRow([
            'VTP_HCM', 'CC_HCM', 'CH_Q12', 'NV001', '13/05/2026', 'Nội bộ', 'Kỹ thuật', 'Dịch vụ mạng', 'Xuất',
            'MODEM_01', 'Modem Wifi', 'Modem Tài chính', 'Hàng hóa', 1, 0, 500000, 500000,
            'SN1000', 'SN1000', 'Mới', 'PX001', 'TX001', 'ACT_BSG', 'Xuat_Kho', 'VV01', 'Vu viec mau', 'SGT01',
            'Khách lẻ', 'SAP01', 'SAP_MODEM', 'Sync', 'Tác động mẫu', 'Phân bổ mẫu'
        ]);

        sheet.columns.forEach(column => {
            column.width = 25;
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, 'Template_Bao_Cao_Chi_Tiet_Xuat.xlsx');
    };

    const filteredData = useMemo(() => {
        if (!searchTerm) return data;
        const s = searchTerm.toLowerCase();
        return data.filter(item => 
            item.item_code.toLowerCase().includes(s) ||
            item.item_name.toLowerCase().includes(s) ||
            item.cost_center_employee_code.toLowerCase().includes(s) ||
            item.stock_out_voucher.toLowerCase().includes(s)
        );
    }, [data, searchTerm]);

    const paginatedData = useMemo(() => {
        return filteredData.slice(page * rowsPerPage, (page + 1) * rowsPerPage);
    }, [filteredData, page, rowsPerPage]);

    return (
        <Box sx={{ pb: 4 }}>
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1e293b', mb: 0.5 }}>
                        BÁO CÁO XUẤT TRONG KỲ
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Theo dõi chi tiết các giao dịch xuất kho và thông tin giá vốn, kênh bán hàng.
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                    {data.length > 0 && (
                        <Button
                            variant="outlined"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            onClick={() => {
                                if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ dữ liệu đang hiển thị?')) {
                                    dispatch(setDetailedOutboundData([]));
                                    setPage(0);
                                    success('Đã xóa toàn bộ dữ liệu.');
                                }
                            }}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                        >
                            Xóa tất cả
                        </Button>
                    )}
                    <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={downloadTemplate} sx={{ borderRadius: 2 }}>
                        Tải Template
                    </Button>
                    <Button variant="contained" component="label" startIcon={<CloudUploadIcon />} sx={{ borderRadius: 2, bgcolor: '#2563eb' }}>
                        Import Excel
                        <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
                    </Button>
                </Box>
            </Box>

            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Tìm kiếm theo mã mặt hàng, tên mặt hàng, mã nhân viên..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                    }}
                />
            </Paper>

            <TableContainer component={Paper} sx={{ borderRadius: 2, overflowX: 'auto' }}>
                <Table sx={{ minWidth: 4000 }} size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, width: 60 }}>STT</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Đơn vị giá vốn</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Trung tâm giá vốn</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Cửa hàng giá vốn</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã Nhân viên/Đại lý giá vốn</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Ngày trừ kho</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Nhóm loại kênh</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại kênh</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Dịch vụ</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại giao dịch</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã mặt hàng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mặt hàng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mặt hàng tài chính</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại Mặt hàng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">SL (trong HM)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">SL (vượt HM)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="center">Tổng SL</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Đơn giá (giá vốn)</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} align="right">Thành tiền</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Từ Serial</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Đến Serial</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Trạng thái hàng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã phiếu xuất</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã giao dịch</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Đơn vị quản lý hàng hóa</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại GD VTP</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã vụ việc</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Tên vụ việc</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Số giấy tờ</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Nhóm Khách hàng</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Mã mặt hàng SAP</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Tên mặt hàng SAP</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Loại dữ liệu đồng bộ SAP</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>LOẠI TÁC ĐỘNG</TableCell>
                            <TableCell sx={{ fontWeight: 700 }}>Phân bổ giá vốn</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={34} align="center" sx={{ py: 8 }}>
                                    <Typography color="text.secondary">Chưa có dữ liệu chi tiết xuất.</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedData.map((item, index) => (
                                <TableRow key={item.id} hover>
                                    <TableCell>{page * rowsPerPage + index + 1}</TableCell>
                                    <TableCell>{item.cost_center_unit}</TableCell>
                                    <TableCell>{item.cost_center}</TableCell>
                                    <TableCell>{item.cost_center_store}</TableCell>
                                    <TableCell>{item.cost_center_employee_code}</TableCell>
                                    <TableCell>{item.stock_out_date}</TableCell>
                                    <TableCell>{item.channel_group}</TableCell>
                                    <TableCell>{item.channel_type}</TableCell>
                                    <TableCell>{item.service}</TableCell>
                                    <TableCell>{item.transaction_type}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.item_code}</TableCell>
                                    <TableCell>{item.item_name}</TableCell>
                                    <TableCell>{item.finance_item}</TableCell>
                                    <TableCell>{item.item_type}</TableCell>
                                    <TableCell align="center">{formatNumber(item.qty_within_limit)}</TableCell>
                                    <TableCell align="center">{formatNumber(item.qty_over_limit)}</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700, color: '#0f172a' }}>{formatNumber(item.qty_total)}</TableCell>
                                    <TableCell align="right">{formatNumber(item.cost_price)}</TableCell>
                                    <TableCell align="right">{formatNumber(item.total_amount)}</TableCell>
                                    <TableCell>{item.from_serial}</TableCell>
                                    <TableCell>{item.to_serial}</TableCell>
                                    <TableCell>{item.item_status}</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>{item.stock_out_voucher}</TableCell>
                                    <TableCell>{item.transaction_code}</TableCell>
                                    <TableCell>{item.management_unit}</TableCell>
                                    <TableCell>{item.vtp_transaction_type}</TableCell>
                                    <TableCell>{item.case_code}</TableCell>
                                    <TableCell>{item.case_name}</TableCell>
                                    <TableCell>{item.document_number}</TableCell>
                                    <TableCell>{item.customer_group}</TableCell>
                                    <TableCell>{item.sap_item_code}</TableCell>
                                    <TableCell>{item.sap_item_name}</TableCell>
                                    <TableCell>{item.sap_sync_type}</TableCell>
                                    <TableCell>{item.impact_type}</TableCell>
                                    <TableCell>{item.cost_allocation}</TableCell>
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

export default DetailedOutboundReport;
