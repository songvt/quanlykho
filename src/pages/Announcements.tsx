import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    TextField,
    Typography,
    Switch,
    FormControlLabel,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Divider,
    CircularProgress,
    Chip
} from '@mui/material';
import { Trash2, Plus, Bell, RefreshCw } from 'lucide-react';
import { supabase } from '../config/supabase';
import { useNotification } from '../contexts/NotificationContext';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

interface Announcement {
    id: string;
    title: string;
    content: string;
    active: boolean;
    created_at: string;
    created_by: string | null;
}

const Announcements: React.FC = () => {
    const { profile } = useSelector((state: RootState) => state.auth);
    const { success, error: notifyError } = useNotification();

    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [active, setActive] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAnnouncements(data || []);
        } catch (err: any) {
            console.error('Lỗi khi lấy thông báo:', err);
            notifyError('Không thể tải danh sách thông báo: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || !content.trim()) {
            notifyError('Vui lòng điền đầy đủ tiêu đề và nội dung');
            return;
        }

        setSubmitting(true);
        try {
            const { error } = await supabase
                .from('announcements')
                .insert([
                    {
                        title: title.trim(),
                        content: content.trim(),
                        active,
                        created_by: profile?.full_name || profile?.email || 'Admin'
                    }
                ]);

            if (error) throw error;

            success('Tạo thông báo thành công!');
            setTitle('');
            setContent('');
            setActive(true);
            fetchAnnouncements();
        } catch (err: any) {
            console.error('Lỗi khi tạo thông báo:', err);
            notifyError('Không thể tạo thông báo: ' + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        try {
            const { error } = await supabase
                .from('announcements')
                .update({ active: !currentStatus })
                .eq('id', id);

            if (error) throw error;

            setAnnouncements(prev =>
                prev.map(ann => (ann.id === id ? { ...ann, active: !currentStatus } : ann))
            );
            success('Cập nhật trạng thái thông báo thành công!');
        } catch (err: any) {
            console.error('Lỗi khi cập nhật trạng thái:', err);
            notifyError('Không thể cập nhật trạng thái: ' + err.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa thông báo này?')) return;

        try {
            const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setAnnouncements(prev => prev.filter(ann => ann.id !== id));
            success('Xóa thông báo thành công!');
        } catch (err: any) {
            console.error('Lỗi khi xóa thông báo:', err);
            notifyError('Không thể xóa thông báo: ' + err.message);
        }
    };

    return (
        <Box sx={{ flexGrow: 1, p: { xs: 1, md: 3 } }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Box sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                    }}>
                        <Bell color="white" size={22} />
                    </Box>
                    <Box>
                        <Typography variant="h5" fontWeight="bold" color="text.primary">
                            Thông báo hệ thống
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Quản lý các thông báo hiển thị cho tất cả nhân viên khi đăng nhập
                        </Typography>
                    </Box>
                </Box>
                <Button 
                    startIcon={<RefreshCw size={18} />} 
                    onClick={fetchAnnouncements} 
                    variant="outlined" 
                    size="small"
                >
                    Tải lại
                </Button>
            </Box>

            <Box display="grid" gridTemplateColumns={{ xs: '1fr', lg: '1fr 2fr' }} gap={3}>
                {/* Form tạo mới thông báo */}
                <Card sx={{ height: 'fit-content', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', borderRadius: '16px' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight="bold" mb={2} display="flex" alignItems="center" gap={1}>
                            <Plus size={20} /> Tạo thông báo mới
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <Box component="form" onSubmit={handleSubmit} display="flex" flexDirection="column" gap={2.5}>
                            <TextField
                                label="Tiêu đề thông báo"
                                placeholder="Nhập tiêu đề ngắn gọn..."
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                                fullWidth
                                variant="outlined"
                            />
                            
                            <TextField
                                label="Nội dung thông báo"
                                placeholder="Nhập nội dung hiển thị trên popup..."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                required
                                fullWidth
                                multiline
                                rows={4}
                                variant="outlined"
                            />

                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={active}
                                        onChange={(e) => setActive(e.target.checked)}
                                        color="warning"
                                    />
                                }
                                label="Kích hoạt hiển thị ngay lập tức"
                            />

                            <Button
                                type="submit"
                                variant="contained"
                                color="warning"
                                disabled={submitting}
                                sx={{ 
                                    py: 1.2, 
                                    fontWeight: 'bold', 
                                    borderRadius: '10px',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.2)'
                                }}
                            >
                                {submitting ? <CircularProgress size={24} color="inherit" /> : 'Gửi thông báo'}
                            </Button>
                        </Box>
                    </CardContent>
                </Card>

                {/* Danh sách thông báo */}
                <Card sx={{ boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)', borderRadius: '16px' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" fontWeight="bold" mb={2}>
                            Lịch sử thông báo đã gửi
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        {loading ? (
                            <Box display="flex" justifyContent="center" py={5}>
                                <CircularProgress color="warning" />
                            </Box>
                        ) : announcements.length === 0 ? (
                            <Box display="flex" flexDirection="column" alignItems="center" py={5} sx={{ color: 'text.secondary' }}>
                                <Bell size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
                                <Typography>Chưa có thông báo nào được tạo.</Typography>
                            </Box>
                        ) : (
                            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                                <Table>
                                    <TableHead sx={{ bgcolor: 'var(--bg-default)' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Thông tin gửi</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold' }}>Nội dung hiển thị</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Trạng thái</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', textAlign: 'center' }}>Thao tác</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {announcements.map((ann) => (
                                            <TableRow key={ann.id} hover>
                                                <TableCell sx={{ minWidth: 150 }}>
                                                    <Typography variant="subtitle2" fontWeight="bold">
                                                        {ann.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                        Gửi bởi: {ann.created_by || 'Hệ thống'}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {new Date(ann.created_at).toLocaleString('vi-VN')}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ maxWidth: 300, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                                    <Typography variant="body2">
                                                        {ann.content}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                size="small"
                                                                checked={ann.active}
                                                                onChange={() => handleToggleActive(ann.id, ann.active)}
                                                                color="warning"
                                                            />
                                                        }
                                                        label={
                                                            <Chip 
                                                                label={ann.active ? 'Đang bật' : 'Đã tắt'} 
                                                                size="small" 
                                                                color={ann.active ? 'success' : 'default'}
                                                                variant="outlined"
                                                            />
                                                        }
                                                        labelPlacement="bottom"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center' }}>
                                                    <IconButton 
                                                        color="error" 
                                                        onClick={() => handleDelete(ann.id)}
                                                        size="small"
                                                    >
                                                        <Trash2 size={18} />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
};

export default Announcements;
