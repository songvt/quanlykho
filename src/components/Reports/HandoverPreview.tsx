
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper } from '@mui/material';
import { readMoney } from '../../utils/excelUtils';

interface HandoverPreviewProps {
    data: any[];
    employeeName: string;
    date: string;
    reporterName: string;
    senderPhone?: string;
    receiverPhone?: string;
    reportNumber?: number;
}

const HandoverPreview = ({ data, employeeName, date, reporterName, senderPhone, receiverPhone, reportNumber = 1 }: HandoverPreviewProps) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const dateObj = new Date(date);

    return (
        <Box sx={{ position: 'relative' }}>
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #handover-preview-content, #handover-preview-content * {
                            visibility: visible;
                        }
                        #handover-preview-content {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 0;
                            margin: 0;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                `}
            </style>

            {/* Print Button removed - moved to parent component */}

            <div id="handover-preview-content">
                <Paper elevation={0} sx={{ p: 4, bgcolor: 'white', color: 'black', minWidth: 800, fontFamily: "'Times New Roman', Times, serif" }}>
                    {/* Header */}
                    <Box display="flex" justifyContent="space-between" mb={3} alignItems="flex-start">
                        <Box textAlign="center">
                            <Typography fontWeight="bold" sx={{ fontSize: '13pt', textTransform: 'uppercase', lineHeight: 1.2 }}>TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN</Typography>
                            <Typography sx={{ fontSize: '11pt', fontWeight: 'bold', lineHeight: 1.2 }}>455A TRẦN THỊ NĂM P.TMT QUẬN 12</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography fontWeight="bold" sx={{ fontSize: '13pt', textTransform: 'uppercase', lineHeight: 1.2 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                            <Typography fontWeight="bold" sx={{ fontSize: '12pt', textDecoration: 'underline', lineHeight: 1.2 }}>Độc lập - Tự do - Hạnh phúc</Typography>
                            <Typography color="error" sx={{ fontSize: '12pt', fontStyle: 'italic', mt: 1, textAlign: 'right' }}>BBBG-BSG/ACT :PX-{reportNumber}</Typography>
                        </Box>
                    </Box>

                    <Typography variant="h5" align="center" color="error" fontWeight="bold" sx={{ fontSize: '18pt', my: 2 }}>
                        BIÊN BẢN BÀN GIAO VẬT TƯ HÀNG HÓA
                    </Typography>
                    <Typography align="center" mb={3} sx={{ fontStyle: 'italic', fontSize: '12pt' }}>
                        Ngày {dateObj.getDate()} tháng {dateObj.getMonth() + 1} năm {dateObj.getFullYear()}
                    </Typography>

                    {/* Info */}
                    <Box mb={2} sx={{ fontSize: '12pt' }}>
                        <Typography fontWeight="bold" mb={0.5}>BÊN GIAO :</Typography>
                        <Typography>Họ tên người giao hàng : <b>{reporterName}</b></Typography>
                        <Typography>Chức vụ: Nhân viên - QLTS(Kho) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Điện thoại : {senderPhone}</Typography>
                        <Typography>Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12</Typography>
                        <Typography>Lý do xuất: Xuất hàng hóa,vật tư phát triển và xử lý sự cố, UCTT.....</Typography>
                    </Box>

                    <Box mb={3} sx={{ fontSize: '12pt' }}>
                        <Typography fontWeight="bold" mb={0.5}>BÊN NHẬN :</Typography>
                        <Typography>Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12</Typography>
                        <Typography>Họ tên người nhận hàng : <b style={{ color: 'red' }}>{employeeName}</b></Typography>
                        <Typography>Chức vụ: Nhân viên Kỹ thuật CĐBR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Điện thoại : {receiverPhone}</Typography>
                    </Box>

                    {/* Table */}
                    <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid black', fontSize: '11pt', padding: '4px' } }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#BDD7EE' }}> {/* Standard Excel-like blue */}
                                <TableCell align="center" width="7%" sx={{ color: 'black', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" width="35%" sx={{ color: 'black', fontWeight: 'bold' }}>TÊN HÀNG HÓA</TableCell>
                                <TableCell align="center" width="7%" sx={{ color: 'black', fontWeight: 'bold' }}>ĐVT</TableCell>
                                <TableCell align="center" width="7%" sx={{ color: 'black', fontWeight: 'bold' }}>SL</TableCell>
                                <TableCell align="center" width="12%" sx={{ color: 'black', fontWeight: 'bold' }}>ĐƠN GIÁ</TableCell>
                                <TableCell align="center" width="12%" sx={{ color: 'black', fontWeight: 'bold' }}>THÀNH TIỀN</TableCell>
                                <TableCell align="center" width="20%" sx={{ color: 'black', fontWeight: 'bold' }}>SERIAL</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell align="center">{index + 1}</TableCell>
                                    <TableCell>{item.product_name}</TableCell>
                                    <TableCell align="center">{item.unit}</TableCell>
                                    <TableCell align="center">{item.quantity}</TableCell>
                                    <TableCell align="right">
                                        {new Intl.NumberFormat('vi-VN').format(item.unit_price)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}
                                    </TableCell>
                                    <TableCell sx={{ maxWidth: 200, wordBreak: 'break-all' }}>{item.serial_code}</TableCell>
                                </TableRow>
                            ))}
                            {/* Total Row */}
                            <TableRow sx={{ bgcolor: '#FFF2CC' }}> {/* Light yellow for total */}
                                <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold' }}>TỔNG CỘNG</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                                <TableCell colSpan={2} align="right" sx={{ fontWeight: 'bold' }}>
                                    {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                                </TableCell>
                                <TableCell colSpan={1}></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <Typography align="center" fontWeight="bold" fontStyle="italic" my={2} sx={{ border: '1px solid black', p: 1, fontSize: '12pt' }}>
                        Tổng số tiền (viết bằng chữ): {readMoney(totalAmount)}
                    </Typography>

                    <Typography fontSize={11} fontStyle="italic" align="center" mb={4}>
                        Lưu ý : Kiểm tra trước khi đi, mọi khiếu nại về sau không giải quyết. Trân trọng !
                    </Typography>

                    {/* Signatures */}
                    <Box display="flex" justifyContent="space-around" px={2} mb={5}>
                        <Box textAlign="center">
                            <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>BÊN GIAO</Typography>
                            <Typography fontStyle="italic" sx={{ fontSize: '11pt' }}>(Ký, họ tên)</Typography>
                            <Box height={100} />
                            <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>{reporterName}</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>BÊN NHẬN</Typography>
                            <Typography fontStyle="italic" sx={{ fontSize: '11pt' }}>(Ký, họ tên)</Typography>
                            <Box height={100} />
                            <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>{employeeName}</Typography>
                        </Box>
                    </Box>
                </Paper>
            </div>
        </Box>
    );
};

export default HandoverPreview;
