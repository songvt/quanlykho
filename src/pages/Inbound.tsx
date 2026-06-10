import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../store/slices/productsSlice';
import { fetchInventory } from '../store/slices/inventorySlice';
import { fetchTransactions, updateTransaction, deleteTransaction, bulkDeleteTransactions, syncInStock, importInboundTransactions, fetchTransactionsForce } from '../store/slices/transactionsSlice';
import type { RootState, AppDispatch } from '../store';
import type { Transaction } from '../types';
import {
    Button, TextField, Typography, Box, CircularProgress, Dialog, DialogContent, DialogTitle,
    DialogActions, Stack, Tooltip
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import { AppButton } from '../components/Common/AppButton';
import { generateInboundTemplate, readExcelFile } from '../utils/excelUtils';
import { useNotification } from '../contexts/NotificationContext';
import InboundForm from '../components/Inbound/InboundForm';
import InboundList from '../components/Inbound/InboundList';
import PageHeader from '../components/Common/PageHeader';
import MoveToInboxIcon from '@mui/icons-material/MoveToInbox';

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
            <PageHeader
                title="NHẬP HÀNG HÓA"
                subtitle="Quản lý phiếu nhập kho và cập nhật số lượng tồn kho thời gian thực"
                icon={<MoveToInboxIcon sx={{ color: 'white', fontSize: 28 }} />}
                gradientType="blue"
                actions={
                    isAdmin ? (
                         <>
                            <AppButton
                                variant="contained"
                                icon={isSyncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                                onClick={async () => {
                                    setIsSyncing(true);
                                    try {
                                        const res = await dispatch(syncInStock()).unwrap();
                                        success(res.message || 'Đồng bộ thành công!');
                                    } catch (e: any) { notifyError(e.message); }
                                    finally { setIsSyncing(false); }
                                }}
                                disabled={isSyncing}
                                sx={{ 
                                    borderRadius: '12px', 
                                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    backdropFilter: 'blur(5px)',
                                    width: 46,
                                    height: 46,
                                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }
                                }}
                                title={isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ từ kho tổng'}
                            />
                            <AppButton 
                                variant="contained" 
                                onClick={generateInboundTemplate} 
                                icon={<FileDownloadIcon />}
                                sx={{ 
                                    borderRadius: '12px', 
                                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.3)',
                                    backdropFilter: 'blur(5px)',
                                    width: 46,
                                    height: 46,
                                    '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.3)' }
                                }}
                                title="Tải mẫu Excel"
                            />
                            <AppButton 
                                variant="contained" 
                                component="label" 
                                icon={<CloudUploadIcon />}
                                sx={{ 
                                    borderRadius: '12px', 
                                    bgcolor: '#ffffff',
                                    color: '#2563eb',
                                    width: 46,
                                    height: 46,
                                    '&:hover': { bgcolor: '#f8fafc', transform: 'translateY(-1px)' }
                                }}
                                title="Nhập Excel"
                            >
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
                            </AppButton>
                        </>
                    ) : undefined
                }
            />

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
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setEditDialog(false)} icon={<CloseIcon />} title="Hủy" />
                    <AppButton onClick={handleEditSave} variant="contained" color="primary" icon={<SaveIcon />} title="Lưu" />
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
                <DialogTitle>Xác nhận xóa</DialogTitle>
                <DialogContent>Bạn có chắc chắn muốn xóa giao dịch này?</DialogContent>
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setDeleteDialog(false)} icon={<CloseIcon />} title="Hủy" />
                    <AppButton onClick={handleDeleteConfirm} color="error" variant="contained" icon={<DeleteIcon />} title="Xóa" />
                </DialogActions>
            </Dialog>

            {/* Bulk Delete Confirmation */}
            <Dialog open={bulkDeleteDialog} onClose={() => setBulkDeleteDialog(false)}>
                <DialogTitle>Xác nhận xóa hàng loạt</DialogTitle>
                <DialogContent>Bạn có chắc chắn muốn xóa {selectedIds.length} giao dịch đã chọn?</DialogContent>
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setBulkDeleteDialog(false)} icon={<CloseIcon />} title="Hủy" />
                    <AppButton onClick={handleBulkDeleteConfirm} color="error" variant="contained" icon={<DeleteIcon />} title="Xóa tất cả" />
                </DialogActions>
            </Dialog>
        </Box>
    );
};
