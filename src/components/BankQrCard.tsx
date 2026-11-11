import React from 'react';
import { Box, Typography } from '@mui/material';
import { QRCodeSVG } from 'qrcode.react';
import { buildVietQRPayload } from '../utils/vietqr';
import type { BillData } from './BillTemplateA5';

interface BankQrCardProps {
    data: BillData;
}

export const BankQrCard: React.FC<BankQrCardProps> = ({ data }) => {
    // Thông tin tài khoản MBBank
    const bankBin = '970422'; // MBBank
    const bankAccount = '1010165154001';
    const accountName = 'DO THI NGOC MAI';
    const bankName = 'Ngân hàng MB Bank';

    // Số tiền và nội dung chuyển khoản
    const numericAmount = data.amount ? data.amount.replace(/[^0-9]/g, '') : '0';
    const transferMessage = `${data.phone || ''} ${data.serviceMonth || ''}`.trim();

    // Sinh chuỗi payload chuẩn EMVCo VietQR NAPAS
    const qrPayload = buildVietQRPayload({
        bankBin,
        bankAccount,
        amount: numericAmount,
        message: transferMessage
    });

    return (
        <Box
            sx={{
                width: '360px',
                height: '226px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #102693 0%, #1738bd 50%, #0d1e7c 100%)',
                p: '16px 18px',
                color: '#fff',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                position: 'relative',
                boxShadow: '0 10px 25px rgba(16, 38, 147, 0.4)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            {/* Hiệu ứng nền nhẹ bo góc */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '-30px',
                    right: '-30px',
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    pointerEvents: 'none'
                }}
            />

            {/* Hàng trên: Logo MBBank + Tên ngân hàng */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, zIndex: 1 }}>
                <Box
                    sx={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        bgcolor: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: '3px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}
                >
                    <Typography
                        sx={{
                            color: '#1428a0',
                            fontWeight: 900,
                            fontSize: '13px',
                            letterSpacing: '-0.5px'
                        }}
                    >
                        ★MB
                    </Typography>
                </Box>
                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: 'rgba(255,255,255,0.92)' }}>
                    {bankName}
                </Typography>
            </Box>

            {/* Hàng giữa & dưới: Thông tin STT/Chủ TK bên trái, Mã QR bên phải */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
                <Box sx={{ pr: 1 }}>
                    <Typography
                        sx={{
                            fontSize: '20px',
                            fontWeight: 800,
                            letterSpacing: '0.5px',
                            color: '#ffffff',
                            lineHeight: 1.2,
                            mb: 0.4
                        }}
                    >
                        {bankAccount}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'rgba(255,255,255,0.75)',
                            letterSpacing: '0.8px',
                            textTransform: 'uppercase'
                        }}
                    >
                        {accountName}
                    </Typography>
                </Box>

                {/* Khung QR Code bo góc trắng tinh tế */}
                <Box
                    sx={{
                        p: '6px',
                        bgcolor: '#fff',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                        position: 'relative'
                    }}
                >
                    <QRCodeSVG
                        value={qrPayload}
                        size={104}
                        level="M"
                        includeMargin={false}
                    />
                    {/* Logo nhỏ giữa QR code */}
                    <Box
                        sx={{
                            position: 'absolute',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            bgcolor: '#ee0033',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '11px',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            border: '1.5px solid #fff'
                        }}
                    >
                        V
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default BankQrCard;
