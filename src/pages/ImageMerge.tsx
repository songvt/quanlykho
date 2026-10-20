import { useEffect, useRef, useState } from 'react';
import {
    Alert, Box, Button, ButtonGroup, Card, CardContent, CircularProgress,
    Container, IconButton, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DownloadIcon from '@mui/icons-material/Download';
import GridViewIcon from '@mui/icons-material/GridView';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';

type LayoutMode = 'vertical' | 'horizontal' | 'grid' | 'invoice-receipt';
type ImageItem = { id: string; file: File; url: string; image: HTMLImageElement };
const MAX_FILES = 24;
const GAP = 18;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Không đọc được ảnh ${file.name}.`)); };
    image.src = url;
});

export default function ImageMerge() {
    const inputRef = useRef<HTMLInputElement>(null);
    const itemsRef = useRef<ImageItem[]>([]);
    const [items, setItems] = useState<ImageItem[]>([]);
    const [layout, setLayout] = useState<LayoutMode>('horizontal');
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => { itemsRef.current = items; }, [items]);
    useEffect(() => () => itemsRef.current.forEach(item => URL.revokeObjectURL(item.url)), []);

    const addFiles = async (files?: FileList | null) => {
        if (!files) return;
        setError('');
        const selected = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (!selected.length) { setError('Vui lòng chọn tệp hình ảnh hợp lệ.'); return; }
        const remaining = MAX_FILES - items.length;
        if (remaining <= 0) { setError(`Chỉ có thể gộp tối đa ${MAX_FILES} ảnh trong một lần.`); return; }
        try {
            const additions = await Promise.all(selected.slice(0, remaining).map(async file => ({
                id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
                file,
                url: URL.createObjectURL(file),
                image: await loadImage(file),
            })));
            setItems(current => [...current, ...additions]);
            if (selected.length > remaining) setError(`Đã thêm ${remaining} ảnh đầu tiên. Giới hạn là ${MAX_FILES} ảnh.`);
        } catch (err: any) { setError(err.message || 'Không thể đọc một hoặc nhiều ảnh.'); }
    };

    const moveItem = (index: number, offset: number) => setItems(current => {
        const destination = index + offset;
        if (destination < 0 || destination >= current.length) return current;
        const next = [...current];
        [next[index], next[destination]] = [next[destination], next[index]];
        return next;
    });

    const removeItem = (id: string) => setItems(current => {
        const found = current.find(item => item.id === id);
        if (found) URL.revokeObjectURL(found.url);
        return current.filter(item => item.id !== id);
    });

    const exportJpg = async () => {
        if (items.length < 2) { setError('Chọn ít nhất 2 ảnh để gộp.'); return; }
        if (layout === 'invoice-receipt' && items.length !== 3) { setError('Bố cục “hóa đơn + biên nhận” cần đúng 3 ảnh: hai hóa đơn trước, biên nhận ở ảnh thứ ba.'); return; }
        setExporting(true); setError('');
        try {
            const widths = items.map(item => item.image.naturalWidth);
            const heights = items.map(item => item.image.naturalHeight);
            const maxWidth = Math.max(...widths), maxHeight = Math.max(...heights);
            let canvasWidth = 0, canvasHeight = 0, positions: Array<{ x: number; y: number; w: number; h: number }> = [];
            if (layout === 'vertical') {
                // Normalize widths so that a mix of low/high-resolution images reads as one clean column.
                canvasWidth = clamp(median(widths), 900, 2600);
                const renderedHeights = items.map(item => Math.round(item.image.naturalHeight * canvasWidth / item.image.naturalWidth));
                canvasHeight = renderedHeights.reduce((sum, height) => sum + height, 0) + GAP * (items.length - 1);
                let y = 0;
                positions = items.map((_, index) => { const h = renderedHeights[index]; const position = { x: 0, y, w: canvasWidth, h }; y += h + (index < items.length - 1 ? GAP : 0); return position; });
            } else if (layout === 'horizontal') {
                // Normalize heights so every image forms one aligned horizontal strip without distortion.
                canvasHeight = clamp(median(heights), 900, 2200);
                const renderedWidths = items.map(item => Math.round(item.image.naturalWidth * canvasHeight / item.image.naturalHeight));
                canvasWidth = renderedWidths.reduce((sum, width) => sum + width, 0) + GAP * (items.length - 1);
                let x = 0;
                positions = items.map((_, index) => { const w = renderedWidths[index]; const position = { x, y: 0, w, h: canvasHeight }; x += w + (index < items.length - 1 ? GAP : 0); return position; });
            } else if (layout === 'grid') {
                const columns = Math.ceil(Math.sqrt(items.length));
                const rows = Math.ceil(items.length / columns);
                const cellHeight = clamp(median(heights), 700, 1600);
                const cellWidth = clamp(median(widths), 700, 1800);
                canvasWidth = columns * cellWidth + (columns - 1) * GAP;
                canvasHeight = rows * cellHeight + (rows - 1) * GAP;
                positions = items.map((item, index) => {
                    const factor = Math.min(cellWidth / item.image.naturalWidth, cellHeight / item.image.naturalHeight);
                    const w = Math.round(item.image.naturalWidth * factor), h = Math.round(item.image.naturalHeight * factor);
                    return { x: (index % columns) * (cellWidth + GAP) + Math.round((cellWidth - w) / 2), y: Math.floor(index / columns) * (cellHeight + GAP) + Math.round((cellHeight - h) / 2), w, h };
                });
            } else {
                // Layout demonstrated by the user: two invoices stacked on the left,
                // with one full-height bank receipt on the right.
                const leftWidth = Math.max(items[0].image.naturalWidth, items[1].image.naturalWidth);
                const firstHeight = Math.round(items[0].image.naturalHeight * leftWidth / items[0].image.naturalWidth);
                const secondHeight = Math.round(items[1].image.naturalHeight * leftWidth / items[1].image.naturalWidth);
                canvasHeight = firstHeight + GAP + secondHeight;
                const receiptWidth = Math.round(items[2].image.naturalWidth * canvasHeight / items[2].image.naturalHeight);
                canvasWidth = leftWidth + GAP + receiptWidth;
                positions = [
                    { x: 0, y: 0, w: leftWidth, h: firstHeight },
                    { x: 0, y: firstHeight + GAP, w: leftWidth, h: secondHeight },
                    { x: leftWidth + GAP, y: 0, w: receiptWidth, h: canvasHeight },
                ];
            }
            const maxEdge = 7000;
            const scale = Math.min(1, maxEdge / Math.max(canvasWidth, canvasHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(canvasWidth * scale));
            canvas.height = Math.max(1, Math.round(canvasHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Trình duyệt không hỗ trợ tạo ảnh xuất.');
            context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
            items.forEach((item, index) => { const p = positions[index]; context.drawImage(item.image, Math.round(p.x * scale), Math.round(p.y * scale), Math.round(p.w * scale), Math.round(p.h * scale)); });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.94));
            if (!blob) throw new Error('Không thể tạo ảnh JPG.');
            const dateParts = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(new Date());
            const part = (type: Intl.DateTimeFormatPartTypes) => dateParts.find(value => value.type === type)?.value || '';
            const fileName = `Hinh_anh_ngay_${part('day')}_thang_${part('month')}_nam_${part('year')}.jpg`;
            const url = URL.createObjectURL(blob); const link = document.createElement('a');
            link.href = url; link.download = fileName; link.click(); URL.revokeObjectURL(url);
        } catch (err: any) { setError(err.message || 'Không thể gộp ảnh.'); }
        finally { setExporting(false); }
    };

    return <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={3}>
            <Box><Typography variant="h5" fontWeight={800}>Gộp hình ảnh</Typography><Typography color="text.secondary">Sắp xếp nhiều ảnh và xuất thành một file JPG duy nhất. Tất cả xử lý diễn ra trên trình duyệt.</Typography></Box>
            <Paper sx={{ p: 3, textAlign: 'center', border: '2px dashed #60a5fa', bgcolor: 'rgba(37,99,235,.05)' }}>
                <AddPhotoAlternateIcon sx={{ fontSize: 54, color: '#2563eb', mb: 1 }} />
                <Typography fontWeight={700}>Chọn từ 2 đến {MAX_FILES} hình ảnh</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ my: 1.5 }}>Hỗ trợ JPG, PNG, WEBP và các định dạng ảnh trình duyệt đọc được.</Typography>
                <input ref={inputRef} hidden type="file" multiple accept="image/*" onChange={event => { addFiles(event.target.files); event.target.value = ''; }} />
                <Button variant="contained" startIcon={<AddPhotoAlternateIcon />} onClick={() => inputRef.current?.click()}>Chọn hình ảnh</Button>
            </Paper>
            {error && <Alert severity="error">{error}</Alert>}
            {items.length > 0 && <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ mb: 2.5 }}>
                    <Box><Typography fontWeight={800}>Danh sách ảnh ({items.length})</Typography><Typography variant="body2" color="text.secondary">Thứ tự danh sách là thứ tự ảnh trong file JPG.</Typography></Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Typography variant="body2" fontWeight={700}>Bố cục</Typography><ToggleButtonGroup exclusive size="small" value={layout} onChange={(_, value) => value && setLayout(value)} sx={{ '& .MuiToggleButton-root': { color: '#cbd5e1', borderColor: 'rgba(148,163,184,.38)', px: 1.1, textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: 'rgba(59,130,246,.16)', color: '#f8fafc' } }, '& .MuiToggleButton-root.Mui-selected': { bgcolor: '#2563eb', color: '#ffffff', borderColor: '#3b82f6', '&:hover': { bgcolor: '#1d4ed8', color: '#ffffff' } } }}><ToggleButton value="vertical" aria-label="Dọc" title="Xếp dọc"><ViewAgendaIcon fontSize="small" sx={{ mr: .5 }} />Dọc</ToggleButton><ToggleButton value="horizontal" aria-label="Ngang" title="Xếp ngang"><ViewColumnIcon fontSize="small" sx={{ mr: .5 }} />Ngang</ToggleButton><ToggleButton value="grid" aria-label="Lưới" title="Dạng lưới"><GridViewIcon fontSize="small" sx={{ mr: .5 }} />Lưới</ToggleButton><ToggleButton value="invoice-receipt" aria-label="Hóa đơn và biên nhận" title="2 hóa đơn trái, 1 biên nhận phải"><ViewQuiltIcon fontSize="small" sx={{ mr: .5 }} />Mẫu</ToggleButton></ToggleButtonGroup></Stack>
                </Stack>
                {layout === 'invoice-receipt' && <Alert severity="info" sx={{ mb: 2 }}>Mẫu hóa đơn + biên nhận: ảnh 1 và 2 xếp dọc bên trái, ảnh 3 nằm bên phải. Cần đúng 3 ảnh.</Alert>}
                <Stack spacing={1.25}>{items.map((item, index) => <Card key={item.id} variant="outlined"><CardContent sx={{ py: '8px !important', display: 'flex', alignItems: 'center', gap: 1.5 }}><Box component="img" src={item.url} alt={item.file.name} sx={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 1, bgcolor: '#e2e8f0' }} /><Box sx={{ flex: 1, minWidth: 0 }}><Typography fontWeight={700} noWrap>{index + 1}. {item.file.name}</Typography><Typography variant="caption" color="text.secondary">{item.image.naturalWidth} × {item.image.naturalHeight} px</Typography></Box><ButtonGroup size="small" variant="outlined"><IconButton size="small" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label="Đưa lên"><ArrowUpwardIcon fontSize="small" /></IconButton><IconButton size="small" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label="Đưa xuống"><ArrowDownwardIcon fontSize="small" /></IconButton><IconButton size="small" color="error" onClick={() => removeItem(item.id)} aria-label="Xóa"><DeleteOutlineIcon fontSize="small" /></IconButton></ButtonGroup></CardContent></Card>)}</Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" spacing={1.5} sx={{ mt: 3 }}><Button variant="outlined" color="error" onClick={() => setItems([])}>Xóa tất cả</Button><Button variant="contained" disabled={items.length < 2 || exporting} startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <DownloadIcon />} onClick={exportJpg}>{exporting ? 'Đang tạo JPG...' : 'Gộp & tải JPG'}</Button></Stack>
            </Paper>}
        </Stack>
    </Container>;
}
