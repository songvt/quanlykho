import React, { useState } from 'react';
import {
    Box,
    Button,
    Container,
    Paper,
    TextField,
    Typography,
    Alert,
    CircularProgress
} from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { GoogleSheetService as SupabaseService } from '../services/GoogleSheetService';
import type { RootState } from '../store';
import { logoutUser } from '../store/slices/authSlice';

const ChangePassword = () => {
    const dispatch = useDispatch<any>();
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        if (password !== confirmPassword) {
            setError('Mật khẩu không khớp');
            return;
        }

        try {
            setLoading(true);
            if (!profile?.id) throw new Error('Không tìm thấy thông tin người dùng. Vui lòng đăng nhập lại.');

            await SupabaseService.changePassword(profile.id, password);

            // Logout and redirect to login page to force fresh session
            await dispatch(logoutUser());
            alert('Đổi mật khẩu thành công! Vui lòng đăng nhập lại với mật khẩu mới.');
            navigate('/login');
        } catch (err: any) {
            console.error('Change password error:', err);
            setError(err.message || 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Paper elevation={3} sx={{ p: 4, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography component="h1" variant="h5" fontWeight="bold" gutterBottom color="primary">
                        Đổi Mật Khẩu
                    </Typography>

                    <Alert severity="info" sx={{ mb: 2, width: '100%' }}>
                        Bạn cần đổi mật khẩu để tiếp tục.
                    </Alert>

                    {error && <Alert severity="error" sx={{ mb: 2, width: '100%' }}>{error}</Alert>}

                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1, width: '100%' }}>
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="Mật khẩu mới"
                            type="password"
                            id="password"
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="confirmPassword"
                            label="Nhập lại mật khẩu"
                            type="password"
                            id="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading}
                            sx={{ mt: 3, mb: 1, height: 48 }}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Đổi Mật Khẩu'}
                        </Button>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={async () => {
                                await dispatch(logoutUser());
                                navigate('/login');
                            }}
                            sx={{ height: 48 }}
                        >
                            Đăng xuất
                        </Button>
                    </Box>
                </Paper>
            </Box>
        </Container>
    );
};

export default ChangePassword;
