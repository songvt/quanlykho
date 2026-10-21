import React, { useEffect, useRef, useState } from 'react';
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
    // A scanner is rendered in several dialogs throughout the application. A fixed
    // element id lets a stale dialog instance attach to the next scanner, which can
    // leave the camera track locked and produces "Could not start video source".
    const regionId = useRef(`custom-reader-box-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`).current;
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
    const scanLockedRef = useRef(false);

    // Initialization Effect
    useEffect(() => {
        let isMounted = true;
        let scannerInstance: Html5Qrcode | null = null;

        const initScanner = async () => {
            // Wait for DOM element to be available
            let retryCount = 0;
            while (isMounted && !document.getElementById(regionId) && retryCount < 10) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retryCount++;
            }

            if (!isMounted || !document.getElementById(regionId)) return;

            try {
                // Restrict decoding to the formats used by this app. On mobile, trying every
                // available symbology on every frame makes autofocus/detection noticeably slower.
                const SUPPORTED_FORMATS: Html5QrcodeSupportedFormats[] = [
                    Html5QrcodeSupportedFormats.QR_CODE,
                    Html5QrcodeSupportedFormats.DATA_MATRIX,
                    Html5QrcodeSupportedFormats.PDF_417,
                    Html5QrcodeSupportedFormats.CODE_128,
                    Html5QrcodeSupportedFormats.EAN_13,
                    Html5QrcodeSupportedFormats.EAN_8,
                ];

                scannerInstance = new Html5Qrcode(regionId, {
                    formatsToSupport: SUPPORTED_FORMATS,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    },
                    verbose: false
                });
                scannerRef.current = scannerInstance;

                // Html5Qrcode.getCameras() opens a temporary video stream before it
                // enumerates devices, then immediately closes it. On a number of Android
                // browsers that second camera request fails with "Could not start video
                // source". Enumerating does not open the camera; the sole permission and
                // camera request now happens below in scanner.start().
                if (!navigator.mediaDevices?.enumerateDevices) {
                    throw new Error('Trình duyệt không hỗ trợ truy cập camera. Hãy mở bằng Chrome hoặc Edge qua HTTPS.');
                }
                const devices = (await navigator.mediaDevices.enumerateDevices())
                    .filter((device) => device.kind === 'videoinput')
                    .map((device) => ({ id: device.deviceId, label: device.label }));
                if (isMounted) {
                    if (devices && devices.length > 0) {
                        setCameras(devices);
                        const backCamera = devices.find(d => {
                            const lbl = d.label.toLowerCase();
                            return lbl.includes('back') ||
                                   lbl.includes('sau') ||
                                   lbl.includes('environment') ||
                                   lbl.includes('rear');
                        });
                        // Mobile browsers commonly list the rear lens last when labels are hidden.
                        setSelectedCameraId(backCamera ? backCamera.id : devices[devices.length - 1].id);
                        setError(null);
                    } else {
                        setError("Không tìm thấy camera nào trên thiết bị.");
                    }
                    setLoading(false);
                }
            } catch (err: any) {
                console.error("Error initializing scanner", err);
                if (isMounted) {
                    setError(`Lỗi khởi tạo camera: ${err.message || "Không thể truy cập camera"}`);
                    setLoading(false);
                }
            }
        };

        initScanner();

        return () => {
            isMounted = false;
            if (scannerInstance && scannerInstance.isScanning) {
                scannerInstance.stop().then(() => scannerInstance?.clear()).catch(e => console.warn("Cleanup stop failed", e));
            } else if (scannerInstance) {
                try { scannerInstance.clear(); } catch(e) {}
            }
        };
    }, [regionId]);

    // Start Scanning Effect
    useEffect(() => {
        let isCurrent = true;

        const start = async () => {
            const scanner = scannerRef.current;
            if (!selectedCameraId || !scanner || loading || error) return;

            try {
                if (scanner.isScanning) {
                    await scanner.stop();
                    setIsScanning(false);
                }

                const config = {
                    // Serial barcodes (especially Code 128) are long and narrow. A higher
                    // frame rate makes it more forgiving while the phone is moving into focus.
                    fps: 18,
                    qrbox: (viewWidth: number, viewHeight: number) => {
                        // Scan virtually the whole preview. A constrained central box works
                        // well for QR codes but can crop the quiet zones at both ends of a
                        // long serial barcode, causing noticeably worse results than AppSheet.
                        const width = Math.floor(viewWidth * 0.96);
                        const height = Math.floor(viewHeight * 0.90);
                        return { width, height };
                    },
                    // Warehouse serial labels are normal black-on-white prints; skipping the
                    // mirrored retry leaves more processing time for the next camera frame.
                    disableFlip: true,
                };

                const onDecoded = (decodedText: string) => {
                        const now = Date.now();
                        if (scanLockedRef.current || (decodedText === lastScanRef.current && (now - lastScanTimeRef.current < 2200))) return;

                        scanLockedRef.current = true;
                        lastScanRef.current = decodedText;
                        lastScanTimeRef.current = now;
                        playBeep();
                        if (window.navigator?.vibrate) window.navigator.vibrate(100);
                        onScanSuccess(decodedText);
                        window.setTimeout(() => { scanLockedRef.current = false; }, 800);
                    };

                // Do not combine an exact device id with resolution/facing-mode
                // constraints. Several Windows webcams reject that combination with
                // NotReadableError / "Could not start video source". The selected id
                // is already enough to request the intended camera.
                await scanner.start(selectedCameraId, config, onDecoded, () => { });

                if (isCurrent) {
                    setIsScanning(true);
                    setError(null);
                    try {
                        const caps = (scanner as any).getRunningTrackCameraCapabilities();
                        setCapabilities(caps);
                        setHasTorch(!!caps?.torch);
                        if (caps?.zoom) setZoom(caps.zoom.min || 1);
                    } catch { setHasTorch(false); }
                }
            } catch (err: any) {
                console.error("Failed to start scanner", err);
                if (isCurrent) {
                    setError(`Lỗi khởi động: ${err.message || "Kiểm tra quyền truy cập camera"}`);
                    setIsScanning(false);
                    if (onScanFailure) onScanFailure(err);
                }
            }
        };

        const timer = setTimeout(() => {
            if (isCurrent) start();
        }, 300); // Small delay to ensure previous instance is cleared

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [selectedCameraId, loading, error]); // eslint-disable-line react-hooks/exhaustive-deps -- Callback changes must not restart the active camera scanner.

    const handleRetry = () => {
        // Retry only the camera request. Reloading loses the unfinished warehouse form
        // and does not release a camera held by another application.
        setError(null);
        setLoading(false);
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
                                width: '85%',
                                height: '65%',
                                maxWidth: 480,
                                maxHeight: 360,
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
