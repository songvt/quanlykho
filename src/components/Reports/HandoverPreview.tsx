import React from 'react';
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
        <Box sx={{ 
            p: 6, 
            bgcolor: 'white', 
            color: '#09090b', 
            minWidth: 800, 
            fontFamily: "'Inter', sans-serif",
            '@media print': { p: 0 } 
        }}>
            {/* Header Section */}
            <Box display="flex" justifyContent="space-between" mb={6} alignItems="flex-start">
                <Box sx={{ width: '40%' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', color: '#2563eb', lineHeight: 1.2, textTransform: 'uppercase' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '10pt', color: '#0f172a', lineHeight: 1.2, textTransform: 'uppercase', mt: 0.5 }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mt: 1, fontStyle: 'italic' }}>455A Trần Thị Năm, P.Tân Chánh Hiệp, Q.12, TP.HCM</Typography>
                </Box>

                <Box textAlign="center" sx={{ flexGrow: 1, px: 2 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '22pt', color: '#09090b', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                        BIÊN BẢN BÀN GIAO
                    </Typography>
                    <Typography sx={{ fontSize: '11pt', color: '#64748b', mt: 1, fontWeight: 500 }}>
                        Ngày {String(dateObj.getDate()).padStart(2, '0')} tháng {String(dateObj.getMonth() + 1).padStart(2, '0')} năm {dateObj.getFullYear()}
                    </Typography>
                    <Box sx={{ mt: 2, display: 'inline-block', px: 2, py: 0.5, bgcolor: '#f1f5f9', borderRadius: '6px' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '10pt', color: '#2563eb' }}>
                            Số: BB-ACT-BSG-{String(reportNumber).padStart(6, '0')}
                        </Typography>
                    </Box>
                </Box>

                <Box textAlign="right" sx={{ width: '25%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Box sx={{ p: 1, border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <QrCode2Icon sx={{ fontSize: 70, color: '#09090b' }} />
                    </Box>
                    <Typography sx={{ fontSize: '8pt', color: '#94a3b8', mt: 1 }}>Mẫu số: 01-VT / QĐ 1141-TC</Typography>
                </Box>
            </Box>

            {/* Parties Info */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mb: 4 }}>
                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#2563eb', mb: 1.5, textTransform: 'uppercase' }}>Bên giao hàng</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{reporterName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kho Trung Tâm</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {senderPhone || '-'}</Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2, border: '1px solid #f1f5f9', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#ef4444', mb: 1.5, textTransform: 'uppercase' }}>Bên nhận hàng</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{employeeName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {receiverPhone || '-'}</Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '10pt', color: '#64748b' }}>
                    <b>Lý do xuất:</b> Xuất hàng hóa, vật tư phục vụ triển khai và xử lý sự cố.
                </Typography>
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
                        <TableCell sx={{ fontWeight: 700, color: '#475569' }}>GHI CHÚ / SERIAL</TableCell>
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
                            <TableCell sx={{ maxWidth: 180, fontSize: '9pt', color: '#64748b' }}>{item.serial_code || '-'}</TableCell>
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

            <Typography sx={{ fontSize: '9pt', color: '#94a3b8', fontStyle: 'italic', mt: 2, textAlign: 'center' }}>
                Ghi chú: Người nhận vui lòng kiểm tra kỹ số lượng và tình trạng hàng hóa trước khi ký nhận.
            </Typography>

            {/* Signatures */}
            <Box display="flex" justifyContent="space-between" mt={6} mb={4}>
                <Box textAlign="center" sx={{ width: '30%' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Người nhận hàng</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{employeeName}</Typography>
                </Box>
                <Box textAlign="center" sx={{ width: '30%' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Thủ kho</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>{reporterName}</Typography>
                </Box>
                <Box textAlign="center" sx={{ width: '30%' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt' }}>Trưởng bộ phận</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#94a3b8', mb: 10 }}>(Ký và ghi rõ họ tên)</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '11pt', textTransform: 'uppercase' }}>TRẦN KIM HÙNG</Typography>
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

