import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
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
} from '@mui/material';
import {
    UploadFile as UploadFileIcon,
    Refresh as RefreshIcon,
    DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import * as ExcelJS from 'exceljs';
import { supabase } from '../../config/supabase';

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
    created_at: string;
}

const ZaloPersonalContacts: React.FC = () => {
    const [contacts, setContacts] = useState<ZaloContact[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const fetchContacts = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('zalo_personal_contacts')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setContacts(data || []);
        } catch (err: any) {
            console.error('Lỗi khi tải danh bạ:', err);
            setError(err.message || 'Lỗi khi tải dữ liệu từ database');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContacts();
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        setError(null);
        setSuccess(null);

        try {
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            const worksheet = workbook.worksheets[0]; // Get the first sheet
            if (!worksheet) throw new Error('File không chứa sheet nào.');

            const parsedData: any[] = [];
            let headerRowIndex = 1; // Assume header is on row 1

            // Map standard column names to object keys
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
            worksheet.getRow(headerRowIndex).eachCell((cell, colNumber) => {
                headers[colNumber] = cell.text.trim();
            });

            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber === headerRowIndex) return; // Skip header

                const record: any = {};
                let hasData = false;
                row.eachCell((cell, colNumber) => {
                    const headerName = headers[colNumber];
                    if (headerName && colMap[headerName]) {
                        record[colMap[headerName]] = cell.text?.trim() || '';
                        hasData = true;
                    }
                });

                if (hasData && record.employee_id && record.zalo_user_id) {
                    parsedData.push(record);
                }
            });

            if (parsedData.length === 0) {
                throw new Error('Không tìm thấy dữ liệu hợp lệ. Đảm bảo các cột: Mã nhân viên, Tên người nhận, Zalo_user_id, Mã API token có tồn tại.');
            }

            // Send to backend via Supabase UPSERT
            const { error: upsertError } = await supabase
                .from('zalo_personal_contacts')
                .upsert(parsedData, { onConflict: 'employee_id,bot_api_token' });

            if (upsertError) throw upsertError;

            setSuccess(`Đã import thành công ${parsedData.length} liên hệ.`);
            fetchContacts();

        } catch (err: any) {
            console.error('Lỗi khi import:', err);
            setError(err.message || 'Lỗi xử lý file Excel');
        } finally {
            setImporting(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc muốn xóa liên hệ này?')) return;
        try {
            const { error: delError } = await supabase.from('zalo_personal_contacts').delete().eq('id', id);
            if (delError) throw delError;
            setSuccess('Đã xóa thành công.');
            fetchContacts();
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Danh bạ Zalo Bot Cá Nhân
                </Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchContacts}
                        disabled={loading}
                    >
                        Làm mới
                    </Button>
                    <Button
                        variant="contained"
                        component="label"
                        startIcon={importing ? <CircularProgress size={20} color="inherit" /> : <UploadFileIcon />}
                        disabled={importing}
                        sx={{ bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}
                    >
                        {importing ? 'Đang import...' : 'Import Excel'}
                        <input
                            type="file"
                            hidden
                            accept=".xlsx,.xls,.csv"
                            onChange={handleFileUpload}
                        />
                    </Button>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

            <Paper sx={{ width: '100%', overflow: 'hidden', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <TableContainer sx={{ maxHeight: 'calc(100vh - 250px)' }}>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Mã NV</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Tên người nhận</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Điện thoại</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Zalo User ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Tên Bot</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc' }}>Trạng thái</TableCell>
                                <TableCell sx={{ fontWeight: 600, bgcolor: '#f8fafc', width: 80 }} align="center">Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                        <CircularProgress size={30} />
                                        <Typography sx={{ mt: 2, color: '#64748b' }}>Đang tải danh bạ...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : contacts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                                        <Typography sx={{ color: '#64748b' }}>Chưa có danh bạ nào. Vui lòng import từ file Excel.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                contacts.map((contact) => (
                                    <TableRow key={contact.id} hover>
                                        <TableCell>{contact.employee_id}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>{contact.receiver_name}</TableCell>
                                        <TableCell>{contact.phone}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: '#64748b' }}>
                                                {contact.zalo_user_id.substring(0, 8)}...
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{contact.bot_name}</TableCell>
                                        <TableCell>
                                            <Chip 
                                                label={contact.status || 'Active'} 
                                                size="small" 
                                                color={contact.status?.includes('ngừng') ? 'default' : 'success'} 
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(contact.id)}>
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
};

export default ZaloPersonalContacts;
