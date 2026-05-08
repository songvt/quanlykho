import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    Box, Paper, Typography, TextField, Button, Alert, CircularProgress
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { loginUser, clearError } from '../store/slices/authSlice';
import type { RootState, AppDispatch } from '../store';

const Login = () => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { status, error, isAuthenticated } = useSelector((state: RootState) => state.auth);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        // Redirect if already logged in
        if (isAuthenticated) {
            navigate('/');
        }
        return () => {
            dispatch(clearError());
        };
    }, [isAuthenticated, navigate, dispatch]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password) return;

        await dispatch(loginUser({ email, password }));
    };

    return (
        <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
            sx={{
                bgcolor: 'background.default',
                backgroundImage: (t) =>
                    `radial-gradient(1200px 600px at 20% 0%, ${t.palette.primary.main}12, transparent 55%), radial-gradient(800px 400px at 100% 100%, ${t.palette.info.main}10, transparent 50%)`,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, sm: 4.5 },
                    width: '100%',
                    maxWidth: 420,
                    textAlign: 'center',
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: (t) => t.shadows[3],
                }}
            >
                <Box
                    sx={{
                        bgcolor: 'primary.main',
                        p: 1.75,
                        borderRadius: 2.5,
                        display: 'inline-flex',
                        mb: 2.5,
                        boxShadow: (t) => `0 8px 24px ${t.palette.primary.main}40`,
                    }}
                >
                    <LockOutlinedIcon sx={{ color: 'common.white', fontSize: 28 }} />
                </Box>
                <Typography
                    variant="h5"
                    gutterBottom
                    sx={{
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        color: 'text.primary',
                        mb: 0.5,
                    }}
                >
                    Đăng nhập
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={3} sx={{ fontWeight: 500 }}>
                    Vui lòng đăng nhập để tiếp tục
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleLogin}>
                    <TextField
                        fullWidth
                        label="Email"
                        type="email"
                        variant="outlined"
                        margin="normal"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={status === 'loading'}
                    />
                    <TextField
                        fullWidth
                        label="Mật khẩu"
                        type="password"
                        variant="outlined"
                        margin="normal"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={status === 'loading'}
                    />

                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        size="large"
                        sx={{ mt: 3, mb: 2 }}
                        disabled={status === 'loading'}
                    >
                        {status === 'loading' ? <CircularProgress size={24} color="inherit" /> : 'Đăng Nhập'}
                    </Button>

                    {/* Demo credential hint (remove in production) */}
                    <Box mt={2}>
                        <Typography variant="caption" color="textSecondary">
                            Liên hệ hỗ trợ: <b>0988.229.082</b> - Email: <b>songvt@gmail.com</b>
                        </Typography>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default Login;
