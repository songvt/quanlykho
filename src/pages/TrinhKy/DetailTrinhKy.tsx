import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { 
    Box, Paper, Typography, Grid, Card, Button, Divider, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Alert, LinearProgress, List, ListItem, Avatar, IconButton
} from '@mui/material';
import { 
    ChevronLeft, Edit, RotateCcw, CheckSquare, Download, FileText, 
    Calendar, User, Clock, ShieldAlert, Award, FileSignature 
} from 'lucide-react';
import type { RootState } from '../../store';
import { formatDate } from '../../utils/dateUtils';

const STATUS_MAP: Record<string, { label: string; color: any }> = {
    'Nháp': { label: 'Bản nháp', color: 'default' },
    'Chờ ký': { label: 'Chờ ký', color: 'info' },
    'Đang ký': { label: 'Đang ký duyệt', color: 'warning' },
    'Hoàn thành': { label: 'Đã hoàn thành', color: 'success' },
    'Từ chối': { label: 'Bị từ chối', color: 'error' },
    'Thu hồi': { label: 'Đã thu hồi', color: 'secondary' }
};

const APPROVER_STATUS_MAP: Record<string, { label: string; color: any; icon: string }> = {
    'ChoKy': { label: 'Chờ ký', color: 'default', icon: '⌛' },
    'DangXuly': { label: 'Đang xử lý', color: 'warning', icon: '⏳' },
    'DaKy': { label: 'Đã ký duyệt', color: 'success', icon: '✓' },
    'DaKyNhay': { label: 'Đã ký nháy', color: 'primary', icon: '⚡' },
    'TuChoi': { label: 'Từ chối', color: 'error', icon: '✗' },
    'DaChuyen': { label: 'Đã chuyển người ký', color: 'secondary', icon: '➜' }
};

const ACTION_MAP: Record<string, string> = {
    'tao_moi': 'Khởi tạo hồ sơ',
    'gui_trinh': 'Gửi trình ký',
    'ky_duyet': 'Ký duyệt',
    'ky_nhay': 'Ký nháy',
    'tu_choi': 'Từ chối ký duyệt',
    'thu_hoi': 'Thu hồi hồ sơ',
    'yeu_cau_chinh_sua': 'Yêu cầu chỉnh sửa',
    'chuyen_nguoi_ky': 'Chuyển người ký'
};

const injectSignaturesIntoContent = (htmlContent: string, approvers: any[]) => {
    if (!htmlContent) return '';
    let updatedContent = htmlContent;
    
    // Sort approvers by their signing order (thu_tu_ky)
    const sortedApprovers = [...(approvers || [])].sort((a, b) => a.thu_tu_ky - b.thu_tu_ky);
    
    sortedApprovers.forEach((app, index) => {
        const placeholder = `{{signature_${index + 1}}}`;
        const placeholderAlt = `{{chunky_${index + 1}}}`;
        
        if (app.trang_thai === 'DaKy' || app.trang_thai === 'DaKyNhay') {
            if (app.signature_data) {
                const imgTag = `<div style="text-align: center; margin: 5px 0;"><img src="${app.signature_data}" style="max-height: 80px; max-width: 150px; object-fit: contain; display: inline-block;" alt="Chữ ký ${app.employee?.full_name || ''}" /><div style="font-size: 0.75rem; color: gray;">Ký bởi: ${app.employee?.full_name || ''}</div></div>`;
                updatedContent = updatedContent.replaceAll(placeholder, imgTag);
                updatedContent = updatedContent.replaceAll(placeholderAlt, imgTag);
            } else {
                const textTag = `<div style="color: green; text-align: center; font-weight: bold; font-size: 0.8rem; padding: 5px;">✓ Đã ký duyệt<br/><span style="font-size: 0.7rem; color: gray;">${app.employee?.full_name || ''}</span></div>`;
                updatedContent = updatedContent.replaceAll(placeholder, textTag);
                updatedContent = updatedContent.replaceAll(placeholderAlt, textTag);
            }
        } else {
            const spacer = `<div style="height: 45px; color: #aaa; font-size: 0.75rem; text-align: center; font-style: italic; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; border-radius: 4px; padding: 2px; background: rgba(0,0,0,0.01);">Chờ ${app.employee?.full_name || 'ký'}</div>`;
            updatedContent = updatedContent.replaceAll(placeholder, spacer);
            updatedContent = updatedContent.replaceAll(placeholderAlt, spacer);
        }
    });
    
    return updatedContent;
};

const DetailTrinhKy: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);

    const [document, setDocument] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchDetail = async () => {
        if (!id) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/trinhky?id=${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch details');
            setDocument(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải chi tiết hồ sơ trình ký');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const handleWorkflowAction = async (actionType: string) => {
        if (!window.confirm(`Bạn có chắc chắn muốn thực hiện hành động này?`)) return;
        setIsActionLoading(true);
        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'workflow_action',
                    payload: {
                        hoso_id: id,
                        user_id: profile?.id,
                        action_type: actionType,
                        comment: actionType === 'thu_hoi' ? 'Thu hồi từ màn hình chi tiết' : 'Gửi trình duyệt lại'
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            fetchDetail();
        } catch (err: any) {
            alert(`Lỗi thực hiện: ${err.message}`);
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading) return <LinearProgress sx={{ mt: 5 }} />;

    if (errorMsg || !document) {
        return (
            <Box p={3}>
                <Alert severity="error">{errorMsg || 'Không tìm thấy hồ sơ.'}</Alert>
                <Button startIcon={<ChevronLeft size={16} />} onClick={() => navigate('/trinh-ky/list')} sx={{ mt: 2 }}>
                    Quay lại danh sách
                </Button>
            </Box>
        );
    }

    const statusMeta = STATUS_MAP[document.trang_thai] || { label: document.trang_thai, color: 'default' };
    
    // Check if current user is active signer
    const isPendingSigner = document.approvers?.some(
        (app: any) => app.user_id === profile?.id && app.trang_thai === 'DangXuly'
    );

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            {/* Header branding red-white */}
            <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Box display="flex" alignItems="center" gap={1.5}>
                    <Button startIcon={<ChevronLeft size={16} />} onClick={() => navigate(-1)} sx={{ textTransform: 'none' }}>
                        Quay lại
                    </Button>
                    <Divider orientation="vertical" flexItem />
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>
                            Hồ sơ: {document.so_hoso}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {document.tieu_de}
                        </Typography>
                    </Box>
                </Box>
                
                <Box display="flex" gap={1}>
                    {isPendingSigner && (
                        <Button 
                            variant="contained" 
                            color="error" 
                            startIcon={<CheckSquare size={16} />}
                            onClick={() => navigate(`/trinh-ky/approve/${document.id}`)}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                            Ký duyệt ngay
                        </Button>
                    )}

                    {document.nguoi_tao === profile?.id && (document.trang_thai === 'Nháp' || document.trang_thai === 'Thu hồi' || document.trang_thai === 'Từ chối') && (
                        <Button 
                            variant="contained" 
                            startIcon={<FileSignature size={16} />}
                            onClick={() => handleWorkflowAction('gui_lai')}
                            disabled={isActionLoading}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                            Gửi lại trình ký
                        </Button>
                    )}

                    {document.nguoi_tao === profile?.id && document.trang_thai === 'Đang ký' && (
                        <Button 
                            variant="outlined" 
                            color="secondary"
                            startIcon={<RotateCcw size={16} />}
                            onClick={() => handleWorkflowAction('thu_hoi')}
                            disabled={isActionLoading}
                            sx={{ textTransform: 'none', borderRadius: '8px' }}
                        >
                            Thu hồi
                        </Button>
                    )}
                </Box>
            </Paper>

            <Grid container spacing={3}>
                {/* Document details & content */}
                <Grid size={{ xs: 12, md: 8 }}>
                    {/* Metadata Card */}
                    <Card sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            Thông tin chung hồ sơ
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Loại hồ sơ</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.loai_hoso}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Độ mật</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.do_mat}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Độ khẩn</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.do_khan}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Người trình</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.creator?.full_name}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Đơn vị trình</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.don_vi || 'N/A'}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Ngày tạo</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatDate(document.ngay_tao)}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Hình thức ký</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {document.hinh_thuc_ky === 'tuan_tu' ? 'Ký tuần tự' : 'Ký song song'}
                                </Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Trạng thái hồ sơ</Typography>
                                <Box sx={{ mt: 0.5 }}>
                                    <Chip label={statusMeta.label} color={statusMeta.color} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                                </Box>
                            </Grid>
                        </Grid>
                    </Card>

                    {/* HTML Content Body */}
                    <Card sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            Nội dung văn bản
                        </Typography>
                        <Box 
                            className="rich-text-content"
                            dangerouslySetInnerHTML={{ __html: injectSignaturesIntoContent(document.noi_dung, document.approvers) || '<p style="color: grey; font-style: italic;">Không có nội dung soạn thảo.</p>' }} 
                            sx={{ 
                                p: 2.5, 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '12px', 
                                minHeight: '300px',
                                fontSize: '0.95rem',
                                lineHeight: 1.6,
                                '& table': {
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    margin: '12px 0'
                                },
                                '& td, & th': {
                                    border: '1px solid var(--border-color)',
                                    padding: '8px 12px'
                                }
                            }}
                        />
                    </Card>

                    {/* File Attachments */}
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            File đính kèm ({document.attachments?.length || 0})
                        </Typography>
                        <Grid container spacing={2}>
                            {document.attachments?.map((file: any) => (
                                <Grid size={{ xs: 12, sm: 6 }} key={file.id}>
                                    <Paper 
                                        variant="outlined" 
                                        sx={{ 
                                            p: 1.5, 
                                            borderRadius: '8px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between',
                                            '&:hover': {
                                                borderColor: 'var(--brand-primary)'
                                            }
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" gap={1} sx={{ overflow: 'hidden' }}>
                                            <FileText size={18} color="var(--brand-primary)" />
                                            <Box sx={{ overflow: 'hidden' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                    {file.file_name}
                                                </Typography>
                                                <Typography variant="caption" color="textSecondary">
                                                    {(file.file_size / (1024 * 1024)).toFixed(2)} MB
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <IconButton component="a" href={file.public_url} target="_blank" color="primary" size="small">
                                            <Download size={16} />
                                        </IconButton>
                                    </Paper>
                                </Grid>
                            ))}

                            {(!document.attachments || document.attachments.length === 0) && (
                                <Grid size={{ xs: 12 }}>
                                    <Typography color="textSecondary" align="center" variant="body2">Không có file đính kèm</Typography>
                                </Grid>
                            )}
                        </Grid>
                    </Card>
                </Grid>

                {/* Signing Timeline & Action Log */}
                <Grid size={{ xs: 12, md: 4 }}>
                    {/* Vertical Timeline Card */}
                    <Card sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 3 }}>
                            Luồng phê duyệt
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
                            {document.approvers?.map((app: any, idx: number) => {
                                const appMeta = APPROVER_STATUS_MAP[app.trang_thai] || { label: app.trang_thai, color: 'default', icon: '?' };
                                return (
                                    <Box key={app.id} display="flex" gap={2}>
                                        <Box display="flex" flexDirection="column" alignItems="center">
                                            <Avatar 
                                                sx={{ 
                                                    width: 32, 
                                                    height: 32, 
                                                    fontSize: '0.85rem',
                                                    fontWeight: 'bold',
                                                    bgcolor: app.trang_thai === 'DaKy' || app.trang_thai === 'DaKyNhay' ? 'success.main' : app.trang_thai === 'DangXuly' ? 'warning.main' : 'grey.400' 
                                                }}
                                            >
                                                {appMeta.icon}
                                            </Avatar>
                                            {idx < document.approvers.length - 1 && (
                                                <Box sx={{ width: 2, bgcolor: 'var(--border-color)', flexGrow: 1, my: 1, minHeight: '30px' }} />
                                            )}
                                        </Box>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                {app.employee?.full_name}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                                {app.employee?.job_position || 'Chức vụ'} - {app.employee?.department || 'Đơn vị'}
                                            </Typography>
                                            <Box display="flex" alignItems="center" gap={1} sx={{ mt: 0.5 }}>
                                                <Chip label={appMeta.label} size="small" color={appMeta.color} variant="outlined" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 600 }} />
                                                {app.ngay_ky && (
                                                    <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                                        {formatDate(app.ngay_ky)}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {app.signature_data && (
                                                <Box sx={{ mt: 1 }}>
                                                    <Box 
                                                        component="img" 
                                                        src={app.signature_data} 
                                                        alt="Chữ ký" 
                                                        sx={{ 
                                                            maxHeight: 60, 
                                                            border: '1px solid var(--border-color)', 
                                                            borderRadius: '6px',
                                                            bgcolor: '#fff',
                                                            p: 0.5 
                                                        }} 
                                                    />
                                                </Box>
                                            )}
                                            {app.y_kien && (
                                                <Paper variant="outlined" sx={{ p: 1, mt: 1, bgcolor: 'var(--bg-default)', borderRadius: '6px' }}>
                                                    <Typography sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
                                                        Ý kiến: {app.y_kien}
                                                    </Typography>
                                                </Paper>
                                            )}
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Card>

                    {/* Action Workflow Logs Table */}
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            Nhật ký luân chuyển
                        </Typography>
                        <List disablePadding>
                            {document.workflows?.map((wf: any, idx: number) => (
                                <ListItem key={wf.id} disablePadding sx={{ mb: 2, display: 'block' }}>
                                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>
                                            {wf.employee?.full_name || 'Hệ thống'}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                                            {formatDate(wf.action_time)}
                                        </Typography>
                                    </Box>
                                    <Typography sx={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 600, mt: 0.25 }}>
                                        {ACTION_MAP[wf.action] || wf.action}
                                    </Typography>
                                    {wf.comment && (
                                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.5, pl: 1, borderLeft: '2px solid var(--border-color)' }}>
                                            {wf.comment}
                                        </Typography>
                                    )}
                                    {idx < document.workflows.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                                </ListItem>
                            ))}
                        </List>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
};

export default DetailTrinhKy;
