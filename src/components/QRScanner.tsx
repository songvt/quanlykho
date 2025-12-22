import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Box, Typography } from '@mui/material';

interface QRScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onScanFailure?: (error: any) => void;
}

const QRScanner = ({ onScanSuccess, onScanFailure }: QRScannerProps) => {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null);

    useEffect(() => {
        const regionId = "reader";

        const formatsToSupport = [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
        ];

        const scanner = new Html5QrcodeScanner(
            regionId,
            {
                fps: 50, // Higher FPS for modern devices (smoother)
                qrbox: (viewfinderWidth, _viewfinderHeight) => {
                    // Optimized for Barcodes (Serial): Very wide, not too tall
                    return { width: Math.floor(viewfinderWidth * 0.9), height: 120 };
                },
                aspectRatio: 1.0,
                showTorchButtonIfSupported: true,
                videoConstraints: {
                    facingMode: "environment",
                    // Ideal resolution for balance of speed/accuracy
                    width: { min: 640, ideal: 1920, max: 1920 },
                    height: { min: 480, ideal: 1080, max: 1080 },
                    focusMode: "continuous"
                } as any,
                formatsToSupport: formatsToSupport,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true // CRITICAL: Native speed
                }
            },
            /* verbose= */ false
        );

        scannerRef.current = scanner;

        const successCallback = (decodedText: string) => {
            scanner.clear().then(() => {
                onScanSuccess(decodedText);
            }).catch(err => {
                console.error("Failed to clear scanner", err);
            });
        };

        const errorCallback = (errorMessage: string) => {
            // QR Code scanning failures often happen while the camera is looking for a code.
            // We can ignore them or logging them if needed, but showing them to UI might be spammy.
            if (onScanFailure) onScanFailure(errorMessage);
        };

        scanner.render(successCallback, errorCallback);

        // Cleanup
        return () => {
            if (scannerRef.current) {
                scannerRef.current.clear().catch(error => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
            }
        };
    }, []); // Empty dependency array ensures this runs once on mount

    return (
        <Box sx={{ width: '100%', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
            <div id="reader" style={{ width: '100%' }}></div>
            <Typography variant="caption" color="textSecondary">
                Hướng camera vào mã QR/Mã vạch để quét
            </Typography>
        </Box>
    );
};

export default QRScanner;
