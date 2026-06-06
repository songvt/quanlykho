import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
    Box, Paper, Typography, Button, Grid, TextField, Dialog, DialogTitle, DialogContent,
    DialogActions, Alert, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, MenuItem, Select, FormControl, InputLabel, IconButton, InputAdornment, Tooltip, Zoom, Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import { exportStandardReport } from '../../utils/excelUtils';

// Redux Actions
import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';

// Interfaces
interface LeaveHandoverRow {
    task: string;
    target: string;
    recipientName: string;
}

interface LeaveRequest {
    id: string;
    requestDate: string;
    
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    employeeJob: string;
    employeeUnit: string;
    employeePhone: string;
    
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    totalDays: number;
    
    leaveType: 'compensatory' | 'annual' | 'other';
    customLeaveType: string;
    reason: string;
    location: string;
    
    handovers: LeaveHandoverRow[];
    
    status: 'draft' | 'approved';
    createdAt: string;
}

const timesTheme = createTheme({
    typography: {
        fontFamily: "'Times New Roman', Times, serif",
        allVariants: {
            fontFamily: "'Times New Roman', Times, serif",
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                    textTransform: 'none',
                    fontWeight: 'bold',
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
    },
});

const calculateLeaveDays = (startDate: string, startTime: string, endDate: string, endTime: string): number => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) return 0;
    
    // Calculate difference in calendar days
    const diffTime = end.getTime() - start.getTime();
    const calendarDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (calendarDays === 0) {
        // Same day
        const [sh, sm] = startTime.split(':').map(Number);
        const [eh, em] = endTime.split(':').map(Number);
        const startInMinutes = sh * 60 + sm;
        const endInMinutes = eh * 60 + em;
        const durationHours = (endInMinutes - startInMinutes) / 60;
        
        if (durationHours <= 0) return 0;
        if (durationHours <= 4.5) return 0.5;
        return 1.0;
    } else {
        // Different days
        let days = calendarDays + 1; // e.g. Monday to Tuesday is 2 days
        
        const [sh] = startTime.split(':').map(Number);
        const [eh] = endTime.split(':').map(Number);
        
        // If starts in the afternoon (>= 12:00), deduct 0.5 day
        if (sh >= 12) {
            days -= 0.5;
        }
        // If ends in the morning (<= 13:00), deduct 0.5 day
        if (eh <= 13) {
            days -= 0.5;
        }
        
        return Math.max(0.5, days);
    }
};

const DEFAULT_HANDOVER_TASKS = [
    "Quản lý nhập xuất kho hàng hóa theo quy trình quy định.",
    "Quản lý số lượng, chất lượng hàng hoá trong kho đảm bảo an toàn",
    "Quản lý xuất nhập kho cho nhân viên, hàng thu hồi chuyển đổi, hàng mới hỏng,….. theo đúng quy trình quy định",
    "Nhận hàng từ kho tổng ACT/kho Viettel HCM về kho, cấp phát cho lực lượng kỹ thuật đảm bảo công việc.",
    "Xử lý các công việc phát sinh liên quan (Nếu có)."
];

const getDefaultHandovers = () => DEFAULT_HANDOVER_TASKS.map(task => ({
    task,
    target: '100%',
    recipientName: ''
}));

const AdminRequests = () => {
    const dispatch = useDispatch<AppDispatch>();
    
    // Selectors
    const { items: hrProfiles, status: hrProfilesStatus } = useSelector((state: RootState) => state.hrProfiles);
    const { items: employees, status: employeesStatus } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);

    // Load personnel list
    useEffect(() => {
        if (hrProfilesStatus === 'idle') {
            dispatch(fetchHRProfiles());
        }
        if (employeesStatus === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [dispatch, hrProfilesStatus, employeesStatus]);

    const activeProfilesList = useMemo(() => {
        return hrProfiles.length > 0 ? hrProfiles : employees;
    }, [hrProfiles, employees]);

    // Local State
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
    const [isLeavePreviewOpen, setIsLeavePreviewOpen] = useState(false);
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
    const [leaveFormMode, setLeaveFormMode] = useState<'create' | 'edit'>('create');
    const [leaveFormData, setLeaveFormData] = useState({
        id: '',
        requestDate: new Date().toISOString().split('T')[0],
        employeeId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endDate: new Date().toISOString().split('T')[0],
        endTime: '17:30',
        totalDays: 1,
        leaveType: 'annual' as 'compensatory' | 'annual' | 'other',
        customLeaveType: '',
        reason: 'Nghỉ giải quyết việc gia đình',
        location: 'Thành phố Hồ Chí Minh',
        handovers: getDefaultHandovers()
    });

    // Load existing requests from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('qlkho_kpi_leave_requests');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setLeaveRequests(parsed);
                }
            } catch (e) {
                console.error("Failed to parse saved leave requests", e);
            }
        }
    }, []);

    // Reactive auto-calculation for total days off
    useEffect(() => {
        if (!isLeaveFormOpen) return;
        const calculated = calculateLeaveDays(
            leaveFormData.startDate,
            leaveFormData.startTime,
            leaveFormData.endDate,
            leaveFormData.endTime
        );
        setLeaveFormData(prev => {
            if (prev.totalDays === calculated) return prev;
            return { ...prev, totalDays: calculated };
        });
    }, [leaveFormData.startDate, leaveFormData.startTime, leaveFormData.endDate, leaveFormData.endTime, isLeaveFormOpen]);

    // Handle change in handover row fields
    const handleHandoverChange = (index: number, field: keyof LeaveHandoverRow, value: string) => {
        setLeaveFormData(prev => {
            const handovers = [...prev.handovers];
            handovers[index] = { ...handovers[index], [field]: value };
            return { ...prev, handovers };
        });
    };

    const handleOpenLeaveForm = (req?: LeaveRequest) => {
        if (req) {
            setLeaveFormMode('edit');
            setLeaveFormData({
                id: req.id,
                requestDate: req.requestDate,
                employeeId: req.employeeId,
                startDate: req.startDate,
                startTime: req.startTime,
                endDate: req.endDate,
                endTime: req.endTime,
                totalDays: req.totalDays,
                leaveType: req.leaveType,
                customLeaveType: req.customLeaveType || '',
                reason: req.reason,
                location: req.location,
                handovers: req.handovers.length >= 5 ? req.handovers : [
                    ...req.handovers,
                    ...Array.from({ length: 5 - req.handovers.length }, () => ({ task: '', target: '', recipientName: '' }))
                ]
            });
        } else {
            setLeaveFormMode('create');
            let defaultEmpId = '';
            if (profile) {
                const matched = activeProfilesList.find(p => p.full_name.toLowerCase() === profile.full_name.toLowerCase());
                if (matched) defaultEmpId = matched.id;
            }
            if (!defaultEmpId && activeProfilesList.length > 0) defaultEmpId = activeProfilesList[0].id;

            setLeaveFormData({
                id: '',
                requestDate: new Date().toISOString().split('T')[0],
                employeeId: defaultEmpId,
                startDate: new Date().toISOString().split('T')[0],
                startTime: '08:00',
                endDate: new Date().toISOString().split('T')[0],
                endTime: '17:30',
                totalDays: 1,
                leaveType: 'annual',
                customLeaveType: '',
                reason: 'Nghỉ giải quyết việc gia đình',
                location: 'Thành phố Hồ Chí Minh',
                handovers: getDefaultHandovers()
            });
        }
        setIsLeaveFormOpen(true);
    };

    const handleSaveLeaveRequest = () => {
        const emp = activeProfilesList.find(p => p.id === leaveFormData.employeeId);
        if (!emp) {
            setNotification({ type: 'error', message: 'Vui lòng chọn nhân viên làm đơn!' });
            return;
        }

        const payload: LeaveRequest = {
            id: leaveFormMode === 'create' ? `LR-${Date.now()}` : leaveFormData.id,
            requestDate: leaveFormData.requestDate,
            
            employeeId: emp.id,
            employeeName: emp.full_name,
            employeeCode: emp.id,
            employeeJob: emp.job_position || 'Nhân viên',
            employeeUnit: emp.department || 'Bộ phận Kỹ thuật - Hạ tầng Bắc Sài Gòn',
            employeePhone: emp.phone_number || '',
            
            startDate: leaveFormData.startDate,
            startTime: leaveFormData.startTime,
            endDate: leaveFormData.endDate,
            endTime: leaveFormData.endTime,
            totalDays: Number(leaveFormData.totalDays) || 0,
            
            leaveType: leaveFormData.leaveType,
            customLeaveType: leaveFormData.customLeaveType,
            reason: leaveFormData.reason,
            location: leaveFormData.location,
            
            handovers: leaveFormData.handovers.filter(h => h.task.trim() !== '' || h.target.trim() !== ''),
            
            status: 'approved',
            createdAt: leaveFormMode === 'create' ? new Date().toISOString() : leaveRequests.find(r => r.id === leaveFormData.id)?.createdAt || new Date().toISOString()
        };

        let updated: LeaveRequest[];
        if (leaveFormMode === 'create') {
            updated = [payload, ...leaveRequests];
            setNotification({ type: 'success', message: 'Tạo đơn xin nghỉ mới thành công!' });
        } else {
            updated = leaveRequests.map(r => r.id === leaveFormData.id ? payload : r);
            setNotification({ type: 'success', message: 'Cập nhật đơn xin nghỉ thành công!' });
        }

        setLeaveRequests(updated);
        localStorage.setItem('qlkho_kpi_leave_requests', JSON.stringify(updated));
        setIsLeaveFormOpen(false);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleDeleteLeaveRequest = (id: string, name: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa đơn xin nghỉ của nhân viên "${name}"?`)) {
            const updated = leaveRequests.filter(r => r.id !== id);
            setLeaveRequests(updated);
            localStorage.setItem('qlkho_kpi_leave_requests', JSON.stringify(updated));
            setNotification({ type: 'success', message: 'Đã xóa đơn xin nghỉ!' });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const handlePrintLeaveRequest = (req: LeaveRequest) => {
        setSelectedLeaveRequest(req);
        setIsLeavePreviewOpen(true);
    };

    const triggerBrowserPrint = () => {
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handleExportLeaveExcel = async () => {
        if (leaveRequests.length === 0) {
            setNotification({ type: 'error', message: 'Không có dữ liệu đơn xin nghỉ để xuất Excel!' });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        const excelData = leaveRequests.map((r, index) => ({
            stt: index + 1,
            requestDate: new Date(r.requestDate).toLocaleDateString('vi-VN'),
            employeeCode: r.employeeCode,
            employeeName: r.employeeName,
            employeeUnit: r.employeeUnit,
            period: `${r.startTime} ${new Date(r.startDate).toLocaleDateString('vi-VN')} - ${r.endTime} ${new Date(r.endDate).toLocaleDateString('vi-VN')}`,
            totalDays: r.totalDays,
            reason: r.reason,
            status: 'Đã duyệt'
        }));

        const columns = [
            { header: 'STT', key: 'stt', width: 8, align: 'center' as const },
            { header: 'Ngày lập', key: 'requestDate', width: 15, align: 'center' as const },
            { header: 'Mã NV', key: 'employeeCode', width: 15, align: 'center' as const },
            { header: 'Họ tên nhân viên', key: 'employeeName', width: 25 },
            { header: 'Đơn vị công tác', key: 'employeeUnit', width: 35 },
            { header: 'Thời gian xin nghỉ', key: 'period', width: 35, align: 'center' as const },
            { header: 'Số ngày', key: 'totalDays', width: 12, align: 'center' as const },
            { header: 'Lý do xin nghỉ', key: 'reason', width: 35 },
            { header: 'Trạng thái', key: 'status', width: 15, align: 'center' as const }
        ];

        try {
            await exportStandardReport(
                excelData,
                `Danh_Sach_Xin_Nghi_Phep_${new Date().toISOString().split('T')[0]}`,
                'DANH SÁCH ĐƠN XIN NGHỈ PHÉP NHÂN SỰ',
                columns,
                profile?.full_name || 'Quản trị viên'
            );
            setNotification({ type: 'success', message: 'Xuất file Excel danh sách xin nghỉ phép thành công!' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            console.error('Failed to export leave Excel', error);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xuất file Excel!' });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    // Memos
    const filteredLeaveRequests = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return leaveRequests.filter(r => {
            return r.employeeName.toLowerCase().includes(term) ||
                   r.employeeCode.toLowerCase().includes(term) ||
                   r.reason.toLowerCase().includes(term);
        });
    }, [leaveRequests, searchTerm]);

    const totalLeaveDaysThisMonth = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return leaveRequests
            .filter(r => {
                const d = new Date(r.requestDate);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.totalDays, 0);
    }, [leaveRequests]);

    const totalLeaveRequestsThisMonth = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return leaveRequests.filter(r => {
            const d = new Date(r.requestDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
    }, [leaveRequests]);

    return (
        <ThemeProvider theme={timesTheme}>
            <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '1200px', mx: 'auto', width: '100%', fontFamily: "'Times New Roman', Times, serif" }}>
                {notification && (
                    <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2, borderRadius: 2 }}>
                        {notification.message}
                    </Alert>
                )}

                {/* Page Banner Header */}
                <Paper 
                    elevation={0}
                    sx={{
                        p: { xs: 2.5, sm: 4 },
                        mb: 3.5,
                        borderRadius: '24px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        boxShadow: '0 12px 24px -10px rgba(5, 150, 105, 0.3)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    <Box 
                        sx={{
                            position: 'absolute',
                            right: '-50px',
                            top: '-50px',
                            width: '200px',
                            height: '200px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.08)',
                            zIndex: 0
                        }}
                    />
                    <Stack direction="row" alignItems="center" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
                        <AssignmentTurnedInIcon sx={{ fontSize: 32, color: '#ffffff' }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 850, letterSpacing: '-0.5px', color: '#ffffff', fontFamily: "'Times New Roman', Times, serif" }}>
                                Phiếu Hành Chính Nhân Sự
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#f1f5f9', fontWeight: 500, mt: 0.5, fontFamily: "'Times New Roman', Times, serif" }}>
                                Quản lý và lập Đơn xin nghỉ phép, nghỉ bù cho cán bộ nhân viên trong đơn vị.
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>

                {/* Metric Summary Cards */}
                <Grid container spacing={3} mb={4}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper sx={{ 
                            p: 2.5, 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0', 
                            borderLeft: '5px solid #10b981', 
                            boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.08)',
                            bgcolor: '#ffffff'
                        }}>
                            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>Tổng số đơn trong tháng</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 850, mt: 0.5, color: '#0f172a', fontFamily: "'Times New Roman', Times, serif" }}>{totalLeaveRequestsThisMonth}</Typography>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Paper sx={{ 
                            p: 2.5, 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0', 
                            borderLeft: '5px solid #3b82f6', 
                            boxShadow: '0 4px 20px -2px rgba(59, 130, 246, 0.08)',
                            bgcolor: '#ffffff'
                        }}>
                            <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>Tổng số ngày nghỉ trong tháng</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 850, mt: 0.5, color: '#2563eb', fontFamily: "'Times New Roman', Times, serif" }}>{totalLeaveDaysThisMonth} ngày</Typography>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Toolbar */}
                <Paper 
                    elevation={0} 
                    sx={{ 
                        p: 2.5, 
                        mb: 3, 
                        borderRadius: '16px', 
                        border: '1px solid rgba(226, 232, 240, 0.8)', 
                        bgcolor: '#ffffff',
                    }}
                >
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems="center">
                        <TextField
                            size="small"
                            placeholder="Tìm kiếm theo tên nhân viên, mã NV, lý do..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                                sx: { borderRadius: '10px', bgcolor: '#f8fafc' }
                            }}
                            sx={{ minWidth: 280, width: { xs: '100%', md: 'auto' } }}
                        />
                        
                        <Stack direction="row" spacing={1.5} width={{ xs: '100%', sm: 'auto' }} justifyContent="flex-end" alignItems="center">
                            <Button
                                variant="outlined"
                                color="success"
                                startIcon={<FileDownloadIcon />}
                                onClick={handleExportLeaveExcel}
                                sx={{ borderRadius: '10px', px: 3, height: 40, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                            >
                                Xuất Excel
                            </Button>

                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenLeaveForm()}
                                sx={{ borderRadius: '10px', px: 3, height: 40, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                            >
                                Lập Đơn Mới
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>

                {/* Table View */}
                <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 800, py: 2, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Ngày lập</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Mã NV</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Họ tên nhân viên</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Đơn vị công tác</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Thời gian xin nghỉ</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Số ngày nghỉ</TableCell>
                                <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Lý do</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', pr: 3, fontFamily: "'Times New Roman', Times, serif" }}>Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredLeaveRequests.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                                        Chưa có đơn xin nghỉ phép nào được tạo.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredLeaveRequests.map((req) => (
                                    <TableRow key={req.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                        <TableCell sx={{ py: 1.5 }}>{new Date(req.requestDate).toLocaleDateString('vi-VN')}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>{req.employeeCode}</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>{req.employeeName}</TableCell>
                                        <TableCell>{req.employeeUnit}</TableCell>
                                        <TableCell sx={{ fontWeight: 500 }}>
                                            {req.startTime} {new Date(req.startDate).toLocaleDateString('vi-VN')} - {req.endTime} {new Date(req.endDate).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, color: '#2563eb' }}>{req.totalDays} ngày</TableCell>
                                        <TableCell>{req.reason}</TableCell>
                                        <TableCell align="right" sx={{ pr: 2 }}>
                                            <Tooltip title="Xem & In Đơn Xin Nghỉ (A4)" TransitionComponent={Zoom}>
                                                <IconButton size="small" color="primary" onClick={() => handlePrintLeaveRequest(req)} sx={{ mr: 0.5 }}>
                                                    <PrintIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Chỉnh sửa">
                                                <IconButton size="small" color="info" onClick={() => handleOpenLeaveForm(req)} sx={{ mr: 0.5 }}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Xóa">
                                                <IconButton size="small" color="error" onClick={() => handleDeleteLeaveRequest(req.id, req.employeeName)}>
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* ── FORM DIALOG: CREATE/EDIT LEAVE REQUEST ───────────────────────────── */}
                <Dialog 
                    open={isLeaveFormOpen} 
                    onClose={() => setIsLeaveFormOpen(false)}
                    maxWidth="lg"
                    fullWidth
                    PaperProps={{
                        sx: { borderRadius: '16px', p: 1.5 }
                    }}
                >
                    <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssignmentIcon sx={{ color: '#10b981' }} />
                            {leaveFormMode === 'create' ? 'Lập Đơn Xin Nghỉ Mới' : 'Chỉnh Sửa Đơn Xin Nghỉ'}
                        </Typography>
                        <IconButton onClick={() => setIsLeaveFormOpen(false)}><CloseIcon /></IconButton>
                    </DialogTitle>
                    
                    <DialogContent dividers sx={{ bgcolor: '#f8fafc', p: 3.5 }}>
                        <Stack spacing={3.5}>
                            {/* Section A: Personnel */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Thông tin nhân sự làm đơn
                                </Typography>
                                <Grid container spacing={2.5}>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <Autocomplete
                                            options={activeProfilesList as any[]}
                                            getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                                            value={(activeProfilesList as any[]).find(p => p.id === leaveFormData.employeeId) || null}
                                            onChange={(_, newValue) => {
                                                setLeaveFormData(prev => ({ ...prev, employeeId: newValue ? newValue.id : '' }));
                                            }}
                                            renderInput={(params) => (
                                                <TextField 
                                                    {...params} 
                                                    label="Nhân viên làm đơn" 
                                                    fullWidth 
                                                />
                                            )}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            label="Ngày làm đơn"
                                            type="date"
                                            fullWidth
                                            value={leaveFormData.requestDate}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, requestDate: e.target.value }))}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Section B: Leave Details */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Thông tin xin nghỉ phép
                                </Typography>
                                <Grid container spacing={2.5}>
                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            label="Từ ngày"
                                            type="date"
                                            fullWidth
                                            value={leaveFormData.startDate}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            label="Giờ bắt đầu"
                                            type="time"
                                            fullWidth
                                            value={leaveFormData.startTime}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            label="Đến ngày"
                                            type="date"
                                            fullWidth
                                            value={leaveFormData.endDate}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, endDate: e.target.value }))}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            label="Giờ kết thúc"
                                            type="time"
                                            fullWidth
                                            value={leaveFormData.endTime}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 12, sm: 3 }}>
                                        <TextField
                                            label="Tổng số ngày nghỉ"
                                            type="number"
                                            fullWidth
                                            inputProps={{ min: 0.1, step: 0.1 }}
                                            value={leaveFormData.totalDays}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, totalDays: Number(e.target.value) || 0 }))}
                                            helperText="Tự động tính từ thời gian nghỉ"
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Loại nghỉ</InputLabel>
                                            <Select
                                                value={leaveFormData.leaveType}
                                                label="Loại nghỉ"
                                                onChange={(e) => setLeaveFormData(prev => ({ ...prev, leaveType: e.target.value as any }))}
                                            >
                                                <MenuItem value="compensatory">Nghỉ Bù</MenuItem>
                                                <MenuItem value="annual">Nghỉ phép</MenuItem>
                                                <MenuItem value="other">Loại khác (Tự nhập)</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    {leaveFormData.leaveType === 'other' && (
                                        <Grid size={{ xs: 12, sm: 5 }}>
                                            <TextField
                                                label="Loại nghỉ khác"
                                                fullWidth
                                                placeholder="Nhập loại nghỉ..."
                                                value={leaveFormData.customLeaveType}
                                                onChange={(e) => setLeaveFormData(prev => ({ ...prev, customLeaveType: e.target.value }))}
                                            />
                                        </Grid>
                                    )}

                                    <Grid size={{ xs: 12, sm: leaveFormData.leaveType === 'other' ? 12 : 5 }}>
                                        <TextField
                                            label="Nơi nghỉ"
                                            fullWidth
                                            placeholder="Địa chỉ nơi nghỉ phép..."
                                            value={leaveFormData.location}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, location: e.target.value }))}
                                        />
                                    </Grid>

                                    <Grid size={{ xs: 12 }}>
                                        <TextField
                                            label="Lý do xin nghỉ"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            placeholder="Nhập lý do cụ thể xin nghỉ..."
                                            value={leaveFormData.reason}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, reason: e.target.value }))}
                                        />
                                    </Grid>
                                </Grid>
                            </Paper>

                            {/* Section C: Handovers Table */}
                            <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Bàn giao công việc (Tối đa 5 công việc)
                                </Typography>
                                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                                <TableCell align="center" sx={{ fontWeight: 'bold', width: 60 }}>STT</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>CÔNG VIỆC</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>MỤC TIÊU / KẾT QUẢ</TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>NGƯỜI NHẬN BÀN GIAO</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {leaveFormData.handovers.map((row, index) => (
                                                <TableRow key={index}>
                                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{index + 1}</TableCell>
                                                    <TableCell sx={{ py: 1 }}>
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Nhập nội dung công việc..."
                                                            value={row.task}
                                                            onChange={(e) => handleHandoverChange(index, 'task', e.target.value)}
                                                            InputProps={{ sx: { borderRadius: '6px' } }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ py: 1 }}>
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Nhập mục tiêu/kết quả cần đạt..."
                                                            value={row.target}
                                                            onChange={(e) => handleHandoverChange(index, 'target', e.target.value)}
                                                            InputProps={{ sx: { borderRadius: '6px' } }}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ py: 1 }}>
                                                        <Autocomplete
                                                            size="small"
                                                            options={activeProfilesList as any[]}
                                                            getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                                                            value={(activeProfilesList as any[]).find(p => p.full_name === row.recipientName) || null}
                                                            onChange={(_, newValue) => {
                                                                handleHandoverChange(index, 'recipientName', newValue ? newValue.full_name : '');
                                                            }}
                                                            renderInput={(params) => (
                                                                <TextField 
                                                                    {...params} 
                                                                    placeholder="Chọn người nhận..." 
                                                                    variant="outlined" 
                                                                    fullWidth
                                                                    InputProps={{
                                                                        ...params.InputProps,
                                                                        sx: { borderRadius: '6px' }
                                                                    }}
                                                                />
                                                            )}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Stack>
                    </DialogContent>
                    
                    <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                        <Button onClick={() => setIsLeaveFormOpen(false)} variant="outlined" sx={{ borderRadius: '10px', height: 42, px: 3 }}>Hủy Bỏ</Button>
                        <Button onClick={handleSaveLeaveRequest} variant="contained" color="success" sx={{ borderRadius: '10px', px: 4, height: 42, fontWeight: 'bold' }}>
                            Lưu Đơn Xin Nghỉ
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* ── LEAVE PREVIEW & PRINT DIALOG ────────────────────────────────────── */}
                <Dialog
                    open={isLeavePreviewOpen}
                    onClose={() => setIsLeavePreviewOpen(false)}
                    maxWidth="md"
                    fullWidth
                    PaperProps={{
                        sx: { borderRadius: '12px', bgcolor: '#f8fafc', p: 0 }
                    }}
                >
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'white', borderBottom: '1px solid #e2e8f0', py: 1.5 }}>
                        <Typography sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                            Xem Trước & In Đơn Xin Nghỉ Phép
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PrintIcon />}
                                onClick={triggerBrowserPrint}
                                sx={{ borderRadius: '8px', textTransform: 'none' }}
                            >
                                In Đơn Xin Nghỉ (A4)
                            </Button>
                            <IconButton onClick={() => setIsLeavePreviewOpen(false)} size="small"><CloseIcon /></IconButton>
                        </Stack>
                    </DialogTitle>

                    <DialogContent sx={{ p: { xs: 1, sm: 4 }, display: 'flex', justifyContent: 'center' }}>
                        {selectedLeaveRequest && <PrintableLeaveRequestTemplate leaveRequest={selectedLeaveRequest} />}
                    </DialogContent>
                </Dialog>

                {/* Portal Printable */}
                {selectedLeaveRequest && createPortal(
                    <div id="print-portal-root">
                        <PrintableLeaveRequestTemplate leaveRequest={selectedLeaveRequest} />
                    </div>,
                    document.body
                )}

                <style>
                    {`
                        @media print {
                            body > * {
                                display: none !important;
                            }
                            body > #print-portal-root {
                                display: block !important;
                                position: absolute;
                                top: 0;
                                left: 0;
                                width: 100%;
                                height: 100%;
                                z-index: 999999;
                                background: white;
                                padding: 0px !important;
                                margin: 0px !important;
                            }
                            @page {
                                size: A4 portrait;
                                margin: 15mm 12mm 15mm 15mm;
                            }
                        }
                        #print-portal-root {
                            display: none;
                        }
                    `}
                </style>
            </Box>
        </ThemeProvider>
    );
};

// ── PRINTABLE COMPONENT: LEAVE REQUEST A4 STYLE ────────────────────────────
const PrintableLeaveRequestTemplate = ({ leaveRequest }: { leaveRequest: any }) => {
    const reqDateObj = new Date(leaveRequest.requestDate);
    const startDateObj = new Date(leaveRequest.startDate);
    const endDateObj = new Date(leaveRequest.endDate);
    
    // Parse hours and minutes
    const [startHour, startMin] = leaveRequest.startTime.split(':');
    const [endHour, endMin] = leaveRequest.endTime.split(':');

    // Ensure handovers has exactly 5 rows
    const fullHandovers = useMemo(() => {
        const rows = [...leaveRequest.handovers];
        while (rows.length < 5) {
            rows.push({ task: '', target: '', recipientName: '' });
        }
        return rows;
    }, [leaveRequest.handovers]);

    // Find unique recipient name(s) for signature
    const uniqueRecipients = useMemo(() => {
        if (!leaveRequest.handovers || !Array.isArray(leaveRequest.handovers)) return [];
        const names = leaveRequest.handovers
            .map((h: any) => h.recipientName?.trim())
            .filter((name: string) => name && name !== '');
        return Array.from(new Set(names)) as string[];
    }, [leaveRequest.handovers]);

    return (
        <Box
            sx={{
                width: '100%',
                maxWidth: '794px', // Standard A4 width at 96 DPI
                minHeight: '1050px',
                p: '40px 48px',
                bgcolor: 'white',
                color: '#000000',
                fontFamily: "'Times New Roman', Times, serif",
                boxSizing: 'border-box',
                '@media print': {
                    p: '0px',
                    maxWidth: '100%',
                    minHeight: 'auto',
                }
            }}
        >
            {/* Header section with ACT company and Country credentials */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                <Box sx={{ width: '45%', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        CÔNG TY CP VIỄN THÔNG ACT
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', fontFamily: "'Times New Roman', Times, serif", textDecoration: 'underline', lineHeight: 1.2 }}>
                        TRUNG TÂM ACT KV BSG
                    </Typography>
                </Box>
                <Box sx={{ width: '55%', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", textDecoration: 'underline', lineHeight: 1.2 }}>
                        Độc lập – Tự do – Hạnh phúc
                    </Typography>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '10.5pt', mt: 1, fontFamily: "'Times New Roman', Times, serif", textAlign: 'right', pr: 2 }}>
                        Tp Hồ Chí Minh, ngày {String(reqDateObj.getDate()).padStart(2, '0')} tháng {String(reqDateObj.getMonth() + 1).padStart(2, '0')} năm {reqDateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            {/* Document Title */}
            <Box sx={{ textAlign: 'center', my: 4 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '15pt', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>
                    ĐƠN XIN NGHỈ
                </Typography>
            </Box>

            {/* Content Body */}
            <Stack spacing={2.5} sx={{ mb: 4, fontSize: '11.5pt', lineHeight: 1.6 }}>
                
                {/* SECTION I */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        I. Thông tin nhân viên:
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1.5, width: '100%' }}>
                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Tôi tên là:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px', 
                                fontWeight: 'bold', 
                                textTransform: 'uppercase',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeName || '\u00A0'}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Mã nhân viên:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                width: '160px', 
                                paddingLeft: '8px', 
                                fontWeight: 'bold',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeCode || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Vị trí công việc:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeJob || '\u00A0'}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Đơn vị công tác:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                width: '220px', 
                                paddingLeft: '8px', 
                                color: '#ef4444', // Highlight unit text as in the original image (red color TTKV Bắc Sài Gòn)
                                fontWeight: 'bold',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeUnit || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Số điện thoại liên hệ:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeePhone || '\u00A0'}
                            </span>
                        </Box>
                    </Box>
                </Box>

                {/* SECTION II */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        II. Nội dung:
                    </Typography>

                    <Stack spacing={1.5} sx={{ width: '100%' }}>
                        <Box>
                            <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>Thời gian xin nghỉ:</span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Từ ngày (giờ):</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
                                {startDateObj.toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>Giờ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {startHour || '00'}
                            </span>
                            <span style={{ paddingLeft: '4px', paddingRight: '4px', color: '#ef4444', fontWeight: 'bold' }}>:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {startMin || '00'}
                            </span>
                            
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Đến ngày (giờ):</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
                                {endDateObj.toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>Giờ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {endHour || '00'}
                            </span>
                            <span style={{ paddingLeft: '4px', paddingRight: '4px', color: '#ef4444', fontWeight: 'bold' }}>:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {endMin || '00'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Số ngày nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '80px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {leaveRequest.totalDays}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>ngày</span>
                            <span style={{ flexGrow: 1 }} />
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', mt: 1, gap: 3 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Loại nghỉ:</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span style={{ fontSize: '14pt', lineHeight: 1 }}>{leaveRequest.leaveType === 'compensatory' ? '☑' : '☐'}</span>
                                <span>Nghỉ Bù;</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span style={{ fontSize: '14pt', lineHeight: 1 }}>{leaveRequest.leaveType === 'annual' ? '☑' : '☐'}</span>
                                <span>Nghỉ phép;</span>
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                                <span style={{ fontSize: '14pt', lineHeight: 1 }}>{leaveRequest.leaveType === 'other' ? '☑' : '☐'}</span>
                                <span style={{ whiteSpace: 'nowrap' }}>Khác:</span>
                                <span style={{ 
                                    borderBottom: '1px dotted #000', 
                                    flexGrow: 1, 
                                    paddingLeft: '8px',
                                    fontWeight: leaveRequest.leaveType === 'other' ? 'bold' : 'normal'
                                }}>
                                    {leaveRequest.leaveType === 'other' ? leaveRequest.customLeaveType : '\u00A0'}
                                </span>
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Lý do xin nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', flexGrow: 1, paddingLeft: '8px' }}>
                                {leaveRequest.reason || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Nơi nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', flexGrow: 1, paddingLeft: '8px' }}>
                                {leaveRequest.location || '\u00A0'}
                            </span>
                        </Box>
                    </Stack>
                </Box>

                {/* HANDOVER DETAILS */}
                <Box sx={{ mt: 2 }}>
                    <Typography sx={{ fontStyle: 'italic', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        Trong thời gian nghỉ, tôi đã bàn giao công việc như sau:
                    </Typography>
                    
                    <TableContainer component={Box} sx={{ border: '1px solid #000000', borderRadius: '0px', overflow: 'hidden' }}>
                        <Table size="small" sx={{ 
                            '& td, & th': { 
                                border: '1px solid #000000', 
                                color: '#000000',
                                p: '6px 8px',
                                fontSize: '10pt',
                                fontFamily: "'Times New Roman', Times, serif",
                            } 
                        }}>
                            <TableHead sx={{ bgcolor: 'transparent' }}>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '5%', py: 1 }}>STT</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '40%' }}>CÔNG VIỆC</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '30%' }}>MỤC TIÊU/KẾT QUẢ</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '25%' }}>NGƯỜI NHẬN BÀN GIAO</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {fullHandovers.map((row, index) => (
                                    <TableRow key={index} sx={{ height: '32px' }}>
                                        <TableCell align="center">{index + 1}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.task}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.target}</TableCell>
                                        <TableCell align="center">{row.recipientName}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Stack>

            {/* Under Table Promises */}
            <Stack spacing={1} sx={{ mt: 3, fontSize: '11.5pt', lineHeight: 1.5, pl: 2 }}>
                <Typography sx={{ textIndent: '20px', textAlign: 'justify', fontFamily: "'Times New Roman', Times, serif" }}>
                    Tôi cam kết sẽ trở lại làm việc tại Công ty sau khi hết thời gian xin nghỉ nêu trên, nếu không tôi xin hoàn toàn chịu trách nhiệm.
                </Typography>
                <Typography sx={{ textIndent: '20px', fontFamily: "'Times New Roman', Times, serif" }}>
                    Kính mong Trưởng đơn vị xem xét và chấp thuận.
                </Typography>
                <Typography sx={{ textIndent: '20px', fontStyle: 'italic', fontFamily: "'Times New Roman', Times, serif" }}>
                    Trân trọng cảm ơn!
                </Typography>
            </Stack>

            {/* Bottom Signatures Layout matching image */}
            <Box sx={{ mt: 4, '@media print': { mt: 3 } }}>
                {/* Director Title Centered */}
                <Box sx={{ textAlign: 'center', width: '100%', mb: 12 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11.5pt', fontFamily: "'Times New Roman', Times, serif" }}>
                        BAN GIÁM ĐỐC TRUNG TÂM
                    </Typography>
                </Box>

                {/* Sub signatures spaced apart */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", mb: 8 }}>
                            NGƯỜI LÀM ĐƠN
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {leaveRequest.employeeName}
                        </Typography>
                    </Box>
                    {uniqueRecipients.length === 0 ? (
                        <Box sx={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
                            <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", mb: 8 }}>
                                NGƯỜI NHẬN BÀN GIAO
                            </Typography>
                            <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                                &nbsp;
                            </Typography>
                        </Box>
                    ) : (
                        uniqueRecipients.map((recipient: string, idx: number) => (
                            <Box key={idx} sx={{ textAlign: 'center', flex: 1, minWidth: '120px' }}>
                                <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", mb: 8 }}>
                                    NGƯỜI NHẬN BÀN GIAO
                                </Typography>
                                <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                                    {recipient}
                                </Typography>
                            </Box>
                        ))
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default AdminRequests;
