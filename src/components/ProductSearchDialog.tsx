import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, IconButton,
    InputAdornment, useMediaQuery, useTheme, Card, CardContent, Typography, Stack
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import VoiceSearchButton from './VoiceSearchButton';
import type { Product } from '../types';

interface ProductSearchDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
    products: Product[];
}

const ProductSearchDialog: React.FC<ProductSearchDialogProps> = ({ open, onClose, onSelect, products }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);

    const filteredProducts = useMemo(() => {
        if (!debouncedSearchTerm) return products;
        const lowerTerm = debouncedSearchTerm.toLowerCase();
        return products.filter(p =>
            (p.name && p.name.toLowerCase().includes(lowerTerm)) ||
            (p.item_code && p.item_code.toLowerCase().includes(lowerTerm))
        );
    }, [products, debouncedSearchTerm]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" fullScreen={isMobile}>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                TÌM KIẾM SẢN PHẨM
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <TextField
                    autoFocus
                    margin="dense"
                    label="Nhập tên hoặc mã sản phẩm"
                    type="text"
                    fullWidth
                    variant="outlined"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                        endAdornment: <VoiceSearchButton onResult={setSearchTerm} />
                    }}
                    sx={{ mb: 2 }}
                />

                {isMobile ? (
                    <Stack spacing={1.5} sx={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        {filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                                <Card 
                                    key={product.id} 
                                    variant="outlined" 
                                    onClick={() => {
                                        onSelect(product);
                                        onClose();
                                    }}
                                    sx={{ borderRadius: 2, cursor: 'pointer', '&:active': { bgcolor: 'action.selected' } }}
                                >
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Typography variant="subtitle2" fontWeight="bold" color="primary.main">
                                            {product.item_code}
                                        </Typography>
                                        <Typography variant="body2" sx={{ my: 0.5, fontWeight: 500 }}>
                                            {product.name}
                                        </Typography>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Typography variant="caption" color="text.secondary">
                                                Đơn giá: {product.unit_price?.toLocaleString('vi-VN')} / {product.unit}
                                            </Typography>
                                            <Button 
                                                size="small" 
                                                variant="contained" 
                                                sx={{ py: 0.25, px: 2, textTransform: 'none', fontWeight: 'bold' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelect(product);
                                                    onClose();
                                                }}
                                            >
                                                Chọn
                                            </Button>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))
                        ) : (
                            <Typography color="text.secondary" align="center" py={2}>
                                Không tìm thấy sản phẩm nào.
                            </Typography>
                        )}
                    </Stack>
                ) : (
                    <TableContainer component={Paper} elevation={1} sx={{ maxHeight: 400 }}>
                        <Table stickyHeader size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Mã Hàng</TableCell>
                                    <TableCell>Tên Hàng Hóa</TableCell>
                                    <TableCell>Đơn Giá</TableCell>
                                    <TableCell>Đơn Vị</TableCell>
                                    <TableCell align="center">Thao tác</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredProducts.length > 0 ? (
                                    filteredProducts.map((product) => (
                                        <TableRow
                                            key={product.id}
                                            hover
                                            sx={{ cursor: 'pointer' }}
                                            onClick={() => {
                                                onSelect(product);
                                                onClose();
                                            }}
                                        >
                                            <TableCell>{product.item_code}</TableCell>
                                            <TableCell>{product.name}</TableCell>
                                            <TableCell>{product.unit_price?.toLocaleString('vi-VN')}</TableCell>
                                            <TableCell>{product.unit}</TableCell>
                                            <TableCell align="center">
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onSelect(product);
                                                        onClose();
                                                    }}
                                                >
                                                    Chọn
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            Không tìm thấy sản phẩm nào.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Đóng</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProductSearchDialog;
