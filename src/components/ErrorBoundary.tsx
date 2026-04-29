import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props { children?: ReactNode; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; }

/** Kiểm tra lỗi có phải do chunk JS cũ bị xóa sau deploy không */
function isChunkLoadError(error: any): boolean {
    if (!error) return false;
    const msg = (typeof error === 'string' ? error : error.message || '').toLowerCase();
    const stack = (error.stack || '').toLowerCase();
    
    return (
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('importing a module script failed') ||
        msg.includes('loading chunk') ||
        msg.includes('chunkloaderror') ||
        stack.includes('chunkloaderror') ||
        stack.includes('failed to fetch dynamically imported module')
    );
}

/** Xóa toàn bộ service worker cache rồi reload trang mạnh mẽ */
function clearCacheAndReload(): void {
    console.warn('[ErrorBoundary] Attempting hard reload...');
    
    try {
        // Xóa caches (nếu có Service Worker)
        if ('caches' in window) {
            window.caches.keys().then((names) => {
                return Promise.all(names.map((name) => window.caches.delete(name)));
            }).catch(err => console.error('Cache clear error:', err))
            .finally(() => {
                // Thêm query param v=[timestamp] để ép trình duyệt fetch index.html mới từ server
                const url = new URL(window.location.href);
                url.searchParams.set('v', Date.now().toString());
                window.location.replace(url.toString());
            });
            return;
        }
    } catch (e) {
        console.error('Hard reload failed:', e);
    }
    
    // Fallback if caches API not available
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now().toString());
    window.location.replace(url.toString());
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = { hasError: false, error: null, errorInfo: null };

    public static getDerivedStateFromError(error: any): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: any, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error);
        this.setState({ errorInfo });

        // Tự động hard reload khi phát hiện lỗi chunk cũ sau deploy mới
        if (isChunkLoadError(error)) {
            console.warn('[ErrorBoundary] Stale chunk detected — auto-reloading in 1s...');
            setTimeout(() => {
                clearCacheAndReload();
            }, 1000);
        }
    }

    public render() {
        if (this.state.hasError) {
            const isChunkErr = isChunkLoadError(this.state.error);
            
            return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh" p={3}>
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 5, 
                            maxWidth: 480, 
                            width: '100%', 
                            textAlign: 'center', 
                            borderRadius: 4, 
                            border: '1px solid', 
                            borderColor: isChunkErr ? 'warning.light' : 'error.light',
                            bgcolor: isChunkErr ? 'warning.50' : 'inherit',
                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.1)'
                        }}
                    >
                        <ErrorOutlineIcon sx={{ fontSize: 64, color: isChunkErr ? 'warning.main' : 'error.main', mb: 2 }} />
                        
                        <Typography variant="h5" fontWeight={800} gutterBottom color={isChunkErr ? 'warning.dark' : 'error.main'}>
                            {isChunkErr ? 'Đang cập nhật phiên bản...' : 'Có lỗi xảy ra'}
                        </Typography>
                        
                        <Typography variant="body1" color="text.secondary" mb={4} sx={{ lineHeight: 1.6 }}>
                            {isChunkErr
                                ? 'Hệ thống đã có bản cập nhật mới. Chúng tôi đang tải lại dữ liệu mới nhất cho bạn (vui lòng chờ trong giây lát)...'
                                : (this.state.error?.message || 'Lỗi không xác định. Vui lòng tải lại trang để tiếp tục.')}
                        </Typography>
                        
                        <Button
                            variant="contained"
                            color={isChunkErr ? 'warning' : 'error'}
                            startIcon={<RefreshIcon />}
                            onClick={clearCacheAndReload}
                            sx={{ 
                                borderRadius: 2, 
                                py: 1.5, 
                                px: 4,
                                textTransform: 'none', 
                                fontWeight: 700,
                                boxShadow: 3
                            }}
                        >
                            {isChunkErr ? 'Tải lại ngay' : 'Tải lại trang'}
                        </Button>
                        
                        {isChunkErr && (
                            <Typography variant="caption" display="block" color="text.disabled" mt={2}>
                                Phiên bản: {new Date().toLocaleTimeString()}
                            </Typography>
                        )}
                    </Paper>
                </Box>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;
