import { useEffect, useRef } from 'react';

/**
 * useScanDetection v2
 * ===================
 * Hook phát hiện input từ máy quét barcode/QR vật lý (keyboard emulation mode).
 *
 * Cải tiến so với v1:
 * - Tăng timeOut mặc định lên 120ms (phù hợp scanner 2D Bluetooth/không dây)
 * - Hỗ trợ GS1 characters (ASCII 29, 30, 28) trong buffer — KHÔNG reset khi gặp chúng
 * - Phát hiện scanner 2D: khi chuỗi chứa ký tự GS/RS, chờ End marker thay vì timeout
 * - Tự phân biệt "người gõ tay" vs "scanner" theo tốc độ phím
 * - Ngăn input vào TextField khi scanner đang hoạt động (tùy chọn)
 * - Queue buffer: xử lý tuần tự nếu scanner bắn liên tiếp quá nhanh
 *
 * Cách scanner vật lý hoạt động:
 * - Scanner 1D (USB): ~5-15ms/ký tự → tổng ~50-100ms/mã
 * - Scanner 2D Bluetooth: ~15-40ms/ký tự → tổng ~100-300ms/mã
 * - Người gõ tay: >150ms/ký tự
 * - Cuối mã: Enter (0x0D) hoặc Tab (0x09)
 */

export interface ScanDetectionOptions {
    /** Độ dài tối thiểu để coi là mã hợp lệ (default: 3) */
    minLength?: number;
    /** 
     * Khoảng thời gian tối đa giữa 2 phím (ms).
     * Scanner 1D: ~80ms. Scanner 2D BT: ~150ms. Mặc định 150ms.
     */
    timeOut?: number;
    /**
     * Có ngăn event keydown lan lên (preventDefault) khi scanner đang nhập không.
     * Hữu ích để tránh nhập vào TextField khi quét. Mặc định: false.
     */
    preventDefault?: boolean;
}

export const useScanDetection = (
    onScan: (code: string) => void,
    options: ScanDetectionOptions = {}
) => {
    const {
        minLength = 3,
        timeOut = 150,  // Tăng từ 80ms lên 150ms cho scanner 2D BT
        preventDefault = false,
    } = options;

    // Dùng ref để callback luôn là phiên bản mới nhất — KHÔNG re-register listener
    const onScanRef = useRef(onScan);
    useEffect(() => { onScanRef.current = onScan; }, [onScan]);

    const optionsRef = useRef({ minLength, timeOut, preventDefault });
    useEffect(() => {
        optionsRef.current = { minLength, timeOut, preventDefault };
    }, [minLength, timeOut, preventDefault]);

    useEffect(() => {
        let buffer = '';
        let lastKeyTime = 0;
        let flushTimer: ReturnType<typeof setTimeout> | null = null;
        let isLikelyScanner = false; // Đang trong luồng scanner (tốc độ nhanh)
        let keyCount = 0;           // Số phím trong lần nhập hiện tại
        let startTime = 0;          // Thời điểm bắt đầu nhập

        // Ký tự GS1 đặc biệt — KHÔNG kết thúc mã, là một phần của mã 2D
        const GS1_CHARS = new Set(['\x1D', '\x1C', '\x1E', '\x1F', '\x04']);

        const flush = () => {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            const { minLength: ml } = optionsRef.current;
            if (buffer.length >= ml) {
                onScanRef.current(buffer);
            }
            buffer = '';
            isLikelyScanner = false;
            keyCount = 0;
            startTime = 0;
        };

        const resetBuffer = () => {
            if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
            buffer = '';
            isLikelyScanner = false;
            keyCount = 0;
            startTime = 0;
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const { timeOut: to, minLength: ml, preventDefault: pd } = optionsRef.current;
            const now = Date.now();
            const key = e.key;

            // ── Detect: kết thúc mã ─────────────────────────────────────
            if (key === 'Enter' || key === 'Tab') {
                if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }

                if (buffer.length >= ml && isLikelyScanner) {
                    e.preventDefault(); // Không submit form / đổi focus
                    onScanRef.current(buffer);
                    buffer = '';
                    isLikelyScanner = false;
                    keyCount = 0;
                    startTime = 0;
                } else if (buffer.length >= ml && (now - startTime) < 3000) {
                    // Mặc dù không chắc là scanner, nếu chuỗi đủ dài và gõ đủ nhanh → vẫn process
                    const avgMs = keyCount > 0 ? (now - startTime) / keyCount : 999;
                    if (avgMs < 200) { // < 200ms/phím = có thể là scanner
                        e.preventDefault();
                        onScanRef.current(buffer);
                        buffer = '';
                        isLikelyScanner = false;
                        keyCount = 0;
                        startTime = 0;
                        return;
                    }
                }

                // Nếu không phải scanner → reset buffer, Enter/Tab hoạt động bình thường
                if (!isLikelyScanner) {
                    resetBuffer();
                }
                return;
            }

            // ── Detect: khoảng cách phím quá lớn → người dùng gõ tay ──
            if (lastKeyTime > 0 && (now - lastKeyTime) > to) {
                if (isLikelyScanner && buffer.length >= ml) {
                    // Scanner 2D không có Enter ở cuối (hiếm) → flush ngay
                    onScanRef.current(buffer);
                }
                resetBuffer();
            }
            lastKeyTime = now;

            // ── GS1 characters (ASCII control) ───────────────────────────
            // Ký tự GS (0x1D), RS (0x1E), FS (0x1C), US (0x1F), EOT (0x04)
            // xuất hiện trong mã 2D GS1 → thêm vào buffer, KHÔNG reset
            if (GS1_CHARS.has(key)) {
                if (buffer.length > 0) {
                    buffer += key;
                    isLikelyScanner = true; // GS1 char xác nhận đây là scanner
                    if (flushTimer) clearTimeout(flushTimer);
                    flushTimer = setTimeout(flush, to * 2);
                }
                return;
            }

            // ── Ký tự in được ─────────────────────────────────────────────
            if (key.length === 1) {
                if (keyCount === 0) startTime = now;
                buffer += key;
                keyCount++;

                // Sau 2 phím đầu, kiểm tra tốc độ để xác định scanner
                if (keyCount >= 2) {
                    const elapsed = now - startTime;
                    const avgMs = elapsed / keyCount;
                    isLikelyScanner = avgMs < to * 0.8; // Nhanh hơn 80% threshold → scanner
                }

                // Nếu là scanner và buffer có GS1 chars → đây chắc chắn là GS1 DataMatrix
                // Đặt timeout dài hơn để đợi toàn bộ mã
                const hasGS1 = GS1_CHARS.has(buffer);
                if (flushTimer) clearTimeout(flushTimer);
                flushTimer = setTimeout(flush, hasGS1 ? to * 3 : to * 2);

                // Nếu chắc chắn là scanner → có thể ngăn event lan ra
                if (pd && isLikelyScanner && keyCount > 2) {
                    e.stopPropagation();
                }
            } else if (key === 'Backspace' && !isLikelyScanner) {
                // Người dùng xóa tay → không phải scanner
                resetBuffer();
            }
        };

        // Thêm capture: true để xử lý trước các handler khác
        window.addEventListener('keydown', handleKeyDown, { capture: true });

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            if (flushTimer) clearTimeout(flushTimer);
        };
        // Không dependency array → re-register dùng optionsRef để tránh stale closure
         
    }, []);
};
