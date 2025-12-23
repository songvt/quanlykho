import React, { useState, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, IconButton,
    InputAdornment
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import type { Product } from '../types';

interface ProductSearchDialogProps {
    open: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
    products: Product[];
}

const ProductSearchDialog: React.FC<ProductSearchDialogProps> = ({ open, onClose, onSelect, products }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return products;
        const lowerTerm = searchTerm.toLowerCase();
        return products.filter(p =>
            (p.name && p.name.toLowerCase().includes(lowerTerm)) ||
            (p.item_code && p.item_code.toLowerCase().includes(lowerTerm))
        );
    }, [products, searchTerm]);

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
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
                    }}
                    sx={{ mb: 2 }}
                />

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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Đóng</Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProductSearchDialog;
