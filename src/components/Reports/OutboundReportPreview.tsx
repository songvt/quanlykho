import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { readMoney } from '../../utils/excelUtils';
import { createPortal } from 'react-dom';

interface OutboundReportPreviewProps {
    data: any[];
    delivererName: string;
    date: string;
    receiverName: string;
    senderPhone?: string;
    receiverPhone?: string;
    reportNumber?: number;
}

const OutboundReportTemplate = ({ data, delivererName, date, receiverName, senderPhone, receiverPhone, reportNumber = 1 }: OutboundReportPreviewProps) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const dateObj = new Date(date);

    return (
        <Box sx={{ 
            p: 6, 
            bgcolor: 'white', 
            color: '#09090b', 
            minWidth: 800, 
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
                    <Typography sx={{ fontSize: '10pt', fontStyle: 'italic', color: '#ef4444', mt: 2, fontWeight: 600 }}>Số: PX-{String(reportNumber).padStart(6, '0')}</Typography>
                </Box>
            </Box>

            <Box textAlign="center" mb={4}>
                <Typography sx={{ fontWeight: 900, fontSize: '24pt', color: '#09090b', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    PHIẾU XUẤT KHO
                </Typography>
                <Typography sx={{ fontSize: '11pt', color: '#64748b', mt: 1, fontStyle: 'italic' }}>
                    Ngày {dateObj.getDate().toString().padStart(2, '0')} tháng {(dateObj.getMonth() + 1).toString().padStart(2, '0')} năm {dateObj.getFullYear()}
                </Typography>
            </Box>

            {/* Information Grid */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mb: 4 }}>
                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#2563eb', mb: 1.5, textTransform: 'uppercase' }}>Bên giao (Kho)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{delivererName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Quản lý tài sản (Kho)</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {senderPhone || '-'}</Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#ef4444', mb: 1.5, textTransform: 'uppercase' }}>Bên nhận (Kỹ thuật)</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{receiverName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {receiverPhone || '-'}</Typography>
                    </Box>
                </Box>
            </Box>

            {/* Table */}
            <Table size="small" sx={{ 
                borderCollapse: 'collapse', 
                '& td, & th': { border: '1px solid #e2e8f0', fontSize: '10pt', padding: '10px 12px' } 
            }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>STT</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569' }}>TÊN HÀNG HÓA, VẬT TƯ</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>ĐVT</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>SL</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>ĐƠN GIÁ</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>THÀNH TIỀN</TableCell>
                        <TableCell sx={{ fontWeight: 700, color: '#475569' }}>SERIAL / GHI CHÚ</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell align="center">{index + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>{item.product_name}</TableCell>
                            <TableCell align="center">{item.unit || 'Cái'}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700, color: '#2563eb' }}>{item.quantity}</TableCell>
                            <TableCell align="right">
                                {new Intl.NumberFormat('vi-VN').format(item.unit_price)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                {new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 180, fontSize: '9pt', color: '#64748b', wordBreak: 'break-all' }}>{item.serial_code || '-'}</TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: '#f1f5f9' }}>
                        <TableCell colSpan={3} align="right" sx={{ fontWeight: 800, textTransform: 'uppercase' }}>Tổng cộng</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: '#2563eb' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                        <TableCell colSpan={2} align="right" sx={{ fontWeight: 800, fontSize: '11pt' }}>
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

            <Typography sx={{ fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic', mt: 3, textAlign: 'center' }}>
                Ghi chú: Biên bản được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị pháp lý như nhau.
            </Typography>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" mt={6} mb={4}>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Người nhận</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{receiverName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Thủ kho</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{delivererName}</Typography>
                </Box>
                <Box textAlign="center" flex={1}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Trưởng bộ phận</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>Trần Kim Hùng</Typography>
                </Box>
            </Box>
        </Box>
    );
};

const OutboundReportPreview = (props: OutboundReportPreviewProps) => {
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
            <OutboundReportTemplate {...props} />

            {/* Print Version via Portal */}
            {createPortal(
                <div id="print-portal-root">
                    <OutboundReportTemplate {...props} />
                </div>,
                document.body
            )}
        </Box>
    );
};

export default OutboundReportPreview;
