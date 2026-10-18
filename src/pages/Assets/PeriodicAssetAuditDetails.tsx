import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { useNotification } from '../../contexts/NotificationContext';
import { exportPeriodicAssetAuditReport } from '../../utils/excelUtils';

const PeriodicAssetAuditDetails = () => {
    const { error } = useNotification();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    useEffect(() => { fetch('/api/periodic_asset_audits').then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); setRecords(data); }).catch(e => error(e.message || 'Không thể tải dữ liệu kiểm kê.')).finally(() => setLoading(false)); }, [error]);
    const filtered = useMemo(() => records.filter(r => `${r.asset_code} ${r.asset_name} ${r.checked_by || ''}`.toLocaleLowerCase('vi').includes(keyword.toLocaleLowerCase('vi').trim())), [records, keyword]);
    return <Box p={{ xs: 1, sm: 3 }}>
        <Typography variant="h4" fontWeight={900} color="primary">CHI TIẾT KIỂM KÊ TÀI SẢN</Typography>
        <Typography color="text.secondary" mb={2}>Lịch sử các lần quét và xác nhận kiểm kê định kỳ.</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} mb={2}>
            <TextField size="small" fullWidth sx={{ maxWidth: 440 }} label="Tìm mã, tên tài sản hoặc người kiểm kê" value={keyword} onChange={e => setKeyword(e.target.value)} />
            <Button variant="contained" startIcon={<FileDownloadIcon />} disabled={!filtered.length} onClick={() => exportPeriodicAssetAuditReport(filtered)}>Xuất Excel</Button>
        </Stack>
        <TableContainer component={Paper} sx={{ borderRadius: 3 }}><Table size="small">
            <TableHead><TableRow><TableCell><b>THỜI GIAN</b></TableCell><TableCell><b>MÃ TÀI SẢN</b></TableCell><TableCell><b>TÊN TÀI SẢN</b></TableCell><TableCell><b>NGƯỜI SỬ DỤNG</b></TableCell><TableCell><b>NGƯỜI QUẢN LÝ</b></TableCell><TableCell><b>NGƯỜI KIỂM KÊ</b></TableCell><TableCell><b>GHI CHÚ</b></TableCell></TableRow></TableHead>
            <TableBody>{loading ? <TableRow><TableCell colSpan={7} align="center"><CircularProgress size={24} /></TableCell></TableRow> : filtered.length ? filtered.map(record => <TableRow key={record.id}><TableCell>{new Date(record.checked_at).toLocaleString('vi-VN')}</TableCell><TableCell>{record.asset_code}</TableCell><TableCell>{record.asset_name}</TableCell><TableCell>{record.user_employee_name || '-'}</TableCell><TableCell>{record.manager_name || '-'}</TableCell><TableCell>{record.checked_by || '-'}</TableCell><TableCell>{record.notes || '-'}</TableCell></TableRow>) : <TableRow><TableCell colSpan={7} align="center">Chưa có dữ liệu kiểm kê.</TableCell></TableRow>}</TableBody>
        </Table></TableContainer>
    </Box>;
};
export default PeriodicAssetAuditDetails;
