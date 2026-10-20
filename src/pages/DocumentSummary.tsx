import { useRef, useState } from 'react';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import DownloadIcon from '@mui/icons-material/Download';

const MAX_SIZE = 25 * 1024 * 1024;
const supported = ['text/plain', 'text/markdown', 'text/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

type EditableBlock = { heading?: string; items?: string[]; kind?: 'text' | 'callout' | 'table' };
type EditableSlide = { title?: string; subtitle?: string; theme?: 'light' | 'dark'; blocks?: EditableBlock[] };

const textFromDocx = async (file: File) => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.file('word/document.xml')?.async('text');
    if (!xml) throw new Error('Không đọc được nội dung tệp Word.');
    return xml.replace(/<w:tab[^/]*\/>/g, '\t').replace(/<w:br[^/]*\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').trim();
};

const readBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không thể đọc tệp.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.readAsDataURL(file);
});

const extractPptxSlideImages = async (file: File) => {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const names = Object.keys(zip.files);
    const slideNumbers = names
        .map(name => name.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1])
        .filter(Boolean).map(Number).sort((a, b) => a - b);
    const mimeFor = (path: string) => path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'image/jpeg' : path.endsWith('.webp') ? 'image/webp' : 'image/png';
    const images: Array<{ data: string; mimeType: string }> = [];
    for (const number of slideNumbers) {
        const rels = await zip.file(`ppt/slides/_rels/slide${number}.xml.rels`)?.async('text');
        const target = rels?.match(/Target="\.\.\/media\/([^"]+)"/)?.[1];
        if (!target) throw new Error(`Slide ${number} không phải ảnh toàn trang hoặc không tìm thấy ảnh nguồn.`);
        const image = zip.file(`ppt/media/${target}`);
        if (!image) throw new Error(`Không tìm thấy ảnh của slide ${number}.`);
        images.push({ data: await image.async('base64'), mimeType: mimeFor(target) });
    }
    if (!images.length) throw new Error('Tệp PPTX không có slide ảnh để chuyển đổi.');
    return images;
};

const renderSummary = (text: string) => text.split('\n').map((line, index) => {
    const value = line.replace(/^[-*]\s*/, '');
    if (line.startsWith('## ')) return <Typography key={index} variant="h6" sx={{ mt: 2.5, mb: 1, fontWeight: 800, color: '#0f172a' }}>{line.slice(3)}</Typography>;
    if (/^[-*]\s/.test(line)) return <Typography key={index} component="li" sx={{ ml: 2.5, mb: .7, color: '#334155' }}>{value}</Typography>;
    return line.trim() ? <Typography key={index} sx={{ mb: 1, color: '#334155', lineHeight: 1.7 }}>{line}</Typography> : null;
});

const createPptx = async (analysis: string, sourceName: string) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'GGS - Phân tích tài liệu AI';
    pptx.subject = `Thuyết trình từ ${sourceName}`;
    pptx.title = sourceName.replace(/\.[^.]+$/, '');
    pptx.company = 'GGS';
    pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };

    const addFooter = (slide: any, index: number) => {
        slide.addText('GGS | Phân tích tài liệu AI', { x: .6, y: 7.1, w: 7, h: .2, fontSize: 9, color: '64748B' });
        slide.addText(String(index), { x: 12.25, y: 7.1, w: .45, h: .2, align: 'right', fontSize: 9, color: '64748B' });
    };
    const cover = pptx.addSlide();
    cover.background = { color: '0F172A' };
    cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .18, fill: { color: '2563EB' }, line: { color: '2563EB' } });
    cover.addText('BÀI THUYẾT TRÌNH', { x: .8, y: 1.05, w: 4, h: .3, fontSize: 15, bold: true, color: '60A5FA' });
    cover.addText(sourceName.replace(/\.[^.]+$/, ''), { x: .8, y: 1.55, w: 11.5, h: 1.55, fontSize: 30, bold: true, color: 'F8FAFC', breakLine: false, fit: 'shrink' as any });
    cover.addText('Nội dung được AI tổng hợp từ tài liệu nguồn', { x: .8, y: 3.45, w: 8, h: .4, fontSize: 17, color: 'CBD5E1' });
    cover.addText(new Date().toLocaleDateString('vi-VN'), { x: .8, y: 6.55, w: 3, h: .3, fontSize: 13, color: '94A3B8' });

    const sections = analysis.split(/(?=^###\s*Slide\s*\d+)/g).filter(part => /^###\s*Slide\s*\d+/m.test(part));
    const fallback = analysis.split(/(?=^##\s+)/gm).filter(Boolean).slice(0, 9);
    let pages = sections.length ? sections : fallback;

    // Older or incomplete AI replies can contain one long section with many
    // important bullets. Convert those bullets into individual content slides
    // rather than exporting one dense, generic slide.
    if (pages.length < 4) {
        const keyPoints = analysis.split('\n')
            .filter(line => /^[-*]\s+/.test(line))
            .map(line => line.replace(/^[-*]\s+/, '').replace(/\*+/g, '').trim())
            .filter(point => point.length > 24)
            .slice(0, 10);
        if (keyPoints.length >= 3) {
            pages = keyPoints.map((point, index) => {
                const heading = point.split(/[:.]/)[0].slice(0, 72) || `Nội dung trọng tâm ${index + 1}`;
                return `### Slide ${index + 1} — ${heading}\n- ${point}`;
            });
        }
    }
    pages.slice(0, 10).forEach((page, pageIndex) => {
        const title = (page.match(/^###?\s*(?:Slide\s*\d+\s*[—-]\s*)?(.+)$/m)?.[1] || `Nội dung ${pageIndex + 1}`).replace(/\*+/g, '').trim();
        const bullets = page.split('\n').filter(line => /^[-*]\s+/.test(line)).map(line => line.replace(/^[-*]\s+/, '').replace(/\*+/g, '').trim()).filter(Boolean).slice(0, 6);
        const body = bullets.length ? bullets : page.replace(/^###?\s+.*$/m, '').replace(/\*+/g, '').trim().split('\n').filter(Boolean).slice(0, 5);
        const isDark = pageIndex % 3 === 1;
        const background = isDark ? '0F172A' : 'F8FAFC';
        const titleColor = isDark ? 'F8FAFC' : '0F172A';
        const bodyColor = isDark ? 'DBEAFE' : '334155';
        const accent = pageIndex % 3 === 2 ? '0F766E' : '2563EB';
        const slide = pptx.addSlide();
        slide.background = { color: background };
        slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: .32, h: 7.5, fill: { color: accent }, line: { color: accent } });
        slide.addShape(pptx.ShapeType.rect, { x: .6, y: .65, w: .12, h: .65, fill: { color: accent }, line: { color: accent } });
        slide.addText(title, { x: .95, y: .6, w: 10.65, h: .7, fontSize: 26, bold: true, color: titleColor, fit: 'shrink' as any });
        slide.addShape(pptx.ShapeType.line, { x: .95, y: 1.5, w: 10.65, h: 0, line: { color: isDark ? '334155' : 'CBD5E1', width: 1 } });
        slide.addText(body.map(item => ({ text: item, options: { bullet: { indent: 16 }, hanging: 4 } })), { x: 1.0, y: 1.9, w: 9.75, h: 4.65, fontSize: 20, color: bodyColor, breakLine: false, valign: 'top', paraSpaceAfter: 18, fit: 'shrink' as any });
        slide.addShape(pptx.ShapeType.roundRect, { x: 11.9, y: 1.9, w: .65, h: .65, rectRadius: .08, fill: { color: isDark ? '1E3A8A' : 'DBEAFE' }, line: { color: isDark ? '1E3A8A' : 'DBEAFE' } });
        slide.addText(String(pageIndex + 1), { x: 11.9, y: 2.09, w: .65, h: .2, fontSize: 13, bold: true, color: isDark ? 'DBEAFE' : '1D4ED8', align: 'center' });
        addFooter(slide, pageIndex + 2);
    });
    await pptx.writeFile({ fileName: `${sourceName.replace(/\.[^.]+$/, '')}_thuyet-trinh.pptx` });
};

const createEditablePptx = async (slides: EditableSlide[], sourceName: string) => {
    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.author = 'GGS - Chuyển đổi PPTX chỉnh sửa được';
    pptx.subject = `Bản chỉnh sửa được từ ${sourceName}`;
    pptx.title = sourceName.replace(/\.[^.]+$/, '');
    pptx.company = 'GGS';
    pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos' };
    const palette = ['175B93', '0F766E', '7C3AED', 'B45309'];
    slides.forEach((source, index) => {
        const slide = pptx.addSlide();
        const dark = source.theme === 'dark' || index === 0;
        const bg = dark ? '102C4A' : 'F4FBFE';
        const foreground = dark ? 'F8FAFC' : '102C4A';
        const secondary = dark ? 'DBEAFE' : '334155';
        const accent = palette[index % palette.length];
        slide.background = { color: bg };
        for (let x = 0; x <= 13.33; x += .33) slide.addShape(pptx.ShapeType.line, { x, y: 0, w: 0, h: 7.5, line: { color: dark ? '173C5C' : 'D7EDF5', transparency: 55, width: .35 } });
        for (let y = 0; y <= 7.5; y += .33) slide.addShape(pptx.ShapeType.line, { x: 0, y, w: 13.33, h: 0, line: { color: dark ? '173C5C' : 'D7EDF5', transparency: 55, width: .35 } });
        slide.addShape(pptx.ShapeType.rect, { x: .36, y: .42, w: .12, h: .6, fill: { color: accent }, line: { color: accent } });
        slide.addText(source.title || `Slide ${index + 1}`, { x: .67, y: .4, w: 11.6, h: .55, fontSize: 25, bold: true, color: foreground, fit: 'shrink' as any });
        if (source.subtitle) slide.addText(source.subtitle, { x: .7, y: 1.02, w: 11.6, h: .36, fontSize: 13, color: secondary, fit: 'shrink' as any });
        const blocks = (source.blocks?.length ? source.blocks : [{ items: ['[Cần xác minh nội dung slide]'] }]).slice(0, 6);
        const columns = blocks.length <= 2 ? blocks.length : 2;
        const rows = Math.ceil(blocks.length / columns);
        const gap = .18, left = .62, top = source.subtitle ? 1.48 : 1.25, areaW = 12.1, areaH = 5.45;
        const blockW = (areaW - gap * (columns - 1)) / columns;
        const blockH = (areaH - gap * (rows - 1)) / rows;
        blocks.forEach((block, blockIndex) => {
            const col = blockIndex % columns, row = Math.floor(blockIndex / columns);
            const x = left + col * (blockW + gap), y = top + row * (blockH + gap);
            const fill = block.kind === 'callout' ? (dark ? '1D4E6D' : 'E4F4FA') : (dark ? '163A56' : 'FFFFFF');
            slide.addShape(pptx.ShapeType.roundRect, { x, y, w: blockW, h: blockH, rectRadius: .06, fill: { color: fill, transparency: 2 }, line: { color: dark ? '41718D' : 'A5C7D7', width: 1 } });
            let bodyY = y + .22;
            if (block.heading) { slide.addText(block.heading, { x: x + .2, y: bodyY, w: blockW - .4, h: .38, fontSize: 16, bold: true, color: foreground, fit: 'shrink' as any }); bodyY += .46; }
            const items = (block.items || []).filter(Boolean).slice(0, 8);
            slide.addText(items.map(item => ({ text: item, options: { bullet: { indent: 14 }, hanging: 3, breakLine: true } })), { x: x + .22, y: bodyY, w: blockW - .44, h: blockH - (bodyY - y) - .15, fontSize: Math.min(17, rows > 1 ? 13 : 16), color: secondary, valign: 'top', paraSpaceAfter: 8, fit: 'shrink' as any });
        });
        slide.addText(String(index + 1), { x: 12.45, y: 7.08, w: .35, h: .18, align: 'right', fontSize: 9, color: dark ? '9CC7DF' : '527188' });
    });
    await pptx.writeFile({ fileName: `${sourceName.replace(/\.[^.]+$/, '')}_editable.pptx` });
};

export default function DocumentSummary() {
    const inputRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState('');
    const [editableSlides, setEditableSlides] = useState<EditableSlide[]>([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const selectFile = (selected?: File) => {
        setError(''); setResult(''); setEditableSlides([]);
        if (!selected) return;
        const extension = selected.name.split('.').pop()?.toLowerCase();
        if (selected.size > MAX_SIZE || (!supported.includes(selected.type) && !['txt', 'md', 'csv', 'pdf', 'docx', 'pptx'].includes(extension || ''))) {
            setFile(null); setError('Chỉ hỗ trợ PPTX, TXT, MD, CSV, DOCX và PDF, dung lượng tối đa 25 MB.'); return;
        }
        setFile(selected);
    };

    const summarize = async () => {
        if (!file) return;
        setLoading(true); setError(''); setResult(''); setEditableSlides([]);
        try {
            const extension = file.name.split('.').pop()?.toLowerCase();
            const body: Record<string, any> = { fileName: file.name, mimeType: file.type || (extension === 'pdf' ? 'application/pdf' : 'text/plain') };
            if (extension === 'pptx') { body.mode = 'pptx-editable'; body.slideImages = await extractPptxSlideImages(file); }
            else if (extension === 'pdf' || file.type === 'application/pdf') body.fileBase64 = await readBase64(file);
            else if (extension === 'docx') body.text = await textFromDocx(file);
            else body.text = await file.text();
            if (!body.text && !body.fileBase64 && !body.slideImages) throw new Error('Tài liệu không có nội dung để tóm tắt.');
            const response = await fetch('/api/document-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Không thể tóm tắt tài liệu.');
            if (extension === 'pptx') { setEditableSlides(data.editableSlides || []); if (!data.editableSlides?.length) throw new Error('Không nhận được nội dung slide để phục dựng.'); }
            else setResult(data.text);
        } catch (err: any) { setError(err.message || 'Đã có lỗi xảy ra.'); }
        finally { setLoading(false); }
    };

    return <Container maxWidth="lg" sx={{ py: 3 }}>
        <Stack spacing={3}>
            <Box>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                    <AutoAwesomeIcon color="primary" fontSize="large" />
                    <Box><Typography variant="h5" fontWeight={800}>Phân tích tài liệu & dàn ý thuyết trình</Typography><Typography color="text.secondary">Tải tài liệu để phân tích hoặc nhập PPTX ảnh để xuất lại bản có thể chỉnh sửa.</Typography></Box>
                </Stack>
            </Box>
            <Paper sx={{ p: { xs: 2.5, sm: 4 }, textAlign: 'center', border: '1px dashed #60a5fa', bgcolor: 'rgba(37,99,235,.05)' }}>
                <DescriptionOutlinedIcon sx={{ fontSize: 52, color: '#2563eb', mb: 1 }} />
                <Typography fontWeight={700}>{file ? file.name : 'Chọn tài liệu cần tóm tắt'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Hỗ trợ PPTX, PDF, Word (.docx), TXT, Markdown và CSV — tối đa 25 MB.</Typography>
                <input ref={inputRef} hidden type="file" accept=".pptx,.pdf,.docx,.txt,.md,.csv,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/pdf,text/plain,text/markdown,text/csv" onChange={e => selectFile(e.target.files?.[0])} />
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => inputRef.current?.click()}>Chọn tài liệu</Button>
                {file && <Button sx={{ ml: 1 }} variant="contained" startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <AutoAwesomeIcon />} disabled={loading} onClick={summarize}>{loading ? 'Đang xử lý...' : file.name.toLowerCase().endsWith('.pptx') ? 'Phục dựng PPTX chỉnh sửa được' : 'Phân tích & lập dàn ý'}</Button>}
            </Paper>
            {error && <Alert severity="error">{error}</Alert>}
            {result && <Paper sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: '#f8fbff', border: '1px solid #dbeafe' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography variant="overline" color="primary" fontWeight={800}>BÁO CÁO PHÂN TÍCH & DÀN Ý THUYẾT TRÌNH</Typography><Button size="small" variant="contained" startIcon={<DownloadIcon />} onClick={() => createPptx(result, file?.name || 'thuyet-trinh')}>Tải PowerPoint</Button></Stack>{renderSummary(result)}</Paper>}
            {editableSlides.length > 0 && <Paper sx={{ p: { xs: 2.5, sm: 4 }, bgcolor: '#f8fbff', border: '1px solid #dbeafe' }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 2 }}><Box><Typography variant="overline" color="primary" fontWeight={800}>PHỤC DỰNG POWERPOINT</Typography><Typography fontWeight={700}>Đã nhận diện {editableSlides.length} slide. Bản xuất dùng text và shape để có thể chỉnh sửa.</Typography><Typography variant="body2" color="text.secondary">Logo Gemini/NotebookLM sẽ không được đưa vào bản xuất.</Typography></Box><Button variant="contained" startIcon={<DownloadIcon />} onClick={() => createEditablePptx(editableSlides, file?.name || 'presentation')}>Tải PPTX chỉnh sửa được</Button></Stack></Paper>}
        </Stack>
    </Container>;
}
