import React, { useState, useMemo } from 'react';
import {
    Box, Typography, TextField, InputAdornment, Paper, Checkbox, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TablePagination, Button, Chip, Card, CardContent, Divider, Stack, 
    IconButton, useMediaQuery, useTheme, CircularProgress
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VoiceSearchButton from '../VoiceSearchButton';
import TableSkeleton from '../Common/TableSkeleton';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { useDebounce } from '../../hooks/useDebounce';
import type { Transaction } from '../../types';

interface InboundListProps {
    onEdit: (item: Transaction) => void;
    onDelete: (item: Transaction) => void;
    onBulkDelete: (ids: string[]) => void;
}

const InboundList: React.FC<InboundListProps> = ({ onEdit, onDelete, onBulkDelete }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const { items: transactions, status: txStatus } = useSelector((state: RootState) => state.transactions);
    const { profile } = useSelector((state: RootState) => state.auth);
    const isAdmin = profile?.role === 'admin' || profile?.role === 'manager';

    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const filteredTransactions = useMemo(() => {
        const searchStr = debouncedSearchTerm.toLowerCase();
        const userTransactions = transactions.filter(t => {
            if (isAdmin) return true;
            const anyT = t as any;
            return anyT.user_id === profile?.auth_user_id || 
                   anyT.user_name === profile?.full_name || 
                   anyT.created_by === profile?.auth_user_id ||
                   anyT.created_by === profile?.email;
        });

        return userTransactions
            .filter(t => t.type === 'inbound')
            .filter(t => {
                if (!searchStr) return true;
                return (
                    t.product?.name?.toLowerCase().includes(searchStr) ||
                    t.product?.item_code?.toLowerCase().includes(searchStr) ||
                    (t.serial_code && t.serial_code.toLowerCase().includes(searchStr)) ||
                    (t.district && t.district.toLowerCase().includes(searchStr))
                );
            });
    }, [transactions, debouncedSearchTerm, isAdmin, profile]);

    const paginatedTransactions = filteredTransactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleSelectAll = (checked: boolean) => {
        setSelectedIds(checked ? paginatedTransactions.map(t => t.id) : []);
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id));
    };

    return (
        <Box mt={6}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Typography variant="h5" fontWeight="bold">
                    Danh sách hàng hóa đã nhập
                    {filteredTransactions.length > 0 && (
                        <Chip label={filteredTransactions.length} size="small" color="primary" sx={{ ml: 1.5, fontWeight: 700, fontSize: '0.8rem' }} />
                    )}
                </Typography>
                {selectedIds.length > 0 && (
                    <Button
                        variant="contained" color="error" startIcon={<DeleteIcon />}
                        onClick={() => { onBulkDelete(selectedIds); setSelectedIds([]); }}
                        sx={{ fontWeight: 700, borderRadius: 2 }}
                    >
                        Xóa {selectedIds.length} mục đã chọn
                    </Button>
                )}
            </Box>

            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
                <Box p={2} borderBottom="1px solid" borderColor="divider" display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                    <TextField
                        placeholder="Tìm kiếm theo Tên SP, Serial, Quận/Huyện..." size="small"
                        value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                        sx={{ width: { xs: '100%', sm: 350 } }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                            endAdornment: <VoiceSearchButton onResult={setSearchTerm} />,
                            sx: { borderRadius: 2 }
                        }}
                    />
                </Box>

                {isMobile ? (
                    <Box p={2}>
                        {txStatus === 'loading' ? (
                            <Box display="flex" justifyContent="center"><CircularProgress /></Box>
                        ) : paginatedTransactions.length > 0 ? (
                            <Stack spacing={2}>
                                {paginatedTransactions.map((row, idx) => (
                                    <Card key={row.id || `card-${idx}`} variant="outlined" sx={{ borderRadius: 2, borderColor: selectedIds.includes(row.id) ? 'primary.main' : 'divider', bgcolor: selectedIds.includes(row.id) ? 'primary.50' : 'white' }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Checkbox size="small" sx={{ p: 0 }} checked={selectedIds.includes(row.id)} onChange={e => handleSelectOne(row.id, e.target.checked)} />
                                                    <Typography variant="subtitle2" fontWeight="bold" color="primary">{row.product?.name || 'Unknown'}</Typography>
                                                </Box>
                                                <Typography variant="body2" fontWeight="bold">SL: {row.quantity}</Typography>
                                            </Box>
                                            <Divider sx={{ my: 1 }} />
                                            <Grid container spacing={1}>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Serial</Typography>
                                                    <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>{row.serial_code || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={6}>
                                                    <Typography variant="caption" color="text.secondary">Quận/Huyện</Typography>
                                                    <Typography variant="body2">{row.district || '-'}</Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Typography variant="caption" color="text.secondary">Thời gian: {new Date(row.date || row.inbound_date || '').toLocaleString('vi-VN')}</Typography>
                                                </Grid>
                                            </Grid>
                                            <Box display="flex" justifyContent="flex-end" gap={1} mt={1}>
                                                <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(row)}>Sửa</Button>
                                                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => onDelete(row)}>Xóa</Button>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        ) : (
                            <Typography textAlign="center" color="text.secondary" py={3}>Không có dữ liệu</Typography>
                        )}
                    </Box>
                ) : (
                    <TableContainer>
                        <Table sx={{ minWidth: 800 }}>
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                                <TableRow>
                                    <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                        <Checkbox
                                            size="small"
                                            indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedTransactions.length}
                                            checked={paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.includes(t.id))}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Thời gian</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Tên vật tư</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Serial</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>SL</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Đơn giá</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Quận/Huyện</TableCell>
                                    <TableCell sx={{ fontWeight: 600 }}>Trạng thái</TableCell>
                                    <TableCell sx={{ fontWeight: 600, align: 'center' }}>Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {txStatus === 'loading' ? (
                                    <TableSkeleton columns={9} rows={rowsPerPage} />
                                ) : paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell padding="checkbox" sx={{ pl: 1.5 }}>
                                                <Checkbox size="small" checked={selectedIds.includes(row.id)} onChange={e => handleSelectOne(row.id, e.target.checked)} />
                                            </TableCell>
                                            <TableCell>{new Date(row.date || row.inbound_date || '').toLocaleString('vi-VN')}</TableCell>
                                            <TableCell sx={{ fontWeight: 500 }}>{row.product?.name}</TableCell>
                                            <TableCell>{row.serial_code || '-'}</TableCell>
                                            <TableCell>{row.quantity}</TableCell>
                                            <TableCell>{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</TableCell>
                                            <TableCell>{row.district || '-'}</TableCell>
                                            <TableCell><Chip label={row.item_status || 'N/A'} size="small" variant="outlined" /></TableCell>
                                            <TableCell align="center">
                                                <IconButton onClick={() => onEdit(row)} size="small" color="primary"><EditIcon fontSize="small" /></IconButton>
                                                <IconButton onClick={() => onDelete(row)} size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 3 }}>Không có dữ liệu</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                <TablePagination
                    rowsPerPageOptions={[10, 25, 50]} component="div"
                    count={filteredTransactions.length} rowsPerPage={rowsPerPage} page={page}
                    onPageChange={(_, newPage) => setPage(newPage)}
                    onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    labelRowsPerPage="Số hàng:"
                />
            </Paper>
        </Box>
    );
};

export default InboundList;
