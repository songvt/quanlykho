import React, { useState } from 'react';
import { Box, Typography, Button, Paper, CircularProgress, Alert } from '@mui/material';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

const UploadInventoryDonVi: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setSuccessMsg('');
            setErrorMsg('');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setLoading(true);
        setSuccessMsg('');
        setErrorMsg('');

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Sử dụng thư viện xlsx để hỗ trợ cả .xls và .xlsx
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            if (!worksheet) {
                throw new Error('Không tìm thấy sheet nào trong file Excel');
            }

            // Chuyển đổi thành mảng 2 chiều, lấy giá trị mặc định là chuỗi rỗng
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];

            const dataToImport: any[] = [];
            // Lấy dữ liệu từ dòng 8 (index 7 vì mảng bắt đầu từ 0)
            const START_INDEX = 7;
            
            for (let i = START_INDEX; i < jsonData.length; i++) {
                const row = jsonData[i] || [];
                // Cột A đến I (9 cột, index từ 0 đến 8)
                const extractedRow = row.slice(0, 9);
                while (extractedRow.length < 9) {
                    extractedRow.push('');
                }
                
                const finalRow = extractedRow.map(cell => cell === null || cell === undefined ? '' : String(cell));

                // Kiểm tra xem dòng có hoàn toàn trống không
                if (finalRow.some(val => val.trim() !== '')) {
                    dataToImport.push(finalRow);
                }
            }

            // Bỏ 2 dòng cuối cùng (thường là dòng tổng cộng / footer)
            if (dataToImport.length > 2) {
                dataToImport.splice(-2, 2);
            } else {
                dataToImport.length = 0;
            }

            if (dataToImport.length === 0) {
                throw new Error('Không có dữ liệu hợp lệ trong file (hoặc file quá ngắn sau khi bỏ 2 dòng cuối).');
            }

            // Gửi dữ liệu lên API
            const response = await fetch('/api/upload_inventory_donvi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ payload: dataToImport })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Lỗi từ server');
            }

            setSuccessMsg(`Đã import thành công ${dataToImport.length} dòng dữ liệu.`);
            setFile(null); // Clear file
            
            // Reset input file
            const fileInput = document.getElementById('excel-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';

        } catch (error: any) {
            console.error('Upload error:', error);
            setErrorMsg(error.message || 'Có lỗi xảy ra khi đọc file Excel');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
            <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Upload size={24} color="#3b82f6" /> Upload tồn kho Đơn Vị
            </Typography>

            <Paper sx={{ p: 4, borderRadius: 2, bgcolor: 'background.paper', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary' }}>
                    Chức năng này hỗ trợ upload file Excel, lấy dữ liệu từ dòng A8 đến cột I và import vào Google Sheet:
                    <br />
                    <strong>ID:</strong> 1a283D_F9P5qpDyEOE3HRBEESFtvfQMxqUGH5ntZqrjo
                    <br />
                    <strong>Sheet:</strong> Q12-BCCS-DON_VI (Dán từ A2:I)
                </Typography>
                
                <Box sx={{ border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.02)', mb: 3 }}>
                    <input
                        type="file"
                        id="excel-upload"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                    />
                    <label htmlFor="excel-upload">
                        <Button variant="outlined" component="span" startIcon={<Upload size={18} />} sx={{ borderRadius: 2, textTransform: 'none' }}>
                            Chọn file Excel
                        </Button>
                    </label>
                    {file && (
                        <Typography variant="body2" sx={{ mt: 2, color: 'success.main', fontWeight: 500 }}>
                            Đã chọn: {file.name}
                        </Typography>
                    )}
                </Box>

                {errorMsg && (
                    <Alert severity="error" sx={{ mb: 3 }} icon={<AlertCircle size={20} />}>
                        {errorMsg}
                    </Alert>
                )}

                {successMsg && (
                    <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle size={20} />}>
                        {successMsg}
                    </Alert>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="contained"
                        onClick={handleUpload}
                        disabled={!file || loading}
                        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Upload size={18} />}
                        sx={{ px: 4, py: 1.5, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                        {loading ? 'Đang import...' : 'Tiến hành Import'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default UploadInventoryDonVi;
