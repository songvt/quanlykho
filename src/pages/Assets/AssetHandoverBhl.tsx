import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, TextField, Grid, Stack, Divider,
    Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Autocomplete, IconButton, Card, CardContent, InputAdornment, useTheme, useMediaQuery, Tooltip
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { fetchAssets } from '../../store/slices/assetsSlice';
import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import { useNotification } from '../../contexts/NotificationContext';
import type { RootState, AppDispatch } from '../../store';
import type { Asset, HRProfile } from '../../types';
import { formatPhone } from '../../utils/format';
import { exportHandoverHistory } from '../../utils/excelUtils';

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

const AssetHandoverBhl: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
    const dispatch = useDispatch<AppDispatch>();
    const { success, error } = useNotification();
    const printRef = useRef<HTMLDivElement>(null);

    // Redux State
    const { items: assets, status: assetStatus } = useSelector((state: RootState) => state.assets);
    const { items: hrProfiles, status: hrProfilesStatus } = useSelector((state: RootState) => state.hrProfiles);

    // Form Configurations
    const [selectedEmployee, setSelectedEmployee] = useState<HRProfile | null>(null);
    const [templateType, setTemplateType] = useState<'default' | 'bhl'>('bhl');
    const [actionType, setActionType] = useState<'allocate' | 'revoke' | 'transfer'>('allocate');

    // Receiver Information
    const [receiverName, setReceiverName] = useState('');
    const [receiverTitle, setReceiverTitle] = useState('');
    const [receiverDept, setReceiverDept] = useState('');

    // Giver Information
    const [giverInfo, setGiverInfo] = useState({
        giverName: 'NGUYỄN HẢI SƠN',
        giverTitle: 'GĐ TTKV BSG',
        giverPhone: '0988855186',
        giverName2: 'VÕ THANH SONG',
        giverTitle2: 'NV QLTS-KHO',
        giverPhone2: '0988229082',
    });

    // 6 Safety Protective Equipment (CCDC-BHLĐ) Items State
    const [bhlItems, setBhlItems] = useState<BhlItem[]>([
        { stt: 1, name: 'Dây đai bảo hiểm', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Dây đai 1 móc', serial: '', note: '' },
        { stt: 2, name: 'Dây đai bảo hiểm (2 móc)', unit: 'Chiếc', contract: '0', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Bổ sung cho lực lượng trạm viễn thông thực hiện công việc trên cao.', serial: '', note: '' },
        { stt: 3, name: 'Mũ cứng bảo hộ', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Màu Trắng, có khả năng chống nóng, cách điện, tăng tính an toàn, thấm hút mồ hôi, chịu va đập cực tốt', serial: '', note: '' },
        { stt: 4, name: 'Quần áo bảo hộ lao động', unit: 'Bộ', contract: '≥ 1', quota: '3 Bộ/1 NV', quantity: 1, spec: 'Đồng phục công ty ACT', serial: '', note: '' },
        { stt: 5, name: 'Áo bảo hộ mùa đông', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
        { stt: 6, name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 1, spec: 'Giày bảo hộ chống đinh, chống va đập', serial: '', note: '' },
    ]);

    // History logs State
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await fetch('/api/asset_handovers');
            if (res.ok) {
                const data = await res.json();
                setHistory(data || []);
            }
        } catch (err) {
            console.error('Lỗi lấy lịch sử:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDeleteHistory = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử bàn giao này không?')) return;
        try {
            const res = await fetch('/api/asset_handovers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                success('Đã xóa lịch sử thành công.');
                setHistory(prev => prev.filter(h => h.id !== id));
            } else {
                error('Xóa lịch sử thất bại.');
            }
        } catch (err: any) {
            error('Lỗi khi xóa: ' + err.message);
        }
    };

    const handleExportHistory = async () => {
        try {
            await exportHandoverHistory(history, `Lich_Su_Ban_Giao_CCDC_BHLD`);
            success('Xuất file Excel lịch sử thành công.');
        } catch (err: any) {
            error('Lỗi khi xuất Excel: ' + err.message);
        }
    };

    const handleReprint = (h: any) => {
        setTemplateType(h.template_type);
        setActionType(h.action_type);
        setReceiverName(h.receiver_name);
        setReceiverTitle(h.receiver_title || '');
        setReceiverDept(h.receiver_dept || '');
        setGiverInfo(h.giver_info);
        
        if (h.template_type === 'bhl') {
            const defaultBhl = [
                { stt: 1, name: 'Dây đai bảo hiểm', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Dây đai 1 móc', serial: '', note: '' },
                { stt: 2, name: 'Dây đai bảo hiểm (2 móc)', unit: 'Chiếc', contract: '0', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Bổ sung cho lực lượng trạm viễn thông thực hiện công việc trên cao.', serial: '', note: '' },
                { stt: 3, name: 'Mũ cứng bảo hộ', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Màu Trắng, có khả năng chống nóng, cách điện, tăng tính an toàn, thấm hút mồ hôi, chịu va đập cực tốt', serial: '', note: '' },
                { stt: 4, name: 'Quần áo bảo hộ lao động', unit: 'Bộ', contract: '≥ 1', quota: '3 Bộ/1 NV', quantity: 0, spec: 'Đồng phục công ty ACT', serial: '', note: '' },
                { stt: 5, name: 'Áo bảo hộ mùa đông', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
                { stt: 6, name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 0, spec: 'Giày bảo hộ chống đinh, chống va đập', serial: '', note: '' },
            ];
            const restored = defaultBhl.map(def => {
                const found = h.items.find((item: any) => item.name === def.name);
                if (found) {
                    return { ...def, quantity: found.quantity, serial: found.serial || '', note: found.note || '' };
                }
                return def;
            });
            setBhlItems(restored);
        }
        success('Đã tải lại biên bản lịch sử lên màn hình xem trước.');
    };

    const handleSaveAndPrint = async () => {
        if (!receiverName) {
            error('Vui lòng nhập Họ tên bên nhận trước khi thực hiện!');
            return;
        }

        // Trigger print immediately
        handlePrint();

        try {
            const payload = {
                employee_id: selectedEmployee?.id || null,
                receiver_name: receiverName,
                receiver_title: receiverTitle,
                receiver_dept: receiverDept,
                giver_info: giverInfo,
                template_type: templateType,
                action_type: actionType,
                items: templateType === 'default' ? employeeAssets : activeBhlItems,
                total_quantity: totalQty,
                created_by: giverInfo.giverName2 || 'Hệ thống'
            };
            
            const res = await fetch('/api/asset_handovers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const result = await res.json();
                if (result.success && result.data) {
                    setHistory(prev => [result.data, ...prev]);
                }
            }
        } catch (err) {
            console.error('Lỗi khi tự động lưu lịch sử:', err);
        }
    };

    // Load necessary data
    useEffect(() => {
        if (assetStatus === 'idle') {
            dispatch(fetchAssets());
        }
        if (hrProfilesStatus === 'idle') {
            dispatch(fetchHRProfiles());
        }
    }, [dispatch, assetStatus, hrProfilesStatus]);

    // Handle Employee selection changes
    const handleEmployeeChange = (employee: HRProfile | null) => {
        setSelectedEmployee(employee);
        if (employee) {
            setReceiverName(employee.full_name.toUpperCase());
            setReceiverTitle(employee.job_position || 'Nhân viên kĩ thuật');
            setReceiverDept(employee.department || 'Trung Tâm KV Bắc Sài Gòn');
            
            // Auto lookup department from assigned assets if possible
            const assignedAsset = assets.find(a => 
                (a.user_employee_name || '').toLowerCase() === employee.full_name.toLowerCase()
            );
            if (assignedAsset && assignedAsset.location_name) {
                setReceiverDept(assignedAsset.location_name);
            }
        } else {
            setReceiverName('');
            setReceiverTitle('');
            setReceiverDept('');
        }
    };

    // Filter assets for default template preview
    const employeeAssets = useMemo(() => {
        if (!receiverName) return [];
        return assets.filter(a => 
            (a.user_employee_name || '').toLowerCase() === receiverName.toLowerCase()
        );
    }, [assets, receiverName]);

    // Filter active safety items
    const activeBhlItems = bhlItems.filter(item => item.quantity > 0);
    const qtyLabel = actionType === 'revoke' ? 'SL thu hồi' : actionType === 'transfer' ? 'SL điều chuyển' : 'SL bàn giao';

    const totalQty = templateType === 'default'
        ? employeeAssets.reduce((sum, a) => sum + (a.quantity || 1), 0)
        : activeBhlItems.reduce((sum, item) => sum + item.quantity, 0);

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

    const currentTitle = templateType === 'default' ? titleMapDefault[actionType] : titleMapBhl[actionType];

    const resetBhlItems = () => {
        setBhlItems([
            { stt: 1, name: 'Dây đai bảo hiểm', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Dây đai 1 móc', serial: '', note: '' },
            { stt: 2, name: 'Dây đai bảo hiểm (2 móc)', unit: 'Chiếc', contract: '0', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Bổ sung cho lực lượng trạm viễn thông thực hiện công việc trên cao.', serial: '', note: '' },
            { stt: 3, name: 'Mũ cứng bảo hộ', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 1, spec: 'Màu Trắng, có khả năng chống nóng, cách điện, tăng tính an toàn, thấm hút mồ hôi, chịu va đập cực tốt', serial: '', note: '' },
            { stt: 4, name: 'Quần áo bảo hộ lao động', unit: 'Bộ', contract: '≥ 1', quota: '3 Bộ/1 NV', quantity: 1, spec: 'Đồng phục công ty ACT', serial: '', note: '' },
            { stt: 5, name: 'Áo bảo hộ mùa đông', unit: 'Chiếc', contract: '≥ 1', quota: '1 Chiếc/1 NV', quantity: 0, spec: 'Áo gió', serial: '', note: '' },
            { stt: 6, name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi', contract: '≥ 1', quota: '1 Đôi/1 NV', quantity: 1, spec: 'Giày bảo hộ chống đinh, chống va đập', serial: '', note: '' },
        ]);
        success('Đã đặt lại cấu hình mặc định.');
    };

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;
        const w = window.open('', '_blank', 'width=1000,height=800');
        if (!w) return;
        w.document.write(`
            <html>
            <head>
                <meta charset="utf-8"/>
                <title>In Biên Bản</title>
                <style>
                    @page { size: A4; margin: 10mm 12mm; }
                    * { box-sizing: border-box; }
                    body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #000; margin: 0; padding: 0; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
                    .header-left { width: 55%; display: flex; align-items: center; gap: 10px; }
                    .header-right { width: 45%; text-align: center; }
                    .logo-box { width: 55px; height: 55px; background: #cc0000; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14pt; border-radius: 4px; flex-shrink: 0; }
                    .company-name { font-size: 10.5pt; font-weight: bold; color: #003087; text-align: center; }
                    .company-sub { font-size: 10.5pt; font-weight: bold; color: #003087; text-align: center; }
                    .republic { font-size: 10.5pt; font-weight: bold; text-align: center; }
                    .motto { font-size: 10.5pt; font-weight: bold; text-decoration: underline; text-align: center; }
                    .date-line { text-align: right; font-style: italic; font-size: 10.5pt; margin: 10px 0 6px; }
                    .title { text-align: center; font-size: 16pt; font-weight: bold; color: #000; margin: 14px 0 18px; text-transform: uppercase; }
                    .section-label { font-weight: bold; font-size: 10.5pt; margin: 6px 0 2px; color: #003087; }
                    .person-row { display: flex; font-size: 10.5pt; margin: 3px 0; align-items: center; }
                    .person-label { width: 120px; font-weight: bold; }
                    .person-name { flex: 1; font-weight: bold; text-transform: uppercase; }
                    .person-right { display: flex; flex: 1; align-items: center; }
                    .person-title-label { font-weight: bold; width: 75px; }
                    .person-title-val { flex: 1; }
                    .person-phone { width: 110px; text-align: right; }
                    table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 10pt; }
                    th { background: #f2f2f2; color: #000; border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold; }
                    td { border: 1px solid #888; padding: 4px; vertical-align: middle; }
                    .footer-note { font-style: italic; font-size: 9.5pt; margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
                    .signatures { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; }
                    .sig-block { width: 30%; }
                    .sig-title { font-weight: bold; font-size: 11pt; }
                    .sig-sub { font-style: italic; font-size: 9.5pt; margin-top: 2px; }
                    .sig-space { height: 55px; }
                </style>
            </head>
            <body>
                ${content}
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `);
        w.document.close();
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'transparent', minHeight: 'calc(100vh - 64px)' }}>
            
            {/* Header Area */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        In Biên bản Bàn giao & Thu hồi CCDC
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                        Cấu hình và in trực quan Biên bản CCDC-BHLĐ cho nhân viên kỹ thuật
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<PrintIcon />}
                    onClick={handleSaveAndPrint}
                    size="large"
                    disabled={templateType === 'default' ? employeeAssets.length === 0 : activeBhlItems.length === 0}
                    sx={{
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        boxShadow: '0 4px 12px rgba(37,99,235,0.2)',
                        textTransform: 'none',
                        px: 3,
                        py: 1.2,
                        borderRadius: 2,
                        fontWeight: 700,
                        '&:hover': {
                            background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                        }
                    }}
                >
                    In biên bản A4
                </Button>
            </Box>

            <Grid container spacing={4}>
                
                {/* ── Left Configuration Panel ── */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Stack spacing={3}>
                        
                        {/* 1. Employee and Template Selector Card */}
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                    <AssignmentIndIcon sx={{ color: '#2563eb' }} /> Đối tượng bàn giao
                                </Typography>

                                <Stack spacing={2.5}>
                                    <Autocomplete
                                        options={hrProfiles}
                                        getOptionLabel={(emp) => `${emp.full_name} (${emp.id})`}
                                        value={selectedEmployee}
                                        onChange={(_, newVal) => handleEmployeeChange(newVal)}
                                        loading={hrProfilesStatus === 'loading'}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Chọn Nhân viên kĩ thuật"
                                                placeholder="Gõ tên hoặc mã nhân viên..."
                                                variant="outlined"
                                                size="small"
                                            />
                                        )}
                                    />

                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Họ và Tên Bên Nhận"
                                                fullWidth
                                                size="small"
                                                value={receiverName}
                                                onChange={(e) => setReceiverName(e.target.value.toUpperCase())}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Chức vụ"
                                                fullWidth
                                                size="small"
                                                value={receiverTitle}
                                                onChange={(e) => setReceiverTitle(e.target.value)}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <TextField
                                                label="Đơn vị / Phòng ban"
                                                fullWidth
                                                size="small"
                                                value={receiverDept}
                                                onChange={(e) => setReceiverDept(e.target.value)}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <BusinessIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </Grid>
                                    </Grid>

                                    <Divider />

                                    <FormControl component="fieldset">
                                        <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', mb: 1 }}>LOẠI MẪU BIÊN BẢN</FormLabel>
                                        <RadioGroup row value={templateType} onChange={(e) => setTemplateType(e.target.value as any)}>
                                            <FormControlLabel value="bhl" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Mẫu CCDC-BHLĐ</Typography>} />
                                            <FormControlLabel value="default" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Mẫu mặc định (Asset của NV)</Typography>} />
                                        </RadioGroup>
                                    </FormControl>

                                    <FormControl component="fieldset">
                                        <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', mb: 1 }}>TÁC VỤ IN</FormLabel>
                                        <RadioGroup row value={actionType} onChange={(e) => setActionType(e.target.value as any)}>
                                            <FormControlLabel value="allocate" control={<Radio size="small" color="primary" />} label={<Typography variant="body2">Cấp phát / Bàn giao</Typography>} />
                                            <FormControlLabel value="revoke" control={<Radio size="small" color="error" />} label={<Typography variant="body2">Thu hồi</Typography>} />
                                            <FormControlLabel value="transfer" control={<Radio size="small" color="secondary" />} label={<Typography variant="body2">Điều chuyển</Typography>} />
                                        </RadioGroup>
                                    </FormControl>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* 2. Giver Information */}
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                    <BadgeIcon sx={{ color: '#2563eb' }} /> Thông tin bên giao
                                </Typography>

                                <Stack spacing={2.5}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--text-secondary)', mb: 1 }}>Bên giao 1:</Typography>
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Họ tên" size="small" fullWidth value={giverInfo.giverName} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverName: e.target.value.toUpperCase() }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Chức vụ" size="small" fullWidth value={giverInfo.giverTitle} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverTitle: e.target.value }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Số ĐT" size="small" fullWidth value={giverInfo.giverPhone} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverPhone: e.target.value }))} />
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--text-secondary)', mb: 1 }}>Bên giao 2 (không bắt buộc):</Typography>
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Họ tên" size="small" fullWidth value={giverInfo.giverName2} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverName2: e.target.value.toUpperCase() }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Chức vụ" size="small" fullWidth value={giverInfo.giverTitle2} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverTitle2: e.target.value }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Số ĐT" size="small" fullWidth value={giverInfo.giverPhone2} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverPhone2: e.target.value }))} />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* 3. Items Editor */}
                        {templateType === 'bhl' && (
                            <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                            Danh sách trang thiết bị bảo hộ (CCDC)
                                        </Typography>
                                        <IconButton size="small" onClick={resetBhlItems} color="primary" title="Đặt lại mặc định">
                                            <RotateLeftIcon />
                                        </IconButton>
                                    </Box>

                                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700, width: 140 }}>Tên trang bị</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, width: 70, textAlign: 'center' }}>SL</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Số Serial</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {bhlItems.map((item, idx) => (
                                                    <TableRow key={idx} hover>
                                                        <TableCell sx={{ py: 1, fontWeight: 500, fontSize: '0.8rem' }}>
                                                            {item.name} <Typography variant="caption" sx={{ color: 'text.secondary' }}>({item.unit})</Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                type="number"
                                                                size="small"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].quantity = Math.max(0, parseInt(e.target.value) || 0);
                                                                    setBhlItems(newItems);
                                                                }}
                                                                inputProps={{ min: 0 }}
                                                                sx={{ width: 60, '& .MuiInputBase-input': { py: 0.5, px: 0.5, textAlign: 'center', fontSize: '0.85rem' } }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                size="small"
                                                                placeholder="Serial..."
                                                                value={item.serial}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].serial = e.target.value;
                                                                    setBhlItems(newItems);
                                                                }}
                                                                sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem' } }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                size="small"
                                                                placeholder="Ghi chú..."
                                                                value={item.note}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].note = e.target.value;
                                                                    setBhlItems(newItems);
                                                                }}
                                                                sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem' } }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* 4. Lịch sử bàn giao gần đây */}
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: '#1e293b' }}>
                                        <HistoryIcon sx={{ color: '#2563eb' }} /> Lịch sử bàn giao gần đây
                                    </Typography>
                                    {history.length > 0 && (
                                        <Tooltip title="Xuất Excel" arrow>
                                            <Button
                                                variant="outlined"
                                                onClick={handleExportHistory}
                                                sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '10px', p: 0 }}
                                            >
                                                <FileDownloadIcon sx={{ fontSize: 24 }} />
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>

                                {historyLoading ? (
                                    <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', py: 2 }}>
                                        Đang tải lịch sử...
                                    </Typography>
                                ) : history.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', py: 2, fontStyle: 'italic' }}>
                                        Chưa có lịch sử bàn giao nào được lưu.
                                    </Typography>
                                ) : (
                                    <Stack spacing={1.5} sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                                        {history.map((h) => {
                                            const formattedDate = new Date(h.created_at).toLocaleString('vi-VN', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            });
                                            const actionLabel = h.action_type === 'revoke' ? 'Thu hồi' : h.action_type === 'transfer' ? 'Điều chuyển' : 'Bàn giao';
                                            const actionColor = h.action_type === 'revoke' ? '#ef4444' : h.action_type === 'transfer' ? '#8b5cf6' : '#10b981';
                                            
                                            return (
                                                <Box 
                                                    key={h.id} 
                                                    sx={{ 
                                                        p: 1.5, 
                                                        borderRadius: 2, 
                                                        border: '1px solid #f1f5f9', 
                                                        bgcolor: '#f8fafc',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                                            {h.receiver_name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.2 }}>
                                                            {formattedDate} • {h.template_type === 'bhl' ? 'Mẫu BHLĐ' : 'Mẫu TSCĐ'} ({h.total_quantity} món)
                                                        </Typography>
                                                        <Box sx={{ display: 'inline-block', mt: 0.5, px: 1, py: 0.25, borderRadius: 1, bgcolor: `${actionColor}15`, border: `1px solid ${actionColor}30` }}>
                                                            <Typography variant="caption" sx={{ color: actionColor, fontWeight: 700 }}>
                                                                {actionLabel}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    
                                                    <Stack direction="row" spacing={0.5}>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleReprint(h)} 
                                                            title="Xem lại và in"
                                                            sx={{ color: '#2563eb', '&:hover': { bgcolor: '#2563eb10' } }}
                                                        >
                                                            <VisibilityIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleDeleteHistory(h.id)} 
                                                            title="Xóa lịch sử"
                                                            sx={{ color: '#ef4444', '&:hover': { bgcolor: '#ef444410' } }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                {/* ── Right Live Print Preview ── */}
                <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ 
                        width: '100%',
                        overflowX: 'auto', 
                        display: 'flex', 
                        justifyContent: 'center',
                        p: { xs: 0, lg: 2 },
                        bgcolor: { xs: 'transparent', lg: '#cbd5e1' },
                        borderRadius: 3
                    }}>
                        <Paper 
                            elevation={4} 
                            sx={{ 
                                bgcolor: 'white', 
                                p: '15mm 15mm', 
                                width: '210mm', 
                                minHeight: '297mm', 
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <Box ref={printRef} sx={{ fontFamily: 'Times New Roman', fontSize: '11pt', color: '#000', flexGrow: 1 }}>
                                
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
                                <div style={{ textAlign: 'center', fontSize: '15pt', fontWeight: 'bold', color: '#000', margin: '14px 0 18px', textTransform: 'uppercase', lineHeight: 1.3 }}>
                                    {currentTitle}
                                </div>

                                {/* Giver Info Section */}
                                <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '6px 0 2px' }}>BÊN GIAO :</div>
                                {giverInfo.giverName && (
                                    <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                        <span style={{ flex: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>{giverInfo.giverName}</span>
                                        <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                        <span style={{ flex: 1 }}>{giverInfo.giverTitle}</span>
                                        <span style={{ width: 110, textAlign: 'right' }}>{formatPhone(giverInfo.giverPhone)}</span>
                                    </div>
                                )}
                                {giverInfo.giverName2 && (
                                    <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                        <span style={{ flex: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>{giverInfo.giverName2}</span>
                                        <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                        <span style={{ flex: 1 }}>{giverInfo.giverTitle2}</span>
                                        <span style={{ width: 110, textAlign: 'right' }}>{formatPhone(giverInfo.giverPhone2)}</span>
                                    </div>
                                )}

                                {/* Receiver Info Section */}
                                <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '8px 0 2px' }}>BÊN NHẬN :</div>
                                <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                    <span style={{ flex: 1, fontWeight: 'bold', textTransform: 'uppercase' }}>{receiverName || '........................................................'}</span>
                                    <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                    <span style={{ flex: 1 }}>{receiverTitle || '......................................'}</span>
                                    <span style={{ width: 110, textAlign: 'right' }}></span>
                                </div>
                                <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', width: 120 }}>Đơn vị:</span>
                                    <span style={{ flex: 1 }}>{receiverDept || '........................................................................................................................'}</span>
                                </div>

                                {/* Dynamic Table */}
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
                                            employeeAssets.length > 0 ? (
                                                employeeAssets.map((a, i) => (
                                                    <tr key={i}>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.asset_code}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_name}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.quantity || 1}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_type || ''}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.serial_number || ''}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px' }}></td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} style={{ border: '1px solid #888', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                                        Chưa gán tài sản nào cho nhân viên này trong danh sách.
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
                                                        Không có trang bị bảo hộ nào được chọn (Số lượng &gt; 0).
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

                                {/* Disclaimer Note */}
                                <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
                                    Biên bản lập như nhau và có hiệu lực từ ngày ký, Đ/c kiểm tra trước khi xác nhận tài sản bàn giao ./.
                                </div>

                                {/* Double / Triple Signature Blocks */}
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
                    </Box>
                </Grid>

            </Grid>
        </Box>
    );
};

export default AssetHandoverBhl;
