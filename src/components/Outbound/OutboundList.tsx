import React, { useState } from 'react';
import {
    Box, Typography, TextField, InputAdornment, Paper, Checkbox, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    TablePagination, Card, CardContent, 
    useMediaQuery, useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VoiceSearchButton from '../VoiceSearchButton';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/dateUtils';

interface OutboundListProps {
    transactions: any[];
    selectedIds: string[];
    onSelectChange: (ids: string[]) => void;
}

const OutboundList: React.FC<OutboundListProps> = ({ transactions, selectedIds, onSelectChange }) => {
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
            <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>
                    Lịch sử xuất kho
                </Typography>
                <TextField
                    size="small" 
                    placeholder="Tìm mã sản phẩm, serial..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    sx={{ 
                        width: isMobile ? '100%' : 300,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: '8px',
                            backgroundColor: '#ffffff',
                        }
                    }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>,
                        endAdornment: <VoiceSearchButton onResult={setSearchTerm} />
                    }}
                />
            </Box>

            <Paper 
                elevation={0} 
                sx={{ 
                    borderRadius: '16px', 
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)'
                }}
            >
                {isMobile ? (
                    <Box p={2}>
                        {paginated.map(t => (
                            <Card 
                                key={t.id} 
                                elevation={0}
                                sx={{ 
                                    mb: 2, 
                                    borderRadius: '12px',
                                    border: '1px solid',
                                    borderColor: selectedIds.includes(t.id) ? '#2563eb' : '#e2e8f0',
                                    backgroundColor: selectedIds.includes(t.id) ? '#eff6ff' : '#ffffff',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                                        <Checkbox 
                                            size="small" 
                                            checked={selectedIds.includes(t.id)} 
                                            onChange={() => handleToggleSelectOne(t.id)} 
                                            sx={{ p: 0, color: '#cbd5e1', '&.Mui-checked': { color: '#2563eb' } }}
                                        />
                                        <Typography sx={{ fontWeight: 600, color: '#0f172a' }}>
                                            {t.product?.name || t.product_name}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ pl: 4 }}>
                                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5 }}>
                                            Nhận: <span style={{ color: '#334155', fontWeight: 500 }}>{t.receiver_name || t.full_name || t.group_name || t.receiver_group || t.receiver || '-'}</span>
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', gap: 2 }}>
                                            <span>Serial: <b>{t.serial_code || 'N/A'}</b></span>
                                            <span>SL: <b>{t.quantity}</b></span>
                                        </Typography>
                                    </Box>
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                ) : (
                    <TableContainer>
                        <Table sx={{ minWidth: 650 }}>
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell padding="checkbox" sx={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <Checkbox
                                            size="small"
                                            checked={paginated.length > 0 && paginated.every(t => selectedIds.includes(t.id))}
                                            onChange={(e) => {
                                                const ids = e.target.checked ? paginated.map(t => t.id) : [];
                                                onSelectChange(ids);
                                            }}
                                            sx={{ color: '#cbd5e1', '&.Mui-checked': { color: '#2563eb' } }}
                                        />
                                    </TableCell>
                                    {['Thời gian', 'Sản phẩm', 'Serial', 'Số lượng', 'Người nhận', 'Quận/Huyện'].map((head) => (
                                        <TableCell key={head} sx={{ 
                                            color: '#64748b', 
                                            fontWeight: 600, 
                                            fontSize: '0.875rem',
                                            borderBottom: '1px solid #e2e8f0',
                                            py: 2
                                        }}>
                                            {head}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {paginated.map(t => (
                                    <TableRow 
                                        key={t.id} 
                                        selected={selectedIds.includes(t.id)}
                                        sx={{ 
                                            '&:hover': { bgcolor: '#f1f5f9 !important' },
                                            '&.Mui-selected': { bgcolor: '#eff6ff !important' },
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <TableCell padding="checkbox" sx={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <Checkbox 
                                                size="small" 
                                                checked={selectedIds.includes(t.id)} 
                                                onChange={() => handleToggleSelectOne(t.id)}
                                                sx={{ color: '#cbd5e1', '&.Mui-checked': { color: '#2563eb' } }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                                            {formatDate(t.date || t.outbound_date)}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#0f172a' }}>
                                            {t.product?.name || t.product_name}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', color: '#334155', fontStyle: 'italic' }}>
                                            {t.serial_code || '-'}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: '#2563eb' }}>
                                            {t.quantity}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', color: '#334155' }}>
                                            {t.receiver_name || t.full_name || t.group_name || t.receiver_group || t.receiver || '-'}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: '1px solid #f1f5f9', color: '#64748b' }}>
                                            {t.district || '-'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
                <TablePagination
                    rowsPerPageOptions={[10, 20]} 
                    component="div"
                    count={filtered.length} 
                    rowsPerPage={rowsPerPage} 
                    page={page}
                    onPageChange={(_, p) => setPage(p)}
                    onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                    sx={{ borderTop: '1px solid #e2e8f0', color: '#64748b' }}
                />
            </Paper>
        </Box>
    );
};

export default OutboundList;
