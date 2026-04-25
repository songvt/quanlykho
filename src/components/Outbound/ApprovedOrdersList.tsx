import React from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, 
    TableContainer, TableHead, TableRow, Button, Chip
} from '@mui/material';
import type { Order, Product } from '../../types';

interface ApprovedOrdersListProps {
    orders: Order[];
    products: Product[];
    onFulfill: (order: Order) => void;
}

const ApprovedOrdersList: React.FC<ApprovedOrdersListProps> = ({ orders, products, onFulfill }) => {
    if (orders.length === 0) return null;

    return (
        <Box mb={4}>
            <Typography variant="h6" gutterBottom fontWeight="bold" color="error">
                ĐƠN HÀNG CẦN XUẤT KHO ({orders.length})
            </Typography>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #ddd' }}>
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
                                            {order.quantity}
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
        </Box>
    );
};

export default ApprovedOrdersList;
