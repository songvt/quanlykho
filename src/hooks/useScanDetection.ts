import { useEffect } from 'react';

/**
 * useScanDetection
 * Listens for global keydown events to detect barcode scanner input.
 * Barcode scanners typically emulate keyboard input followed by an Enter key.
 * 
 * @param onScan Callback function when a code is successfully scanned
 * @param minLength Minimum length of the barcode to trigger the callback (default 3)
 */
export const useScanDetection = (
    onScan: (code: string) => void,
    options: { minLength?: number; timeOut?: number } = {}
) => {
    const { minLength = 3, timeOut = 50 } = options;

    useEffect(() => {
        let buffer = '';
        let lastKeyTime = Date.now();

        const handleKeyDown = (e: KeyboardEvent) => {
            const currentTime = Date.now();
            const char = e.key;

            // Simple clearance if too much time passed between keystrokes (manual typing vs scanner)
            // Scanners are extremely fast (<20ms per char usually)
            // But we allow a bit more leeway for some wireless scanners
            if (currentTime - lastKeyTime > timeOut) {
                buffer = '';
            }
            lastKeyTime = currentTime;

            if (char === 'Enter') {
                if (buffer.length >= minLength) {
                    onScan(buffer);
                    buffer = '';
                    // Prevent default form submission if any
                    // e.preventDefault(); 
                    // Note: Preventing default globally might be risky for other inputs, 
                    // generally we rely on focus states, but here we scan *anywhere*.
                    // Let's just consume the scan.
                } else {
                    buffer = '';
                }
            } else if (char.length === 1) {
                // Only printable characters
                buffer += char;
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onScan, minLength, timeOut]);
};
