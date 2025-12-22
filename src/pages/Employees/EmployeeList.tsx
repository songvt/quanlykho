import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, FormControl, InputLabel, Select, MenuItem, Stack, Alert, CircularProgress, Chip,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Checkbox
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { fetchEmployees, addEmployee, updateEmployee, deleteEmployee, deleteEmployees, importEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';
import type { Employee } from '../../types';
import { generateEmployeeTemplate, readExcelFile } from '../../utils/excelUtils';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';

const EmployeeList = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: employees, status, error } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin';

    // Dialog state
    const [open, setOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formData, setFormData] = useState<Partial<Employee>>({
        full_name: '',
        email: '',
        role: 'staff',
        username: '',
        phone_number: '' // Added phone_number
    });

    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [status, dispatch]);

    const handleOpen = (employee?: Employee) => {
        if (employee) {
            setEditingEmployee(employee);
            setFormData({
                full_name: employee.full_name,
                email: employee.email,
                role: employee.role,
                username: employee.username || '',
                phone_number: employee.phone_number || '',
                district: employee.district || ''
            });
        } else {
            setEditingEmployee(null);
            setFormData({
                full_name: '',
                email: '',
                password: '123456',
                role: 'staff',
                username: '',
                phone_number: '',
                district: ''
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingEmployee(null);
    };

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        try {
            if (editingEmployee) {
                const updates = { ...formData };
                if (!updates.password) {
                    delete (updates as any).password;
                }
                await dispatch(updateEmployee({ id: editingEmployee.id, updates })).unwrap();
            } else {
                await dispatch(addEmployee({ ...formData, must_change_password: true } as Omit<Employee, 'id'>)).unwrap();
            }
            handleClose();
        } catch (err) {
            console.error('Failed to save employee:', err);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Bạn có chắc chắn muốn xóa nhân viên này?')) {
            await dispatch(deleteEmployee(id));
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(employees.map(e => e.id));
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

    const handleBulkDelete = async () => { // import deleteEmployees from slice first (add to imports)
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} nhân viên đã chọn?`)) {
            try {
                // @ts-ignore - deleteEmployees thunk needs to be imported
                await dispatch(deleteEmployees(selectedIds)).unwrap();
                setSelectedIds([]);
                alert('Đã xóa thành công!');
            } catch (err) {
                console.error('Bulk delete failed:', err);
                alert('Lỗi khi xóa hàng loạt.');
            }
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return <Chip label="Quản trị" color="error" size="small" />;
            case 'manager': return <Chip label="Quản lý" color="warning" size="small" />;
            default: return <Chip label="Nhân viên" color="primary" size="small" />;
        }
    };

    if (status === 'loading') return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
    if (status === 'failed') return <Alert severity="error">{error}</Alert>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: 1000, mx: 'auto', width: '100%', overflowX: 'hidden', zoom: { xs: 0.85, md: 1 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={{ xs: 2, sm: 4 }} spacing={2}>
                <Box>
                    <Typography variant="h4" fontWeight="900" sx={{
                        fontSize: { xs: '1.5rem', sm: '2.125rem' },
                        textTransform: 'uppercase',
                        background: 'linear-gradient(45deg, #7b1fa2 30%, #ea80fc 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '0.5px'
                    }}>
                        QUẢN LÝ NHÂN VIÊN
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' } }}>Quản lý tài khoản và phân quyền truy cập</Typography>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} width={{ xs: '100%', sm: 'auto' }}>
                    {isAdmin && (
                        <>
                            {selectedIds.length > 0 && (
                                <Button
                                    variant="contained"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleBulkDelete}
                                    sx={{ borderRadius: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                                    size="small"
                                >
                                    Xóa ({selectedIds.length})
                                </Button>
                            )}
                            <Button
                                variant="outlined"
                                startIcon={<FileDownloadIcon />}
                                onClick={generateEmployeeTemplate}
                                sx={{ borderRadius: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                                size="small"
                                fullWidth
                            >
                                Tải mẫu Excel
                            </Button>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<UploadFileIcon />}
                                sx={{ borderRadius: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                                size="small"
                                fullWidth
                            >
                                Nhập Excel
                                <input
                                    type="file"
                                    hidden
                                    accept=".xlsx, .xls"
                                    onChange={async (e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            try {
                                                const originalData = await readExcelFile(e.target.files[0]);
                                                // Map Vietnamese headers to English keys
                                                const mappedData = originalData.map((row: any) => ({
                                                    full_name: row['HO_TEN'],
                                                    email: row['EMAIL'],
                                                    phone_number: row['SO_DIEN_THOAI'] ? String(row['SO_DIEN_THOAI']) : '', // Added phone_number
                                                    district: row['QUAN_HUYEN'] || '', // Added district mapping
                                                    role: (row['VAI_TRO']?.toLowerCase() === 'admin' ? 'admin' : row['VAI_TRO']?.toLowerCase() === 'manager' ? 'manager' : 'staff') as 'admin' | 'manager' | 'staff',
                                                    password: '123' // Default password for imported users
                                                })).filter(emp => emp.full_name && emp.email); // Basic validation

                                                if (mappedData.length > 0) {
                                                    await dispatch(importEmployees(mappedData)).unwrap();
                                                    alert(`Đã nhập thành công ${mappedData.length} nhân viên!`);
                                                } else {
                                                    alert('Không tìm thấy dữ liệu hợp lệ trong file.');
                                                }
                                            } catch (error: any) {
                                                console.error('Import failed:', error);
                                                alert(`Lỗi khi nhập dữ liệu: ${error.message || JSON.stringify(error)}`);
                                            }
                                            e.target.value = '';
                                        }
                                    }}
                                />
                            </Button>
                        </>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpen()}
                        sx={{ px: 3, py: 1.2, borderRadius: 2, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                        size="small"
                        fullWidth
                    >
                        Thêm Nhân Viên
                    </Button>
                </Stack>
            </Stack>

            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            {isAdmin && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={employees.length > 0 && selectedIds.length === employees.length}
                                        indeterminate={selectedIds.length > 0 && selectedIds.length < employees.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Họ và tên</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Tên hiển thị</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Email</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>SĐT</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Vai trò</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Thao tác</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {employees.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={isAdmin ? 7 : 6} align="center" sx={{ py: 4, color: 'text.secondary' }}>Chưa có dữ liệu nhân viên</TableCell>
                            </TableRow>
                        ) : (
                            employees.map((employee) => {
                                const isSelected = selectedIds.includes(employee.id);
                                return (
                                    <TableRow key={employee.id} hover sx={{ transition: 'all 0.2s', bgcolor: isSelected ? 'action.selected' : 'inherit' }}>
                                        {isAdmin && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectOne(employee.id, e.target.checked)}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="600" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{employee.full_name}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{employee.username}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{employee.email}</TableCell>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>{employee.phone_number || '-'}</TableCell>
                                        <TableCell>{getRoleLabel(employee.role)}</TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpen(employee)}
                                                    sx={{ color: 'primary.main', bgcolor: 'primary.50', '&:hover': { bgcolor: 'primary.100' } }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(employee.id)}
                                                    sx={{ color: 'error.main', bgcolor: 'error.50', '&:hover': { bgcolor: 'error.100' } }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                )
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
                    <Typography variant="h6" fontWeight="900" sx={{ textTransform: 'uppercase', color: 'primary.main' }}>
                        {editingEmployee ? 'CẬP NHẬT NHÂN VIÊN' : 'THÊM NHÂN VIÊN MỚI'}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            name="full_name"
                            label="Họ và tên"
                            fullWidth
                            value={formData.full_name}
                            onChange={handleChange}
                        />
                        <TextField
                            name="username"
                            label="Tên hiển thị (Username)"
                            fullWidth
                            value={formData.username}
                            onChange={handleChange}
                        />
                        <TextField
                            name="email"
                            label="Email"
                            fullWidth
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                        />
                        <TextField
                            name="district"
                            label="Quận/Huyện"
                            fullWidth
                            value={formData.district}
                            onChange={handleChange}
                        />
                        <TextField
                            name="phone_number"
                            label="Số điện thoại"
                            fullWidth
                            value={formData.phone_number}
                            onChange={handleChange}
                        />
                        <TextField
                            name="password"
                            label={editingEmployee ? "Mật khẩu (Để trống nếu không đổi)" : "Mật khẩu"}
                            fullWidth
                            type="password"
                            value={formData.password || ''}
                            onChange={handleChange}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Vai trò</InputLabel>
                            <Select
                                name="role"
                                value={formData.role}
                                label="Vai trò"
                                onChange={handleChange}
                            >
                                <MenuItem value="staff">Nhân viên</MenuItem>
                                <MenuItem value="manager">Quản lý</MenuItem>
                                <MenuItem value="admin">Quản trị viên</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Hủy</Button>
                    <Button onClick={handleSubmit} variant="contained">Lưu</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EmployeeList;
