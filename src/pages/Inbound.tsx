import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory } from '../store/slices/inventorySlice';
import { fetchTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, syncInStock, importInboundTransactions, fetchTransactionsForce } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import type { Transaction } from '../types';
import {
    Button, TextField, Typography, Box, CircularProgress, Dialog, DialogContent, DialogTitle,
    DialogActions, Stack
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { generateInboundTemplate, readExcelFile } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import InboundForm from '../components/Inbound/InboundForm';
import InboundList from '../components/Inbound/InboundList';

export const Inbound = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { status: productStatus, items: products } = useSelector((state: RootState) => state.products);
    const { status: txStatus } = useSelector((state: RootState) => state.transactions);
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';
    const { success, error: notifyError } = useNotification();

    const [isSyncing, setIsSyncing] = useState(false);

    // Edit Dialog State
    const [editDialog, setEditDialog] = useState(false);
    const [editItem, setEditItem] = useState<Transaction | null>(null);
    const [editData, setEditData] = useState<any>({});

    // Delete Dialog State
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<Transaction | null>(null);

    // Bulk Delete State
    const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => {
        if (productStatus === 'idle') dispatch(fetchProducts());
        if (txStatus === 'idle') dispatch(fetchTransactions());
        dispatch(fetchInventory());
    }, [productStatus, txStatus, dispatch]);

    const handleEditSave = async () => {
        if (!editItem) return;
        try {
            await dispatch(updateTransaction({
                id: editItem.id,
                type: 'inbound',
                payload: {
                    quantity: Number(editData.quantity),
                    unit_price: Number(editData.unit_price),
                    serial_code: editData.serial_code,
                    district: editData.district,
                    item_status: editData.item_status,
                }
            })).unwrap();
            success('Cập nhật thành công!');
            setEditDialog(false);
        } catch (error: any) {
            notifyError(error.message || 'Lỗi cập nhật');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;
        try {
            await dispatch(deleteTransaction({ id: itemToDelete.id, type: 'inbound' })).unwrap();
            success('Xóa thành công!');
            setDeleteDialog(false);
        } catch (error: any) {
            notifyError(error.message || 'Lỗi khi xóa');
        }
    };

    const handleBulkDeleteConfirm = async () => {
        try {
            await dispatch(bulkDeleteTransactions({ ids: selectedIds, type: 'inbound' })).unwrap();
            success(`Đã xóa ${selectedIds.length} mục thành công!`);
            setBulkDeleteDialog(false);
            setSelectedIds([]);
        } catch (error: any) {
            notifyError(error.message || 'Lỗi khi xóa hàng loạt');
        }
    };

    if (productStatus === 'loading') return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto', width: '100%', overflowX: 'hidden' }}>
            <Box mb={{ xs: 3, md: 5 }} display="flex" flexDirection="column" alignItems="center">
                <Typography variant="h4" component="h1" sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' },
                    textTransform: 'uppercase',
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    letterSpacing: '-0.02em',
                    mb: 1
                }}>
                    NHẬP HÀNG HÓA
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b', textAlign: 'center', fontWeight: 500 }}>
                    Quản lý phiếu nhập kho và cập nhật số lượng tồn kho thời gian thực
                </Typography>
            </Box>

            {isAdmin && (
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" spacing={2} mb={3}>
                    <Button
                        variant="contained" color="secondary"
                        startIcon={isSyncing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                        onClick={async () => {
                            setIsSyncing(true);
                            try {
                                const res = await dispatch(syncInStock()).unwrap();
                                success(res.message || 'Đồng bộ thành công!');
                            } catch (e: any) { notifyError(e.message); }
                            finally { setIsSyncing(false); }
                        }}
                        disabled={isSyncing} size="small"
                    >
                        {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ kho tổng'}
                    </Button>
                    <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={generateInboundTemplate} size="small">
                        Tải mẫu Excel
                    </Button>
                    <Button variant="contained" component="label" startIcon={<UploadFileIcon />} size="small">
                        Nhập Excel
                        <input type="file" hidden accept=".xlsx, .xls" onChange={async (e) => {
                            if (e.target.files?.[0]) {
                                try {
                                    const json = await readExcelFile(e.target.files[0]);
                                    const mappedData = json.map((row: any) => {
                                        const product = products.find(p => p.item_code === row['MA_HANG']);
                                        if (!product) throw new Error(`Không tìm thấy: ${row['MA_HANG']}`);
                                        return {
                                            product_id: product.id,
                                            quantity: Number(row['SO_LUONG'] || 0),
                                            unit_price: Number(row['DON_GIA'] || product.unit_price || 0),
                                            serial_code: row['SERIAL'] ? String(row['SERIAL']) : undefined,
                                            district: row['QUAN_HUYEN'],
                                            item_status: row['TRANG_THAI_HANG']
                                        };
                                    });
                                    await dispatch(importInboundTransactions(mappedData)).unwrap();
                                    success(`Đã nhập thành công ${mappedData.length} giao dịch!`);
                                    dispatch(fetchTransactionsForce()); // Refresh list
                                } catch (e: any) { notifyError(e.message); }
                                e.target.value = '';
                            }
                        }} />
                    </Button>
                </Stack>
            )}

            <InboundForm />

            <InboundList
                onEdit={(item) => {
                    setEditItem(item);
                    setEditData({ ...item });
                    setEditDialog(true);
                }}
                onDelete={(item) => {
                    setItemToDelete(item);
                    setDeleteDialog(true);
                }}
                onBulkDelete={(ids) => {
                    setSelectedIds(ids);
                    setBulkDeleteDialog(true);
                }}
            />

            {/* Edit Dialog */}
            <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Chỉnh sửa giao dịch</DialogTitle>
                <DialogContent>
                    <Box pt={2} display="flex" flexDirection="column" gap={2}>
                        <TextField fullWidth label="Số lượng" type="number" value={editData.quantity} onChange={e => setEditData({ ...editData, quantity: e.target.value })} />
                        <TextField fullWidth label="Đơn giá" type="number" value={editData.unit_price} onChange={e => setEditData({ ...editData, unit_price: e.target.value })} />
                        <TextField fullWidth label="Serial" value={editData.serial_code || ''} onChange={e => setEditData({ ...editData, serial_code: e.target.value })} />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialog(false)}>Hủy</Button>
                    <Button onClick={handleEditSave} variant="contained" color="primary">Lưu</Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
                <DialogTitle>Xác nhận xóa</DialogTitle>
                <DialogContent>Bạn có chắc chắn muốn xóa giao dịch này?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog(false)}>Hủy</Button>
                    <Button onClick={handleDeleteConfirm} color="error" variant="contained">Xóa</Button>
                </DialogActions>
            </Dialog>

            {/* Bulk Delete Confirmation */}
            <Dialog open={bulkDeleteDialog} onClose={() => setBulkDeleteDialog(false)}>
                <DialogTitle>Xác nhận xóa hàng loạt</DialogTitle>
                <DialogContent>Bạn có chắc chắn muốn xóa {selectedIds.length} giao dịch đã chọn?</DialogContent>
                <DialogActions>
                    <Button onClick={() => setBulkDeleteDialog(false)}>Hủy</Button>
                    <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained">Xóa tất cả</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
