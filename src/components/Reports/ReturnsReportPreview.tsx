
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
            minWidth: 800,
            p: 4,
            fontFamily: "'Times New Roman', Times, serif"
        }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" mb={3} alignItems="flex-start">
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '13pt', textTransform: 'uppercase', lineHeight: 1.2 }}>TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN</Typography>
                    <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.2 }}>455A TRẦN THỊ NĂM P.TMT QUẬN 12</Typography>
                    <Typography sx={{ fontSize: '11pt', mt: 0.5, lineHeight: 1.2 }}>Số: ............/BBNK-ACT</Typography>
                </Box>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '13pt', textTransform: 'uppercase', lineHeight: 1.2 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textDecoration: 'underline', lineHeight: 1.2 }}>Độc lập - Tự do - Hạnh phúc</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '12pt', mt: 1, textAlign: 'right' }}>
                        ................, ngày {dateObj.getDate()} tháng {dateObj.getMonth() + 1} năm {dateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            <Typography variant="h5" align="center" color="error" fontWeight="bold" sx={{ fontSize: '18pt', my: 2 }}>
                BIÊN BẢN NHẬP KHO VẬT TƯ HÀNG HÓA
            </Typography>

            {/* Parties */}
            <Box mb={3} sx={{ fontSize: '12pt' }}>
                <Typography fontWeight="bold" mb={0.5}>1. BÊN GIAO (BÊN TRẢ HÀNG):</Typography>
                <Box ml={3}>
                    <Typography>- Họ tên người trả hàng: <b style={{ textTransform: 'uppercase' }}>{employeeName}</b></Typography>
                    <Typography>- Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                </Box>

                <Typography fontWeight="bold" mt={1} mb={0.5}>2. BÊN NHẬN (NHẬP KHO):</Typography>
                <Box ml={3}>
                    <Typography>- Đơn vị: <b>Kho ACT - Khu vực Bắc Sài Gòn</b></Typography>
                    <Typography>- Người nhận: <b style={{ textTransform: 'uppercase' }}>{receiverName}</b></Typography>
                </Box>
            </Box>

            <Typography mb={2} fontStyle="italic" sx={{ fontSize: '12pt' }}>
                Hai bên thống nhất tiến hành lập biên bản nhập kho với chi tiết như sau:
            </Typography>

            {/* Table */}
            <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid black', fontSize: '11pt', padding: '4px' } }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#BDD7EE' }}>
                        <TableCell align="center" width="5%" sx={{ color: 'black', fontWeight: 'bold' }}>STT</TableCell>
                        <TableCell align="center" width="35%" sx={{ color: 'black', fontWeight: 'bold' }}>TÊN HÀNG HÓA / VẬT TƯ</TableCell>
                        <TableCell align="center" width="5%" sx={{ color: 'black', fontWeight: 'bold' }}>ĐVT</TableCell>
                        <TableCell align="center" width="5%" sx={{ color: 'black', fontWeight: 'bold' }}>SL</TableCell>
                        <TableCell align="center" width="10%" sx={{ color: 'black', fontWeight: 'bold' }}>ĐƠN GIÁ</TableCell>
                        <TableCell align="center" width="10%" sx={{ color: 'black', fontWeight: 'bold' }}>THÀNH TIỀN</TableCell>
                        <TableCell align="center" width="20%" sx={{ color: 'black', fontWeight: 'bold' }}>SERIAL</TableCell>
                        <TableCell align="center" width="10%" sx={{ color: 'black', fontWeight: 'bold' }}>LÝ DO</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell align="center">{item.unit}</TableCell>
                            <TableCell align="center">{item.quantity}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all', maxWidth: 120 }}>{item.serial_code}</TableCell>
                            <TableCell>{item.reason}</TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: '#FFF2CC' }}>
                        <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold' }}>TỔNG CỘNG</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 'bold' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                        <TableCell colSpan={1}></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        </TableCell>
                        <TableCell colSpan={2}></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Box mt={2} mb={3}>
                <Typography fontStyle="italic" sx={{ fontSize: '12pt', mt: 1 }}>
                    - Tổng số tiền (bằng chữ): <b>{readMoney(totalAmount)}</b>
                </Typography>
                <Typography fontStyle="italic" sx={{ fontSize: '12pt' }}>
                    - Hàng hóa đã được kiểm tra, giao nhận đầy đủ đúng chủng loại, số lượng và chất lượng theo danh sách trên.
                </Typography>
            </Box>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-around" mt={2}>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>NGƯỜI GIAO HÀNG</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '11pt' }}>(Ký, ghi rõ họ tên)</Typography>
                    <Box height={100} />
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textTransform: 'uppercase' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>THỦ KHO</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '11pt' }}>(Ký, ghi rõ họ tên)</Typography>
                    <Box height={100} />
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textTransform: 'uppercase' }}>{receiverName}</Typography>
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
