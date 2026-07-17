import React, { useState, useRef, useEffect } from 'react';
import {
    Box, Grid, Paper, Typography, Button, IconButton, Slider,
    Stack, Card, CardMedia, CardContent, CircularProgress,
    TextField, Switch, FormControlLabel, Tab, Tabs, Divider,
    Breadcrumbs, Link, Alert, Tooltip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Chip
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import TranslateIcon from '@mui/icons-material/Translate';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import Brightness6Icon from '@mui/icons-material/Brightness6';
import ContrastIcon from '@mui/icons-material/Contrast';
import ViewListIcon from '@mui/icons-material/ViewList';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';

interface UploadedFile {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    enhanced_path: string | null;
    status: 'uploaded' | 'enhancing' | 'enhanced' | 'processing' | 'completed' | 'failed';
    public_url?: string;
    enhanced_url?: string;
}

interface OcrResult {
    file_id: string;
    raw_text: string;
    structured_data: any;
    confidence: number;
    language: string;
    id?: string;
}

interface PdfDocument {
    id: string;
    title: string;
    pdf_path: string;
    is_searchable: boolean;
    page_count: number;
    created_at: string;
    pdf_url?: string;
}

export default function OCRDocuments() {
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);
    const userId = profile?.id || null;

    const [activeTab, setActiveTab] = useState(0);
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
    const [ocrResults, setOcrResults] = useState<Record<string, OcrResult>>({});
    const [pdfDocuments, setPdfDocuments] = useState<PdfDocument[]>([]);
    
    // UI states
    const [isUploading, setIsUploading] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isProcessingOcr, setIsProcessingOcr] = useState(false);
    const [isProcessingOffline, setIsProcessingOffline] = useState(false);
    const [offlineProgress, setOfflineProgress] = useState(0);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Canvas Enhancement Sliders
    const [brightness, setBrightness] = useState<number>(100);
    const [contrast, setContrast] = useState<number>(100);
    const [rotation, setRotation] = useState<number>(0);
    const [binarize, setBinarize] = useState<boolean>(false);

    // Export PDF settings
    const [pdfTitle, setPdfTitle] = useState<string>('Tài liệu OCR Số hóa');
    const [isSearchablePdf, setIsSearchablePdf] = useState<boolean>(true);
    const [exportedPdfUrl, setExportedPdfUrl] = useState<string | null>(null);
    const [ocrEngine, setOcrEngine] = useState<'gemini' | 'google-vision' | 'tesseract'>('google-vision');

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Fetch initial list of files & PDF history
    useEffect(() => {
        fetchFilesAndHistory();
    }, []);

    const fetchFilesAndHistory = async () => {
        try {
            // Fetch uploaded files
            const { data: dbFiles, error: filesErr } = await fetchSupabaseTable('upload_files');
            if (!filesErr && dbFiles) {
                // Generate public URLs
                const filesWithUrls = dbFiles.map((f: any) => ({
                    ...f,
                    public_url: getSupabasePublicUrl('ocr-documents', f.file_path),
                    enhanced_url: f.enhanced_path ? getSupabasePublicUrl('ocr-documents', f.enhanced_path) : undefined
                }));
                setFiles(filesWithUrls);
                if (filesWithUrls.length > 0) {
                    setSelectedFileId(filesWithUrls[filesWithUrls.length - 1].id);
                }
            }

            // Fetch PDF Documents history
            const { data: dbPdfs, error: pdfsErr } = await fetchSupabaseTable('pdf_documents');
            if (!pdfsErr && dbPdfs) {
                const pdfsWithUrls = dbPdfs.map((p: any) => ({
                    ...p,
                    pdf_url: getSupabasePublicUrl('ocr-documents', p.pdf_path)
                }));
                setPdfDocuments(pdfsWithUrls);
            }

            // Fetch OCR results to map to states
            const { data: dbOcrs } = await fetchSupabaseTable('ocr_results');
            if (dbOcrs) {
                const ocrMap: Record<string, OcrResult> = {};
                dbOcrs.forEach((item: any) => {
                    ocrMap[item.file_id] = {
                        file_id: item.file_id,
                        raw_text: item.raw_text,
                        structured_data: item.structured_data,
                        confidence: Number(item.confidence),
                        language: item.language,
                        id: item.id
                    };
                });
                setOcrResults(ocrMap);
            }
        } catch (error) {
            console.error('Lỗi tải dữ liệu ban đầu:', error);
        }
    };

    // Helper functions for direct database querying through Supabase JS REST Client API (fetch wrapper)
    const fetchSupabaseTable = async (tableName: string) => {
        try {
            // Using existing client-side API proxies or fetch endpoints if direct window.supabase isn't present
            // In typical Vite templates, it queries from Supabase Url
            const headers: Record<string, string> = {
                'apikey': (window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${(window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
            };
            const res = await fetch(`${(window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/rest/v1/${tableName}?select=*&order=created_at.desc`, { headers });
            if (!res.ok) throw new Error(`Query failed: ${res.statusText}`);
            const data = await res.json();
            return { data, error: null };
        } catch (error: any) {
            console.error(`Fetch error ${tableName}:`, error);
            return { data: null, error };
        }
    };

    const getSupabasePublicUrl = (bucket: string, path: string) => {
        const url = (window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '';
        return `${url}/storage/v1/object/public/${bucket}/${path}`;
    };

    // Real-time canvas drawing when active image or enhancement sliders change
    useEffect(() => {
        const selectedFile = files.find(f => f.id === selectedFileId);
        if (!selectedFile) return;

        const img = new Image();
        img.crossOrigin = 'anonymous';
        // Load original or enhanced image
        img.src = selectedFile.public_url || '';
        img.onload = () => {
            renderEnhancedImage(img);
        };
    }, [selectedFileId, files, brightness, contrast, rotation, binarize]);

    const renderEnhancedImage = (img: HTMLImageElement) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Calculate size based on rotation angle (90 or 270 deg swapped dimensions)
        const isSwapped = Math.abs(rotation % 180) === 90;
        const width = isSwapped ? img.height : img.width;
        const height = isSwapped ? img.width : img.height;

        // Constraint canvas size to fit UI but keep aspect ratio
        const maxDim = 800;
        let scale = 1;
        if (width > maxDim || height > maxDim) {
            scale = maxDim / Math.max(width, height);
        }

        canvas.width = width * scale;
        canvas.height = height * scale;

        // Apply transformations
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();

        // Apply Filters: Brightness, Contrast & Grayscale/Binarization
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        const bFactor = brightness / 100;
        const cFactor = (contrast - 100) / 100 + 1; // contrast scale

        for (let i = 0; i < data.length; i += 4) {
            // Apply Brightness & Contrast
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];

            // Brightness
            r *= bFactor;
            g *= bFactor;
            b *= bFactor;

            // Contrast
            r = (r - 128) * cFactor + 128;
            g = (g - 128) * cFactor + 128;
            b = (b - 128) * cFactor + 128;

            // Binarization (Otsu thresholding or basic 128 threshold)
            if (binarize) {
                const gray = 0.299 * r + 0.587 * g + 0.114 * b;
                const binary = gray > 128 ? 255 : 0;
                r = binary;
                g = binary;
                b = binary;
            }

            data[i] = Math.min(255, Math.max(0, r));
            data[i + 1] = Math.min(255, Math.max(0, g));
            data[i + 2] = Math.min(255, Math.max(0, b));
        }

        ctx.putImageData(imgData, 0, 0);
    };

    // Upload files handler
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
        let uploadedFiles: FileList | null = null;
        if ('dataTransfer' in event) {
            event.preventDefault();
            uploadedFiles = event.dataTransfer.files;
        } else if ('target' in event) {
            uploadedFiles = event.target.files;
        }

        if (!uploadedFiles || uploadedFiles.length === 0) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            for (let i = 0; i < uploadedFiles.length; i++) {
                const file = uploadedFiles[i];
                
                // File check validations
                const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
                if (!allowedMimes.includes(file.type)) {
                    throw new Error(`Định dạng tệp không được hỗ trợ: ${file.name}. Chỉ nhận ảnh JPG, JPEG, PNG, WEBP.`);
                }

                if (file.size > 15 * 1024 * 1024) {
                    throw new Error(`Tệp quá dung lượng cho phép (>15MB): ${file.name}`);
                }

                // Chuyển file thành base64 để upload qua API
                const base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64Str = (reader.result as string).split(',')[1];
                        resolve(base64Str);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                const res = await fetch('/api/ocr?type=upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fileName: file.name,
                        mimeType: file.type,
                        fileData: base64Data,
                        userId
                    })
                });

                if (!res.ok) {
                    const error = await res.json();
                    throw new Error(error.error || 'Lỗi tải ảnh lên API.');
                }

                const uploadResData = await res.json();
                setFiles(prev => [...prev, uploadResData.file]);
                setSelectedFileId(uploadResData.file.id);
            }

            setSuccessMessage("Tải lên tất cả các ảnh thành công!");
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchFilesAndHistory();
        } catch (error: any) {
            setUploadError(error.message || 'Lỗi không xác định khi tải lên file.');
        } finally {
            setIsUploading(false);
        }
    };

    // Save Enhanced Image to Supabase
    const handleEnhanceImage = async () => {
        if (!selectedFileId) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsEnhancing(true);
        try {
            const base64Data = canvas.toDataURL('image/png').split(',')[1];

            const res = await fetch('/api/ocr?type=enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileId: selectedFileId,
                    fileData: base64Data,
                    userId
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Lỗi lưu ảnh tiền xử lý.');
            }

            const data = await res.json();
            
            // Cập nhật lại danh sách files
            setFiles(prev => prev.map(f => f.id === selectedFileId ? {
                ...f,
                enhanced_path: data.file.enhanced_path,
                enhanced_url: data.file.enhanced_url,
                status: 'enhanced'
            } : f));

            setSuccessMessage("Lưu ảnh đã tiền xử lý thành công!");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error: any) {
            alert(error.message || 'Lỗi cải thiện hình ảnh');
        } finally {
            setIsEnhancing(false);
        }
    };

    // Run OCR via API (Gemini Multimodal or Google Vision)
    const handleRunOcr = async (fileId: string, engine: 'gemini' | 'google-vision' = 'gemini') => {
        setIsProcessingOcr(true);
        try {
            const res = await fetch('/api/ocr?type=process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileIds: [fileId],
                    userId,
                    engine
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Lỗi nhận diện OCR AI.');
            }

            const data = await res.json();
            const result = data.results[0];

            if (result && result.ocr) {
                setOcrResults(prev => ({
                    ...prev,
                    [fileId]: {
                        file_id: fileId,
                        raw_text: result.ocr.raw_text,
                        structured_data: result.ocr.structured_data,
                        confidence: result.ocr.confidence,
                        language: result.ocr.language,
                        id: result.ocr.id
                    }
                }));

                // Update file status in local list
                setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'completed' } : f));
                setSuccessMessage("Đã nhận diện chữ từ AI thành công!");
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error: any) {
            alert(error.message || 'Lỗi thực hiện OCR');
        } finally {
            setIsProcessingOcr(false);
        }
    };
    // Helper to dynamically load Tesseract.js from unpkg CDN
    const loadTesseract = (): Promise<any> => {
        return new Promise((resolve, reject) => {
            if ((window as any).Tesseract) {
                resolve((window as any).Tesseract);
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/tesseract.js@v5.1.0/dist/tesseract.min.js';
            script.onload = () => resolve((window as any).Tesseract);
            script.onerror = () => reject(new Error('Không thể tải thư viện Tesseract.js từ CDN'));
            document.body.appendChild(script);
        });
    };

    // Run OCR offline using Tesseract.js in WebAssembly
    const handleRunOcrOffline = async (fileId: string) => {
        const selectedFile = files.find(f => f.id === fileId);
        if (!selectedFile) return;

        setIsProcessingOffline(true);
        setOfflineProgress(0);

        try {
            const tesseract = await loadTesseract();
            const canvas = canvasRef.current;
            if (!canvas) throw new Error('Không tìm thấy khung ảnh canvas.');

            const result = await tesseract.recognize(canvas, 'vie+eng', {
                logger: (m: any) => {
                    if (m.status === 'recognizing text') {
                        setOfflineProgress(Math.round(m.progress * 100));
                    }
                }
            });

            const rawText = result.data.text || 'Không nhận diện được văn bản nào.';

            // Lưu kết quả giả lập OCR vào Database
            const headers: Record<string, string> = {
                'apikey': (window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${(window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            };

            const dbOcrRes = await fetch(`${(window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/rest/v1/ocr_results`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    file_id: fileId,
                    raw_text: rawText,
                    structured_data: {
                        document_type: "Văn bản Offline (Tesseract)",
                        metadata: {
                            engine: "tesseract.js-wasm",
                            language: "vie+eng",
                            timestamp: new Date().toISOString()
                        }
                    },
                    language: "vi",
                    confidence: Math.round((result.data.confidence || 70)),
                    engine: "tesseract-offline"
                })
            });

            if (!dbOcrRes.ok) {
                console.warn('Không thể lưu kết quả offline vào DB, lưu local...');
            }

            const dbDataArray = await dbOcrRes.json().catch(() => []);
            const dbOcr = dbDataArray && dbDataArray.length > 0 ? dbDataArray[0] : null;

            setOcrResults(prev => ({
                ...prev,
                [fileId]: {
                    file_id: fileId,
                    raw_text: rawText,
                    structured_data: {
                        document_type: "Văn bản Offline (Tesseract)",
                        metadata: {
                            engine: "tesseract.js-wasm",
                            language: "vie+eng"
                        }
                    },
                    confidence: Math.round(result.data.confidence || 70),
                    language: "vi",
                    id: dbOcr ? dbOcr.id : `local-${Date.now()}`
                }
            }));

            // Cập nhật trạng thái file thành completed
            setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: 'completed' } : f));
            setSuccessMessage("Đã nhận diện chữ offline bằng Tesseract thành công!");
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (error: any) {
            alert(error.message || 'Lỗi nhận diện offline.');
        } finally {
            setIsProcessingOffline(false);
            setOfflineProgress(0);
        }
    };
    // Export PDF Doc
    const handleExportPdf = async () => {
        if (files.length === 0) return;

        setIsExportingPdf(true);
        setExportedPdfUrl(null);
        try {
            const fileIds = files.map(f => f.id);

            const res = await fetch('/api/ocr?type=export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileIds,
                    title: pdfTitle,
                    isSearchable: isSearchablePdf,
                    userId
                })
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Lỗi xuất PDF.');
            }

            const data = await res.json();
            setExportedPdfUrl(data.pdf.pdf_url);
            
            setSuccessMessage("Đã tạo tệp PDF thành công!");
            setTimeout(() => setSuccessMessage(null), 4000);
            fetchFilesAndHistory(); // Refresh history
        } catch (error: any) {
            alert(error.message || 'Lỗi xuất tệp PDF');
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Delete single file
    const handleDeleteFile = async (id: string) => {
        if (!confirm("Bạn có chắc chắn muốn xóa ảnh này khỏi hệ thống?")) return;
        try {
            const headers: Record<string, string> = {
                'apikey': (window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
                'Authorization': `Bearer ${(window as any).VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''}`
            };
            
            // Xóa file khỏi db
            await fetch(`${(window as any).VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL}/rest/v1/upload_files?id=eq.${id}`, {
                method: 'DELETE',
                headers
            });

            setFiles(prev => prev.filter(f => f.id !== id));
            if (selectedFileId === id) {
                setSelectedFileId(files.length > 1 ? files[0].id : null);
            }
        } catch (error) {
            console.error('Lỗi xóa file:', error);
        }
    };

    const handleCopyText = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Đã sao chép văn bản vào bộ nhớ tạm!");
    };

    // Sort handlers
    const moveFileOrder = (index: number, direction: 'up' | 'down') => {
        const newFiles = [...files];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= files.length) return;

        const temp = newFiles[index];
        newFiles[index] = newFiles[targetIndex];
        newFiles[targetIndex] = temp;
        setFiles(newFiles);
    };

    // Active file state info
    const selectedFile = files.find(f => f.id === selectedFileId);
    const activeOcr = selectedFileId ? ocrResults[selectedFileId] : null;

    return (
        <Box sx={{ p: 3, minHeight: 'calc(100vh - 64px)', bgcolor: 'transparent' }}>
            {/* Breadcrumbs */}
            <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
                <Link underline="hover" color="inherit" onClick={() => navigate('/')} sx={{ cursor: 'pointer', fontSize: '0.85rem' }}>
                    Trang chủ
                </Link>
                <Typography color="text.primary" sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    OCR Documents
                </Typography>
            </Breadcrumbs>

            {/* Header Area */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight="800" color="#0f172a" sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
                        OCR Documents
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Hệ thống số hóa, căn chỉnh chỉnh sửa ảnh, và nhận dạng văn bản tiếng Việt thông minh qua AI
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    onClick={() => navigate(-1)}
                    startIcon={<ArrowBackIcon />}
                    sx={{ textTransform: 'none', borderRadius: '10px' }}
                >
                    Quay lại
                </Button>
            </Stack>

            {/* Navigation Tabs */}
            <Tabs
                value={activeTab}
                onChange={(_, val) => setActiveTab(val)}
                sx={{
                    mb: 4,
                    '& .MuiTabs-indicator': { bgcolor: '#2563eb', height: '3px' },
                    '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', fontSize: '1rem', minWidth: 140 }
                }}
            >
                <Tab icon={<ViewListIcon />} iconPosition="start" label="Không gian làm việc OCR" />
                <Tab icon={<HistoryIcon />} iconPosition="start" label="Lịch sử PDF xuất bản" />
            </Tabs>

            {successMessage && <Alert severity="success" sx={{ mb: 3, borderRadius: '12px' }}>{successMessage}</Alert>}
            {uploadError && <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }}>{uploadError}</Alert>}

            {activeTab === 0 ? (
                <Grid container spacing={4}>
                    {/* LEFT COLUMN: UPLOAD & IMAGES LIST */}
                    <Grid size={{ xs: 12, md: 3.5 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                bgcolor: 'white',
                                height: 'calc(100vh - 280px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2.5
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                                Tải tài liệu lên
                            </Typography>

                            {/* Drag & Drop Upload Zone */}
                            <Box
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={handleFileUpload}
                                onClick={() => fileInputRef.current?.click()}
                                sx={{
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '12px',
                                    p: 3,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        borderColor: '#2563eb',
                                        bgcolor: 'rgba(37, 99, 235, 0.02)'
                                    }
                                }}
                            >
                                <input
                                    type="file"
                                    multiple
                                    accept="image/*"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleFileUpload}
                                />
                                {isUploading ? (
                                    <CircularProgress size={32} sx={{ color: '#2563eb', mb: 1.5 }} />
                                ) : (
                                    <CloudUploadIcon sx={{ fontSize: 40, color: '#64748b', mb: 1.5 }} />
                                )}
                                <Typography variant="body2" fontWeight="600" color="#475569">
                                    Kéo thả hoặc nhấp để tải ảnh
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Hỗ trợ JPG, JPEG, PNG, WEBP tối đa 15MB
                                </Typography>
                            </Box>

                            <Divider />

                            {/* Images Queue */}
                            <Typography variant="subtitle2" fontWeight="700" color="#0f172a">
                                Danh sách ảnh ({files.length})
                            </Typography>

                            <Box sx={{ flex: 1, overflowY: 'auto', pr: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {files.map((file, idx) => (
                                    <Card
                                        key={file.id}
                                        onClick={() => setSelectedFileId(file.id)}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            p: 1,
                                            borderRadius: '10px',
                                            cursor: 'pointer',
                                            border: '1px solid',
                                            borderColor: selectedFileId === file.id ? '#2563eb' : '#e2e8f0',
                                            bgcolor: selectedFileId === file.id ? 'rgba(37, 99, 235, 0.02)' : 'white',
                                            boxShadow: 'none',
                                            position: 'relative',
                                            flexShrink: 0,
                                            '&:hover': { borderColor: '#2563eb' }
                                        }}
                                    >
                                        <CardMedia
                                            component="img"
                                            image={file.public_url || ''}
                                            sx={{ width: 44, height: 44, borderRadius: '6px', objectFit: 'cover' }}
                                        />
                                        <CardContent sx={{ py: '0 !important', px: 1.5, flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" fontWeight="600" noWrap>
                                                {file.file_name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {(file.file_size / 1024).toFixed(0)} KB • Trang {idx + 1}
                                            </Typography>
                                        </CardContent>
                                        
                                        {/* Sort Controls */}
                                        <Stack direction="row" spacing={0.2} sx={{ mr: 1 }}>
                                            <IconButton size="small" disabled={idx === 0} onClick={(e) => { e.stopPropagation(); moveFileOrder(idx, 'up'); }}>
                                                <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                            <IconButton size="small" disabled={idx === files.length - 1} onClick={(e) => { e.stopPropagation(); moveFileOrder(idx, 'down'); }}>
                                                <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Stack>

                                        {/* Delete */}
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                                            sx={{ p: 0.5 }}
                                        >
                                            <DeleteIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Card>
                                ))}

                                {files.length === 0 && (
                                    <Box textAlign="center" py={4}>
                                        <Typography variant="body2" color="text.secondary">
                                            Chưa có hình ảnh nào được tải lên
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        </Paper>
                    </Grid>

                    {/* MIDDLE COLUMN: IMAGE VIEWER & ENHANCEMENT EDITORS */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                bgcolor: 'white',
                                height: 'calc(100vh - 280px)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                                    Xem trước & Cải thiện ảnh
                                </Typography>
                                {selectedFile && (
                                    <Chip
                                        label={selectedFile.status === 'enhanced' ? 'Đã tiền xử lý' : 'Ảnh gốc'}
                                        color={selectedFile.status === 'enhanced' ? 'success' : 'default'}
                                        size="small"
                                        variant="outlined"
                                    />
                                )}
                            </Stack>

                            {/* Canvas Viewer Container */}
                            <Box
                                sx={{
                                    flex: 1,
                                    bgcolor: '#0f172a',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    p: 1.5,
                                    position: 'relative'
                                }}
                            >
                                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                {!selectedFile && (
                                    <Typography color="#64748b" variant="body2">
                                        Chọn một ảnh để chỉnh sửa
                                    </Typography>
                                )}
                            </Box>

                            {/* Canvas Controls */}
                            {selectedFile && (
                                <Box sx={{ mt: 2.5 }}>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 6 }}>
                                            <Stack spacing={1}>
                                                <Typography variant="caption" fontWeight="600" color="#475569" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <RotateRightIcon sx={{ fontSize: 16 }} /> Xoay hình ảnh (Góc)
                                                </Typography>
                                                <Slider
                                                    size="small"
                                                    value={rotation}
                                                    onChange={(_, val) => setRotation(val as number)}
                                                    min={-180}
                                                    max={180}
                                                    valueLabelDisplay="auto"
                                                />
                                            </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Stack spacing={1}>
                                                <Typography variant="caption" fontWeight="600" color="#475569" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <ContrastIcon sx={{ fontSize: 16 }} /> Tăng độ tương phản
                                                </Typography>
                                                <Slider
                                                    size="small"
                                                    value={contrast}
                                                    onChange={(_, val) => setContrast(val as number)}
                                                    min={50}
                                                    max={200}
                                                    valueLabelDisplay="auto"
                                                />
                                            </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 6 }}>
                                            <Stack spacing={1}>
                                                <Typography variant="caption" fontWeight="600" color="#475569" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Brightness6Icon sx={{ fontSize: 16 }} /> Độ sáng
                                                </Typography>
                                                <Slider
                                                    size="small"
                                                    value={brightness}
                                                    onChange={(_, val) => setBrightness(val as number)}
                                                    min={50}
                                                    max={150}
                                                    valueLabelDisplay="auto"
                                                />
                                            </Stack>
                                        </Grid>
                                        <Grid size={{ xs: 6 }} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={binarize}
                                                        onChange={(e) => setBinarize(e.target.checked)}
                                                        size="small"
                                                    />
                                                }
                                                label={
                                                    <Typography variant="caption" fontWeight="600" color="#475569">
                                                        Làm rõ nét chữ (Đơn sắc)
                                                    </Typography>
                                                }
                                            />
                                        </Grid>
                                    </Grid>

                                    <Stack spacing={2} sx={{ mt: 2.5 }}>
                                        {/* Dynamic OCR Engine Selector */}
                                        <TextField
                                            select
                                            fullWidth
                                            label="Bộ máy nhận diện (OCR Engine)"
                                            size="small"
                                            value={ocrEngine}
                                            onChange={(e) => setOcrEngine(e.target.value as any)}
                                            SelectProps={{ native: true }}
                                        >
                                            <option value="google-vision">Google Cloud Vision (Enterprise)</option>
                                            <option value="gemini">Gemini AI Vision (Multimodal)</option>
                                            <option value="tesseract">Tesseract.js (Offline - 100% Free)</option>
                                        </TextField>

                                        <Button
                                            fullWidth
                                            variant="contained"
                                            color="secondary"
                                            startIcon={isEnhancing ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                                            onClick={handleEnhanceImage}
                                            disabled={isEnhancing || isProcessingOcr || isProcessingOffline}
                                            sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#4F46E5', '&:hover': { bgcolor: '#4338CA' } }}
                                        >
                                            Áp dụng tiền xử lý
                                        </Button>

                                        <Button
                                            fullWidth
                                            variant="contained"
                                            color="primary"
                                            startIcon={(isProcessingOcr || isProcessingOffline) ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                                            onClick={() => {
                                                if (ocrEngine === 'tesseract') {
                                                    handleRunOcrOffline(selectedFile.id);
                                                } else {
                                                    handleRunOcr(selectedFile.id, ocrEngine);
                                                }
                                            }}
                                            disabled={isEnhancing || isProcessingOcr || isProcessingOffline}
                                            sx={{ 
                                                textTransform: 'none', 
                                                borderRadius: '10px', 
                                                bgcolor: ocrEngine === 'google-vision' ? '#10B981' : ocrEngine === 'gemini' ? '#2563eb' : '#f97316',
                                                '&:hover': {
                                                    bgcolor: ocrEngine === 'google-vision' ? '#059669' : ocrEngine === 'gemini' ? '#1d4ed8' : '#ea580c'
                                                }
                                            }}
                                        >
                                            {(isProcessingOcr || isProcessingOffline) ? 'Đang nhận diện chữ...' : `Bắt đầu nhận diện bằng ${ocrEngine === 'google-vision' ? 'Google Vision' : ocrEngine === 'gemini' ? 'Gemini AI' : 'Tesseract'}`}
                                        </Button>
                                        
                                        {isProcessingOffline && (
                                            <Box sx={{ width: '100%', mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, textAlign: 'center', fontWeight: 'bold' }}>
                                                    Đang quét offline bằng Tesseract: {offlineProgress}%
                                                </Typography>
                                                <Box sx={{ height: 6, bgcolor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                                                    <Box sx={{ height: '100%', width: `${offlineProgress}%`, bgcolor: '#f97316', transition: 'width 0.2s ease' }} />
                                                </Box>
                                            </Box>
                                        )}
                                    </Stack>
                                </Box>
                            )}
                        </Paper>
                    </Grid>

                    {/* RIGHT COLUMN: OCR RESULTS & EXPORT PDF CONTROLS */}
                    <Grid size={{ xs: 12, md: 3.5 }}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                bgcolor: 'white',
                                height: 'calc(100vh - 280px)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2.5
                            }}
                        >
                            <Typography variant="subtitle1" fontWeight="700" color="#0f172a">
                                Kết quả OCR AI & Biên tập
                            </Typography>

                            {/* OCR Text Box Preview */}
                            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                    <Typography variant="caption" fontWeight="700" color="text.secondary">
                                        {activeOcr ? `Độ tin cậy: ${activeOcr.confidence}%` : 'Chưa có kết quả OCR'}
                                    </Typography>
                                    {activeOcr && (
                                        <IconButton size="small" onClick={() => handleCopyText(activeOcr.raw_text)}>
                                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                    )}
                                </Stack>
                                
                                <Box
                                    sx={{
                                        flex: 1,
                                        p: 1.5,
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        bgcolor: '#f8fafc',
                                        overflowY: 'auto',
                                        fontSize: '0.85rem',
                                        whiteSpace: 'pre-line',
                                        fontFamily: 'monospace',
                                        minHeight: 120
                                    }}
                                >
                                    {activeOcr ? activeOcr.raw_text : "Vui lòng chọn tệp ảnh và nhấp 'Nhận diện OCR AI' để trích xuất văn bản."}
                                </Box>

                                {activeOcr && (
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DownloadIcon />}
                                            href={`/api/ocr?type=download&id=${activeOcr.id}&format=txt`}
                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        >
                                            TXT
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DownloadIcon />}
                                            href={`/api/ocr?type=download&id=${activeOcr.id}&format=docx`}
                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        >
                                            Word
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<DownloadIcon />}
                                            href={`/api/ocr?type=download&id=${activeOcr.id}&format=json`}
                                            sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                                        >
                                            JSON
                                        </Button>
                                    </Stack>
                                )}
                            </Box>

                            <Divider />

                            {/* Export controls */}
                            <Typography variant="subtitle2" fontWeight="700" color="#0f172a">
                                Ghép PDF chuẩn & Searchable
                            </Typography>

                            <Stack spacing={1.5}>
                                <TextField
                                    fullWidth
                                    label="Tiêu đề PDF"
                                    size="small"
                                    value={pdfTitle}
                                    onChange={(e) => setPdfTitle(e.target.value)}
                                />
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={isSearchablePdf}
                                            onChange={(e) => setIsSearchablePdf(e.target.checked)}
                                        />
                                    }
                                    label="Tạo lớp văn bản tìm kiếm (Searchable PDF)"
                                />
                                <Button
                                    fullWidth
                                    variant="contained"
                                    color="success"
                                    startIcon={isExportingPdf ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdfIcon />}
                                    onClick={handleExportPdf}
                                    disabled={isExportingPdf || files.length === 0}
                                    sx={{ textTransform: 'none', borderRadius: '10px', bgcolor: '#10B981', '&:hover': { bgcolor: '#059669' } }}
                                >
                                    Ghép & Xuất bản PDF
                                </Button>
                            </Stack>

                            {exportedPdfUrl && (
                                <Alert severity="success" icon={<PictureAsPdfIcon />} sx={{ borderRadius: '8px' }}>
                                    <Link href={exportedPdfUrl} target="_blank" fontWeight="700">
                                        Tải xuống PDF kết quả
                                    </Link>
                                </Alert>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            ) : (
                /* PDF DOCUMENTS LOGS HISTORY TAB */
                <Paper elevation={0} sx={{ p: 4, borderRadius: '16px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                    <Typography variant="h6" fontWeight="700" color="#0f172a" sx={{ mb: 3 }}>
                        Lịch sử xuất bản PDF tài liệu
                    </Typography>

                    <TableContainer>
                        <Table sx={{ minWidth: 650 }}>
                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                    <TableCell><strong>Tiêu đề tài liệu</strong></TableCell>
                                    <TableCell align="center"><strong>Số trang</strong></TableCell>
                                    <TableCell align="center"><strong>Searchable PDF</strong></TableCell>
                                    <TableCell><strong>Ngày tạo</strong></TableCell>
                                    <TableCell align="center"><strong>Tệp tin</strong></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pdfDocuments.map((doc) => (
                                    <TableRow key={doc.id} hover>
                                        <TableCell>{doc.title}</TableCell>
                                        <TableCell align="center">{doc.page_count} trang</TableCell>
                                        <TableCell align="center">
                                            <Chip
                                                label={doc.is_searchable ? 'Có' : 'Không'}
                                                color={doc.is_searchable ? 'success' : 'default'}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(doc.created_at).toLocaleString('vi-VN')}</TableCell>
                                        <TableCell align="center">
                                            <Button
                                                component="a"
                                                size="small"
                                                variant="outlined"
                                                startIcon={<DownloadIcon />}
                                                href={doc.pdf_url || ''}
                                                target="_blank"
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Tải PDF
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {pdfDocuments.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center">
                                            <Typography variant="body2" color="text.secondary" py={4}>
                                                Chưa có tài liệu PDF nào được xuất bản trước đây.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            )}
        </Box>
    );
}
