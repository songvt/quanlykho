
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, Button } from '@mui/material';
import { readMoney } from '../../utils/excelUtils';

interface HandoverPreviewProps {
    data: any[];
    employeeName: string;
    date: string;
    reporterName: string;
}

const HandoverPreview = ({ data, employeeName, date, reporterName }: HandoverPreviewProps) => {
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

            {/* Print Button */}
            <Box className="no-print" sx={{ position: 'absolute', top: -60, right: 0, mb: 2 }}>
                <Button
                    variant="contained"
                    onClick={() => window.print()}
                    sx={{ bgcolor: 'primary.main', fontWeight: 'bold' }}
                >
                    In Biên Bản
                </Button>
            </Box>

            <div id="handover-preview-content">
                <Paper elevation={0} sx={{ p: 4, bgcolor: 'white', color: 'black', minWidth: 800 }}>
                    {/* Header */}
                    <Box display="flex" justifyContent="space-between" mb={2}>
                        <Box>
                            <Typography fontWeight="bold" color="primary.main">TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN</Typography>
                            <Typography fontSize={12} fontWeight="bold" color="primary.main">455A TRẦN THỊ NĂM P.TMT QUẬN 12</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography fontWeight="bold" color="primary.main">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                            <Typography fontWeight="bold" fontSize={12} color="primary.main">Độc lập - Tự do - Hạnh phúc</Typography>
                            <Typography color="error" fontSize={12} align="right" mt={1}>BBBG-BSG/ACT :PX-1</Typography>
                        </Box>
                    </Box>

                    <Typography variant="h5" align="center" color="error" fontWeight="bold" my={2}>
                        BIÊN BẢN BÀN GIAO VẬT TƯ HÀNG HÓA
                    </Typography>
                    <Typography align="center" mb={3} sx={{ fontStyle: 'italic', color: 'primary.main' }}>
                        Ngày {dateObj.getDate()} tháng {dateObj.getMonth() + 1} năm {dateObj.getFullYear()}
                    </Typography>

                    {/* Info */}
                    <Box mb={2}>
                        <Typography fontWeight="bold" color="primary.main">BÊN GIAO :</Typography>
                        <Typography>Họ tên người giao hàng : <b>{reporterName}</b></Typography>
                        <Typography>Chức vụ: Nhân viên - QLTS(Kho) &nbsp;&nbsp;&nbsp; Điện thoại : 0988229082</Typography>
                        <Typography>Địa chỉ(Bộ phận) :455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12</Typography>
                        <Typography>Lý do xuất: Xuất hàng hóa,vật tư phát triển và xử lý sự cố, UCTT.....</Typography>
                    </Box>

                    <Box mb={3}>
                        <Typography fontWeight="bold" color="primary.main">BÊN NHẬN :</Typography>
                        <Typography>Địa chỉ(Bộ phận) :455A Trần Thị Năm , P.Tân Chánh Hiệp , Quận 12</Typography>
                        <Typography>Họ tên người nhận hàng : <b style={{ color: 'red' }}>{employeeName}</b></Typography>
                        <Typography>Chức vụ: Nhân viên Kỹ thuật CĐBR &nbsp;&nbsp;&nbsp; Điện thoại : 977232246</Typography>
                    </Box>

                    {/* Table */}
                    <Table size="small" sx={{ border: '1px solid black' }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#4472C4' }}>
                                {['STT', 'MÃ HÀNG', 'TÊN HÀNG HÓA', 'ĐVT', 'SL', 'ĐƠN GIÁ', 'THÀNH TIỀN', 'SERIAL', 'NV NHẬN'].map((h) => (
                                    <TableCell key={h} align="center" sx={{ color: 'white', fontWeight: 'bold', border: '1px solid black' }}>{h}</TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell align="center" sx={{ border: '1px solid black' }}>{index + 1}</TableCell>
                                    <TableCell sx={{ border: '1px solid black' }}>{item.item_code}</TableCell>
                                    <TableCell sx={{ border: '1px solid black' }}>{item.product_name}</TableCell>
                                    <TableCell align="center" sx={{ border: '1px solid black' }}>{item.unit}</TableCell>
                                    <TableCell align="center" sx={{ border: '1px solid black' }}>{item.quantity}</TableCell>
                                    <TableCell align="right" sx={{ border: '1px solid black' }}>
                                        {new Intl.NumberFormat('vi-VN').format(item.unit_price)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ border: '1px solid black' }}>
                                        {new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}
                                    </TableCell>
                                    <TableCell sx={{ border: '1px solid black' }}>{item.serial_code}</TableCell>
                                    <TableCell sx={{ border: '1px solid black' }}>{employeeName}</TableCell>
                                </TableRow>
                            ))}
                            {/* Total Row */}
                            <TableRow sx={{ bgcolor: '#b8cce4' }}>
                                <TableCell colSpan={4} align="center" sx={{ border: '1px solid black', fontWeight: 'bold' }}>TỔNG CỘNG</TableCell>
                                <TableCell align="center" sx={{ border: '1px solid black', fontWeight: 'bold' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                                <TableCell colSpan={2} align="right" sx={{ border: '1px solid black', fontWeight: 'bold' }}>
                                    {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                                </TableCell>
                                <TableCell colSpan={2} sx={{ border: '1px solid black' }}></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <Typography align="center" fontWeight="bold" fontStyle="italic" my={2} sx={{ border: '1px solid black', p: 1 }}>
                        Tổng số tiền (viết bằng chữ): {readMoney(totalAmount)}
                    </Typography>

                    <Typography fontSize={12} fontStyle="italic" align="center" mb={4}>
                        Lưu ý : Kiểm tra trước khi đi,mọi khiếu nại về sau không giải quyết.Trân trọng !
                    </Typography>

                    {/* Signatures */}
                    <Box display="flex" justifyContent="space-between" px={5}>
                        <Box textAlign="center">
                            <Typography fontWeight="bold">BÊN GIAO</Typography>
                            <Typography fontStyle="italic">(Ký, họ tên)</Typography>
                            <Box height={60} />
                            <Typography fontWeight="bold">{reporterName}</Typography>
                        </Box>
                        <Box textAlign="center">
                            <Typography fontWeight="bold">BÊN NHẬN</Typography>
                            <Typography fontStyle="italic">(Ký, họ tên)</Typography>
                            <Box height={60} />
                            <Typography fontWeight="bold">{employeeName}</Typography>
                        </Box>
                    </Box>
                </Paper>
            </div>
        </Box>
    );
};

export default HandoverPreview;
