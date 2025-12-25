import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Stack,
    CircularProgress, Alert, Chip, Select, MenuItem, FormControl, InputLabel, Checkbox, Autocomplete
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SearchIcon from '@mui/icons-material/Search';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteIcon from '@mui/icons-material/Delete';
import { InputAdornment } from '@mui/material';
import ProductSearchDialog from '../../components/ProductSearchDialog';


import { fetchOrders, addOrder, updateOrderStatus, deleteOrders } from '../../store/slices/ordersSlice';
import { fetchProducts } from '../../store/slices/productsSlice'; // Need products for the dropdown
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';
import type { Order } from '../../types';
import { usePermission } from '../../hooks/usePermission';

const OrderList = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: orders, status: orderStatus, error } = useSelector((state: RootState) => state.orders);
    const { items: products, status: productStatus } = useSelector((state: RootState) => state.products);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { hasPermission } = usePermission();

    // Permissions
    const canViewAll = hasPermission('orders.view_all');
    const canCreate = hasPermission('orders.create');
    const canApprove = hasPermission('orders.approve');
    const canDelete = hasPermission('orders.delete');

    // Legacy isAdmin for logic not strictly covered by basic permissions if any, or just strictly replaced
    const isAdmin = canViewAll; // For backward compatibility in this file mostly meant view_all or manage

    const [openDialog, setOpenDialog] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newOrder, setNewOrder] = useState({
        product_id: '',
        quantity: 1,
        requester_group: '',
    });
    const [showProductSearch, setShowProductSearch] = useState(false);


    const [inventory, setInventory] = useState<Record<string, number>>({});
    const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

    // Date Filter State
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    useEffect(() => {
        if (orderStatus === 'idle') dispatch(fetchOrders());
        if (productStatus === 'idle') dispatch(fetchProducts());
        if (isAdmin && employeeStatus === 'idle') dispatch(fetchEmployees());

        // Fetch inventory snapshot
        const loadInventory = async () => {
            try {
                const stock = await import('../../services/SupabaseService').then(m => m.SupabaseService.getInventorySnapshot());
                setInventory(stock.total);
            } catch (error) {
                console.error("Failed to load inventory for orders dropdown", error);
            }
        };
        loadInventory();
    }, [orderStatus, productStatus, employeeStatus, dispatch, isAdmin]);

    const handleOpenAdd = () => {
        setNewOrder({
            product_id: '',
            quantity: 1,
            requester_group: isAdmin ? '' : (profile?.full_name || profile?.username || profile?.email || ''),
        });
        setOpenDialog(true);
    };

    const handleSave = async () => {
        if (!newOrder.product_id || !newOrder.requester_group) {
            alert('Vui lòng điền đầy đủ thông tin');
            return;
        }

        try {
            await dispatch(addOrder({
                ...newOrder,
                status: 'pending',
                created_by: profile?.id
            })).unwrap();
            setOpenDialog(false);
        } catch (err) {
            console.error('Failed to add order:', err);
            // Optionally set validation error state here
        }
    };

    const handleUpdateStatus = async (id: string, status: Order['status']) => {
        if (window.confirm(`Bạn có chắc chắn muốn chuyển trạng thái đơn hàng này thành "${status}"?`)) {
            await dispatch(updateOrderStatus({ id, status }));
        }
    };

    const handleBulkApprove = async () => {
        if (window.confirm(`Bạn có chắc chắn muốn DUYỆT ${selectedOrderIds.length} đơn hàng đã chọn?`)) {
            try {
                // Execute sequentially or Promise.all. Promise.all is faster but risky if one fails.
                // Considering SupabaseService might not support bulk update yet, we loop.
                await Promise.all(selectedOrderIds.map(id => dispatch(updateOrderStatus({ id, status: 'approved' })).unwrap()));

                setSelectedOrderIds([]); // Clear selection
                alert('Đã duyệt thành công!');
            } catch (err) {
                console.error("Bulk approve failed", err);
                alert('Có lỗi xảy ra khi duyệt hàng loạt.');
            }
        }
    };

    const getStatusChip = (status: string) => {
        switch (status) {
            case 'approved': return <Chip label="Đã duyệt" color="success" size="small" icon={<CheckCircleIcon />} />;
            case 'completed': return <Chip label="Hoàn thành" color="primary" size="small" icon={<CheckCircleIcon />} />;
            case 'rejected': return <Chip label="Từ chối" color="error" size="small" icon={<CancelIcon />} />;
            default: return <Chip label="Chờ duyệt" color="warning" size="small" icon={<HourglassEmptyIcon />} />;
        }
    };

    // Filter orders based on permissions
    const visibleOrders = canViewAll ? orders : orders.filter(o => {
        const isCreator = o.created_by === profile?.id;
        const isRequester = o.requester_group === (profile?.full_name || profile?.username || profile?.email);
        return isCreator || isRequester;
    });

    const filteredOrders = visibleOrders.filter(order => {
        const product = products.find(p => p.id === order.product_id);
        const term = searchTerm.toLowerCase();

        // Date Filter
        const d = new Date(order.order_date);
        const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (startDate && orderDate < startDate) return false;
        if (endDate && orderDate > endDate) return false;

        return (
            (order.requester_group || '').toLowerCase().includes(term) ||
            (product?.name || '').toLowerCase().includes(term) ||
            order.id.toLowerCase().includes(term)
        );
    });

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            // For deletion, we might want to select all visible orders.
            // For approval, only pending.
            // Let's just select all visible filtered orders for simplicity, actions will filter valid ones if needed.
            // But approvals only work on pending.
            // Let's stick to selecting all filtered orders here.
            setSelectedOrderIds(filteredOrders.map(o => o.id));
        } else {
            setSelectedOrderIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedOrderIds(prev => [...prev, id]);
        } else {
            setSelectedOrderIds(prev => prev.filter(oid => oid !== id));
        }
    };

    const handleBulkDelete = async () => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedOrderIds.length} đơn hàng đã chọn?`)) {
            try {
                // @ts-ignore
                await dispatch(deleteOrders(selectedOrderIds)).unwrap();
                setSelectedOrderIds([]);
                alert('Đã xóa thành công!');
            } catch (err) {
                console.error('Bulk delete failed:', err);
                alert('Lỗi khi xóa đơn hàng.');
            }
        }
    }

    if (orderStatus === 'loading') return <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>;
    if (orderStatus === 'failed') return <Alert severity="error">{error}</Alert>;

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', mx: 'auto' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={{ xs: 2, sm: 4 }} spacing={2}>
                <Box>
                    <Typography variant="h4" fontWeight="900" sx={{
                        fontSize: { xs: '1.5rem', sm: '2.125rem' },
                        textTransform: 'uppercase',
                        background: 'linear-gradient(45deg, #ed6c02 30%, #ffb74d 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        letterSpacing: '0.5px'
                    }}>
                        QUẢN LÝ ĐẶT HÀNG
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: '0.875rem', sm: '1rem' }, mt: 0.5 }}>Quản lý yêu cầu đặt hàng từ các đơn vị</Typography>
                </Box>
                <Stack direction="row" spacing={1} alignItems="center" width={{ xs: '100%', sm: 'auto' }} flexWrap="wrap" useFlexGap sx={{ gap: 1 }}>
                    {canDelete && selectedOrderIds.length > 0 && (
                        <>
                            <Button
                                variant="contained"
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={handleBulkDelete}
                                sx={{ borderRadius: 2, flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                            >
                                Xóa ({selectedOrderIds.length})
                            </Button>
                            {/* Only show 'Approve' if there are pending orders selected */}
                            {canApprove && selectedOrderIds.some(id => orders.find(o => o.id === id)?.status === 'pending') && (
                                <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    startIcon={<DoneAllIcon />}
                                    onClick={handleBulkApprove}
                                    sx={{ borderRadius: 2, flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                                >
                                    Duyệt
                                </Button>
                            )}
                        </>
                    )}

                    <TextField
                        size="small"
                        type="date"
                        label="Từ ngày"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: 'white', borderRadius: 2, width: { xs: '48%', sm: 'auto' } }}
                    />
                    <TextField
                        size="small"
                        type="date"
                        label="Đến ngày"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                        sx={{ bgcolor: 'white', borderRadius: 2, width: { xs: '48%', sm: 'auto' } }}
                    />
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
                            sx: { borderRadius: 2, bgcolor: 'white', fontSize: { xs: '0.8rem', sm: '1rem' } }
                        }}
                        sx={{ flex: { xs: 1, sm: 'none' }, minWidth: '150px' }}
                    />
                    {canCreate && (
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={handleOpenAdd}
                            sx={{ px: 2, py: 1, borderRadius: 2, whiteSpace: 'nowrap', flex: { xs: 1, sm: 'none' }, fontSize: { xs: '0.75rem', sm: '0.875rem' } }}
                        >
                            Tạo mới
                        </Button>
                    )}
                </Stack>
            </Stack>

            <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1)', overflowX: 'auto' }}>
                <Table size="small" sx={{ minWidth: 800 }}>
                    <TableHead>
                        <TableRow>
                            {(canDelete || canApprove) && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={filteredOrders.length > 0 && selectedOrderIds.length === filteredOrders.length}
                                        indeterminate={selectedOrderIds.length > 0 && selectedOrderIds.length < filteredOrders.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                        // disabled={pendingOrders.length === 0} // Enable even if no pending, just orders
                                        size="small"
                                    />
                                </TableCell>
                            )}
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Ngày đặt</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Nhân viên</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Vật tư hàng hóa</TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Tồn kho</TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Số lượng</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Trạng thái</TableCell>
                            {(canApprove) && (
                                <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.7rem', sm: '0.875rem' }, py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>Thao tác</TableCell>
                            )}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={(canDelete || canApprove) ? 8 : 7} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: '0.875rem' }}>Chưa có đơn hàng nào phù hợp</TableCell>
                            </TableRow>
                        ) : (
                            filteredOrders.map((order) => {
                                const isSelected = selectedOrderIds.includes(order.id);

                                return (
                                    <TableRow key={order.id} hover sx={{ transition: 'all 0.2s', bgcolor: isSelected ? 'action.selected' : 'inherit' }}>
                                        {canDelete && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={(e) => handleSelectOne(order.id, e.target.checked)}
                                                    size="small"
                                                />
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 }, fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                            {new Date(order.order_date).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>
                                            <Typography variant="body2" fontWeight="500" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{order.requester_group}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>
                                            <Box>
                                                <Typography variant="body2" fontWeight="600" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>
                                                    {products.find(p => p.id === order.product_id)?.name || 'Unknown Product'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.6rem', sm: '0.75rem' } }}>
                                                    SKU: {products.find(p => p.id === order.product_id)?.item_code}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell align="center" sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>
                                            <Chip
                                                label={inventory[order.product_id] || 0}
                                                size="small"
                                                color={(inventory[order.product_id] || 0) > 0 ? 'default' : 'error'}
                                                variant="outlined"
                                            />
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>
                                            <Typography variant="body2" fontWeight="bold" sx={{ fontSize: { xs: '0.7rem', sm: '0.875rem' } }}>{order.quantity}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ py: { xs: 0.5, sm: 1 }, px: { xs: 1, sm: 2 } }}>{getStatusChip(order.status)}</TableCell>

                                        {(canApprove) && (
                                            <TableCell align="center">
                                                {order.status === 'pending' && (
                                                    <Stack direction="row" spacing={1} justifyContent="center">
                                                        <Button
                                                            size="small"
                                                            variant="contained"
                                                            color="success"
                                                            onClick={() => handleUpdateStatus(order.id, 'approved')}
                                                            sx={{ minWidth: 0, px: 2 }}
                                                        >
                                                            Duyệt
                                                        </Button>
                                                        <Button
                                                            size="small"
                                                            variant="outlined"
                                                            color="error"
                                                            onClick={() => handleUpdateStatus(order.id, 'rejected')}
                                                            sx={{ minWidth: 0, px: 2 }}
                                                        >
                                                            Từ chối
                                                        </Button>
                                                    </Stack>
                                                )}
                                                {order.status === 'approved' && (
                                                    <Button
                                                        size="small"
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={() => handleUpdateStatus(order.id, 'completed')}
                                                    >
                                                        Hoàn tất
                                                    </Button>
                                                )}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Add Order Dialog */}
            <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', pb: 2 }}>
                    <Typography variant="h6" fontWeight="900" sx={{ textTransform: 'uppercase', color: 'primary.main' }}>
                        TẠO ĐƠN HÀNG MỚI
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {isAdmin ? (
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => {
                                    const name = typeof option === 'string' ? option : option.full_name;
                                    return name.replace(/\(\s*\)/g, '').trim();
                                }}
                                value={employees.find(e => e.full_name === newOrder.requester_group) || null}
                                onChange={(_, newValue) => {
                                    setNewOrder({ ...newOrder, requester_group: newValue ? newValue.full_name : '' });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Nhân viên"
                                        placeholder="Tìm kiếm nhân viên..."
                                    />
                                )}
                            />
                        ) : (
                            <TextField
                                label="Nhân viên"
                                fullWidth
                                value={newOrder.requester_group}
                                InputProps={{ readOnly: true }}
                                disabled
                            />
                        )}



                        <Box display="flex" alignItems="center" gap={1}>
                            <FormControl fullWidth>
                                <InputLabel>Vật tư hàng hóa</InputLabel>
                                <Select
                                    value={newOrder.product_id}
                                    label="Vật tư hàng hóa"
                                    onChange={(e) => setNewOrder({ ...newOrder, product_id: e.target.value })}
                                >
                                    {products
                                        .map((p) => (
                                            <MenuItem key={p.id} value={p.id}>
                                                {p.name} ({p.item_code}) - Tồn: {inventory[p.id] || 0}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                            <Button
                                variant="outlined"
                                sx={{ height: 56, minWidth: 50, px: 0 }}
                                onClick={() => setShowProductSearch(true)}
                            >
                                <SearchIcon />
                            </Button>
                        </Box>

                        <TextField
                            label="Số lượng"
                            type="number"
                            fullWidth
                            value={newOrder.quantity}
                            onChange={(e) => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })}
                            inputProps={{ min: 1 }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Hủy</Button>
                    <Button onClick={handleSave} variant="contained">Tạo đơn</Button>
                </DialogActions>
            </Dialog>


            <ProductSearchDialog
                open={showProductSearch}
                onClose={() => setShowProductSearch(false)}
                products={products}
                onSelect={(product) => {
                    setNewOrder(prev => ({ ...prev, product_id: product.id }));
                    setShowProductSearch(false);
                }}
            />
        </Box >
    );
};

export default OrderList;
