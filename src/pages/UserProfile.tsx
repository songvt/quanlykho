import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Avatar,
    Grid,
    TextField,
    Button,
    Divider,
    Alert,
    CircularProgress,
    Stack,
    Chip
} from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../store';
import PersonIcon from '@mui/icons-material/Person';
import LockResetIcon from '@mui/icons-material/LockReset';
import SaveIcon from '@mui/icons-material/Save';
import { SupabaseService } from '../services/SupabaseService';
import { logoutUser } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';

const UserProfile = () => {
    const { profile } = useSelector((state: RootState) => state.auth);
    const dispatch = useDispatch<any>();
    const navigate = useNavigate();

    // Password Change State
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

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
            if (!profile?.id) throw new Error('Không tìm thấy thông tin người dùng.');

            await SupabaseService.changePassword(profile.id, password);

            setSuccess('Đổi mật khẩu thành công! Bạn sẽ được đăng xuất sau 3 giây.');

            setTimeout(async () => {
                await dispatch(logoutUser());
                navigate('/login');
            }, 3000);

        } catch (err: any) {
            console.error('Change password error:', err);
            setError(err.message || 'Đã có lỗi xảy ra');
        } finally {
            setLoading(false);
        }
    };

    const getRoleParams = (role?: string) => {
        switch (role) {
            case 'admin': return { label: 'Quản trị viên', color: 'error' as const };
            case 'manager': return { label: 'Quản lý', color: 'warning' as const };
            default: return { label: 'Nhân viên', color: 'primary' as const };
        }
    };

    const roleInfo = getRoleParams(profile?.role);

    return (
        <Box maxWidth="lg" mx="auto">
            <Typography variant="h4" fontWeight="900" mb={3} sx={{
                textTransform: 'uppercase',
                background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 2
            }}>
                <PersonIcon fontSize="large" sx={{ color: '#2196F3' }} />
                Hồ Sơ Cá Nhân
            </Typography>

            <Grid container spacing={3}>
                {/* Left Column: User Info */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 4, textAlign: 'center', height: '100%', borderRadius: 3 }}>
                        <Avatar sx={{
                            width: 100,
                            height: 100,
                            mx: 'auto',
                            mb: 2,
                            bgcolor: 'primary.main',
                            fontSize: '2.5rem',
                            boxShadow: '0 4px 12px rgba(33, 150, 243, 0.3)'
                        }}>
                            {profile?.full_name?.charAt(0) || 'U'}
                        </Avatar>
                        <Typography variant="h5" fontWeight="bold" gutterBottom>
                            {profile?.full_name}
                        </Typography>
                        <Chip
                            label={roleInfo.label}
                            color={roleInfo.color}
                            size="small"
                            sx={{ mb: 3, fontWeight: 600 }}
                        />

                        <Stack spacing={2} textAlign="left">
                            <Box>
                                <Typography variant="caption" color="text.secondary">Tên đăng nhập</Typography>
                                <Typography variant="body1" fontWeight="500">{profile?.username}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Email</Typography>
                                <Typography variant="body1" fontWeight="500">{profile?.email}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Số điện thoại</Typography>
                                <Typography variant="body1" fontWeight="500">{profile?.phone_number || 'Chưa cập nhật'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Khu vực / Quận</Typography>
                                <Typography variant="body1" fontWeight="500">{profile?.district || 'Chưa phân bổ'}</Typography>
                            </Box>
                        </Stack>
                    </Paper>
                </Grid>

                {/* Right Column: Change Password */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Paper sx={{ p: 4, height: '100%', borderRadius: 3 }}>
                        <Box display="flex" alignItems="center" gap={1} mb={3}>
                            <LockResetIcon color="primary" />
                            <Typography variant="h6" fontWeight="bold" color="primary.main">
                                Đổi Mật Khẩu
                            </Typography>
                        </Box>

                        <Divider sx={{ mb: 3 }} />

                        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
                        {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

                        <form onSubmit={handlePasswordChange}>
                            <Stack spacing={3}>
                                <TextField
                                    label="Mật khẩu mới"
                                    type="password"
                                    fullWidth
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                                    disabled={loading || !!success}
                                />
                                <TextField
                                    label="Xác nhận mật khẩu mới"
                                    type="password"
                                    fullWidth
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới"
                                    disabled={loading || !!success}
                                />

                                <Box display="flex" justifyContent="flex-end" mt={2}>
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        size="large"
                                        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                        disabled={loading || !!success}
                                        sx={{
                                            px: 4,
                                            borderRadius: 2,
                                            textTransform: 'none',
                                            fontWeight: 700
                                        }}
                                    >
                                        Lưu thay đổi
                                    </Button>
                                </Box>
                            </Stack>
                        </form>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
};

export default UserProfile;
