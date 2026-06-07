import React from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Button, Chip,
    useMediaQuery, useTheme, Card, CardContent, Divider, Stack
} from '@mui/material';
import type { Order, Product } from '../../types';

interface ApprovedOrdersListProps {
    orders: Order[];
    products: Product[];
    onFulfill: (order: Order) => void;
}

const ApprovedOrdersList: React.FC<ApprovedOrdersListProps> = ({ orders, products, onFulfill }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    if (orders.length === 0) return null;

    return (
        <Box mb={4}>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="error">
                ĐƠN HÀNG CẦN XUẤT KHO ({orders.length})
            </Typography>

            {isMobile ? (
                <Stack spacing={1.5}>
                    {orders.map(order => {
                        let isExpired = false;
                        if (order.approved_at) {
                            const approvedTime = new Date(order.approved_at).getTime();
                            isExpired = (Date.now() - approvedTime) > 24 * 60 * 60 * 1000;
                        }
                        const productName = products.find(p => p.id === order.product_id)?.name || 'Sản phẩm không xác định';
                        const sku = products.find(p => p.id === order.product_id)?.item_code || '';

                        return (
                            <Card key={order.id} variant="outlined" sx={{ borderRadius: 2, borderColor: 'divider' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                                        <Typography variant="subtitle2" fontWeight="bold">
                                            {order.requester_group}
                                        </Typography>
                                        {isExpired && (
                                            <Chip label="Hết hạn (24h)" color="error" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                                        )}
                                    </Stack>
                                    
                                    <Typography variant="body2" fontWeight="600" mb={0.5}>
                                        {productName}
                                    </Typography>
                                    {sku && (
                                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                                            SKU: {sku}
                                        </Typography>
                                    )}

                                    <Divider sx={{ my: 1 }} />

                                    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                                        <Typography variant="body2" color="text.secondary">
                                            Số lượng yêu cầu: <b style={{ color: 'var(--brand-primary)' }}>{order.quantity.toLocaleString('vi-VN')}</b>
                                        </Typography>
                                        {!isExpired && (
                                            <Button 
                                                variant="contained" 
                                                color="secondary" 
                                                size="small" 
                                                onClick={() => onFulfill(order)}
                                                sx={{ textTransform: 'none', fontWeight: 'bold' }}
                                            >
                                                Xuất Kho
                                            </Button>
                                        )}
                                    </Stack>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Stack>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd', borderRadius: 2 }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f0f0f0' }}>
                            <TableRow>
                                <TableCell>Người/Đơn vị yêu cầu</TableCell>
                                <TableCell>Sản phẩm</TableCell>
                                <TableCell align="center">SL Yêu cầu</TableCell>
                                <TableCell align="center">Thao tác</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {orders.map(order => {
                                let isExpired = false;
                                if (order.approved_at) {
                                    const approvedTime = new Date(order.approved_at).getTime();
                                    isExpired = (Date.now() - approvedTime) > 24 * 60 * 60 * 1000;
                                }

                                return (
                                    <TableRow key={order.id}>
                                        <TableCell>{order.requester_group}</TableCell>
                                        <TableCell>
                                            <Typography variant="body2" fontWeight="600">
                                                {products.find(p => p.id === order.product_id)?.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <Typography variant="body2" fontWeight="bold" color="primary">
                                                {order.quantity.toLocaleString('vi-VN')}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            {isExpired ? (
                                                <Chip label="Hết hạn (24h)" color="error" size="small" />
                                            ) : (
                                                <Button variant="contained" color="secondary" size="small" onClick={() => onFulfill(order)}>
                                                    Xuất Kho
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default ApprovedOrdersList;
