import React, { useState, useRef, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Box, Typography, Stack, TextField, Table,
    TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Checkbox, Chip, IconButton, Tooltip, Alert,
    CircularProgress, InputAdornment
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import {
    TemplateExcelIcon,
    CloudUploadCustomIcon,
    PrinterModernIcon,
    TrashCustomIcon,
} from '../../components/Common/BrandIcons';

import type { HRProfile } from '../../types';
import {
    generateBhlHandoverTemplate,
    parseBhlHandoverExcel,
    buildBatchHandoverPrintHtml,
    type BhlBatchEmployee
} from '../../utils/assetBhlBatch';
import { formatBhlItemNote } from '../../utils/assetBhlItems';
import { saveAssetHandoverHistory } from '../../services/assetHandoverHistory';
import { useNotification } from '../../contexts/NotificationContext';

interface AssetHandoverBatchModalProps {
    open: boolean;
    onClose: () => void;
    hrProfiles: HRProfile[];
    giverInfo: {
        giverName?: string;
        giverTitle?: string;
        giverPhone?: string;
        giverName2?: string;
        giverTitle2?: string;
        giverPhone2?: string;
    };
    actionType: 'allocate' | 'revoke' | 'transfer';
    onBatchCompleted?: () => void;
}

export const AssetHandoverBatchModal: React.FC<AssetHandoverBatchModalProps> = ({
    open,
    onClose,
    hrProfiles,
    giverInfo,
    actionType,
    onBatchCompleted
}) => {
    const { success, error, warning } = useNotification();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [employees, setEmployees] = useState<BhlBatchEmployee[]>([]);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleDownloadTemplate = async () => {
        try {
            await generateBhlHandoverTemplate();
            success('Đã tải xuống file mẫu import bàn giao BHLĐ.');
        } catch (err: any) {
            error('Lỗi khi tạo file mẫu: ' + err.message);
        }
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setFileName(file.name);
        try {
            const parsed = await parseBhlHandoverExcel(file, hrProfiles);
            setEmployees(parsed);
            success(`Đã đọc thành công ${parsed.length} nhân viên từ file Excel.`);
        } catch (err: any) {
            error(err.message || 'Lỗi khi đọc file Excel.');
            setEmployees([]);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleToggleSelectAll = (checked: boolean) => {
        setEmployees(prev => prev.map(emp => ({ ...emp, selected: checked })));
    };

    const handleToggleSelect = (id: string) => {
        setEmployees(prev => prev.map(emp => emp.id === id ? { ...emp, selected: !emp.selected } : emp));
    };

    const handleReset = () => {
        setEmployees([]);
        setFileName('');
        setSearchQuery('');
    };

    const filteredEmployees = useMemo(() => {
        if (!searchQuery.trim()) return employees;
        const q = searchQuery.toLowerCase().trim();
        return employees.filter(emp =>
            emp.fullName.toLowerCase().includes(q) ||
            emp.employeeId.toLowerCase().includes(q) ||
            emp.department.toLowerCase().includes(q)
        );
    }, [employees, searchQuery]);

    const selectedEmployees = useMemo(() => {
        return employees.filter(emp => emp.selected);
    }, [employees]);

    const totalEquipmentCount = useMemo(() => {
        return selectedEmployees.reduce((sum, emp) => sum + emp.totalQuantity, 0);
    }, [selectedEmployees]);

    const isAllSelected = employees.length > 0 && employees.every(emp => emp.selected);
    const isIndeterminate = employees.some(emp => emp.selected) && !isAllSelected;

    const handlePrintBatch = async () => {
        if (selectedEmployees.length === 0) {
            warning('Vui lòng chọn ít nhất 1 nhân viên để in biên bản.');
            return;
        }

        try {
            // 1. Build the multi-page print document HTML
            const htmlContent = buildBatchHandoverPrintHtml({
                employees: selectedEmployees,
                actionType,
                giverInfo
            });

            // 2. Open print window
            const printWindow = window.open('', '_blank', 'width=1000,height=800');
            if (printWindow) {
                printWindow.document.write(htmlContent);
                printWindow.document.close();
            } else {
                warning('Trình duyệt đã chặn cửa sổ in (popup). Vui lòng cho phép popup để tiếp tục.');
            }

            // 3. Save handover records to database in background
            const savePromises = selectedEmployees.map(emp => {
                const activeItems = emp.items.filter(item => item.quantity > 0).map(item => ({
                    ...item,
                    note: formatBhlItemNote(item, emp.uniformSize, emp.shoeSize)
                }));

                const payload = {
                    employee_id: emp.employeeId || null,
                    receiver_name: emp.fullName,
                    receiver_title: emp.jobTitle,
                    receiver_dept: emp.department,
                    giver_info: giverInfo,
                    template_type: 'bhl',
                    action_type: actionType,
                    items: activeItems,
                    total_quantity: activeItems.reduce((sum, i) => sum + i.quantity, 0),
                    created_by: giverInfo.giverName2 || 'Hệ thống (Import Excel)'
                };

                return saveAssetHandoverHistory(payload).catch((err) => {
                    console.warn(`Lỗi lưu lịch sử cho ${emp.fullName}:`, err);
                });
            });

            void Promise.allSettled(savePromises).then(() => {
                onBatchCompleted?.();
            });

            success(`Đã mở cửa sổ in hàng loạt cho ${selectedEmployees.length} nhân viên (Tổng SL trang bị: ${totalEquipmentCount}).`);
        } catch (err: any) {
            error('Lỗi khi thực hiện in hàng loạt: ' + err.message);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth scroll="paper">
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1, borderBottom: '1px solid #e2e8f0' }}>
                <Box>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#003087', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <UploadFileIcon color="primary" /> In biên bản bàn giao BHLĐ hàng loạt từ Excel
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        Tải danh sách nhân viên & số lượng trang bị từ file Excel để xuất và in biên bản A4 tự động
                    </Typography>
                </Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                {/* ── Action Bar: Download template & Upload file ── */}
                <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#cbd5e1' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                                Quy trình thực hiện nhanh:
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem' }}>
                                1. Tải file mẫu &gt; 2. Nhập danh sách nhân viên &amp; số lượng BHLĐ &gt; 3. Chọn file để in hàng loạt
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1.5} alignItems="center">
                            <Button
                                variant="outlined"
                                color="primary"
                                startIcon={<TemplateExcelIcon size={18} />}
                                onClick={handleDownloadTemplate}
                                size="small"
                                sx={{ borderRadius: 1.5, fontWeight: 700, textTransform: 'none', whiteSpace: 'nowrap' }}
                            >
                                Tải file mẫu Excel
                            </Button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                style={{ display: 'none' }}
                                onChange={handleFileSelect}
                            />

                            <Button
                                variant="contained"
                                color="success"
                                startIcon={<CloudUploadCustomIcon size={18} />}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={loading}
                                size="small"
                                sx={{
                                    borderRadius: 1.5,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    whiteSpace: 'nowrap',
                                    bgcolor: '#16a34a',
                                    '&:hover': { bgcolor: '#15803d' }
                                }}
                            >
                                {loading ? <CircularProgress size={18} color="inherit" /> : 'Chọn file Excel'}
                            </Button>

                            {employees.length > 0 && (
                                <Tooltip title="Xóa danh sách hiện tại" arrow>
                                    <IconButton onClick={handleReset} size="small" color="error">
                                        <DeleteOutlineIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>
                    </Stack>
                </Paper>

                {/* ── Loaded Summary Banner ── */}
                {employees.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 1.5 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Chip
                                    icon={<CheckCircleOutlineIcon />}
                                    label={`File: ${fileName}`}
                                    variant="outlined"
                                    color="default"
                                    size="small"
                                />
                                <Chip
                                    label={`Tổng số: ${employees.length} NV`}
                                    color="primary"
                                    size="small"
                                    sx={{ fontWeight: 600 }}
                                />
                                <Chip
                                    label={`Đã chọn in: ${selectedEmployees.length} NV`}
                                    color="success"
                                    size="small"
                                    sx={{ fontWeight: 600 }}
                                />
                                <Chip
                                    label={`Tổng trang bị: ${totalEquipmentCount} món`}
                                    color="warning"
                                    size="small"
                                    sx={{ fontWeight: 600 }}
                                />
                            </Box>

                            <TextField
                                size="small"
                                placeholder="Tìm kiếm theo tên, mã NV..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ width: { xs: '100%', sm: 260 }, '& .MuiInputBase-input': { fontSize: '0.85rem', py: 0.6 } }}
                            />
                        </Stack>

                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 380, borderRadius: 2 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow sx={{ '& th': { bgcolor: '#f1f5f9', fontWeight: 700, fontSize: '0.8rem' } }}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                size="small"
                                                checked={isAllSelected}
                                                indeterminate={isIndeterminate}
                                                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ width: 50, textAlign: 'center' }}>STT</TableCell>
                                        <TableCell sx={{ width: 100 }}>Mã NV</TableCell>
                                        <TableCell sx={{ minWidth: 160 }}>Họ và tên</TableCell>
                                        <TableCell sx={{ minWidth: 160 }}>Chức vụ</TableCell>
                                        <TableCell sx={{ minWidth: 180 }}>Đơn vị</TableCell>
                                        <TableCell sx={{ width: 110, textAlign: 'center' }}>Size (Áo / Giày)</TableCell>
                                        <TableCell sx={{ minWidth: 200 }}>Trang bị nhận (SL &gt; 0)</TableCell>
                                        <TableCell sx={{ width: 80, textAlign: 'center' }}>Tổng SL</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredEmployees.map((emp) => {
                                        const assignedItems = emp.items.filter(i => i.quantity > 0);
                                        return (
                                            <TableRow
                                                key={emp.id}
                                                hover
                                                selected={emp.selected}
                                                sx={{ '&:last-child td': { borderBottom: 0 } }}
                                            >
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        size="small"
                                                        checked={emp.selected}
                                                        onChange={() => handleToggleSelect(emp.id)}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center', fontSize: '0.8rem' }}>{emp.stt}</TableCell>
                                                <TableCell sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#003087' }}>{emp.employeeId || '-'}</TableCell>
                                                <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase' }}>{emp.fullName}</TableCell>
                                                <TableCell sx={{ fontSize: '0.8rem', color: '#475569' }}>{emp.jobTitle}</TableCell>
                                                <TableCell sx={{ fontSize: '0.8rem', color: '#475569' }}>{emp.department}</TableCell>
                                                <TableCell sx={{ textAlign: 'center', fontSize: '0.78rem' }}>
                                                    {emp.uniformSize ? `Áo: ${emp.uniformSize}` : ''}
                                                    {emp.uniformSize && emp.shoeSize ? ' | ' : ''}
                                                    {emp.shoeSize ? `Giày: ${emp.shoeSize}` : ''}
                                                    {!emp.uniformSize && !emp.shoeSize ? '-' : ''}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '0.75rem' }}>
                                                    {assignedItems.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                                            {assignedItems.map((item, idx) => (
                                                                <Chip
                                                                    key={idx}
                                                                    label={`${item.name}: ${item.quantity}`}
                                                                    size="small"
                                                                    variant="outlined"
                                                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                                            Không có trang bị nào
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ textAlign: 'center', fontWeight: 700, fontSize: '0.85rem' }}>
                                                    {emp.totalQuantity}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                ) : (
                    <Box sx={{ p: 4, textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <UploadFileIcon sx={{ fontSize: 50, color: '#94a3b8', mb: 1.5 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#334155' }}>
                            Chưa có file Excel nào được tải lên
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460, mx: 'auto', mt: 0.5 }}>
                            Nhấn nút <b>"Tải file mẫu Excel"</b> ở trên để xem định dạng chuẩn, sau đó nhấn <b>"Chọn file Excel"</b> để import danh sách và in hàng loạt.
                        </Typography>
                    </Box>
                )}

                <Alert severity="info" sx={{ mt: 2, fontSize: '0.82rem' }}>
                    <b>Lưu ý khi in hàng loạt:</b> Mỗi nhân viên sẽ tự động được tạo thành 1 trang A4 hoàn chỉnh (có phân trang ngắt trang riêng). Khi cửa sổ in mở ra, bạn có thể chọn <b>"Save as PDF"</b> để xuất 1 file PDF chứa toàn bộ biên bản, hoặc chọn máy in để in ra giấy.
                </Alert>
            </DialogContent>

            <DialogActions sx={{ p: 2.5, px: 3, borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
                <Button onClick={onClose} color="inherit" sx={{ fontWeight: 600, textTransform: 'none' }}>
                    Đóng
                </Button>

                <Stack direction="row" spacing={1.5}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<PrinterModernIcon size={18} color="#ffffff" />}
                        disabled={selectedEmployees.length === 0}
                        onClick={handlePrintBatch}
                        sx={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            fontWeight: 700,
                            textTransform: 'none',
                            px: 3,
                            py: 1,
                            borderRadius: 1.5,
                            boxShadow: '0 4px 12px rgba(37,99,235,0.2)'
                        }}
                    >
                        In hàng loạt ({selectedEmployees.length} biên bản)
                    </Button>
                </Stack>
            </DialogActions>
        </Dialog>
    );
};
