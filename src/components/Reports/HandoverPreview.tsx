import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { readMoney } from '../../utils/excelUtils';
import { createPortal } from 'react-dom';

interface HandoverPreviewProps {
    data: any[];
    employeeName: string;
    date: string;
    reporterName: string;
    senderPhone?: string;
    receiverPhone?: string;
    reportNumber?: number;
}

const HandoverTemplate = ({ data, employeeName, date, reporterName, senderPhone, receiverPhone, reportNumber = 1 }: HandoverPreviewProps) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const dateObj = new Date(date);

    return (
        <Box sx={{ p: 4, bgcolor: 'white', color: 'black', minWidth: 800, fontFamily: "'Times New Roman', Times, serif" }}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" mb={2} alignItems="flex-start">
                <Box textAlign="left" sx={{ flexShrink: 0, width: '30%' }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', color: 'blue', lineHeight: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', color: 'blue', lineHeight: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                </Box>

                <Box textAlign="center" sx={{ flexGrow: 1, width: '40%', mt: 4, px: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontSize: '24pt', color: 'red', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        PHIẾU XUẤT KHO
                    </Typography>
                    <Typography sx={{ fontSize: '12pt', color: 'blue', mt: 2 }}>
                        Ngày {String(dateObj.getDate()).padStart(2, '0')} tháng {String(dateObj.getMonth() + 1).padStart(2, '0')} năm {dateObj.getFullYear()}
                    </Typography>
                </Box>

                <Box textAlign="center" sx={{ flexShrink: 0, width: '30%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Box textAlign="center">
                        <Typography fontWeight="bold" sx={{ fontSize: '10pt', lineHeight: 1.2 }}>Mẫu số: 01 - VT</Typography>
                        <Typography sx={{ fontSize: '9pt', lineHeight: 1.2 }}>Ban hành theo QĐ số</Typography>
                        <Typography sx={{ fontSize: '9pt', lineHeight: 1.2 }}>1141-TC/QĐ/CĐKT</Typography>
                        <Typography sx={{ fontSize: '9pt', lineHeight: 1.2 }}>Ngày 01 tháng 11 năm 1995</Typography>
                        <Typography sx={{ fontSize: '9pt', lineHeight: 1.2 }}>của bộ tài chính</Typography>
                    </Box>
                    <Box sx={{ mt: 1, mr: 2 }}>
                        <QrCode2Icon sx={{ fontSize: 80 }} />
                    </Box>
                </Box>
            </Box>

            <Box borderBottom="2px solid black" borderTop="2px solid black" py={0.5} mb={2}>
                <Typography align="center" fontWeight="bold" sx={{ fontSize: '12pt', color: '#1e4b9b' }}>
                    Số phiếu : PXK-ACT-BSG-{String(reportNumber).padStart(6, '0')}/{dateObj.getMonth() + 1}-{dateObj.getFullYear()}
                </Typography>
            </Box>

            {/* Info */}
            <Box mb={1} sx={{ fontSize: '12pt', color: 'blue' }}>
                <Typography fontWeight="bold" mb={0.5}>BÊN GIAO :</Typography>
                <Box display="flex" justifyContent="space-between">
                    <Typography>Họ tên người giao hàng : <b>{reporterName}</b></Typography>
                    <Typography>Chức vụ: Nhân viên - QLTS(Kho)</Typography>
                    <Typography>Điện thoại : {senderPhone}</Typography>
                </Box>
                <Typography>Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Trung Mỹ Tây , Tp.Hồ Chí Minh</Typography>
                <Typography>Lý do xuất: Xuất hàng hóa,vật tư phát triển và xử lý sự cố, UCTT.....</Typography>
            </Box>

            <Box mb={2} sx={{ fontSize: '12pt', color: 'blue' }}>
                <Typography fontWeight="bold" mb={0.5}>BÊN NHẬN :</Typography>
                <Typography>Địa chỉ(Bộ phận) : 455A Trần Thị Năm , P.Trung Mỹ Tây , Tp.Hồ Chí Minh</Typography>
                <Box display="flex" justifyContent="space-between">
                    <Typography>Họ tên người nhận hàng : <b style={{ color: 'red' }}>{employeeName}</b></Typography>
                    <Typography>Chức vụ: Nhân viên Kỹ thuật CĐBR</Typography>
                    <Typography>Điện thoại : {receiverPhone}</Typography>
                </Box>
            </Box>

            {/* Table */}
            <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid black', fontSize: '12pt', padding: '4px' } }}>
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

            <Typography sx={{ fontSize: '12pt' }} fontStyle="italic" align="center" mb={4}>
                Lưu ý : Kiểm tra trước khi đi, mọi khiếu nại về sau không giải quyết. Trân trọng !
            </Typography>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" px={6} mt={4} mb={6}>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>Người nhận</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '12pt' }}>(Ký, họ tên)</Typography>
                    <Box height={100} />
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textTransform: 'uppercase' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>Thủ kho</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '12pt' }}>(Ký, họ tên)</Typography>
                    <Box height={100} />
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textTransform: 'uppercase' }}>{reporterName}</Typography>
                </Box>
                <Box textAlign="center">
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt' }}>Thủ trưởng đơn vị</Typography>
                    <Typography fontStyle="italic" sx={{ fontSize: '12pt' }}>(Ký, họ tên)</Typography>
                    <Box height={100} />
                    <Typography fontWeight="bold" sx={{ fontSize: '12pt', textTransform: 'uppercase' }}>TRẦN KIM HÙNG</Typography>
                </Box>
            </Box>
        </Box>
    );
};

const HandoverPreview = (props: HandoverPreviewProps) => {
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

            {/* Display Preview in Dialog */}
            <HandoverTemplate {...props} />

            {/* Print Version via Portal */}
            {createPortal(
                <div id="print-portal-root">
                    <HandoverTemplate {...props} />
                </div>,
                document.body
            )}
        </Box>
    );
};

export default HandoverPreview;

