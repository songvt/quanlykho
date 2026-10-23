import { useEffect, useMemo, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import {
    Alert, Box, Button, Card, CardContent, CircularProgress, Divider,
    MenuItem, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Camera, Image as ImageIcon, Search } from 'lucide-react';
import type { RootState } from '../store';

type ImageType = 'before' | 'after' | 'appointment';
type ControlRow = {
    rowNumber: number; key: string; account: string; customer: string; completedAt: string;
    requestType: string; service: string; address: string; installer: string; appointmentTick: string; check: string;
    images: Record<ImageType, string>; links: Record<ImageType, string>;
};
type StagedImages = Partial<Record<ImageType, File>>;

const typeLabels: Record<ImageType, string> = {
    before: 'Ảnh trước', after: 'Ảnh sau', appointment: 'Biên bản hẹn',
};

const isAppointmentRequired = (value: string) => {
    const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    return normalized.includes('tich hen') && normalized.includes('ok');
};

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
});

async function optimizeImageForUpload(file: File) {
    if (file.size <= 1.5 * 1024 * 1024) return file;
    try {
        const url = URL.createObjectURL(file);
        const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const element = new Image();
            element.onload = () => resolve(element);
            element.onerror = reject;
            element.src = url;
        });
        const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72));
        return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' }) : file;
    } catch { return file; }
}

const isRowPending = (row: ControlRow) => !row.images.before.trim()
    || !row.images.after.trim()
    || (isAppointmentRequired(row.appointmentTick) && !row.images.appointment.trim());

export default function ImageControl() {
    const { profile } = useSelector((state: RootState) => state.auth);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const fileInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [installerFilter, setInstallerFilter] = useState('');
    const [uploadStatus, setUploadStatus] = useState<'all' | 'uploaded' | 'pending'>('all');
    const [installers, setInstallers] = useState<string[]>([]);
    const [summary, setSummary] = useState<{ total: number; uploaded: number; pending: number } | null>(null);
    const [rows, setRows] = useState<ControlRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const [pickerTarget, setPickerTarget] = useState<{ rowNumber: number; imageType: ImageType } | null>(null);
    const [drafts, setDrafts] = useState<Record<number, StagedImages>>({});
    const [message, setMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null);
    const isAdmin = profile?.role === 'admin';
    const pages = useMemo(() => Math.max(1, Math.ceil(total / 30)), [total]);

    const search = async (requestedPage = 1, selectedInstaller = installerFilter, selectedStatus = uploadStatus) => {
        const term = query.trim();
        setLoading(true); setMessage(null);
        try {
            const installerName = profile?.full_name?.trim();
            if (!installerName) throw new Error('Tài khoản chưa có thông tin họ tên để đối chiếu Nhân viên NT.');
            const response = await fetch(`/api/image-control?q=${encodeURIComponent(term)}&installerName=${encodeURIComponent(installerName)}&installerFilter=${encodeURIComponent(selectedInstaller)}&uploadStatus=${selectedStatus}&admin=${isAdmin}&page=${requestedPage}&pageSize=30`);
            const raw = await response.text();
            let data: any = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Máy chủ trả phản hồi không hợp lệ (HTTP ${response.status}).`); }
            if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu.');
            setRows(data.rows); setTotal(data.total); setPage(requestedPage);
            if (isAdmin && Array.isArray(data.installers)) setInstallers(data.installers);
            if (isAdmin) setSummary(data.summary || null);
        } catch (error: any) { setMessage({ severity: 'error', text: error.message || 'Không thể tải dữ liệu.' }); }
        finally { setLoading(false); }
    };

    useEffect(() => {
        if (profile?.full_name?.trim()) search(1);
        // Chỉ tải lại khi nhân viên đăng nhập thay đổi; search được gọi thủ công khi đổi từ khóa.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.full_name, isAdmin]);

    const chooseFile = (row: ControlRow, type: ImageType, source: 'file' | 'camera') => {
        setPickerTarget({ rowNumber: row.rowNumber, imageType: type }); setMessage(null);
        (source === 'camera' ? cameraInput : fileInput).current?.click();
    };

    const stageFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !pickerTarget) return;
        if (!file.type.startsWith('image/')) { setMessage({ severity: 'error', text: 'Chỉ có thể tải tệp hình ảnh.' }); return; }
        if (file.size > 10 * 1024 * 1024) { setMessage({ severity: 'error', text: 'Dung lượng ảnh không được vượt quá 10 MB.' }); return; }
        setUploading(pickerTarget.rowNumber); setMessage({ severity: 'info', text: 'Đang tối ưu ảnh để chuẩn bị lưu…' });
        const target = pickerTarget;
        const controller = new AbortController();
        const uploadTimeout = window.setTimeout(() => controller.abort(), 30_000);
        try {
            const optimizedFile = await optimizeImageForUpload(file);
            if (optimizedFile.size > 2.5 * 1024 * 1024) {
                throw new Error('Ảnh vẫn quá lớn sau tối ưu. Vui lòng chụp lại ở độ phân giải thấp hơn hoặc chọn ảnh dưới 2.5 MB.');
            }
            setDrafts((current) => ({ ...current, [target.rowNumber]: { ...current[target.rowNumber], [target.imageType]: optimizedFile } }));
            setMessage({ severity: 'success', text: `Đã chọn ${typeLabels[target.imageType]}. Chọn đủ ảnh rồi bấm “Lưu tất cả ảnh”.` });
        } catch (error: any) { setMessage({ severity: 'error', text: error.name === 'AbortError' ? 'Tối ưu ảnh quá thời gian chờ. Vui lòng thử ảnh khác.' : (error.message || 'Không thể chuẩn bị ảnh.') }); }
        finally { window.clearTimeout(uploadTimeout); setUploading(null); setPickerTarget(null); }
    };

    const saveRow = async (row: ControlRow) => {
        const staged = drafts[row.rowNumber] || {};
        const files = (Object.entries(staged) as [ImageType, File][]);
        if (!files.length) return;
        const missing = (['before', 'after'] as ImageType[]).filter((type) => !row.images[type].trim() && !staged[type]);
        if (isAppointmentRequired(row.appointmentTick) && !row.images.appointment.trim() && !staged.appointment) missing.push('appointment');
        if (missing.length) { setMessage({ severity: 'error', text: `Cần chọn đủ: ${missing.map((type) => typeLabels[type]).join(', ')}.` }); return; }
        setUploading(row.rowNumber); setMessage({ severity: 'info', text: 'Đang kiểm tra và lưu toàn bộ ảnh…' });
        const controller = new AbortController();
        const uploadTimeout = window.setTimeout(() => controller.abort(), 120_000);
        try {
            const response = await fetch('/api/image-control', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rowNumber: row.rowNumber, installerName: profile?.full_name, files: await Promise.all(files.map(async ([imageType, selectedFile]) => ({ imageType, fileName: selectedFile.name, mimeType: selectedFile.type, fileData: await toBase64(selectedFile) }))) }),
                signal: controller.signal,
            });
            const raw = await response.text();
            let data: any = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch { throw new Error(`Máy chủ trả phản hồi không hợp lệ (HTTP ${response.status}).`); }
            if (!raw) throw new Error(`Máy chủ không trả phản hồi (HTTP ${response.status}). Vui lòng thử lại.`);
            if (!response.ok) throw new Error(data.error || 'Không thể tải ảnh lên.');
            setMessage({ severity: 'success', text: `Đã lưu ${data.files?.length || files.length} ảnh vào Drive và cập nhật Sheet một lần.` });
            let rowWasRemoved = false;
            setRows((currentRows) => currentRows.map((currentRow) => currentRow.rowNumber === row.rowNumber
                ? { ...currentRow, images: { ...currentRow.images, ...Object.fromEntries((data.files || []).map((item: any) => [item.imageType, item.storageName])) }, links: { ...currentRow.links, ...Object.fromEntries((data.files || []).map((item: any) => [item.imageType, item.link || ''])) } }
                : currentRow).filter((currentRow) => {
                    const keep = isRowPending(currentRow);
                    if (currentRow.rowNumber === row.rowNumber && !keep) rowWasRemoved = true;
                    return keep;
                }));
            if (rowWasRemoved) setTotal((current) => Math.max(0, current - 1));
        } catch (error: any) { setMessage({ severity: 'error', text: error.name === 'AbortError' ? 'Tải ảnh quá 90 giây. Vui lòng kiểm tra lại kết nối Drive và thử lại.' : (error.message || 'Không thể tải ảnh lên.') }); }
        finally { window.clearTimeout(uploadTimeout); setUploading(null); if (!controller.signal.aborted) setDrafts((current) => { const next = { ...current }; delete next[row.rowNumber]; return next; }); }
    };

    return <Box sx={{ maxWidth: 1280, mx: 'auto', p: { xs: 2, md: 3 } }}>
        <Stack spacing={1} mb={3}>
            <Typography variant="h4" fontWeight={800}>Kiểm soát hình ảnh</Typography>
            <Typography color="text.secondary">{isAdmin ? 'Xem biên bản của toàn bộ nhân viên, bao gồm đã tải và chưa tải.' : 'Ảnh trước và Ảnh sau luôn bắt buộc. BB HẸN chỉ bắt buộc khi TICK HẸN là “Tích hẹnn: OK”.'}</Typography>
        </Stack>
        <Card sx={{ mb: 2 }}><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <TextField fullWidth label="Lọc thêm theo mã, Account hoặc khách hàng" value={query}
                    onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search(1)} />
                {isAdmin && <TextField select fullWidth label="Nhân viên NT" value={installerFilter} onChange={(e) => { setInstallerFilter(e.target.value); search(1, e.target.value); }} sx={{ minWidth: 230 }}>
                    <MenuItem value="">Tất cả nhân viên</MenuItem>
                    {installers.map((installer) => <MenuItem key={installer} value={installer}>{installer}</MenuItem>)}
                </TextField>}
                {isAdmin && <TextField select fullWidth label="Trạng thái upload" value={uploadStatus} onChange={(e) => { const status = e.target.value as 'all' | 'uploaded' | 'pending'; setUploadStatus(status); search(1, installerFilter, status); }} sx={{ minWidth: 190 }}>
                    <MenuItem value="all">Tất cả</MenuItem><MenuItem value="uploaded">Đã up</MenuItem><MenuItem value="pending">Chưa up</MenuItem>
                </TextField>}
                <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search size={18} />} onClick={() => search(1)} disabled={loading} sx={{ minWidth: 130, height: 56 }}>Tìm kiếm</Button>
            </Stack>
        </CardContent></Card>
        {isAdmin && summary && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight={700}>Tổng biên bản: {summary.total.toLocaleString('vi-VN')}</Typography>
            <Typography variant="body2" color="success.main">Đã up: {summary.uploaded.toLocaleString('vi-VN')}</Typography>
            <Typography variant="body2" color="warning.main">Chưa up: {summary.pending.toLocaleString('vi-VN')}</Typography>
        </Stack>}
        {message && <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>{message.text}</Alert>}
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={stageFile} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={stageFile} />
        {rows.length > 0 && !isMobile && <TableContainer component={Card} variant="outlined"><Table size="small" sx={{ minWidth: 1250 }}><TableHead><TableRow>
            {['Loại yêu cầu', 'Dịch vụ', 'Tên khách hàng', 'Account', 'Địa chỉ lắp đặt', ...(isAdmin ? ['Nhân viên NT'] : []), 'Image trước', 'Image Sau', 'BB HẸN', ...(isAdmin ? [] : ['Lưu'])].map((heading) => <TableCell key={heading} sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{heading}</TableCell>)}
        </TableRow></TableHead><TableBody>{rows.map((row) => <TableRow key={row.rowNumber} hover>
            <TableCell>{row.requestType}</TableCell><TableCell>{row.service}</TableCell><TableCell>{row.customer}</TableCell><TableCell>{row.account}</TableCell><TableCell sx={{ minWidth: 260 }}>{row.address}</TableCell>{isAdmin && <TableCell>{row.installer || '—'}</TableCell>}
            {(Object.keys(typeLabels) as ImageType[]).map((type) => <TableCell key={type} sx={{ minWidth: 120 }}>{type === 'appointment' && !isAppointmentRequired(row.appointmentTick)
                ? null
                : row.links[type]
                ? <Button component="a" href={row.links[type]} target="_blank" rel="noreferrer" size="small">Xem ảnh</Button>
                : isAdmin ? <Typography color="text.secondary">—</Typography> : <Stack spacing={0.5}>{drafts[row.rowNumber]?.[type] && <Typography variant="caption" color="success.main" noWrap sx={{ maxWidth: 115 }}>Đã chọn</Typography>}<Stack direction="row" spacing={0.5}><Button size="small" variant="outlined" disabled={uploading === row.rowNumber} onClick={() => chooseFile(row, type, 'file')}>Chọn ảnh</Button><Button size="small" variant="outlined" disabled={uploading === row.rowNumber} onClick={() => chooseFile(row, type, 'camera')} startIcon={<Camera size={14} />}>Chụp ảnh</Button></Stack></Stack>}</TableCell>)}
            {!isAdmin && <TableCell><Button size="small" variant="contained" disabled={uploading === row.rowNumber || !Object.keys(drafts[row.rowNumber] || {}).length} onClick={() => saveRow(row)}>{uploading === row.rowNumber ? <CircularProgress size={15} color="inherit" /> : 'Lưu'}</Button></TableCell>}
        </TableRow>)}</TableBody></Table></TableContainer>}
        {rows.length > 0 && isMobile && <Stack spacing={1.5}>{rows.map((row) => <Card key={row.rowNumber} variant="outlined"><CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
            <Stack spacing={1.15}>
                <Box><Typography variant="caption" color="text.secondary">Loại yêu cầu · Dịch vụ</Typography><Typography fontWeight={700}>{row.requestType || '—'}</Typography><Typography variant="body2">{row.service || '—'}</Typography></Box>
                <Divider />
                <Box><Typography variant="caption" color="text.secondary">Khách hàng · Account</Typography><Typography fontWeight={600}>{row.customer || '—'}</Typography><Typography variant="body2" color="text.secondary">{row.account || '—'}</Typography></Box>{isAdmin && <Typography variant="body2"><b>Nhân viên NT:</b> {row.installer || '—'}</Typography>}
                <Box><Typography variant="caption" color="text.secondary">Địa chỉ lắp đặt</Typography><Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{row.address || '—'}</Typography></Box>
                <Stack spacing={0.75}>{(Object.keys(typeLabels) as ImageType[]).map((type) => <Stack key={type} direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ p: 0.75, borderRadius: 1, bgcolor: 'action.hover', display: type === 'appointment' && !isAppointmentRequired(row.appointmentTick) ? 'none' : 'flex' }}><Typography variant="body2" fontWeight={600}>{typeLabels[type]}</Typography>{type === 'appointment' && !isAppointmentRequired(row.appointmentTick)
                    ? null
                    : row.links[type]
                    ? <Button component="a" href={row.links[type]} target="_blank" rel="noreferrer" size="small">Xem ảnh</Button>
                    : isAdmin ? <Typography color="text.secondary">—</Typography> : <Stack direction="row" spacing={0.5} alignItems="center">{drafts[row.rowNumber]?.[type] && <Typography variant="caption" color="success.main">Đã chọn</Typography>}<Button size="small" disabled={uploading === row.rowNumber} onClick={() => chooseFile(row, type, 'file')}>Chọn ảnh</Button><Button size="small" disabled={uploading === row.rowNumber} onClick={() => chooseFile(row, type, 'camera')} startIcon={<Camera size={14} />}>Chụp ảnh</Button></Stack>}</Stack>)}</Stack>
                {!isAdmin && <Button fullWidth variant="contained" disabled={uploading === row.rowNumber || !Object.keys(drafts[row.rowNumber] || {}).length} onClick={() => saveRow(row)}>{uploading === row.rowNumber ? 'Đang lưu…' : 'Lưu tất cả ảnh đã chọn'}</Button>}
            </Stack>
        </CardContent></Card>)}</Stack>}
        {!loading && rows.length === 0 && <Card variant="outlined"><CardContent><Stack alignItems="center" spacing={1}><ImageIcon size={32} /><Typography color="text.secondary">{isAdmin ? 'Không có biên bản phù hợp.' : 'Bạn không còn công việc nào thiếu ảnh bắt buộc.'}</Typography></Stack></CardContent></Card>}
        {total > 0 && <><Divider sx={{ my: 2 }} /><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="body2" color="text.secondary">Tìm thấy {total.toLocaleString('vi-VN')} dòng</Typography><Pagination count={pages} page={page} onChange={(_, value) => search(value)} color="primary" /></Stack></>}
    </Box>;
}
