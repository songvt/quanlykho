import React, { useState, useRef } from 'react';
import { 
    Box, Paper, Typography, Grid, Stack, Button, IconButton, 
    Card, CardContent, Divider, Tabs, Tab, TextField, Alert,
    List, ListItem, ListItemText, CircularProgress
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CallMergeIcon from '@mui/icons-material/CallMerge';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import { useNotification } from '../contexts/NotificationContext';
import { PDFDocument } from 'pdf-lib';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';

export default function PDFTools() {
    const { success, error: notifyError } = useNotification();
    const [activeTab, setActiveTab] = useState(0); // 0: Gộp PDF, 1: Tách PDF
    const [isLoading, setIsLoading] = useState(false);

    // ─── States for Merging ───
    const [mergeFiles, setMergeFiles] = useState<File[]>([]);
    const mergeInputRef = useRef<HTMLInputElement>(null);

    // ─── States for Splitting ───
    const [splitFile, setSplitFile] = useState<File | null>(null);
    const [splitPageCount, setSplitPageCount] = useState<number>(0);
    const [splitRanges, setSplitRanges] = useState<string>(''); // e.g. "1-2, 4" or empty for all pages
    const splitInputRef = useRef<HTMLInputElement>(null);

    // ─── Drag and Drop States ───
    const [isDragOver, setIsDragOver] = useState(false);

    // ─── Merge PDF Logic ───
    const handleMergeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setMergeFiles(prev => [...prev, ...filesArray]);
            success(`Đã thêm ${filesArray.length} file PDF vào danh sách gộp!`);
        }
    };

    const handleRemoveMergeFile = (index: number) => {
        setMergeFiles(prev => prev.filter((_, idx) => idx !== index));
    };

    const handleMoveMergeFile = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === mergeFiles.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const newFiles = [...mergeFiles];
        const temp = newFiles[index];
        newFiles[index] = newFiles[targetIndex];
        newFiles[targetIndex] = temp;
        setMergeFiles(newFiles);
    };

    const handleMergePDFs = async () => {
        if (mergeFiles.length < 2) {
            notifyError('Vui lòng chọn ít nhất 2 file PDF để gộp!');
            return;
        }
        setIsLoading(true);
        try {
            const mergedPdf = await PDFDocument.create();
            
            for (const file of mergeFiles) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes as any], { type: 'application/pdf' });
            saveAs(blob, 'merged_document.pdf');
            success('Gộp file PDF thành công và đã bắt đầu tải xuống!');
        } catch (err: any) {
            console.error(err);
            notifyError('Lỗi trong quá trình gộp file: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Split PDF Logic ───
    const handleSplitFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsLoading(true);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                setSplitFile(file);
                setSplitPageCount(pdf.getPageCount());
                setSplitRanges('');
                success(`Đã tải file "${file.name}" gồm ${pdf.getPageCount()} trang!`);
            } catch (err: any) {
                notifyError('Không thể mở file PDF: ' + err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleSplitPDF = async () => {
        if (!splitFile) {
            notifyError('Vui lòng tải lên file PDF cần tách!');
            return;
        }
        setIsLoading(true);
        try {
            const arrayBuffer = await splitFile.arrayBuffer();
            const srcPdf = await PDFDocument.load(arrayBuffer);
            const totalPages = srcPdf.getPageCount();

            const zip = new JSZip();
            let splitCount = 0;

            const rangesTrimmed = splitRanges.trim();
            if (!rangesTrimmed || rangesTrimmed.toLowerCase() === 'all') {
                // Tách toàn bộ các trang thành các file đơn lẻ
                for (let i = 0; i < totalPages; i++) {
                    const newPdf = await PDFDocument.create();
                    const [copiedPage] = await newPdf.copyPages(srcPdf, [i]);
                    newPdf.addPage(copiedPage);
                    const pdfBytes = await newPdf.save();
                    zip.file(`${splitFile.name.replace('.pdf', '')}_trang_${i + 1}.pdf`, pdfBytes);
                    splitCount++;
                }
            } else {
                // Tách theo khoảng được cấu hình (ví dụ: "1-2, 4-6, 8")
                const parts = rangesTrimmed.split(',');
                for (let part of parts) {
                    part = part.trim();
                    if (part.includes('-')) {
                        const [startStr, endStr] = part.split('-');
                        const start = parseInt(startStr.trim(), 10);
                        const end = parseInt(endStr.trim(), 10);
                        if (!isNaN(start) && !isNaN(end) && start <= end && start >= 1 && end <= totalPages) {
                            const newPdf = await PDFDocument.create();
                            const indices = Array.from({ length: end - start + 1 }, (_, index) => start - 1 + index);
                            const copiedPages = await newPdf.copyPages(srcPdf, indices);
                            copiedPages.forEach(p => newPdf.addPage(p));
                            const pdfBytes = await newPdf.save();
                            zip.file(`${splitFile.name.replace('.pdf', '')}_trang_${start}_den_${end}.pdf`, pdfBytes);
                            splitCount++;
                        }
                    } else {
                        const pageNum = parseInt(part, 10);
                        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
                            const newPdf = await PDFDocument.create();
                            const [copiedPage] = await newPdf.copyPages(srcPdf, [pageNum - 1]);
                            newPdf.addPage(copiedPage);
                            const pdfBytes = await newPdf.save();
                            zip.file(`${splitFile.name.replace('.pdf', '')}_trang_${pageNum}.pdf`, pdfBytes);
                            splitCount++;
                        }
                    }
                }
            }

            if (splitCount === 0) {
                notifyError('Khoảng trang tách không hợp lệ hoặc nằm ngoài phạm vi số trang!');
                return;
            }

            // Generate ZIP file
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            saveAs(zipBlob, `${splitFile.name.replace('.pdf', '')}_split_pages.zip`);
            success(`Tách thành công ${splitCount} phần và đã bắt đầu tải về file ZIP!`);
        } catch (err: any) {
            console.error(err);
            notifyError('Lỗi trong quá trình tách file: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Drag & Drop Event Handlers ───
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'));

        if (files.length === 0) {
            notifyError('Vui lòng chỉ kéo thả file định dạng PDF!');
            return;
        }

        if (activeTab === 0) {
            setMergeFiles(prev => [...prev, ...files]);
            success(`Đã thêm ${files.length} file PDF!`);
        } else {
            const file = files[0];
            setIsLoading(true);
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                setSplitFile(file);
                setSplitPageCount(pdf.getPageCount());
                setSplitRanges('');
                success(`Đã tải file "${file.name}" gồm ${pdf.getPageCount()} trang!`);
            } catch (err: any) {
                notifyError('Không thể mở file PDF: ' + err.message);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 1, sm: 2, md: 3 }, py: 2 }}>
            {/* Header */}
            <Paper 
                elevation={3} 
                sx={{ 
                    p: { xs: 2.5, md: 4 }, 
                    mb: 3, 
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #701a75 50%, #831843 100%)',
                    border: 'none',
                    position: 'relative',
                    overflow: 'hidden',
                    color: 'white',
                    boxShadow: '0 10px 25px -5px rgba(131, 24, 67, 0.3)',
                    borderRadius: '16px'
                }}
            >
                <Grid container spacing={2} alignItems="center">
                    <Grid size={{ xs: 12 }}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Box 
                                sx={{ 
                                    width: 56, 
                                    height: 56, 
                                    borderRadius: '16px', 
                                    background: 'rgba(255, 255, 255, 0.18)', 
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                }}
                            >
                                <PictureAsPdfIcon sx={{ color: '#ffffff', fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 900, color: '#ffffff', letterSpacing: '-0.03em' }}>
                                    TIỆN ÍCH TÁCH / GỘP FILE PDF
                                </Typography>
                                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.85)', fontWeight: 500, mt: 0.5 }}>
                                    Hỗ trợ gộp nhiều file PDF hoặc tách trang PDF tải về hoàn toàn miễn phí trên trình duyệt.
                                </Typography>
                            </Box>
                        </Stack>
                    </Grid>
                </Grid>
            </Paper>

            {/* Mode Tabs */}
            <Paper elevation={2} sx={{ mb: 4, borderRadius: '12px', overflow: 'hidden' }}>
                <Tabs 
                    value={activeTab} 
                    onChange={(e, val) => setActiveTab(val)}
                    variant="fullWidth"
                    sx={{
                        '& .MuiTab-root': { py: 2, fontWeight: 'bold', fontSize: '0.95rem', textTransform: 'none' },
                        '& .Mui-selected': { color: '#831843' },
                        '& .MuiTabs-indicator': { backgroundColor: '#831843', height: '3px' }
                    }}
                >
                    <Tab icon={<CallMergeIcon />} iconPosition="start" label="Gộp Nhiều File PDF" />
                    <Tab icon={<CallSplitIcon />} iconPosition="start" label="Tách Trang PDF" />
                </Tabs>
            </Paper>

            <Grid container spacing={3}>
                {/* Left Area: Upload Zone */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Card elevation={2} sx={{ borderRadius: '12px', height: '100%' }}>
                        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
                                Tải File PDF Lên
                            </Typography>
                            
                            <Box
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => activeTab === 0 ? mergeInputRef.current?.click() : splitInputRef.current?.click()}
                                sx={{
                                    border: '2.5px dashed',
                                    borderColor: isDragOver ? '#831843' : 'grey.300',
                                    borderRadius: '12px',
                                    p: 5,
                                    flexGrow: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: isDragOver ? '#fdf2f8' : '#fafafa',
                                    transition: 'all 0.2s ease-in-out',
                                    '&:hover': { borderColor: '#831843', background: '#fdf2f8' }
                                }}
                            >
                                <CloudUploadIcon sx={{ fontSize: 56, color: '#831843', mb: 2, opacity: 0.8 }} />
                                <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.secondary', mb: 0.5 }}>
                                    Kéo thả file PDF tại đây hoặc nhấp để chọn file
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {activeTab === 0 ? 'Chọn nhiều file PDF để ghép' : 'Chọn 1 file PDF để tách trang'}
                                </Typography>
                            </Box>

                            <input 
                                ref={mergeInputRef} 
                                type="file" 
                                multiple 
                                hidden 
                                accept=".pdf" 
                                onChange={handleMergeFileChange} 
                            />
                            <input 
                                ref={splitInputRef} 
                                type="file" 
                                hidden 
                                accept=".pdf" 
                                onChange={handleSplitFileChange} 
                            />
                        </CardContent>
                    </Card>
                </Grid>

                {/* Right Area: List and Actions */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Card elevation={2} sx={{ borderRadius: '12px', minHeight: 380, display: 'flex', flexDirection: 'column' }}>
                        <CardContent sx={{ p: 3, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                            {isLoading ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, alignItems: 'center', justifyContent: 'center', py: 5 }}>
                                    <CircularProgress sx={{ color: '#831843', mb: 2 }} />
                                    <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                                        Đang xử lý dữ liệu PDF...
                                    </Typography>
                                </Box>
                            ) : (
                                <>
                                    {/* ── Tab 0: Merge PDF UI ── */}
                                    {activeTab === 0 && (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                                                Danh Sách Gộp PDF ({mergeFiles.length} file)
                                            </Typography>
                                            {mergeFiles.length === 0 ? (
                                                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                                                    <PictureAsPdfIcon sx={{ fontSize: 64, color: 'grey.300', mb: 1.5 }} />
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                                        Chưa có file nào được tải lên.
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                    <List sx={{ maxHeight: 280, overflowY: 'auto', bgcolor: '#fcfcfc', border: '1px solid #eee', borderRadius: '8px', mb: 3 }}>
                                                        {mergeFiles.map((file, idx) => (
                                                            <ListItem 
                                                                key={idx}
                                                                secondaryAction={
                                                                    <Stack direction="row" spacing={0.5}>
                                                                        <IconButton size="small" disabled={idx === 0} onClick={() => handleMoveMergeFile(idx, 'up')}>
                                                                            <ArrowUpwardIcon fontSize="small" />
                                                                        </IconButton>
                                                                        <IconButton size="small" disabled={idx === mergeFiles.length - 1} onClick={() => handleMoveMergeFile(idx, 'down')}>
                                                                            <ArrowDownwardIcon fontSize="small" />
                                                                        </IconButton>
                                                                        <IconButton size="small" color="error" onClick={() => handleRemoveMergeFile(idx)}>
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Stack>
                                                                }
                                                                divider
                                                            >
                                                                <ListItemText 
                                                                    primary={file.name} 
                                                                    secondary={formatBytes(file.size)}
                                                                    primaryTypographyProps={{ style: { fontWeight: 600, fontSize: '0.9rem', width: '70%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' } }}
                                                                />
                                                            </ListItem>
                                                        ))}
                                                    </List>
                                                    
                                                    <Button
                                                        variant="contained"
                                                        fullWidth
                                                        onClick={handleMergePDFs}
                                                        startIcon={<CallMergeIcon />}
                                                        sx={{
                                                            bgcolor: '#831843',
                                                            color: 'white',
                                                            fontWeight: 'bold',
                                                            py: 1.5,
                                                            '&:hover': { bgcolor: '#701a75' }
                                                        }}
                                                    >
                                                        Gộp File & Tải PDF Về
                                                    </Button>
                                                </Box>
                                            )}
                                        </Box>
                                    )}

                                    {/* ── Tab 1: Split PDF UI ── */}
                                    {activeTab === 1 && (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                                                Thiết Lập Tách Trang PDF
                                            </Typography>
                                            {!splitFile ? (
                                                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 6 }}>
                                                    <PictureAsPdfIcon sx={{ fontSize: 64, color: 'grey.300', mb: 1.5 }} />
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                                                        Chưa chọn file PDF cần tách trang.
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                    <Alert severity="info" sx={{ mb: 3, borderRadius: '8px' }}>
                                                        Tên file: <b>{splitFile.name}</b><br />
                                                        Số trang: <b>{splitPageCount} trang</b> | Dung lượng: <b>{formatBytes(splitFile.size)}</b>
                                                    </Alert>

                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                                        Khoảng trang tách (Ví dụ: 1-3, 5, 8-10):
                                                    </Typography>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        placeholder="Để trống để tự động tách tất cả các trang lẻ"
                                                        value={splitRanges}
                                                        onChange={(e) => setSplitRanges(e.target.value)}
                                                        sx={{ mb: 1 }}
                                                    />
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
                                                        - Nếu để trống: Mỗi trang của PDF sẽ được tách thành 1 file PDF riêng lẻ và nén vào file ZIP tải về.<br />
                                                        - Nếu nhập khoảng: Nhập số trang cách nhau bằng dấu phẩy. Dùng dấu gạch ngang (-) cho khoảng trang.
                                                    </Typography>

                                                    <Stack direction="row" spacing={2}>
                                                        <Button
                                                            variant="outlined"
                                                            color="error"
                                                            onClick={() => { setSplitFile(null); setSplitPageCount(0); }}
                                                            sx={{ fontWeight: 'bold' }}
                                                        >
                                                            Hủy
                                                        </Button>
                                                        <Button
                                                            variant="contained"
                                                            fullWidth
                                                            onClick={handleSplitPDF}
                                                            startIcon={<CallSplitIcon />}
                                                            sx={{
                                                                bgcolor: '#831843',
                                                                color: 'white',
                                                                fontWeight: 'bold',
                                                                '&:hover': { bgcolor: '#701a75' }
                                                            }}
                                                        >
                                                            Tách Trang & Tải Về
                                                        </Button>
                                                    </Stack>
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
