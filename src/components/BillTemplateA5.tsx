// @ts-nocheck
import React from 'react';
import { Box, Typography, Grid } from '@mui/material';

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

const BillTemplateA5: React.FC<BillTemplateA5Props> = ({ data }) => {
    return (
        <Box 
            sx={{
                width: '100%', // Dùng 100% để tự động fit vào khổ giấy A5
                maxWidth: '209mm', // Giới hạn chiều ngang an toàn
                height: '146mm', // Tăng chiều cao sát mức A5 (148.5mm) để thoải mái nhất
                padding: '8mm 15mm', // Giảm lề trên/dưới để nới thêm không gian
                backgroundColor: '#fff',
                fontFamily: '"Times New Roman", Times, serif', // matches the image style
                color: '#000',
                boxSizing: 'border-box',
                position: 'relative',
                pageBreakInside: 'avoid',
                '& .MuiTypography-root': {
                    fontFamily: '"Times New Roman", Times, serif'
                }
            }}
        >
            <Grid container spacing={2} sx={{ mb: 2, alignItems: 'center' }}>
                <Grid xs={4} sx={{ display: 'flex', alignItems: 'center' }}>
                    <img 
                        src={window.location.origin + "/viettel-logo.png"} 
                        alt="Viettel Logo" 
                        style={{ width: '180px', height: 'auto', objectFit: 'contain' }} 
                    />
                </Grid>
                <Grid xs={8} sx={{ textAlign: 'center' }}>
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            fontWeight: 'bold', 
                            textTransform: 'uppercase',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '28px',
                            lineHeight: 1.2
                        }}
                    >
                        THÔNG BÁO
                    </Typography>
                    <Typography 
                        variant="h5" 
                        sx={{ 
                            fontWeight: 'bold', 
                            textTransform: 'uppercase',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '28px',
                            lineHeight: 1.2
                        }}
                    >
                        CƯỚC DỊCH VỤ VIETTEL
                    </Typography>
                </Grid>
            </Grid>

            {/* Customer Info */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: '4px', ml: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', width: '130px', fontSize: '17px' }}>KHÁCH HÀNG:</Typography>
                    <Typography sx={{ fontSize: '22px' }}>{data.customerName}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', width: '130px', fontSize: '17px' }}>ĐỊA CHỈ:</Typography>
                    <Typography sx={{ fontSize: '20px' }}>{data.address}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', width: '130px', fontSize: '17px' }}>THUÊ BAO:</Typography>
                    <Typography sx={{ fontSize: '20px' }}>{data.phone}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', mr: 1, fontSize: '17px' }}>THANH TOÁN CƯỚC</Typography>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', mr: 2, fontSize: '17px' }}>{data.serviceMonth}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                    <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', width: '130px', fontSize: '17px' }}>SỐ TIỀN:</Typography>
                    <Typography sx={{ fontSize: '20px', fontWeight: 'bold' }}>{data.amount}</Typography>
                </Box>
                {data.amountInWords && (
                    <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                        <Typography sx={{ fontWeight: 'bold', textTransform: 'uppercase', width: '130px', fontSize: '17px' }}>BẰNG CHỮ:</Typography>
                        <Typography sx={{ fontSize: '18px', fontStyle: 'italic', fontWeight: 'bold' }}>{data.amountInWords}</Typography>
                    </Box>
                )}
            </Box>

            {/* Footer Information */}
            <Grid container spacing={0} sx={{ mt: 2 }}>
                <Grid xs={7}>
                    <Box 
                        sx={{ 
                            border: '1px solid #000', 
                            p: 1.5,
                            mt: 1,
                            textAlign: 'center',
                            width: '95%'
                        }}
                    >
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', fontFamily: '"Times New Roman", Times, serif' }}>
                            {data.branchName || 'VIETTEL QUẬN 12'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5 }}>
                            {data.branchAddress || '50 TRƯƠNG THỊ HOA PHƯỜNG TÂN THỚI HIỆP Q12'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5 }}>
                            {data.branchContact || 'ĐT- ZALO 0979 092 604 – 0987 268 794'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '17px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5 }}>
                            {data.branchServices || 'THU CƯỚC –LẮP ĐẶT INTERNET – SIM SỐ ĐẸP'}
                        </Typography>
                    </Box>
                </Grid>
                <Grid item xs={5} sx={{ textAlign: 'center', pl: 6 }}>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '17px', mb: 1, mt: -1 }}>
                        {data.dateString}
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '17px', mb: 1 }}>
                        Nhân viên thu cước
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '17px', mb: 3 }}>
                        {data.collectorPhone}
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>
                        {data.collectorName}
                    </Typography>
                </Grid>
            </Grid>
        </Box>
    );
};

export default BillTemplateA5;
