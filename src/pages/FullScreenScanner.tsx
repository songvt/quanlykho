import React, { useEffect, useState, useRef } from 'react';
import { Box, Typography, IconButton, Paper, Button } from '@mui/material';
import { X, Camera, Zap, Image as ImageIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';

const FullScreenScanner: React.FC = () => {
    const navigate = useNavigate();
    const [hasCamera, setHasCamera] = useState<boolean>(true);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const scannerRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        // Prevent scrolling on body
        document.body.style.overflow = 'hidden';

        const initScanner = async () => {
            try {
                const html5QrCode = new Html5Qrcode("reader");
                scannerRef.current = html5QrCode;
                
                await html5QrCode.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0,
                    },
                    (decodedText) => {
                        html5QrCode.pause();
                        setScanResult(decodedText);
                        // Optional beep
                        try {
                            const audio = new Audio('/success-beep.mp3');
                            audio.play().catch(() => {});
                        } catch (e) {}
                    },
                    (errorMessage) => {
                        // ignore background noise errors
                    }
                );
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

    const handleClose = () => {
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(console.error);
        }
        navigate(-1);
    };

    const handleScanAgain = () => {
        setScanResult(null);
        if (scannerRef.current) {
            scannerRef.current.resume();
        }
    };

    const handleProcess = () => {
        if (!scanResult) return;
        // Logic to route based on scan result
        // For example, if it's an asset:
        navigate(`/assets?search=${encodeURIComponent(scanResult)}`);
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
                    Quét mã QR
                </Typography>
                <Box sx={{ width: 40 }} /> {/* Spacer */}
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
                        width: 250,
                        height: 250,
                        border: '2px solid rgba(255,255,255,0.3)',
                        borderRadius: '24px',
                        pointerEvents: 'none',
                        boxShadow: '0 0 0 4000px rgba(0,0,0,0.5)', // Darken surroundings
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
                    <Paper sx={{ p: 3, borderRadius: '24px', bgcolor: 'white', color: 'black', textAlign: 'center' }}>
                        <Typography sx={{ fontWeight: 700, mb: 1, color: 'var(--text-secondary)' }}>
                            Kết quả quét:
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', mb: 3, wordBreak: 'break-all' }}>
                            {scanResult}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                fullWidth
                                variant="outlined"
                                onClick={handleScanAgain}
                                sx={{ borderRadius: '12px', py: 1.5, fontWeight: 700, color: 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
                            >
                                Quét lại
                            </Button>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleProcess}
                                sx={{ borderRadius: '12px', py: 1.5, fontWeight: 700, bgcolor: 'var(--brand-primary)' }}
                            >
                                Xử lý
                            </Button>
                        </Box>
                    </Paper>
                ) : (
                    <Typography sx={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', mb: 2 }}>
                        Hướng camera vào mã QR để tự động quét
                    </Typography>
                )}
            </Box>
        </Box>
    );
};

export default FullScreenScanner;
