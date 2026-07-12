import React, { useState, useRef } from 'react';
import { 
    Box, Typography, Button, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, 
    Stack, Alert, CircularProgress, IconButton
} from '@mui/material';
import { Download as DownloadIcon, Upload as UploadIcon, Print as PrintIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ExcelJS from 'exceljs';
import { useReactToPrint } from 'react-to-print';
import BillTemplateA5 from '../components/BillTemplateA5';
import type { BillData } from '../components/BillTemplateA5';
import { parseExcelNumber, numberToWordsVN, formatNumber } from '../utils/numberUtils';

const PrintBillNotification: React.FC = () => {
    const [data, setData] = useState<BillData[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const printRef = useRef<HTMLDivElement>(null);

    // Mẫu branch config (có thể thay đổi nếu cần)
    const branchConfig = {
        branchName: 'VIETTEL QUẬN 12',
        branchAddress: '50 TRƯƠNG THỊ HOA PHƯỜNG TÂN THỚI HIỆP Q12',
        branchContact: 'ĐT- ZALO 0979 092 604 – 0987 268 794',
        branchServices: 'THU CƯỚC –LẮP ĐẶT INTERNET – SIM SỐ ĐẸP'
    };

    const handleDownloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Mau_In_Thong_Bao');

        worksheet.columns = [
            { header: 'Khách Hàng', key: 'customerName', width: 25 },
            { header: 'Địa Chỉ', key: 'address', width: 40 },
            { header: 'Thuê Bao', key: 'phone', width: 15 },
            { header: 'Dịch Vụ & Tháng', key: 'serviceMonth', width: 30 },
            { header: 'Số Tiền', key: 'amount', width: 15 },
            { header: 'Ngày In', key: 'dateString', width: 25 },
            { header: 'Nhân Viên', key: 'collectorName', width: 20 },
            { header: 'SĐT NV', key: 'collectorPhone', width: 15 },
        ];

        // Add dummy data
        worksheet.addRow({
            customerName: 'Nguyễn Lê Nin Đa',
            address: '23H Nguyễn ảnh Thủ, Khu phố 3, P. Hiệp Thành',
            phone: '977719919',
            serviceMonth: 'INTERNET TRẢ SAU THÁNG 06/2026',
            amount: '400,000Đ',
            dateString: 'TP. HCM, ngày 10 tháng 07 năm 2026',
            collectorName: 'ĐỖ THỊ NGỌC MAI',
            collectorPhone: '0979092604'
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Mau_In_Thong_Bao.xlsx';
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError(null);

        try {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            const worksheet = workbook.worksheets[0];
            
            const parsedData: BillData[] = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return; // Skip header

                const getVal = (col: number) => {
                    const val = row.getCell(col).value;
                    if (val && typeof val === 'object' && 'richText' in val) {
                        return val.richText.map((rt: any) => rt.text).join('');
                    }
                    return val ? val.toString() : '';
                };

                const customerName = getVal(1);
                if (!customerName) return; // Bỏ qua dòng trống

                const rawAmount = getVal(5);
                const parsedAmountNum = parseExcelNumber(rawAmount);

                parsedData.push({
                    id: Math.random().toString(36).substr(2, 9),
                    customerName: getVal(1),
                    address: getVal(2),
                    phone: getVal(3),
                    serviceMonth: getVal(4),
                    amount: formatNumber(parsedAmountNum),
                    amountInWords: numberToWordsVN(parsedAmountNum),
                    dateString: getVal(6),
                    collectorName: getVal(7),
                    collectorPhone: getVal(8),
                    ...branchConfig
                });
            });

            setData(parsedData);
        } catch (err: any) {
            console.error('Excel parse error:', err);
            setError('Lỗi khi đọc file Excel. Vui lòng đảm bảo đúng định dạng mẫu.');
        } finally {
            setLoading(false);
            // reset input
            e.target.value = '';
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: 'In_Thong_Bao_Cuoc',
        pageStyle: `
            @page {
                size: A5 landscape;
                margin: 0;
            }
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                }
            }
        `
    });

    const clearData = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách?')) {
            setData([]);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    In Thông Báo Cước (Khổ A5)
                </Typography>
                
                <Stack direction="row" spacing={2}>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={handleDownloadTemplate}
                    >
                        Tải File Mẫu
                    </Button>
                    
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                        disabled={loading}
                    >
                        Nhập từ Excel
                        <input
                            type="file"
                            hidden
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                        />
                    </Button>
                    
                    <Button
                        variant="contained"
                        color="secondary"
                        startIcon={<PrintIcon />}
                        disabled={data.length === 0}
                        onClick={() => handlePrint()}
                    >
                        In {data.length > 0 ? `(${data.length})` : ''}
                    </Button>
                    
                    {data.length > 0 && (
                        <IconButton color="error" onClick={clearData} title="Xóa danh sách">
                            <DeleteIcon />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
            )}

            <Paper sx={{ width: '100%', mb: 2, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell><b>STT</b></TableCell>
                                <TableCell><b>Khách Hàng</b></TableCell>
                                <TableCell><b>Thuê Bao</b></TableCell>
                                <TableCell><b>Địa Chỉ</b></TableCell>
                                <TableCell><b>Dịch Vụ & Tháng</b></TableCell>
                                <TableCell><b>Số Tiền</b></TableCell>
                                <TableCell><b>Bằng Chữ</b></TableCell>
                                <TableCell><b>Nhân Viên</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 5 }}>
                                        Chưa có dữ liệu. Vui lòng tải file mẫu và nhập liệu.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                data.map((row, index) => (
                                    <TableRow hover key={row.id}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>{row.customerName}</TableCell>
                                        <TableCell>{row.phone}</TableCell>
                                        <TableCell>{row.address}</TableCell>
                                        <TableCell>{row.serviceMonth}</TableCell>
                                        <TableCell>{row.amount}</TableCell>
                                        <TableCell>{row.amountInWords}</TableCell>
                                        <TableCell>{row.collectorName}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Hidden container for printing */}
            <Box sx={{ display: 'none' }}>
                <div ref={printRef}>
                    {data.map((item) => (
                        <BillTemplateA5 key={item.id} data={item} />
                    ))}
                </div>
            </Box>
        </Box>
    );
};

export default PrintBillNotification;
