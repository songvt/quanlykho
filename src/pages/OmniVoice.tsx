import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Paper, Typography, Button, Stack, Container,
    Breadcrumbs, Link, CircularProgress, Card, CardContent,
    IconButton, Divider, Tooltip
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import TerminalIcon from '@mui/icons-material/Terminal';
import InfoIcon from '@mui/icons-material/Info';
import MicIcon from '@mui/icons-material/Mic';
import { useNavigate } from 'react-router-dom';

export default function OmniVoice() {
    const navigate = useNavigate();
    const [running, setRunning] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [pid, setPid] = useState<number | null>(null);
    const logEndRef = useRef<HTMLDivElement>(null);

    // Fetch status from backend
    const checkStatus = async (showLoading = false) => {
        if (showLoading) setLoading(true);
        try {
            const response = await fetch('/api/omnivoice?type=status');
            const data = await response.json();
            if (response.ok) {
                setRunning(data.running);
                setPid(data.pid);
                if (data.logs) {
                    setLogs(data.logs);
                }
            }
        } catch (error) {
            console.error('Lỗi khi kiểm tra trạng thái OmniVoice:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    // Auto-scroll logs
    useEffect(() => {
        logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Check status on mount and poll every 5s
    useEffect(() => {
        checkStatus(true);
        const interval = setInterval(() => {
            checkStatus(false);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    // Start OmniVoice server
    const handleStart = async () => {
        setActionLoading(true);
        try {
            const response = await fetch('/api/omnivoice?type=start', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                setRunning(true);
                if (data.pid) setPid(data.pid);
                // Immediately check status to refresh logs
                setTimeout(() => checkStatus(false), 1000);
                setTimeout(() => checkStatus(false), 3000);
            } else {
                alert(data.error || 'Không thể khởi động server.');
            }
        } catch (error: any) {
            alert('Lỗi kết nối: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    // Stop OmniVoice server
    const handleStop = async () => {
        setActionLoading(true);
        try {
            const response = await fetch('/api/omnivoice?type=stop', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                setRunning(false);
                setPid(null);
                setTimeout(() => checkStatus(false), 1000);
            } else {
                alert(data.error || 'Không thể dừng server.');
            }
        } catch (error: any) {
            alert('Lỗi kết nối: ' + error.message);
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <Container maxWidth="xl" sx={{ py: 2, height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
            {/* Breadcrumbs */}
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 2 }}>
                <Link
                    underline="hover"
                    color="inherit"
                    onClick={() => navigate('/')}
                    sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.85rem' }}
                >
                    Trang chủ
                </Link>
                <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Giọng nói AI (OmniVoice)
                </Typography>
            </Breadcrumbs>

            {/* Header / Toolbar Panel */}
            <Paper
                elevation={3}
                sx={{
                    p: 2.5,
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(30,41,59,0.8) 100%)',
                    mb: 3,
                    backdropFilter: 'blur(20px)',
                    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.3)'
                }}
            >
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="center" justifyContent="space-between">
                    {/* Brand / Title */}
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
                                position: 'relative'
                            }}
                        >
                            <VolumeUpIcon sx={{ color: 'white', fontSize: 28 }} />
                            {running && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: '#10B981',
                                        bottom: -2,
                                        right: -2,
                                        border: '2px solid #0F172A',
                                        animation: 'pulse 1.5s infinite ease-in-out',
                                        '@keyframes pulse': {
                                            '0%': { transform: 'scale(0.8)', opacity: 0.5 },
                                            '50%': { transform: 'scale(1.2)', opacity: 1 },
                                            '100%': { transform: 'scale(0.8)', opacity: 0.5 }
                                        }
                                    }}
                                />
                            )}
                        </Box>
                        <Box>
                            <Typography variant="h5" fontWeight="800" sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                                OmniVoice 🌍
                                <Typography variant="caption" sx={{ bgcolor: 'rgba(255,255,255,0.08)', px: 1, py: 0.3, borderRadius: '6px', color: 'slate.300', fontSize: '0.7rem' }}>
                                    v0.2.1
                                </Typography>
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Massively Multilingual Zero-Shot TTS Model (Hỗ trợ hơn 600 ngôn ngữ, Voice Cloning & Voice Design)
                            </Typography>
                        </Box>
                    </Stack>

                    {/* Controller Actions */}
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Tooltip title="Tải lại trạng thái">
                            <IconButton onClick={() => checkStatus(true)} size="medium" sx={{ color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>

                        {running ? (
                            <>
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<StopIcon />}
                                    onClick={handleStop}
                                    disabled={actionLoading}
                                    sx={{
                                        borderRadius: '10px',
                                        textTransform: 'none',
                                        px: 3,
                                        py: 1,
                                        fontWeight: 700,
                                        borderColor: 'rgba(239, 68, 68, 0.4)',
                                        '&:hover': {
                                            bgcolor: 'rgba(239, 68, 68, 0.1)',
                                            borderColor: '#EF4444'
                                        }
                                    }}
                                >
                                    Dừng Server
                                </Button>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<OpenInNewIcon />}
                                    href="http://localhost:8001"
                                    target="_blank"
                                    sx={{
                                        borderRadius: '10px',
                                        textTransform: 'none',
                                        px: 3,
                                        py: 1,
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                                        boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                                        '&:hover': {
                                            boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)'
                                        }
                                    }}
                                >
                                    Mở tab mới
                                </Button>
                            </>
                        ) : (
                            <Button
                                variant="contained"
                                startIcon={<PlayArrowIcon />}
                                onClick={handleStart}
                                disabled={actionLoading}
                                sx={{
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    px: 3,
                                    py: 1,
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                                        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.4)'
                                    }
                                }}
                            >
                                {actionLoading ? 'Đang khởi động...' : 'Khởi động Server'}
                            </Button>
                        )}
                    </Stack>
                </Stack>
            </Paper>

            {/* Split Content Area */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, minHeight: 0 }}>
                {/* Left Panel: Web UI Embed (takes major space) */}
                <Box sx={{ flex: 3, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    {running ? (
                        <Paper
                            elevation={4}
                            sx={{
                                flex: 1,
                                borderRadius: '16px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.08)',
                                bgcolor: 'background.paper',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <Box sx={{ p: 1, bgcolor: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                <Typography variant="caption" sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 0.5, pl: 1 }}>
                                    <InfoIcon sx={{ fontSize: 14, color: '#3B82F6' }} />
                                    Giao diện Web UI Gradio (Đang chạy tại http://localhost:8001)
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#10B981', pr: 1, fontWeight: 700 }}>
                                    ● ONLINE
                                </Typography>
                            </Box>
                            {window.location.protocol === 'https:' ? (
                                <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, bgcolor: 'rgba(15,23,42,0.6)', textAlign: 'center' }}>
                                    <InfoIcon sx={{ fontSize: 48, color: '#f59e0b', mb: 2 }} />
                                    <Typography variant="h6" fontWeight="700" sx={{ color: 'white', mb: 1 }}>
                                        Trình duyệt chặn nhúng HTTP vào HTTPS (Mixed Content)
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mb: 3, lineHeight: 1.6, fontSize: '0.85rem' }}>
                                        Vì ứng dụng đang chạy ở chế độ bảo mật **HTTPS** (cổng 5173), trình duyệt ngăn chặn hiển thị trực tiếp giao diện OmniVoice **HTTP** (cổng 8001) trong khung hình này.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<OpenInNewIcon />}
                                        href="http://localhost:8001"
                                        target="_blank"
                                        sx={{
                                            borderRadius: '10px',
                                            textTransform: 'none',
                                            px: 4,
                                            py: 1.2,
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                                            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)',
                                            '&:hover': {
                                                boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)'
                                            }
                                        }}
                                    >
                                        Mở OmniVoice trong tab mới
                                    </Button>
                                </Box>
                            ) : (
                                <iframe
                                    src="http://localhost:8001"
                                    title="OmniVoice WebUI"
                                    style={{
                                        flex: 1,
                                        border: 'none',
                                        width: '100%',
                                        height: '100%'
                                    }}
                                />
                            )}
                        </Paper>
                    ) : (
                        <Paper
                            elevation={2}
                            sx={{
                                flex: 1,
                                borderRadius: '16px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                p: 4,
                                background: 'rgba(15,23,42,0.4)',
                                textAlign: 'center'
                            }}
                        >
                            <Box
                                sx={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(255, 255, 255, 0.03)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mb: 3,
                                    border: '1px solid rgba(255,255,255,0.05)'
                                }}
                            >
                                <MicIcon sx={{ fontSize: 40, color: '#64748B' }} />
                            </Box>
                            <Typography variant="h5" fontWeight="700" sx={{ color: 'white', mb: 1.5 }}>
                                Server OmniVoice Chưa Khởi Động
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500, mb: 4, lineHeight: 1.6 }}>
                                Mô hình trí tuệ nhân tạo chuyển văn bản thành giọng nói OmniVoice hiện đang ở chế độ ngoại tuyến. Hãy bấm nút phía trên để khởi chạy tiến trình và tải mô hình lên RAM.
                            </Typography>
                            <Button
                                variant="outlined"
                                color="primary"
                                startIcon={<PlayArrowIcon />}
                                onClick={handleStart}
                                disabled={actionLoading}
                                sx={{
                                    borderRadius: '10px',
                                    textTransform: 'none',
                                    px: 4,
                                    py: 1.2,
                                    fontWeight: 700,
                                    color: '#3B82F6',
                                    borderColor: 'rgba(59, 130, 246, 0.4)',
                                    '&:hover': {
                                        borderColor: '#3B82F6',
                                        bgcolor: 'rgba(59, 130, 246, 0.05)'
                                    }
                                }}
                            >
                                {actionLoading ? 'Đang khởi động Server...' : 'Khởi động ngay'}
                            </Button>
                        </Paper>
                    )}
                </Box>

                {/* Right Panel: Logs & Terminal (shows process feedback) */}
                <Box sx={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0 }}>
                    {/* Information Card */}
                    <Card
                        elevation={2}
                        sx={{
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(15,23,42,0.4)',
                            backdropFilter: 'blur(10px)'
                        }}
                    >
                        <CardContent sx={{ p: 2.5 }}>
                            <Typography variant="subtitle2" fontWeight="700" color="white" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <InfoIcon sx={{ color: '#8B5CF6', fontSize: 18 }} />
                                Giới thiệu & Hướng dẫn
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 2, lineHeight: 1.6 }}>
                                <strong>OmniVoice</strong> là mô hình tổng hợp giọng nói đa ngôn ngữ tiên tiến nhất hỗ trợ Zero-shot Voice Cloning (nhái giọng chỉ với 1 đoạn ghi âm mẫu ngắn 3-10 giây) và Voice Design (thiết kế thuộc tính giọng nói như giới tính, tuổi tác, tốc độ, tông giọng).
                            </Typography>
                            <Divider sx={{ my: 1.5, borderColor: 'rgba(255,255,255,0.08)' }} />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography variant="caption" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    ● <strong>Thiết bị:</strong> {pid ? 'Đang chạy (CPU mode)' : 'Tự động phát hiện (CPU/GPU)'}
                                </Typography>
                                <Typography variant="caption" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    ● <strong>Cổng truy cập:</strong> Localport 8001
                                </Typography>
                                <Typography variant="caption" color="text.primary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    ● <strong>Mạng HuggingFace:</strong> Đã chuyển hướng qua hf-mirror.com
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Console logs */}
                    <Paper
                        elevation={4}
                        sx={{
                            flex: 1,
                            borderRadius: '16px',
                            border: '1px solid rgba(255,255,255,0.08)',
                            bgcolor: '#090d16',
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: 0,
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                px: 2,
                                py: 1.5,
                                bgcolor: '#0f172a',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                borderBottom: '1px solid rgba(255,255,255,0.08)'
                            }}
                        >
                            <TerminalIcon sx={{ color: '#10B981', fontSize: 18 }} />
                            <Typography variant="subtitle2" color="white" fontWeight="700">
                                Bảng nhật ký tiến trình (Logs)
                            </Typography>
                        </Box>

                        <Box
                            sx={{
                                flex: 1,
                                p: 2,
                                overflowY: 'auto',
                                fontFamily: 'Consolas, Courier New, monospace',
                                fontSize: '0.75rem',
                                color: '#a7f3d0',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5,
                                scrollbarWidth: 'thin',
                                '&::-webkit-scrollbar': { width: '4px' },
                                '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)' }
                            }}
                        >
                            {logs.length === 0 ? (
                                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    Không có hoạt động nào được ghi lại. Hãy khởi động server.
                                </Typography>
                            ) : (
                                logs.map((log, index) => {
                                    let color = '#a7f3d0';
                                    if (log.includes('[SYSTEM]')) color = '#3B82F6';
                                    if (log.includes('[STDERR]')) color = '#FCA5A5';
                                    if (log.includes('error') || log.includes('Exception') || log.includes('Lỗi')) color = '#EF4444';

                                    return (
                                        <div key={index} style={{ color, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                            {log}
                                        </div>
                                    );
                                })
                            )}
                            <div ref={logEndRef} />
                        </Box>
                    </Paper>
                </Box>
            </Box>
        </Container>
    );
}
