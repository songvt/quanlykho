import React from 'react';
import {
    Box, Typography, Button, Chip,
    Paper, TableContainer, Table, TableHead, TableRow,
    TableCell, TableBody
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StockDisplay from './StockDisplay';
import type { Order, Product } from '../../types';

import OutboundList from '../../components/Outbound/OutboundList';
import PrintIcon from '@mui/icons-material/Print';

interface StaffOutboundViewProps {
    approvedOrders: Order[];
    transactions: any[];
    products: Product[];
    onFulfill: (order: Order) => void;
    selectedPrintIds: string[];
    onSelectChange: (ids: string[]) => void;
    onPrint: () => void;
}

/**
 * View dành riêng cho Staff (non-admin):
 * Hiển thị danh sách đơn hàng đã duyệt + lịch sử đã xuất
 */
const StaffOutboundView = ({
    approvedOrders,
    transactions,
    products,
    onFulfill,
    selectedPrintIds,
    onSelectChange,
    onPrint,
}: StaffOutboundViewProps) => {
    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', overflowX: 'hidden', minHeight: '100vh' }}>
            <Box mb={{ xs: 2, sm: 4 }} textAlign="center">
                <Typography
                    variant="h3"
                    fontWeight="bold"
                    color="text.primary"
                    gutterBottom
                    sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '3rem' } }}
                >
                    Xuất Kho (Đơn Hàng)
                </Typography>
                <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ fontSize: { xs: '0.875rem', sm: '1rem', md: '1.25rem' } }}
                >
                    Danh sách các đơn hàng đã được duyệt chờ xuất kho
                </Typography>
            </Box>

            {/* --- Đơn hàng chờ xuất --- */}
            <TableContainer
                component={Paper}
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 1200, mx: 'auto', borderRadius: 3, overflowX: 'auto' }}
            >
                <Table size="small" sx={{ minWidth: 800 }}>
                    <TableHead sx={{ bgcolor: 'grey.50' }}>
                        <TableRow>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Ngày đặt</TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Sản phẩm</TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Tồn kho</TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>SL Yêu cầu</TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Trạng thái</TableCell>
                            <TableCell align="center" sx={{ whiteSpace: 'nowrap', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>Thao tác</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {approvedOrders.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Không có đơn hàng nào chờ xuất kho.
                                </TableCell>
                            </TableRow>
                        ) : (
                            approvedOrders.map(order => {
                                const product = products.find(p => p.id === order.product_id);
                                
                                let isExpired = false;
                                if (order.approved_at) {
                                    const approvedTime = new Date(order.approved_at).getTime();
                                    const now = new Date().getTime();
                                    isExpired = (now - approvedTime) > 24 * 60 * 60 * 1000;
                                }

                                return (
                                    <TableRow key={order.id} hover>
                                        <TableCell sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                            {new Date(order.order_date).toLocaleDateString('vi-VN')}
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="subtitle2" sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                                {product?.name || 'Unknown'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
                                                {product?.item_code}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <StockDisplay productId={order.product_id} />
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 'bold', fontSize: { xs: '0.75rem', sm: '0.875rem' } }}>
                                            {order.quantity}
                                        </TableCell>
                                        <TableCell align="center">
                                            {isExpired ? (
                                                <Chip label="Đã hết hạn" color="error" size="small" sx={{ height: 24, fontSize: '0.75rem' }} />
                                            ) : (
                                                <Chip label="Đã duyệt" color="success" size="small" icon={<CheckCircleIcon />} sx={{ height: 24, fontSize: '0.75rem' }} />
                                            )}
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                variant="contained"
                                                color={isExpired ? "inherit" : "secondary"}
                                                size="small"
                                                onClick={() => onFulfill(order)}
                                                disabled={isExpired}
                                                sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' }, minWidth: 64 }}
                                            >
                                                Xuất kho
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* --- Lịch sử đã xuất --- */}
            <Box mt={6} mb={{ xs: 2, sm: 4 }} textAlign="center">
                <Typography variant="h5" color="text.secondary" sx={{ fontSize: { xs: '1.2rem', sm: '1.5rem' }, mb: 2 }}>
                    Lịch Sử Xuất Kho Của Bạn
                </Typography>
                <Button
                    variant="contained" color="secondary" startIcon={<PrintIcon />}
                    disabled={selectedPrintIds.length === 0}
                    onClick={onPrint}
                    sx={{ mb: 2 }}
                >
                    In Biên Bản ({selectedPrintIds.length})
                </Button>
            </Box>
            
            <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 4 }}>
                <OutboundList 
                    transactions={transactions}
                    selectedIds={selectedPrintIds}
                    onSelectChange={onSelectChange}
                />
            </Box>
        </Box>
    );
};

export default StaffOutboundView;
