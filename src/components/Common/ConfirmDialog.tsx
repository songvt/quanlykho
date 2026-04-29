import React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, CircularProgress
} from '@mui/material';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';

interface ConfirmDialogProps {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    severity?: 'danger' | 'warning' | 'success';
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

const severityConfig = {
    danger: {
        icon: <DeleteOutlineRoundedIcon sx={{ fontSize: 48, color: 'error.main' }} />,
        color: 'error' as const,
        bg: '#fef2f2',
    },
    warning: {
        icon: <WarningAmberRoundedIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
        color: 'warning' as const,
        bg: '#fffbeb',
    },
    success: {
        icon: <CheckCircleOutlineRoundedIcon sx={{ fontSize: 48, color: 'success.main' }} />,
        color: 'success' as const,
        bg: '#f0fdf4',
    },
};

const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy bỏ',
    severity = 'danger',
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) => {
    const config = severityConfig[severity];

    return (
        <Dialog
            open={open}
            onClose={loading ? undefined : onCancel}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    overflow: 'hidden',
                }
            }}
        >
            <Box sx={{ bgcolor: config.bg, px: 3, pt: 3, pb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                {config.icon}
                <DialogTitle sx={{ p: 0, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight={700} color="text.primary">
                        {title}
                    </Typography>
                </DialogTitle>
            </Box>

            <DialogContent sx={{ px: 3, pt: 2, pb: 1, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" lineHeight={1.6}>
                    {message}
                </Typography>
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1, justifyContent: 'center' }}>
                <Button
                    onClick={onCancel}
                    disabled={loading}
                    variant="outlined"
                    sx={{ borderRadius: 2, px: 3, flex: 1, fontWeight: 600 }}
                >
                    {cancelLabel}
                </Button>
                <Button
                    onClick={onConfirm}
                    disabled={loading}
                    variant="contained"
                    color={config.color}
                    sx={{ borderRadius: 2, px: 3, flex: 1, fontWeight: 600, minWidth: 120 }}
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                    {loading ? 'Đang xử lý...' : confirmLabel}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ConfirmDialog;
