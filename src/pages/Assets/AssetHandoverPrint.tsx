import React, { useRef, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Stack, Divider,
    Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
    TextField, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import type { Asset } from '../../types';
import { formatPhone } from '../../utils/format';

interface HandoverInfo {
    giverName?: string;
    giverTitle?: string;
    giverPhone?: string;
    giverName2?: string;
    giverTitle2?: string;
    giverPhone2?: string;
    receiverName: string;
    receiverTitle?: string;
    receiverDept?: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    actionType: 'allocate' | 'revoke' | 'transfer' | null;
    assets: Asset[];
    handoverInfo: HandoverInfo;
}

interface BhlItem {
    stt: number;
    name: string;
    unit: string;
    contract: string;
    quota: string;
    quantity: number;
    spec: string;
    serial: string;
    note: string;
}

const AssetHandoverPrint: React.FC<Props> = ({ open, onClose, actionType, assets, handoverInfo }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [templateType, setTemplateType] = useState<'default' | 'bhl'>('default');

    // State for the 6 protective equipment items
    const [bhlItems, setBhlItems] = useState<BhlItem[]>([
        { stt: 1, name: 'Dây đai bảo hiểm', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Dây đai 1 móc', serial: '', note: '' },
        { stt: 2, name: 'Dây đai bảo hiểm (2 móc)', unit: 'Chiếc', contract: '0', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Bổ sung cho lực lượng trạm viễn thông thực hiện công việc trên cao.', serial: '', note: '' },
        { stt: 3, name: 'Mũ cứng bảo hộ', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Màu Trắng, có khả năng chống nóng, cách điện, tăng tính an toàn, thấm hút mồ hôi, chịu va đập cực tốt', serial: '', note: '' },
        { stt: 4, name: 'Quần áo bảo hộ mùa hè', unit: 'Bộ', contract: '≥ 1', quota: '3 Bộ/1 NV', quantity: 1, spec: 'Đồng phục công ty ACT', serial: '', note: '' },
        { stt: 5, name: 'Áo bảo hộ mùa đông', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
        { stt: 6, name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 1, spec: 'Giày bảo hộ chống đinh, chống va đập', serial: '', note: '' },
    ]);

    const now = new Date();
    const dateStr = `TPHCM, Ngày ${now.getDate().toString().padStart(2, '0')} tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const titleMapDefault = {
        allocate: 'BIÊN BẢN BÀN GIAO TBVP-CCDC (ACT ĐẦU TƯ)',
        revoke:   'BIÊN BẢN THU HỒI TBVP-CCDC (ACT ĐẦU TƯ)',
        transfer: 'BIÊN BẢN ĐIỀU CHUYỂN TBVP-CCDC (ACT ĐẦU TƯ)',
    };

    const titleMapBhl = {
        allocate: 'BIÊN BẢN BÀN GIAO TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        revoke:   'BIÊN BẢN THU HỒI TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        transfer: 'BIÊN BẢN ĐIỀU CHUYỂN TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
    };

    const activeBhlItems = bhlItems.filter(item => item.quantity > 0);
    const qtyLabel = actionType === 'revoke' ? 'SL thu hồi' : actionType === 'transfer' ? 'SL điều chuyển' : 'SL bàn giao';

    const totalQty = templateType === 'default'
        ? assets.reduce((sum, a) => sum + (a.quantity || 1), 0)
        : activeBhlItems.reduce((sum, item) => sum + item.quantity, 0);

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        const w = window.open('', '_blank', 'width=1000,height=800');
        if (!w) return;
        w.document.write(`
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>Biên bản bàn giao</title>
                <style>
                    @page { size: A4; margin: 10mm 12mm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
                    .header-left { width: 55%; display: flex; align-items: center; gap: 10px; }
                    .header-right { width: 45%; text-align: center; }
                    .logo-box { width: 55px; height: 55px; background: #cc0000; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14pt; border-radius: 4px; flex-shrink: 0; }
                    .company-name { font-size: 10pt; font-weight: bold; color: #003087; text-align: center; }
                    .company-sub { font-size: 10pt; font-weight: bold; color: #003087; text-align: center; }
                    .republic { font-size: 10.5pt; font-weight: bold; text-align: center; }
                    .motto { font-size: 10.5pt; font-weight: bold; text-decoration: underline; text-align: center; }
                    .date-line { text-align: right; font-style: italic; font-size: 10.5pt; margin: 10px 0 6px; }
                    .title { text-align: center; font-size: 16pt; font-weight: bold; color: #000; margin: 14px 0 18px; text-transform: uppercase; }
                    .section-label { font-weight: bold; font-size: 10.5pt; margin: 6px 0 2px; color: #003087; }
                    .person-row { display: flex; font-size: 10.5pt; margin: 3px 0; }
                    .person-label { width: 120px; font-weight: bold; }
                    .person-name { flex: 1; }
                    .person-right { width: 250px; display: flex; gap: 12px; }
                    .person-title-label { font-weight: bold; width: 70px; }
                    .person-title-val { flex: 1; }
                    .person-phone { width: 110px; text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10pt; }
                    th { background: #f2f2f2; color: #000; border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold; }
                    td { border: 1px solid #888; padding: 4px; vertical-align: middle; }
                    td.center { text-align: center; }
                    tr.total-row td { font-weight: bold; background: #f0f0f0; }
                    .note-row { font-style: italic; font-size: 9.5pt; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
                    .sig-grid { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
                    .sig-box { width: 30%; }
                    .sig-title { font-weight: bold; font-size: 11pt; }
                    .sig-note { font-style: italic; font-size: 9.5pt; margin-top: 2px; }
                    .sig-space { height: 55px; }
                </style>
            </head>
            <body>${content}</body>
            </html>
        `);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 600);
    };

    const title = actionType
        ? (templateType === 'default' ? titleMapDefault[actionType] : titleMapBhl[actionType])
        : '';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth scroll="paper">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
                Xem trước biên bản
                <Button startIcon={<CloseIcon />} onClick={onClose} size="small">Đóng</Button>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2, bgcolor: '#f4f6f9' }}>
                
                {/* ── Configuration Panel ── */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <FormControl component="fieldset" fullWidth>
                        <FormLabel component="legend" sx={{ fontWeight: 700, fontSize: '0.875rem', color: 'primary.main', mb: 1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Chọn mẫu biên bản bàn giao
                        </FormLabel>
                        <RadioGroup
                            row
                            value={templateType}
                            onChange={(e) => setTemplateType(e.target.value as 'default' | 'bhl')}
                        >
                            <FormControlLabel
                                value="default"
                                control={<Radio size="small" />}
                                label={<Typography variant="body2" fontWeight={600}>Mẫu chung (Theo tài sản đã chọn)</Typography>}
                            />
                            <FormControlLabel
                                value="bhl"
                                control={<Radio size="small" />}
                                label={<Typography variant="body2" fontWeight={600}>Mẫu CCDC - Bảo hộ lao động (BHLĐ)</Typography>}
                            />
                        </RadioGroup>
                    </FormControl>

                    {templateType === 'bhl' && (
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e2e8f0' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: 1 }}>
                                📋 Số lượng & thông tin thiết bị bảo hộ lao động:
                            </Typography>
                            <TableContainer component={Box} sx={{ maxHeight: 220, border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'auto' }}>
                                <Table size="small" stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1 }}>STT</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1 }}>Tên CCDC - BHLĐ</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1 }}>ĐVT</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1, width: 85 }}>Số lượng</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1, width: 180 }}>Số Serial / Quy cách</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f8fafc', py: 1 }}>Ghi chú</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {bhlItems.map((item, idx) => (
                                            <TableRow key={item.stt} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                                                <TableCell sx={{ py: 0.5 }}>{item.stt}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, py: 0.5, color: '#334155' }}>{item.name}</TableCell>
                                                <TableCell sx={{ py: 0.5 }}>{item.unit}</TableCell>
                                                <TableCell sx={{ py: 0.5 }}>
                                                    <TextField
                                                        type="number"
                                                        size="small"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const val = Math.max(0, parseInt(e.target.value) || 0);
                                                            const newItems = [...bhlItems];
                                                            newItems[idx].quantity = val;
                                                            setBhlItems(newItems);
                                                        }}
                                                        inputProps={{ min: 0 }}
                                                        sx={{ width: 70, '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.85rem', textAlign: 'center' } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ py: 0.5 }}>
                                                    <TextField
                                                        size="small"
                                                        placeholder="Nhập serial..."
                                                        value={item.serial}
                                                        onChange={(e) => {
                                                            const newItems = [...bhlItems];
                                                            newItems[idx].serial = e.target.value;
                                                            setBhlItems(newItems);
                                                        }}
                                                        sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.85rem' } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ py: 0.5 }}>
                                                    <TextField
                                                        size="small"
                                                        placeholder="Ghi chú..."
                                                        value={item.note}
                                                        onChange={(e) => {
                                                            const newItems = [...bhlItems];
                                                            newItems[idx].note = e.target.value;
                                                            setBhlItems(newItems);
                                                        }}
                                                        sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.85rem' } }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}
                </Paper>

                {/* ── Preview Area ── */}
                <Paper variant="outlined" sx={{ bgcolor: 'white', p: '15mm 15mm', mx: 'auto', width: '210mm', minHeight: '280mm', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', border: '1px solid #e2e8f0' }}>
                    <Box ref={printRef} sx={{ fontFamily: 'Times New Roman', fontSize: '11pt', color: '#000' }}>

                        {/* Header */}
                        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '55%' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontWeight: 'bold', color: '#003087', fontSize: '10.5pt', textTransform: 'uppercase' }}>CTY CỔ PHẦN VIỄN THÔNG ACT</div>
                                    <div style={{ fontWeight: 'bold', color: '#003087', fontSize: '10.5pt', textTransform: 'uppercase' }}>TRUNG TÂM KHU VỰC BẮC SÀI GÒN</div>
                                </div>
                            </div>
                            <div style={{ width: '45%', textAlign: 'center' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
                                <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '10.5pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                            </div>
                        </div>

                        {/* Date */}
                        <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '10.5pt', margin: '10px 0 6px' }}>
                            {dateStr}
                        </div>

                        {/* Title */}
                        <div style={{ textAlign: 'center', fontSize: '16pt', fontWeight: 'bold', color: '#000', margin: '14px 0 18px', textTransform: 'uppercase' }}>
                            {title}
                        </div>

                        {/* Bên Giao */}
                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '6px 0 2px' }}>BÊN GIAO :</div>
                        {handoverInfo.giverName && (
                            <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                <span style={{ flex: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>{handoverInfo.giverName}</span>
                                <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                <span style={{ flex: 1 }}>{handoverInfo.giverTitle}</span>
                                <span style={{ width: 110, textAlign: 'right' }}>{formatPhone(handoverInfo.giverPhone)}</span>
                            </div>
                        )}
                        {handoverInfo.giverName2 && (
                            <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                <span style={{ flex: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>{handoverInfo.giverName2}</span>
                                <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                <span style={{ flex: 1 }}>{handoverInfo.giverTitle2}</span>
                                <span style={{ width: 110, textAlign: 'right' }}>{formatPhone(handoverInfo.giverPhone2)}</span>
                            </div>
                        )}

                        {/* Bên Nhận */}
                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '8px 0 2px' }}>BÊN NHẬN :</div>
                        <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                            <span style={{ flex: 1, fontWeight: 'bold' }}>{handoverInfo.receiverName}</span>
                            <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                            <span style={{ flex: 1 }}>{handoverInfo.receiverTitle || ''}</span>
                            <span style={{ width: 110, textAlign: 'right' }}></span>
                        </div>
                        {handoverInfo.receiverDept && (
                            <div style={{ display: 'flex', fontSize: '10.5pt', margin: '1px 0', alignItems: 'center' }}>
                                <span style={{ fontWeight: 'bold', width: 120 }}>Đơn vị:</span>
                                <span style={{ flex: 1 }}>{handoverInfo.receiverDept}</span>
                            </div>
                        )}

                        {/* Asset Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: '10pt' }}>
                            <thead>
                                {templateType === 'default' ? (
                                    <tr>
                                        {[
                                            { label: 'Mã tài sản', w: 95 },
                                            { label: 'Tên tài sản', w: undefined },
                                            { label: 'Số lượng', w: 60 },
                                            { label: 'Loại tài sản', w: 170 },
                                            { label: 'Serial (nếu có)', w: 140 },
                                            { label: 'Ghi Chú', w: 80 },
                                        ].map((h, i) => (
                                            <th key={i} style={{ width: h.w, background: '#f2f2f2', color: '#000', border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{h.label}</th>
                                        ))}
                                    </tr>
                                ) : (
                                    <tr>
                                        {[
                                            { label: 'STT', w: 35 },
                                            { label: 'Nội dung yêu cầu', w: 165 },
                                            { label: 'Đơn vị', w: 50 },
                                            { label: 'Theo HĐ', w: 60 },
                                            { label: 'Số lượng định mức', w: 90 },
                                            { label: qtyLabel, w: 80 },
                                            { label: 'Quy cách, TCKT', w: 220 },
                                            { label: 'Ghi chú', w: 80 },
                                        ].map((h, i) => (
                                            <th key={i} style={{ width: h.w, background: '#f2f2f2', color: '#000', border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{h.label}</th>
                                        ))}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {templateType === 'default' ? (
                                    assets.length > 0 ? (
                                        assets.map((a, i) => (
                                            <tr key={i}>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.asset_code}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_name}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.quantity || 1}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_type}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.serial_number || ''}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px' }}></td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} style={{ border: '1px solid #888', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                                Chưa chọn tài sản nào để bàn giao. Vui lòng chọn tài sản ở bảng hoặc đổi sang mẫu BHLĐ.
                                            </td>
                                        </tr>
                                    )
                                ) : (
                                                                    activeBhlItems.length > 0 ? (
                                        activeBhlItems.map((item, i) => (
                                            <tr key={i}>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{i + 1}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.name}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.unit}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.contract}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.quota}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold' }}>{item.quantity}</td>
                                                <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle', fontSize: '9pt', lineHeight: 1.2 }}>
                                                    {item.spec} {item.serial ? `(Serial: ${item.serial})` : ''}
                                                </td>
                                                <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{item.note || ''}</td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={8} style={{ border: '1px solid #888', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                                Không có trang bị bảo hộ nào được chọn (Số lượng &gt; 0). Vui lòng cấu hình ở bảng phía trên.
                                            </td>
                                        </tr>
                                    )
                                )}
                                <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                                    <td colSpan={templateType === 'default' ? 2 : 5} style={{ border: '1px solid #888', padding: '4px', textAlign: 'center' }}>TỔNG</td>
                                    <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center' }}>{totalQty}</td>
                                    <td colSpan={templateType === 'default' ? 3 : 2} style={{ border: '1px solid #888', padding: '4px' }}></td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Note */}
                        <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
                            Biên bản lập như nhau và có hiệu lực từ ngày ký, Đ/c kiểm tra trước khi xác nhận tài sản bàn giao ./.
                        </div>

                        {/* Signatures */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30, textAlign: 'center' }}>
                            <div style={{ width: '30%' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>BÊN GIAO</div>
                                <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                <div style={{ height: 55 }}></div>
                            </div>
                            <div style={{ width: '30%' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>BÊN NHẬN</div>
                                <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                <div style={{ height: 55 }}></div>
                            </div>
                            <div style={{ width: '30%' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>GIÁM ĐỐC TRUNG TÂM</div>
                                <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                <div style={{ height: 55 }}></div>
                            </div>
                        </div>
                    </Box>
                </Paper>
            </DialogContent>
            <DialogActions sx={{ p: 2, bgcolor: '#ffffff' }}>
                <Button onClick={onClose} variant="outlined" color="inherit">Bỏ qua</Button>
                <Button onClick={handlePrint} variant="contained" startIcon={<PrintIcon />} color="primary" disabled={templateType === 'default' ? assets.length === 0 : activeBhlItems.length === 0}>
                    In biên bản
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default AssetHandoverPrint;
