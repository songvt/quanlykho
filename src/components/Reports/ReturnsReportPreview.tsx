import React from 'react';
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
            color: '#000000',
            minWidth: 800,
            p: 6,
            fontFamily: "'Times New Roman', Times, serif",
            '@media print': { p: 0 }
        }}>
            {/* Header section with split layout */}
            <Box display="flex" mb={4} alignItems="flex-start">
                <Box flex={1.2} textAlign="center">
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', color: '#000000', textTransform: 'uppercase', lineHeight: 1.2 }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                    <Typography sx={{ fontSize: '10pt', fontWeight: 700, color: '#000000', mt: 0.5 }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                    <Box sx={{ mt: 1, height: '1.5px', width: '80px', bgcolor: '#000000', mx: 'auto' }} />
                </Box>
                <Box flex={1} textAlign="center">
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', textTransform: 'uppercase', lineHeight: 1.2 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '10pt', textDecoration: 'underline', lineHeight: 1.2 }}>Độc lập - Tự do - Hạnh phúc</Typography>
                    <Typography sx={{ fontSize: '10pt', fontStyle: 'italic', color: '#000000', mt: 2 }}>
                        TP. Hồ Chí Minh, ngày {dateObj.getDate().toString().padStart(2, '0')} tháng {(dateObj.getMonth() + 1).toString().padStart(2, '0')} năm {dateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            <Box textAlign="center" mb={4}>
                <Typography sx={{ fontWeight: 800, fontSize: '20pt', color: '#000000', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    BIÊN BẢN NHẬP KHO
                </Typography>
                <Typography sx={{ fontSize: '11pt', color: '#000000', mt: 1, fontWeight: 700 }}>
                    (VẬT TƯ HÀNG HÓA HOÀN TRẢ)
                </Typography>
            </Box>

            {/* Information Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mb: 4 }}>
                <Box sx={{ p: 2, border: '1.5px solid #000000', borderRadius: '4px', bgcolor: 'transparent' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10.5pt', color: '#000000', mb: 1, textTransform: 'uppercase', borderBottom: '1px solid #000000', pb: 0.5 }}>Bên giao (Hoàn trả)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b style={{ textTransform: 'uppercase' }}>{employeeName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Lý do: Hoàn trả vật tư thừa/hỏng sau triển khai</Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2, border: '1.5px solid #000000', borderRadius: '4px', bgcolor: 'transparent' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10.5pt', color: '#000000', mb: 1, textTransform: 'uppercase', borderBottom: '1px solid #000000', pb: 0.5 }}>Bên nhận (Nhập kho)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Đơn vị: <b>Kho ACT Bắc Sài Gòn</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Người nhận: <b style={{ textTransform: 'uppercase' }}>{receiverName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Chức vụ: Thủ kho / Quản lý kho</Typography>
                    </Box>
                </Box>
            </Box>

            <Typography mb={2} sx={{ fontSize: '10pt', color: '#000000', fontStyle: 'italic' }}>
                Hai bên thống nhất tiến hành lập biên bản nhập kho với chi tiết hàng hóa như sau:
            </Typography>

            {/* Table */}
            <Table size="small" sx={{ 
                borderCollapse: 'collapse', 
                border: '1.5px solid #000000',
                '& td, & th': { border: '1px solid #000000 !important', fontSize: '10pt', padding: '4px 6px', color: '#000000' } 
            }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: 'transparent' }}>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>TÊN HÀNG HÓA / VẬT TƯ</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>ĐVT</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>SL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>ĐƠN GIÁ</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>THÀNH TIỀN</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>SERIAL / LÝ DO TRẢ</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index} sx={{ '&:hover': { bgcolor: '#fcfcfc' } }}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell align="center">{item.unit || 'Cái'}</TableCell>
                            <TableCell align="center">{item.quantity.toLocaleString('vi-VN')}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all', maxWidth: 150, fontSize: '9pt' }}>
                                {item.serial_code || '-'}
                                {item.reason && <><br /><i>{item.reason}</i></>}
                            </TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: 'transparent' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Tổng cộng</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>{data.reduce((acc, i) => acc + i.quantity, 0).toLocaleString('vi-VN')}</TableCell>
                        <TableCell colSpan={1}></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '10.5pt' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        </TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Box sx={{ mt: 3, p: 2, border: '1.5px dashed #000000', borderRadius: '4px' }}>
                <Typography sx={{ fontSize: '10pt' }}>
                    <b>Số tiền viết bằng chữ:</b> {readMoney(totalAmount)}
                </Typography>
            </Box>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" mt={6} mb={4}>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Người giao hàng</Typography>
                    <Typography sx={{ fontSize: '9pt', fontStyle: 'italic', color: '#000000', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Thủ kho</Typography>
                    <Typography sx={{ fontSize: '9pt', fontStyle: 'italic', color: '#000000', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{receiverName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Trưởng bộ phận</Typography>
                    <Typography sx={{ fontSize: '9pt', fontStyle: 'italic', color: '#000000', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>TRẦN KIM HÙNG</Typography>
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
                        /* Hard overrides for print sharpness and contrast */
                        * {
                            background-color: transparent !important;
                            background: transparent !important;
                            color: #000000 !important;
                            box-shadow: none !important;
                            text-shadow: none !important;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                        tr, td, th {
                            page-break-inside: avoid;
                            border: 1px solid #000000 !important;
                        }
                        table {
                            border-collapse: collapse !important;
                            border: 1.5px solid #000000 !important;
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
