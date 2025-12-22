import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, IconButton, Select, MenuItem, Typography, Button, CircularProgress, Alert } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FlashOffIcon from '@mui/icons-material/FlashOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import { playBeep } from '../utils/audio';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
    height?: string | number;
}

const QRScanner = ({ onScanSuccess, onScanFailure, height = 400 }: QRScannerProps) => {
    const regionId = "custom-reader-box";
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const [cameras, setCameras] = useState<Array<{ id: string, label: string }>>([]);
    const [selectedCameraId, setSelectedCameraId] = useState<string>('');
    const [isScanning, setIsScanning] = useState(false);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // De-bouncing
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);

    // Initialization Effect
    useEffect(() => {
        let isMounted = true;

        const initScanner = async () => {
            // Cleanup any previous instance just in case (Strict Mode protection)
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) { /* ignore */ }
                scannerRef.current = null;
            }

            // Create new instance
            const scanner = new Html5Qrcode(regionId, {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.PDF_417,
                    Html5QrcodeSupportedFormats.AZTEC,
                    Html5QrcodeSupportedFormats.MAXICODE,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                    Html5QrcodeSupportedFormats.UPC_A,
                    Html5QrcodeSupportedFormats.UPC_E,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.CODE_39,
                    Html5QrcodeSupportedFormats.CODE_93,
                    Html5QrcodeSupportedFormats.ITF,
                    Html5QrcodeSupportedFormats.CODABAR,
                    Html5QrcodeSupportedFormats.RSS_14,
                    Html5QrcodeSupportedFormats.RSS_EXPANDED
                ],
                verbose: false
            });
            scannerRef.current = scanner;

            try {
                const devices = await Html5Qrcode.getCameras();
                if (isMounted) {
                    if (devices && devices.length > 0) {
                        setCameras(devices);
                        const backCamera = devices.find(d =>
                            d.label.toLowerCase().includes('back') ||
                            d.label.toLowerCase().includes('sau') ||
                            d.label.toLowerCase().includes('environment')
                        );
                        setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
                        setError(null);
                    } else {
                        setError("Không tìm thấy camera nào trên thiết bị.");
                    }
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("Error getting cameras", err);
                if (isMounted) {
                    // Check for common permission errors
                    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                        setError("Không thể truy cập camera. Vui lòng cấp quyền truy cập trong cài đặt trình duyệt.");
                    } else if (err.name === "NotFoundError") {
                        setError("Không tìm thấy thiết bị camera nào.");
                    } else if (err.name === "NotReadableError") {
                        setError("Camera đang được sử dụng bởi ứng dụng khác hoặc không thể truy cập.");
                    } else {
                        setError(`Lỗi khi truy cập camera: ${err.message || err} `);
                    }
                    setLoading(false);
                }
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(initScanner, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                // We don't await here in cleanup, but we try to stop
                scannerRef.current.stop().catch(() => { }).finally(() => {
                    scannerRef.current?.clear();
                });
            }
        };
    }, []);

    // Start Scanning Effect
    useEffect(() => {
        let isCurrent = true;

        const start = async () => {
            if (!selectedCameraId || !scannerRef.current || loading || error) return;

            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                    setIsScanning(false);
                    setIsTorchOn(false); // Reset torch state
                }

                await scannerRef.current.start(
                    selectedCameraId,
                    {
                        fps: 20,
                        qrbox: { width: 320, height: 200 },
                        aspectRatio: 1.0,
                        // videoConstraints is important for mobile
                        videoConstraints: {
                            focusMode: "continuous"
                        } as any
                    },
                    (decodedText, _result) => {
                        // Success
                        const now = Date.now();
                        if (decodedText === lastScanRef.current && (now - lastScanTimeRef.current < 1500)) {
                            return;
                        }

                        lastScanRef.current = decodedText;
                        lastScanTimeRef.current = now;
                        playBeep();
                        if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(200);
                        onScanSuccess(decodedText);
                    },
                    () => { } // Ignore frame errors
                );

                if (isCurrent) {
                    setIsScanning(true);
                    setError(null);

                    // Check torch
                    try {
                        const caps = (scannerRef.current as any).getRunningTrackCameraCapabilities();
                        setHasTorch(!!caps?.torch);
                    } catch { setHasTorch(false); }
                }

            } catch (err: any) {
                console.error("Failed to start scanner", err);
                if (isCurrent) {
                    // More specific error handling for start failures
                    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                        setError("Không thể khởi động camera. Vui lòng cấp quyền truy cập.");
                    } else if (err.name === "NotFoundError") {
                        setError("Camera đã chọn không tìm thấy hoặc không khả dụng.");
                    } else if (err.name === "NotReadableError") {
                        setError("Camera đang được sử dụng bởi ứng dụng khác hoặc không thể truy cập.");
                    } else {
                        setError(`Lỗi khởi động camera: ${err.message || err} `);
                    }
                    setIsScanning(false);
                    setHasTorch(false);
                    setIsTorchOn(false);
                    if (onScanFailure) onScanFailure(err);
                }
            }
        };

        if (selectedCameraId && !loading && !error) {
            start();
        }

        return () => {
            isCurrent = false;
            // No need to stop here, as the next effect will handle it if selectedCameraId changes
            // or the main cleanup will handle it on unmount.
        };
    }, [selectedCameraId, loading, error]); // Added loading and error to dependencies to re-evaluate start

    const handleRetry = () => {
        window.location.reload();
    };

    const toggleTorch = async () => {
        if (!scannerRef.current || !hasTorch) return;
        try {
            await (scannerRef.current as any).applyVideoConstraints({
                advanced: [{ torch: !isTorchOn }]
            });
            setIsTorchOn(!isTorchOn);
        } catch (e) { console.error("Toggle torch failed", e); }
    };

    return (
        <Box sx={{ width: '100%', position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', minHeight: 300, height: height }}>
            {/* The Container for Html5Qrcode */}
            <div id={regionId} style={{ width: '100%', height: '100%' }} />

            {/* Loading / Error States */}
            {loading && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000', color: 'white', zIndex: 20 }}>
                    <CircularProgress color="inherit" />
                    <Typography ml={2}>Đang khởi động camera...</Typography>
                </Box>
            )}

            {error && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', bgcolor: '#222', color: 'white', p: 3, zIndex: 21, textAlign: 'center' }}>
                    <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>
                    <Button variant="contained" color="primary" startIcon={<RefreshIcon />} onClick={handleRetry}>
                        Thử lại
                    </Button>
                </Box>
            )}

            {/* Overlay Controls (Only show if running) */}
            {!loading && !error && (
                <>
                    <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        zIndex: 10
                    }}>
                        <Box>
                            {cameras.length > 1 && (
                                <Select
                                    value={selectedCameraId}
                                    onChange={(e) => setSelectedCameraId(e.target.value)}
                                    size="small"
                                    sx={{ color: 'white', '.MuiSvgIcon-root': { color: 'white' }, borderColor: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 1 }}
                                    variant="outlined"
                                >
                                    {cameras.map(cam => (
                                        <MenuItem key={cam.id} value={cam.id}>{cam.label || `Camera ${cam.id.slice(0, 5)}...`}</MenuItem>
                                    ))}
                                </Select>
                            )}
                        </Box>

                        <Box>
                            {hasTorch && (
                                <IconButton onClick={toggleTorch} sx={{ color: isTorchOn ? '#ffeb3b' : 'white' }}>
                                    {isTorchOn ? <FlashOnIcon /> : <FlashOffIcon />}
                                </IconButton>
                            )}
                        </Box>
                    </Box>

                    {/* Visual Guide */}
                    {isScanning && (
                        <Box sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '320px',
                            height: '200px',
                            border: '2px solid rgba(255, 255, 255, 0.6)',
                            borderRadius: 4,
                            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                            pointerEvents: 'none',
                            zIndex: 1
                        }}>
                            <Box sx={{
                                width: '100%',
                                height: '2px',
                                bgcolor: 'red',
                                position: 'absolute',
                                top: '50%',
                                animation: 'scan 2s infinite linear',
                                '@keyframes scan': {
                                    '0%': { top: '10%' },
                                    '50%': { top: '90%' },
                                    '100%': { top: '10%' }
                                }
                            }} />
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};

export default QRScanner;
