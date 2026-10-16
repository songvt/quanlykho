import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, CircularProgress, Alert, Grid, Chip } from '@mui/material';
import { Save, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { useNotification } from '../../contexts/NotificationContext';

const API_BASE = '/api/zalo?action=config';
const API_TEST = '/api/zalo?action=test_connection';

const ZaloConfig: React.FC = () => {
    const { notify, success, error: notifyError } = useNotification();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [config, setConfig] = useState({
        oa_id: '',
        app_id: '',
        secret_key: '',
        access_token_encrypted: '',
        refresh_token_encrypted: '',
        is_active: false,
        last_check_status: ''
    });

    useEffect(() => {
        fetchConfig();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Load configuration once on mount.

    const fetchConfig = async () => {
        try {
            const res = await fetch(API_BASE);
            const json = await res.json();
            if (json.success && json.data) {
                setConfig(prev => ({ ...prev, ...json.data }));
            }
        } catch (error) {
            console.error("Failed to fetch Zalo config", error);
            notifyError('Không thể tải cấu hình Zalo');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setConfig(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                oa_id: config.oa_id,
                app_id: config.app_id,
                secret_key: config.secret_key,
                access_token_encrypted: config.access_token_encrypted,
                refresh_token_encrypted: config.refresh_token_encrypted
            };

            const res = await fetch(API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (json.success) {
                success('Lưu cấu hình thành công');
                setConfig(prev => ({ ...prev, ...json.data }));
            } else {
                notifyError(json.error || 'Lỗi khi lưu cấu hình');
            }
        } catch (error) {
            notifyError('Lỗi kết nối máy chủ');
        } finally {
            setSaving(false);
        }
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            const res = await fetch(API_TEST, { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                success('Kết nối Zalo OA thành công!');
                fetchConfig(); // Reload to get updated status
            } else {
                notifyError(`Lỗi kết nối: ${json.error}`);
                setConfig(prev => ({ ...prev, last_check_status: 'FAILED', is_active: false }));
            }
        } catch (error) {
            notifyError('Lỗi kết nối máy chủ');
        } finally {
            setTesting(false);
        }
    };

    if (loading) return <Box p={4} display="flex" justifyContent="center"><CircularProgress /></Box>;

    return (
        <Box p={3} maxWidth={800} mx="auto">
            <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
                Cấu hình Zalo Official Account
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={4}>
                Nhập thông tin Zalo App để kết nối API gửi thông báo ZNS và quản lý OA.
            </Typography>

            <Paper sx={{ p: 3, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                    <Typography variant="h6" fontWeight={600}>Thông tin kết nối</Typography>
                    <Chip 
                        icon={config.is_active ? <CheckCircle /> : <ErrorIcon />} 
                        label={config.is_active ? 'Đã kết nối' : 'Chưa kết nối'} 
                        color={config.is_active ? 'success' : 'default'}
                        variant={config.is_active ? 'filled' : 'outlined'}
                    />
                </Box>

                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label="Zalo OA ID"
                            name="oa_id"
                            value={config.oa_id || ''}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            fullWidth
                            label="App ID"
                            name="app_id"
                            value={config.app_id || ''}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label="Secret Key"
                            name="secret_key"
                            type="password"
                            value={config.secret_key || ''}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label="Access Token (Cấp mới từ Zalo for Developers)"
                            name="access_token_encrypted"
                            value={config.access_token_encrypted || ''}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
                            multiline
                            rows={3}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            fullWidth
                            label="Refresh Token (Tùy chọn)"
                            name="refresh_token_encrypted"
                            value={config.refresh_token_encrypted || ''}
                            onChange={handleChange}
                            variant="outlined"
                            size="small"
                            multiline
                            rows={2}
                        />
                    </Grid>
                </Grid>

                <Box mt={4} display="flex" gap={2} justifyContent="flex-end">
                    <Button 
                        variant="outlined" 
                        color="primary"
                        onClick={handleTestConnection}
                        disabled={testing || !config.access_token_encrypted}
                    >
                        {testing ? <CircularProgress size={24} /> : 'Kiểm tra kết nối'}
                    </Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        startIcon={<Save />}
                        onClick={handleSave}
                        disabled={saving}
                        sx={{ boxShadow: 'none' }}
                    >
                        {saving ? <CircularProgress size={24} color="inherit" /> : 'Lưu cấu hình'}
                    </Button>
                </Box>
            </Paper>
            
            {config.last_check_status === 'FAILED' && (
                <Alert severity="error" sx={{ mt: 3 }}>
                    Kiểm tra kết nối lần cuối thất bại. Vui lòng kiểm tra lại Access Token.
                </Alert>
            )}
            {config.last_check_status === 'SUCCESS' && (
                <Alert severity="success" sx={{ mt: 3 }}>
                    Hệ thống đang được kết nối với Zalo OA thành công! Bạn có thể sử dụng các tính năng gửi ZNS.
                </Alert>
            )}
        </Box>
    );
};

export default ZaloConfig;
