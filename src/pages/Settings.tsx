import { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Button, IconButton, TextField, Dialog,
    DialogTitle, DialogContent, DialogActions, Stack, Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { GoogleSheetService as SupabaseService } from '../services/GoogleSheetService';

interface DistrictConfig {
    district: string;
    storekeeper_name: string;
}

const Settings = () => {
    const [configs, setConfigs] = useState<DistrictConfig[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingItem, setEditingItem] = useState<DistrictConfig | null>(null);

    // Form state
    const [district, setDistrict] = useState('');
    const [storekeeperName, setStorekeeperName] = useState('');
    const [error, setError] = useState('');
    const fetchConfigs = async () => {
        try {
            const data = await SupabaseService.getDistrictStorekeepers();
            setConfigs(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchConfigs();
    }, []);

    const handleOpenCreate = () => {
        setEditingItem(null);
        setDistrict('');
        setStorekeeperName('');
        setError('');
        setOpenDialog(true);
    };

    const handleOpenEdit = (item: DistrictConfig) => {
        setEditingItem(item);
        setDistrict(item.district);
        setStorekeeperName(item.storekeeper_name);
        setError('');
        setOpenDialog(true);
    };

    const handleSave = async () => {
        if (!district.trim() || !storekeeperName.trim()) {
            setError('Vui lòng nhập đầy đủ thông tin');
            return;
        }

        try {
            await SupabaseService.upsertDistrictStorekeeper(district.trim(), storekeeperName.trim());
            setOpenDialog(false);
            fetchConfigs();
        } catch (err: any) {
            setError('Lỗi lưu dữ liệu: ' + err.message);
        }
    };

    const handleDelete = async (districtKey: string) => {
        if (window.confirm(`Bạn có chắc muốn xóa cấu hình cho ${districtKey}?`)) {
            try {
                await SupabaseService.deleteDistrictStorekeeper(districtKey);
                fetchConfigs();
            } catch (err: any) {
                alert('Lỗi xóa: ' + err.message);
            }
        }
    };

    return (
        <Box p={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold" color="primary">
                    THIẾT LẬP HỆ THỐNG
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
                    Thêm Cấu Hình Quận/Huyện
                </Button>
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #eee' }}>
                <Box p={2} bgcolor="#f5f5f5" borderBottom="1px solid #eee">
                    <Typography variant="subtitle1" fontWeight="bold">
                        Cấu hình Thủ kho theo Quận/Huyện
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        Tên thủ kho này sẽ được hiển thị trên biên bản xuất kho tương ứng với quận huyện.
                    </Typography>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>Quận / Huyện</TableCell>
                                <TableCell>Tên Thủ Kho (Bên Giao)</TableCell>
                                <TableCell align="right">Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {configs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                        Chưa có cấu hình nào.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                configs.map((row) => (
                                    <TableRow key={row.district} hover>
                                        <TableCell>{row.district}</TableCell>
                                        <TableCell><b>{row.storekeeper_name}</b></TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" color="primary" onClick={() => handleOpenEdit(row)}>
                                                <EditIcon />
                                            </IconButton>
                                            <IconButton size="small" color="error" onClick={() => handleDelete(row.district)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingItem ? 'Chỉnh Sửa Cấu Hình' : 'Thêm Cấu Hình Mới'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} pt={1}>
                        {error && <Alert severity="error">{error}</Alert>}
                        <TextField
                            label="Quận / Huyện"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            fullWidth
                            placeholder="Ví dụ: Quận 12"
                            disabled={!!editingItem} // Disable editing PK if updating, or allow upsert to overwrite? Upsert overwrites, so editing PK creates new. Better disable to avoid confusion, forcing delete-add for key change.
                            helperText={editingItem ? "Không thể sửa tên Quận/Huyện (Hãy xóa và tạo mới nếu cần)" : ""}
                        />
                        <TextField
                            label="Tên Thủ Kho (Người Giao)"
                            value={storekeeperName}
                            onChange={(e) => setStorekeeperName(e.target.value)}
                            fullWidth
                            placeholder="Ví dụ: Nguyễn Văn A"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
                    <Button variant="contained" onClick={handleSave}>Lưu</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default Settings;
