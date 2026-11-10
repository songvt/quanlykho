import React from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { buildVietQRPayload } from '../utils/vietqr';
import viettelColorLogo from '../assets/viettel-logo-color.png';

export interface BillData {
    id: string; // Unique identifier for mapping
    customerName: string;
    address: string;
    phone: string;
    serviceMonth: string;
    amount: string;
    amountInWords?: string;
    dateString: string;
    collectorName: string;
    collectorPhone: string;
    branchName?: string;
    branchAddress?: string;
    branchContact?: string;
    branchServices?: string;
}

interface BillTemplateA5Props {
    data: BillData;
}

// Hàm chuẩn hóa viết hoa chữ cái đầu cho từ
const toTitleCase = (str: string) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(word => {
            // Giữ nguyên các ký hiệu viết tắt phổ biến
            if (['q.12', 'q12', 'tp.hcm', 'tphcm'].includes(word)) {
                return word.toUpperCase();
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        })
        .join(' ');
};

const BillTemplateA5: React.FC<BillTemplateA5Props> = ({ data }) => {
    // Format hiển thị số tiền có đơn vị đ
    const displayAmount = data.amount?.toLowerCase().includes('đ') 
        ? data.amount 
        : `${data.amount} đ`;

    // Lấy số tiền nguyên bản
    const numericAmount = data.amount ? data.amount.replace(/[^0-9]/g, '') : '0';

    // Nội dung chuyển khoản: GHÉP [THUÊ BAO] + [DỊCH VỤ & THÁNG]
    const transferMessage = `${data.phone || ''} ${data.serviceMonth || ''}`.trim();

    // Cấu hình ngân hàng MBBank
    const bankBin = '970422'; // MBBank
    const bankAccount = '1010165154001';
    const accountName = 'DO THI NGOC MAI';

    // Sinh payload VietQR EMVCo chuẩn (chữ thường không dấu, chạy trực tiếp offline)
    const qrPayload = buildVietQRPayload({
        bankBin,
        bankAccount,
        amount: numericAmount,
        message: transferMessage
    });

    return (
        <Box 
            sx={{
                width: '210mm',
                maxWidth: '210mm',
                height: '148mm',
                maxHeight: '148mm',
                padding: '5mm 14mm 5mm 15mm',
                backgroundColor: '#fff',
                fontFamily: '"Times New Roman", Times, serif',
                color: '#1a1a1a',
                boxSizing: 'border-box',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                pageBreakInside: 'avoid',
                breakInside: 'avoid',
                pageBreakAfter: 'always',
                breakAfter: 'page',
                '& .MuiTypography-root': {
                    fontFamily: '"Times New Roman", Times, serif'
                }
            }}
        >
            {/* 1. HEADER: Logo Viettel màu đỏ + Tiêu đề + Đường line thương hiệu */}
            <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0.8 }}>
                    <Box sx={{ width: '35%', display: 'flex', alignItems: 'center' }}>
                        <img 
                            src={viettelColorLogo} 
                            alt="Viettel Logo" 
                            style={{ width: '165px', height: 'auto', objectFit: 'contain' }} 
                        />
                    </Box>
                    <Box sx={{ width: '65%', textAlign: 'center', pr: 1 }}>
                        <Typography 
                            sx={{ 
                                fontWeight: 800, 
                                textTransform: 'uppercase',
                                fontSize: '23px',
                                letterSpacing: '0.8px',
                                color: '#ee0033', // Đỏ Viettel
                                lineHeight: 1.15
                            }}
                        >
                            THÔNG BÁO CƯỚC DỊCH VỤ
                        </Typography>
                        <Typography 
                            sx={{ 
                                fontWeight: 'bold', 
                                fontSize: '13px',
                                color: '#555',
                                letterSpacing: '0.5px',
                                mt: 0.3
                            }}
                        >
                            TẬP ĐOÀN CÔNG NGHIỆP - VIỄN THÔNG QUÂN ĐỘI
                        </Typography>
                    </Box>
                </Box>
                {/* Dải line đỏ nhận diện Viettel */}
                <Box sx={{ height: '2.5px', bgcolor: '#ee0033', width: '100%', mb: 1, borderRadius: '1px' }} />
            </Box>

            {/* 2. BODY: Grid thông tin + Mã QR thanh toán */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flex: 1 }}>
                {/* Cột trái: Thông tin khách hàng */}
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '5px' }}>
                    {/* Khách hàng */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '135px 1fr', alignItems: 'baseline' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                            Khách Hàng:
                        </Typography>
                        <Typography sx={{ fontSize: '19px', fontWeight: 'bold', color: '#000' }}>
                            {data.customerName ? toTitleCase(data.customerName) : ''}
                        </Typography>
                    </Box>

                    {/* Địa chỉ */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '135px 1fr', alignItems: 'baseline' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                            Địa Chỉ:
                        </Typography>
                        <Typography sx={{ fontSize: '16.5px', color: '#111', lineHeight: 1.25 }}>
                            {data.address ? toTitleCase(data.address) : ''}
                        </Typography>
                    </Box>

                    {/* Thuê bao */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '135px 1fr', alignItems: 'baseline' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                            Thuê Bao:
                        </Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#000', letterSpacing: '0.3px' }}>
                            {data.phone}
                        </Typography>
                    </Box>

                    {/* Dịch vụ / kỳ cước */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '135px 1fr', alignItems: 'baseline' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                            Kỳ Cước:
                        </Typography>
                        <Typography sx={{ fontSize: '16.5px', fontWeight: 600, color: '#1a1a1a' }}>
                            {data.serviceMonth ? toTitleCase(data.serviceMonth) : ''}
                        </Typography>
                    </Box>

                    {/* Số tiền & Bằng chữ - Thuần văn bản trang trọng */}
                    <Box sx={{ 
                        display: 'grid', 
                        gridTemplateColumns: '135px 1fr', 
                        alignItems: 'baseline'
                    }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', color: '#000' }}>
                            Số Tiền:
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontSize: '20px', fontWeight: 'bold', color: '#000' }}>
                                {displayAmount}
                            </Typography>
                            {data.amountInWords && (
                                <Typography sx={{ fontSize: '15px', fontStyle: 'italic', color: '#333' }}>
                                    ({data.amountInWords})
                                </Typography>
                            )}
                        </Box>
                    </Box>
                </Box>

                {/* Cột phải: Khung QR VietQR thanh toán thu nhỏ gọn gàng, không xuống dòng */}
                <Box 
                    sx={{ 
                        width: '122px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        py: 0.6,
                        px: 0.6,
                        bgcolor: '#fff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                >
                    <Typography 
                        sx={{ 
                            fontSize: '9.5px', 
                            fontWeight: 'bold', 
                            color: '#ee0033', 
                            textTransform: 'uppercase', 
                            mb: 0.4, 
                            textAlign: 'center',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        Quét QR Thanh Toán
                    </Typography>
                    
                    <Box sx={{ p: '2px', bgcolor: '#fff', display: 'flex', justifyContent: 'center' }}>
                        <QRCodeSVG 
                            value={qrPayload} 
                            size={92} 
                            level="M" 
                            includeMargin={false} 
                        />
                    </Box>

                    <Typography sx={{ fontSize: '9.5px', fontWeight: 'bold', color: '#003399', textAlign: 'center', mt: 0.3, whiteSpace: 'nowrap' }}>
                        MB: {bankAccount}
                    </Typography>
                    <Typography sx={{ fontSize: '8.5px', color: '#555', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'nowrap' }}>
                        {accountName}
                    </Typography>
                </Box>
            </Box>

            {/* 3. FOOTER: Thông tin hỗ trợ + Ký nhận */}
            <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', pt: 0.8, borderTop: '1px dashed #ccc' }}>
                {/* Box Thông tin chi nhánh bên trái */}
                <Box sx={{ width: '60%', pr: 2 }}>
                    <Box 
                        sx={{ 
                            border: '1px solid #e2e8f0', 
                            bgcolor: '#f8fafc',
                            p: 1.1,
                            borderRadius: '6px',
                            textAlign: 'left'
                        }}
                    >
                        <Typography sx={{ fontWeight: 'bold', fontSize: '14.5px', color: '#ee0033', textTransform: 'uppercase', mb: 0.2 }}>
                            📍 {data.branchName || 'VIETTEL QUẬN 12'}
                        </Typography>
                        <Typography sx={{ fontSize: '13px', color: '#333', mb: 0.2, lineHeight: 1.3 }}>
                            <b>Đ/C:</b> 50 Trương Thị Hoa, P. Tân Thới Hiệp, Q.12
                        </Typography>
                        <Typography sx={{ fontSize: '13px', color: '#333', mb: 0.2 }}>
                            <b>ĐT / Zalo:</b> <span style={{ fontWeight: 600 }}>0979 092 604 – 0987 268 794</span>
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                            Thu cước – Lắp đặt Internet – Sim số đẹp
                        </Typography>
                    </Box>
                </Box>

                {/* Chữ ký nhân viên bên phải */}
                <Box sx={{ width: '40%', textAlign: 'center', pb: 0.3 }}>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '13px', color: '#555', mb: 0.2 }}>
                        {data.dateString || 'TP. HCM, ngày ... tháng ... năm 2026'}
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '14.5px', textTransform: 'uppercase', color: '#111' }}>
                        Nhân viên thu cước
                    </Typography>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '11.5px', color: '#777', mb: 3 }}>
                        (Ký, ghi rõ họ tên)
                    </Typography>
                    
                    {/* Họ tên nhân viên */}
                    <Typography sx={{ fontWeight: 'bold', fontSize: '15.5px', textTransform: 'uppercase', color: '#000', lineHeight: 1.2 }}>
                        {data.collectorName}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default BillTemplateA5;
