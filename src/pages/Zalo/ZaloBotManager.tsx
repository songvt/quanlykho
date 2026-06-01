import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Alert,
    Chip,
    IconButton,
    MenuItem,
    Select,
    Checkbox,
    Grid,
    InputLabel,
    FormControl
} from '@mui/material';
import {
    DeleteOutline as DeleteIcon,
    UploadFile as UploadFileIcon,
    Download as DownloadIcon,
    Description as DescriptionIcon,
    Send as SendIcon,
    Add as AddIcon,
    Sync as SyncIcon
} from '@mui/icons-material';
import * as ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase';

interface ZaloBotToken {
    id: string;
    token: string;
    group_name: string;
    bot_name: string;
    notes: string;
}

interface ZaloContact {
    id: string;
    employee_id: string;
    receiver_name: string;
    phone: string;
    zalo_user_id: string;
    bot_api_token: string;
    bot_name: string;
    notes: string;
    status: string;
}

const ZaloBotManager: React.FC = () => {
    const [tokens, setTokens] = useState<ZaloBotToken[]>([]);
    const [contacts, setContacts] = useState<ZaloContact[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form states
    const [newToken, setNewToken] = useState({ token: '', group_name: '', bot_name: '', notes: '' });
    const [newContact, setNewContact] = useState({ employee_id: '', receiver_name: '', phone: '', zalo_user_id: '', notes: '', bot_api_token: '' });
    
    // Bulk send states
    const [messageContent, setMessageContent] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [filterToken, setFilterToken] = useState('all');

    const [loadingSync, setLoadingSync] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tokensRes, contactsRes] = await Promise.all([
                supabase.from('zalo_bot_tokens').select('*').order('created_at', { ascending: false }),
                supabase.from('zalo_personal_contacts').select('*').order('created_at', { ascending: false })
            ]);
            
            if (tokensRes.error) throw tokensRes.error;
            if (contactsRes.error) throw contactsRes.error;
            
            setTokens(tokensRes.data || []);
            setContacts(contactsRes.data || []);
        } catch (err: any) {
            setError(err.message || 'Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // --- Tokens ---
    const handleAddToken = async () => {
        if (!newToken.token || !newToken.group_name || !newToken.bot_name) return setError('Vui lòng điền đủ thông tin token');
        setLoading(true);
        try {
            const { error } = await supabase.from('zalo_bot_tokens').insert([newToken]);
            if (error) throw error;
            setSuccess('Đã thêm Token thành công');
            setNewToken({ token: '', group_name: '', bot_name: '', notes: '' });
            fetchData();
        } catch (err: any) { setError(err.message); }
        setLoading(false);
    };

    const handleDeleteToken = async (id: string) => {
        if (!window.confirm('Bạn có chắc muốn xóa token này?')) return;
        try {
            await supabase.from('zalo_bot_tokens').delete().eq('id', id);
            fetchData();
            setSuccess('Đã xóa token');
        } catch (err: any) { setError(err.message); }
    };

    const handleSyncBot = async (tokenObj: any) => {
        setLoadingSync(tokenObj.id);
        setError(null);
        try {
            const res = await fetch('/api/zalo?action=sync_contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: tokenObj.token, bot_name: tokenObj.bot_name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi đồng bộ');
            setSuccess(data.message);
            if (data.count > 0) fetchData();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingSync(null);
        }
    };

    // --- Contact Management ---
    const handleSaveContact = async () => {
        if (!newContact.employee_id || !newContact.zalo_user_id) return setError('Mã NV và Zalo user_id là bắt buộc');
        try {
            const tokenInfo = tokens.find(t => t.token === newContact.bot_api_token);
            const dataToSave = {
                ...newContact,
                bot_name: tokenInfo ? tokenInfo.bot_name : ''
            };
            const { error: saveError } = await supabase.from('zalo_personal_contacts').upsert(dataToSave, { onConflict: 'employee_id' });
            if (saveError) throw saveError;
            setSuccess('Thêm liên hệ thành công!');
            setNewContact({ employee_id: '', receiver_name: '', phone: '', zalo_user_id: '', notes: '', bot_api_token: '' });
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError(null);
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const worksheet = workbook.worksheets[0];
            const parsedData: any[] = [];
            const colMap: Record<string, string> = {
                'Mã nhân viên': 'employee_id',
                'Tên người nhận': 'receiver_name',
                'Điện thoại': 'phone',
                'Zalo_user_id': 'zalo_user_id',
                'Mã API token': 'bot_api_token',
                'API token zalo': 'bot_name',
                'Ghi chú': 'notes',
                'Trạng thái': 'status'
            };
            
            const headers: string[] = [];
            worksheet.getRow(1).eachCell((cell, colNumber) => { headers[colNumber] = cell.text.trim(); });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === 1) return;
                const record: any = {};
                let hasData = false;
                row.eachCell((cell, colNumber) => {
                    if (headers[colNumber] && colMap[headers[colNumber]]) {
                        record[colMap[headers[colNumber]]] = cell.text?.trim() || '';
                        hasData = true;
                    }
                });
                if (hasData && record.employee_id && record.zalo_user_id) parsedData.push(record);
            });

            if (parsedData.length === 0) throw new Error('Không có dữ liệu hợp lệ.');

            const { error: upsertError } = await supabase.from('zalo_personal_contacts').upsert(parsedData, { onConflict: 'employee_id' });
            if (upsertError) throw upsertError;

            setSuccess(`Đã import thành công ${parsedData.length} liên hệ.`);
            fetchData();
        } catch (err: any) {
            setError(err.message || 'Lỗi import Excel');
        } finally {
            setImporting(false);
            if (e.target) e.target.value = '';
        }
    };

    const handleDeleteContact = async (id: string) => {
        if (!window.confirm('Xóa liên hệ này?')) return;
        try {
            await supabase.from('zalo_personal_contacts').delete().eq('id', id);
            fetchData();
        } catch (err: any) { setError(err.message); }
    };

    // --- Export / Template ---
    const handleDownloadTemplate = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Danh bạ Zalo Bot');

            // Định nghĩa các cột
            worksheet.columns = [
                { header: 'Mã nhân viên', key: 'employee_id', width: 15 },
                { header: 'Tên người nhận', key: 'receiver_name', width: 25 },
                { header: 'Điện thoại', key: 'phone', width: 15 },
                { header: 'Zalo_user_id', key: 'zalo_user_id', width: 25 },
                { header: 'Ghi chú', key: 'notes', width: 20 },
                { header: 'Trạng thái', key: 'status', width: 15 },
                { header: 'Mã API token', key: 'bot_api_token', width: 35 },
                { header: 'API token zalo', key: 'bot_name', width: 25 },
            ];

            // Làm nổi bật Header
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

            // Thêm 1 dòng ví dụ
            worksheet.addRow({
                employee_id: 'NV001',
                receiver_name: 'Nguyễn Văn A',
                phone: '0901234567',
                zalo_user_id: '3fdc585be01709495006',
                notes: 'Khách VIP',
                status: 'Đang hoạt động',
                bot_api_token: '1862629919486206414:...',
                bot_name: 'Q12 - AI'
            });

            // Tải file về máy
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Xử lý tải xuống
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'Mau_Import_Danh_Ba_Zalo.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Lỗi tải mẫu import:', err);
            setError('Không thể tải file mẫu. Vui lòng thử lại.');
        }
    };

    const handleExportExcel = async () => {
        if (contacts.length === 0) return setError('Không có dữ liệu để xuất Excel');
        
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Danh bạ Zalo Bot');

            worksheet.columns = [
                { header: 'Mã nhân viên', key: 'employee_id', width: 15 },
                { header: 'Tên người nhận', key: 'receiver_name', width: 25 },
                { header: 'Điện thoại', key: 'phone', width: 15 },
                { header: 'Zalo_user_id', key: 'zalo_user_id', width: 25 },
                { header: 'Ghi chú', key: 'notes', width: 20 },
                { header: 'Trạng thái', key: 'status', width: 15 },
                { header: 'Mã API token', key: 'bot_api_token', width: 35 },
                { header: 'API token zalo', key: 'bot_name', width: 25 },
            ];

            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

            contacts.forEach(c => {
                worksheet.addRow({
                    employee_id: c.employee_id,
                    receiver_name: c.receiver_name,
                    phone: c.phone,
                    zalo_user_id: c.zalo_user_id,
                    notes: c.notes,
                    status: c.status,
                    bot_api_token: c.bot_api_token,
                    bot_name: c.bot_name
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Danh_Ba_Zalo_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Lỗi export Excel:', err);
            setError('Không thể xuất file Excel.');
        }
    };

    // --- Bulk Sending ---
    const filteredContacts = filterToken === 'all' 
        ? contacts 
        : contacts.filter(c => c.bot_api_token === filterToken);

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedContacts(filteredContacts.map(c => c.id));
        } else {
            setSelectedContacts([]);
        }
    };

    const handleSelectOne = (id: string) => {
        setSelectedContacts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const handleSendBulk = async () => {
        if (selectedContacts.length === 0) return setError('Chưa chọn người nhận');
        if (!messageContent.trim()) return setError('Chưa nhập nội dung tin nhắn');
        
        setSending(true);
        setError(null);
        try {
            const payload = {
                action: 'send_personal',
                contact_ids: selectedContacts,
                message: messageContent
            };

            const response = await fetch('/api/zalo?action=send_personal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Lỗi gửi tin');

            setSuccess(`Đã đưa ${selectedContacts.length} tin nhắn vào hàng đợi xử lý!`);
            setSelectedContacts([]);
            setMessageContent('');
            fetchData(); // Cập nhật lại UI trạng thái
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto', bgcolor: '#f4f6f8', minHeight: '100vh' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

            {/* SECTION 1: Token Management */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#111827' }}>Nhóm API token Zalo</Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>Tạo nhiều nhóm token để gửi tin theo từng tài khoản bot khác nhau.</Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Mã API token (vd: 18626...:oJU...)" value={newToken.token} onChange={e => setNewToken({...newToken, token: e.target.value})} /></Grid>
                    <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Tên nhóm token (vd: Nhóm Q12)" value={newToken.group_name} onChange={e => setNewToken({...newToken, group_name: e.target.value})} /></Grid>
                    <Grid item xs={12} md={3}><TextField fullWidth size="small" label="API token Zalo (Tên bot hiển thị)" value={newToken.bot_name} onChange={e => setNewToken({...newToken, bot_name: e.target.value})} /></Grid>
                    <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Ghi chú nhóm" value={newToken.notes} onChange={e => setNewToken({...newToken, notes: e.target.value})} /></Grid>
                    <Grid item xs={12} md={1}>
                        <Button fullWidth variant="contained" color="success" onClick={handleAddToken} startIcon={<AddIcon />}>Lưu</Button>
                    </Grid>
                </Grid>

                {tokens.map(t => (
                    <Box key={t.id} sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: '#f3f4f6', p: 1, borderRadius: 1, mr: 2, mb: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#374151' }}>
                            {t.token.substring(0, 15)}...{t.token.substring(t.token.length - 10)} - {t.group_name} - {t.bot_name}
                        </Typography>
                        <IconButton size="small" color="primary" onClick={() => handleSyncBot(t)} sx={{ ml: 1, p: 0.5 }} disabled={loadingSync === t.id} title="Đồng bộ danh bạ từ tin nhắn mới nhất">
                            {loadingSync === t.id ? <CircularProgress size={16} /> : <SyncIcon fontSize="small" />}
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDeleteToken(t.id)} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                ))}
            </Paper>

            {/* SECTION 2: Contact Management */}
            <Paper sx={{ p: 3, mb: 3, borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#111827' }}>Thông báo Zalo</Typography>
                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2 }}>Thêm liên hệ nhận tin qua Zalo Bot.</Typography>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Mã nhân viên" value={newContact.employee_id} onChange={e => setNewContact({...newContact, employee_id: e.target.value})} /></Grid>
                    <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Tên người nhận" value={newContact.receiver_name} onChange={e => setNewContact({...newContact, receiver_name: e.target.value})} /></Grid>
                    <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Điện thoại" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} /></Grid>
                    <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Zalo user_id" value={newContact.zalo_user_id} onChange={e => setNewContact({...newContact, zalo_user_id: e.target.value})} /></Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Chọn nhóm token</InputLabel>
                            <Select label="Chọn nhóm token" value={newContact.bot_api_token} onChange={e => setNewContact({...newContact, bot_api_token: e.target.value})}>
                                {tokens.map(t => <MenuItem key={t.id} value={t.token}>{t.group_name} ({t.bot_name})</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={1}><TextField fullWidth size="small" label="Ghi chú" value={newContact.notes} onChange={e => setNewContact({...newContact, notes: e.target.value})} /></Grid>
                    <Grid item xs={12} md={1}>
                        <Button fullWidth variant="contained" color="success" onClick={handleSaveContact} startIcon={<AddIcon />}>Thêm</Button>
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button variant="outlined" component="label" startIcon={importing ? <CircularProgress size={16}/> : <UploadFileIcon />} disabled={importing}>
                        Import Excel
                        <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImportExcel} />
                    </Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportExcel}>Export Excel</Button>
                    <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={handleDownloadTemplate}>Mẫu import</Button>
                </Box>
            </Paper>

            {/* SECTION 3: Bulk Sending */}
            <Paper sx={{ p: 3, borderRadius: 2, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#111827' }}>Gửi tin hàng loạt</Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280' }}>Gửi tin nhắn qua Bot cá nhân theo chính sách.</Typography>
                    </Box>
                    <Button 
                        variant="contained" 
                        color="success" 
                        onClick={handleSendBulk}
                        disabled={sending || selectedContacts.length === 0}
                        startIcon={sending ? <CircularProgress size={16} color="inherit"/> : <SendIcon />}
                    >
                        Gửi đã chọn ({selectedContacts.length})
                    </Button>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={filterToken} onChange={e => setFilterToken(e.target.value)}>
                            <MenuItem value="all">Tất cả nhóm token</MenuItem>
                            {tokens.map(t => <MenuItem key={t.id} value={t.token}>{t.group_name} ({t.bot_name})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        Đang hiển thị {filteredContacts.length} người nhận, đã chọn {selectedContacts.length}.
                    </Typography>
                </Box>

                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    placeholder="Nhập nội dung tin nhắn cần gửi..."
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    sx={{ mb: 3, bgcolor: '#fff' }}
                />

                <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox 
                                        checked={filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length}
                                        indeterminate={selectedContacts.length > 0 && selectedContacts.length < filteredContacts.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ NV</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TÊN NGƯỜI NHẬN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ĐIỆN THOẠI</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ZALO USER_ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>NHÓM TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>GHI CHÚ</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TRẠNG THÁI</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }} align="right">THAO TÁC</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredContacts.map(c => (
                                <TableRow key={c.id} hover selected={selectedContacts.includes(c.id)}>
                                    <TableCell padding="checkbox">
                                        <Checkbox checked={selectedContacts.includes(c.id)} onChange={() => handleSelectOne(c.id)} />
                                    </TableCell>
                                    <TableCell>{c.employee_id}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{c.receiver_name}</TableCell>
                                    <TableCell>{c.phone}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.zalo_user_id.substring(0,10)}...</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.bot_api_token.substring(0,10)}...</TableCell>
                                    <TableCell>
                                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{tokens.find(t => t.token === c.bot_api_token)?.group_name || c.bot_name}</Typography>
                                    </TableCell>
                                    <TableCell>{c.notes}</TableCell>
                                    <TableCell>
                                        <Chip label={c.status} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }}/>
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton size="small" color="error" onClick={() => handleDeleteContact(c.id)}><DeleteIcon fontSize="small"/></IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default ZaloBotManager;
