import React, { useEffect, useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Checkbox, FormControlLabel, FormGroup,
    Typography, Box, Divider
} from '@mui/material';
import type { Employee, PermissionCode } from '../types';

interface PermissionDialogProps {
    open: boolean;
    onClose: () => void;
    employee: Employee | null;
    onSave: (id: string, permissions: PermissionCode[]) => void;
}

const PERMISSION_GROUPS = [
    {
        title: 'Tồn Kho (Inventory)',
        permissions: [
            { code: 'inventory.view', label: 'Xem tồn kho' },
            { code: 'inventory.manage', label: 'Quản lý (Thêm/Sửa/Xóa)' },
        ]
    },
    {
        title: 'Nhập Kho (Inbound)',
        permissions: [
            { code: 'inbound.view', label: 'Xem lịch sử nhập' },
            { code: 'inbound.create', label: 'Tạo phiếu nhập' },
        ]
    },
    {
        title: 'Xuất Kho (Outbound)',
        permissions: [
            { code: 'outbound.view', label: 'Xem lịch sử xuất' },
            { code: 'outbound.create', label: 'Tạo phiếu xuất' },
        ]
    },
    {
        title: 'Đặt Hàng (Orders)',
        permissions: [
            { code: 'orders.create', label: 'Tạo yêu cầu' },
            { code: 'orders.view_own', label: 'Xem đơn của mình' },
            { code: 'orders.view_all', label: 'Xem tất cả đơn (Quản lý)' },
            { code: 'orders.approve', label: 'Phê duyệt đơn hàng' },
            { code: 'orders.delete', label: 'Xóa đơn hàng' },
        ]
    },
    {
        title: 'Báo Cáo (Reports)',
        permissions: [
            { code: 'reports.handover', label: 'In biên bản bàn giao' },
            { code: 'reports.view_all', label: 'Xem báo cáo tổng hợp' },
        ]
    },
    {
        title: 'Nhân Sự (Employees)',
        permissions: [
            { code: 'employees.view', label: 'Xem danh sách' },
            { code: 'employees.manage', label: 'Quản lý nhân viên' },
        ]
    }
];

const PermissionDialog: React.FC<PermissionDialogProps> = ({ open, onClose, employee, onSave }) => {
    const [selectedPermissions, setSelectedPermissions] = useState<PermissionCode[]>([]);

    useEffect(() => {
        if (employee) {
            if (employee.permissions && employee.permissions.includes('*')) {
                // If admin full access, maybe select all or keep * logic in backend
                // For UI, let's select all checks
                const allCodes = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.code)) as PermissionCode[];
                setSelectedPermissions(allCodes);
            } else {
                setSelectedPermissions(employee.permissions || []);
            }
        }
    }, [employee]);

    const handleToggle = (code: string) => {
        setSelectedPermissions(prev => {
            const isSelected = prev.includes(code as PermissionCode);
            if (isSelected) {
                return prev.filter(c => c !== code);
            } else {
                return [...prev, code as PermissionCode];
            }
        });
    };

    const handleSave = () => {
        if (employee) {
            onSave(employee.id, selectedPermissions);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                Phân Quyền: <span style={{ color: '#1976d2' }}>{employee?.full_name}</span>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {PERMISSION_GROUPS.map((group) => (
                        <Box key={group.title} sx={{ width: { xs: '100%', sm: 'calc(50% - 8px)' } }}>
                            <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, height: '100%' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, color: 'text.secondary', textTransform: 'uppercase' }}>
                                    {group.title}
                                </Typography>
                                <Divider sx={{ mb: 1 }} />
                                <FormGroup>
                                    {group.permissions.map((perm) => (
                                        <FormControlLabel
                                            key={perm.code}
                                            control={
                                                <Checkbox
                                                    size="small"
                                                    checked={selectedPermissions.includes(perm.code as PermissionCode)}
                                                    onChange={() => handleToggle(perm.code)}
                                                />
                                            }
                                            label={<Typography variant="body2">{perm.label}</Typography>}
                                        />
                                    ))}
                                </FormGroup>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Hủy</Button>
                <Button onClick={handleSave} variant="contained" color="primary">
                    Lưu Phân Quyền
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PermissionDialog;
