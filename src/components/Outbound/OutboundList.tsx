import React, { useState } from 'react';
import {
    Box, Typography, TextField, InputAdornment, Paper, Checkbox, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TablePagination, Button, Chip, Card, CardContent, Divider, Stack, 
    IconButton, useMediaQuery, useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VoiceSearchButton from '../VoiceSearchButton';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useDebounce } from '../../hooks/useDebounce';

interface OutboundListProps {
    transactions: any[];
    selectedIds: string[];
    onSelectChange: (ids: string[]) => void;
    onDelete?: (id: string) => void;
}

const OutboundList: React.FC<OutboundListProps> = ({ transactions, selectedIds, onSelectChange, onDelete }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const filtered = transactions.filter(t => {
        const s = debouncedSearch.toLowerCase();
        const productName = t.product?.name || t.product_name || '';
        return !s || (
            productName.toLowerCase().includes(s) ||
            t.serial_code?.toLowerCase().includes(s) ||
            t.group_name?.toLowerCase().includes(s) ||
            t.receiver_group?.toLowerCase().includes(s)
        );
    });

    const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    const handleToggleSelectOne = (id: string) => {
        onSelectChange(selectedIds.includes(id) ? selectedIds.filter(i => i !== id) : [...selectedIds, id]);
    };

    return (
        <Box mt={4}>
            <Box mb={2} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h6" fontWeight="bold">Lịch sử xuất kho gần đây</Typography>
                <TextField
                    size="small" placeholder="Tìm nhanh..." value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment>,
                        endAdornment: <VoiceSearchButton onResult={setSearchTerm} />
                    }}
                />
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
                {isMobile ? (
                    <Box p={1}>
                        {paginated.map(t => (
                            <Card key={t.id} variant="outlined" sx={{ mb: 1, borderColor: selectedIds.includes(t.id) ? 'primary.main' : 'divider' }}>
                                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Checkbox size="small" checked={selectedIds.includes(t.id)} onChange={() => handleToggleSelectOne(t.id)} />
                                        <Typography variant="subtitle2" fontWeight="bold">{t.product?.name || t.product_name}</Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">Nhận: {t.group_name || t.receiver_group}</Typography>
                                    <Typography variant="caption" display="block">Serial: {t.serial_code || 'N/A'} | SL: {t.quantity}</Typography>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead sx={{ bgcolor: 'grey.50' }}>
                                <TableRow>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            size="small"
                                            checked={paginated.length > 0 && paginated.every(t => selectedIds.includes(t.id))}
                                            onChange={(e) => {
                                                const ids = e.target.checked ? paginated.map(t => t.id) : [];
                                                onSelectChange(ids);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>Thời gian</TableCell>
                                    <TableCell>Sản phẩm</TableCell>
                                    <TableCell>Serial</TableCell>
                                    <TableCell>Số lượng</TableCell>
                                    <TableCell>Người nhận</TableCell>
                                    <TableCell>Quận/Huyện</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginated.map(t => (
                                    <TableRow key={t.id} selected={selectedIds.includes(t.id)}>
                                        <TableCell padding="checkbox">
                                            <Checkbox size="small" checked={selectedIds.includes(t.id)} onChange={() => handleToggleSelectOne(t.id)} />
                                        </TableCell>
                                        <TableCell>{new Date(t.date).toLocaleString('vi-VN')}</TableCell>
                                        <TableCell fontWeight="500">{t.product?.name || t.product_name}</TableCell>
                                        <TableCell>{t.serial_code || '-'}</TableCell>
                                        <TableCell>{t.quantity}</TableCell>
                                        <TableCell>{t.group_name || t.receiver_group}</TableCell>
                                        <TableCell>{t.district || '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                <TablePagination
                    rowsPerPageOptions={[10, 20]} component="div"
                    count={filtered.length} rowsPerPage={rowsPerPage} page={page}
                    onPageChange={(_, p) => setPage(p)}
                    onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                />
            </Paper>
        </Box>
    );
};

export default OutboundList;
