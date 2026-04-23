import {
    Button, Dialog, DialogActions, DialogContent, DialogTitle,
    Stack, Alert, Box, TextField, IconButton, Typography
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import SerialChips from '../../components/Common/SerialChips';
import type { Order, Product } from '../../types';

interface FulfillOrderDialogProps {
    open: boolean;
    order: Order | null;
    products: Product[];
    scannedSerials: string[];
    serial: string;
    isProductVerified: boolean;
    fulfillmentStock: number;
    onClose: () => void;
    onConfirm: () => void;
    onSerialChange: (val: string) => void;
    onManualAddSerial: () => void;
    onRemoveSerial: (code: string) => void;
    onOpenScanner: () => void;
}

/**
 * Dialog xác nhận và nhập serial khi xuất kho theo đơn hàng (Staff view)
 */
const FulfillOrderDialog = ({
    open, order, products, scannedSerials, serial,
    isProductVerified, fulfillmentStock,
    onClose, onConfirm, onSerialChange, onManualAddSerial, onRemoveSerial, onOpenScanner
}: FulfillOrderDialogProps) => {
    if (!order) return null;

    const product = products.find(p => p.id === order.product_id);
    const isSerialized = product?.category?.toLowerCase() === 'hàng hóa';
    const isDisabled =
        fulfillmentStock < Number(order.quantity) ||
        (isSerialized && scannedSerials.length !== Number(order.quantity));

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Xác nhận Xuất Kho</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <Alert severity="info" icon={<CheckCircleIcon />}>
                        Đang xuất kho cho đơn hàng:{' '}
                        <b>{order.quantity} {product?.name}</b>
                    </Alert>

                    {isSerialized ? (
                        <Box>
                            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                                <TextField
                                    fullWidth
                                    label="Nhập Serial"
                                    value={serial}
                                    onChange={e => onSerialChange(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            onManualAddSerial();
                                        }
                                    }}
                                    placeholder="Quét mã hoặc nhập tay rồi Enter"
                                />
                                <IconButton
                                    onClick={onOpenScanner}
                                    color="secondary"
                                    sx={{ border: '1px solid', borderColor: 'divider', p: 2 }}
                                >
                                    <QrCodeScannerIcon fontSize="large" />
                                </IconButton>
                            </Stack>

                            <SerialChips
                                serials={scannedSerials}
                                onRemove={onRemoveSerial}
                                maxVisible={10}
                            />

                            {scannedSerials.length === 0 && (
                                <Typography variant="body2" color="text.secondary" p={2} textAlign="center">
                                    Chưa có serial nào được quét.
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <Box textAlign="center" py={2}>
                            <Typography gutterBottom>Sản phẩm này không yêu cầu Serial.</Typography>
                            {isProductVerified ? (
                                <Alert severity="success">Đã xác thực đúng sản phẩm!</Alert>
                            ) : (
                                <Button
                                    variant="outlined"
                                    startIcon={<QrCodeScannerIcon />}
                                    onClick={onOpenScanner}
                                >
                                    Quét mã sản phẩm để xác thực (Tùy chọn)
                                </Button>
                            )}
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Hủy</Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color="secondary"
                    disabled={isDisabled}
                >
                    Hoàn tất Xuất Kho
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default FulfillOrderDialog;
