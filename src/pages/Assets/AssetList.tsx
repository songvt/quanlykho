import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, IconButton, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Stack,
    Checkbox, TablePagination, useMediaQuery, useTheme, Chip, Divider, Autocomplete, Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import UndoIcon from '@mui/icons-material/Undo';
import TransferWithinAStationIcon from '@mui/icons-material/TransferWithinAStation';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';

import { AppButton } from '../../components/Common/AppButton';
import { fetchAssets, deleteAsset, importAssets, updateAsset } from '../../store/slices/assetsSlice';
import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import { useNotification } from '../../contexts/NotificationContext';
import { readAssetExcelFile, generateAssetTemplate, exportAssetReport } from '../../utils/excelUtils';
import type { RootState, AppDispatch } from '../../store';
import type { Asset } from '../../types';
import TableSkeleton from '../../components/Common/TableSkeleton';
import AssetHandoverPrint from './AssetHandoverPrint';

const AssetList = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    const { items: assets, status } = useSelector((state: RootState) => state.assets);
    const { items: hrProfiles, status: hrProfilesStatus } = useSelector((state: RootState) => state.hrProfiles);
    const { profile } = useSelector((state: RootState) => state.auth);
    const { success, error: notifyError } = useNotification();

    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    
    const [actionModal, setActionModal] = useState<{
        open: boolean;
        type: 'allocate' | 'revoke' | 'transfer' | null;
        assetIds: string[];
    }>({ open: false, type: null, assetIds: [] });
    
    const [employeeName, setEmployeeName] = useState('');
    const [employeeCode, setEmployeeCode] = useState('');
    const [department, setDepartment] = useState('');

    const [handoverPrint, setHandoverPrint] = useState<{
        open: boolean;
        type: 'allocate' | 'revoke' | 'transfer' | null;
        assets: Asset[];
        receiverName: string;
        receiverCode: string;
        receiverDept: string;
        receiverTitle: string;
    }>({ open: false, type: null, assets: [], receiverName: '', receiverCode: '', receiverDept: '', receiverTitle: '' });

    const [editStatusModal, setEditStatusModal] = useState<{
        open: boolean;
        assetId: string;
        status: string;
        description: string;
    }>({ open: false, assetId: '', status: '', description: '' });

    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: string }>({ open: false, id: '' });
    const [searchEmployee, setSearchEmployee] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');


    useEffect(() => {
        if (status === 'idle') {
            dispatch(fetchAssets());
        }
        if (hrProfilesStatus === 'idle') {
            dispatch(fetchHRProfiles());
        }
    }, [status, hrProfilesStatus, dispatch]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(assets.map(a => a.id));
        else setSelectedIds([]);
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) setSelectedIds(prev => [...prev, id]);
        else setSelectedIds(prev => prev.filter(item => item !== id));
    };

    const filteredAssets = useMemo(() => {
        let list = assets;
        
        if (categoryFilter === 'ccdc') {
            list = list.filter(a => {
                const group = (a.asset_group || '').toLowerCase();
                const type = (a.asset_type || '').toLowerCase();
                return group.includes('ccdc') || type.includes('ccdc');
            });
        } else if (categoryFilter === 'tbvp') {
            list = list.filter(a => {
                const group = (a.asset_group || '').toLowerCase();
                const type = (a.asset_type || '').toLowerCase();
                return group.includes('tbvp') || type.includes('tbvp');
            });
        }

        if (!searchEmployee.trim()) return list;
        const s = searchEmployee.toLowerCase();
        return list.filter(a => 
            (a.user_employee_name || '').toLowerCase().includes(s) ||
            (a.manager_name || '').toLowerCase().includes(s) ||
            (a.asset_name || '').toLowerCase().includes(s) ||
            (a.status || '').toLowerCase().includes(s) ||
            (a.asset_code || '').toLowerCase().includes(s)
        );
    }, [assets, searchEmployee, categoryFilter]);

    const handlePrintByEmployee = () => {
        if (!searchEmployee.trim()) {
            notifyError('Vui lòng nhập tên nhân viên.');
            return;
        }
        setHandoverPrint({
            open: true,
            type: 'allocate', // Default to handover style
            assets: filteredAssets,
            receiverName: searchEmployee.trim(),
            receiverCode: filteredAssets[0]?.user_employee_code || '',
            receiverDept: filteredAssets[0]?.location_name || '',
            receiverTitle: filteredAssets[0]?.user_type || '',
        });
    };

    const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                // readAssetExcelFile auto-detects header row (works with both template and custom files)
                const data = await readAssetExcelFile(e.target.files[0]);

                const parseBool = (v: any) => {
                    if (v === true || String(v).toUpperCase() === 'TRUE' || v === 1) return true;
                    return false;
                };
                const parseNum = (v: any) => v !== undefined && v !== null && v !== '' ? Number(v) : undefined;
                const parseStr = (v: any) => v !== undefined && v !== null && String(v).trim() !== '' ? String(v).trim() : undefined;

                // Convert any date format to ISO yyyy-mm-dd for Supabase
                const parseExcelDate = (v: any): string | undefined => {
                    if (!v && v !== 0) return undefined;
                    // Already a JS Date object (ExcelJS parsed it correctly)
                    if (v instanceof Date) {
                        if (isNaN(v.getTime())) return undefined;
                        return v.toISOString().split('T')[0];
                    }
                    // Excel serial number (e.g. 46141)
                    if (typeof v === 'number') {
                        // Excel epoch: Jan 1, 1900 = 1, with leap year bug (day 60 = Feb 29, 1900 never existed)
                        const d = new Date(Math.round((v - 25569) * 86400 * 1000));
                        if (isNaN(d.getTime())) return undefined;
                        return d.toISOString().split('T')[0];
                    }
                    // String format dd/mm/yyyy or yyyy-mm-dd
                    const s = String(v).trim();
                    if (!s) return undefined;
                    // dd/mm/yyyy
                    const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (dmyMatch) {
                        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
                    }
                    // yyyy-mm-dd already
                    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
                    // Try generic parse
                    const parsed = new Date(s);
                    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
                    return undefined;
                };


                const mappedData = data.map((row: any) => ({
                    asset_code:               parseStr(row['Mã tài sản']),
                    asset_name:               parseStr(row['Tên tài sản']),
                    asset_type_code:          parseStr(row['Mã loại tài sản']),
                    asset_type:               parseStr(row['Loại tài sản']),
                    asset_group:              parseStr(row['Nhóm tài sản']),
                    asset_set:                parseStr(row['Bộ tài sản']),
                    quantity:                 parseNum(row['Số lượng']) ?? 1,
                    unit:                     parseStr(row['Đơn vị tính']),
                    unit_price:               parseNum(row['Đơn giá']),
                    total_value:              parseNum(row['Giá trị']),
                    status:                   parseStr(row['Tình trạng']) || 'Mới',
                    manager_code:             parseStr(row['Mã NQL']),
                    manager_name:             parseStr(row['Người quản lý']),
                    management_unit_code:     parseStr(row['Mã ĐVQL']),
                    management_unit_name:     parseStr(row['Đơn vị quản lý']),
                    location_code:            parseStr(row['Mã vị trí TS']),
                    location_name:            parseStr(row['Vị trí tài sản']),
                    receipt_date:             parseExcelDate(row['Ngày nhận']),
                    user_type:                parseStr(row['Đối tượng sử dụng']),
                    user_employee_code:       parseStr(row['Mã nhân viên SD']),
                    user_employee_name:       parseStr(row['Nhân viên sử dụng']),
                    user_department_code:     parseStr(row['Mã phòng ban SD']),
                    user_department_name:     parseStr(row['Phòng ban sử dụng']),
                    representative_code:      parseStr(row['Mã người ĐD']),
                    representative_name:      parseStr(row['Người đại diện']),
                    first_use_date:           parseExcelDate(row['Lần đầu sử dụng']),
                    serial_number:            parseStr(row['Số serial']),
                    specifications:           parseStr(row['Quy cách tài sản']),
                    attached_components:      parseStr(row['Linh kiện đính kèm']),
                    maintenance_content:      parseStr(row['Nội dung bảo dưỡng']),
                    maintenance_basis:        parseStr(row['Xác định BD theo']),
                    maintenance_start_time:   parseExcelDate(row['Thời điểm bắt đầu BD']),
                    maintenance_cycle:        parseStr(row['Bảo dưỡng lặp lại theo']),
                    maintenance_start_capacity: parseNum(row['Công suất bắt đầu BD']),
                    next_maintenance_after:   parseStr(row['BD lại sau']),
                    origin:                   parseStr(row['Nguồn gốc']),
                    supplier_code:            parseStr(row['Mã NCC']),
                    supplier_name:            parseStr(row['Nhà cung cấp']),
                    purchase_date:            parseExcelDate(row['Ngày mua']),
                    contract_number:          parseStr(row['Số hợp đồng']),
                    notes:                    parseStr(row['Ghi chú']),
                    depreciation_value:       parseNum(row['Giá trị tính KH/PB']),
                    depreciation_period:      parseStr(row['Kỳ KH/PB']),
                    depreciation_start_date:  parseExcelDate(row['Ngày bắt đầu tính KH/PB']),
                    accumulated_depreciation: parseNum(row['KH/PB lũy kế']),
                    remaining_time:           parseStr(row['Thời gian còn lại']),
                    remaining_value:          parseNum(row['Giá trị còn lại']),
                    is_fixed_asset:           parseBool(row['Là tài sản cố định']),
                    brought_outside:          parseBool(row['Mang ra ngoài']),
                    is_shared_asset:          parseBool(row['Là tài sản dùng chung']),
                    asset_management_type:    parseStr(row['Loại hình quản lý TS']),
                    is_rented_asset:          parseBool(row['Là TS thuê ngoài']),
                    rented_type:              parseStr(row['Loại thuê']),
                })).filter((a: any) => a.asset_code && a.asset_name);

                // Check for duplicates in the uploaded excel file itself
                const codeCounts = new Map<string, number>();
                const duplicatesInFile: string[] = [];
                for (const item of mappedData) {
                    if (item.asset_code) {
                        const count = codeCounts.get(item.asset_code) || 0;
                        if (count === 1) {
                            duplicatesInFile.push(item.asset_code);
                        }
                        codeCounts.set(item.asset_code, count + 1);
                    }
                }

                if (duplicatesInFile.length > 0) {
                    notifyError(`File import chứa các mã tài sản bị trùng lặp: ${duplicatesInFile.slice(0, 10).join(', ')}${duplicatesInFile.length > 10 ? '...' : ''}. Vui lòng sửa lại trước khi nhập.`);
                    e.target.value = '';
                    return;
                }

                // 1. Filter out duplicates (check if asset_code already exists in current state)
                const existingCodes = new Set(assets.map(a => a.asset_code));
                const newAssets = mappedData.filter(a => !existingCodes.has(a.asset_code as string));
                const duplicateCount = mappedData.length - newAssets.length;

                if (newAssets.length > 0) {
                    await dispatch(importAssets({ assets: newAssets as Omit<Asset, 'id'>[], performedBy: profile?.full_name })).unwrap();
                    let msg = `Đã nhập thành công ${newAssets.length} tài sản mới!`;
                    if (duplicateCount > 0) {
                        msg += ` (Đã bỏ qua ${duplicateCount} mã đã tồn tại)`;
                    }
                    success(msg);
                } else {
                    notifyError(duplicateCount > 0 
                        ? `Tất cả ${duplicateCount} tài sản trong file đều đã tồn tại trong hệ thống.` 
                        : `Không tìm thấy dữ liệu hợp lệ. Đảm bảo file có cột "Mã tài sản" và "Tên tài sản".`
                    );
                }
            } catch (err: any) {
                notifyError(`Lỗi khi nhập: ${err.message}`);
            }
            e.target.value = '';
        }
    };


    const handleActionSubmit = async () => {
        try {
            const updates = selectedIds.map(id => {
                let statusUpdate = '';
                if (actionModal.type === 'allocate') statusUpdate = 'Đã cấp phát';
                if (actionModal.type === 'revoke') statusUpdate = 'Chưa sử dụng';
                if (actionModal.type === 'transfer') statusUpdate = 'Đã điều chuyển';

                return dispatch(updateAsset({
                    updatedAsset: {
                        id,
                        user_employee_name: actionModal.type === 'revoke' ? '' : employeeName,
                        user_employee_code: actionModal.type === 'revoke' ? '' : employeeCode,
                        user_department_name: actionModal.type === 'revoke' ? '' : department,
                        status: statusUpdate
                    },
                    performedBy: profile?.full_name
                })).unwrap();
            });

            await Promise.all(updates);
            success(`Đã xử lý thành công ${selectedIds.length} tài sản!`);

            // Open handover print dialog
            const selectedAssets = assets.filter(a => selectedIds.includes(a.id));
            setHandoverPrint({
                open: true,
                type: actionModal.type,
                assets: selectedAssets,
                receiverName: actionModal.type === 'revoke' ? 'Kho ACT' : employeeName,
                receiverCode: actionModal.type === 'revoke' ? '' : employeeCode,
                receiverDept: actionModal.type === 'revoke' ? '' : department,
                receiverTitle: '', // Placeholder or we can add a state for this if needed
            });

            setActionModal({ open: false, type: null, assetIds: [] });
            setSelectedIds([]);
            setEmployeeName(''); setEmployeeCode(''); setDepartment('');
        } catch (err: any) {
            notifyError('Có lỗi xảy ra: ' + err.message);
        }
    };

    const handleEditStatusSubmit = async () => {
        if (editStatusModal.status === 'Hỏng' && !editStatusModal.description.trim()) {
            notifyError('Vui lòng nhập mô tả chi tiết tình trạng khi báo hỏng!');
            return;
        }

        try {
            await dispatch(updateAsset({
                updatedAsset: {
                    id: editStatusModal.assetId,
                    status: editStatusModal.status,
                    status_description: editStatusModal.description
                },
                performedBy: profile?.full_name
            })).unwrap();
            success('Đã cập nhật tình trạng tài sản!');
            setEditStatusModal({ open: false, assetId: '', status: '', description: '' });
        } catch (err: any) {
            notifyError('Lỗi cập nhật: ' + err.message);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm.id) return;
        try {
            await dispatch(deleteAsset({ id: deleteConfirm.id, performedBy: profile?.full_name })).unwrap();
            success('Đã xóa tài sản thành công!');
            setDeleteConfirm({ open: false, id: '' });
        } catch (err: any) {
            notifyError('Lỗi khi xóa: ' + err.message);
        }
    };

    // Mobile status chip color helper
    const getStatusColor = (status: string) => {
        if (!status) return 'default';
        if (status.includes('Hỏng') || status.includes('Mất')) return 'error';
        if (status.includes('Đã cấp phát') || status.includes('Đang sử dụng')) return 'success';
        if (status.includes('Điều chuyển')) return 'warning';
        return 'info';
    };

    return (

        <Box p={{ xs: 1, sm: 3 }}>
            {/* Header */}
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" mb={2} spacing={1.5}>
                <Typography 
                    variant={isMobile ? 'h5' : 'h4'}
                    fontWeight={900} 
                    color="primary"
                    sx={{ 
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background: 'linear-gradient(45deg, #1e3a8a 30%, #3b82f6 90%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    QUẢN LÝ TÀI SẢN
                </Typography>
                
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                    <AppButton
                        variant="outlined"
                        component="label"
                        icon={<CloudUploadIcon />}
                        title="Nhập Excel"
                    >
                        <input type="file" hidden accept=".xlsx, .xls" onChange={handleImportExcel} />
                    </AppButton>
                    <AppButton
                        variant="outlined"
                        color="success"
                        icon={<FileDownloadIcon />}
                        onClick={() => generateAssetTemplate()}
                        title="Tải mẫu Excel"
                    />
                    <AppButton
                        variant="outlined"
                        color="info"
                        icon={<FileDownloadIcon />}
                        onClick={() => exportAssetReport(filteredAssets, profile?.full_name || 'Admin')}
                        title="Xuất Excel"
                    />
                    {selectedIds.length > 0 && (
                        <>
                            <AppButton 
                                variant="contained" 
                                color="info" 
                                icon={<AssignmentIndIcon />}
                                onClick={() => setActionModal({ open: true, type: 'allocate', assetIds: selectedIds })}
                                title="Cấp phát"
                            />
                            <AppButton 
                                variant="contained" 
                                color="warning" 
                                icon={<UndoIcon />}
                                onClick={() => setActionModal({ open: true, type: 'revoke', assetIds: selectedIds })}
                                title="Thu hồi"
                            />
                            <AppButton 
                                variant="contained" 
                                color="secondary" 
                                icon={<TransferWithinAStationIcon />}
                                onClick={() => setActionModal({ open: true, type: 'transfer', assetIds: selectedIds })}
                                title="Điều chuyển"
                            />
                        </>
                    )}
                    <AppButton
                        variant="contained"
                        color="primary"
                        icon={<PrintIcon />}
                        onClick={handlePrintByEmployee}
                        disabled={!searchEmployee.trim()}
                        title="In biên bản (Nhân viên)"
                    />
                </Stack>
            </Stack>

            {/* Search + selection info */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} mb={2} alignItems={{ sm: 'center' }}>
                <TextField
                    placeholder="Tìm theo tên TS, tình trạng, nhân viên..."
                    size="small"
                    fullWidth={isMobile}
                    sx={{ width: isMobile ? '100%' : 350, bgcolor: 'white' }}
                    value={searchEmployee}
                    onChange={(e) => setSearchEmployee(e.target.value)}
                />
                <TextField
                    select
                    size="small"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    SelectProps={{ native: true }}
                    sx={{ width: isMobile ? '100%' : 220, bgcolor: 'white' }}
                >
                    <option value="all">Tất cả danh mục (CCDC & TBVP)</option>
                    <option value="ccdc">Công cụ dụng cụ (CCDC)</option>
                    <option value="tbvp">Thiết bị văn phòng (TBVP)</option>
                </TextField>
                {selectedIds.length > 0 && (
                    <Chip 
                        label={`Đã chọn: ${selectedIds.length}`} 
                        color="primary" 
                        size="small" 
                        onDelete={() => setSelectedIds([])}
                    />
                )}
            </Stack>

            {status === 'loading' ? (
                <TableSkeleton columns={7} rows={10} />
            ) : isMobile ? (
                /* ── MOBILE: Card list ── */
                <Box>
                    {/* Select all bar */}
                    <Paper sx={{ px: 2, py: 1, mb: 1, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Checkbox
                            checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length}
                            indeterminate={selectedIds.length > 0 && selectedIds.length < filteredAssets.length}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            size="small"
                        />
                        <Typography variant="body2" color="text.secondary">
                            Chọn tất cả ({filteredAssets.length} tài sản)
                        </Typography>
                    </Paper>

                    <Stack spacing={1.5}>
                        {filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((asset) => (
                            <Paper
                                key={asset.id}
                                elevation={selectedIds.includes(asset.id) ? 3 : 1}
                                sx={{
                                    borderRadius: 3,
                                    border: selectedIds.includes(asset.id) ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                    overflow: 'hidden',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {/* Card header */}
                                <Box
                                    sx={{
                                        px: 2, py: 1,
                                        bgcolor: selectedIds.includes(asset.id) ? '#eff6ff' : '#f8fafc',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}
                                >
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <Checkbox
                                            checked={selectedIds.includes(asset.id)}
                                            onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                                            size="small"
                                        />
                                        <Typography variant="body2" fontWeight={700} color="primary.main">
                                            {asset.asset_code}
                                        </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={0.5}>
                                        <IconButton
                                            size="small"
                                            color="primary"
                                            onClick={() => setEditStatusModal({
                                                open: true,
                                                assetId: asset.id,
                                                status: asset.status || '',
                                                description: asset.status_description || ''
                                            })}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => setDeleteConfirm({ open: true, id: asset.id })}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                </Box>
                                <Divider />
                                {/* Card body */}
                                <Box sx={{ px: 2, py: 1.5 }}>
                                    <Typography variant="body1" fontWeight={600} sx={{ mb: 1, lineHeight: 1.3 }}>
                                        {asset.asset_name}
                                    </Typography>
                                    <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
                                        <Chip
                                            label={asset.status || 'Không rõ'}
                                            size="small"
                                            color={getStatusColor(asset.status || '') as any}
                                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                        />
                                        {asset.user_employee_name && (
                                            <Typography variant="caption" color="text.secondary">
                                                👤 {asset.user_employee_name}
                                            </Typography>
                                        )}
                                        {asset.user_department_name && (
                                            <Typography variant="caption" color="text.secondary">
                                                🏢 {asset.user_department_name}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Box>
                            </Paper>
                        ))}
                        {filteredAssets.length === 0 && (
                            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }}>
                                <Typography color="text.secondary">Chưa có tài sản nào.</Typography>
                            </Paper>
                        )}
                    </Stack>

                    <TablePagination
                        component="div"
                        count={filteredAssets.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        rowsPerPageOptions={[10, 25, 50]}
                        labelRowsPerPage=""
                        sx={{ '.MuiTablePagination-selectLabel': { display: 'none' } }}
                    />
                </Box>
            ) : (
                /* ── DESKTOP: Table ── */
                <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
                    <Table size="small">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={filteredAssets.length > 0 && selectedIds.length === filteredAssets.length}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </TableCell>
                                <TableCell><b>MÃ TÀI SẢN</b></TableCell>
                                <TableCell><b>TÊN TÀI SẢN</b></TableCell>
                                <TableCell><b>TÌNH TRẠNG</b></TableCell>
                                <TableCell><b>NGƯỜI SỬ DỤNG</b></TableCell>
                                <TableCell><b>PHÒNG BAN</b></TableCell>
                                <TableCell align="center"><b>THAO TÁC</b></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((asset) => (
                                <TableRow key={asset.id} hover selected={selectedIds.includes(asset.id)}>
                                    <TableCell padding="checkbox">
                                        <Checkbox
                                            checked={selectedIds.includes(asset.id)}
                                            onChange={(e) => handleSelectOne(asset.id, e.target.checked)}
                                        />
                                    </TableCell>
                                    <TableCell>{asset.asset_code}</TableCell>
                                    <TableCell>{asset.asset_name}</TableCell>
                                    <TableCell>{asset.status}</TableCell>
                                    <TableCell>{asset.user_employee_name || '-'}</TableCell>
                                    <TableCell>{asset.user_department_name || '-'}</TableCell>
                                    <TableCell align="center">
                                        <Stack direction="row" spacing={0.5} justifyContent="center">
                                            <IconButton 
                                                size="small" 
                                                color="primary" 
                                                onClick={() => setEditStatusModal({ 
                                                    open: true, 
                                                    assetId: asset.id, 
                                                    status: asset.status || '',
                                                    description: asset.status_description || ''
                                                })}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton 
                                                size="small" 
                                                color="error" 
                                                onClick={() => setDeleteConfirm({ open: true, id: asset.id })}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {assets.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>Chưa có tài sản nào.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                    <TablePagination
                        component="div"
                        count={filteredAssets.length}
                        rowsPerPage={rowsPerPage}
                        page={page}
                        onPageChange={(_, p) => setPage(p)}
                        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                        labelRowsPerPage="Số dòng:"
                    />
                </TableContainer>
            )}

            {/* Action Modal */}
            <Dialog open={actionModal.open} onClose={() => setActionModal({ ...actionModal, open: false })} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {actionModal.type === 'allocate' && 'Cấp phát tài sản'}
                    {actionModal.type === 'revoke' && 'Thu hồi tài sản'}
                    {actionModal.type === 'transfer' && 'Điều chuyển tài sản'}
                </DialogTitle>
                <DialogContent>
                    <Typography mb={2}>Đang thao tác trên {actionModal.assetIds.length} tài sản.</Typography>
                    {actionModal.type !== 'revoke' && (
                        <Stack spacing={2} mt={1}>
                            <Autocomplete
                                options={hrProfiles}
                                getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                                value={hrProfiles.find(p => p.id === employeeCode) || null}
                                onChange={(_, newVal) => {
                                    if (newVal) {
                                        setEmployeeCode(newVal.id);
                                        setEmployeeName(newVal.full_name);
                                        setDepartment(newVal.department || '');
                                    } else {
                                        setEmployeeCode('');
                                        setEmployeeName('');
                                        setDepartment('');
                                    }
                                }}
                                loading={hrProfilesStatus === 'loading'}
                                renderInput={(params) => (
                                    <TextField 
                                        {...params} 
                                        label="Chọn nhân viên nhận" 
                                        size="small" 
                                        placeholder="Gõ tên hoặc mã nhân viên..."
                                    />
                                )}
                            />
                            <TextField 
                                label="Mã nhân viên nhận" 
                                fullWidth 
                                size="small"
                                value={employeeCode}
                                onChange={(e) => setEmployeeCode(e.target.value)}
                            />
                            <TextField 
                                label="Tên nhân viên nhận" 
                                fullWidth 
                                size="small"
                                value={employeeName}
                                onChange={(e) => setEmployeeName(e.target.value)}
                            />
                            <TextField 
                                label="Phòng ban" 
                                fullWidth 
                                size="small"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                            />
                        </Stack>
                    )}
                    {actionModal.type === 'revoke' && (
                        <Typography color="error">Bạn có chắc chắn muốn thu hồi tài sản về kho?</Typography>
                    )}
                </DialogContent>
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setActionModal({ ...actionModal, open: false })} icon={<CloseIcon />} title="Hủy" />
                    <AppButton variant="contained" onClick={handleActionSubmit} icon={<CheckIcon />} title="Xác nhận" />
                </DialogActions>
            </Dialog>

            {/* Edit Status Modal */}
            <Dialog open={editStatusModal.open} onClose={() => setEditStatusModal({ ...editStatusModal, open: false })} maxWidth="xs" fullWidth>
                <DialogTitle>Sửa tình trạng tài sản</DialogTitle>
                <DialogContent>
                        <TextField
                            select
                            margin="dense"
                            label="Tình trạng"
                            fullWidth
                            size="small"
                            value={editStatusModal.status}
                            onChange={(e) => setEditStatusModal({ ...editStatusModal, status: e.target.value })}
                            SelectProps={{ native: true }}
                            sx={{ mt: 1 }}
                        >
                            <option value="Mới">Mới</option>
                            <option value="Đang sử dụng">Đang sử dụng</option>
                            <option value="Hỏng">Hỏng</option>
                            <option value="Mất">Mất</option>
                            <option value="Thanh lý">Thanh lý</option>
                        </TextField>

                        <TextField
                            margin="dense"
                            label="Mô tả chi tiết tình trạng"
                            fullWidth
                            multiline
                            rows={3}
                            size="small"
                            value={editStatusModal.description}
                            onChange={(e) => setEditStatusModal({ ...editStatusModal, description: e.target.value })}
                            required={editStatusModal.status === 'Hỏng'}
                            error={editStatusModal.status === 'Hỏng' && !editStatusModal.description.trim()}
                            helperText={editStatusModal.status === 'Hỏng' && !editStatusModal.description.trim() ? 'Bắt buộc nhập lý do/mô tả khi hỏng' : ''}
                            sx={{ mt: 2 }}
                        />
                </DialogContent>
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setEditStatusModal({ ...editStatusModal, open: false })} icon={<CloseIcon />} title="Hủy" />
                    <AppButton variant="contained" onClick={handleEditStatusSubmit} icon={<SaveIcon />} title="Lưu" />
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, id: '' })} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ color: 'error.main', fontWeight: 700 }}>Xác nhận xóa</DialogTitle>
                <DialogContent>
                    <Typography>Bạn có chắc chắn muốn xóa tài sản này khỏi hệ thống? Thao tác này không thể hoàn tác.</Typography>
                </DialogContent>
                <DialogActions sx={{ gap: 1 }}>
                    <AppButton onClick={() => setDeleteConfirm({ open: false, id: '' })} icon={<CloseIcon />} title="Hủy" />
                    <AppButton variant="contained" color="error" onClick={handleDeleteConfirm} icon={<DeleteIcon />} title="Xác nhận xóa" />
                </DialogActions>
            </Dialog>

            {/* Handover Minutes Print Dialog */}

            <AssetHandoverPrint
                open={handoverPrint.open}
                onClose={() => setHandoverPrint(prev => ({ ...prev, open: false }))}
                actionType={handoverPrint.type}
                assets={handoverPrint.assets}
                handoverInfo={{
                    giverName: 'NGUYỄN HẢI SƠN',
                    giverTitle: 'GĐ TTKV BSG',
                    giverPhone: '0988855186',
                    giverName2: 'VÕ THANH SONG',
                    giverTitle2: 'NV QLTS-KHO',
                    giverPhone2: '0988229082',
                    receiverName: handoverPrint.receiverName,
                    receiverDept: handoverPrint.receiverDept,
                    receiverTitle: handoverPrint.receiverTitle,
                }}
            />
        </Box>
    );
};

export default AssetList;
