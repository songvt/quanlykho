import { useState, useEffect } from 'react';
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
            bgcolor="#f5f5f5"
        >
            <Paper elevation={3} sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400, textAlign: 'center' }}>
                <Box bgcolor="primary.main" p={2} borderRadius="50%" display="inline-flex" mb={2}>
                    <LockOutlinedIcon style={{ color: 'white', fontSize: 30 }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 1
                }}>
                    ĐĂNG NHẬP HỆ THỐNG
                </Typography>
                <Typography variant="body2" color="textSecondary" mb={3}>
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
