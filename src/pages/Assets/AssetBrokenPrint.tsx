import React, { useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Stack, Divider
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import type { Asset } from '../../types';

interface Props {
    open: boolean;
    onClose: () => void;
    assets: Asset[];
}

const AssetBrokenPrint: React.FC<Props> = ({ open, onClose, assets }) => {
    const printRef = useRef<HTMLDivElement>(null);

    const now = new Date();
    const dateStr = `Tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        const w = window.open('', '_blank', 'width=1100,height=800');
        if (!w) return;
        w.document.write(`
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>Biên bản bàn giao vật tư thiết bị thu hồi</title>
                <style>
                    @page { size: A4; margin: 10mm 15mm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; margin: 0; padding: 0; line-height: 1.4; }
                    
                    .page-header { width: 100%; margin-bottom: 20px; }
                    .header-table { width: 100%; border: none; }
                    .header-table td { border: none; padding: 0; vertical-align: top; text-align: center; }
                    .company-info { width: 45%; }
                    .republic-info { width: 55%; }
                    
                    .company-name { font-weight: bold; font-size: 11pt; }
                    .unit-name { font-weight: bold; font-size: 11pt; }
                    .republic { font-weight: bold; font-size: 12pt; }
                    .motto { font-weight: bold; font-size: 12pt; }
                    .header-divider { width: 120px; border-top: 1px solid black; margin: 5px auto; }
                    
                    .title-container { text-align: center; margin: 25px 0 15px; }
                    .title { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 4px; }
                    .subtitle { font-style: italic; font-size: 11pt; }
                    
                    .doc-ref { margin: 15px 0; font-size: 11.5pt; text-align: justify; }
                    
                    .parties-table { width: 100%; margin: 15px 0; border: none; }
                    .parties-table td { border: none; padding: 2px 0; font-size: 11.5pt; }
                    .party-label { font-weight: bold; width: 150px; }
                    .party-val { font-weight: bold; text-transform: uppercase; }
                    .party-role-label { width: 90px; padding-left: 10px; font-weight: normal; }
                    .party-role-val { font-weight: normal; }

                    table.data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                    table.data-table th { border: 1px solid black; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 10.5pt; background: #f2f2f2; }
                    table.data-table td { border: 1px solid black; padding: 6px 4px; vertical-align: middle; font-size: 10.5pt; }
                    .center { text-align: center; }
                    
                    .footer-note { margin-top: 25px; font-style: italic; font-size: 11pt; text-align: justify; }
                    
                    .signature-table { width: 100%; margin-top: 20px; border: none; }
                    .signature-table td { border: none; text-align: center; padding: 10px 5px; vertical-align: top; width: 25%; }
                    .sig-title { font-weight: bold; font-size: 10pt; text-transform: uppercase; }
                    .sig-note { font-style: italic; font-size: 9pt; }
                    .sig-space { height: 80px; }
                    
                    .form-id { position: absolute; top: 0; right: 0; font-size: 10pt; color: #666; font-family: Arial, sans-serif; }
                </style>
            </head>
            <body>
                <div style="position: relative; padding: 10mm;">
                    <div class="form-id">BM 03/QT.ACT.QLTS.02</div>
                    ${content}
                </div>
            </body>
            </html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 800);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, bgcolor: '#f8fafc' }}>
                Xem trước biên bản bàn giao thu hồi
                <Button startIcon={<CloseIcon />} onClick={onClose} size="small" color="inherit">Đóng</Button>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, bgcolor: '#f1f5f9' }}>
                <Box ref={printRef} sx={{ 
                    bgcolor: 'white', 
                    p: '15mm 15mm', 
                    mx: 'auto', 
                    width: '210mm', 
                    minHeight: '297mm',
                    boxShadow: '0 0 20px rgba(0,0,0,0.15)',
                    fontFamily: 'Times New Roman',
                    color: 'black',
                    lineHeight: 1.4
                }}>
                    {/* Header Table */}
                    <table style={{ width: '100%', marginBottom: 10 }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>ĐƠN VỊ BSG</div>
                                    <div style={{ width: 100, borderTop: '1px solid black', margin: '5px auto' }}></div>
                                </td>
                                <td style={{ width: '55%', textAlign: 'center', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                                    <div style={{ fontWeight: 'bold', fontSize: '12pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                                    <div style={{ width: 150, borderTop: '1px solid black', margin: '5px auto' }}></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Title */}
                    <div style={{ textAlign: 'center', margin: '30px 0 15px' }}>
                        <div style={{ fontSize: '16pt', fontWeight: 'bold' }}>BIÊN BẢN BÀN GIAO VẬT TƯ, THIẾT BỊ THU HỒI</div>
                        <div style={{ fontStyle: 'italic', fontSize: '11pt' }}>(Số: ........./BBBG)</div>
                    </div>

                    {/* Doc Ref */}
                    <div style={{ margin: '15px 0', fontSize: '11.5pt', textAlign: 'justify' }}>
                        - Căn cứ vào: Phiếu yêu cầu kiểm tra đánh giá chất lượng tài sản trước khi bảo hành, sửa chữa Số : 7858 /YCKCS-BSG-T03-2025
                    </div>

                    <div style={{ marginBottom: 10, fontSize: '11.5pt' }}>
                        Hôm nay, ngày ...... tháng {now.getMonth() + 1} năm {now.getFullYear()}, Chúng tôi gồm:
                    </div>

                    {/* Parties Table */}
                    <div style={{ fontWeight: 'bold', marginBottom: 5, fontSize: '11.5pt' }}>Đại diện bên giao:</div>
                    <table style={{ width: '100%', marginBottom: 10 }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '25px' }}>1.</td>
                                <td style={{ width: '60px' }}>Họ tên:</td>
                                <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>NGUYỄN HẢI SƠN</td>
                                <td style={{ width: '80px', textAlign: 'right' }}>Chức vụ:</td>
                                <td style={{ width: '140px', paddingLeft: 10 }}>GĐ Trung Tâm</td>
                            </tr>
                            <tr>
                                <td>2.</td>
                                <td>Họ tên:</td>
                                <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>VÕ THANH SONG</td>
                                <td style={{ textAlign: 'right' }}>Chức vụ:</td>
                                <td style={{ paddingLeft: 10 }}>NV QLTS- Kho</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ fontWeight: 'bold', margin: '10px 0 5px', fontSize: '11.5pt' }}>Đại diện bên nhận:</div>
                    <table style={{ width: '100%', marginBottom: 10 }}>
                        <tbody>
                            <tr>
                                <td style={{ width: '25px' }}>1.</td>
                                <td style={{ width: '60px' }}>Họ tên:</td>
                                <td style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>NGUYỄN TẤN ĐẠT</td>
                                <td style={{ width: '80px', textAlign: 'right' }}>Chức vụ:</td>
                                <td style={{ width: '140px', paddingLeft: 10 }}>NV QLTS- Kho</td>
                            </tr>
                            <tr>
                                <td>2.</td>
                                <td>Họ tên:</td>
                                <td style={{ borderBottom: '1px dotted black' }}>................................................</td>
                                <td style={{ textAlign: 'right' }}>Chức vụ:</td>
                                <td style={{ paddingLeft: 10, borderBottom: '1px dotted black' }}>........................................</td>
                            </tr>
                        </tbody>
                    </table>

                    <div style={{ margin: '15px 0', fontSize: '11.5pt' }}>
                        <span style={{ fontWeight: 'bold' }}>Lý do bàn giao:</span> CCDC-TBVP hỏng.
                    </div>
                    <div style={{ fontSize: '11.5pt' }}>
                        Hai bên cùng thống nhất lập biên bản, bàn giao số lượng và chất lượng trang thiết bị sau:
                    </div>

                    {/* Data Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 15, border: '1px solid black' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>STT</th>
                                <th style={{ width: '90px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Mã tài sản</th>
                                <th style={{ width: 'auto', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Tên tài sản</th>
                                <th style={{ width: '40px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>SL</th>
                                <th style={{ width: '40px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>ĐV</th>
                                <th style={{ width: '110px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Người sử dụng</th>
                                <th style={{ width: '80px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Tình trạng</th>
                                <th style={{ width: '130px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Mô tả chi tiết</th>
                                <th style={{ width: '80px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Chức vụ</th>
                                <th style={{ width: '100px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Đơn vị</th>
                                <th style={{ width: '70px', border: '1px solid black', padding: '6px 4px', backgroundColor: '#f2f2f2' }}>Ghi chú</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.map((asset, index) => (
                                <tr key={asset.id}>
                                    <td style={{ textAlign: 'center', border: '1px solid black', padding: '6px 4px' }}>{index + 1}</td>
                                    <td style={{ textAlign: 'center', border: '1px solid black', padding: '6px 4px' }}>{asset.asset_code}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.asset_name}</td>
                                    <td style={{ textAlign: 'center', border: '1px solid black', padding: '6px 4px' }}>{asset.quantity || 1}</td>
                                    <td style={{ textAlign: 'center', border: '1px solid black', padding: '6px 4px' }}>{asset.unit || 'Cái'}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.user_employee_name || ''}</td>
                                    <td style={{ textAlign: 'center', border: '1px solid black', padding: '6px 4px' }}>{asset.status}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.status_description || ''}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.user_type || ''}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.location_name || ''}</td>
                                    <td style={{ border: '1px solid black', padding: '6px 4px' }}>{asset.notes || ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: 25, fontStyle: 'italic', fontSize: '11pt', textAlign: 'justify' }}>
                        Biên bản này được làm thành 03 bản, mỗi bên giữ 01 bản có giá trị như nhau và có hiệu lực kể từ ngày ký.
                    </div>

                    {/* Footer Date & Signatures */}
                    <div style={{ textAlign: 'right', marginTop: 20, fontStyle: 'italic', fontSize: '11.5pt' }}>
                        Ngày .... tháng {now.getMonth() + 1} năm {now.getFullYear()}
                    </div>

                    <table style={{ width: '100%', marginTop: 10, border: 'none' }}>
                        <tbody>
                            <tr>
                                <td style={{ textAlign: 'center', width: '25%' }}>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10.5pt' }}>TRƯỞNG ĐƠN VỊ</div>
                                    <div style={{ fontStyle: 'italic', fontSize: '9.5pt' }}>(Ký ghi rõ họ tên)</div>
                                    <div style={{ height: 80 }}></div>
                                </td>
                                <td style={{ textAlign: 'center', width: '25%' }}>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10.5pt' }}>NV QLTS ĐV</div>
                                    <div style={{ fontStyle: 'italic', fontSize: '9.5pt' }}>(Ký ghi rõ họ tên)</div>
                                    <div style={{ height: 80 }}></div>
                                </td>
                                <td style={{ textAlign: 'center', width: '25%' }}>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10.5pt' }}>PHÒNG HÀNH CHÍNH</div>
                                    <div style={{ fontStyle: 'italic', fontSize: '9.5pt' }}>(Ký ghi rõ họ tên)</div>
                                    <div style={{ height: 80 }}></div>
                                </td>
                                <td style={{ textAlign: 'center', width: '25%' }}>
                                    <div style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '10.5pt' }}>PHÒNG QLTS</div>
                                    <div style={{ fontStyle: 'italic', fontSize: '9.5pt' }}>(Ký ghi rõ họ tên)</div>
                                    <div style={{ height: 80 }}></div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: '#f8fafc' }}>
                <Button onClick={onClose} variant="outlined" color="inherit">Hủy bỏ</Button>
                <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} color="primary" sx={{ px: 4 }}>
                    Xác nhận và In
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AssetBrokenPrint;
