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
            color: '#09090b',
            minWidth: 800,
            p: 6,
            fontFamily: "'Inter', sans-serif",
            '@media print': { p: 0 }
        }}>
            {/* Header section with split layout */}
            <Box display="flex" mb={6} alignItems="flex-start">
                <Box flex={1.2} textAlign="center">
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', color: '#2563eb', textTransform: 'uppercase', lineHeight: 1.2 }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                    <Typography sx={{ fontSize: '10pt', fontWeight: 700, color: '#0f172a', mt: 0.5 }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                    <Box sx={{ mt: 1, height: '2px', width: '60px', bgcolor: '#e2e8f0', mx: 'auto' }} />
                </Box>
                <Box flex={1} textAlign="center">
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', textTransform: 'uppercase', lineHeight: 1.2 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '10pt', textDecoration: 'underline', lineHeight: 1.2 }}>Độc lập - Tự do - Hạnh phúc</Typography>
                    <Typography sx={{ fontSize: '10pt', fontStyle: 'italic', color: '#64748b', mt: 2 }}>
                        TP. Hồ Chí Minh, ngày {dateObj.getDate().toString().padStart(2, '0')} tháng {(dateObj.getMonth() + 1).toString().padStart(2, '0')} năm {dateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            <Box textAlign="center" mb={4}>
                <Typography sx={{ fontWeight: 900, fontSize: '24pt', color: '#09090b', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    BIÊN BẢN NHẬP KHO
                </Typography>
                <Typography sx={{ fontSize: '11pt', color: '#64748b', mt: 1, fontWeight: 500 }}>
                    (VẬT TƯ HÀNG HÓA HOÀN TRẢ)
                </Typography>
            </Box>

            {/* Information Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mb: 4 }}>
                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#2563eb', mb: 1.5, textTransform: 'uppercase' }}>Bên giao (Hoàn trả)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b style={{ textTransform: 'uppercase' }}>{employeeName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Lý do: Hoàn trả vật tư thừa/hỏng sau triển khai</Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#ef4444', mb: 1.5, textTransform: 'uppercase' }}>Bên nhận (Nhập kho)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Đơn vị: <b>Kho ACT Bắc Sài Gòn</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Người nhận: <b style={{ textTransform: 'uppercase' }}>{receiverName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Chức vụ: Thủ kho / Quản lý kho</Typography>
                    </Box>
                </Box>
            </Box>

            <Typography mb={2} sx={{ fontSize: '10pt', color: '#64748b', fontStyle: 'italic' }}>
                Hai bên thống nhất tiến hành lập biên bản nhập kho với chi tiết hàng hóa như sau:
            </Typography>

            {/* Table */}
            <Table size="small" sx={{ 
                borderCollapse: 'collapse', 
                '& td, & th': { border: '1px solid #e2e8f0', fontSize: '10pt', padding: '10px 12px' } 
            }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569' }}>TÊN HÀNG HÓA / VẬT TƯ</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>ĐVT</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>SL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>ĐƠN GIÁ</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>THÀNH TIỀN</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569' }}>SERIAL / LÝ DO TRẢ</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                            <TableCell align="center">{item.unit || 'Cái'}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, color: '#ef4444' }}>{item.quantity}</TableCell>
                            <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>{new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}</TableCell>
                            <TableCell sx={{ wordBreak: 'break-all', maxWidth: 150, fontSize: '9pt', color: '#64748b' }}>
                                <b>{item.serial_code || '-'}</b>
                                <br />
                                <i>{item.reason || ''}</i>
                            </TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Tổng cộng</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#ef4444' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                        <TableCell colSpan={1}></TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '11pt' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        </TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Box sx={{ mt: 3, p: 2, border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '10pt', fontStyle: 'italic' }}>
                    <b>Số tiền viết bằng chữ:</b> {readMoney(totalAmount)}
                </Typography>
            </Box>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" mt={6} mb={4}>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Người giao hàng</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Thủ kho</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{receiverName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Trưởng bộ phận</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
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
