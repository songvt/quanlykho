import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, IconButton, Paper, Button, Chip } from '@mui/material';
import { X, Camera, Zap, ZapOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { parseSerialInput } from '../utils/serialParser';

const ALL_SUPPORTED_FORMATS: Html5QrcodeSupportedFormats[] = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.AZTEC,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
    Html5QrcodeSupportedFormats.MAXICODE,
    Html5QrcodeSupportedFormats.RSS_14,
    Html5QrcodeSupportedFormats.RSS_EXPANDED,
];

const FullScreenScanner: React.FC = () => {
    const navigate = useNavigate();
    const [hasCamera, setHasCamera] = useState<boolean>(true);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [parsedSerials, setParsedSerials] = useState<string[]>([]);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [hasTorch, setHasTorch] = useState(false);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Prevent scrolling on body
        document.body.style.overflow = 'hidden';

        const initScanner = async () => {
            try {
                const html5QrCode = new Html5Qrcode("reader", {
                    formatsToSupport: ALL_SUPPORTED_FORMATS,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true
                    },
                    verbose: false
                });
                scannerRef.current = html5QrCode;
                
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 20,
                        qrbox: (viewWidth, viewHeight) => {
                            const width = Math.floor(Math.min(viewWidth * 0.88, 500));
                            const height = Math.floor(Math.min(viewHeight * 0.72, Math.max(220, width * 0.75)));
                            return { width, height };
                        },
                        videoConstraints: {
                            facingMode: "environment",
                            advanced: [{ focusMode: "continuous" }]
                        } as any
                    },
                    (decodedText) => {
                        html5QrCode.pause();
                        const serials = parseSerialInput(decodedText);
                        setScanResult(decodedText);
                        setParsedSerials(serials.length > 0 ? serials : [decodedText]);
                        // Optional beep
                        try {
                            const audio = new Audio('/success-beep.mp3');
                            audio.play().catch(() => {});
                        } catch (e) {}
                        if (window.navigator?.vibrate) window.navigator.vibrate(100);
                    },
                    () => {}
                );

                try {
                    const caps = (html5QrCode as any).getRunningTrackCameraCapabilities();
                    setHasTorch(!!caps?.torch);
                } catch {
                    setHasTorch(false);
                }
            } catch (err) {
                console.error("Error starting scanner:", err);
                setHasCamera(false);
            }
        };

        initScanner();

        return () => {
            document.body.style.overflow = 'auto';
            if (scannerRef.current) {
                if (scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(console.error);
                }
            }
        };
    }, []);

    const toggleTorch = async () => {
        if (!scannerRef.current || !hasTorch) return;
        try {
            await (scannerRef.current as any).applyVideoConstraints({
                advanced: [{ torch: !isTorchOn }]
            });
            setIsTorchOn(!isTorchOn);
        } catch (e) {
            console.error("Toggle torch failed", e);
        }
    };

    const handleClose = () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
        }
        navigate(-1);
    };

    const handleScanAgain = () => {
        setScanResult(null);
        setParsedSerials([]);
        if (scannerRef.current) {
            try {
                scannerRef.current.resume();
            } catch {}
        }
    };

    const handleProcess = (selectedCode?: string) => {
        const target = selectedCode || parsedSerials[0] || scanResult;
        if (!target) return;
        navigate(`/assets?search=${encodeURIComponent(target)}`);
    };

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            bgcolor: '#000',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            color: 'white',
        }}>
            {/* Header */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)'
            }}>
                <IconButton onClick={handleClose} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.2)' }}>
                    <X size={24} />
                </IconButton>
                <Typography sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    Quét mã QR & Barcode
                </Typography>
                {hasTorch ? (
                    <IconButton onClick={toggleTorch} sx={{ color: isTorchOn ? '#facc15' : 'white', bgcolor: isTorchOn ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.2)' }}>
                        {isTorchOn ? <Zap size={22} fill="#facc15" /> : <ZapOff size={22} />}
                    </IconButton>
                ) : (
                    <Box sx={{ width: 40 }} />
                )}
            </Box>

            {/* Scanner Viewport */}
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!hasCamera && !scanResult && (
                    <Box textAlign="center" p={3}>
                        <Camera size={48} color="rgba(255,255,255,0.5)" style={{ marginBottom: 16 }} />
                        <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
                            Không tìm thấy máy ảnh. Hãy kiểm tra quyền truy cập camera.
                        </Typography>
                    </Box>
                )}

                <Box id="reader" sx={{
                    width: '100%',
                    maxWidth: '500px',
                    height: '100%',
                    '& video': {
                        objectFit: 'cover !important',
                        width: '100% !important',
                        height: '100% !important',
                    },
                    '& #reader__scan_region': {
                        background: 'transparent !important',
                        height: '100% !important',
                    },
                    '& #reader__dashboard_section_csr span': { color: 'white !important' },
                    '& #reader__dashboard_section_swaplink': { display: 'none !important' }
                }} />

                {/* Overlay guides */}
                {!scanResult && (
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '85%',
                        height: '65%',
                        maxWidth: 480,
                        maxHeight: 360,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderRadius: '24px',
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 4000px rgba(0,0,0,0.5)',
                        '&::before, &::after, & > div::before, & > div::after': {
                            content: '""',
                            position: 'absolute',
                            width: 40,
                            height: 40,
                            borderColor: 'var(--brand-primary)',
                            borderStyle: 'solid',
                        },
                        '&::before': { top: -2, left: -2, borderWidth: '4px 0 0 4px', borderTopLeftRadius: '24px' },
                        '&::after': { top: -2, right: -2, borderWidth: '4px 4px 0 0', borderTopRightRadius: '24px' },
                    }}>
                        <Box sx={{ position: 'absolute', inset: 0 }}>
                            <Box sx={{
                                '&::before': { bottom: -2, left: -2, borderWidth: '0 0 4px 4px', borderBottomLeftRadius: '24px', position: 'absolute', content: '""', width: 40, height: 40, borderColor: 'var(--brand-primary)', borderStyle: 'solid' },
                                '&::after': { bottom: -2, right: -2, borderWidth: '0 4px 4px 0', borderBottomRightRadius: '24px', position: 'absolute', content: '""', width: 40, height: 40, borderColor: 'var(--brand-primary)', borderStyle: 'solid' },
                            }} />
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Bottom Actions or Result */}
            <Box sx={{
                p: 3,
                pb: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 10,
            }}>
                {scanResult ? (
                    <Paper sx={{ p: 2.5, borderRadius: '24px', bgcolor: 'white', color: 'black', textAlign: 'center' }}>
                        {parsedSerials.length > 1 ? (
                            <Box mb={2}>
                                <Typography sx={{ fontWeight: 800, color: 'var(--brand-primary)', fontSize: '1rem', mb: 1 }}>
                                    ✨ Tự động tách được {parsedSerials.length} serial:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, maxHeight: 140, overflowY: 'auto', p: 1, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                                    {parsedSerials.map((sn, idx) => (
                                        <Chip
                                            key={idx}
                                            label={sn}
                                            onClick={() => handleProcess(sn)}
                                            clickable
                                            color="primary"
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontWeight: 700 }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        ) : (
                            <>
                                <Typography sx={{ fontWeight: 700, mb: 0.5, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    Kết quả quét:
                                </Typography>
                                <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 2.5, wordBreak: 'break-all' }}>
                                    {parsedSerials[0] || scanResult}
                                </Typography>
                            </>
                        )}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleScanAgain}
                                sx={{ borderRadius: '12px', py: 1.2, fontWeight: 700, color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
                            >
                                Quét lại
                            </Button>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={() => handleProcess()}
                                sx={{ borderRadius: '12px', py: 1.2, fontWeight: 700, bgcolor: 'var(--brand-primary)' }}
                            >
                                {parsedSerials.length > 1 ? `Tra cứu (${parsedSerials[0]})` : 'Tra cứu tài sản'}
                            </Button>
                        </Box>
                    </Paper>
                ) : (
                    <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', mb: 2 }}>
                        Hướng camera vào mã QR hoặc mã vạch để tự động quét
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default FullScreenScanner;
