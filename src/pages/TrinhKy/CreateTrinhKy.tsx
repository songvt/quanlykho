import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { 
    Box, Paper, Typography, TextField, Grid, MenuItem, Button, 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    Checkbox, FormControlLabel, Radio, RadioGroup, Card, FormLabel,
    Alert, LinearProgress, Divider
} from '@mui/material';
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, FileText, ChevronRight, CornerDownRight, X } from 'lucide-react';
import type { RootState, AppDispatch } from '../../store';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import RichTextEditor from '../../components/Common/RichTextEditor';

const LOAI_HOSO_LIST = ['Tờ trình', 'Công văn', 'Quyết định', 'Hợp đồng', 'Báo cáo', 'Khác'];
const DO_MAT_LIST = ['Bình thường', 'Mật', 'Tối mật', 'Tuyệt mật'];
const DO_KHAN_LIST = ['Bình thường', 'Khẩn', 'Thượng khẩn', 'Hỏa tốc'];

const CreateTrinhKy: React.FC = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: employees, status: employeeStatus } = useSelector((state: RootState) => state.employees);

    // Form States
    const [tieuDe, setTieuDe] = useState('');
    const [loaiHoSo, setLoaiHoSo] = useState('Tờ trình');
    const [doMat, setDoMat] = useState('Bình thường');
    const [doKhan, setDoKhan] = useState('Bình thường');
    const [noiDung, setNoiDung] = useState('');
    const [hinhThucKy, setHinhThucKy] = useState<'tuan_tu' | 'song_song'>('tuan_tu');

    // Attachments & Signers
    const [attachments, setAttachments] = useState<{ file_name: string; file_path: string; file_size: number; file_type: 'chinh' | 'phu_luc' }[]>([]);
    const [selectedApprovers, setSelectedApprovers] = useState<any[]>([]);
    
    // UI states
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const [isSubmitLoading, setIsSubmitLoading] = useState(false);
    const [openSignerDialog, setOpenSignerDialog] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [signerSearch, setSignerSearch] = useState('');

    useEffect(() => {
        if (employeeStatus === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [employeeStatus, dispatch]);

    useEffect(() => {
        if (!openSignerDialog) {
            setSignerSearch('');
        }
    }, [openSignerDialog]);

    // Handle Attachment Upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fileType: 'chinh' | 'phu_luc') => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setErrorMsg(null);
        setIsUploadLoading(true);

        const validTypes = [
            'application/pdf', 
            'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/zip',
            'application/x-rar-compressed'
        ];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Check size (100MB)
            if (file.size > 100 * 1024 * 1024) {
                setErrorMsg(`Tệp ${file.name} vượt quá dung lượng cho phép 100MB.`);
                setIsUploadLoading(false);
                return;
            }

            // Convert to base64 to send to server
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(',')[1];
                
                try {
                    const res = await fetch('/api/trinhky', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'upload',
                            payload: {
                                fileName: file.name,
                                mimeType: file.type,
                                fileData: base64Data,
                                userId: profile?.id
                            }
                        })
                    });

                    const resData = await res.json();
                    if (!res.ok) throw new Error(resData.error || 'Upload failed');

                    setAttachments(prev => {
                        const newFile = {
                            file_name: resData.file_name,
                            file_path: resData.file_path,
                            file_size: resData.file_size,
                            file_type: fileType
                        };
                        // For main signing document, replace the existing one
                        if (fileType === 'chinh') {
                            return [...prev.filter(a => a.file_type !== 'chinh'), newFile];
                        }
                        return [...prev, newFile];
                    });
                } catch (err: any) {
                    setErrorMsg(`Lỗi tải tệp ${file.name}: ${err.message}`);
                } finally {
                    setIsUploadLoading(false);
                }
            };
        }
    };

    // Remove Attachment
    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // Signers Handling
    const addApprover = (emp: any) => {
        if (selectedApprovers.some(a => a.id === emp.id)) return;
        setSelectedApprovers(prev => [...prev, emp]);
    };

    const removeApprover = (id: string) => {
        setSelectedApprovers(prev => prev.filter(a => a.id !== id));
    };

    const moveApprover = (index: number, direction: 'up' | 'down') => {
        const newArr = [...selectedApprovers];
        if (direction === 'up' && index > 0) {
            const temp = newArr[index];
            newArr[index] = newArr[index - 1];
            newArr[index - 1] = temp;
        } else if (direction === 'down' && index < newArr.length - 1) {
            const temp = newArr[index];
            newArr[index] = newArr[index + 1];
            newArr[index + 1] = temp;
        }
        setSelectedApprovers(newArr);
    };

    // Form Submission
    const handleSubmit = async (sendImmediately: boolean) => {
        if (!tieuDe.trim()) {
            setErrorMsg('Vui lòng điền tiêu đề trình ký.');
            return;
        }

        if (selectedApprovers.length === 0) {
            setErrorMsg('Vui lòng chọn ít nhất một người ký duyệt.');
            return;
        }

        setIsSubmitLoading(true);
        setErrorMsg(null);

        try {
            const res = await fetch('/api/trinhky', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    payload: {
                        tieu_de: tieuDe,
                        noi_dung: noiDung,
                        loai_hoso: loaiHoSo,
                        do_mat: doMat,
                        do_khan: doKhan,
                        nguoi_tao: profile?.id,
                        don_vi: profile?.department || 'Văn phòng hành chính',
                        hinh_thuc_ky: hinhThucKy,
                        approvers: selectedApprovers.map(a => ({ user_id: a.id })),
                        attachments,
                        sendImmediately
                    }
                })
            });

            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || 'Gặp lỗi khi lưu hồ sơ');

            setSuccessMsg(sendImmediately ? 'Gửi trình ký thành công!' : 'Lưu nháp hồ sơ thành công!');
            setTimeout(() => {
                navigate('/trinh-ky/list');
            }, 1500);
        } catch (err: any) {
            setErrorMsg(err.message);
            setIsSubmitLoading(false);
        }
    };

    return (
        <Box sx={{ maxWidth: '1200px', mx: 'auto', p: { xs: 0, md: 2 } }}>
            {/* Header branding red-white */}
            <Paper elevation={0} sx={{ 
                p: 3, 
                mb: 3, 
                borderRadius: '16px', 
                background: 'linear-gradient(135deg, #EF4444 0%, #b91c1c 100%)',
                color: 'white',
                boxShadow: 'var(--shadow-soft)'
            }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.5px' }}>
                    TẠO HỒ SƠ TRÌNH KÝ MỚI
                </Typography>
                <Typography variant="subtitle2" sx={{ opacity: 0.9, mt: 0.5 }}>
                    Khởi tạo và luân chuyển tài liệu trình ký trực tuyến qua hệ thống VOffice
                </Typography>
            </Paper>

            {errorMsg && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{errorMsg}</Alert>}
            {successMsg && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMsg}</Alert>}

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, color: 'var(--text-primary)' }}>
                            Thông tin chung hồ sơ
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    fullWidth
                                    label="Tiêu đề trình ký"
                                    required
                                    value={tieuDe}
                                    onChange={(e) => setTieuDe(e.target.value)}
                                    placeholder="Ví dụ: Tờ trình đề xuất mua sắm trang thiết bị phòng IT"
                                    size="small"
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Loại hồ sơ"
                                    value={loaiHoSo}
                                    onChange={(e) => setLoaiHoSo(e.target.value)}
                                    size="small"
                                >
                                    {LOAI_HOSO_LIST.map((item) => (
                                        <MenuItem key={item} value={item}>{item}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Độ mật"
                                    value={doMat}
                                    onChange={(e) => setDoMat(e.target.value)}
                                    size="small"
                                >
                                    {LOAI_HOSO_LIST.map((item) => (
                                        <MenuItem key={item} value={item}>{item}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TextField
                                    select
                                    fullWidth
                                    label="Độ khẩn"
                                    value={doKhan}
                                    onChange={(e) => setDoKhan(e.target.value)}
                                    size="small"
                                >
                                    {DO_KHAN_LIST.map((item) => (
                                        <MenuItem key={item} value={item}>{item}</MenuItem>
                                    ))}
                                </TextField>
                            </Grid>
                        </Grid>

                        <Box sx={{ mt: 3 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-primary)' }}>
                                Nội dung trình ký
                            </Typography>
                            <RichTextEditor value={noiDung} onChange={setNoiDung} />
                        </Box>
                    </Card>

                    {/* File Trình Ký & Phụ Lục */}
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-primary)' }}>
                            1. File trình ký (Tài liệu chính) <span style={{ color: 'red' }}>*</span>
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1.5 }}>
                            Đây là văn bản chính sẽ hiển thị để ký duyệt điện tử trực tiếp. Chỉ cho phép 1 tệp tin (PDF, DOC, DOCX).
                        </Typography>

                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<Upload size={16} />}
                            disabled={isUploadLoading}
                            sx={{
                                borderStyle: 'dashed',
                                py: 2,
                                width: '100%',
                                borderRadius: '10px',
                                textTransform: 'none',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-secondary)',
                                '&:hover': {
                                    borderColor: 'var(--brand-primary)',
                                    bgcolor: 'rgba(37, 99, 235, 0.04)'
                                }
                            }}
                        >
                            {isUploadLoading ? 'Đang tải lên...' : 'Chọn hoặc kéo thả tệp văn bản chính'}
                            <input type="file" accept=".pdf,.doc,.docx" hidden onChange={(e) => handleFileUpload(e, 'chinh')} />
                        </Button>

                        {attachments.filter(a => a.file_type === 'chinh').map((file, idx) => (
                            <Paper 
                                key={idx} 
                                variant="outlined" 
                                sx={{ 
                                    p: 1.5, 
                                    mt: 1.5, 
                                    borderRadius: '8px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'space-between',
                                    borderColor: 'var(--brand-primary)',
                                    bgcolor: 'rgba(37, 99, 235, 0.02)'
                                }}
                            >
                                <Box display="flex" alignItems="center" gap={1}>
                                    <FileText size={18} color="var(--brand-primary)" />
                                    <Typography sx={{ fontSize: '0.85rem', fontWeight: 700 }}>{file.file_name}</Typography>
                                </Box>
                                <IconButton size="small" color="error" onClick={() => {
                                    const actualIndex = attachments.findIndex(a => a.file_path === file.file_path);
                                    removeAttachment(actualIndex);
                                }}>
                                    <Trash2 size={16} />
                                </IconButton>
                            </Paper>
                        ))}

                        <Divider sx={{ my: 3 }} />

                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-primary)' }}>
                            2. Tài liệu phụ lục đính kèm
                        </Typography>
                        <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1.5 }}>
                            Các tài liệu liên quan, bảng biểu minh họa phục vụ nghiên cứu thêm (Tối đa 100MB/tệp).
                        </Typography>
                        <Button
                            variant="outlined"
                            component="label"
                            startIcon={<Upload size={16} />}
                            disabled={isUploadLoading}
                            sx={{
                                borderStyle: 'dashed',
                                py: 2,
                                width: '100%',
                                borderRadius: '10px',
                                textTransform: 'none',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-secondary)',
                                '&:hover': {
                                    borderColor: 'var(--brand-primary)',
                                    bgcolor: 'rgba(37, 99, 235, 0.04)'
                                }
                            }}
                        >
                            {isUploadLoading ? 'Đang tải lên...' : 'Chọn các tệp đính kèm phụ lục'}
                            <input type="file" multiple hidden onChange={(e) => handleFileUpload(e, 'phu_luc')} />
                        </Button>

                        {attachments.filter(a => a.file_type === 'phu_luc').length > 0 && (
                            <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {attachments.filter(a => a.file_type === 'phu_luc').map((file, idx) => (
                                    <Paper 
                                        key={idx} 
                                        variant="outlined" 
                                        sx={{ 
                                            p: 1.25, 
                                            borderRadius: '8px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <FileText size={16} color="var(--text-secondary)" />
                                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{file.file_name}</Typography>
                                        </Box>
                                        <IconButton size="small" color="error" onClick={() => {
                                            const actualIndex = attachments.findIndex(a => a.file_path === file.file_path);
                                            removeAttachment(actualIndex);
                                        }}>
                                            <Trash2 size={14} />
                                        </IconButton>
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </Card>
                </Grid>

                {/* Workflow Signers Routing */}
                <Grid size={{ xs: 12, md: 4 }}>
                    <Card sx={{ p: 3, borderRadius: '16px', border: '1px solid var(--border-color)', mb: 3 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: 'var(--text-primary)' }}>
                            Luồng ký duyệt
                        </Typography>
                        
                        <RadioGroup
                            value={hinhThucKy}
                            onChange={(e) => setHinhThucKy(e.target.value as 'tuan_tu' | 'song_song')}
                            sx={{ mb: 2 }}
                        >
                            <FormControlLabel value="tuan_tu" control={<Radio size="small" />} label="Ký tuần tự (theo thứ tự)" />
                            <FormControlLabel value="song_song" control={<Radio size="small" />} label="Ký song song (tất cả cùng ký)" />
                        </RadioGroup>

                        <Divider sx={{ my: 2 }} />

                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>Thứ tự người duyệt ({selectedApprovers.length})</Typography>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<Plus size={16} />}
                                onClick={() => setOpenSignerDialog(true)}
                                sx={{ textTransform: 'none' }}
                            >
                                Thêm người
                            </Button>
                        </Box>

                        {selectedApprovers.length === 0 ? (
                            <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'var(--bg-default)', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
                                <Typography sx={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Chưa chọn người ký nào</Typography>
                            </Box>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {selectedApprovers.map((app, idx) => (
                                    <Paper 
                                        key={app.id} 
                                        variant="outlined" 
                                        sx={{ 
                                            p: 1.5, 
                                            borderRadius: '8px',
                                            bgcolor: 'var(--bg-default)',
                                            position: 'relative',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                borderColor: 'var(--brand-primary)'
                                            }
                                        }}
                                    >
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                {idx + 1}. {app.full_name}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {app.job_position || 'Nhân viên'} - {app.department || 'Phòng ban'}
                                            </Typography>
                                        </Box>
                                        <Box display="flex" alignItems="center">
                                            {hinhThucKy === 'tuan_tu' && (
                                                <>
                                                    <IconButton size="small" disabled={idx === 0} onClick={() => moveApprover(idx, 'up')}>
                                                        <ArrowUp size={14} />
                                                    </IconButton>
                                                    <IconButton size="small" disabled={idx === selectedApprovers.length - 1} onClick={() => moveApprover(idx, 'down')}>
                                                        <ArrowDown size={14} />
                                                    </IconButton>
                                                </>
                                            )}
                                            <IconButton size="small" color="error" onClick={() => removeApprover(app.id)}>
                                                <Trash2 size={14} />
                                            </IconButton>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        )}
                    </Card>

                    {/* Actions */}
                    <Card sx={{ p: 2.5, borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                        <Button
                            fullWidth
                            variant="contained"
                            disabled={isSubmitLoading}
                            onClick={() => handleSubmit(true)}
                            sx={{
                                py: 1.25,
                                borderRadius: '10px',
                                textTransform: 'none',
                                fontWeight: 700,
                                mb: 1.5,
                                background: 'linear-gradient(135deg, #EF4444 0%, #b91c1c 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)'
                                }
                            }}
                        >
                            Gửi trình ký
                        </Button>
                        
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 6 }}>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    disabled={isSubmitLoading}
                                    onClick={() => handleSubmit(false)}
                                    sx={{ py: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                                >
                                    Lưu nháp
                                </Button>
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                                <Button
                                    fullWidth
                                    variant="text"
                                    color="secondary"
                                    onClick={() => navigate('/trinh-ky/list')}
                                    sx={{ py: 1, borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                                >
                                    Hủy bỏ
                                </Button>
                            </Grid>
                        </Grid>
                    </Card>
                </Grid>
            </Grid>

            {/* Selector Dialog */}
            <Dialog 
                open={openSignerDialog} 
                onClose={() => setOpenSignerDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '16px' } }}
            >
                <DialogTitle sx={{ fontWeight: 800, borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Chọn cán bộ ký duyệt
                    <IconButton size="small" onClick={() => setOpenSignerDialog(false)}><X size={18} /></IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 2.5, maxHeight: '400px', overflowY: 'auto' }}>
                    <TextField
                        size="small"
                        fullWidth
                        placeholder="Tìm kiếm theo tên, chức vụ, email, phòng ban..."
                        value={signerSearch}
                        onChange={(e) => setSignerSearch(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {employees.filter(emp => {
                            const query = signerSearch.toLowerCase();
                            return (
                                emp.full_name?.toLowerCase().includes(query) ||
                                emp.email?.toLowerCase().includes(query) ||
                                emp.job_position?.toLowerCase().includes(query) ||
                                emp.department?.toLowerCase().includes(query)
                            );
                        }).map((emp) => {
                            const isSelected = selectedApprovers.some(a => a.id === emp.id);
                            return (
                                <Box 
                                    key={emp.id} 
                                    onClick={() => isSelected ? removeApprover(emp.id) : addApprover(emp)}
                                    sx={{ 
                                        p: 1.5, 
                                        borderRadius: '8px', 
                                        border: `1px solid ${isSelected ? 'var(--brand-primary)' : 'var(--border-color)'}`,
                                        bgcolor: isSelected ? 'rgba(37, 99, 235, 0.04)' : 'transparent',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        '&:hover': {
                                            borderColor: 'var(--brand-primary)',
                                            bgcolor: 'var(--bg-default)'
                                        }
                                    }}
                                >
                                    <Box>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{emp.full_name}</Typography>
                                        <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {emp.job_position || 'Nhân viên'} - {emp.department || 'Phòng ban'} ({emp.email})
                                        </Typography>
                                    </Box>
                                    <Checkbox checked={isSelected} size="small" />
                                </Box>
                            );
                        })}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: '1px solid var(--border-color)' }}>
                    <Button onClick={() => setOpenSignerDialog(false)} variant="contained" sx={{ px: 3, textTransform: 'none', borderRadius: '8px' }}>
                        Xác nhận
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CreateTrinhKy;
