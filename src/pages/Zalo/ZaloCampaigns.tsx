import React, { useState, useEffect } from 'react';
import { Box, Typography, Paper, TextField, Button, Grid, MenuItem, CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, FormControl, Select, Checkbox } from '@mui/material';
import { Send, Add, UploadFile, Description } from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';
import { supabase } from '../../config/supabase';
import * as ExcelJS from 'exceljs';

const API_CAMPAIGNS = '/api/zalo?action=campaigns';
const API_TEMPLATES = '/api/zalo?action=templates';

interface Campaign {
    id: string;
    name: string;
    total_recipients: number;
    status: string;
    created_at: string;
    zalo_templates: {
        template_name: string;
    };
}

const ZaloCampaigns: React.FC = () => {
    const { notify, success, warning, error: notifyError } = useNotification();

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingZns, setSendingZns] = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        name: '',
        template_id: '',
        phones: '',
        params_json: '{}'
    });

    // Bulk Send States
    const [tokens, setTokens] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [filterToken, setFilterToken] = useState('all');
    const [filterNote, setFilterNote] = useState('all');
    const [messageContent, setMessageContent] = useState('');
    const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
    const [sendingBulk, setSendingBulk] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [campRes, tempRes, tokensRes, contactsRes] = await Promise.all([
                fetch(API_CAMPAIGNS),
                fetch(API_TEMPLATES),
                supabase.from('zalo_bot_tokens').select('*').order('created_at', { ascending: false }),
                supabase.from('zalo_personal_contacts').select('*').order('created_at', { ascending: false })
            ]);
            
            if (campRes.ok) {
                const campJson = await campRes.json();
                if (campJson.success) setCampaigns(campJson.data);
            }
            if (tempRes.ok) {
                const tempJson = await tempRes.json();
                if (tempJson.success) setTemplates(tempJson.data.filter((t: any) => t.is_active));
            }
            
            if (!tokensRes.error) setTokens(tokensRes.data || []);
            if (!contactsRes.error) setContacts(contactsRes.data || []);
            
        } catch (error) {
            notifyError('Lỗi khi tải dữ liệu');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateZns = async () => {
        if (!form.name || !form.template_id || !form.phones) {
            return warning('Vui lòng điền đủ thông tin');
        }
        const phoneList = form.phones.split(/[\n,]+/).map(p => p.trim()).filter(p => p);
        if (phoneList.length === 0) return warning('Không có số điện thoại hợp lệ');

        let template_data = {};
        try {
            template_data = JSON.parse(form.params_json);
        } catch {
            return notifyError('JSON tham số không hợp lệ');
        }

        setSendingZns(true);
        try {
            const res = await fetch(API_CAMPAIGNS, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, template_id: form.template_id, recipients: phoneList.map(phone => ({ phone })), template_data })
            });
            const json = await res.json();
            if (json.success) {
                success('Đã tạo chiến dịch gửi ZNS');
                setShowForm(false);
                setForm({ name: '', template_id: '', phones: '', params_json: '{}' });
                fetchData();
            } else {
                notifyError(json.error || 'Lỗi tạo chiến dịch');
            }
        } catch (error) {
            notifyError('Lỗi kết nối máy chủ');
        } finally {
            setSendingZns(false);
        }
    };

    const filteredContacts = contacts.filter(c => {
        const matchToken = filterToken === 'all' || c.bot_api_token === filterToken;
        const matchNote = filterNote === 'all' || (c.notes && c.notes === filterNote);
        return matchToken && matchNote;
    });

    const uniqueNotes = Array.from(new Set(contacts.map(c => c.notes).filter(Boolean)));

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) setSelectedContacts(filteredContacts.map(c => c.id));
        else setSelectedContacts([]);
    };

    const handleSelectOne = (id: string) => {
        setSelectedContacts(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const setSending = setSendingBulk;
    const setError = notifyError;
    const setSuccess = success;
    
const handleSendBulkBot = async () => {
        if (selectedContacts.length === 0) return setError('Chưa chọn người nhận');
        if (!messageContent.trim()) return setError('Chưa nhập nội dung tin nhắn');
        
        setSending(true);

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

const handleImportSendExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSending(true);

        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const worksheet = workbook.worksheets[0];
            
            let headerRowIndex = 1;
            const headers: string[] = [];
            
            // Tìm dòng tiêu đề (có chứa cột nội dung hoặc zalo_user_id)
            for (let i = 1; i <= 10; i++) {
                const row = worksheet.getRow(i);
                let hasHeader = false;
                row.eachCell((cell) => {
                    const val = cell.value?.toString().toLowerCase() || '';
                    if (val.includes('nội dung') || val.includes('zalo') || val.includes('mã nhân viên')) {
                        hasHeader = true;
                    }
                });
                if (hasHeader) {
                    headerRowIndex = i;
                    row.eachCell((cell, colNumber) => {
                        headers[colNumber] = cell.value?.toString().trim() || '';
                    });
                    break;
                }
            }

            const zaloIdIdx = headers.findIndex(h => h.toLowerCase().includes('zalo'));
            const phoneIdx = headers.findIndex(h => h.toLowerCase().includes('điện thoại') || h.toLowerCase().includes('phone'));
            const empIdIdx = headers.findIndex(h => h.toLowerCase().includes('mã nv') || h.toLowerCase().includes('mã nhân viên'));
            const messageIdx = headers.findIndex(h => h.toLowerCase().includes('nội dung') || h.toLowerCase().includes('tin nhắn'));

            if (messageIdx === -1) {
                throw new Error("File Excel phải có cột chứa chữ 'Nội dung' hoặc 'Tin nhắn'");
            }
            if (zaloIdIdx === -1 && phoneIdx === -1 && empIdIdx === -1) {
                throw new Error("File Excel phải có cột Zalo_user_id, Điện thoại, hoặc Mã nhân viên để ghép nối");
            }

            const customMessages: Record<string, string> = {};
            const matchedIds: string[] = [];

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= headerRowIndex) return;
                const zaloId = zaloIdIdx > -1 ? row.getCell(zaloIdIdx).value?.toString() : null;
                const phone = phoneIdx > -1 ? row.getCell(phoneIdx).value?.toString() : null;
                const empId = empIdIdx > -1 ? row.getCell(empIdIdx).value?.toString() : null;
                const msg = row.getCell(messageIdx).value?.toString();

                if (!msg) return;

                const matchedContact = filteredContacts.find(c => 
                    (zaloId && c.zalo_user_id === zaloId) ||
                    (phone && c.phone === phone) ||
                    (empId && c.employee_id === empId)
                );

                if (matchedContact) {
                    customMessages[matchedContact.id] = msg;
                    if (!matchedIds.includes(matchedContact.id)) {
                        matchedIds.push(matchedContact.id);
                    }
                }
            });

            if (matchedIds.length === 0) {
                throw new Error("Không tìm thấy liên hệ nào khớp với dữ liệu trong file Excel. Vui lòng kiểm tra lại ID/SĐT.");
            }

            if (window.confirm(`Tìm thấy ${matchedIds.length} liên hệ khớp với file Excel. Bạn có chắc chắn muốn gửi ${matchedIds.length} tin nhắn với nội dung tùy chỉnh này không?`)) {
                setSelectedContacts(matchedIds);
                
                const res = await fetch('/api/zalo?action=send_personal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        contact_ids: matchedIds, 
                        message: '', 
                        custom_messages: customMessages
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Lỗi gửi tin');
                
                setSuccess(`Đã gửi thành công ${data.successCount}, thất bại ${data.failCount}`);
                fetchData();
                setSelectedContacts([]);
            }
        } catch (err: any) {
            setError(err.message || 'Lỗi import Excel');
        } finally {
            setSending(false);
            if (e.target) e.target.value = ''; 
        }
    };

const handleDownloadSendTemplate = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Gửi Tin Zalo');
            worksheet.columns = [
                { key: 'employee_id', width: 15 },
                { key: 'receiver_name', width: 25 },
                { key: 'phone', width: 15 },
                { key: 'zalo_user_id', width: 25 },
                { key: 'message', width: 50 },
            ];
            
            // Row 1: Title
            const titleRow = worksheet.addRow(['MẪU GỬI TIN ZALO HÀNG LOẠT']);
            worksheet.mergeCells('A1:E1');
            titleRow.getCell(1).font = { size: 16, bold: true };
            titleRow.getCell(1).alignment = { horizontal: 'center' };

            // Row 2: Campaign
            worksheet.addRow(['Chiến dịch: Tất cả']);

            // Row 3: Date
            const now = new Date();
            worksheet.addRow([`Ngày xuất báo cáo: ${now.toLocaleTimeString('vi-VN')} ${now.toLocaleDateString('vi-VN')}`]);

            // Row 4: Headers
            const headerRow = worksheet.addRow(['Mã nhân viên', 'Tên người nhận', 'Điện thoại', 'Zalo user_id', 'Nội dung']);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } }; // Teal green
            });

            // Populate some data from contacts
            const topContacts = contacts.slice(0, 10);
            if (topContacts.length > 0) {
                topContacts.forEach(c => {
                    worksheet.addRow([c.employee_id, c.receiver_name, c.phone, c.zalo_user_id, '']);
                });
            } else {
                worksheet.addRow(['332377', 'Cao Bá Thuận', '', '3fdc585be01709495006', '']);
            }
            
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'Mau_Import_Gui_Tin_Zalo.xlsx';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: 'auto', bgcolor: '#f8fafc', minHeight: '100vh' }}>
            <Typography variant="h4" sx={{ fontWeight: 800, background: 'linear-gradient(90deg, #2563eb, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', mb: 1, letterSpacing: '-1px' }}>Chiến dịch Zalo</Typography>
            <Typography variant="body2" color="text.secondary" mb={3}>Quản lý các đợt gửi tin nhắn hàng loạt qua Zalo.</Typography>

            <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>Gửi tin nhắn qua Bot cá nhân</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" startIcon={<Description />} onClick={handleDownloadSendTemplate}>Mẫu gửi Excel</Button>
                        <Button variant="outlined" color="primary" component="label" disabled={sendingBulk} startIcon={sendingBulk ? <CircularProgress size={16} color="inherit"/> : <UploadFile />}>
                            Import Gửi Bằng Excel
                            <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={handleImportSendExcel} />
                        </Button>
                        <Button variant="contained" color="success" onClick={handleSendBulkBot} disabled={sendingBulk || selectedContacts.length === 0} startIcon={sendingBulk ? <CircularProgress size={16} color="inherit"/> : <Send />} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, boxShadow: '0 4px 14px 0 rgba(16, 185, 129, 0.39)', background: 'linear-gradient(90deg, #10b981, #059669)', '&:hover': { boxShadow: '0 6px 20px rgba(16, 185, 129, 0.23)' } }}>
                            Gửi đã chọn ({selectedContacts.length})
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={filterToken} onChange={e => setFilterToken(e.target.value)}>
                            <MenuItem value="all">Tất cả nhóm token</MenuItem>
                            {tokens.map(t => <MenuItem key={t.id} value={t.token}>{t.group_name} ({t.bot_name})</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <Select value={filterNote} onChange={e => setFilterNote(e.target.value)} displayEmpty>
                            <MenuItem value="all">Tất cả nhóm (Ghi chú)</MenuItem>
                            {uniqueNotes.map(n => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Typography variant="body2" sx={{ color: '#6b7280' }}>
                        Đang hiển thị {filteredContacts.length} người nhận, đã chọn {selectedContacts.length}.
                    </Typography>
                </Box>

                <TextField fullWidth multiline rows={4} placeholder="Nhập nội dung tin nhắn cần gửi..." value={messageContent} onChange={e => setMessageContent(e.target.value)} sx={{ mb: 3, bgcolor: '#fff' }} />

                <TableContainer component={Paper} sx={{ maxHeight: 500, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                    <Table stickyHeader size="small" sx={{ '& .MuiTableCell-root': { borderColor: '#f1f5f9', py: 1.5 } }}>
                        <TableHead sx={{ '& th': { bgcolor: '#eff6ff', color: '#1e40af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #e2e8f0' } }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox checked={filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length} indeterminate={selectedContacts.length > 0 && selectedContacts.length < filteredContacts.length} onChange={handleSelectAll} />
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ NV</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TÊN NGƯỜI NHẬN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>ZALO USER_ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>MÃ TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>NHÓM TOKEN</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem' }}>TRẠNG THÁI</TableCell>
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
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.zalo_user_id.substring(0,10)}...</TableCell>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{c.bot_api_token.substring(0,10)}...</TableCell>
                                    <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>{tokens.find(t => t.token === c.bot_api_token)?.group_name || c.bot_name}</Typography></TableCell>
                                    <TableCell><Chip label={c.status} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }}/></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        </Box>
        </Box>
    );
};

export default ZaloCampaigns;
