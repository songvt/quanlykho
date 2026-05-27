import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, TextField, Button, Alert, CircularProgress,
    InputAdornment, IconButton,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { loginUser, clearError } from '../store/slices/authSlice';
import type { RootState, AppDispatch } from '../store';

const Login = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { status, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    useEffect(() => {
        if (isAuthenticated) navigate('/');
        return () => { dispatch(clearError()); };
    }, [isAuthenticated, navigate, dispatch]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;
        await dispatch(loginUser({ email, password }));
    };

    return (
        <Box
            sx={{
                minHeight: '100svh',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                px: { xs: 2, sm: 4 },
                py: 4,
                // Premium gradient background
                background: 'linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #f5f0ff 60%, #fdf2f8 100%)',
                position: 'relative',
                overflow: 'hidden',
                // Safe area padding
                paddingTop: 'max(32px, env(safe-area-inset-top))',
                paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
            }}
        >
            {/* Decorative background blobs */}
            <Box sx={{
                position: 'absolute', top: '-15%', right: '-10%',
                width: { xs: 250, sm: 400 }, height: { xs: 250, sm: 400 },
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, transparent 70%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
            }} />
            <Box sx={{
                position: 'absolute', bottom: '-10%', left: '-8%',
                width: { xs: 200, sm: 350 }, height: { xs: 200, sm: 350 },
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%)',
                filter: 'blur(40px)',
                pointerEvents: 'none',
            }} />

            {/* Brand Header */}
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mb: 3,
                animation: 'fadeInUp 0.5s ease both',
                '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(20px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                }
            }}>
                {/* Logo */}
                <Box sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 50%, #60a5fa 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: 2,
                    boxShadow: '0 12px 32px rgba(37, 99, 235, 0.35)',
                    animation: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                    '@keyframes bounceIn': {
                        from: { transform: 'scale(0.7)', opacity: 0 },
                        to: { transform: 'scale(1)', opacity: 1 }
                    }
                }}>
                    <LockOutlinedIcon sx={{ color: 'white', fontSize: 32 }} />
                </Box>
                <Typography sx={{
                    fontWeight: 900,
                    fontSize: { xs: '1.4rem', sm: '1.6rem' },
                    color: '#0f172a',
                    letterSpacing: '-0.03em',
                    textAlign: 'center',
                    lineHeight: 1.2,
                }}>
                    Quản lý kho
                </Typography>
                <Typography sx={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    fontWeight: 500,
                    mt: 0.5,
                    textAlign: 'center',
                }}>
                    Hệ thống quản lý kho GGS
                </Typography>
            </Box>

            {/* Login Card */}
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, sm: 4 },
                    width: '100%',
                    maxWidth: 420,
                    borderRadius: { xs: '20px', sm: '24px' },
                    border: '1px solid rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255,255,255,0.6)',
                    animation: 'fadeInUp 0.5s ease 0.1s both',
                    '@keyframes fadeInUp': {
                        from: { opacity: 0, transform: 'translateY(20px)' },
                        to: { opacity: 1, transform: 'translateY(0)' }
                    }
                }}
            >
                <Typography sx={{
                    fontWeight: 800,
                    fontSize: '1.3rem',
                    color: '#0f172a',
                    mb: 0.5,
                    letterSpacing: '-0.02em',
                }}>
                    Đăng nhập
                </Typography>
                <Typography sx={{
                    fontSize: '0.875rem',
                    color: '#64748b',
                    mb: 3,
                    fontWeight: 500,
                }}>
                    Nhập thông tin tài khoản để tiếp tục
                </Typography>

                {error && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: 2.5,
                            borderRadius: '12px',
                            border: '1px solid #fecaca',
                            bgcolor: '#fef2f2',
                            animation: 'fadeInUp 0.3s ease both',
                        }}
                    >
                        {error}
                    </Alert>
                )}

                <form onSubmit={handleLogin} noValidate>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {/* Email Field */}
                        <Box>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', mb: 0.75, letterSpacing: '0.01em' }}>
                                Email
                            </Typography>
                            <TextField
                                fullWidth
                                type="email"
                                placeholder="example@company.com"
                                variant="outlined"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={status === 'loading'}
                                autoComplete="email"
                                autoCapitalize="none"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: '#f8fafc',
                                        '&:hover': { bgcolor: '#f1f5f9' },
                                        '&.Mui-focused': { bgcolor: 'white' },
                                    },
                                }}
                            />
                        </Box>

                        {/* Password Field */}
                        <Box>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', mb: 0.75, letterSpacing: '0.01em' }}>
                                Mật khẩu
                            </Typography>
                            <TextField
                                fullWidth
                                type={showPassword ? 'text' : 'password'}
                                placeholder="••••••••"
                                variant="outlined"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={status === 'loading'}
                                autoComplete="current-password"
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockOutlinedIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(p => !p)}
                                                edge="end"
                                                sx={{ color: '#94a3b8', minWidth: 36, minHeight: 36 }}
                                                tabIndex={-1}
                                            >
                                                {showPassword ? <VisibilityOff sx={{ fontSize: 20 }} /> : <Visibility sx={{ fontSize: 20 }} />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        bgcolor: '#f8fafc',
                                        '&:hover': { bgcolor: '#f1f5f9' },
                                        '&.Mui-focused': { bgcolor: 'white' },
                                    },
                                }}
                            />
                        </Box>

                        {/* Login Button */}
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            color="primary"
                            size="large"
                            disabled={status === 'loading' || !email || !password}
                            sx={{
                                mt: 1,
                                height: 52,
                                fontSize: '1rem',
                                fontWeight: 700,
                                borderRadius: '12px',
                                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                                boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
                                transition: 'all 0.25s ease',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 12px 28px rgba(37, 99, 235, 0.4)',
                                },
                                '&:active': {
                                    transform: 'translateY(0)',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                                },
                                '&.Mui-disabled': {
                                    background: '#e2e8f0',
                                    color: '#94a3b8',
                                    boxShadow: 'none',
                                }
                            }}
                        >
                            {status === 'loading'
                                ? <CircularProgress size={22} sx={{ color: 'white' }} />
                                : 'Đăng nhập'
                            }
                        </Button>
                    </Box>
                </form>
            </Paper>

            {/* Support Info */}
            <Box sx={{
                mt: 3,
                textAlign: 'center',
                animation: 'fadeInUp 0.5s ease 0.2s both',
                '@keyframes fadeInUp': {
                    from: { opacity: 0, transform: 'translateY(16px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                }
            }}>
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    Cần hỗ trợ? Liên hệ:{' '}
                    <Box component="a" href="tel:0988229082" sx={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>
                        0988.229.082
                    </Box>
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#cbd5e1', mt: 0.5 }}>
                    © 2025 GGS Warehouse Management System
                </Typography>
            </Box>
        </Box>
    );
};

export default Login;
