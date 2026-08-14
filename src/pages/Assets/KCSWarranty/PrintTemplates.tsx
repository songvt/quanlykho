import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Divider } from '@mui/material';
import dayjs from 'dayjs';

interface PrintTemplatesProps {
    data: any;
}

export const PrintTemplates: React.FC<PrintTemplatesProps> = ({ data }) => {
    if (!data) return null;

    const { form_type, form_code, created_at, department, reason, equipment_list, kcs_conclusion, handover_representative, receiver_representative, requester_name } = data;
    const request_date = created_at;

    const renderHeader = (title: string, formCode?: string) => (
        <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 4 }}>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>KHỐI DỊCH VỤ KỸ THUẬT</Typography>
                    <Typography fontWeight="bold" sx={{ textDecoration: 'underline', whiteSpace: 'nowrap' }}>TRUNG TÂM BẮC SÀI GÒN</Typography>
                </Box>
                <Box sx={{ textAlign: 'center' }}>
                    <Typography fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                    <Typography fontWeight="bold" sx={{ textDecoration: 'underline', whiteSpace: 'nowrap' }}>Độc lập - Tự do - Hạnh phúc</Typography>
                </Box>
            </Box>
            <Typography variant="h5" fontWeight="bold" sx={{ mb: 2, textAlign: 'center' }}>{title}</Typography>
            {formCode && <Typography>Số biên bản: {formCode}</Typography>}
        </Box>
    );

    const renderFooter = (signatures: { role: string, name?: string }[]) => (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 6 }}>
            {signatures.map((sig, idx) => (
                <Box key={idx} sx={{ textAlign: 'center' }}>
                    <Typography fontWeight="bold">{sig.role}</Typography>
                    <Typography sx={{ fontStyle: 'italic', mb: 8 }}>(Ký ghi rõ họ tên)</Typography>
                    {sig.name && <Typography fontWeight="bold">{sig.name}</Typography>}
                </Box>
            ))}
        </Box>
    );

    const renderEquipmentTable = (columns: any[], rows: any[]) => (
        <Table size="small" sx={{ mb: 4, '& th, & td': { border: '1px solid black !important', color: 'black !important', bgcolor: 'white !important' } }}>
            <TableHead>
                <TableRow>
                    <TableCell align="center" sx={{ width: '5%' }}><b>STT</b></TableCell>
                    {columns.map((col, idx) => (
                        <TableCell key={idx} align="center" sx={{ width: col.width || 'auto' }}><b>{col.label}</b></TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {rows.map((row, idx) => (
                    <TableRow key={idx}>
                        <TableCell align="center">{idx + 1}</TableCell>
                        {columns.map((col, cIdx) => (
                            <TableCell key={cIdx} align={col.align || 'left'}>{row[col.field]}</TableCell>
                        ))}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );

    if (form_type === 'YEU_CAU_KCS') {
        return (
            <Box className="print-page" sx={{ p: 0, bgcolor: 'white', color: 'black', fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', lineHeight: 1.5 }}>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>KHỐI DỊCH VỤ KỸ THUẬT</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', textDecoration: 'underline' }}>TRUNG TÂM BẮC SÀI GÒN</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', textDecoration: 'underline' }}>Độc lập - Tự do - Hạnh phúc</Typography>
                    </Box>
                </Box>
                
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1, textAlign: 'center', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt' }}>
                    PHIẾU YÊU CẦU KIỂM TRA CHẤT LƯỢNG (KCS)
                </Typography>
                
                <Divider sx={{ borderColor: 'black', mb: 2, borderWidth: '1px' }} />

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>I. Thông tin chung</Typography>
                    <ul style={{ margin: 0, paddingLeft: '30px' }}>
                        <li><b>Mã phiếu:</b> {form_code}</li>
                        <li><b>Ngày yêu cầu:</b> {dayjs(created_at).format('DD/MM/YYYY')}</li>
                        <li><b>Bộ phận yêu cầu:</b> {department}</li>
                        <li><b>Người yêu cầu:</b> {requester_name}</li>
                        <li><b>Lý do yêu cầu:</b> {reason}</li>
                    </ul>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 1 }}>II. Thông tin thiết bị cần kiểm tra</Typography>
                    <Table size="small" sx={{ 
                        borderCollapse: 'collapse', 
                        '& th, & td': { 
                            border: '1px solid black !important', 
                            color: 'black !important', 
                            bgcolor: 'white !important',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '12pt',
                            padding: '4px 8px'
                        } 
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell align="center" sx={{ width: '5%', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" sx={{ width: '35%', fontWeight: 'bold' }}>Tên thiết bị</TableCell>
                                <TableCell align="center" sx={{ width: '15%', fontWeight: 'bold' }}>Model</TableCell>
                                <TableCell align="center" sx={{ width: '20%', fontWeight: 'bold' }}>Serial</TableCell>
                                <TableCell align="center" sx={{ width: '10%', fontWeight: 'bold' }}>Số<br/>lượng</TableCell>
                                <TableCell align="center" sx={{ width: '15%', fontWeight: 'bold' }}>Ghi chú</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {equipment_list.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell align="center">{idx + 1}</TableCell>
                                    <TableCell>{row.product_name}</TableCell>
                                    <TableCell>{row.model}</TableCell>
                                    <TableCell>{row.serial}</TableCell>
                                    <TableCell align="center">{row.quantity < 10 ? `0${row.quantity}` : row.quantity}</TableCell>
                                    <TableCell>{row.issue_notes}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>III. Nội dung yêu cầu kiểm tra</Typography>
                    <ul style={{ margin: 0, paddingLeft: '30px' }}>
                        <li>Kiểm tra hình thức bên ngoài.</li>
                        <li>Kiểm tra hoạt động chức năng chính.</li>
                        <li>Đề xuất hướng xử lý nếu có vấn đề.</li>
                    </ul>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Ghi chú thêm:</Typography>
                    <Typography sx={{ borderBottom: '1px dotted black', mt: 2, height: '1.5em' }}></Typography>
                    <Typography sx={{ borderBottom: '1px dotted black', mt: 2, height: '1.5em' }}></Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, px: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Người yêu cầu</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Trưởng bộ phận yêu cầu</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Bộ phận KCS</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (form_type === 'KIEM_TRA_KCS') {
        return (
            <Box className="print-page" sx={{ p: 0, bgcolor: 'white', color: 'black', fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', lineHeight: 1.5 }}>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', textDecoration: 'underline' }}>KHỐI DỊCH VỤ KỸ THUẬT</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', textDecoration: 'underline' }}>Độc lập - Tự do - Hạnh phúc</Typography>
                    </Box>
                </Box>
                
                <Box sx={{ textAlign: 'center', mb: 3, mt: 1 }}>
                    <Typography variant="h6" component="span" fontWeight="bold" sx={{ borderBottom: '1px solid black', pb: '2px', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt' }}>
                        BIÊN BẢN KIỂM TRA ĐÁNH GIÁ CHẤT LƯỢNG
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 1 }}>I. Thông tin chung</Typography>
                    <Table size="small" sx={{ 
                        borderCollapse: 'collapse', 
                        mb: 2,
                        '& td': { 
                            border: '1px solid black !important', 
                            color: 'black !important', 
                            bgcolor: 'white !important',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '12pt',
                            padding: '4px 8px'
                        } 
                    }}>
                        <TableBody>
                            <TableRow>
                                <TableCell><b>Số biên bản:</b> {form_code}</TableCell>
                                <TableCell>BB-KCS{form_code?.match(/\d+$/)?.[0] || ''}</TableCell>
                            </TableRow>
                            <TableRow><TableCell colSpan={2}><b>Ngày kiểm tra:</b> {dayjs(request_date).format('DD/MM/YYYY')}</TableCell></TableRow>
                            <TableRow><TableCell colSpan={2}><b>Địa điểm:</b> TT Bắc Sài Gòn</TableCell></TableRow>
                            <TableRow><TableCell colSpan={2}><b>Người kiểm tra (Ban KCS):</b> ..............................................................</TableCell></TableRow>
                            <TableRow><TableCell colSpan={2}><b>Đại diện bộ phận sử dụng:</b> ..............................................................</TableCell></TableRow>
                        </TableBody>
                    </Table>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 1 }}>II. Thông tin thiết bị</Typography>
                    <Table size="small" sx={{ 
                        borderCollapse: 'collapse', 
                        mb: 2,
                        '& th, & td': { 
                            border: '1px solid black !important', 
                            color: 'black !important', 
                            bgcolor: 'white !important',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '12pt',
                            padding: '4px 8px'
                        } 
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell align="center" sx={{ width: '5%', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" sx={{ width: '35%', fontWeight: 'bold' }}>Tên thiết bị</TableCell>
                                <TableCell align="center" sx={{ width: '15%', fontWeight: 'bold' }}>Mã thiết bị</TableCell>
                                <TableCell align="center" sx={{ width: '20%', fontWeight: 'bold' }}>Model/Serial</TableCell>
                                <TableCell align="center" sx={{ width: '15%', fontWeight: 'bold' }}>Nhà cung cấp</TableCell>
                                <TableCell align="center" sx={{ width: '10%', fontWeight: 'bold' }}>Số lượng</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {equipment_list.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell align="center">{idx + 1}</TableCell>
                                    <TableCell>{row.product_name}</TableCell>
                                    <TableCell>{row.item_code}</TableCell>
                                    <TableCell>{row.serial}</TableCell>
                                    <TableCell>{row.supplier}</TableCell>
                                    <TableCell align="center">{row.quantity < 10 ? `0${row.quantity}` : row.quantity}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 1 }}>III. Nội dung kiểm tra</Typography>
                    <Table size="small" sx={{ 
                        borderCollapse: 'collapse', 
                        mb: 2,
                        '& th, & td': { 
                            border: '1px solid black !important', 
                            color: 'black !important', 
                            bgcolor: 'white !important',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '12pt',
                            padding: '4px 8px'
                        } 
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell align="center" sx={{ width: '5%', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" sx={{ width: '45%', fontWeight: 'bold' }}>Hạng mục kiểm tra</TableCell>
                                <TableCell align="center" sx={{ width: '25%', fontWeight: 'bold' }}>Đạt / Không đạt</TableCell>
                                <TableCell align="center" sx={{ width: '25%', fontWeight: 'bold' }}>Ghi chú</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {equipment_list.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell align="center">{idx + 1}</TableCell>
                                    <TableCell>{row.product_name}</TableCell>
                                    <TableCell align="center">{row.status}</TableCell>
                                    <TableCell>{row.issue_notes}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 1 }}>IV. Kết luận</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>[ {kcs_conclusion === 'DAT' ? 'x' : '  '} ] Thiết bị đạt yêu cầu và được đưa vào sử dụng</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>[ {kcs_conclusion === 'KHONG_DAT' ? 'x' : '  '} ] Thiết bị không đạt yêu cầu, đề xuất: trả kho</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>[ {kcs_conclusion === 'TRA_NCC' ? 'x' : '  '} ] Trả lại nhà cung cấp</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>[ {kcs_conclusion === 'BAO_HANH' ? 'x' : '  '} ] Sửa chữa/bảo hành</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>[ {kcs_conclusion === 'THANH_LY' ? 'x' : '  '} ] Thanh lý/loại bỏ</Typography>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, px: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Người kiểm tra (KCS)</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Ban KCS</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Đại diện bộ phận sử dụng</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Ký tên – Họ tên</Typography>
                    </Box>
                </Box>
            </Box>
        );
    }

    if (form_type === 'BAN_GIAO_BH') {
        return (
            <Box className="print-page" sx={{ p: 0, bgcolor: 'white', color: 'black', fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', lineHeight: 1.5 }}>
                <Box sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>TRUNG TÂM ACT BẮC SÀI GÒN</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', letterSpacing: '2px' }}>----------------------</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontWeight: 'bold' }}>Độc lập - Tự do - Hạnh phúc</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', letterSpacing: '2px' }}>----------------------</Typography>
                    </Box>
                </Box>
                
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 0, textAlign: 'center', fontFamily: '"Times New Roman", Times, serif', fontSize: '14pt' }}>
                    BIÊN BẢN BÀN GIAO THIẾT BỊ TRƯỚC BẢO HÀNH SỬA CHỮA
                </Typography>
                <Typography sx={{ mb: 2, textAlign: 'center', fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>
                    (Số: {form_code?.match(/\d+$/)?.[0] || '...........'}/{dayjs(created_at).format('YYYY')}/BBBG-PQLTS)
                </Typography>

                <Box sx={{ mb: 2 }}>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>
                        Hôm nay, ngày {dayjs(created_at).format('DD')} tháng {dayjs(created_at).format('MM')} năm {dayjs(created_at).format('YYYY')}, Tại: Công ty CP Viễn thông ACT.
                    </Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>Chúng tôi gồm:</Typography>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Đại diện bên giao:</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>1. Đ/c: {handover_representative} - Chức vụ: ........................</Typography>
                    <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>Đại diện bên nhận:</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>1. Đ/c: {receiver_representative} - Chức vụ: ........................</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}><b>Lý do:</b> {reason}</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mt: 1 }}>
                        Hai bên cùng thống nhất lập biên bản, bàn giao số lượng và chất lượng tài sản như sau:
                    </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Table size="small" sx={{ 
                        tableLayout: 'fixed',
                        width: '100%',
                        borderCollapse: 'collapse', 
                        mb: 2,
                        '& th, & td': { 
                            border: '1px solid black !important', 
                            color: 'black !important', 
                            bgcolor: 'white !important',
                            fontFamily: '"Times New Roman", Times, serif',
                            fontSize: '11pt',
                            padding: '4px 2px',
                            wordWrap: 'break-word',
                            wordBreak: 'break-word',
                            whiteSpace: 'normal',
                            overflow: 'hidden'
                        } 
                    }}>
                        <TableHead>
                            <TableRow>
                                <TableCell align="center" sx={{ width: '4%', fontWeight: 'bold' }}>STT</TableCell>
                                <TableCell align="center" sx={{ width: '15%', fontWeight: 'bold' }}>Tên tài sản</TableCell>
                                <TableCell align="center" sx={{ width: '11%', fontWeight: 'bold' }}>Mã tài sản</TableCell>
                                <TableCell align="center" sx={{ width: '10%', fontWeight: 'bold' }}>Hãng sản xuất</TableCell>
                                <TableCell align="center" sx={{ width: '14%', fontWeight: 'bold' }}>Số Serial</TableCell>
                                <TableCell align="center" sx={{ width: '6%', fontWeight: 'bold' }}>Số lượng</TableCell>
                                <TableCell align="center" sx={{ width: '10%', fontWeight: 'bold' }}>Ngày hỏng</TableCell>
                                <TableCell align="center" sx={{ width: '16%', fontWeight: 'bold' }}>Thời điểm hết hạn bảo hành</TableCell>
                                <TableCell align="center" sx={{ width: '14%', fontWeight: 'bold' }}>Tình trạng tài sản</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(1)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(3)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(4)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(6)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(7)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(8)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(10)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(11)</TableCell>
                                <TableCell align="center" sx={{ fontStyle: 'italic' }}>(12)</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {equipment_list.map((row: any, idx: number) => (
                                <TableRow key={idx}>
                                    <TableCell align="center">{idx + 1}</TableCell>
                                    <TableCell>{row.product_name}</TableCell>
                                    <TableCell>{row.item_code}</TableCell>
                                    <TableCell>{row.manufacturer}</TableCell>
                                    <TableCell>{row.serial}</TableCell>
                                    <TableCell align="center">{row.quantity < 10 ? `0${row.quantity}` : row.quantity}</TableCell>
                                    <TableCell>{row.broken_date}</TableCell>
                                    <TableCell>{row.warranty_end}</TableCell>
                                    <TableCell>{row.issue_notes}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Box>

                <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', mb: 4, fontStyle: 'italic' }}>
                    Biên bản này được làm thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau và có hiệu lực kể từ ngày ký.
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, px: 2, mb: 8 }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>ĐẠI DIỆN BÊN NHẬN</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', mt: 0 }}>(Ký ghi rõ họ tên)</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>NGƯỜI NHẬN</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', mt: 0 }}>(Ký ghi rõ họ tên)</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>ĐẠI DIỆN BÊN GIAO</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', mt: 0 }}>(Ký ghi rõ họ tên)</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center' }}>
                        <Typography fontWeight="bold" sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt' }}>NGƯỜI GIAO</Typography>
                        <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '12pt', fontStyle: 'italic', mt: 0 }}>(Ký ghi rõ họ tên)</Typography>
                    </Box>
                </Box>
                
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 6 }}>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', fontStyle: 'italic', color: 'blue' }}>BM.03/QT.QLTS.03</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', fontStyle: 'italic' }}>Lần ban hành:01/ Ngày ban hành .../.../....</Typography>
                    <Typography sx={{ fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt', fontStyle: 'italic' }}>1/1</Typography>
                </Box>
            </Box>
        );
    }

    return null;
};
