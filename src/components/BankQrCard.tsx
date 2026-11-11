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
                width: '420px',
                height: '264px',
                borderRadius: '24px',
                background: 'linear-gradient(135deg, #0d38c7 0%, #0044d6 50%, #062ca6 100%)',
                p: '22px 24px',
                color: '#fff',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxSizing: 'border-box',
                overflow: 'hidden'
            }}
        >
            {/* Hiệu ứng mảng sáng cong ở góc trên bên phải chuẩn nhận diện MB Bank */}
            <Box
                sx={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-40px',
                    width: '240px',
                    height: '240px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 70%)',
                    pointerEvents: 'none'
                }}
            />

            {/* HÀNG TRÊN: Logo MB Bank + Tên ngân hàng */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, zIndex: 1 }}>
                {/* Khung icon logo MB Bank màu trắng bo tròn mềm mại */}
                <Box
                    sx={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        bgcolor: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        p: '4px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                    }}
                >
                    <Typography
                        sx={{
                            color: '#0033a0',
                            fontWeight: 900,
                            fontSize: '15.5px',
                            letterSpacing: '-0.5px',
                            display: 'flex',
                            alignItems: 'center',
                            fontFamily: 'sans-serif'
                        }}
                    >
                        ★MB
                    </Typography>
                </Box>
                <Typography
                    sx={{
                        fontSize: '19px',
                        fontWeight: 700,
                        color: '#ffffff',
                        letterSpacing: '0.2px',
                        textShadow: '0 1px 2px rgba(0,0,0,0.15)'
                    }}
                >
                    {bankName}
                </Typography>
            </Box>

            {/* HÀNG DƯỚI: STK + Tên người nhận (trái) và Mã QR (phải) */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', zIndex: 1 }}>
                {/* Thông tin tài khoản */}
                <Box sx={{ pr: 1, pb: 0.5 }}>
                    <Typography
                        sx={{
                            fontSize: '25px',
                            fontWeight: 900,
                            letterSpacing: '0.8px',
                            color: '#ffffff',
                            lineHeight: 1.15,
                            mb: 0.6,
                            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        {bankAccount}
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: 'rgba(255, 255, 255, 0.88)',
                            letterSpacing: '1px',
                            textTransform: 'uppercase'
                        }}
                    >
                        {accountName}
                    </Typography>
                </Box>

                {/* Khung QR Code bo góc chuẩn nét cao */}
                <Box
                    sx={{
                        p: '8px',
                        bgcolor: '#ffffff',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                        position: 'relative'
                    }}
                >
                    <QRCodeSVG
                        value={qrPayload}
                        size={128}
                        level="M"
                        includeMargin={false}
                    />
                    {/* Logo trung tâm màu đỏ chuẩn nhận diện */}
                    <Box
                        sx={{
                            position: 'absolute',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            bgcolor: '#ee0033',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900,
                            fontSize: '14px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                            border: '2px solid #ffffff'
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
