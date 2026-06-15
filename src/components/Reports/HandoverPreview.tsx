import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { readMoney } from '../../utils/excelUtils';
import { createPortal } from 'react-dom';
import { formatPhone } from '../../utils/format';

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
            fontFamily: "'Times New Roman', Times, serif",
            '@media print': { p: 0 } 
        }}>
            {/* Header Section */}
            <Box display="flex" justifyContent="space-between" mb={6} alignItems="flex-start">
                <Box sx={{ width: '45%', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '11pt', color: '#2563eb', lineHeight: 1.2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '10pt', color: '#0f172a', lineHeight: 1.2, textTransform: 'uppercase', mt: 0.5, whiteSpace: 'nowrap' }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                    <Typography sx={{ fontSize: '9pt', color: '#475569', mt: 1, fontStyle: 'italic', whiteSpace: 'nowrap' }}>455A Trần Thị Năm, P.Tân Chánh Hiệp, Q.12, TP.HCM</Typography>
                </Box>

                <Box textAlign="center" sx={{ flexGrow: 1, px: 2 }}>
                    <Typography sx={{ fontWeight: 900, fontSize: '22pt', color: '#09090b', textTransform: 'uppercase', letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>
                        BIÊN BẢN BÀN GIAO
                    </Typography>
                    <Typography sx={{ fontSize: '11pt', color: '#64748b', mt: 1, fontWeight: 500 }}>
                        Ngày {String(dateObj.getDate()).padStart(2, '0')} tháng {String(dateObj.getMonth() + 1).padStart(2, '0')} năm {dateObj.getFullYear()}
                    </Typography>
                    <div style={{ marginTop: '8px', display: 'inline-block', padding: '4px 16px', backgroundColor: '#f1f5f9', borderRadius: '6px', border: '1.5px solid #cbd5e1' }}>
                        <span style={{ fontWeight: 800, fontSize: '10.5pt', color: '#2563eb' }}>
                            Số: BB-ACT-BSG-{String(reportNumber).padStart(6, '0')}
                        </span>
                    </div>
                </Box>

                <Box textAlign="right" sx={{ width: '20%', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Box sx={{ p: 1, border: '1.5px solid #000000', borderRadius: '8px', bgcolor: 'white' }}>
                        <QrCode2Icon sx={{ fontSize: 60, color: '#09090b' }} />
                    </Box>
                    <Typography sx={{ fontSize: '8pt', color: '#475569', mt: 1, fontWeight: 500 }}>Mẫu số: 01-VT / QĐ 1141-TC</Typography>
                </Box>
            </Box>

            {/* Parties Info */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, mb: 4 }}>
                <Box sx={{ p: 2, border: '1.5px solid #000000', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#2563eb', mb: 1.5, textTransform: 'uppercase' }}>Bên giao hàng</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{reporterName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kho Trung Tâm</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {formatPhone(senderPhone) || '-'}</Typography>
                    </Box>
                </Box>

                <Box sx={{ p: 2, border: '1.5px solid #000000', borderRadius: '12px', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '10pt', color: '#ef4444', mb: 1.5, textTransform: 'uppercase' }}>Bên nhận hàng</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <Typography sx={{ fontSize: '10pt' }}>Họ tên: <b>{employeeName}</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Bộ phận: <b>Kỹ thuật CĐBR</b></Typography>
                        <Typography sx={{ fontSize: '10pt' }}>Điện thoại: {formatPhone(receiverPhone) || '-'}</Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '10pt', color: '#09090b' }}>
                    <b>Lý do xuất:</b> Xuất hàng hóa, vật tư phục vụ triển khai và xử lý sự cố.
                </Typography>
            </Box>

            {/* Table */}
            <Table size="small" sx={{ 
                borderCollapse: 'collapse', 
                border: '1px solid #cbd5e1',
                width: '100%',
                '& td, & th': { border: '1px solid #cbd5e1 !important', fontSize: '10pt', padding: '10px 12px', color: '#000000' } 
            }}>
                <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell align="center" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>STT</TableCell>
                        <TableCell style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>TÊN HÀNG HÓA, VẬT TƯ</TableCell>
                        <TableCell align="center" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>ĐVT</TableCell>
                        <TableCell align="center" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>SL</TableCell>
                        <TableCell align="right" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>ĐƠN GIÁ</TableCell>
                        <TableCell align="right" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>THÀNH TIỀN</TableCell>
                        <TableCell style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>GHI CHÚ / SERIAL</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={index}>
                            <TableCell align="center" style={{ border: '1px solid #cbd5e1', color: '#000000' }}>{index + 1}</TableCell>
                            <TableCell sx={{ fontWeight: 700 }} style={{ border: '1px solid #cbd5e1', color: '#000000' }}>{item.product_name}</TableCell>
                            <TableCell align="center" style={{ border: '1px solid #cbd5e1', color: '#000000' }}>{item.unit || 'Cái'}</TableCell>
                            <TableCell align="center" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>{item.quantity.toLocaleString('vi-VN')}</TableCell>
                            <TableCell align="right" style={{ border: '1px solid #cbd5e1', color: '#000000' }}>
                                {new Intl.NumberFormat('vi-VN').format(item.unit_price)}
                            </TableCell>
                            <TableCell align="right" style={{ fontWeight: 800, border: '1px solid #cbd5e1', color: '#000000' }}>
                                {new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}
                            </TableCell>
                            <TableCell style={{ border: '1px solid #cbd5e1', color: '#000000', maxWidth: 180, fontSize: '9pt', wordBreak: 'break-all' }}>{item.serial_code || '-'}</TableCell>
                        </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell colSpan={3} align="right" style={{ fontWeight: 800, textTransform: 'uppercase', border: '1px solid #cbd5e1', color: '#000000' }}>Tổng cộng</TableCell>
                        <TableCell align="center" style={{ fontWeight: 850, border: '1px solid #cbd5e1', color: '#000000' }}>{data.reduce((acc, i) => acc + i.quantity, 0).toLocaleString('vi-VN')}</TableCell>
                        <TableCell colSpan={2} align="right" style={{ fontWeight: 850, fontSize: '11pt', border: '1px solid #cbd5e1', color: '#000000' }}>
                            {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                        </TableCell>
                        <TableCell style={{ border: '1px solid #cbd5e1', color: '#000000' }}></TableCell>
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

