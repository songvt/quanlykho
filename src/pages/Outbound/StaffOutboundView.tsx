import React from 'react';
import {
    Box, Typography, Button, Chip,
    Paper, TableContainer, Table, TableHead, TableRow,
    TableCell, TableBody, useMediaQuery, useTheme, Card, CardContent, Stack, Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StockDisplay from './StockDisplay';
import type { Order, Product } from '../../types';

import OutboundList from '../../components/Outbound/OutboundList';
import PrintIcon from '@mui/icons-material/Print';
import PageHeader from '../../components/Common/PageHeader';
import OutboxIcon from '@mui/icons-material/Outbox';

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
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    return (
        <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '100%', overflowX: 'hidden', minHeight: '100vh' }}>
            <PageHeader
                title="XUẤT KHO (ĐƠN HÀNG)"
                subtitle="Danh sách các đơn hàng đã được duyệt chờ xuất kho"
                icon={<OutboxIcon sx={{ color: 'white', fontSize: 28 }} />}
                gradientType="blue"
            />

            {/* --- Đơn hàng chờ xuất --- */}
            <Typography variant="h6" gutterBottom fontWeight="bold" color="text.primary" sx={{ mb: 2 }}>
                ĐƠN HÀNG CHỜ XUẤT KHO
            </Typography>

            {isMobile ? (
                <Stack spacing={2} sx={{ mb: 4 }}>
                    {approvedOrders.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0' }}>
                            <Typography color="text.secondary">
                                Không có đơn hàng nào chờ xuất kho.
                            </Typography>
                        </Paper>
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
                                <Card key={order.id} variant="outlined" sx={{ borderRadius: 3, borderColor: 'divider' }}>
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                                Ngày đặt: {new Date(order.order_date).toLocaleDateString('vi-VN')}
                                            </Typography>
                                            {isExpired ? (
                                                <Chip label="Đã hết hạn" color="error" size="small" sx={{ height: 22, fontSize: '0.75rem' }} />
                                            ) : (
                                                <Chip label="Đã duyệt" color="success" size="small" icon={<CheckCircleIcon />} sx={{ height: 22, fontSize: '0.75rem' }} />
                                            )}
                                        </Stack>

                                        <Typography variant="body1" fontWeight={700} color="text.primary">
                                            {product?.name || 'Unknown'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            SKU: {product?.item_code}
                                        </Typography>

                                        <Divider sx={{ my: 1.5 }} />

                                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary" display="block">TỒN KHO</Typography>
                                                <StockDisplay productId={order.product_id} />
                                            </Box>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="caption" color="text.secondary" display="block">YÊU CẦU</Typography>
                                                <Typography variant="body1" fontWeight="bold" color="primary.main">
                                                    {order.quantity}
                                                </Typography>
                                            </Box>
                                        </Stack>

                                        <Button
                                            variant="contained"
                                            color={isExpired ? "inherit" : "secondary"}
                                            fullWidth
                                            size="medium"
                                            onClick={() => onFulfill(order)}
                                            disabled={isExpired}
                                            sx={{ textTransform: 'none', fontWeight: 'bold', borderRadius: '8px' }}
                                        >
                                            Xuất kho
                                        </Button>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </Stack>
            ) : (
                <TableContainer
                    component={Paper}
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', maxWidth: 1200, mx: 'auto', borderRadius: 3, overflowX: 'auto', mb: 4 }}
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
            )}

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
