import React, { useState, useMemo } from 'react';
import {
    Box, Typography, TextField, InputAdornment, Paper, Checkbox, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TablePagination, Button, Chip, Card, CardContent, Divider, Stack, 
    IconButton, useMediaQuery, useTheme, CircularProgress, Grid
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VoiceSearchButton from '../VoiceSearchButton';
import TableSkeleton from '../Common/TableSkeleton';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useDebounce } from '../../hooks/useDebounce';
import type { Transaction } from '../../types';
import { formatDate } from '../../utils/dateUtils';

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

            <Paper elevation={0} sx={{ 
                borderRadius: '16px', 
                border: '1px solid #e2e8f0', 
                overflow: 'hidden',
                bgcolor: 'white',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)'
            }}>
                <Box p={3} borderBottom="1px solid #f1f5f9" display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap">
                    <TextField
                        placeholder="Tìm kiếm SP, Serial, Quận/Huyện..." size="small"
                        value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
                        sx={{ 
                            width: { xs: '100%', sm: 350 },
                            '& .MuiOutlinedInput-root': {
                                bgcolor: '#f8fafc',
                                '& fieldset': { border: 'none' },
                                '&:hover fieldset': { border: 'none' },
                                '&.Mui-focused fieldset': { border: '1px solid #2563eb' }
                            }
                        }}
                        InputProps={{
                            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
                            endAdornment: <VoiceSearchButton onResult={setSearchTerm} />,
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
                                    <Card key={row.id || `card-${idx}`} elevation={0} sx={{ 
                                        borderRadius: '12px', 
                                        border: '1px solid #e2e8f0',
                                        bgcolor: selectedIds.includes(row.id) ? '#eff6ff' : 'white',
                                        transition: 'all 0.2s'
                                    }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                                                <Box display="flex" alignItems="center" gap={1}>
                                                    <Checkbox size="small" sx={{ p: 0 }} checked={selectedIds.includes(row.id)} onChange={e => handleSelectOne(row.id, e.target.checked)} />
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>{row.product?.name || 'Unknown'}</Typography>
                                                </Box>
                                                <Chip label={`SL: ${row.quantity}`} size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }} />
                                            </Box>
                                            <Divider sx={{ my: 1.5, borderColor: '#f1f5f9' }} />
                                            <Grid container spacing={2}>
                                                <Grid size={{ xs: 6 }}>
                                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>SERIAL</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#0f172a' }}>{row.serial_code || '-'}</Typography>
                                                </Grid>
                                                <Grid size={{ xs: 6 }}>
                                                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, display: 'block', mb: 0.5 }}>QUẬN/HUYỆN</Typography>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{row.district || '-'}</Typography>
                                                </Grid>
                                                <Grid size={{ xs: 12 }}>
                                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                        Ngày nhập: {formatDate(row.date || row.inbound_date || null)}
                                                    </Typography>
                                                </Grid>
                                            </Grid>
                                            <Box display="flex" justifyContent="flex-end" gap={1} mt={2}>
                                                <IconButton size="small" onClick={() => onEdit(row)} sx={{ bgcolor: '#f8fafc' }}><EditIcon fontSize="small" color="primary" /></IconButton>
                                                <IconButton size="small" onClick={() => onDelete(row)} sx={{ bgcolor: '#f8fafc' }}><DeleteIcon fontSize="small" color="error" /></IconButton>
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
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell padding="checkbox" sx={{ pl: 3 }}>
                                        <Checkbox
                                            size="small"
                                            indeterminate={selectedIds.length > 0 && selectedIds.length < paginatedTransactions.length}
                                            checked={paginatedTransactions.length > 0 && paginatedTransactions.every(t => selectedIds.includes(t.id))}
                                            onChange={e => handleSelectAll(e.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Thời gian</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Tên vật tư</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Serial</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>SL</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Đơn giá</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Quận/Huyện</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Trạng thái</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', py: 2 }}>Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {txStatus === 'loading' ? (
                                    <TableSkeleton columns={9} rows={rowsPerPage} />
                                ) : paginatedTransactions.length > 0 ? (
                                    paginatedTransactions.map((row) => (
                                        <TableRow 
                                            key={row.id}
                                            sx={{ 
                                                '&:hover': { bgcolor: '#f1f5f9' },
                                                bgcolor: selectedIds.includes(row.id) ? '#eff6ff' : 'inherit',
                                                transition: 'background-color 0.2s'
                                            }}
                                        >
                                            <TableCell padding="checkbox" sx={{ pl: 3 }}>
                                                <Checkbox size="small" checked={selectedIds.includes(row.id)} onChange={e => handleSelectOne(row.id, e.target.checked)} />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '0.875rem' }}>{formatDate(row.date || row.inbound_date || null)}</TableCell>
                                            <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{row.product?.name}</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontSize: '0.875rem' }}>{row.serial_code || '-'}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, color: '#2563eb' }}>{row.quantity}</TableCell>
                                            <TableCell sx={{ fontWeight: 500 }}>{Number(row.unit_price || 0).toLocaleString('vi-VN')} đ</TableCell>
                                            <TableCell>{row.district || '-'}</TableCell>
                                            <TableCell>
                                                <Chip 
                                                    label={row.item_status || 'N/A'} 
                                                    size="small" 
                                                    sx={{ 
                                                        fontWeight: 600, 
                                                        bgcolor: row.item_status === 'Mới' ? '#ecfdf5' : '#fef2f2',
                                                        color: row.item_status === 'Mới' ? '#10b981' : '#ef4444',
                                                        border: 'none'
                                                    }} 
                                                />
                                            </TableCell>
                                            <TableCell align="center">
                                                <Stack direction="row" spacing={1} justifyContent="center">
                                                    <IconButton onClick={() => onEdit(row)} size="small" sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#e2e8f0' } }}><EditIcon fontSize="small" color="primary" /></IconButton>
                                                    <IconButton onClick={() => onDelete(row)} size="small" sx={{ bgcolor: '#f8fafc', '&:hover': { bgcolor: '#fee2e2' } }}><DeleteIcon fontSize="small" color="error" /></IconButton>
                                                </Stack>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}>Không có dữ liệu</TableCell></TableRow>
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
