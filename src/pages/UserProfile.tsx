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
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import { GoogleSheetService as SupabaseService } from '../services/GoogleSheetService';
import { supabase } from '../config/supabase';
import { logoutUser } from '../store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/Common/PageHeader';

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

    const handleProfileSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const base64Data = reader.result as string;
            try {
                if (!profile?.id) return;
                const { error: updateErr } = await supabase
                    .from('employees')
                    .update({ signature_data: base64Data })
                    .eq('id', profile.id);
                
                if (updateErr) throw updateErr;
                
                alert('Cập nhật chữ ký cá nhân thành công. Vui lòng tải lại trang để áp dụng.');
                window.location.reload();
            } catch (err: any) {
                alert(`Lỗi lưu chữ ký: ${err.message}`);
            }
        };
    };

    const handleDeleteSignature = async () => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa chữ ký mặc định?')) return;
        try {
            if (!profile?.id) return;
            const { error: updateErr } = await supabase
                .from('employees')
                .update({ signature_data: null })
                .eq('id', profile.id);
            
            if (updateErr) throw updateErr;
            alert('Đã xóa chữ ký cá nhân.');
            window.location.reload();
        } catch (err: any) {
            alert(`Lỗi: ${err.message}`);
        }
    };

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
            <PageHeader 
                title="Hồ Sơ Cá Nhân"
                subtitle="Xem thông tin tài khoản, chức vụ và thay đổi mật khẩu đăng nhập hệ thống"
                icon={<PersonIcon sx={{ fontSize: 30, color: 'white' }} />}
                gradientType="slate"
            />

            <Grid container spacing={3}>
                {/* Left Column: User Info & Default Signature */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Paper sx={{ p: 4, textAlign: 'center', mb: 3, borderRadius: 3 }}>
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

                    <Paper sx={{ p: 3, borderRadius: 3 }}>
                        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, color: 'primary.main' }}>
                            Chữ ký tay mặc định
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                            Ảnh chữ ký này sẽ được tự động điền khi ký phê duyệt tài liệu.
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        {profile?.signature_data ? (
                            <Box sx={{ textAlign: 'center' }}>
                                <Box 
                                    component="img" 
                                    src={profile.signature_data} 
                                    alt="Chữ ký cá nhân" 
                                    sx={{ 
                                        maxWidth: '100%', 
                                        maxHeight: 120, 
                                        border: '1px solid var(--border-color)', 
                                        borderRadius: '8px', 
                                        p: 1, 
                                        bgcolor: '#fff', 
                                        mb: 2,
                                        objectFit: 'contain'
                                    }} 
                                />
                                <Button 
                                    fullWidth
                                    variant="outlined" 
                                    color="error" 
                                    startIcon={<DeleteIcon />}
                                    onClick={handleDeleteSignature}
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Xóa chữ ký hiện tại
                                </Button>
                            </Box>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 1.5 }}>
                                <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontStyle: 'italic' }}>
                                    Chưa thiết lập ảnh chữ ký tay.
                                </Typography>
                                <Button
                                    fullWidth
                                    variant="contained"
                                    component="label"
                                    startIcon={<UploadIcon />}
                                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Tải lên ảnh chữ ký
                                    <input type="file" accept="image/*" hidden onChange={handleProfileSignatureUpload} />
                                </Button>
                            </Box>
                        )}
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
