import React, { useEffect, useState } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, IconButton,
    Chip, Toolbar
} from '@mui/material';
import { Add as AddIcon, Print as PrintIcon, Visibility as ViewIcon, Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../config/supabase';
import dayjs from 'dayjs';
import { exportStandardReport } from '../../../utils/excelUtils';

interface WarrantyRecord {
    id: string;
    form_code: string;
    created_at: string;
    department: string;
    form_type: string;
    requester_id?: string;
}

const KCSWarrantyList: React.FC = () => {
    const navigate = useNavigate();
    const [records, setRecords] = useState<WarrantyRecord[]>([]);
    const [employeesMap, setEmployeesMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const fetchRecords = async () => {
        setLoading(true);
        try {
            // Lấy danh sách nhân viên trước để map tên
            const { data: empData } = await supabase.from('employees').select('id, full_name');
            const empMap: Record<string, string> = {};
            if (empData) {
                empData.forEach((emp: any) => {
                    empMap[emp.id] = emp.full_name;
                });
            }
            setEmployeesMap(empMap);

            const { data, error } = await supabase
                .from('warranty_history')
                .select('id, form_code, created_at, department, form_type, requester_id')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching warranty history:', error);
            } else {
                setRecords(data || []);
            }
        } catch (err) {
            console.error('Exception fetching warranty history:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecords();
    }, []);

    const handleDelete = async (id: string) => {
        if (!window.confirm("Bạn có chắc chắn muốn xóa phiếu này không? Dữ liệu không thể khôi phục.")) return;
        
        try {
            const { error } = await supabase.from('warranty_history').delete().eq('id', id);
            if (error) {
                console.error("Lỗi khi xóa phiếu:", error);
                alert("Không thể xóa phiếu: " + error.message);
            } else {
                setRecords(records.filter(r => r.id !== id));
            }
        } catch (err) {
            console.error("Exception deleting record:", err);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'YEU_CAU_KCS': return 'Yêu cầu KCS';
            case 'KIEM_TRA_KCS': return 'Kiểm tra đánh giá';
            case 'BAN_GIAO_BH': return 'Bàn giao bảo hành';
            default: return type;
        }
    };

    const handleExportExcel = async () => {
        if (records.length === 0) {
            alert('Không có dữ liệu để xuất!');
            return;
        }
        
        const cols = [
            { header: 'STT', key: 'stt', width: 8 },
            { header: 'Mã phiếu', key: 'form_code', width: 25 },
            { header: 'Ngày yêu cầu', key: 'created_at', width: 20 },
            { header: 'Bộ phận', key: 'department', width: 30 },
            { header: 'Người yêu cầu', key: 'requester_name', width: 25 },
            { header: 'Loại phiếu', key: 'form_type_label', width: 25 }
        ];

        const dataToExport = records.map((r, idx) => ({
            stt: idx + 1,
            form_code: r.form_code,
            created_at: dayjs(r.created_at).format('DD/MM/YYYY HH:mm'),
            department: r.department,
            requester_name: r.requester_id ? employeesMap[r.requester_id] || '' : '',
            form_type_label: getTypeLabel(r.form_type)
        }));

        try {
            await exportStandardReport(
                dataToExport,
                `Lich_su_KCS_Bao_hanh_${dayjs().format('YYYYMMDDHHmm')}`,
                'LỊCH SỬ KCS & BẢO HÀNH THIẾT BỊ',
                cols
            );
        } catch (err: any) {
            console.error(err);
            alert('Lỗi xuất Excel: ' + err.message);
        }
    };

    return (
        <Box>
            <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 }, justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" id="tableTitle" component="div" fontWeight="bold">
                    Lịch sử KCS & Bảo hành thiết bị
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        color="success"
                        startIcon={<DownloadIcon />}
                        onClick={handleExportExcel}
                        sx={{ borderRadius: '8px' }}
                    >
                        Xuất Excel
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => navigate('/assets/kcs-warranty/new')}
                        sx={{ borderRadius: '8px' }}
                    >
                        Tạo phiếu mới
                    </Button>
                </Box>
            </Toolbar>

            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: '12px', border: '1px solid rgba(0,0,0,0.1)' }}>
                <Table sx={{ minWidth: 650 }}>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <TableRow>
                            <TableCell><b>Mã phiếu</b></TableCell>
                            <TableCell><b>Ngày yêu cầu</b></TableCell>
                            <TableCell><b>Bộ phận</b></TableCell>
                            <TableCell><b>Người yêu cầu</b></TableCell>
                            <TableCell><b>Loại phiếu</b></TableCell>
                            <TableCell align="center"><b>Thao tác</b></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>Đang tải dữ liệu...</TableCell>
                            </TableRow>
                        ) : records.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>Chưa có dữ liệu</TableCell>
                            </TableRow>
                        ) : (
                            records.map((row) => (
                                <TableRow key={row.id} hover>
                                    <TableCell>{row.form_code}</TableCell>
                                    <TableCell>{dayjs(row.created_at).format('DD/MM/YYYY')}</TableCell>
                                    <TableCell>{row.department}</TableCell>
                                    <TableCell>{row.requester_id ? employeesMap[row.requester_id] || '' : ''}</TableCell>
                                    <TableCell>
                                        <Chip label={getTypeLabel(row.form_type)} size="small" color="primary" variant="outlined" />
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton color="info" onClick={() => navigate(`/assets/kcs-warranty/new?print=${row.id}`)} title="In phiếu">
                                            <PrintIcon />
                                        </IconButton>
                                        <IconButton color="error" onClick={() => handleDelete(row.id)} title="Xóa phiếu">
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default KCSWarrantyList;
