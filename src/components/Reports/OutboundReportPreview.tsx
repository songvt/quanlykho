
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { readMoney } from '../../utils/excelUtils';

interface OutboundReportPreviewProps {
    data: any[];
    delivererName: string; // The person giving the goods (Storage Keeper usually)
    date: string;
    receiverName: string; // The person receiving
}

const OutboundReportPreview = ({ data, delivererName, date, receiverName }: OutboundReportPreviewProps) => {
    const totalAmount = data.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
    const dateObj = new Date(date);

    return (
        <Box sx={{ position: 'relative' }}>
            <style>
                {`
                    @media print {
                        body {
                            visibility: hidden;
                        }
                        #outbound-preview-content {
                            visibility: visible !important;
                            position: fixed;
                            left: 0;
                            top: 0;
                            width: 210mm; /* A4 width */
                            height: 297mm; /* A4 height */
                            z-index: 99999;
                            background: white;
                            padding: 10mm 15mm; /* Top/Bottom 10mm, Left/Right 15mm */
                            margin: 0 auto;
                            font-family: 'Times New Roman', Times, serif; /* Formal font */
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        #outbound-preview-content * {
                            visibility: visible !important;
                            font-family: 'Times New Roman', Times, serif !important; /* Force font */
                        }
                        .no-print {
                            display: none !important;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 0;
                        }
                    }
                `}
            </style>

            <div id="outbound-preview-content">
                <Box sx={{
                    bgcolor: 'white',
                    color: 'black',
                    maxWidth: '210mm',
                    mx: 'auto',
                    p: 2
                }}>
                    {/* Header */}
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Box sx={{ width: '45%' }}>
                            <Typography fontWeight="bold" fontSize={11} sx={{ textTransform: 'uppercase', color: '#1976d2' }}>
                                TRUNG TÂM ACT KHU VỰC BẮC SÀI GÒN
                            </Typography>
                            <Typography fontSize={11} fontWeight="bold" sx={{ color: '#1976d2' }}>
                                455A TRẦN THỊ NĂM P.TMT QUẬN 12
                            </Typography>
                            <Typography fontSize={11} mt={0.5} sx={{ color: '#1976d2' }}>
                                Số: ............/BBXK-ACT
                            </Typography>
                        </Box>
                        <Box textAlign="center" sx={{ width: '55%' }}>
                            <Typography fontWeight="bold" fontSize={11} sx={{ textTransform: 'uppercase', color: '#d32f2f' }}>
                                CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                            </Typography>
                            <Typography fontWeight="bold" fontSize={12} sx={{ borderBottom: '1px solid #d32f2f', display: 'inline-block', pb: 0.5, mb: 0.5, color: '#d32f2f' }}>
                                Độc lập - Tự do - Hạnh phúc
                            </Typography>
                            <Typography fontSize={11} fontStyle="italic">
                                ................, ngày {dateObj.getDate()} tháng {dateObj.getMonth() + 1} năm {dateObj.getFullYear()}
                            </Typography>
                        </Box>
                    </Box>

                    <Typography variant="h6" align="center" fontWeight="bold" sx={{ mb: 2, textTransform: 'uppercase', color: '#d32f2f' }}>
                        BIÊN BẢN XUẤT KHO VẬT TƯ HÀNG HÓA
                    </Typography>

                    {/* Parties */}
                    <Box sx={{ mb: 2, fontSize: '13px' }}>
                        <Typography fontWeight="bold" mb={0.5} sx={{ color: '#1976d2' }}>1. BÊN GIAO (BÊN XUẤT HÀNG):</Typography>
                        <Box ml={3}>
                            <Typography gutterBottom sx={{ margin: 0 }}>- Đơn vị: <b style={{ color: '#000' }}>Kho ACT - Khu vực Bắc Sài Gòn</b></Typography>
                            <Typography gutterBottom sx={{ margin: 0 }}>- Người giao: <b style={{ textTransform: 'uppercase', color: '#000' }}>{delivererName}</b></Typography>
                        </Box>

                        <Typography fontWeight="bold" mt={1} mb={0.5} sx={{ color: '#1976d2' }}>2. BÊN NHẬN (NHẬP HÀNG):</Typography>
                        <Box ml={3}>
                            <Typography gutterBottom sx={{ margin: 0 }}>- Đơn vị / Người nhận: <b style={{ textTransform: 'uppercase', color: '#000' }}>{receiverName}</b></Typography>
                        </Box>
                    </Box>

                    <Typography mb={1} fontStyle="italic" fontSize={13}>
                        Hai bên thống nhất tiến hành lập biên bản xuất kho với chi tiết như sau:
                    </Typography>

                    {/* Table */}
                    <Table size="small" sx={{
                        borderCollapse: 'collapse',
                        border: '1px solid #1976d2',
                        tableLayout: 'fixed',
                        width: '100%',
                        '& td, & th': {
                            border: '1px solid #1976d2',
                            padding: '3px 4px',
                            fontSize: '11px',
                            verticalAlign: 'middle',
                            color: '#000'
                        }
                    }}>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#4472C4' }}>
                                <TableCell align="center" width="30" sx={{ color: 'white !important', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" sx={{ color: 'white !important', fontWeight: 'bold' }}>Tên Hàng Hóa / Vật Tư</TableCell>
                                <TableCell align="center" width="40" sx={{ color: 'white !important', fontWeight: 'bold' }}>ĐVT</TableCell>
                                <TableCell align="center" width="35" sx={{ color: 'white !important', fontWeight: 'bold' }}>SL</TableCell>
                                <TableCell align="center" width="70" sx={{ color: 'white !important', fontWeight: 'bold' }}>Đơn Giá</TableCell>
                                <TableCell align="center" width="80" sx={{ color: 'white !important', fontWeight: 'bold' }}>Thành Tiền</TableCell>
                                <TableCell align="center" width="100" sx={{ color: 'white !important', fontWeight: 'bold' }}>Serial</TableCell>
                                <TableCell align="center" width="80" sx={{ color: 'white !important', fontWeight: 'bold' }}>Ghi Chú</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {data.map((item, index) => (
                                <TableRow key={index} sx={{ '&:nth-of-type(odd)': { bgcolor: '#f5f9ff' } }}>
                                    <TableCell align="center">{index + 1}</TableCell>
                                    <TableCell sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {item.product_name}
                                    </TableCell>
                                    <TableCell align="center">{item.unit}</TableCell>
                                    <TableCell align="center">{item.quantity}</TableCell>
                                    <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price)}</TableCell>
                                    <TableCell align="right">{new Intl.NumberFormat('vi-VN').format(item.unit_price * item.quantity)}</TableCell>
                                    <TableCell sx={{ fontSize: '10px', wordBreak: 'break-all', lineHeight: 1.1 }}>{item.serial_code}</TableCell>
                                    <TableCell sx={{ fontSize: '10px' }}>{item.item_status || ''}</TableCell>
                                </TableRow>
                            ))}
                            {/* Total Row */}
                            <TableRow sx={{ bgcolor: '#e8f0fe' }}>
                                <TableCell colSpan={3} align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>TỔNG CỘNG</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 'bold', color: '#1976d2' }}>{data.reduce((acc, i) => acc + i.quantity, 0)}</TableCell>
                                <TableCell sx={{ bgcolor: '#e8f0fe' }}></TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold', color: '#d32f2f' }}>
                                    {new Intl.NumberFormat('vi-VN').format(totalAmount)}
                                </TableCell>
                                <TableCell colSpan={2} sx={{ bgcolor: '#e8f0fe' }}></TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>

                    <Box mt={1} mb={3}>
                        <Typography fontStyle="italic" fontSize={13} sx={{ mt: 1 }}>
                            - Tổng số tiền (bằng chữ): <b>{readMoney(totalAmount)}</b>
                        </Typography>
                        <Typography fontStyle="italic" fontSize={13}>
                            - Hàng hóa đã được kiểm tra, giao nhận đầy đủ đúng chủng loại, số lượng và chất lượng theo danh sách trên.
                        </Typography>
                    </Box>

                    {/* Signatures */}
                    <Box display="flex" justifyContent="space-between" mt={1}>
                        <Box textAlign="center" width="45%">
                            <Typography fontWeight="bold" fontSize={12} sx={{ color: '#1976d2' }}>THỦ KHO (XUẤT)</Typography>
                            <Typography fontStyle="italic" fontSize={11}>(Ký, ghi rõ họ tên)</Typography>
                            <Box height={70} />
                            <Typography fontWeight="bold" fontSize={12} sx={{ textTransform: 'uppercase' }}>{delivererName}</Typography>
                        </Box>
                        <Box textAlign="center" width="45%">
                            <Typography fontWeight="bold" fontSize={12} sx={{ color: '#1976d2' }}>NGƯỜI NHẬN</Typography>
                            <Typography fontStyle="italic" fontSize={11}>(Ký, ghi rõ họ tên)</Typography>
                            <Box height={70} />
                            <Typography fontWeight="bold" fontSize={12} sx={{ textTransform: 'uppercase' }}>{receiverName}</Typography>
                        </Box>
                    </Box>
                </Box>
            </div>
        </Box>
    );
};

export default OutboundReportPreview;
