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
                width: '100%',
                maxWidth: '209mm',
                height: '145mm', // Sát mức 148.5mm nhưng vẫn an toàn
                padding: '4mm 10mm', // Ép nhỏ lề để có thêm không gian chiều dọc
                backgroundColor: '#fff',
                fontFamily: '"Times New Roman", Times, serif',
                color: '#000',
                boxSizing: 'border-box',
                position: 'relative',
                pageBreakInside: 'avoid',
                pageBreakAfter: 'always', // Bắt buộc sang trang mới sau mỗi phiếu để an toàn tuyệt đối
                '& .MuiTypography-root': {
                    fontFamily: '"Times New Roman", Times, serif'
                }
            }}
        >
            <Box sx={{ display: 'flex', mb: 1, alignItems: 'center', width: '100%' }}>
                <Box sx={{ width: '35%', display: 'flex', alignItems: 'center' }}>
                    <img 
                        src={window.location.origin + "/viettel-logo.png"} 
                        alt="Viettel Logo" 
                        style={{ width: '180px', height: 'auto', objectFit: 'contain' }} 
                    />
                </Box>
                <Box sx={{ width: '65%', textAlign: 'center' }}>
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
                </Box>
            </Box>

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
            <Box sx={{ display: 'flex', mt: 1, width: '100%', alignItems: 'flex-start' }}>
                <Box sx={{ width: '64%' }}>
                    <Box 
                        sx={{ 
                            border: '1px solid #000', 
                            p: 1,
                            mt: 0.5,
                            textAlign: 'center',
                            width: '95%'
                        }}
                    >
                        <Typography sx={{ fontWeight: 'bold', fontSize: '16px', fontFamily: '"Times New Roman", Times, serif', whiteSpace: 'nowrap' }}>
                            {data.branchName || 'VIETTEL QUẬN 12'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5, whiteSpace: 'nowrap' }}>
                            {data.branchAddress || '50 TRƯƠNG THỊ HOA PHƯỜNG TÂN THỚI HIỆP Q12'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5, whiteSpace: 'nowrap' }}>
                            {data.branchContact || 'ĐT- ZALO 0979 092 604 – 0987 268 794'}
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '15px', fontFamily: '"Times New Roman", Times, serif', mt: 0.5, whiteSpace: 'nowrap' }}>
                            {data.branchServices || 'THU CƯỚC –LẮP ĐẶT INTERNET – SIM SỐ ĐẸP'}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ width: '36%', textAlign: 'center', pl: 1 }}>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '17px', mb: 0.5, mt: -1 }}>
                        {data.dateString}
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '17px', mb: 0.5 }}>
                        Nhân viên thu cước
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '17px', mb: 2 }}>
                        {data.collectorPhone}
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '18px', textTransform: 'uppercase' }}>
                        {data.collectorName}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default BillTemplateA5;
