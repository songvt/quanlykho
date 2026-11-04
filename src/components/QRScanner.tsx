import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, IconButton, Select, MenuItem, Typography, Button, CircularProgress, Alert, Slider, Chip } from '@mui/material';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import FlashOffIcon from '@mui/icons-material/FlashOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { playBeep } from '../utils/audio';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
    height?: string | number;
    /** Continuous mode: keep scanning after each decode (don't close dialog) */
    continuous?: boolean;
    /** Total scanned count to display in continuous mode */
    scannedCount?: number;
}

const QRScanner = ({ onScanSuccess, onScanFailure, height = 400, continuous = false, scannedCount = 0 }: QRScannerProps) => {
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
    // Flash green overlay on successful scan
    const [flashSuccess, setFlashSuccess] = useState(false);
    const [lastScannedCode, setLastScannedCode] = useState<string>('');

    // De-bouncing — keep refs stable across re-renders
    const lastScanRef = useRef<string>('');
    const lastScanTimeRef = useRef<number>(0);
    const scanLockedRef = useRef(false);
    // Keep callback ref fresh so the scanner never needs to restart on prop change
    const onScanSuccessRef = useRef(onScanSuccess);
    useEffect(() => { onScanSuccessRef.current = onScanSuccess; }, [onScanSuccess]);
    const continuousRef = useRef(continuous);
    useEffect(() => { continuousRef.current = continuous; }, [continuous]);

    // Initialization Effect
    useEffect(() => {
        let isMounted = true;
        let scannerInstance: Html5Qrcode | null = null;

        const initScanner = async () => {
            let retryCount = 0;
            while (isMounted && !document.getElementById(regionId) && retryCount < 10) {
                await new Promise(resolve => setTimeout(resolve, 50));
                retryCount++;
            }

            if (!isMounted || !document.getElementById(regionId)) return;

            try {
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

    // Auto-zoom to help mobile camera focus on barcodes
    const applyInitialZoom = useCallback(async (caps: any) => {
        if (!caps?.zoom || !scannerRef.current) return;
        const minZoom = caps.zoom.min || 1;
        const maxZoom = caps.zoom.max || 1;
        // Auto-zoom to ~2x for better barcode focus on mobile
        const targetZoom = Math.min(Math.max(1.8, minZoom), maxZoom);
        if (targetZoom > minZoom) {
            try {
                await (scannerRef.current as any).applyVideoConstraints({
                    advanced: [{ zoom: targetZoom }]
                });
                setZoom(targetZoom);
            } catch { /* some devices don't support programmatic zoom */ }
        }
    }, []);

    // Shared decode handler — always reads from refs, never stale
    const handleDecoded = useCallback((decodedText: string) => {
        const now = Date.now();
        const isContinuous = continuousRef.current;
        // In continuous mode: same code waits 1.5s, different code only 400ms
        // In single mode: same code 2s, different 600ms
        const sameCodeCooldown = isContinuous ? 1500 : 2000;
        const diffCodeCooldown = isContinuous ? 400 : 600;

        if (scanLockedRef.current) return;
        const isSameCode = decodedText === lastScanRef.current;
        const elapsed = now - lastScanTimeRef.current;
        if (isSameCode && elapsed < sameCodeCooldown) return;
        if (!isSameCode && elapsed < diffCodeCooldown) return;

        scanLockedRef.current = true;
        lastScanRef.current = decodedText;
        lastScanTimeRef.current = now;

        // Audio + haptic feedback — double-pulse vibration is more noticeable
        playBeep(1400, 120);
        if (window.navigator?.vibrate) window.navigator.vibrate([80, 40, 80]);

        // Visual flash feedback
        setFlashSuccess(true);
        setLastScannedCode(decodedText.length > 30 ? decodedText.slice(0, 28) + '…' : decodedText);
        setTimeout(() => setFlashSuccess(false), 600);

        onScanSuccessRef.current(decodedText);

        // Unlock faster in continuous mode for rapid scanning
        window.setTimeout(() => { scanLockedRef.current = false; }, isContinuous ? 350 : 600);
    }, []);

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

                const scanConfig = {
                    // Higher FPS = more decode attempts = faster detection on mobile
                    fps: 25,
                    qrbox: (viewWidth: number, viewHeight: number) => {
                        // Use nearly the whole preview — a small central box crops
                        // quiet zones on long serial barcodes.
                        const width = Math.floor(viewWidth * 0.96);
                        const height = Math.floor(viewHeight * 0.90);
                        return { width, height };
                    },
                    disableFlip: true,
                };

                // Try with HD resolution constraints first (much better decode rate on mobile)
                let started = false;
                try {
                    await scanner.start(
                        {
                            deviceId: { exact: selectedCameraId },
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                            // @ts-ignore — focusMode is a valid constraint on mobile browsers
                            focusMode: { ideal: 'continuous' },
                        } as any,
                        scanConfig,
                        handleDecoded,
                        () => { }
                    );
                    started = true;
                } catch (hdErr) {
                    console.warn("HD constraints rejected, falling back to basic camera ID", hdErr);
                }

                // Fallback: some devices reject combined deviceId + resolution constraints
                if (!started) {
                    await scanner.start(selectedCameraId, scanConfig, handleDecoded, () => { });
                }

                if (isCurrent) {
                    setIsScanning(true);
                    setError(null);
                    try {
                        const caps = (scanner as any).getRunningTrackCameraCapabilities();
                        setCapabilities(caps);
                        setHasTorch(!!caps?.torch);
                        await applyInitialZoom(caps);
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
        }, 300);

        return () => {
            isCurrent = false;
            clearTimeout(timer);
        };
    }, [selectedCameraId, loading, error, handleDecoded, applyInitialZoom]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRetry = () => {
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

            {/* Green flash on successful scan */}
            {flashSuccess && (
                <Box sx={{
                    position: 'absolute', inset: 0, zIndex: 15,
                    bgcolor: 'rgba(34, 197, 94, 0.25)',
                    pointerEvents: 'none',
                    transition: 'opacity 0.3s ease-out',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <Box sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
                        bgcolor: 'rgba(0,0,0,0.7)', borderRadius: 3, px: 3, py: 1.5,
                    }}>
                        <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 36 }} />
                        <Typography sx={{ color: '#22c55e', fontWeight: 800, fontSize: '0.85rem' }}>
                            {lastScannedCode}
                        </Typography>
                    </Box>
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
                        {/* Scanned count badge in continuous mode */}
                        {continuous && scannedCount > 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0.5 }}>
                                <Chip
                                    icon={<CheckCircleIcon sx={{ color: '#22c55e !important' }} />}
                                    label={`Đã quét: ${scannedCount} serial`}
                                    sx={{
                                        bgcolor: 'rgba(34, 197, 94, 0.15)',
                                        color: '#22c55e',
                                        fontWeight: 800,
                                        fontSize: '0.9rem',
                                        height: 36,
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                    }}
                                />
                            </Box>
                        )}

                        {/* Zoom Slider */}
                        {capabilities?.zoom && (
                            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, width: '100%', mb: 1 }}>
                                <Typography variant="caption" sx={{ color: 'white', mr: 2, minWidth: 30, fontWeight: 600 }}>x{typeof zoom === 'number' ? zoom.toFixed(1) : zoom}</Typography>
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
                                            color: isTorchOn ? '#facc15' : 'white',
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

                    {/* Continuous mode hint */}
                    {continuous && isScanning && !flashSuccess && scannedCount === 0 && (
                        <Box sx={{
                            position: 'absolute',
                            top: 16,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            zIndex: 12,
                            pointerEvents: 'none',
                        }}>
                            <Chip
                                label="📷 Liên tục quét — đưa mã vào khung"
                                sx={{
                                    bgcolor: 'rgba(0,0,0,0.6)',
                                    color: 'white',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                }}
                            />
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
};

export default QRScanner;
