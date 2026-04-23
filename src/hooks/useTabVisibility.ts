import { useEffect, useRef, useCallback } from 'react';

/**
 * Hook theo dõi trạng thái tab (visible/hidden)
 * Trả về hàm để đăng ký callback được gọi khi tab trở lại active
 */
export const useTabVisibility = (onVisible: () => void, intervalMs?: number) => {
    const onVisibleRef = useRef(onVisible);
    onVisibleRef.current = onVisible; // Luôn cập nhật ref để tránh stale closure

    const lastFetchRef = useRef<number>(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const runIfStale = useCallback(() => {
        const now = Date.now();
        const staleThresholdMs = intervalMs ?? 5 * 60 * 1000; // Default 5 phút
        if (now - lastFetchRef.current >= staleThresholdMs) {
            lastFetchRef.current = now;
            onVisibleRef.current();
        }
    }, [intervalMs]);

    useEffect(() => {
        // Lần đầu load
        lastFetchRef.current = Date.now();

        // Khi người dùng quay lại tab
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                runIfStale();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Auto-poll khi tab đang active (optional interval)
        if (intervalMs) {
            timerRef.current = setInterval(() => {
                if (document.visibilityState === 'visible') {
                    lastFetchRef.current = Date.now();
                    onVisibleRef.current();
                }
            }, intervalMs);
        }

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [runIfStale, intervalMs]);
};

export default useTabVisibility;
