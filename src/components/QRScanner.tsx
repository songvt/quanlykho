import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, IconButton, Select, MenuItem, Typography, Button, CircularProgress, Alert, Slider } from '@mui/material';
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
    const [zoom, setZoom] = useState(1);
    const [capabilities, setCapabilities] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // De-bouncing
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);

    // Initialization Effect
    useEffect(() => {
        let isMounted = true;

        const initScanner = async () => {
            if (scannerRef.current) {
                try {
                    await scannerRef.current.stop();
                    scannerRef.current.clear();
                } catch (e) { /* ignore */ }
                scannerRef.current = null;
            }

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
                verbose: false,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            } as any);
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

        const timer = setTimeout(initScanner, 100);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
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
                    setIsTorchOn(false);
                }

                await scannerRef.current.start(
                    selectedCameraId,
                    {
                        fps: 15,
                        videoConstraints: {
                            focusMode: "continuous",
                            facingMode: "environment",
                            width: { min: 640, ideal: 1280, max: 1920 },
                            height: { min: 480, ideal: 720, max: 1080 }
                        } as any
                    },
                    (decodedText, _result) => {
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
                    () => { }
                );

                if (isCurrent) {
                    setIsScanning(true);
                    setError(null);

                    // Check capabilities (Torch & Zoom)
                    try {
                        const caps = (scannerRef.current as any).getRunningTrackCameraCapabilities();
                        setCapabilities(caps);
                        setHasTorch(!!caps?.torch);
                        // Initialize zoom if available
                        if (caps?.zoom) {
                            setZoom(caps.zoom.min || 1);
                        }
                    } catch { setHasTorch(false); }
                }

            } catch (err: any) {
                console.error("Failed to start scanner", err);
                if (isCurrent) {
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
        };
    }, [selectedCameraId, loading, error]);

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

    const handleZoom = async (_event: Event, newValue: number | number[]) => {
        const z = newValue as number;
        setZoom(z);
        if (scannerRef.current && (scannerRef.current as any).applyVideoConstraints) {
            try {
                await (scannerRef.current as any).applyVideoConstraints({
                    advanced: [{ zoom: z }]
                });
            } catch (e) { console.error("Apply zoom failed", e); }
        }
    };

    return (
        <Box sx={{ width: '100%', position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', minHeight: 300, height: height }}>
            <div id={regionId} style={{ width: '100%', height: '100%' }} />

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

            {!loading && !error && (
                <>
                    <Box sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        p: 2,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        zIndex: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 1
                    }}>
                        {/* Zoom Slider */}
                        {capabilities?.zoom && (
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, width: '100%', mb: 1 }}>
                                <Typography variant="caption" sx={{ color: 'white', mr: 2, minWidth: 30, fontWeight: 600 }}>x{zoom}</Typography>
                                <Slider
                                    value={zoom}
                                    min={capabilities.zoom.min}
                                    max={capabilities.zoom.max}
                                    step={capabilities.zoom.step || 0.1}
                                    onChange={handleZoom}
                                    sx={{
                                        color: '#38bdf8',
                                        height: 4,
                                        '& .MuiSlider-thumb': {
                                            width: 16,
                                            height: 16,
                                            transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
                                            '&:before': { boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)' },
                                            '&:hover, &.Mui-focusVisible': { boxShadow: '0px 0px 0px 8px rgb(56 189 248 / 16%)' },
                                            '&.Mui-active': { width: 24, height: 24 },
                                        },
                                        '& .MuiSlider-rail': { opacity: 0.28 },
                                    }}
                                />
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <Box sx={{ minWidth: 150 }}>
                                {cameras.length > 1 && (
                                    <Select
                                        value={selectedCameraId}
                                        onChange={(e) => setSelectedCameraId(e.target.value)}
                                        size="small"
                                        sx={{
                                            color: 'white',
                                            '.MuiSvgIcon-root': { color: 'white' },
                                            borderColor: 'rgba(255,255,255,0.3)',
                                            '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                                            height: 40,
                                            borderRadius: 2,
                                            fontSize: '0.875rem'
                                        }}
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
                                    <IconButton
                                        onClick={toggleTorch}
                                        sx={{
                                            color: isTorchOn ? '#facc15' : 'white', // Yellow for ON
                                            bgcolor: isTorchOn ? 'rgba(250, 204, 21, 0.2)' : 'rgba(255,255,255,0.1)',
                                            '&:hover': { bgcolor: isTorchOn ? 'rgba(250, 204, 21, 0.3)' : 'rgba(255,255,255,0.2)' }
                                        }}
                                    >
                                        {isTorchOn ? <FlashOnIcon /> : <FlashOffIcon />}
                                    </IconButton>
                                )}
                            </Box>
                        </Box>
                    </Box>

                    {/* Visual Guide */}
                    {isScanning && (
                        <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            pointerEvents: 'none',
                            zIndex: 1
                        }}>
                            <Box sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: '70%',
                                height: '50%',
                                border: '2px solid rgba(255, 255, 255, 0.3)',
                                borderRadius: 4,
                            }}>
                                <Box sx={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderColor: '#38bdf8', borderStyle: 'solid', borderWidth: '4px 0 0 4px', borderRadius: '4px 0 0 0' }} />
                                <Box sx={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderColor: '#38bdf8', borderStyle: 'solid', borderWidth: '4px 4px 0 0', borderRadius: '0 4px 0 0' }} />
                                <Box sx={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderColor: '#38bdf8', borderStyle: 'solid', borderWidth: '0 0 4px 4px', borderRadius: '0 0 0 4px' }} />
                                <Box sx={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderColor: '#38bdf8', borderStyle: 'solid', borderWidth: '0 4px 4px 0', borderRadius: '0 0 4px 0' }} />

                                <Box sx={{
                                    width: '100%',
                                    height: '2px',
                                    bgcolor: '#38bdf8',
                                    position: 'absolute',
                                    top: '50%',
                                    boxShadow: '0 0 8px #38bdf8',
                                    animation: 'scan 2s infinite linear',
                                    '@keyframes scan': {
                                        '0%': { top: '5%', opacity: 0 },
                                        '25%': { opacity: 1 },
                                        '75%': { opacity: 1 },
                                        '100%': { top: '95%', opacity: 0 }
                                    }
                                }} />
                            </Box>
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};

export default QRScanner;
