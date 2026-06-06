import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Grid, Card, CardContent, Dialog, DialogTitle,
    DialogContent, DialogActions, Button, TextField, Stack, Alert, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton,
    Chip, Switch, FormControlLabel, CircularProgress, Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import {
    Building2, MapPin, Shield, ArrowUpDown, Monitor, Edit, Trash2, Plus,
    Check, Download, Upload, LogOut, Settings as SettingsIcon, AlertTriangle
} from 'lucide-react';
import PageHeader from '../components/Common/PageHeader';
import { GoogleSheetService as SupabaseService } from '../services/GoogleSheetService';
import PermissionDialog from '../components/PermissionDialog';

interface CompanyInfo {
    name: string;
    tax_code: string;
    address: string;
    phone: string;
    email: string;
    representative: string;
    website: string;
    logo_url: string;
}

interface Branch {
    id: string;
    name: string;
    code: string;
    address: string;
    phone: string;
    manager_name: string;
    status: string;
}

interface DistrictConfig {
    district: string;
    storekeeper_name: string;
}

interface ActiveDevice {
    id: string;
    user_id: string;
    email: string;
    device_name: string;
    browser_name: string;
    ip_address: string;
    last_active: string;
    created_at: string;
}

interface Employee {
    id: string;
    full_name: string;
    email: string;
    role: 'admin' | 'manager' | 'staff';
    username?: string;
    phone_number?: string;
    district?: string;
    permissions?: string[];
}

const Settings = () => {
    // Current Active Tab/Dialog state
    const [activeDialog, setActiveDialog] = useState<string | null>(null); // 'company' | 'branches' | 'permissions' | 'backup' | 'devices'

    // Status notifications
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    // --- 1. Company Info State ---
    const [companyInfo, setCompanyInfo] = useState<CompanyInfo>({
        name: '', tax_code: '', address: '', phone: '', email: '', representative: '', website: '', logo_url: ''
    });

    // --- 2. Branches State ---
    const [branches, setBranches] = useState<Branch[]>([]);
    const [openBranchEdit, setOpenBranchEdit] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
    // Sub-tab for Storekeepers configuration (to preserve previous feature)
    const [configs, setConfigs] = useState<DistrictConfig[]>([]);
    const [openSkEdit, setOpenSkEdit] = useState(false);
    const [editingSk, setEditingSk] = useState<DistrictConfig | null>(null);

    // --- 3. Permissions (Employees) State ---
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
    const [openPermDialog, setOpenPermDialog] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');

    // --- 5. Devices State ---
    const [devices, setDevices] = useState<ActiveDevice[]>([]);

    // Load initial data
    const fetchCompanyInfo = async () => {
        try {
            const data = await SupabaseService.getCompanyInfo();
            if (data && data.name) setCompanyInfo(data);
        } catch (err) {
            console.error('Lỗi tải thông tin công ty:', err);
        }
    };

    const fetchBranches = async () => {
        try {
            const data = await SupabaseService.getBranches();
            setBranches(data || []);
        } catch (err) {
            console.error('Lỗi tải danh sách chi nhánh:', err);
        }
    };

    const fetchStorekeepers = async () => {
        try {
            const data = await SupabaseService.getDistrictStorekeepers();
            setConfigs(data || []);
        } catch (err) {
            console.error('Lỗi tải thủ kho:', err);
        }
    };

    const fetchEmployeesData = async () => {
        try {
            const data = await SupabaseService.fetchEmployees();
            setEmployees(data || []);
        } catch (err) {
            console.error('Lỗi tải nhân viên:', err);
        }
    };

    const fetchDevices = async () => {
        try {
            const data = await SupabaseService.getDevices();
            setDevices(data || []);
        } catch (err) {
            console.error('Lỗi tải danh sách thiết bị:', err);
        }
    };

    useEffect(() => {
        void fetchCompanyInfo();
        void fetchBranches();
        void fetchStorekeepers();
    }, []);

    const showNotify = (type: 'success' | 'error', message: string) => {
        setNotification({ type, message });
        setTimeout(() => setNotification(null), 5000);
    };

    // --- Company Save Handle ---
    const handleSaveCompany = async () => {
        setLoading(true);
        try {
            await SupabaseService.updateCompanyInfo(companyInfo);
            showNotify('success', 'Đã cập nhật thông tin công ty thành công!');
            setActiveDialog(null);
        } catch (err) {
            showNotify('error', 'Lỗi lưu thông tin công ty.');
        } finally {
            setLoading(false);
        }
    };

    // --- Branch actions ---
    const handleOpenAddBranch = () => {
        setEditingBranch({ name: '', code: '', address: '', phone: '', manager_name: '', status: 'Hoạt động' });
        setOpenBranchEdit(true);
    };

    const handleOpenEditBranch = (b: Branch) => {
        setEditingBranch(b);
        setOpenBranchEdit(true);
    };

    const handleSaveBranch = async () => {
        if (!editingBranch?.name || !editingBranch?.code) {
            showNotify('error', 'Vui lòng điền đủ Tên và Mã chi nhánh');
            return;
        }
        setLoading(true);
        try {
            if (editingBranch.id) {
                await SupabaseService.updateBranch(editingBranch);
                showNotify('success', 'Đã cập nhật chi nhánh.');
            } else {
                await SupabaseService.createBranch(editingBranch);
                showNotify('success', 'Đã thêm chi nhánh mới.');
            }
            void fetchBranches();
            setOpenBranchEdit(false);
        } catch (err) {
            showNotify('error', 'Lỗi lưu chi nhánh.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteBranch = async (id: string) => {
        if (window.confirm('Bạn có chắc muốn xoá chi nhánh này?')) {
            try {
                await SupabaseService.deleteBranch(id);
                showNotify('success', 'Đã xóa chi nhánh.');
                void fetchBranches();
            } catch (err) {
                showNotify('error', 'Lỗi xóa chi nhánh.');
            }
        }
    };

    // --- Storekeeper actions ---
    const handleOpenAddSk = () => {
        setEditingSk({ district: '', storekeeper_name: '' });
        setOpenSkEdit(true);
    };

    const handleSaveSk = async () => {
        if (!editingSk?.district || !editingSk?.storekeeper_name) {
            showNotify('error', 'Vui lòng nhập đủ Quận/Huyện và Tên thủ kho');
            return;
        }
        try {
            await SupabaseService.upsertDistrictStorekeeper(editingSk.district, editingSk.storekeeper_name);
            showNotify('success', 'Đã lưu cấu hình thủ kho.');
            void fetchStorekeepers();
            setOpenSkEdit(false);
        } catch (err) {
            showNotify('error', 'Lỗi lưu cấu hình thủ kho.');
        }
    };

    const handleDeleteSk = async (district: string) => {
        if (window.confirm(`Bạn có chắc muốn xoá cấu hình thủ kho tại ${district}?`)) {
            try {
                await SupabaseService.deleteDistrictStorekeeper(district);
                showNotify('success', 'Đã xóa cấu hình thủ kho.');
                void fetchStorekeepers();
            } catch (err) {
                showNotify('error', 'Lỗi xóa cấu hình.');
            }
        }
    };

    // --- Role & Permissions actions ---
    const handleOpenPermissions = async () => {
        setLoading(true);
        await fetchEmployeesData();
        setLoading(false);
        setUserSearchQuery('');
        setActiveDialog('permissions');
    };

    const handleEditUserPermissions = (emp: Employee) => {
        setSelectedEmployee(emp);
        setOpenPermDialog(true);
    };

    const handleSavePermissions = async (id: string, permissions: string[]) => {
        try {
            await SupabaseService.updateEmployee(id, { permissions });
            showNotify('success', 'Đã lưu phân quyền người dùng.');
            void fetchEmployeesData();
        } catch (err) {
            showNotify('error', 'Lỗi lưu phân quyền.');
        }
    };

    const handleChangeUserRole = async (id: string, role: 'admin' | 'manager' | 'staff') => {
        try {
            await SupabaseService.updateEmployee(id, { role });
            showNotify('success', 'Đã cập nhật vai trò người dùng.');
            void fetchEmployeesData();
        } catch (err) {
            showNotify('error', 'Lỗi cập nhật vai trò.');
        }
    };

    // --- Backup & Restore actions ---
    const handleBackupExport = async () => {
        try {
            const data = await SupabaseService.getBackupData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_qlkho_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotify('success', 'Đã xuất file cấu hình hệ thống thành công!');
        } catch (err) {
            showNotify('error', 'Lỗi xuất file cấu hình.');
        }
    };

    const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                if (!json.company_info || !json.branches) {
                    showNotify('error', 'File không đúng cấu trúc backup hệ thống.');
                    return;
                }
                if (window.confirm('Khôi phục sẽ ghi đè lên dữ liệu hiện tại. Bạn có chắc chắn?')) {
                    setLoading(true);
                    await SupabaseService.restoreBackupData(json);
                    showNotify('success', 'Khôi phục cấu hình hệ thống thành công!');
                    void fetchCompanyInfo();
                    void fetchBranches();
                    void fetchStorekeepers();
                    setActiveDialog(null);
                }
            } catch (err) {
                showNotify('error', 'Lỗi khôi phục dữ liệu: Định dạng JSON hỏng.');
            } finally {
                setLoading(false);
            }
        };
        reader.readAsText(file);
    };

    // --- Active Devices actions ---
    const handleOpenDevices = async () => {
        setLoading(true);
        await fetchDevices();
        setLoading(false);
        setActiveDialog('devices');
    };

    const handleLogoutDevice = async (id: string) => {
        if (window.confirm('Bạn có chắc muốn đăng xuất thiết bị này từ xa?')) {
            try {
                await SupabaseService.deleteDevice(id);
                showNotify('success', 'Đã ngắt kết nối thiết bị.');
                void fetchDevices();
            } catch (err) {
                showNotify('error', 'Lỗi đăng xuất thiết bị.');
            }
        }
    };

    return (
        <Box p={3} sx={{ fontFamily: 'var(--font-family)', minHeight: '80vh' }}>
            {notification && (
                <Alert severity={notification.type} sx={{ mb: 3, borderRadius: '12px' }}>
                    {notification.message}
                </Alert>
            )}

            <PageHeader
                title="Cấu Hình Hệ Thống"
                subtitle="Quản lý thông tin chung, cài đặt bảo mật và phân chia kho bãi doanh nghiệp"
                icon={<SettingsIcon size={30} color="white" />}
                gradientType="blue"
            />

            {/* Title Section matching the image style */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3.5, mt: 4, pl: 1.5, borderLeft: '4px solid var(--brand-primary)' }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>
                    Bảo mật & Cấu hình
                </Typography>
            </Box>

            {/* Menu Catalog Grid */}
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
                {/* 1. Company Info Card */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card
                        onClick={() => { void fetchCompanyInfo(); setActiveDialog('company'); }}
                        sx={{
                            borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', cursor: 'pointer',
                            transition: 'all 0.25s ease', boxShadow: 'none',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 20px rgba(0,0,0,0.04)', borderColor: '#C084FC' }
                        }}
                    >
                        <CardContent sx={{ display: 'flex', gap: 2, p: '24px !important' }}>
                            <Box sx={{
                                width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(192, 132, 252, 0.1)',
                                color: '#A855F7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Building2 size={22} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 0.5 }}>
                                    Thông tin công ty
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    Thiết lập thông tin pháp nhân.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* 2. Branches Card */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card
                        onClick={() => { void fetchBranches(); setActiveDialog('branches'); }}
                        sx={{
                            borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', cursor: 'pointer',
                            transition: 'all 0.25s ease', boxShadow: 'none',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 20px rgba(0,0,0,0.04)', borderColor: '#94A3B8' }
                        }}
                    >
                        <CardContent sx={{ display: 'flex', gap: 2, p: '24px !important' }}>
                            <Box sx={{
                                width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(148, 163, 184, 0.15)',
                                color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <MapPin size={22} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 0.5 }}>
                                    Chi nhánh
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    Quản lý danh sách chi nhánh và địa điểm.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* 3. Roles & Permissions Card */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card
                        onClick={handleOpenPermissions}
                        sx={{
                            borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', cursor: 'pointer',
                            transition: 'all 0.25s ease', boxShadow: 'none',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 20px rgba(0,0,0,0.04)', borderColor: '#F87171' }
                        }}
                    >
                        <CardContent sx={{ display: 'flex', gap: 2, p: '24px !important' }}>
                            <Box sx={{
                                width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(248, 113, 113, 0.1)',
                                color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Shield size={22} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 0.5 }}>
                                    Phân quyền
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    Vai trò và quyền hạn.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* 4. Backup & Restore Card */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card
                        onClick={() => setActiveDialog('backup')}
                        sx={{
                            borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', cursor: 'pointer',
                            transition: 'all 0.25s ease', boxShadow: 'none',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 20px rgba(0,0,0,0.04)', borderColor: '#38BDF8' }
                        }}
                    >
                        <CardContent sx={{ display: 'flex', gap: 2, p: '24px !important' }}>
                            <Box sx={{
                                width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(56, 189, 248, 0.1)',
                                color: '#0EA5E9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <ArrowUpDown size={22} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 0.5 }}>
                                    Sao lưu & Khôi phục
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    Xuất, nhập và khôi phục dữ liệu hệ thống.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>

                {/* 5. Logged-in Devices Card */}
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Card
                        onClick={handleOpenDevices}
                        sx={{
                            borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', cursor: 'pointer',
                            transition: 'all 0.25s ease', boxShadow: 'none',
                            '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 20px rgba(0,0,0,0.04)', borderColor: '#2DD4BF' }
                        }}
                    >
                        <CardContent sx={{ display: 'flex', gap: 2, p: '24px !important' }}>
                            <Box sx={{
                                width: 44, height: 44, borderRadius: '12px', bgcolor: 'rgba(45, 212, 191, 0.1)',
                                color: '#14B8A6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                                <Monitor size={22} />
                            </Box>
                            <Box>
                                <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 0.5 }}>
                                    Thiết bị đăng nhập
                                </Typography>
                                <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                                    Quản lý và đăng xuất thiết bị từ xa.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* ========================================================================= */}
            {/* 1. DIALOG: COMPANY INFO */}
            {/* ========================================================================= */}
            <Dialog open={activeDialog === 'company'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 'bold' }}>Cấu hình thông tin công ty</DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={2} pt={1}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Tên công ty pháp nhân"
                                fullWidth
                                value={companyInfo.name}
                                onChange={e => setCompanyInfo({ ...companyInfo, name: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Mã số thuế"
                                fullWidth
                                value={companyInfo.tax_code}
                                onChange={e => setCompanyInfo({ ...companyInfo, tax_code: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                label="Địa chỉ trụ sở chính"
                                fullWidth
                                value={companyInfo.address}
                                onChange={e => setCompanyInfo({ ...companyInfo, address: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Số điện thoại"
                                fullWidth
                                value={companyInfo.phone}
                                onChange={e => setCompanyInfo({ ...companyInfo, phone: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Email liên hệ"
                                fullWidth
                                value={companyInfo.email}
                                onChange={e => setCompanyInfo({ ...companyInfo, email: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Người đại diện pháp luật"
                                fullWidth
                                value={companyInfo.representative}
                                onChange={e => setCompanyInfo({ ...companyInfo, representative: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Website công ty"
                                fullWidth
                                value={companyInfo.website}
                                onChange={e => setCompanyInfo({ ...companyInfo, website: e.target.value })}
                                size="small"
                            />
                        </Grid>
                        <Grid size={12}>
                            <TextField
                                label="URL Logo công ty"
                                fullWidth
                                value={companyInfo.logo_url}
                                onChange={e => setCompanyInfo({ ...companyInfo, logo_url: e.target.value })}
                                size="small"
                                placeholder="https://example.com/logo.png"
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveDialog(null)} color="inherit">Hủy</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveCompany} disabled={loading}>Lưu thông tin</Button>
                </DialogActions>
            </Dialog>

            {/* ========================================================================= */}
            {/* 2. DIALOG: BRANCHES */}
            {/* ========================================================================= */}
            <Dialog open={activeDialog === 'branches'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="lg">
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
                    <span>Cấu hình Chi Nhánh & Địa điểm Kho</span>
                    <Button variant="contained" size="small" onClick={handleOpenAddBranch}>Thêm Chi Nhánh</Button>
                </DialogTitle>
                <DialogContent dividers>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee', mb: 4 }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell>Mã</TableCell>
                                    <TableCell>Tên chi nhánh</TableCell>
                                    <TableCell>Địa chỉ</TableCell>
                                    <TableCell>Số điện thoại</TableCell>
                                    <TableCell>Quản lý</TableCell>
                                    <TableCell>Trạng thái</TableCell>
                                    <TableCell align="right">Hành động</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {branches.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>Chưa có chi nhánh nào.</TableCell>
                                    </TableRow>
                                ) : (
                                    branches.map(b => (
                                        <TableRow key={b.id}>
                                            <TableCell><b>{b.code}</b></TableCell>
                                            <TableCell>{b.name}</TableCell>
                                            <TableCell>{b.address}</TableCell>
                                            <TableCell>{b.phone}</TableCell>
                                            <TableCell>{b.manager_name}</TableCell>
                                            <TableCell>
                                                <Chip label={b.status} size="small" color={b.status === 'Hoạt động' ? 'success' : 'default'} />
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" color="primary" onClick={() => handleOpenEditBranch(b)}><Edit size={16} /></IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteBranch(b.id)}><Trash2 size={16} /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Preserving existing District Storekeeper settings inside Branches view */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 4 }}>
                        <Typography variant="subtitle1" fontWeight="bold">Thủ kho theo Quận/Huyện</Typography>
                        <Button variant="outlined" size="small" onClick={handleOpenAddSk}>Thêm cấu hình Quận/Huyện</Button>
                    </Box>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell>Quận / Huyện</TableCell>
                                    <TableCell>Tên Thủ Kho (Bên Giao)</TableCell>
                                    <TableCell align="right">Hành động</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {configs.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>Chưa có cấu hình nào.</TableCell>
                                    </TableRow>
                                ) : (
                                    configs.map(row => (
                                        <TableRow key={row.district}>
                                            <TableCell>{row.district}</TableCell>
                                            <TableCell><b>{row.storekeeper_name}</b></TableCell>
                                            <TableCell align="right">
                                                <IconButton size="small" color="primary" onClick={() => { setEditingSk(row); setOpenSkEdit(true); }}><Edit size={16} /></IconButton>
                                                <IconButton size="small" color="error" onClick={() => handleDeleteSk(row.district)}><Trash2 size={16} /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveDialog(null)} color="inherit">Đóng</Button>
                </DialogActions>
            </Dialog>

            {/* SUB-DIALOG: ADD/EDIT BRANCH */}
            <Dialog open={openBranchEdit} onClose={() => setOpenBranchEdit(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editingBranch?.id ? 'Chỉnh sửa chi nhánh' : 'Thêm chi nhánh mới'}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} pt={1}>
                        <TextField
                            label="Mã chi nhánh (Viết tắt)"
                            fullWidth
                            size="small"
                            value={editingBranch?.code || ''}
                            onChange={e => setEditingBranch(prev => ({ ...prev!, code: e.target.value.toUpperCase() }))}
                            disabled={!!editingBranch?.id}
                        />
                        <TextField
                            label="Tên chi nhánh"
                            fullWidth
                            size="small"
                            value={editingBranch?.name || ''}
                            onChange={e => setEditingBranch(prev => ({ ...prev!, name: e.target.value }))}
                        />
                        <TextField
                            label="Địa chỉ"
                            fullWidth
                            size="small"
                            value={editingBranch?.address || ''}
                            onChange={e => setEditingBranch(prev => ({ ...prev!, address: e.target.value }))}
                        />
                        <TextField
                            label="Số điện thoại"
                            fullWidth
                            size="small"
                            value={editingBranch?.phone || ''}
                            onChange={e => setEditingBranch(prev => ({ ...prev!, phone: e.target.value }))}
                        />
                        <TextField
                            label="Người quản lý"
                            fullWidth
                            size="small"
                            value={editingBranch?.manager_name || ''}
                            onChange={e => setEditingBranch(prev => ({ ...prev!, manager_name: e.target.value }))}
                        />
                        <FormControl size="small" fullWidth>
                            <InputLabel>Trạng thái</InputLabel>
                            <Select
                                value={editingBranch?.status || 'Hoạt động'}
                                label="Trạng thái"
                                onChange={e => setEditingBranch(prev => ({ ...prev!, status: e.target.value }))}
                            >
                                <MenuItem value="Hoạt động">Hoạt động</MenuItem>
                                <MenuItem value="Tạm ngưng">Tạm ngưng</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenBranchEdit(false)}>Hủy</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveBranch}>Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* SUB-DIALOG: ADD/EDIT STOREKEEPER */}
            <Dialog open={openSkEdit} onClose={() => setOpenSkEdit(false)} fullWidth maxWidth="sm">
                <DialogTitle>{editingSk?.district ? 'Sửa cấu hình thủ kho' : 'Thêm cấu hình thủ kho mới'}</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2} pt={1}>
                        <TextField
                            label="Quận / Huyện"
                            fullWidth
                            size="small"
                            placeholder="Ví dụ: Quận 12"
                            value={editingSk?.district || ''}
                            onChange={e => setEditingSk(prev => ({ ...prev!, district: e.target.value }))}
                            disabled={configs.some(c => c.district === editingSk?.district)}
                        />
                        <TextField
                            label="Tên thủ kho (Người giao)"
                            fullWidth
                            size="small"
                            placeholder="Ví dụ: Nguyễn Văn A"
                            value={editingSk?.storekeeper_name || ''}
                            onChange={e => setEditingSk(prev => ({ ...prev!, storekeeper_name: e.target.value }))}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenSkEdit(false)}>Hủy</Button>
                    <Button variant="contained" color="primary" onClick={handleSaveSk}>Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* ========================================================================= */}
            {/* 3. DIALOG: PERMISSIONS */}
            {/* ========================================================================= */}
            <Dialog open={activeDialog === 'permissions'} onClose={() => { setActiveDialog(null); setUserSearchQuery(''); }} fullWidth maxWidth="lg">
                <DialogTitle sx={{ fontWeight: 'bold' }}>Quản lý vai trò & Phân quyền thao tác</DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ mb: 2.5 }}>
                        <TextField
                            placeholder="Tìm kiếm tài khoản theo tên, email, khu vực..."
                            variant="outlined"
                            size="small"
                            fullWidth
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            slotProps={{
                                htmlInput: {
                                    style: { padding: '8.5px 14px' }
                                }
                            }}
                        />
                    </Box>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell>Tài khoản</TableCell>
                                    <TableCell>Email</TableCell>
                                    <TableCell>Khu vực</TableCell>
                                    <TableCell>Vai trò chính</TableCell>
                                    <TableCell>Số quyền đã cấp</TableCell>
                                    <TableCell align="right">Hành động</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {(() => {
                                    const filtered = employees.filter(emp => {
                                        if (!userSearchQuery) return true;
                                        const q = userSearchQuery.toLowerCase();
                                        return (
                                            emp.full_name?.toLowerCase().includes(q) ||
                                            emp.email?.toLowerCase().includes(q) ||
                                            emp.username?.toLowerCase().includes(q) ||
                                            emp.district?.toLowerCase().includes(q)
                                        );
                                    });

                                    if (filtered.length === 0) {
                                        return (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    Không tìm thấy tài khoản nào phù hợp.
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }

                                    return filtered.map(emp => (
                                        <TableRow key={emp.id} hover>
                                            <TableCell><b>{emp.full_name}</b> {emp.username ? `(${emp.username})` : ''}</TableCell>
                                            <TableCell>{emp.email}</TableCell>
                                            <TableCell>{emp.district || 'Không có'}</TableCell>
                                            <TableCell>
                                                <Select
                                                    value={emp.role}
                                                    size="small"
                                                    onChange={e => handleChangeUserRole(emp.id, e.target.value as any)}
                                                    sx={{ minWidth: 120 }}
                                                >
                                                    <MenuItem value="admin">Quản trị (admin)</MenuItem>
                                                    <MenuItem value="manager">Quản lý (manager)</MenuItem>
                                                    <MenuItem value="staff">Nhân viên (staff)</MenuItem>
                                                </Select>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={emp.role === 'admin' ? 'Full access (*)' : `${emp.permissions?.length || 0} quyền`}
                                                    color={emp.role === 'admin' ? 'error' : 'primary'}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() => handleEditUserPermissions(emp)}
                                                    disabled={emp.role === 'admin'}
                                                >
                                                    Thiết lập quyền
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ));
                                })()}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveDialog(null)} color="inherit">Đóng</Button>
                </DialogActions>
            </Dialog>

            {/* Permission Dialog Component integration */}
            {selectedEmployee && (
                <PermissionDialog
                    open={openPermDialog}
                    onClose={() => { setOpenPermDialog(false); setSelectedEmployee(null); }}
                    employee={selectedEmployee}
                    onSave={handleSavePermissions}
                />
            )}

            {/* ========================================================================= */}
            {/* 4. DIALOG: BACKUP & RESTORE */}
            {/* ========================================================================= */}
            <Dialog open={activeDialog === 'backup'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="sm">
                <DialogTitle sx={{ fontWeight: 'bold' }}>Sao lưu & Khôi phục dữ liệu</DialogTitle>
                <DialogContent dividers sx={{ py: 3 }}>
                    <Stack spacing={3.5}>
                        <Box sx={{ border: '1px solid rgba(226, 232, 240, 0.8)', p: 2.5, borderRadius: '12px', bgcolor: '#f8fafc' }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Download size={18} color="var(--brand-primary)" /> Sao lưu cấu hình hệ thống
                            </Typography>
                            <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', mb: 2, lineHeight: 1.4 }}>
                                Tải về toàn bộ thông tin công ty, danh sách các chi nhánh kho bãi, và danh mục thủ kho để dự phòng.
                            </Typography>
                            <Button variant="contained" fullWidth onClick={handleBackupExport} startIcon={<Download size={16} />}>
                                Tải về file Backup (.json)
                            </Button>
                        </Box>

                        <Box sx={{ border: '1px solid rgba(226, 232, 240, 0.8)', p: 2.5, borderRadius: '12px', bgcolor: '#f8fafc' }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Upload size={18} color="orange" /> Khôi phục cấu hình hệ thống
                            </Typography>
                            <Typography sx={{ fontSize: '0.78rem', color: 'var(--text-secondary)', mb: 2, lineHeight: 1.4 }}>
                                Đọc file backup cấu hình đã tải trước đó để khôi phục nhanh thông tin hệ thống.
                            </Typography>
                            <Button variant="outlined" component="label" fullWidth color="warning" startIcon={<Upload size={16} />}>
                                Chọn file Backup JSON và Khôi phục
                                <input type="file" hidden accept=".json" onChange={handleBackupImport} />
                            </Button>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveDialog(null)} color="inherit">Hủy</Button>
                </DialogActions>
            </Dialog>

            {/* ========================================================================= */}
            {/* 5. DIALOG: ACTIVE DEVICES */}
            {/* ========================================================================= */}
            <Dialog open={activeDialog === 'devices'} onClose={() => setActiveDialog(null)} fullWidth maxWidth="md">
                <DialogTitle sx={{ fontWeight: 'bold' }}>Quản lý thiết bị đăng nhập</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Danh sách các phiên làm việc và thiết bị đang truy cập hệ thống của bạn. Bạn có thể bấm Đăng xuất để xóa session thiết bị từ xa.
                    </Typography>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell>Tài khoản</TableCell>
                                    <TableCell>Thiết bị</TableCell>
                                    <TableCell>Trình duyệt</TableCell>
                                    <TableCell>Địa chỉ IP</TableCell>
                                    <TableCell>Hoạt động cuối</TableCell>
                                    <TableCell align="right">Hành động</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {devices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>Không có phiên hoạt động nào.</TableCell>
                                    </TableRow>
                                ) : (
                                    devices.map(d => (
                                        <TableRow key={d.id} hover>
                                            <TableCell><b>{d.email}</b></TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Monitor size={16} color="grey" />
                                                    <span>{d.device_name}</span>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{d.browser_name}</TableCell>
                                            <TableCell><Chip label={d.ip_address} size="small" variant="outlined" /></TableCell>
                                            <TableCell>{new Date(d.last_active).toLocaleString('vi-VN')}</TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    startIcon={<LogOut size={12} />}
                                                    onClick={() => handleLogoutDevice(d.id)}
                                                >
                                                    Đăng xuất
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setActiveDialog(null)} color="inherit">Đóng</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;
