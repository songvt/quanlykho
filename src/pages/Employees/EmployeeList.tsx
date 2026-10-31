import React, { useState, useEffect, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useDispatch, useSelector } from 'react-redux';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
    Box, Paper, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, FormControl, InputLabel, Select, MenuItem, Stack, Alert, CircularProgress, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox, useTheme, useMediaQuery, Card, CardContent, Divider,
    Grid, Switch, FormControlLabel, Tabs, Tab, Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';

// Redux actions for both tables
import { fetchEmployees, addEmployee, updateEmployee, deleteEmployee, deleteEmployees, importEmployees } from '../../store/slices/employeesSlice';
import { fetchHRProfiles, addHRProfile, updateHRProfile, deleteHRProfile, deleteHRProfiles, importHRProfiles } from '../../store/slices/hrProfilesSlice';

import type { RootState, AppDispatch } from '../../store';
import type { Employee, HRProfile, PermissionCode } from '../../types';
import { generateEmployeeTemplate, readExcelFile, exportStandardReport } from '../../utils/excelUtils';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import PeopleIcon from '@mui/icons-material/People';
import PageHeader from '../../components/Common/PageHeader';
import PermissionDialog from '../../components/PermissionDialog';
import ConfirmDialog from '../../components/Common/ConfirmDialog';
import VoiceSearchButton from '../../components/VoiceSearchButton';
import { AppButton } from '../../components/Common/AppButton';
import { normalizeImportedDate } from '../../utils/dateUtils';

// Dynamic Seniority (Thâm niên) Calculator
const calculateSeniority = (startDateStr?: string) => {
    if (!startDateStr) return 'Chưa xác định';
    const startDate = new Date(startDateStr);
    if (isNaN(startDate.getTime())) return 'Chưa xác định';
    const now = new Date();
    
    let years = now.getFullYear() - startDate.getFullYear();
    let months = now.getMonth() - startDate.getMonth();
    
    if (months < 0) {
        years--;
        months += 12;
    }
    
    if (years === 0) {
        return `${months} tháng`;
    }
    if (months === 0) {
        return `${years} năm`;
    }
    return `${years} năm ${months} tháng`;
};

// Custom date formatter (YYYY-MM-DD -> DD/MM/YYYY)
const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('vi-VN');
    } catch {
        return dateStr;
    }
};

const timesTheme = createTheme({
    palette: {
        text: {
            primary: '#f8fafc',
            secondary: '#cbd5e1',
        },
        divider: 'rgba(148, 163, 184, 0.28)',
    },
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
        MuiTab: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                    fontWeight: 'bold',
                },
            },
        },
    },
});

const EmployeeList = () => {
    const dispatch = useDispatch<AppDispatch>();
    
    // Accounts and Profiles selectors
    const { items: employees, status: employeesStatus, error: employeesError } = useSelector((state: RootState) => state.employees);
    const { items: hrProfiles, status: hrProfilesStatus, error: hrProfilesError } = useSelector((state: RootState) => state.hrProfiles);
    const { profile } = useSelector((state: RootState) => state.auth);
    
    const isAdmin = profile?.role === 'admin';
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Dual view toggle: personnel (hr_profiles table) vs accounts (employees table)
    const [viewMode, setViewMode] = useState<'personnel' | 'accounts'>('personnel');

    // Dialog state
    const [open, setOpen] = useState(false);
    
    // Joint editing structures
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        id: string;
        full_name: string;
        email: string;
        role: 'admin' | 'manager' | 'staff';
        username: string;
        phone_number: string;
        district: string;
        password?: string;
        gender: string;
        date_of_birth: string;
        job_position: string;
        department: string;
        probation_date: string;
        official_date: string;
        contract_type: string;
        labor_status: string;
        insurance_participation: boolean;
        uniform_size: string;
        shoe_size: string;
        check: string;
    }>({
        id: '',
        full_name: '',
        email: '',
        role: 'staff',
        username: '',
        phone_number: '',
        district: '',
        password: '',
        gender: 'Nam',
        date_of_birth: '',
        job_position: '',
        department: '',
        probation_date: '',
        official_date: '',
        contract_type: '',
        labor_status: 'Đang làm việc',
        insurance_participation: false,
        uniform_size: '',
        shoe_size: '',
        check: ''
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'warning', message: string } | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    const [confirmState, setConfirmState] = useState<{
        open: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ open: false, title: '', message: '', onConfirm: () => {} });
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    // Initial Fetch for BOTH tables
    useEffect(() => {
        dispatch(fetchEmployees());
        dispatch(fetchHRProfiles());
    }, [dispatch]);

    // Reset selection when changing tabs
    useEffect(() => {
        setSelectedIds([]);
    }, [viewMode]);

    const handleOpen = (item?: HRProfile | Employee) => {
        if (item) {
            setEditingId(item.id);
            if (viewMode === 'personnel') {
                const profileItem = item as HRProfile;
                setFormData({
                    id: profileItem.id,
                    full_name: profileItem.full_name,
                    email: profileItem.email || '',
                    role: 'staff',
                    username: '',
                    phone_number: profileItem.phone_number || '',
                    district: profileItem.district || '',
                    password: '',
                    gender: profileItem.gender || 'Nam',
                    date_of_birth: profileItem.date_of_birth || '',
                    job_position: profileItem.job_position || '',
                    department: profileItem.department || '',
                    probation_date: profileItem.probation_date || '',
                    official_date: profileItem.official_date || '',
                    contract_type: profileItem.contract_type || 'HĐ lao động xác định thời hạn',
                    labor_status: profileItem.labor_status || 'Đang làm việc',
                    insurance_participation: profileItem.insurance_participation || false,
                    uniform_size: profileItem.uniform_size || '',
                    shoe_size: profileItem.shoe_size || '',
                    check: ''
                });
            } else {
                const employeeItem = item as Employee;
                setFormData({
                    id: employeeItem.id,
                    full_name: employeeItem.full_name,
                    email: employeeItem.email,
                    role: employeeItem.role,
                    username: employeeItem.username || '',
                    phone_number: employeeItem.phone_number || '',
                    district: employeeItem.district || '',
                    password: '',
                    gender: 'Nam',
                    date_of_birth: '',
                    job_position: '',
                    department: '',
                    probation_date: '',
                    official_date: '',
                    contract_type: '',
                    labor_status: 'Đang làm việc',
                    insurance_participation: false,
                    uniform_size: '',
                    shoe_size: '',
                    check: employeeItem.check || ''
                });
            }
        } else {
            setEditingId(null);
            setFormData({
                id: '',
                full_name: '',
                email: '',
                role: 'staff',
                username: '',
                phone_number: '',
                district: '',
                password: viewMode === 'accounts' ? '123456' : '',
                gender: 'Nam',
                date_of_birth: '',
                job_position: '',
                department: '',
                probation_date: '',
                official_date: '',
                contract_type: viewMode === 'personnel' ? 'HĐ lao động xác định thời hạn' : '',
                labor_status: 'Đang làm việc',
                insurance_participation: viewMode === 'personnel',
                uniform_size: '',
                shoe_size: '',
                check: ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingId(null);
    };

    const handleChange = (e: any) => {
        const { name, value, checked, type } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : value 
        }));
    };

    const handleSubmit = async () => {
        try {
            if (viewMode === 'personnel') {
                // CRUD on public.hr_profiles
                const profilePayload: Partial<HRProfile> = {
                    id: formData.id.trim(),
                    full_name: formData.full_name,
                    gender: formData.gender,
                    date_of_birth: formData.date_of_birth || undefined,
                    phone_number: formData.phone_number,
                    email: formData.email,
                    job_position: formData.job_position,
                    department: formData.department,
                    district: formData.district,
                    probation_date: formData.probation_date || undefined,
                    official_date: formData.official_date || undefined,
                    contract_type: formData.contract_type,
                    labor_status: formData.labor_status,
                    insurance_participation: formData.insurance_participation,
                    uniform_size: formData.uniform_size,
                    shoe_size: formData.shoe_size
                };

                if (editingId) {
                    await dispatch(updateHRProfile({ id: editingId, updates: profilePayload })).unwrap();
                    setNotification({ type: 'success', message: 'Cập nhật hồ sơ nhân sự thành công!' });
                } else {
                    if (!profilePayload.id) {
                        setNotification({ type: 'error', message: 'Mã nhân viên bắt buộc phải nhập!' });
                        return;
                    }
                    await dispatch(addHRProfile(profilePayload)).unwrap();
                    setNotification({ type: 'success', message: 'Thêm hồ sơ nhân sự mới thành công!' });
                }
            } else {
                // CRUD on public.employees (Accounts)
                const employeePayload: Partial<Employee> = {
                    id: formData.id.trim() || undefined,
                    full_name: formData.full_name,
                    email: formData.email,
                    username: formData.username,
                    role: formData.role,
                    phone_number: formData.phone_number,
                    district: formData.district,
                    check: formData.check
                };

                if (formData.password?.trim()) {
                    employeePayload.password = formData.password;
                }

                if (editingId) {
                    await dispatch(updateEmployee({ id: editingId, updates: employeePayload })).unwrap();
                    setNotification({ type: 'success', message: 'Cập nhật tài khoản thành công!' });
                } else {
                    await dispatch(addEmployee({ ...employeePayload, must_change_password: true })).unwrap();
                    setNotification({ type: 'success', message: 'Thêm tài khoản mới thành công!' });
                }
            }
            handleClose();
        } catch (err: any) {
            console.error('Failed to save:', err);
            setNotification({ type: 'error', message: err.message || 'Lỗi khi lưu dữ liệu.' });
        }
    };

    const handleDelete = (id: string, name: string) => {
        const titleStr = viewMode === 'personnel' ? 'Xóa hồ sơ nhân sự' : 'Xóa tài khoản';
        setConfirmState({
            open: true,
            title: titleStr,
            message: `Bạn có chắc muốn xóa "${name}"? Hành động này không thể hoàn tác.`,
            onConfirm: async () => {
                setActionLoading(true);
                try {
                    if (viewMode === 'personnel') {
                        await dispatch(deleteHRProfile(id)).unwrap();
                        setNotification({ type: 'success', message: 'Đã xóa hồ sơ nhân sự thành công!' });
                    } else {
                        await dispatch(deleteEmployee(id)).unwrap();
                        setNotification({ type: 'success', message: 'Đã xóa tài khoản hệ thống thành công!' });
                    }
                } catch (err) {
                    setNotification({ type: 'error', message: 'Lỗi khi xóa mục đã chọn.' });
                } finally {
                    setActionLoading(false);
                    setConfirmState(s => ({ ...s, open: false }));
                }
            }
        });
    };

    const handleSelectAll = (checked: boolean) => {
        const activeList = viewMode === 'personnel' ? hrProfiles : employees;
        if (checked) {
            setSelectedIds(activeList.map(e => e.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(item => item !== id));
        }
    };

    const handleBulkDelete = () => {
        setConfirmState({
            open: true,
            title: `Xóa ${selectedIds.length} mục đã chọn`,
            message: `Bạn có chắc muốn xóa ${selectedIds.length} dữ liệu đã chọn? Hành động này không thể hoàn tác.`,
            onConfirm: async () => {
                setActionLoading(true);
                try {
                    if (viewMode === 'personnel') {
                        await dispatch(deleteHRProfiles(selectedIds)).unwrap();
                        setNotification({ type: 'success', message: `Đã xóa ${selectedIds.length} hồ sơ nhân sự!` });
                    } else {
                        await dispatch(deleteEmployees(selectedIds)).unwrap();
                        setNotification({ type: 'success', message: `Đã xóa ${selectedIds.length} tài khoản!` });
                    }
                    setSelectedIds([]);
                } catch (err) {
                    setNotification({ type: 'error', message: 'Lỗi khi xóa hàng loạt.' });
                } finally {
                    setActionLoading(false);
                    setConfirmState(s => ({ ...s, open: false }));
                }
            }
        });
    };

    // Export Personnel Table to Premium Excel Sheet
    const handleExportPersonnel = () => {
        const columns = [
            { header: 'STT', key: 'stt', width: 6, align: 'center' as const },
            { header: 'Mã NV', key: 'id', width: 15, align: 'center' as const },
            { header: 'Họ và tên', key: 'full_name', width: 25 },
            { header: 'Giới tính', key: 'gender', width: 10, align: 'center' as const },
            { header: 'Ngày sinh', key: 'date_of_birth', width: 15, align: 'center' as const },
            { header: 'ĐT di động', key: 'phone_number', width: 15, align: 'center' as const },
            { header: 'Email cơ quan', key: 'email', width: 25 },
            { header: 'Vị trí công việc', key: 'job_position', width: 20 },
            { header: 'Đơn vị công tác', key: 'department', width: 25 },
            { header: 'Khu vực (Quận/Huyện)', key: 'district', width: 20 },
            { header: 'Ngày thử việc', key: 'probation_date', width: 15, align: 'center' as const },
            { header: 'Ngày chính thức', key: 'official_date', width: 15, align: 'center' as const },
            { header: 'Loại hợp đồng', key: 'contract_type', width: 30 },
            { header: 'Trạng thái lao động', key: 'labor_status', width: 18 },
            { header: 'Thâm niên', key: 'seniority', width: 20 },
            { header: 'Tham gia bảo hiểm', key: 'insurance', width: 20, align: 'center' as const },
            { header: 'Size quần áo BHLĐ', key: 'uniform_size', width: 18, align: 'center' as const },
            { header: 'Size giày dép', key: 'shoe_size', width: 15, align: 'center' as const }
        ];

        const data = filteredHRProfiles.map((emp, index) => ({
            stt: index + 1,
            id: emp.id,
            full_name: emp.full_name,
            gender: emp.gender || '-',
            date_of_birth: formatDate(emp.date_of_birth),
            phone_number: emp.phone_number || '-',
            email: emp.email || '-',
            job_position: emp.job_position || '-',
            department: emp.department || '-',
            district: emp.district || '-',
            probation_date: formatDate(emp.probation_date),
            official_date: formatDate(emp.official_date),
            contract_type: emp.contract_type || '-',
            labor_status: emp.labor_status || '-',
            seniority: calculateSeniority(emp.official_date || emp.probation_date),
            insurance: emp.insurance_participation ? 'Có' : 'Không',
            uniform_size: emp.uniform_size || '-',
            shoe_size: emp.shoe_size || '-'
        }));

        exportStandardReport(data, 'Danh_sach_nhan_su', 'BẢNG THÔNG TIN NHÂN SỰ CHI TIẾT', columns, profile?.full_name || 'Admin');
    };

    // Permission Dialog Logic (for Accounts only)
    const [permDialogOpen, setPermDialogOpen] = useState(false);
    const [permEmployee, setPermEmployee] = useState<Employee | null>(null);

    const handleOpenPermissions = (emp: Employee) => {
        setPermEmployee(emp);
        setPermDialogOpen(true);
    };

    const handleSavePermissions = async (id: string, permissions: PermissionCode[]) => {
        try {
            await dispatch(updateEmployee({ id, updates: { permissions } })).unwrap();
            setPermDialogOpen(false);
            setPermEmployee(null);
            setNotification({ type: 'success', message: 'Đã cập nhật phân quyền thành công!' });
        } catch (err) {
            setNotification({ type: 'error', message: 'Lỗi khi lưu phân quyền.' });
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return <Chip label="Quản trị" color="error" size="small" sx={{ fontWeight: 'bold' }} />;
            case 'manager': return <Chip label="Quản lý" color="warning" size="small" sx={{ fontWeight: 'bold' }} />;
            default: return <Chip label="Nhân viên" color="primary" size="small" sx={{ fontWeight: 'bold' }} />;
        }
    };

    // Filter Logic for both grids
    const filteredHRProfiles = useMemo(() => {
        const term = debouncedSearchTerm.toLowerCase();
        return hrProfiles.filter(emp =>
            (emp.full_name?.toLowerCase() || '').includes(term) ||
            (emp.email?.toLowerCase() || '').includes(term) ||
            (emp.phone_number?.toLowerCase() || '').includes(term) ||
            (emp.id?.toLowerCase() || '').includes(term) ||
            (emp.job_position?.toLowerCase() || '').includes(term) ||
            (emp.department?.toLowerCase() || '').includes(term) ||
            (emp.district?.toLowerCase() || '').includes(term)
        );
    }, [hrProfiles, debouncedSearchTerm]);

    const filteredEmployees = useMemo(() => {
        const term = debouncedSearchTerm.toLowerCase();
        return employees.filter(emp =>
            (emp.full_name?.toLowerCase() || '').includes(term) ||
            (emp.email?.toLowerCase() || '').includes(term) ||
            (emp.username?.toLowerCase() || '').includes(term) ||
            (emp.phone_number?.toLowerCase() || '').includes(term) ||
            (emp.id?.toLowerCase() || '').includes(term) ||
            (emp.district?.toLowerCase() || '').includes(term)
        );
    }, [employees, debouncedSearchTerm]);

    const isPageLoading = viewMode === 'personnel' 
        ? hrProfilesStatus === 'loading' 
        : employeesStatus === 'loading';

    const pageError = viewMode === 'personnel' ? hrProfilesError : employeesError;

    if (isPageLoading) return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
    if (pageError) return <Alert severity="error">{pageError}</Alert>;

    return (
        <ThemeProvider theme={timesTheme}>
            <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto', width: '100%', overflowX: 'hidden', fontFamily: "'Times New Roman', Times, serif" }}>
                {notification && (
                <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2, borderRadius: 2 }}>
                    {notification.message}
                </Alert>
            )}
            
            {/* Page Header */}
            <PageHeader 
                title="Quản Lý Nhân Sự"
                subtitle={viewMode === 'personnel' 
                    ? 'Danh sách hồ sơ nhân sự chính thức của doanh nghiệp (Lưu trữ độc lập)' 
                    : 'Danh sách tài khoản và phân quyền truy cập hệ thống quản lý kho'
                }
                icon={<PeopleIcon sx={{ fontSize: 30, color: 'white' }} />}
                gradientType="blue"
            />
            
            {/* Premium Filter & Actions Toolbar */}
            <Paper 
                elevation={0} 
                sx={{ 
                    p: 2.5, 
                    mb: 3.5, 
                    borderRadius: '16px', 
                    border: '1px solid rgba(226, 232, 240, 0.8)', 
                    bgcolor: '#ffffff',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.01)'
                }}
            >
                <Stack 
                    direction={{ xs: 'column', md: 'row' }} 
                    justifyContent="space-between" 
                    alignItems="center" 
                    spacing={2}
                >
                    <TextField
                        size="small"
                        placeholder="Tìm kiếm..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: <VoiceSearchButton onResult={setSearchTerm} />,
                            sx: { borderRadius: '10px', bgcolor: '#f8fafc' }
                        }}
                        sx={{ minWidth: 260, width: { xs: '100%', md: 'auto' } }}
                    />
                    
                    <Stack 
                        direction={{ xs: 'column', sm: 'row' }} 
                        spacing={1.5} 
                        width={{ xs: '100%', sm: 'auto' }} 
                        alignItems="center"
                        flexWrap="wrap"
                        gap={1}
                    >
                        {isAdmin && (
                            <>
                                {selectedIds.length > 0 && (
                                    <AppButton
                                        variant="contained"
                                        color="error"
                                        icon={<DeleteIcon />}
                                        onClick={handleBulkDelete}
                                        title={`Xóa ${selectedIds.length} mục đã chọn`}
                                    />
                                )}
                                {viewMode === 'personnel' && (
                                    <>
                                        <AppButton
                                            variant="outlined"
                                            onClick={generateEmployeeTemplate}
                                            icon={<FileDownloadIcon />}
                                            title="Tải mẫu Excel"
                                        />
                                        <AppButton
                                            variant="outlined"
                                            component="label"
                                            icon={<CloudUploadIcon />}
                                            title="Nhập Excel"
                                        >
                                            <input
                                                type="file"
                                                hidden
                                                accept=".xlsx, .xls"
                                                onChange={async (e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        try {
                                                            const originalData = await readExcelFile(e.target.files[0]);
                                                            const mappedData = originalData.map((row: any) => {
                                                                const rawIns = row['Tham gia bảo hiểm'] || row['THAM_GIA_BAO_HIEM'] || row['insurance_participation'] || '';
                                                                const isInsured = ['có', 'true', '1', 'x', 'yes'].includes(String(rawIns).trim().toLowerCase()) || rawIns === 1;

                                                                const id = String(row['Mã NV'] || row['MA_NHAN_VIEN'] || row['MA_NV'] || row['Mã nhân viên'] || row['id'] || '').trim();
                                                                const fullName = String(row['Họ và tên'] || row['HO_TEN'] || row['full_name'] || '').trim();
                                                                const gender = String(row['Giới tính'] || row['GIOI_TINH'] || row['gender'] || 'Nam').trim();
                                                                const dateOfBirth = normalizeImportedDate(row['Ngày sinh'] || row['NGAY_SINH'] || row['date_of_birth']);
                                                                const phoneNumber = String(row['ĐT di động'] || row['SO_DIEN_THOAI'] || row['SĐT'] || row['Số điện thoại'] || row['phone_number'] || '').trim();
                                                                const email = String(row['Email cơ quan'] || row['EMAIL'] || row['Email'] || row['email'] || '').trim();
                                                                const jobPosition = String(row['Vị trí công việc'] || row['VI_TRI_CONG_VIEC'] || row['job_position'] || '').trim();
                                                                const department = String(row['Đơn vị công tác'] || row['DON_VI_CONG_TAC'] || row['department'] || '').trim();
                                                                const district = String(row['Khu vực (Quận/Huyện)'] || row['KHU_VUC'] || row['QUAN_HUYEN'] || row['Khu vực'] || row['Quận/Huyện'] || row['district'] || '').trim();
                                                                const probationDate = normalizeImportedDate(row['Ngày thử việc'] || row['NGAY_THU_VIEC'] || row['probation_date']);
                                                                const officialDate = normalizeImportedDate(row['Ngày chính thức'] || row['NGAY_CHINH_THUC'] || row['official_date']);
                                                                const contractType = String(row['Loại hợp đồng'] || row['LOAI_HOP_DONG'] || row['contract_type'] || 'HĐ lao động xác định thời hạn').trim();
                                                                const laborStatus = String(row['Trạng thái lao động'] || row['TRANG_THAI_LAO_DONG'] || row['labor_status'] || 'Đang làm việc').trim();
                                                                const uniformSize = String(row['Size quần áo BHLĐ'] || row['SIZE_QUAN_AO_BHLD'] || row['SIZE_QUAN_AO'] || row['Size quần áo'] || row['uniform_size'] || '').trim();
                                                                const shoeSize = String(row['Size giày dép'] || row['SIZE_GIAY_DEP'] || row['SIZE_GIAY'] || row['Size giày'] || row['shoe_size'] || '').trim();

                                                                return {
                                                                    id,
                                                                    full_name: fullName,
                                                                    gender,
                                                                    date_of_birth: dateOfBirth,
                                                                    phone_number: phoneNumber,
                                                                    email,
                                                                    job_position: jobPosition,
                                                                    department,
                                                                    district,
                                                                    probation_date: probationDate,
                                                                    official_date: officialDate,
                                                                    contract_type: contractType,
                                                                    labor_status: laborStatus,
                                                                    insurance_participation: isInsured,
                                                                    uniform_size: uniformSize,
                                                                    shoe_size: shoeSize
                                                                };
                                                            }).filter(emp => emp.id && emp.full_name);

                                                            if (mappedData.length > 0) {
                                                                const result: any = await dispatch(importHRProfiles(mappedData)).unwrap();
                                                                dispatch(fetchHRProfiles());
                                                                dispatch(fetchEmployees());
                                                                const inserted = result?.inserted ?? 0;
                                                                const updated = result?.updated ?? 0;
                                                                let message = '';
                                                                if (inserted > 0 && updated > 0) {
                                                                    message = `Đã cập nhật ${updated} nhân viên và thêm mới ${inserted} nhân viên (khóa Mã NV)!`;
                                                                } else if (updated > 0) {
                                                                    message = `Đã cập nhật thành công ${updated} nhân viên theo Mã NV!`;
                                                                } else {
                                                                    message = `Đã thêm mới thành công ${inserted || mappedData.length} nhân viên theo Mã NV!`;
                                                                }
                                                                setNotification({ type: 'success', message });
                                                            } else {
                                                                setNotification({ type: 'warning', message: 'Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng sử dụng file mẫu chuẩn.' });
                                                            }
                                                        } catch (error: any) {
                                                            setNotification({ type: 'error', message: `Lỗi khi nhập dữ liệu: ${error.message || JSON.stringify(error)}` });
                                                        }
                                                        e.target.value = '';
                                                    }
                                                }}
                                            />
                                        </AppButton>
                                    </>
                                )}
                            </>
                        )}
                        
                        {/* Active Personnel Export */}
                        {viewMode === 'personnel' && (
                            <AppButton
                                variant="contained"
                                color="success"
                                onClick={handleExportPersonnel}
                                sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                                icon={<FileDownloadIcon />}
                                title="Xuất Excel"
                            />
                        )}

                        <AppButton
                            variant="contained"
                            icon={<AddIcon />}
                            onClick={() => handleOpen()}
                            title={viewMode === 'personnel' ? 'Thêm Hồ Sơ' : 'Tạo Tài Khoản'}
                        />
                    </Stack>
                </Stack>
            </Paper>

            {/* View Mode Switching Tabs */}
            <Tabs 
                value={viewMode} 
                onChange={(_, val) => setViewMode(val)} 
                sx={{ 
                    mb: 3, 
                    borderBottom: 1, 
                    borderColor: 'divider',
                    '& .MuiTab-root': {
                        color: '#94a3b8',
                        fontWeight: 'bold',
                        minWidth: { xs: '50%', sm: 'auto' },
                        '&.Mui-selected': { color: '#38bdf8' },
                    },
                    '& .MuiTabs-indicator': { backgroundColor: '#38bdf8', height: 3 },
                }}
            >
                <Tab label="Bảng Thông Tin Nhân Sự (hr_profiles)" value="personnel" />
                <Tab label="Tài Khoản & Phân Quyền (employees)" value="accounts" />
            </Tabs>

            {isMobile ? (
                <Box>
                    {viewMode === 'personnel' ? (
                        filteredHRProfiles.length === 0 ? (
                            <Box py={4} textAlign="center"><Typography color="text.secondary">Chưa có dữ liệu nhân sự</Typography></Box>
                        ) : (
                            filteredHRProfiles.map((employee) => {
                                const isSelected = selectedIds.includes(employee.id);
                                return (
                                    <Card key={employee.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                                <Typography variant="subtitle1" fontWeight="bold">{employee.full_name}</Typography>
                                                <Typography variant="body2" color="primary.main" fontWeight="bold">Mã: {employee.id}</Typography>
                                            </Stack>
                                            <Divider sx={{ my: 1 }} />
                                            <Stack spacing={0.5} sx={{ fontSize: '0.875rem' }}>
                                                <Box display="flex" justifyContent="space-between"><Box color="text.secondary">Vị trí:</Box><Box>{employee.job_position || '-'}</Box></Box>
                                                <Box display="flex" justifyContent="space-between"><Box color="text.secondary">Đơn vị:</Box><Box>{employee.department || '-'}</Box></Box>
                                                <Box display="flex" justifyContent="space-between"><Box color="text.secondary">Khu vực:</Box><Box>{employee.district || '-'}</Box></Box>
                                                <Box display="flex" justifyContent="space-between"><Box color="text.secondary">Thâm niên:</Box><Box color="secondary.main" fontWeight="bold">{calculateSeniority(employee.official_date || employee.probation_date)}</Box></Box>
                                                <Box display="flex" justifyContent="space-between"><Box color="text.secondary">Bảo hiểm:</Box><Box>{employee.insurance_participation ? 'Có' : 'Không'}</Box></Box>
                                            </Stack>
                                            <Stack direction="row" spacing={1} justifyContent="flex-end" mt={2}>
                                                <IconButton size="small" onClick={() => handleOpen(employee)} color="primary"><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => handleDelete(employee.id, employee.full_name)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )
                    ) : (
                        filteredEmployees.length === 0 ? (
                            <Box py={4} textAlign="center"><Typography color="text.secondary">Chưa có dữ liệu tài khoản</Typography></Box>
                        ) : (
                            filteredEmployees.map((employee) => {
                                return (
                                    <Card key={employee.id} sx={{ mb: 2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                                <Typography variant="subtitle1" fontWeight="bold">{employee.full_name}</Typography>
                                                {getRoleLabel(employee.role)}
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary" mb={1}>Email: {employee.email}</Typography>
                                            <Typography variant="body2" color="text.secondary" mb={1}>Tên Đăng Nhập: {employee.username || '-'}</Typography>
                                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end" mt={2}>
                                                <AppButton variant="outlined" icon={<VpnKeyIcon />} onClick={() => handleOpenPermissions(employee)} title="Phân quyền" />
                                                <IconButton size="small" onClick={() => handleOpen(employee)} color="primary"><EditIcon fontSize="small" /></IconButton>
                                                <IconButton size="small" onClick={() => handleDelete(employee.id, employee.full_name)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )
                    )}
                </Box>
            ) : (
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                    <Table size="small" sx={{ minWidth: viewMode === 'personnel' ? 1400 : 900 }}>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                {isAdmin && (
                                    <TableCell padding="checkbox" sx={{ borderBottom: '2px solid #e2e8f0' }}>
                                        <Checkbox
                                            checked={(viewMode === 'personnel' ? hrProfiles : employees).length > 0 && selectedIds.length === (viewMode === 'personnel' ? hrProfiles : employees).length}
                                            indeterminate={selectedIds.length > 0 && selectedIds.length < (viewMode === 'personnel' ? hrProfiles : employees).length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            size="small"
                                        />
                                    </TableCell>
                                )}
                                
                                {viewMode === 'personnel' ? (
                                    <>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Mã NV</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Họ và tên</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Giới tính</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Ngày sinh</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>ĐT di động</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Email cơ quan</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Vị trí công việc</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Đơn vị công tác</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Khu vực (Quận/Huyện)</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Ngày thử việc</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Ngày chính thức</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Loại hợp đồng</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Trạng thái lao động</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Thâm niên</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Tham gia bảo hiểm</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Size quần áo BHLĐ</TableCell>
                                        <TableCell align="center" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Size giày dép</TableCell>
                                    </>
                                ) : (
                                    <>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Mã NV</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Họ và tên</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Tên đăng nhập</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Email hệ thống</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Số điện thoại</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Vai trò hệ thống</TableCell>
                                        <TableCell sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Khu vực (Quận/Huyện)</TableCell>
                                    </>
                                )}
                                <TableCell align="right" sx={{ borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', fontWeight: 'bold', color: '#1e293b' }}>Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {viewMode === 'personnel' ? (
                                filteredHRProfiles.length === 0 ? (
                                    <TableRow><TableCell colSpan={18} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có dữ liệu nhân sự</TableCell></TableRow>
                                ) : (
                                    filteredHRProfiles.map((employee) => {
                                        const isSelected = selectedIds.includes(employee.id);
                                        return (
                                            <TableRow key={employee.id} hover sx={{ bgcolor: isSelected ? 'action.selected' : 'inherit' }}>
                                                {isAdmin && (
                                                    <TableCell padding="checkbox">
                                                        <Checkbox checked={isSelected} onChange={(e) => handleSelectOne(employee.id, e.target.checked)} size="small" />
                                                    </TableCell>
                                                )}
                                                <TableCell sx={{ fontWeight: 'bold', color: '#1e3a8a', fontFamily: 'monospace' }}>{employee.id}</TableCell>
                                                <TableCell sx={{ fontWeight: '600' }}>{employee.full_name}</TableCell>
                                                <TableCell align="center">{employee.gender || '-'}</TableCell>
                                                <TableCell align="center">{formatDate(employee.date_of_birth)}</TableCell>
                                                <TableCell align="center">{employee.phone_number || '-'}</TableCell>
                                                <TableCell>{employee.email || '-'}</TableCell>
                                                <TableCell>{employee.job_position || '-'}</TableCell>
                                                <TableCell>{employee.department || '-'}</TableCell>
                                                <TableCell>{employee.district || '-'}</TableCell>
                                                <TableCell align="center">{formatDate(employee.probation_date)}</TableCell>
                                                <TableCell align="center">{formatDate(employee.official_date)}</TableCell>
                                                <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{employee.contract_type || '-'}</TableCell>
                                                <TableCell>
                                                    {employee.labor_status === 'Nghỉ việc' ? (
                                                        <Chip label="Nghỉ việc" color="error" size="small" variant="outlined" />
                                                    ) : employee.labor_status === 'Thử việc' ? (
                                                        <Chip label="Thử việc" color="warning" size="small" variant="outlined" />
                                                    ) : (
                                                        <Chip label="Đang làm việc" color="success" size="small" variant="outlined" />
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: 'bold', color: '#0284c7' }}>
                                                    {calculateSeniority(employee.official_date || employee.probation_date)}
                                                </TableCell>
                                                <TableCell align="center">
                                                    {employee.insurance_participation ? (
                                                        <Chip label="Có" color="success" size="small" sx={{ fontWeight: 'bold' }} />
                                                    ) : (
                                                        <Chip label="Không" color="default" size="small" />
                                                    )}
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{employee.uniform_size || '-'}</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{employee.shoe_size || '-'}</TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <IconButton size="small" onClick={() => handleOpen(employee)} color="primary"><EditIcon fontSize="small" /></IconButton>
                                                        <IconButton size="small" onClick={() => handleDelete(employee.id, employee.full_name)} color="error"><DeleteIcon fontSize="small" /></IconButton>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )
                            ) : (
                                filteredEmployees.length === 0 ? (
                                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có dữ liệu tài khoản</TableCell></TableRow>
                                ) : (
                                    filteredEmployees.map((employee) => {
                                        const isSelected = selectedIds.includes(employee.id);
                                        return (
                                            <TableRow key={employee.id} hover sx={{ bgcolor: isSelected ? 'action.selected' : 'inherit' }}>
                                                {isAdmin && (
                                                    <TableCell padding="checkbox">
                                                        <Checkbox checked={isSelected} onChange={(e) => handleSelectOne(employee.id, e.target.checked)} size="small" />
                                                    </TableCell>
                                                )}
                                                <TableCell sx={{ fontWeight: 'bold', fontFamily: 'monospace' }}>{employee.id}</TableCell>
                                                <TableCell sx={{ fontWeight: '600' }}>{employee.full_name}</TableCell>
                                                <TableCell>{employee.username || '-'}</TableCell>
                                                <TableCell>{employee.email}</TableCell>
                                                <TableCell>{employee.phone_number || '-'}</TableCell>
                                                <TableCell>{getRoleLabel(employee.role)}</TableCell>
                                                <TableCell>{employee.district || '-'}</TableCell>
                                                <TableCell align="right">
                                                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                                        <IconButton size="small" onClick={() => handleOpenPermissions(employee)} color="secondary" title="Phân quyền"><VpnKeyIcon fontSize="small" /></IconButton>
                                                        <IconButton size="small" onClick={() => handleOpen(employee)} color="primary" title="Sửa"><EditIcon fontSize="small" /></IconButton>
                                                        <IconButton size="small" onClick={() => handleDelete(employee.id, employee.full_name)} color="error" title="Xóa"><DeleteIcon fontSize="small" /></IconButton>
                                                    </Stack>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            {/* Context-Aware Add/Edit Dialog */}
            <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
                    <Typography variant="h6" fontWeight="900" sx={{ textTransform: 'uppercase', color: 'primary.main' }}>
                        {viewMode === 'personnel' 
                            ? (editingId ? `Hồ sơ nhân sự: ${formData.full_name}` : 'Thêm hồ sơ nhân sự mới')
                            : (editingId ? `Tài khoản hệ thống: ${formData.full_name}` : 'Tạo tài khoản hệ thống mới')
                        }
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <Grid container spacing={2}>
                            {viewMode === 'personnel' ? (
                                <>
                                    {/* PERSONNEL FORM FIELDS */}
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="id"
                                            label="Mã nhân viên"
                                            required
                                            fullWidth
                                            disabled={!!editingId}
                                            placeholder="Ví dụ: NV001"
                                            value={formData.id}
                                            onChange={handleChange}
                                            helperText={!editingId ? "Bắt buộc nhập, không được trùng" : "Không thể đổi mã"}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                        <TextField
                                            name="full_name"
                                            label="Họ và tên"
                                            required
                                            fullWidth
                                            value={formData.full_name}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Giới tính</InputLabel>
                                            <Select name="gender" value={formData.gender} label="Giới tính" onChange={handleChange}>
                                                <MenuItem value="Nam">Nam</MenuItem>
                                                <MenuItem value="Nữ">Nữ</MenuItem>
                                                <MenuItem value="Khác">Khác</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="date_of_birth"
                                            label="Ngày sinh"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            value={formData.date_of_birth}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="phone_number"
                                            label="Số ĐT di động"
                                            fullWidth
                                            value={formData.phone_number}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="email"
                                            label="Email cơ quan"
                                            fullWidth
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="job_position"
                                            label="Vị trí công việc"
                                            fullWidth
                                            value={formData.job_position}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                        <TextField
                                            name="department"
                                            label="Đơn vị công tác"
                                            fullWidth
                                            value={formData.department}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="district"
                                            label="Khu vực (Quận/Huyện)"
                                            fullWidth
                                            value={formData.district}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="probation_date"
                                            label="Ngày thử việc"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            value={formData.probation_date}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="official_date"
                                            label="Ngày chính thức"
                                            type="date"
                                            fullWidth
                                            InputLabelProps={{ shrink: true }}
                                            value={formData.official_date}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Trạng thái lao động</InputLabel>
                                            <Select name="labor_status" value={formData.labor_status} label="Trạng thái lao động" onChange={handleChange}>
                                                <MenuItem value="Đang làm việc">Đang làm việc</MenuItem>
                                                <MenuItem value="Thử việc">Thử việc</MenuItem>
                                                <MenuItem value="Tạm hoãn hợp đồng">Tạm hoãn hợp đồng</MenuItem>
                                                <MenuItem value="Nghỉ việc">Nghỉ việc</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                        <TextField
                                            name="contract_type"
                                            label="Loại hợp đồng lao động"
                                            fullWidth
                                            value={formData.contract_type}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }} display="flex" alignItems="center">
                                        <FormControlLabel
                                            control={<Switch checked={formData.insurance_participation} onChange={handleChange} name="insurance_participation" color="primary" />}
                                            label="Tham gia bảo hiểm"
                                            sx={{ ml: 1 }}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="uniform_size"
                                            label="Size quần áo BHLĐ"
                                            fullWidth
                                            placeholder="Ví dụ: M, L, XL, XXL..."
                                            value={formData.uniform_size || ''}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="shoe_size"
                                            label="Size giày dép"
                                            fullWidth
                                            placeholder="Ví dụ: 39, 40, 41, 42..."
                                            value={formData.shoe_size || ''}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                </>
                            ) : (
                                <>
                                    {/* ACCOUNTS FORM FIELDS */}
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="id"
                                            label="Mã định danh (ID)"
                                            fullWidth
                                            disabled={!!editingId}
                                            placeholder="Hệ thống tự tạo nếu bỏ trống"
                                            value={formData.id}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 8 }}>
                                        <TextField
                                            name="full_name"
                                            label="Họ và tên"
                                            required
                                            fullWidth
                                            value={formData.full_name}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="email"
                                            label="Email đăng nhập"
                                            required
                                            fullWidth
                                            type="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 6 }}>
                                        <TextField
                                            name="username"
                                            label="Tên hiển thị / Tên đăng nhập"
                                            fullWidth
                                            value={formData.username}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <FormControl fullWidth>
                                            <InputLabel>Vai trò hệ thống</InputLabel>
                                            <Select name="role" value={formData.role} label="Vai trò hệ thống" onChange={handleChange}>
                                                <MenuItem value="staff">Nhân viên</MenuItem>
                                                <MenuItem value="manager">Quản lý</MenuItem>
                                                <MenuItem value="admin">Quản trị viên</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="district"
                                            label="Quận/Huyện làm việc"
                                            fullWidth
                                            value={formData.district}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12, sm: 4 }}>
                                        <TextField
                                            name="password"
                                            label={editingId ? "Mật khẩu mới" : "Mật khẩu ban đầu"}
                                            fullWidth
                                            type="password"
                                            placeholder={editingId ? "Bỏ trống để giữ nguyên" : "Mặc định: 123456"}
                                            value={formData.password}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <TextField
                                            name="check"
                                            label="Cảnh báo / Ghi chú hệ thống"
                                            fullWidth
                                            multiline
                                            rows={2}
                                            placeholder="Ghi chú cảnh báo giao dịch (Nếu có)..."
                                            value={formData.check}
                                            onChange={handleChange}
                                        />
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, pt: 1, borderTop: '1px solid #e2e8f0', gap: 1 }}>
                    <AppButton onClick={handleClose} color="inherit" icon={<CloseIcon />} title="Hủy bỏ" />
                    <AppButton onClick={handleSubmit} variant="contained" icon={<SaveIcon />} title="Lưu" />
                </DialogActions>
            </Dialog>

            {/* Permission Configuration Dialog */}
            <PermissionDialog
                open={permDialogOpen}
                onClose={() => setPermDialogOpen(false)}
                employee={permEmployee}
                onSave={handleSavePermissions}
            />

            {/* Confirm Dialog */}
            <ConfirmDialog
                open={confirmState.open}
                title={confirmState.title}
                message={confirmState.message}
                confirmLabel="Xóa ngay"
                severity="danger"
                loading={actionLoading}
                onConfirm={confirmState.onConfirm}
                onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
            />
        </Box>
    </ThemeProvider>
    );
};

export default EmployeeList;
