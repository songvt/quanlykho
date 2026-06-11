import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
    Box, Paper, Typography, TextField, Grid, Card, Button, Divider, 
    Dialog, DialogTitle, DialogContent, DialogActions, Alert, LinearProgress, MenuItem,
    IconButton
} from '@mui/material';
import { Check, X, Edit3, ArrowRight, ChevronLeft, Download, FileText, Bot, Upload } from 'lucide-react';
import type { RootState, AppDispatch } from '../../store';
import { fetchEmployees } from '../../store/slices/employeesSlice';

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

const ApproveTrinhKy: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);

    const [document, setDocument] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Processing States
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Forward dialog states
    const [openForwardDialog, setOpenForwardDialog] = useState(false);
    const [forwardUserId, setForwardUserId] = useState('');

    // Signature Canvas & File states
    const [openSignPad, setOpenSignPad] = useState(false);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [actionPending, setActionPending] = useState<'ky_duyet' | 'ky_nhay' | null>(null);
    const [signMethod, setSignMethod] = useState<'saved' | 'draw' | 'upload'>('draw');
    const [uploadedSignImage, setUploadedSignImage] = useState<string | null>(null);

    useEffect(() => {
        if (!openSignPad) {
            setUploadedSignImage(null);
            setSignMethod(profile?.signature_data ? 'saved' : 'draw');
        }
    }, [openSignPad, profile]);

    const startDrawing = (e: any) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.strokeStyle = '#003366';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.nativeEvent) {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        }
        
        const rect = canvas.getBoundingClientRect();
        ctx.beginPath();
        ctx.moveTo(clientX - rect.left, clientY - rect.top);
        setIsDrawing(true);
    };

    const draw = (e: any) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        let clientX = e.clientX;
        let clientY = e.clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else if (e.nativeEvent) {
            clientX = e.nativeEvent.clientX;
            clientY = e.nativeEvent.clientY;
        }
        
        const rect = canvas.getBoundingClientRect();
        ctx.lineTo(clientX - rect.left, clientY - rect.top);
        ctx.stroke();
        
        if (e.cancelable) {
            e.preventDefault();
        }
    };

    const stopDrawing = () => {
        setIsDrawing(false);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const confirmSigning = async (signatureDataUrl: string) => {
        if (!actionPending) return;
        setIsSubmitting(true);
        setErrorMsg(null);
        setOpenSignPad(false);

        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'workflow_action',
                    payload: {
                        hoso_id: id,
                        user_id: profile?.id,
                        action_type: actionPending,
                        comment,
                        signature_data: signatureDataUrl
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Hành động thất bại');

            alert('Đã ký duyệt hồ sơ trình ký thành công.');
            navigate('/trinh-ky/pending');
        } catch (err: any) {
            setErrorMsg(err.message);
            setIsSubmitting(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            setUploadedSignImage(reader.result as string);
        };
    };

    const handleConfirmSignature = () => {
        if (signMethod === 'saved') {
            if (!profile?.signature_data) {
                alert('Không tìm thấy chữ ký mặc định.');
                return;
            }
            confirmSigning(profile.signature_data);
        } else if (signMethod === 'upload') {
            if (!uploadedSignImage) {
                alert('Vui lòng tải lên hình ảnh chữ ký của bạn.');
                return;
            }
            confirmSigning(uploadedSignImage);
        } else {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const signatureDataUrl = canvas.toDataURL('image/png');
            confirmSigning(signatureDataUrl);
        }
    };

    const fetchDetail = async () => {
        if (!id) return;
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const res = await fetch(`/api/trinhky?id=${id}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to fetch');
            setDocument(data);
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi tải thông tin hồ sơ trình ký');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
        if (employeeStatus === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [id, employeeStatus, dispatch]);

    const handleAction = async (actionType: string) => {
        if (actionType === 'tu_choi' && !comment.trim()) {
            setErrorMsg('Vui lòng nhập lý do từ chối vào ô Ý kiến xử lý.');
            return;
        }

        if (actionType === 'yeu_cau_chinh_sua' && !comment.trim()) {
            setErrorMsg('Vui lòng nhập chi tiết yêu cầu chỉnh sửa vào ô Ý kiến xử lý.');
            return;
        }

        if (actionType === 'ky_duyet' || actionType === 'ky_nhay') {
            setActionPending(actionType as 'ky_duyet' | 'ky_nhay');
            setOpenSignPad(true);
            return;
        }

        if (!window.confirm('Xác nhận thực hiện hành động này?')) return;

        setIsSubmitting(true);
        setErrorMsg(null);

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
                        comment
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Hành động thất bại');

            alert('Đã xử lý hồ sơ trình ký thành công.');
            navigate('/trinh-ky/pending');
        } catch (err: any) {
            setErrorMsg(err.message);
            setIsSubmitting(false);
        }
    };

    // Forward Action
    const handleForward = async () => {
        if (!forwardUserId) {
            alert('Vui lòng chọn cán bộ nhận bàn giao.');
            return;
        }

        setIsSubmitting(true);
        setOpenForwardDialog(false);

        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'workflow_action',
                    payload: {
                        hoso_id: id,
                        user_id: profile?.id,
                        action_type: 'chuyen_nguoi_ky',
                        comment: comment || 'Chuyển cán bộ xử lý',
                        next_user_id: forwardUserId
                    }
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to forward');

            alert('Chuyển tiếp người ký thành công.');
            navigate('/trinh-ky/pending');
        } catch (err: any) {
            setErrorMsg(err.message);
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <LinearProgress sx={{ mt: 5 }} />;

    if (errorMsg && !document) {
        return (
            <Box p={3}>
                <Alert severity="error">{errorMsg}</Alert>
                <Button startIcon={<ChevronLeft size={16} />} onClick={() => navigate('/trinh-ky/pending')} sx={{ mt: 2 }}>
                    Quay lại
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            {/* Header Red Viettel VOffice style */}
            <Paper elevation={0} sx={{ p: 2.5, mb: 3, border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Button startIcon={<ChevronLeft size={16} />} onClick={() => navigate(-1)} sx={{ textTransform: 'none' }}>
                    Quay lại
                </Button>
                <Divider orientation="vertical" flexItem />
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                        KÝ DUYỆT HỒ SƠ: {document.so_hoso}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Ý kiến phê duyệt cán bộ nghiệp vụ
                    </Typography>
                </Box>
            </Paper>

            {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}

            <Grid container spacing={3}>
                {/* Document Body & content */}
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card sx={{ p: 3, mb: 3, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                            {document.tieu_de}
                        </Typography>
                        
                        <Grid container spacing={2} sx={{ mb: 3, p: 2, bgcolor: 'var(--bg-default)', borderRadius: '12px' }}>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Người trình</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.creator?.full_name}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Loại văn bản</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.loai_hoso}</Typography>
                            </Grid>
                            <Grid size={{ xs: 6, sm: 4 }}>
                                <Typography variant="caption" color="textSecondary">Độ khẩn / mật</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>{document.do_khan} / {document.do_mat}</Typography>
                            </Grid>
                        </Grid>

                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Nội dung văn bản</Typography>
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
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" gap={1} sx={{ overflow: 'hidden' }}>
                                            <FileText size={18} color="var(--brand-primary)" />
                                            <Typography variant="body2" sx={{ fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                {file.file_name}
                                            </Typography>
                                        </Box>
                                        <IconButton component="a" href={file.public_url} target="_blank" color="primary" size="small">
                                            <Download size={16} />
                                        </IconButton>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </Card>
                </Grid>

                {/* Approvals actions pane */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Ý kiến xử lý hồ sơ
                        </Typography>

                        <TextField
                            fullWidth
                            multiline
                            rows={6}
                            label="Ý kiến phê duyệt"
                            placeholder="Nhập ý kiến xử lý trình ký (bắt buộc khi Từ chối hoặc Yêu cầu chỉnh sửa)..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />

                        <Box display="flex" flexDirection="column" gap={1.5}>
                            <Button
                                fullWidth
                                variant="contained"
                                color="success"
                                startIcon={<Check size={16} />}
                                onClick={() => handleAction('ky_duyet')}
                                disabled={isSubmitting}
                                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Ký duyệt
                            </Button>
                            
                            <Button
                                fullWidth
                                variant="outlined"
                                color="primary"
                                startIcon={<Edit3 size={16} />}
                                onClick={() => handleAction('ky_nhay')}
                                disabled={isSubmitting}
                                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Ký nháy
                            </Button>

                            <Button
                                fullWidth
                                variant="outlined"
                                color="error"
                                startIcon={<X size={16} />}
                                onClick={() => handleAction('tu_choi')}
                                disabled={isSubmitting}
                                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Từ chối
                            </Button>

                            <Button
                                fullWidth
                                variant="outlined"
                                color="warning"
                                startIcon={<X size={16} />}
                                onClick={() => handleAction('yeu_cau_chinh_sua')}
                                disabled={isSubmitting}
                                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Yêu cầu chỉnh sửa
                            </Button>

                            <Button
                                fullWidth
                                variant="text"
                                color="secondary"
                                startIcon={<ArrowRight size={16} />}
                                onClick={() => setOpenForwardDialog(true)}
                                disabled={isSubmitting}
                                sx={{ py: 1.25, borderRadius: '10px', textTransform: 'none', fontWeight: 700 }}
                            >
                                Chuyển người ký
                            </Button>
                        </Box>
                    </Card>
                </Grid>
            </Grid>

            {/* Forward Selection dialog */}
            <Dialog 
                open={openForwardDialog} 
                onClose={() => setOpenForwardDialog(false)}
                PaperProps={{ sx: { borderRadius: '16px' } }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 800 }}>Chuyển tiếp người ký duyệt</DialogTitle>
                <DialogContent sx={{ p: 3 }}>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        Chọn cán bộ nghiệp vụ nhận bàn giao quyền ký duyệt hồ sơ này.
                    </Typography>
                    <TextField
                        select
                        fullWidth
                        label="Cán bộ bàn giao"
                        value={forwardUserId}
                        onChange={(e) => setForwardUserId(e.target.value)}
                        size="medium"
                    >
                        {employees.filter(e => e.id !== profile?.id).map((emp) => (
                            <MenuItem key={emp.id} value={emp.id}>
                                {emp.full_name} ({emp.job_position || 'Nhân viên'})
                            </MenuItem>
                        ))}
                    </TextField>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setOpenForwardDialog(false)} sx={{ textTransform: 'none' }}>Hủy bỏ</Button>
                    <Button onClick={handleForward} variant="contained" color="error" sx={{ textTransform: 'none', borderRadius: '8px' }}>
                        Xác nhận chuyển
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Signature Drawing Pad Dialog */}
            <Dialog 
                open={openSignPad} 
                onClose={() => setOpenSignPad(false)}
                PaperProps={{ sx: { borderRadius: '16px' } }}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid var(--border-color)' }}>
                    Ký duyệt văn bản điện tử
                </DialogTitle>
                <DialogContent sx={{ p: 3, pt: 2 }}>
                    <Box display="flex" flexWrap="wrap" gap={1} sx={{ mb: 2, borderBottom: '1px solid var(--border-color)', pb: 1.5 }}>
                        {profile?.signature_data && (
                            <Button 
                                variant={signMethod === 'saved' ? 'contained' : 'outlined'} 
                                size="small" 
                                onClick={() => setSignMethod('saved')}
                                sx={{ textTransform: 'none', borderRadius: '20px' }}
                            >
                                Chữ ký đã lưu
                            </Button>
                        )}
                        <Button 
                            variant={signMethod === 'draw' ? 'contained' : 'outlined'} 
                            size="small" 
                            onClick={() => setSignMethod('draw')}
                            sx={{ textTransform: 'none', borderRadius: '20px' }}
                        >
                            Vẽ chữ ký
                        </Button>
                        <Button 
                            variant={signMethod === 'upload' ? 'contained' : 'outlined'} 
                            size="small" 
                            onClick={() => setSignMethod('upload')}
                            sx={{ textTransform: 'none', borderRadius: '20px' }}
                        >
                            Tải ảnh chữ ký
                        </Button>
                    </Box>

                    {signMethod === 'saved' ? (
                        <Box sx={{ textAlign: 'center', py: 1.5 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Sử dụng chữ ký mặc định đã cấu hình trong hồ sơ của bạn:
                            </Typography>
                            <Paper 
                                variant="outlined" 
                                sx={{ 
                                    p: 1.5, 
                                    maxWidth: '100%', 
                                    maxHeight: 160, 
                                    overflow: 'hidden', 
                                    display: 'flex', 
                                    justifyContent: 'center', 
                                    alignItems: 'center', 
                                    bgcolor: '#fff', 
                                    borderRadius: '8px' 
                                }}
                            >
                                <img 
                                    src={profile?.signature_data || undefined} 
                                    alt="Chữ ký mặc định" 
                                    style={{ maxWidth: '100%', maxHeight: 130, objectFit: 'contain' }} 
                                />
                            </Paper>
                        </Box>
                    ) : signMethod === 'draw' ? (
                        <>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Vui lòng dùng chuột hoặc màn hình cảm ứng để vẽ chữ ký của bạn:
                            </Typography>
                            <Paper 
                                variant="outlined" 
                                sx={{ 
                                    border: '2px dashed var(--border-color)', 
                                    borderRadius: '8px', 
                                    overflow: 'hidden', 
                                    bgcolor: '#fff',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    mb: 2
                                }}
                            >
                                <canvas
                                    ref={canvasRef}
                                    width={320}
                                    height={180}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    style={{ cursor: 'crosshair', display: 'block' }}
                                />
                            </Paper>
                        </>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 1 }}>
                            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                                Tải lên tệp hình ảnh chữ ký tay đã chụp/scan (PNG, JPG):
                            </Typography>
                            
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<Upload size={16} />}
                                sx={{ mb: 2, textTransform: 'none', borderRadius: '8px' }}
                            >
                                Chọn ảnh chữ ký
                                <input type="file" accept="image/*" hidden onChange={handleImageUpload} />
                            </Button>

                            {uploadedSignImage && (
                                <Paper 
                                    variant="outlined" 
                                    sx={{ 
                                        p: 1, 
                                        maxWidth: '100%', 
                                        maxHeight: 160, 
                                        overflow: 'hidden', 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center', 
                                        bgcolor: '#fff', 
                                        borderRadius: '8px' 
                                    }}
                                >
                                    <img 
                                        src={uploadedSignImage} 
                                        alt="Chữ ký đã tải lên" 
                                        style={{ maxWidth: '100%', maxHeight: 140, objectFit: 'contain' }} 
                                    />
                                </Paper>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid var(--border-color)', justifyContent: 'space-between' }}>
                    {signMethod === 'draw' ? (
                        <Button onClick={clearCanvas} color="secondary" sx={{ textTransform: 'none' }}>
                            Xóa vẽ lại
                        </Button>
                    ) : signMethod === 'upload' ? (
                        <Button onClick={() => setUploadedSignImage(null)} color="secondary" sx={{ textTransform: 'none' }} disabled={!uploadedSignImage}>
                            Xóa ảnh
                        </Button>
                    ) : (
                        <Box />
                    )}
                    <Box display="flex" gap={1}>
                        <Button onClick={() => setOpenSignPad(false)} sx={{ textTransform: 'none' }}>Hủy</Button>
                        <Button onClick={handleConfirmSignature} variant="contained" color="error" sx={{ textTransform: 'none', borderRadius: '8px' }}>
                            Xác nhận ký
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ApproveTrinhKy;
