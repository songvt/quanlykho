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
    FormControl,
    Switch,
    FormControlLabel,
    Autocomplete
} from '@mui/material';
import {
    DeleteOutline as DeleteIcon,
    UploadFile as UploadFileIcon,
    Download as DownloadIcon,
    Description as DescriptionIcon,
    Send as SendIcon,
    Add as AddIcon,
    Sync as SyncIcon,
    Edit as EditIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import * as ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase';
import { AppButton } from '../../components/Common/AppButton';

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

interface ZaloInboxMessage {
    id: string;
    zalo_user_id: string;
    message_id: string;
    sender_name: string;
    message_content: string;
    bot_token: string;
    created_at: string;
}

const ZaloBotManager: React.FC = () => {
    const [tokens, setTokens] = useState<ZaloBotToken[]>([]);
    const [contacts, setContacts] = useState<ZaloContact[]>([]);
    const [inboxMessages, setInboxMessages] = useState<ZaloInboxMessage[]>([]);
    const [hrProfiles, setHrProfiles] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Form states
    const [newToken, setNewToken] = useState({ token: '', group_name: '', bot_name: '', notes: '' });
    const [newContact, setNewContact] = useState({ id: '', employee_id: '', receiver_name: '', phone: '', zalo_user_id: '', notes: '', bot_api_token: '' });
    
    // Bulk send states
    const [messageContent, setMessageContent] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [filterToken, setFilterToken] = useState('all');

    const [loadingSync, setLoadingSync] = useState<string | null>(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [autoSync, setAutoSync] = useState(false);
    const isSyncingRef = React.useRef(false);

    useEffect(() => {
        let interval: any;
        if (autoSync) {
            interval = setInterval(() => {
                if (!syncingAll && !isSyncingRef.current) handleSyncAllBots(true);
            }, 15000); // 15 seconds
        }
        return () => clearInterval(interval);
    }, [autoSync, syncingAll, tokens]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [tokensRes, contactsRes, inboxRes, hrRes] = await Promise.all([
                supabase.from('zalo_bot_tokens').select('*').order('created_at', { ascending: false }),
                supabase.from('zalo_personal_contacts').select('*').order('created_at', { ascending: false }),
                supabase.from('zalo_bot_inbox').select('*').order('created_at', { ascending: false }),
                supabase.from('hr_profiles').select('id, full_name, phone_number').order('full_name', { ascending: true })
            ]);
            
            if (tokensRes.error) throw tokensRes.error;
            if (contactsRes.error) throw contactsRes.error;
            if (inboxRes.error) throw inboxRes.error;
            
            setTokens(tokensRes.data || []);
            setContacts(contactsRes.data || []);
            setInboxMessages(inboxRes.data || []);
            setHrProfiles(hrRes.data || []);
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

    const handleRegisterWebhook = async (tokenObj: any) => {
        setLoadingSync(tokenObj.id + '_webhook');
        setError(null);
        try {
            const webhookUrl = `${window.location.origin}/api/zalo?action=bot_webhook&token=${tokenObj.token}`;
            const res = await fetch('/api/zalo?action=register_webhook', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_token: tokenObj.token, webhook_url: webhookUrl })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi đăng ký webhook');
            setSuccess('Đã đăng ký Webhook thành công cho bot này!');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoadingSync(null);
        }
    };

    const handleSyncAllBots = async (isSilent = false) => {
        if (!isSilent) setSyncingAll(true);
        if (!isSilent) setError(null);
        isSyncingRef.current = true;
        let totalCount = 0;
        let successCount = 0;
        try {
            for (const t of tokens) {
                try {
                    const res = await fetch('/api/zalo?action=sync_contacts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bot_token: t.token, bot_name: t.bot_name })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        successCount++;
                        if (data.count > 0) totalCount += data.count;
                    }
                } catch (e) {}
            }
            if (!isSilent) {
                setSuccess(`Đã quét xong ${successCount}/${tokens.length} bot. ${totalCount > 0 ? `Tìm thấy ${totalCount} liên hệ mới.` : 'Không có tin nhắn mới.'}`);
            } else if (totalCount > 0 && typeof setSuccess === 'function') {
                // If silent but found messages, still notify
                setSuccess(`Tự động đồng bộ: Tìm thấy ${totalCount} tin nhắn mới.`);
            }
            fetchData(); // Luôn luôn fetchData lại để lấy tin nhắn từ Webhook đổ về
        } catch (err: any) {
            if (!isSilent) setError('Lỗi đồng bộ tất cả bot');
        } finally {
            if (!isSilent) setSyncingAll(false);
            isSyncingRef.current = false;
        }
    };

    // --- Contact Management ---
    const handleSaveContact = async () => {
        if (!newContact.employee_id || !newContact.zalo_user_id) return setError('Mã NV và Zalo user_id là bắt buộc');
        try {
            const tokenInfo = tokens.find(t => t.token === newContact.bot_api_token);
            const dataToSave: any = {
                employee_id: newContact.employee_id,
                receiver_name: newContact.receiver_name,
                phone: newContact.phone,
                zalo_user_id: newContact.zalo_user_id,
                bot_api_token: newContact.bot_api_token,
                bot_name: tokenInfo ? tokenInfo.bot_name : '',
                notes: newContact.notes,
                status: 'Hoạt động'
            };
            if (newContact.id) {
                const { error: saveError } = await supabase.from('zalo_personal_contacts').update(dataToSave).eq('id', newContact.id);
                if (saveError) throw saveError;
                setSuccess('Cập nhật liên hệ thành công!');
            } else {
                const { error: saveError } = await supabase.from('zalo_personal_contacts').insert(dataToSave);
                if (saveError) throw saveError;
                setSuccess('Thêm liên hệ thành công!');
            }
            setNewContact({ id: '', employee_id: '', receiver_name: '', phone: '', zalo_user_id: '', notes: '', bot_api_token: '' });
            fetchData();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleEditContact = (c: any) => {
        setNewContact({
            id: c.id,
            employee_id: c.employee_id || '',
            receiver_name: c.receiver_name || '',
            phone: c.phone || '',
            zalo_user_id: c.zalo_user_id || '',
            bot_api_token: c.bot_api_token || '',
            notes: c.notes || ''
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAddContactFromInbox = (msg: any) => {
        // Try to match an employee in hrProfiles by name
        const matchedEmp = hrProfiles.find(p => 
            p.full_name?.toLowerCase().trim() === msg.sender_name?.toLowerCase().trim()
        );

        setNewContact({
            id: '',
            employee_id: matchedEmp ? matchedEmp.id : '',
            receiver_name: matchedEmp ? matchedEmp.full_name : msg.sender_name || '',
            phone: matchedEmp ? matchedEmp.phone_number || '' : '',
            zalo_user_id: msg.zalo_user_id,
            bot_api_token: msg.bot_token || '',
            notes: `Thêm từ tin nhắn Inbox`,
        });

        // Scroll to the Contact Management form
        const formElement = document.getElementById('contact-form-section');
        if (formElement) {
            formElement.scrollIntoView({ behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 500, behavior: 'smooth' });
        }
    };

    const handleEditInboxMessage = async (msg: any) => {
        const newContent = window.prompt("Chỉnh sửa nội dung tin nhắn:", msg.message_content);
        if (newContent !== null && newContent !== msg.message_content) {
            try {
                const { error: saveError } = await supabase.from('zalo_bot_inbox').update({ message_content: newContent }).eq('id', msg.id);
                if (saveError) throw saveError;
                setSuccess("Sửa nội dung tin nhắn thành công");
                fetchData();
            } catch (err: any) {
                setError(err.message || "Lỗi khi sửa tin nhắn");
            }
        }
    };

    const handleDeleteInboxMessage = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa tin nhắn này khỏi hộp thư?")) return;
        try {
            const { error: delError } = await supabase.from('zalo_bot_inbox').delete().eq('id', id);
            if (delError) throw delError;
            setSuccess("Xóa tin nhắn thành công");
            fetchData();
        } catch (err: any) {
            setError(err.message || "Lỗi khi xóa tin nhắn");
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

            // Check duplicate employee_ids + bot_api_tokens in the import file
            const keyCounts = new Map<string, number>();
            const duplicatesInFile: string[] = [];
            for (const item of parsedData) {
                const key = `${item.employee_id}_${item.bot_api_token}`;
                if (item.employee_id && item.bot_api_token) {
                    const count = keyCounts.get(key) || 0;
                    if (count === 1) {
                        duplicatesInFile.push(`${item.receiver_name || item.employee_id} (Token: ${item.bot_api_token.substring(0, 8)}...)`);
                    }
                    keyCounts.set(key, count + 1);
                }
            }

            if (duplicatesInFile.length > 0) {
                throw new Error(`File import chứa các bản ghi trùng lặp (cùng Mã nhân viên và Mã API token): ${duplicatesInFile.slice(0, 5).join(', ')}${duplicatesInFile.length > 5 ? '...' : ''}. Vui lòng sửa lại trước khi nhập.`);
            }

            const { error: upsertError } = await supabase.from('zalo_personal_contacts').upsert(parsedData, { onConflict: 'employee_id,bot_api_token' });
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
            console.error(err);
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

    const handleExportInbox = async () => {
        if (inboxMessages.length === 0) return setError('Không có dữ liệu Inbox để xuất Excel');
        
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Inbox');

            worksheet.columns = [
                { header: 'ID', key: 'zalo_user_id', width: 25 },
                { header: 'Message ID', key: 'message_id', width: 35 },
                { header: 'Tên người dùng', key: 'sender_name', width: 25 },
                { header: 'Nội dung tin nhắn', key: 'message_content', width: 40 },
                { header: 'HTTP API', key: 'bot_token', width: 40 },
            ];

            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };

            inboxMessages.forEach(msg => {
                worksheet.addRow({
                    zalo_user_id: msg.zalo_user_id,
                    message_id: msg.message_id,
                    sender_name: msg.sender_name,
                    message_content: msg.message_content,
                    bot_token: msg.bot_token
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Inbox_Zalo_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error('Lỗi export Inbox:', err);
            setError('Không thể xuất file Excel Inbox.');
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

    

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto', bgcolor: 'transparent', minHeight: '100vh' }}>
            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

            {/* SECTION 1: Token Management */}
            <Paper sx={{ p: 4, mb: 4, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', overflow: 'hidden' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '-0.5px' }}>Nhóm API token Zalo</Typography>
                    {/* Removed obsolete sync buttons */}
                </Box>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>Tạo nhiều nhóm token để gửi tin theo từng tài khoản bot khác nhau.</Typography>
                
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Mã API token (vd: 18626...:oJU...)" value={newToken.token} onChange={e => setNewToken({...newToken, token: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Tên nhóm token (vd: Nhóm Q12)" value={newToken.group_name} onChange={e => setNewToken({...newToken, group_name: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="API token Zalo (Tên bot hiển thị)" value={newToken.bot_name} onChange={e => setNewToken({...newToken, bot_name: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth size="small" label="Ghi chú nhóm" value={newToken.notes} onChange={e => setNewToken({...newToken, notes: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 1 }}>
                        <AppButton variant="contained" color="success" onClick={handleAddToken} icon={<AddIcon />} title="Lưu nhóm token" />
                    </Grid>
                </Grid>

                {tokens.map(t => (
                    <Box key={t.id} sx={{ display: 'inline-flex', alignItems: 'center', bgcolor: 'rgba(255, 255, 255, 0.05)', p: 1, borderRadius: 1, mr: 2, mb: 1, gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-primary)', mr: 1 }}>
                            {t.token.substring(0, 15)}... - {t.group_name} - {t.bot_name}
                        </Typography>
                    {/* Removed Get Chat ID button */}
                        <AppButton 
                            variant="outlined" 
                            color="secondary" 
                            size="small" 
                            onClick={() => handleRegisterWebhook(t)} 
                            disabled={loadingSync === t.id + '_webhook'}
                            icon={loadingSync === t.id + '_webhook' ? <CircularProgress size={16} /> : <SyncIcon fontSize="small" />}
                            title="Đăng ký Webhook"
                            sx={{ minWidth: 34, width: 34, height: 34 }}
                        />
                        <IconButton size="small" color="error" onClick={() => handleDeleteToken(t.id)} sx={{ p: 0.5 }}><DeleteIcon fontSize="small" /></IconButton>
                    </Box>
                ))}
            </Paper>

            {/* SECTION 2: Contact Management */}
            <Paper id="contact-form-section" sx={{ p: 4, mb: 4, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', overflow: 'hidden' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: 'var(--brand-primary)', letterSpacing: '-0.5px' }}>Thông báo Zalo</Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>Thêm liên hệ nhận tin qua Zalo Bot.</Typography>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Autocomplete
                            options={hrProfiles}
                            getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                            value={hrProfiles.find(p => p.id === newContact.employee_id) || null}
                            onChange={(_, newVal) => {
                                if (newVal) {
                                    setNewContact(prev => ({
                                        ...prev,
                                        employee_id: newVal.id,
                                        receiver_name: newVal.full_name,
                                        phone: newVal.phone_number || ''
                                    }));
                                } else {
                                    setNewContact(prev => ({
                                        ...prev,
                                        employee_id: '',
                                        receiver_name: '',
                                        phone: ''
                                    }));
                                }
                            }}
                            renderInput={(params) => (
                                <TextField 
                                    {...params} 
                                    label="Chọn nhanh từ nhân sự" 
                                    size="small" 
                                    placeholder="Tìm theo tên hoặc mã nhân viên..."
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 2 }}><TextField fullWidth size="small" label="Mã nhân viên" value={newContact.employee_id} onChange={e => setNewContact({...newContact, employee_id: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Tên người nhận" value={newContact.receiver_name} onChange={e => setNewContact({...newContact, receiver_name: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Điện thoại" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} /></Grid>
                    
                    <Grid size={{ xs: 12, md: 3 }}><TextField fullWidth size="small" label="Zalo user_id" value={newContact.zalo_user_id} onChange={e => setNewContact({...newContact, zalo_user_id: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 3 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Chọn nhóm token</InputLabel>
                            <Select label="Chọn nhóm token" value={newContact.bot_api_token} onChange={e => setNewContact({...newContact, bot_api_token: e.target.value})}>
                                {tokens.map(t => <MenuItem key={t.id} value={t.token}>{t.group_name} ({t.bot_name})</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}><TextField fullWidth size="small" label="Ghi chú" value={newContact.notes} onChange={e => setNewContact({...newContact, notes: e.target.value})} /></Grid>
                    <Grid size={{ xs: 12, md: 2 }} display="flex" gap={1}>
                        <AppButton variant="contained" color={newContact.id ? "warning" : "success"} onClick={handleSaveContact} icon={newContact.id ? <EditIcon /> : <AddIcon />} title={newContact.id ? "Lưu liên hệ" : "Thêm liên hệ"} />
                        {newContact.id && (
                            <AppButton variant="outlined" color="inherit" onClick={() => setNewContact({ id: '', employee_id: '', receiver_name: '', phone: '', zalo_user_id: '', notes: '', bot_api_token: '' })} icon={<CloseIcon />} title="Hủy" />
                        )}
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <AppButton variant="outlined" component="label" icon={importing ? <CircularProgress size={16}/> : <UploadFileIcon />} disabled={importing} title="Nhập Excel danh bạ">
                        <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImportExcel} />
                    </AppButton>
                    <AppButton variant="outlined" icon={<DownloadIcon />} onClick={handleExportExcel} title="Xuất danh bạ Excel" />
                    <AppButton variant="outlined" icon={<DescriptionIcon />} onClick={handleDownloadTemplate} title="Tải mẫu Excel import" />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, mt: 3 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={filterToken} onChange={e => setFilterToken(e.target.value)}>
                            <MenuItem value="all">Tất cả nhóm token</MenuItem>
                            {tokens.map(t => <MenuItem key={t.id} value={t.token}>{t.group_name} ({t.bot_name})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        Đang hiển thị {filteredContacts.length} liên hệ.
                    </Typography>
                </Box>

                <TableContainer sx={{ maxHeight: 500 }}>
                    <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'var(--border-glass)', py: 1.5 } }}>
                        <TableHead sx={{ '& th': { bgcolor: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-glass)' } }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 80 }}>THAO TÁC</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ NV</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TÊN NGƯỜI NHẬN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ĐIỆN THOẠI</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ZALO USER_ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>NHÓM TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>GHI CHÚ</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TRẠNG THÁI</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredContacts.map(c => (
                                <TableRow key={c.id} hover sx={{ transition: 'background-color 0.2s ease' }}>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <IconButton size="small" color="primary" onClick={() => handleEditContact(c)}><EditIcon fontSize="small"/></IconButton>
                                        <IconButton size="small" color="error" onClick={() => handleDeleteContact(c.id)}><DeleteIcon fontSize="small"/></IconButton>
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
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* SECTION 4: Inbox */}
            <Paper sx={{ p: 4, borderRadius: 3, bgcolor: 'rgba(255, 255, 255, 0.02)', overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--brand-primary)', letterSpacing: '-0.5px' }}>Hộp thư đến (Inbox)</Typography>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>Tin nhắn nhận được từ Zalo Bot trong quá trình đồng bộ.</Typography>
                    </Box>
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExportInbox}>Export Excel</Button>
                </Box>

                <TableContainer sx={{ maxHeight: 400 }}>
                    <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderColor: 'var(--border-glass)', py: 1.5 } }}>
                        <TableHead sx={{ '& th': { bgcolor: 'rgba(255, 255, 255, 0.02)', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--border-glass)' } }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', width: 80 }}>THAO TÁC</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MESSAGE ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>USER_ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TÊN NGƯỜI GỬI</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>NỘI DUNG</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>THỜI GIAN NHẬN</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {inboxMessages.map(msg => (
                                <TableRow key={msg.id} hover sx={{ '&:hover': { bgcolor: '#eff6ff' }, transition: 'background-color 0.2s ease' }}>
                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                        <IconButton size="small" color="primary" title="Sửa tin nhắn" onClick={() => handleEditInboxMessage(msg)}><EditIcon fontSize="small"/></IconButton>
                                        <IconButton size="small" color="success" title="Tạo liên hệ" onClick={() => handleAddContactFromInbox(msg)}><AddIcon fontSize="small"/></IconButton>
                                        <IconButton size="small" color="error" title="Xóa tin nhắn" onClick={() => handleDeleteInboxMessage(msg.id)}><DeleteIcon fontSize="small"/></IconButton>
                                    </TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{msg.zalo_user_id}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{msg.message_id}</TableCell>
                                    <TableCell sx={{ fontWeight: 500 }}>{msg.sender_name}</TableCell>
                                    <TableCell>{msg.message_content}</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{msg.bot_token.substring(0,25)}...</TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem' }}>{new Date(msg.created_at).toLocaleString('vi-VN')}</TableCell>
                                </TableRow>
                            ))}
                            {inboxMessages.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'var(--text-secondary)' }}>Chưa có tin nhắn nào</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default ZaloBotManager;
