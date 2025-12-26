
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { readMoney } from '../../utils/excelUtils';
import { createPortal } from 'react-dom';

interface ReturnsReportPreviewProps {
    data: any[];
    employeeName: string;
    date: string;
    receiverName: string;
}

const ReturnsReportTemplate = ({ data, employeeName, date, receiverName }: ReturnsReportPreviewProps) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const dateObj = new Date(date);

    return (
        <Box sx={{
            bgcolor: 'white',
            color: 'black',
            maxWidth: '210mm',
            mx: 'auto',
            p: 2,
            fontFamily: "'Times New Roman', Times, serif"
        }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box sx={{ width: '45%' }}>
                    <Typography fontWeight="bold" fontSize={11} sx={{ textTransform: 'uppercase', color: '#1976d2', fontFamily: 'inherit' }}>
                        TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN
                    </Typography>
                    <Typography fontSize={11} fontWeight="bold" sx={{ color: '#1976d2', fontFamily: 'inherit' }}>
                        455A TRẦN THỊ NĂM P.TMT QUẬN 12
                    </Typography>
                    <Typography fontSize={11} mt={0.5} sx={{ color: '#1976d2', fontFamily: 'inherit' }}>
                        Số: ............/BBNK-ACT
                    </Typography>
                </Box>
                <Box textAlign="center" sx={{ width: '55%' }}>
                    <Typography fontWeight="bold" fontSize={11} sx={{ textTransform: 'uppercase', color: '#d32f2f', fontFamily: 'inherit' }}>
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </Typography>
                    <Typography fontWeight="bold" fontSize={12} sx={{ borderBottom: '1px solid #d32f2f', display: 'inline-block', pb: 0.5, mb: 0.5, color: '#d32f2f', fontFamily: 'inherit' }}>
                        Độc lập - Tự do - Hạnh phúc
                    </Typography>
                    <Typography fontSize={11} fontStyle="italic" sx={{ fontFamily: 'inherit' }}>
                        ................, ngày {dateObj.getDate()} tháng {dateObj.getMonth() + 1} năm {dateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            <Typography variant="h6" align="center" fontWeight="bold" sx={{ mb: 2, textTransform: 'uppercase', color: '#d32f2f', fontFamily: 'inherit' }}>
                BIÊN BẢN NHẬP KHO VẬT TƯ HÀNG HÓA
            </Typography>

            {/* Parties */}
            <Box sx={{ mb: 2, fontSize: '13px', fontFamily: 'inherit' }}>
                <Typography fontWeight="bold" mb={0.5} sx={{ color: '#1976d2', fontFamily: 'inherit' }}>1. BÊN GIAO (BÊN TRẢ HÀNG):</Typography>
                <Box ml={3}>
                    <Typography gutterBottom sx={{ margin: 0, fontFamily: 'inherit' }}>- Họ tên người trả hàng: <b style={{ textTransform: 'uppercase', color: '#000' }}>{employeeName}</b></Typography>
                    <Typography gutterBottom sx={{ margin: 0, fontFamily: 'inherit' }}>- Bộ phận: <b style={{ color: '#000' }}>Kỹ thuật CĐBR</b></Typography>
                </Box>

                <Typography fontWeight="bold" mt={1} mb={0.5} sx={{ color: '#1976d2', fontFamily: 'inherit' }}>2. BÊN NHẬN (NHẬP KHO):</Typography>
                <Box ml={3}>
                    <Typography gutterBottom sx={{ margin: 0, fontFamily: 'inherit' }}>- Đơn vị: <b style={{ color: '#000' }}>Kho ACT - Khu vực Bắc Sài Gòn</b></Typography>
                    <Typography gutterBottom sx={{ margin: 0, fontFamily: 'inherit' }}>- Người nhận: <b style={{ textTransform: 'uppercase', color: '#000' }}>{receiverName}</b></Typography>
                </Box>
            </Box>

            <Typography mb={1} fontStyle="italic" fontSize={13} sx={{ fontFamily: 'inherit' }}>
                Hai bên thống nhất tiến hành lập biên bản nhập kho với chi tiết như sau:
            </Typography>

            {/* Table */}
            <Table size="small" sx={{
                borderCollapse: 'collapse',
                border: '1px solid #1976d2', // Blue Border
                tableLayout: 'fixed',
                width: '100%',
                '& td, & th': {
                    border: '1px solid #1976d2', // Blue Border
                    padding: '3px 4px',
                    fontSize: '11px',
                    verticalAlign: 'middle',
                    color: '#000',
                    fontFamily: "'Times New Roman', Times, serif"
                }
            }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#4472C4' }}>
                        <TableCell align="center" width="30" sx={{ color: 'white !important', fontWeight: 'bold' }}>STT</TableCell>
                        <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold' }}>Tên Hàng Hóa / Vật Tư</TableCell>
                        <TableCell align="center" width="40" sx={{ color: 'white !important', fontWeight: 'bold' }}>ĐVT</TableCell>
                        <TableCell align="center" width="35" sx={{ color: 'white !important', fontWeight: 'bold' }}>SL</TableCell>
                        <TableCell align="center" width="70" sx={{ color: 'white !important', fontWeight: 'bold' }}>Đơn Giá</TableCell>
                        <TableCell align="center" width="80" sx={{ color: 'white !important', fontWeight: 'bold' }}>Thành Tiền</TableCell>
                        <TableCell align="center" width="100" sx={{ color: 'white !important', fontWeight: 'bold' }}>Serial</TableCell>
                        <TableCell align="center" width="80" sx={{ color: 'white !important', fontWeight: 'bold' }}>Ly Do</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f5f9ff' } }}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.product_name}
                            </TableCell>
                            <TableCell align="center">{item.unit}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}</TableCell>
                            <TableCell sx={{ fontSize: '10px', wordBreak: 'break-all', lineHeight: 1.1 }}>{item.serial_code}</TableCell>
                            <TableCell sx={{ fontSize: '10px' }}>{item.reason}</TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: '#e8f0fe' }}>
                        <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>TỔNG CỘNG</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                        <TableCell sx={{ bgcolor: '#e8f0fe' }}></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        </TableCell>
                        <TableCell colSpan={2} sx={{ bgcolor: '#e8f0fe' }}></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Box mt={1} mb={3}>
                <Typography fontStyle="italic" fontSize={13} sx={{ mt: 1, fontFamily: 'inherit' }}>
                    - Tổng số tiền (bằng chữ): <b>{readMoney(totalAmount)}</b>
                </Typography>
                <Typography fontStyle="italic" fontSize={13} sx={{ fontFamily: 'inherit' }}>
                    - Hàng hóa đã được kiểm tra, giao nhận đầy đủ đúng chủng loại, số lượng và chất lượng theo danh sách trên.
                </Typography>
            </Box>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" mt={1} sx={{ fontFamily: 'inherit' }}>
                <Box textAlign="center" width="45%">
                    <Typography fontWeight="bold" fontSize={12} sx={{ color: '#1976d2', fontFamily: 'inherit' }}>NGƯỜI GIAO HÀNG</Typography>
                    <Typography fontStyle="italic" fontSize={11} sx={{ fontFamily: 'inherit' }}>(Ký, ghi rõ họ tên)</Typography>
                    <Box height={70} />
                    <Typography fontWeight="bold" fontSize={12} sx={{ textTransform: 'uppercase', fontFamily: 'inherit' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center" width="45%">
                    <Typography fontWeight="bold" fontSize={12} sx={{ color: '#1976d2', fontFamily: 'inherit' }}>THỦ KHO</Typography>
                    <Typography fontStyle="italic" fontSize={11} sx={{ fontFamily: 'inherit' }}>(Ký, ghi rõ họ tên)</Typography>
                    <Box height={70} />
                    <Typography fontWeight="bold" fontSize={12} sx={{ textTransform: 'uppercase', fontFamily: 'inherit' }}>{receiverName}</Typography>
                </Box>
            </Box>
        </Box>
    );
};

const ReturnsReportPreview = (props: ReturnsReportPreviewProps) => {
    return (
        <Box>
            <style>
                {`
                    @media print {
                        body > * {
                            display: none !important;
                        }
                        body > #print-portal-root {
                            display: block !important;
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 99999;
                            background: white;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 10mm;
                        }
                    }
                    /* Hide print portal normally */
                    #print-portal-root {
                        display: none;
                    }
                `}
            </style>

            {/* Display Preview inside Dialog */}
            <ReturnsReportTemplate {...props} />

            {/* Print Version via Portal */}
            {createPortal(
                <div id="print-portal-root">
                    <ReturnsReportTemplate {...props} />
                </div>,
                document.body
            )}
        </Box>
    );
};

export default ReturnsReportPreview;
