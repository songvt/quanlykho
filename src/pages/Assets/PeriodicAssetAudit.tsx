import React, { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogContent, DialogTitle, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { CameraAlt, CheckCircle, QrCodeScanner, Save } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { useNotification } from '../../contexts/NotificationContext';

const normalizeCode = (value: string) => value.trim().toLocaleUpperCase('vi');

const PeriodicAssetAudit = () => {
    const { profile } = useSelector((state: RootState) => state.auth);
    const { error, success } = useNotification();
    const [assetCode, setAssetCode] = useState('');
    const [scanMode, setScanMode] = useState<'single' | 'continuous'>('single');
    const [scannedCodes, setScannedCodes] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [lastRecord, setLastRecord] = useState<any>(null);
    const [scannerOpen, setScannerOpen] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scanLockedRef = useRef(false);

    useEffect(() => {
        if (!scannerOpen) return;
        let disposed = false;
        scanLockedRef.current = false;

        const startScanner = async () => {
            try {
                // Dialog cần được gắn vào DOM trước khi html5-qrcode khởi tạo camera.
                await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
                if (disposed) return;
                const scanner = new Html5Qrcode('periodic-audit-reader');
                scannerRef.current = scanner;
                await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, (decodedText) => {
                    if (scanLockedRef.current) return;
                    const code = normalizeCode(decodedText);
                    if (scanMode === 'continuous') {
                        scanLockedRef.current = true;
                        setScannedCodes(previous => previous.includes(code) ? previous : [...previous, code]);
                        window.setTimeout(() => { scanLockedRef.current = false; }, 700);
                    } else {
                        scanLockedRef.current = true;
                        setAssetCode(code);
                        setScannerOpen(false);
                    }
                }, () => undefined);
            } catch (exception) {
                if (!disposed) error('Không thể mở camera. Vui lòng kiểm tra quyền truy cập camera.');
            }
        };

        startScanner();
        return () => {
            disposed = true;
            const scanner = scannerRef.current;
            scannerRef.current = null;
            if (scanner?.isScanning) scanner.stop().catch(() => undefined);
        };
    }, [scannerOpen, scanMode, error]);

    const addManualCode = () => {
        const code = normalizeCode(assetCode);
        if (!code) return error('Vui lòng nhập mã tài sản.');
        setScannedCodes(previous => previous.includes(code) ? previous : [...previous, code]);
        setAssetCode('');
    };

    const saveAudit = async (event: React.FormEvent) => {
        event.preventDefault();
        const codes = scanMode === 'continuous' ? scannedCodes : [normalizeCode(assetCode)].filter(Boolean);
        if (!codes.length) return error('Vui lòng quét QR hoặc nhập mã tài sản.');
        setSaving(true);
        try {
            const response = await fetch('/api/periodic_asset_audits', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asset_codes: codes, notes, checked_by: profile?.full_name || '' }),
            });
            const record = await response.json();
            if (!response.ok) throw new Error(record.error);
            setLastRecord(record.data);
            setAssetCode(''); setScannedCodes([]); setNotes('');
            success(`Đã ghi nhận kiểm kê ${record.data.length} tài sản${record.google_sheet_backup ? ' và sao lưu Google Sheet.' : '.'}`);
            if (record.missing_codes?.length) error(`${record.missing_codes.length} mã không tìm thấy: ${record.missing_codes.join(', ')}`);
        } catch (exception: any) { error(exception.message || 'Không thể lưu dữ liệu kiểm kê.'); }
        finally { setSaving(false); }
    };

    return <Box p={{ xs: 1, sm: 3 }} maxWidth={900}>
        <Typography variant="h4" fontWeight={900} color="primary">KIỂM KÊ TÀI SẢN</Typography>
        <Typography color="text.secondary" mb={3}>Chọn quét đơn lẻ hoặc quét liên tục nhiều mã trước khi lưu.</Typography>
        <Paper component="form" onSubmit={saveAudit} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
            <Stack spacing={2}>
                <ToggleButtonGroup exclusive value={scanMode} onChange={(_, value) => value && setScanMode(value)} size="small">
                    <ToggleButton value="single">Quét đơn lẻ</ToggleButton>
                    <ToggleButton value="continuous">Quét liên tục</ToggleButton>
                </ToggleButtonGroup>
                <TextField autoFocus fullWidth label="Mã tài sản" value={assetCode} onChange={e => setAssetCode(e.target.value)} placeholder="Quét QR hoặc nhập mã tài sản" inputProps={{ style: { textTransform: 'uppercase' } }} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <Button type="button" variant="outlined" startIcon={<CameraAlt />} onClick={() => setScannerOpen(true)}>Quét mã QR</Button>
                    {scanMode === 'continuous' && <Button type="button" variant="outlined" onClick={addManualCode}>Thêm mã vào danh sách</Button>}
                    <Button type="submit" variant="contained" startIcon={<Save />} disabled={saving}>{saving ? 'Đang lưu...' : `Lưu${scanMode === 'continuous' ? ` ${scannedCodes.length} mã` : ''}`}</Button>
                </Stack>
                {scanMode === 'continuous' && <Box><Typography variant="body2" fontWeight={700} mb={1}>Danh sách đã quét ({scannedCodes.length})</Typography><Stack direction="row" flexWrap="wrap" gap={1}>{scannedCodes.length ? scannedCodes.map(code => <Chip key={code} label={code} onDelete={() => setScannedCodes(previous => previous.filter(item => item !== code))} />) : <Typography variant="body2" color="text.secondary">Chưa có mã nào.</Typography>}</Stack></Box>}
                <TextField fullWidth multiline minRows={2} label="Ghi chú (nếu có)" value={notes} onChange={e => setNotes(e.target.value)} />
            </Stack>
        </Paper>
        {lastRecord && <Alert icon={<CheckCircle />} severity="success" sx={{ mt: 2 }}>
            Đã kiểm kê thành công {lastRecord.length} tài sản. Thời gian: {new Date(lastRecord[0]?.checked_at).toLocaleString('vi-VN')}.
        </Alert>}
        <Dialog open={scannerOpen} onClose={() => setScannerOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle><QrCodeScanner sx={{ verticalAlign: 'middle', mr: 1 }} />Quét mã QR tài sản</DialogTitle>
            <DialogContent><Box id="periodic-audit-reader" sx={{ '& video': { width: '100% !important' } }} /></DialogContent>
        </Dialog>
    </Box>;
};

export default PeriodicAssetAudit;
