import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props { children?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; }

/** Kiểm tra lỗi có phải do chunk JS cũ bị xóa sau deploy không */
function isChunkLoadError(error: Error): boolean {
    const msg = error?.message || '';
    return (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('Importing a module script failed') ||
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError')
    );
}

/** Xóa toàn bộ service worker cache rồi reload trang */
function clearCacheAndReload(): void {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = (window as any).caches;
        if (c && typeof c.keys === 'function') {
            c.keys().then((names: string[]) => {
                Promise.all(names.map((n: string) => c.delete(n))).finally(() => {
                    window.location.reload();
                });
            }).catch(() => {
                window.location.reload();
            });
        } else {
            window.location.reload();
        }
    } catch {
        window.location.reload();
    }
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null, errorInfo: null };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo.componentStack);
        this.setState({ errorInfo });

        // Tự động hard reload khi phát hiện lỗi chunk cũ sau deploy mới
        if (isChunkLoadError(error)) {
            console.warn('[ErrorBoundary] Stale chunk detected — clearing cache and reloading...');
            clearCacheAndReload();
        }
    }

    public render() {
        if (this.state.hasError) {
            const isChunkErr = isChunkLoadError(this.state.error!);
            return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh" p={3}>
                    <Paper elevation={0} sx={{ p: 5, maxWidth: 480, width: '100%', textAlign: 'center', borderRadius: 3, border: '1px solid', borderColor: 'error.light' }}>
                        <ErrorOutlineIcon sx={{ fontSize: 56, color: 'error.main', mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} gutterBottom color="error.main">
                            Có lỗi xảy ra
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={3}>
                            {isChunkErr
                                ? 'Ứng dụng vừa được cập nhật. Đang tải lại trang mới nhất...'
                                : (this.state.error?.message || 'Lỗi không xác định. Vui lòng tải lại trang.')}
                        </Typography>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<RefreshIcon />}
                            onClick={clearCacheAndReload}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                            Tải lại trang
                        </Button>
                    </Paper>
                </Box>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
