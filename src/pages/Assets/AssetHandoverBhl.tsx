import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Box, Paper, Typography, Button, TextField, Grid, Stack, Divider,
    Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Autocomplete, IconButton, Card, CardContent, InputAdornment, useTheme, useMediaQuery, Tooltip,
    CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import PhoneIcon from '@mui/icons-material/Phone';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import HistoryIcon from '@mui/icons-material/History';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import AddIcon from '@mui/icons-material/Add';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import {
    ExcelBrandIcon,
    TemplateExcelIcon,
    CloudUploadCustomIcon,
    PrinterModernIcon,
    ViewCustomIcon,
    TrashCustomIcon
} from '../../components/Common/BrandIcons';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

import { fetchAssets } from '../../store/slices/assetsSlice';
import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import { useNotification } from '../../contexts/NotificationContext';
import type { RootState, AppDispatch } from '../../store';
import type { Asset, HRProfile } from '../../types';
import { formatPhone } from '../../utils/format';
import { exportEmployeeHandoverSummary, exportHandoverHistory } from '../../utils/excelUtils';
import { saveAssetHandoverHistory } from '../../services/assetHandoverHistory';
import { GoogleSheetService } from '../../services/GoogleSheetService';
import { getDefaultSecondGiver, findGiverProfile, filterGiverProfiles } from '../../utils/assetHandoverGiver';
import { createDefaultBhlItems, formatBhlItemNote, splitBhlItemNote, type BhlItem } from '../../utils/assetBhlItems';
import {
    createCustomHandoverAsset,
    prepareDefaultAssetsToSave,
    restoreDefaultAssetsFromHistory,
    type DefaultHandoverAsset
} from '../../utils/assetHandoverDefault';
import { AssetHandoverBatchModal } from './AssetHandoverBatchModal';
import { generateBhlHandoverTemplate } from '../../utils/assetBhlBatch';

const AssetHandoverBhl: React.FC = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
    const dispatch = useDispatch<AppDispatch>();
    const { success, error } = useNotification();
    const printRef = useRef<HTMLDivElement>(null);
    const hasInitializedSecondGiver = useRef(false);

    // Redux State
    const { items: assets, status: assetStatus } = useSelector((state: RootState) => state.assets);
    const { items: hrProfiles, status: hrProfilesStatus } = useSelector((state: RootState) => state.hrProfiles);

    // Form Configurations
    const [selectedEmployee, setSelectedEmployee] = useState<HRProfile | null>(null);
    const [templateType, setTemplateType] = useState<'default' | 'bhl'>('bhl');
    const [actionType, setActionType] = useState<'allocate' | 'revoke' | 'transfer'>('allocate');

    // Receiver Information
    const [receiverName, setReceiverName] = useState('');
    const [receiverTitle, setReceiverTitle] = useState('');
    const [receiverDept, setReceiverDept] = useState('');

    // Giver Information
    const [giverInfo, setGiverInfo] = useState({
        giverName: 'NGUYỄN HẢI SƠN',
        giverTitle: 'GĐ TTKV BSG',
        giverPhone: '0988855186',
        ...getDefaultSecondGiver([]),
    });

    // 12 Safety Protective Equipment (CCDC-BHLĐ) Items State (including Dép rọ)
    const [bhlItems, setBhlItems] = useState<BhlItem[]>(createDefaultBhlItems());

    // Default template assets state (supports employee assigned assets and manual assets outside catalog)
    const [defaultAssets, setDefaultAssets] = useState<DefaultHandoverAsset[]>([]);
    const [addAssetDialogOpen, setAddAssetDialogOpen] = useState(false);
    const [selectedCatalogAsset, setSelectedCatalogAsset] = useState<Asset | null>(null);
    const [newAssetForm, setNewAssetForm] = useState({
        asset_code: '',
        asset_name: '',
        quantity: 1,
        asset_type: 'CCDC',
        serial_number: '',
        note: ''
    });

    // Batch import modal state
    const [batchModalOpen, setBatchModalOpen] = useState(false);
    const [isPrinting, setIsPrinting] = useState(false);
    const isPrintingRef = useRef(false);

    // History logs State
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historySearch, setHistorySearch] = useState('');
    const [reportStartDate, setReportStartDate] = useState('');
    const [reportEndDate, setReportEndDate] = useState('');

    const actionHistory = useMemo(
        () => history.filter(record => record.action_type === actionType),
        [history, actionType]
    );

    const filteredActionHistory = useMemo(() => {
        if (!historySearch.trim()) return actionHistory;
        const keyword = historySearch.trim().toLowerCase();
        return actionHistory.filter(h => {
            const name = (h.receiver_name || '').toLowerCase();
            const dept = (h.receiver_dept || '').toLowerCase();
            const d = new Date(h.created_at);
            let dateStr = '';
            let periodStr = '';
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const year = d.getFullYear();
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                dateStr = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                periodStr = `${month}/${year}`;
            }
            return name.includes(keyword) || dept.includes(keyword) || dateStr.includes(keyword) || periodStr.includes(keyword);
        });
    }, [actionHistory, historySearch]);

    const actionHistoryLabel = actionType === 'revoke'
        ? 'Lịch sử thu hồi'
        : actionType === 'transfer'
            ? 'Lịch sử điều chuyển'
            : 'Lịch sử bàn giao';

    const actionHistoryFileName = actionType === 'revoke'
        ? 'Lich_Su_Thu_Hoi_CCDC_BHLD'
        : actionType === 'transfer'
            ? 'Lich_Su_Dieu_Chuyen_CCDC_BHLD'
            : 'Lich_Su_Ban_Giao_CCDC_BHLD';

    const employeeSummary = useMemo(() => {
        const start = reportStartDate ? new Date(`${reportStartDate}T00:00:00`) : null;
        const end = reportEndDate ? new Date(`${reportEndDate}T23:59:59.999`) : null;
        const rows = new Map<string, { employeeName: string; department: string; equipmentName: string; allocated: number; revoked: number; transferred: number; total: number }>();

        history.forEach(record => {
            const createdAt = new Date(record.created_at);
            if ((start && createdAt < start) || (end && createdAt > end)) return;
            const employeeName = (record.receiver_name || 'Chưa xác định').trim();
            const department = (record.receiver_dept || '—').trim() || '—';
            const items = Array.isArray(record.items) ? record.items : [];
            const reportItems = items.length > 0 ? items : [{ name: 'Trang bị không xác định', quantity: record.total_quantity || 0 }];

            reportItems.forEach((item: any) => {
                const equipmentName = (item.name || item.asset_name || 'Trang bị không xác định').trim();
                const quantity = Number(item.quantity) || 0;
                const key = `${record.employee_id || ''}::${employeeName}::${department}::${equipmentName}`.toLocaleLowerCase('vi-VN');
                const summary = rows.get(key) || { employeeName, department, equipmentName, allocated: 0, revoked: 0, transferred: 0, total: 0 };
                if (record.action_type === 'revoke') summary.revoked += quantity;
                else if (record.action_type === 'transfer') summary.transferred += quantity;
                else summary.allocated += quantity;
                summary.total += quantity;
                rows.set(key, summary);
            });
        });

        return Array.from(rows.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'vi') || a.equipmentName.localeCompare(b.equipmentName, 'vi'));
    }, [history, reportStartDate, reportEndDate]);

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await fetch('/api/asset_handovers');
            if (res.ok) {
                const data = await res.json();
                setHistory(data || []);
            }
        } catch (err) {
            console.error('Lỗi lấy lịch sử:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const handleDeleteHistory = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa lịch sử bàn giao này không?')) return;
        try {
            const res = await fetch('/api/asset_handovers', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                success('Đã xóa lịch sử thành công.');
                setHistory(prev => prev.filter(h => h.id !== id));
            } else {
                error('Xóa lịch sử thất bại.');
            }
        } catch (err: any) {
            error('Lỗi khi xóa: ' + err.message);
        }
    };

    const handleExportHistory = async () => {
        try {
            await exportHandoverHistory(actionHistory, actionHistoryFileName, actionType);
            success('Xuất file Excel lịch sử thành công.');
        } catch (err: any) {
            error('Lỗi khi xuất Excel: ' + err.message);
        }
    };

    const handleExportEmployeeSummary = async () => {
        try {
            const periodLabel = `${reportStartDate ? `Từ ${new Date(`${reportStartDate}T00:00:00`).toLocaleDateString('vi-VN')}` : 'Từ đầu kỳ'}${reportEndDate ? ` đến ${new Date(`${reportEndDate}T00:00:00`).toLocaleDateString('vi-VN')}` : ' đến nay'}`;
            await exportEmployeeHandoverSummary(employeeSummary, 'Bao_Cao_Tong_Hop_CCDC_Theo_Nhan_Vien', periodLabel);
            success('Đã xuất báo cáo tổng hợp theo nhân viên.');
        } catch (err: any) {
            error('Lỗi khi xuất báo cáo: ' + err.message);
        }
    };

    const handleReprint = (h: any) => {
        setTemplateType(h.template_type);
        setActionType(h.action_type);
        setReceiverName(h.receiver_name);
        setReceiverTitle(h.receiver_title || '');
        setReceiverDept(h.receiver_dept || '');
        setGiverInfo(h.giver_info);
        
        if (h.template_type === 'bhl') {
            const defaultBhl = createDefaultBhlItems();
            const restored = defaultBhl.map(def => {
                const found = h.items.find((item: any) => item.name === def.name);
                if (found) {
                    return { ...def, quantity: found.quantity, serial: found.serial || '', note: found.note || '' };
                }
                return def;
            });
            setBhlItems(restored);
        } else if (h.template_type === 'default') {
            const restored = restoreDefaultAssetsFromHistory(h.items || []);
            setDefaultAssets(restored);
        }
        success('Đã tải lại biên bản lịch sử lên màn hình xem trước.');
    };

    const handleDownloadTemplate = async () => {
        try {
            await generateBhlHandoverTemplate();
            success('Đã tải xuống file mẫu import bàn giao BHLĐ.');
        } catch (err: any) {
            error('Lỗi khi tải file mẫu: ' + (err?.message || 'Không thể tạo file'));
        }
    };

    const handleSaveAndPrint = async () => {
        if (isPrintingRef.current || isPrinting) return;

        if (!receiverName) {
            error('Vui lòng nhập Họ tên bên nhận trước khi thực hiện!');
            return;
        }

        const printHtml = printRef.current?.innerHTML;
        if (!printHtml) {
            error('Không tìm thấy nội dung biên bản để in!');
            return;
        }

        isPrintingRef.current = true;
        setIsPrinting(true);

        try {
            const itemsToSave = templateType === 'default'
                ? prepareDefaultAssetsToSave(defaultAssets)
                : activeBhlItems.map(item => ({
                    ...item,
                    note: formatBhlItemNote(item, selectedEmployee?.uniform_size, giayShoeSize)
                }));

            const payload = {
                employee_id: selectedEmployee?.id || null,
                receiver_name: receiverName,
                receiver_title: receiverTitle,
                receiver_dept: receiverDept,
                giver_info: giverInfo,
                template_type: templateType,
                action_type: actionType,
                items: itemsToSave,
                total_quantity: totalQty,
                created_by: giverInfo.giverName2 || giverInfo.giverName || 'Hệ thống'
            };
            
            const savedHandover = await saveAssetHandoverHistory(payload);
            setHistory(prev => [savedHandover, ...prev]);

            // Ghi nhận bổ sung vào asset_logs cho từng tài sản để đồng bộ lịch sử
            try {
                for (const item of itemsToSave) {
                    await GoogleSheetService.saveAssetLog({
                        asset_code: (item as any).asset_code || 'NGOAI-DS',
                        asset_name: (item as any).asset_name || (item as any).name || 'Tài sản bàn giao',
                        action: actionType === 'revoke' ? 'Thu hồi (Biên bản)' : actionType === 'transfer' ? 'Điều chuyển (Biên bản)' : 'Bàn giao (Biên bản)',
                        employee_name: receiverName,
                        employee_code: selectedEmployee?.id || '',
                        department: receiverDept,
                        performed_by: giverInfo.giverName2 || giverInfo.giverName || 'Hệ thống',
                        details: `Biên bản ${templateType === 'default' ? 'TBVP-CCDC' : 'CCDC-BHLĐ'} (${item.quantity || 1} món)${(item as any).serial_number || (item as any).serial ? ` - Serial: ${(item as any).serial_number || (item as any).serial}` : ''}${(item as any).note ? ` - Ghi chú: ${(item as any).note}` : ''}${(item as any).is_custom ? ' [Ngoài danh sách]' : ''}`
                    }).catch(e => console.warn('Lỗi ghi asset_log phụ:', e));
                }
            } catch (logErr) {
                console.warn('Lỗi lưu log bổ sung:', logErr);
            }

            handlePrint();
        } catch (err) {
            console.error('Lỗi khi tự động lưu lịch sử:', err);
            error(err instanceof Error ? err.message : 'Không thể lưu lịch sử bàn giao. Vui lòng thử lại.');
        } finally {
            setTimeout(() => {
                isPrintingRef.current = false;
                setIsPrinting(false);
            }, 600);
        }
    };

    // Load necessary data
    useEffect(() => {
        if (assetStatus === 'idle') {
            dispatch(fetchAssets());
        }
        if (hrProfilesStatus === 'idle') {
            dispatch(fetchHRProfiles());
        }
    }, [dispatch, assetStatus, hrProfilesStatus]);

    useEffect(() => {
        if (hasInitializedSecondGiver.current || hrProfilesStatus !== 'succeeded') return;

        setGiverInfo((previous) => ({ ...previous, ...getDefaultSecondGiver(hrProfiles) }));
        hasInitializedSecondGiver.current = true;
    }, [hrProfiles, hrProfilesStatus]);

    const syncEmployeeAssets = useCallback((name: string): DefaultHandoverAsset[] => {
        if (!name) return [];
        return assets
            .filter(a => (a.user_employee_name || '').toLowerCase() === name.toLowerCase())
            .map(a => ({
                id: a.id || `sys-${a.asset_code}-${Math.random()}`,
                asset_code: a.asset_code || '',
                asset_name: a.asset_name || '',
                quantity: a.quantity || 1,
                asset_type: a.asset_type || '',
                serial_number: a.serial_number || '',
                note: '',
                is_custom: false
            }));
    }, [assets]);

    // Handle Employee selection changes
    const handleEmployeeChange = (employee: HRProfile | null) => {
        setSelectedEmployee(employee);
        if (employee) {
            setReceiverName(employee.full_name.toUpperCase());
            setReceiverTitle(employee.job_position || 'Nhân viên kĩ thuật');
            setReceiverDept(employee.department || 'Trung Tâm KV Bắc Sài Gòn');
            
            // Auto lookup department from assigned assets if possible
            const assignedAsset = assets.find(a => 
                (a.user_employee_name || '').toLowerCase() === employee.full_name.toLowerCase()
            );
            if (assignedAsset && assignedAsset.location_name) {
                setReceiverDept(assignedAsset.location_name);
            }

            const matched = syncEmployeeAssets(employee.full_name);
            setDefaultAssets(matched);
        } else {
            setReceiverName('');
            setReceiverTitle('');
            setReceiverDept('');
            setDefaultAssets([]);
        }
    };

    // Auto populate defaultAssets when assets arrive if receiverName is set but defaultAssets is empty
    useEffect(() => {
        if (receiverName && defaultAssets.length === 0 && assets.length > 0) {
            const matched = syncEmployeeAssets(receiverName);
            if (matched.length > 0) {
                setDefaultAssets(matched);
            }
        }
    }, [assets, receiverName, defaultAssets.length, syncEmployeeAssets]);

    // Handlers for manual assets in default template
    const handleOpenAddAssetDialog = () => {
        setSelectedCatalogAsset(null);
        setNewAssetForm({
            asset_code: '',
            asset_name: '',
            quantity: 1,
            asset_type: 'CCDC',
            serial_number: '',
            note: ''
        });
        setAddAssetDialogOpen(true);
    };

    const handleSelectCatalogAsset = (catalogAsset: Asset | null) => {
        setSelectedCatalogAsset(catalogAsset);
        if (catalogAsset) {
            setNewAssetForm(prev => ({
                ...prev,
                asset_code: catalogAsset.asset_code || '',
                asset_name: catalogAsset.asset_name || '',
                asset_type: catalogAsset.asset_type || prev.asset_type,
                serial_number: catalogAsset.serial_number || prev.serial_number,
                quantity: catalogAsset.quantity || 1
            }));
        }
    };

    const handleSaveNewAsset = () => {
        if (!newAssetForm.asset_name.trim()) {
            error('Vui lòng nhập tên tài sản!');
            return;
        }
        const created = createCustomHandoverAsset({
            asset_code: newAssetForm.asset_code,
            asset_name: newAssetForm.asset_name,
            quantity: newAssetForm.quantity,
            asset_type: newAssetForm.asset_type,
            serial_number: newAssetForm.serial_number,
            note: newAssetForm.note,
            is_custom: !selectedCatalogAsset
        });
        setDefaultAssets(prev => [...prev, created]);
        setAddAssetDialogOpen(false);
        success(`Đã thêm "${created.asset_name}" vào danh sách.`);
    };

    const handleUpdateDefaultAsset = (index: number, field: keyof DefaultHandoverAsset, value: any) => {
        setDefaultAssets(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleDeleteDefaultAsset = (index: number) => {
        setDefaultAssets(prev => prev.filter((_, i) => i !== index));
    };

    // Filter active safety items
    const activeBhlItems = bhlItems.filter(item => item.quantity > 0);
    const qtyLabel = actionType === 'revoke' ? 'SL thu hồi' : actionType === 'transfer' ? 'SL điều chuyển' : 'SL bàn giao';

    // Derive shoe size from employee profile or manually entered size in Giày Bảo Hộ row
    const giayShoeSize = useMemo(() => {
        if (selectedEmployee?.shoe_size && selectedEmployee.shoe_size.trim()) {
            return selectedEmployee.shoe_size.trim();
        }
        const giay = bhlItems.find(i => i.name.toLowerCase().includes('giày'));
        if (giay?.note) {
            const match = giay.note.match(/(?:size\s*:?\s*)?(\d{2})/i);
            if (match) return match[1];
            if (giay.note.trim()) return giay.note.trim();
        }
        if (giay?.serial) {
            const match = giay.serial.match(/(?:size\s*:?\s*)?(\d{2})/i);
            if (match) return match[1];
        }
        return '';
    }, [selectedEmployee, bhlItems]);

    const renderBhlItemNote = (item: BhlItem) => {
        const text = formatBhlItemNote(item, selectedEmployee?.uniform_size, giayShoeSize);
        const parsed = splitBhlItemNote(text);
        if (parsed) {
            return (
                <>
                    <strong>{parsed.sizePart}</strong>
                    {parsed.separator}
                    {parsed.rest}
                </>
            );
        }
        return text;
    };

    const totalQty = templateType === 'default'
        ? defaultAssets.reduce((sum, a) => sum + (Number(a.quantity) || 1), 0)
        : activeBhlItems.reduce((sum, item) => sum + item.quantity, 0);

    const now = new Date();
    const dateStr = `TPHCM, Ngày ${now.getDate().toString().padStart(2, '0')} tháng ${(now.getMonth() + 1).toString().padStart(2, '0')} năm ${now.getFullYear()}`;

    const titleMapDefault = {
        allocate: 'BIÊN BẢN BÀN GIAO TBVP-CCDC (ACT ĐẦU TƯ)',
        revoke:   'BIÊN BẢN THU HỒI TBVP-CCDC (ACT ĐẦU TƯ)',
        transfer: 'BIÊN BẢN ĐIỀU CHUYỂN TBVP-CCDC (ACT ĐẦU TƯ)',
    };

    const titleMapBhl = {
        allocate: 'BIÊN BẢN BÀN GIAO TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        revoke:   'BIÊN BẢN THU HỒI TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
        transfer: 'BIÊN BẢN ĐIỀU CHUYỂN TRANG BỊ BẢO HỘ LAO ĐỘNG (CCDC)',
    };

    const currentTitle = templateType === 'default' ? titleMapDefault[actionType] : titleMapBhl[actionType];
    const isRevoke = actionType === 'revoke';

    const resetBhlItems = () => {
        setBhlItems(createDefaultBhlItems());
        success('Đã đặt lại cấu hình mặc định.');
    };

    const buildPrintHtml = (content: string) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <title>In Biên Bản</title>
            <style>
                @page { size: A4 portrait; margin: 20mm 15mm 20mm 30mm; }
                * { box-sizing: border-box; }
                body { font-family: 'Times New Roman', Times, serif; font-size: 13pt; color: #000; margin: 0; padding: 0; line-height: 1.35; }
                /* Preserve the compact inline sizes in the document so the BHLĐ
                   handover record, including signatures, remains on one A4 page. */
                body * { color: #000 !important; }
                body .document-title { font-size: 16pt !important; }
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
                .header-left { width: 55%; display: flex; align-items: center; gap: 10px; }
                .header-right { width: 45%; text-align: center; }
                .logo-box { width: 55px; height: 55px; background: #cc0000; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14pt; border-radius: 4px; flex-shrink: 0; }
                .company-name, .company-sub, .republic, .motto { font-size: 13pt; font-weight: bold; text-align: center; }
                .motto { text-decoration: underline; }
                .date-line { text-align: right; font-style: italic; font-size: 13pt; margin: 10px 0 6px; }
                .title { text-align: center; font-size: 16pt; font-weight: bold; color: #000; margin: 14px 0 18px; text-transform: uppercase; }
                .section-label { font-weight: bold; font-size: 13pt; margin: 6px 0 2px; }
                .person-row { display: flex; font-size: 13pt; margin: 3px 0; align-items: center; }
                .person-label { width: 120px; font-weight: bold; }
                .person-name { width: 200px; flex: 0 0 200px; font-weight: bold; text-transform: uppercase; }
                .person-right { display: flex; flex: 1; align-items: center; }
                .person-title-label { font-weight: bold; width: 75px; }
                .person-title-val { flex: 1; }
                .person-phone { width: 110px; text-align: right; }
                table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13pt; }
                th { background: #fff; border: 1px solid #000; padding: 5px 4px; text-align: center; font-weight: bold; }
                td { border: 1px solid #000; padding: 4px; vertical-align: middle; word-wrap: break-word; overflow-wrap: break-word; }
                td.note-cell { font-size: 8.5pt; line-height: 1.35; vertical-align: top; }
                .footer-note { font-style: italic; font-size: 13pt; margin-top: 8px; border-top: 1px solid #000; padding-top: 6px; text-align: justify; }
                .signatures { display: flex; justify-content: space-between; margin-top: 30px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
                .sig-block { width: 30%; }
                .sig-title, .sig-sub { font-size: 13pt; }
                .sig-title { font-weight: bold; }
                .sig-sub { font-style: italic; margin-top: 2px; }
                .sig-space { height: 55px; }
            </style>
        </head>
        <body>
            ${content}
        </body>
        </html>
    `;

    const handlePrint = () => {
        const content = printRef.current?.innerHTML;
        if (!content) return;

        // Ưu tiên in qua iframe ẩn để hộp thoại in hiện ngay lập tức, không bị trình duyệt chặn popup sau async
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.setAttribute('aria-hidden', 'true');
        document.body.appendChild(iframe);

        const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!frameDoc) {
            if (document.body.contains(iframe)) document.body.removeChild(iframe);
            // Fallback sang window.open nếu môi trường không cho phép truy cập iframe
            const w = window.open('', '_blank', 'width=1000,height=800');
            if (w) {
                w.document.write(buildPrintHtml(content));
                w.document.close();
                setTimeout(() => {
                    w.focus();
                    w.print();
                    w.close();
                }, 300);
            }
            return;
        }

        frameDoc.open();
        frameDoc.write(buildPrintHtml(content));
        frameDoc.close();

        setTimeout(() => {
            try {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            } catch (err) {
                console.error('Lỗi khi kích hoạt in:', err);
            } finally {
                setTimeout(() => {
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                }, 60000);
            }
        }, 150);
    };

    return (
        <Box sx={{ p: { xs: 2, md: 4 }, bgcolor: 'transparent', minHeight: 'calc(100vh - 64px)' }}>
            
            {/* Header Area */}
            <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
                        In Biên bản Bàn giao & Thu hồi CCDC
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
                        Cấu hình và in trực quan Biên bản CCDC-BHLĐ cho nhân viên kỹ thuật
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1.5} flexWrap="wrap">
                    <Button
                        variant="outlined"
                        startIcon={<TemplateExcelIcon size={18} />}
                        onClick={handleDownloadTemplate}
                        size="medium"
                        sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            borderColor: '#cbd5e1',
                            bgcolor: 'background.paper',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            color: 'var(--text-primary)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                borderColor: '#107c41',
                                bgcolor: 'rgba(16, 124, 65, 0.05)',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        Tải mẫu Excel
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<CloudUploadCustomIcon size={18} />}
                        onClick={() => setBatchModalOpen(true)}
                        size="medium"
                        color="primary"
                        sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 600,
                            bgcolor: 'background.paper',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                transform: 'translateY(-1px)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                            }
                        }}
                    >
                        Import Excel in hàng loạt
                    </Button>

                    <Button
                        variant="contained"
                        startIcon={isPrinting ? <CircularProgress size={18} color="inherit" /> : <PrinterModernIcon size={18} />}
                        onClick={handleSaveAndPrint}
                        size="medium"
                        disabled={isPrinting || (templateType === 'default' ? defaultAssets.length === 0 : activeBhlItems.length === 0)}
                        sx={{
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            boxShadow: '0 3px 8px rgba(37,99,235,0.3)',
                            textTransform: 'none',
                            px: 2.5,
                            borderRadius: '8px',
                            fontWeight: 700,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 5px 14px rgba(37,99,235,0.4)',
                            },
                            '&.Mui-disabled': {
                                color: 'rgba(255, 255, 255, 0.7)',
                                background: 'linear-gradient(135deg, #93c5fd 0%, #60a5fa 100%)',
                            }
                        }}
                    >
                        {isPrinting ? 'Đang chuẩn bị in...' : 'In biên bản'}
                    </Button>
                </Stack>
            </Box>

            <Grid container spacing={4}>
                
                {/* ── Left Configuration Panel ── */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Stack spacing={3}>
                        
                        {/* 1. Employee and Template Selector Card */}
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                    <AssignmentIndIcon sx={{ color: '#2563eb' }} /> Đối tượng bàn giao
                                </Typography>

                                <Stack spacing={2.5}>
                                    <Autocomplete
                                        options={hrProfiles}
                                        getOptionLabel={(emp) => `${emp.full_name} (${emp.id})`}
                                        value={selectedEmployee}
                                        onChange={(_, newVal) => handleEmployeeChange(newVal)}
                                        loading={hrProfilesStatus === 'loading'}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Chọn Nhân viên kĩ thuật"
                                                placeholder="Gõ tên hoặc mã nhân viên..."
                                                variant="outlined"
                                                size="small"
                                            />
                                        )}
                                    />

                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Họ và Tên Bên Nhận"
                                                fullWidth
                                                size="small"
                                                value={receiverName}
                                                onChange={(e) => setReceiverName(e.target.value.toUpperCase())}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <TextField
                                                label="Chức vụ"
                                                fullWidth
                                                size="small"
                                                value={receiverTitle}
                                                onChange={(e) => setReceiverTitle(e.target.value)}
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12 }}>
                                            <TextField
                                                label="Đơn vị / Phòng ban"
                                                fullWidth
                                                size="small"
                                                value={receiverDept}
                                                onChange={(e) => setReceiverDept(e.target.value)}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <BusinessIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />
                                        </Grid>
                                    </Grid>

                                    <Divider />

                                    <FormControl component="fieldset">
                                        <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', mb: 1 }}>LOẠI MẪU BIÊN BẢN</FormLabel>
                                        <RadioGroup row value={templateType} onChange={(e) => setTemplateType(e.target.value as any)}>
                                            <FormControlLabel value="bhl" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Mẫu CCDC-BHLĐ</Typography>} />
                                            <FormControlLabel value="default" control={<Radio size="small" />} label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Mẫu mặc định (Asset của NV)</Typography>} />
                                        </RadioGroup>
                                    </FormControl>

                                    <FormControl component="fieldset">
                                        <FormLabel component="legend" sx={{ fontWeight: 600, fontSize: '0.85rem', color: '#64748b', mb: 1 }}>TÁC VỤ IN</FormLabel>
                                        <RadioGroup row value={actionType} onChange={(e) => setActionType(e.target.value as any)}>
                                            <FormControlLabel value="allocate" control={<Radio size="small" color="primary" />} label={<Typography variant="body2">Cấp phát / Bàn giao</Typography>} />
                                            <FormControlLabel value="revoke" control={<Radio size="small" color="error" />} label={<Typography variant="body2">Thu hồi</Typography>} />
                                            <FormControlLabel value="transfer" control={<Radio size="small" color="secondary" />} label={<Typography variant="body2">Điều chuyển</Typography>} />
                                        </RadioGroup>
                                    </FormControl>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* 2. Giver Information */}
                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                    <BadgeIcon sx={{ color: '#2563eb' }} /> Thông tin bên giao
                                </Typography>

                                <Stack spacing={2.5}>
                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Bên giao 1:</Typography>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => {
                                                    setGiverInfo(prev => ({
                                                        ...prev,
                                                        giverName: 'NGUYỄN HẢI SƠN',
                                                        giverTitle: 'GĐ TTKV BSG',
                                                        giverPhone: '0988855186'
                                                    }));
                                                }}
                                                sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 'auto', color: '#2563eb' }}
                                            >
                                                Đặt lại mặc định
                                            </Button>
                                        </Box>
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Autocomplete
                                                    freeSolo
                                                    openOnFocus
                                                    forcePopupIcon
                                                    autoHighlight
                                                    selectOnFocus
                                                    clearOnBlur={false}
                                                    options={hrProfiles}
                                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.full_name || ''}
                                                    filterOptions={(options, state) =>
                                                        filterGiverProfiles(state.inputValue || '', options, giverInfo.giverName)
                                                    }
                                                    value={null}
                                                    inputValue={giverInfo.giverName || ''}
                                                    onInputChange={(_, newInputValue, reason) => {
                                                        if (reason === 'input') {
                                                            const upper = newInputValue.toUpperCase();
                                                            const matched = findGiverProfile(newInputValue, hrProfiles);
                                                            if (matched) {
                                                                setGiverInfo(prev => ({
                                                                    ...prev,
                                                                    giverName: matched.full_name.toUpperCase(),
                                                                    giverTitle: matched.job_position || prev.giverTitle,
                                                                    giverPhone: matched.phone_number || prev.giverPhone
                                                                }));
                                                            } else {
                                                                setGiverInfo(prev => ({ ...prev, giverName: upper }));
                                                            }
                                                        } else if (reason === 'clear') {
                                                            setGiverInfo(prev => ({ ...prev, giverName: '', giverTitle: '', giverPhone: '' }));
                                                        }
                                                    }}
                                                    onChange={(_, newValue) => {
                                                        if (newValue) {
                                                            if (typeof newValue !== 'string') {
                                                                setGiverInfo(prev => ({
                                                                    ...prev,
                                                                    giverName: (newValue.full_name || '').toUpperCase(),
                                                                    giverTitle: newValue.job_position || '',
                                                                    giverPhone: newValue.phone_number || ''
                                                                }));
                                                            } else {
                                                                const matched = findGiverProfile(newValue, hrProfiles);
                                                                if (matched) {
                                                                    setGiverInfo(prev => ({
                                                                        ...prev,
                                                                        giverName: matched.full_name.toUpperCase(),
                                                                        giverTitle: matched.job_position || prev.giverTitle,
                                                                        giverPhone: matched.phone_number || prev.giverPhone
                                                                    }));
                                                                } else {
                                                                    setGiverInfo(prev => ({ ...prev, giverName: newValue.toUpperCase() }));
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Họ tên"
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Chọn hoặc gõ tên..."
                                                            onBlur={() => {
                                                                const current = (giverInfo.giverName || '').trim();
                                                                if (current) {
                                                                    const matched = findGiverProfile(current, hrProfiles);
                                                                    if (matched && (!giverInfo.giverTitle || !giverInfo.giverPhone)) {
                                                                        setGiverInfo(prev => ({
                                                                            ...prev,
                                                                            giverName: matched.full_name.toUpperCase(),
                                                                            giverTitle: matched.job_position || prev.giverTitle,
                                                                            giverPhone: matched.phone_number || prev.giverPhone
                                                                        }));
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    renderOption={(props, option) => {
                                                        const { key, ...rest } = props;
                                                        return (
                                                            <li key={key || option.id} {...rest}>
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.full_name}</Typography>
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                        {option.job_position || 'Nhân viên'}{option.phone_number ? ` • ${option.phone_number}` : ''}
                                                                    </Typography>
                                                                </Box>
                                                            </li>
                                                        );
                                                    }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Chức vụ" size="small" fullWidth value={giverInfo.giverTitle} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverTitle: e.target.value }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Số ĐT" size="small" fullWidth value={giverInfo.giverPhone} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverPhone: e.target.value }))} />
                                            </Grid>
                                        </Grid>
                                    </Box>

                                    <Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--text-secondary)' }}>Bên giao 2 (không bắt buộc):</Typography>
                                            <Button
                                                size="small"
                                                variant="text"
                                                onClick={() => {
                                                    setGiverInfo(prev => ({
                                                        ...prev,
                                                        ...getDefaultSecondGiver(hrProfiles)
                                                    }));
                                                }}
                                                sx={{ textTransform: 'none', fontSize: '0.75rem', p: 0, minWidth: 'auto', color: '#2563eb' }}
                                            >
                                                Đặt lại mặc định
                                            </Button>
                                        </Box>
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Autocomplete
                                                    freeSolo
                                                    openOnFocus
                                                    forcePopupIcon
                                                    autoHighlight
                                                    selectOnFocus
                                                    clearOnBlur={false}
                                                    options={hrProfiles}
                                                    getOptionLabel={(option) => typeof option === 'string' ? option : option.full_name || ''}
                                                    filterOptions={(options, state) =>
                                                        filterGiverProfiles(state.inputValue || '', options, giverInfo.giverName2)
                                                    }
                                                    value={null}
                                                    inputValue={giverInfo.giverName2 || ''}
                                                    onInputChange={(_, newInputValue, reason) => {
                                                        if (reason === 'input') {
                                                            const upper = newInputValue.toUpperCase();
                                                            const matched = findGiverProfile(newInputValue, hrProfiles);
                                                            if (matched) {
                                                                setGiverInfo(prev => ({
                                                                    ...prev,
                                                                    giverName2: matched.full_name.toUpperCase(),
                                                                    giverTitle2: matched.job_position || prev.giverTitle2,
                                                                    giverPhone2: matched.phone_number || prev.giverPhone2
                                                                }));
                                                            } else {
                                                                setGiverInfo(prev => ({ ...prev, giverName2: upper }));
                                                            }
                                                        } else if (reason === 'clear') {
                                                            setGiverInfo(prev => ({ ...prev, giverName2: '', giverTitle2: '', giverPhone2: '' }));
                                                        }
                                                    }}
                                                    onChange={(_, newValue) => {
                                                        if (newValue) {
                                                            if (typeof newValue !== 'string') {
                                                                setGiverInfo(prev => ({
                                                                    ...prev,
                                                                    giverName2: (newValue.full_name || '').toUpperCase(),
                                                                    giverTitle2: newValue.job_position || '',
                                                                    giverPhone2: newValue.phone_number || ''
                                                                }));
                                                            } else {
                                                                const matched = findGiverProfile(newValue, hrProfiles);
                                                                if (matched) {
                                                                    setGiverInfo(prev => ({
                                                                        ...prev,
                                                                        giverName2: matched.full_name.toUpperCase(),
                                                                        giverTitle2: matched.job_position || prev.giverTitle2,
                                                                        giverPhone2: matched.phone_number || prev.giverPhone2
                                                                    }));
                                                                } else {
                                                                    setGiverInfo(prev => ({ ...prev, giverName2: newValue.toUpperCase() }));
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Họ tên"
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Chọn hoặc gõ tên..."
                                                            onBlur={() => {
                                                                const current = (giverInfo.giverName2 || '').trim();
                                                                if (current) {
                                                                    const matched = findGiverProfile(current, hrProfiles);
                                                                    if (matched && (!giverInfo.giverTitle2 || !giverInfo.giverPhone2)) {
                                                                        setGiverInfo(prev => ({
                                                                            ...prev,
                                                                            giverName2: matched.full_name.toUpperCase(),
                                                                            giverTitle2: matched.job_position || prev.giverTitle2,
                                                                            giverPhone2: matched.phone_number || prev.giverPhone2
                                                                        }));
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    renderOption={(props, option) => {
                                                        const { key, ...rest } = props;
                                                        return (
                                                            <li key={key || option.id} {...rest}>
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.full_name}</Typography>
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                        {option.job_position || 'Nhân viên'}{option.phone_number ? ` • ${option.phone_number}` : ''}
                                                                    </Typography>
                                                                </Box>
                                                            </li>
                                                        );
                                                    }}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Chức vụ" size="small" fullWidth value={giverInfo.giverTitle2} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverTitle2: e.target.value }))} />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <TextField label="Số ĐT" size="small" fullWidth value={giverInfo.giverPhone2} onChange={(e) => setGiverInfo(prev => ({ ...prev, giverPhone2: e.target.value }))} />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Stack>
                            </CardContent>
                        </Card>

                        {/* 3. Items Editor */}
                        {templateType === 'bhl' && (
                            <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                            Danh sách trang thiết bị bảo hộ (CCDC)
                                        </Typography>
                                        <IconButton size="small" onClick={resetBhlItems} color="primary" title="Đặt lại mặc định">
                                            <RotateLeftIcon />
                                        </IconButton>
                                    </Box>

                                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700, width: 140 }}>Tên trang bị</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, width: 70, textAlign: 'center' }}>SL</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Số Serial</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {bhlItems.map((item, idx) => (
                                                    <TableRow key={idx} hover>
                                                        <TableCell sx={{ py: 1, fontWeight: 500, fontSize: '0.8rem' }}>
                                                            {item.name} <Typography variant="caption" sx={{ color: 'text.secondary' }}>({item.unit})</Typography>
                                                            {item.name.toLowerCase().includes('giày') && giayShoeSize && (
                                                                <Typography variant="caption" sx={{ display: 'block', color: '#2563eb', fontWeight: 600, fontSize: '0.72rem' }}>
                                                                    Size: {giayShoeSize}
                                                                </Typography>
                                                            )}
                                                            {item.name.toLowerCase().includes('dép') && giayShoeSize && (
                                                                <Typography variant="caption" sx={{ display: 'block', color: '#16a34a', fontWeight: 600, fontSize: '0.72rem' }}>
                                                                    Size: {giayShoeSize} (tự động theo giày)
                                                                </Typography>
                                                            )}
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                type="number"
                                                                size="small"
                                                                value={item.quantity}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].quantity = Math.max(0, parseInt(e.target.value) || 0);
                                                                    setBhlItems(newItems);
                                                                }}
                                                                inputProps={{ min: 0 }}
                                                                sx={{ width: 60, '& .MuiInputBase-input': { py: 0.5, px: 0.5, textAlign: 'center', fontSize: '0.85rem' } }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                size="small"
                                                                placeholder="Serial..."
                                                                value={item.serial}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].serial = e.target.value;
                                                                    setBhlItems(newItems);
                                                                }}
                                                                sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem' } }}
                                                            />
                                                        </TableCell>
                                                        <TableCell sx={{ py: 1 }}>
                                                            <TextField
                                                                size="small"
                                                                placeholder={
                                                                    item.name.toLowerCase().includes('quần áo') && selectedEmployee?.uniform_size
                                                                        ? `Size: ${selectedEmployee.uniform_size}`
                                                                        : item.name.toLowerCase().includes('giày') && giayShoeSize
                                                                        ? `Size: ${giayShoeSize}`
                                                                        : item.name.toLowerCase().includes('dép') && giayShoeSize
                                                                        ? `Size: ${giayShoeSize} (theo giày)`
                                                                        : "Ghi chú..."
                                                                }
                                                                value={item.note}
                                                                onChange={(e) => {
                                                                    const newItems = [...bhlItems];
                                                                    newItems[idx].note = e.target.value;
                                                                    setBhlItems(newItems);
                                                                }}
                                                                sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 1, fontSize: '0.8rem' } }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </CardContent>
                            </Card>
                        )}

                        {/* 3b. Items Editor for Default Template */}
                        {templateType === 'default' && (
                            <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-glass)' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                                        <Box>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'var(--text-primary)' }}>
                                                <Inventory2OutlinedIcon sx={{ color: '#2563eb' }} /> Danh sách tài sản (Mẫu mặc định)
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                                                {defaultAssets.length > 0
                                                    ? `Đang có ${defaultAssets.length} tài sản (Tổng SL: ${totalQty})`
                                                    : 'Chưa có tài sản. Bạn có thể gõ tay tài sản ngoài danh sách.'}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1} flexWrap="wrap">
                                            {receiverName && (
                                                <Tooltip title="Nạp lại tài sản được gán cho nhân viên này từ hệ thống" arrow>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<RotateLeftIcon />}
                                                        onClick={() => {
                                                            const matched = syncEmployeeAssets(receiverName);
                                                            setDefaultAssets(matched);
                                                            if (matched.length > 0) {
                                                                success(`Đã nạp ${matched.length} tài sản từ hệ thống cho ${receiverName}.`);
                                                            } else {
                                                                error(`Nhân viên ${receiverName} chưa được gán tài sản nào trong hệ thống.`);
                                                            }
                                                        }}
                                                        sx={{ textTransform: 'none', fontSize: '0.8rem', borderRadius: 2 }}
                                                    >
                                                        Nạp từ hệ thống
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            <Button
                                                size="small"
                                                variant="contained"
                                                startIcon={<AddIcon />}
                                                onClick={handleOpenAddAssetDialog}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontSize: '0.8rem',
                                                    borderRadius: 2,
                                                    fontWeight: 600,
                                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                                    boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
                                                }}
                                            >
                                                Thêm tài sản ngoài danh sách
                                            </Button>
                                        </Stack>
                                    </Box>

                                    {defaultAssets.length === 0 ? (
                                        <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(255,255,255,0.02)', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                                            <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1.5 }}>
                                                Chưa có tài sản nào trong danh sách biên bản.
                                            </Typography>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                startIcon={<AddIcon />}
                                                onClick={handleOpenAddAssetDialog}
                                                sx={{ textTransform: 'none', borderRadius: 2 }}
                                            >
                                                + Gõ tay tài sản ngoài danh sách
                                            </Button>
                                        </Box>
                                    ) : (
                                        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                                            <Table size="small">
                                                <TableHead sx={{ bgcolor: 'rgba(255, 255, 255, 0.02)' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 700 }}>Tên tài sản / Mã</TableCell>
                                                        <TableCell sx={{ fontWeight: 700, width: 70, textAlign: 'center' }}>SL</TableCell>
                                                        <TableCell sx={{ fontWeight: 700, width: 110 }}>Loại TS</TableCell>
                                                        <TableCell sx={{ fontWeight: 700, width: 120 }}>Serial</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Ghi chú</TableCell>
                                                        <TableCell sx={{ width: 40, textAlign: 'center' }}></TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {defaultAssets.map((item, idx) => (
                                                        <TableRow key={item.id || idx} hover>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem' }}>
                                                                        {item.asset_name}
                                                                    </Typography>
                                                                    {item.is_custom && (
                                                                        <Chip label="Ngoài DS" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700 }} />
                                                                    )}
                                                                </Box>
                                                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', fontSize: '0.72rem' }}>
                                                                    Mã: {item.asset_code || '(Chưa có)'}
                                                                </Typography>
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <TextField
                                                                    type="number"
                                                                    size="small"
                                                                    value={item.quantity}
                                                                    onChange={(e) => handleUpdateDefaultAsset(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                                                    inputProps={{ min: 1 }}
                                                                    sx={{ width: 55, '& .MuiInputBase-input': { py: 0.5, px: 0.5, textAlign: 'center', fontSize: '0.85rem' } }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    value={item.asset_type}
                                                                    onChange={(e) => handleUpdateDefaultAsset(idx, 'asset_type', e.target.value)}
                                                                    placeholder="Loại..."
                                                                    sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 0.8, fontSize: '0.8rem' } }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    placeholder="Serial..."
                                                                    value={item.serial_number}
                                                                    onChange={(e) => handleUpdateDefaultAsset(idx, 'serial_number', e.target.value)}
                                                                    sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 0.8, fontSize: '0.8rem' } }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    placeholder="Ghi chú..."
                                                                    value={item.note}
                                                                    onChange={(e) => handleUpdateDefaultAsset(idx, 'note', e.target.value)}
                                                                    sx={{ width: '100%', '& .MuiInputBase-input': { py: 0.5, px: 0.8, fontSize: '0.8rem' } }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ py: 1, textAlign: 'center' }}>
                                                                <IconButton size="small" color="error" onClick={() => handleDeleteDefaultAsset(idx)} title="Xóa tài sản này">
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* 4. Separate history for each handover operation */}
                        <Card className="handover-history-panel" variant="outlined" sx={{ borderRadius: 3, border: '1px solid #334155', boxShadow: '0 8px 24px rgba(15,23,42,0.18)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography className="handover-history-title" variant="subtitle1" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <HistoryIcon sx={{ color: '#2563eb' }} /> {actionHistoryLabel} gần đây
                                    </Typography>
                                    {actionHistory.length > 0 && (
                                        <Tooltip title="Xuất Excel" arrow>
                                            <Button
                                                className="handover-history-export"
                                                variant="outlined"
                                                onClick={handleExportHistory}
                                                sx={{ minWidth: 40, width: 40, height: 40, borderRadius: '10px', p: 0 }}
                                            >
                                                <FileDownloadIcon sx={{ fontSize: 24 }} />
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Box>

                                {/* Search box */}
                                {actionHistory.length > 0 && (
                                    <TextField
                                        size="small"
                                        placeholder="Tìm theo tên, phòng ban, ngày..."
                                        value={historySearch}
                                        onChange={(e) => setHistorySearch(e.target.value)}
                                        fullWidth
                                        sx={{
                                            mb: 1.5,
                                            '& .MuiInputBase-root': {
                                                borderRadius: 2,
                                                bgcolor: 'rgba(255,255,255,0.03)',
                                            },
                                            '& .MuiInputBase-input': {
                                                py: 0.8,
                                                fontSize: '0.85rem',
                                            }
                                        }}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon fontSize="small" sx={{ color: '#64748b' }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: historySearch ? (
                                                <InputAdornment position="end">
                                                    <IconButton size="small" onClick={() => setHistorySearch('')} edge="end">
                                                        <ClearIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                                                    </IconButton>
                                                </InputAdornment>
                                            ) : null,
                                        }}
                                    />
                                )}

                                {historyLoading ? (
                                    <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', py: 2 }}>
                                        Đang tải lịch sử...
                                    </Typography>
                                ) : filteredActionHistory.length === 0 ? (
                                    <Typography variant="body2" sx={{ color: '#64748b', textAlign: 'center', py: 2, fontStyle: 'italic' }}>
                                        {historySearch.trim()
                                            ? `Không tìm thấy kết quả cho "${historySearch}".`
                                            : `Chưa có ${actionType === 'revoke' ? 'lịch sử thu hồi' : actionType === 'transfer' ? 'lịch sử điều chuyển' : 'lịch sử bàn giao'} nào được lưu.`
                                        }
                                    </Typography>
                                ) : (
                                    <Stack spacing={1.5} sx={{ maxHeight: 300, overflowY: 'auto', pr: 0.5 }}>
                                        {filteredActionHistory.map((h) => {
                                            const d = new Date(h.created_at);
                                            let formattedDate = '';
                                            let periodStr = '';
                                            if (!isNaN(d.getTime())) {
                                                const day = String(d.getDate()).padStart(2, '0');
                                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                                const year = d.getFullYear();
                                                const hours = String(d.getHours()).padStart(2, '0');
                                                const minutes = String(d.getMinutes()).padStart(2, '0');
                                                const seconds = String(d.getSeconds()).padStart(2, '0');
                                                formattedDate = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                                                periodStr = `${month}/${year}`;
                                            } else {
                                                formattedDate = String(h.created_at || '');
                                            }
                                            const actionLabel = h.action_type === 'revoke' ? 'Thu hồi' : h.action_type === 'transfer' ? 'Điều chuyển' : 'Bàn giao';
                                            const actionColor = h.action_type === 'revoke' ? '#ef4444' : h.action_type === 'transfer' ? '#8b5cf6' : '#10b981';
                                            
                                            return (
                                                <Box 
                                                    key={h.id} 
                                                    className="handover-history-record"
                                                    sx={{ 
                                                        p: 1.5, 
                                                        borderRadius: 2, 
                                                        border: '1px solid #f1f5f9', 
                                                        bgcolor: '#f8fafc',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        flexShrink: 0
                                                    }}
                                                >
                                                    <Box>
                                                        <Typography className="handover-history-name" variant="body2" sx={{ fontWeight: 700 }}>
                                                            {h.receiver_name}
                                                        </Typography>
                                                        <Typography className="handover-history-meta" variant="caption" sx={{ display: 'block', mt: 0.2 }}>
                                                            {formattedDate}{periodStr ? ` • Kỳ: ${periodStr}` : ''} • {h.template_type === 'bhl' ? 'Mẫu BHLĐ' : 'Mẫu TSCĐ'} ({h.total_quantity} món)
                                                        </Typography>
                                                        <Box sx={{ display: 'inline-block', mt: 0.5, px: 1, py: 0.25, borderRadius: 1, bgcolor: `${actionColor}15`, border: `1px solid ${actionColor}30` }}>
                                                            <Typography variant="caption" sx={{ color: actionColor, fontWeight: 700 }}>
                                                                {actionLabel}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    
                                                    <Stack direction="row" spacing={0.5}>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleReprint(h)} 
                                                            title="Xem lại và in"
                                                            sx={{ 
                                                                p: 0.6,
                                                                color: '#2563eb', 
                                                                transition: 'all 0.15s ease',
                                                                '&:hover': { bgcolor: 'rgba(37, 99, 235, 0.1)', transform: 'scale(1.1)' } 
                                                            }}
                                                        >
                                                            <ViewCustomIcon size={17} />
                                                        </IconButton>
                                                        <IconButton 
                                                            size="small" 
                                                            onClick={() => handleDeleteHistory(h.id)} 
                                                            title="Xóa lịch sử"
                                                            sx={{ 
                                                                p: 0.6,
                                                                color: '#ef4444', 
                                                                transition: 'all 0.15s ease',
                                                                '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', transform: 'scale(1.1)' } 
                                                            }}
                                                        >
                                                            <TrashCustomIcon size={17} />
                                                        </IconButton>
                                                    </Stack>
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>

                        <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #334155', boxShadow: '0 8px 24px rgba(15,23,42,0.18)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
                                    <Box>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                                            Báo cáo tổng hợp theo nhân viên
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                                            Thống kê theo từng nhân viên và từng trang bị từ các biên bản đã lưu.
                                        </Typography>
                                    </Box>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<ExcelBrandIcon size={18} />}
                                        onClick={handleExportEmployeeSummary}
                                        disabled={employeeSummary.length === 0}
                                        sx={{ whiteSpace: 'nowrap' }}
                                    >
                                        Xuất Excel
                                    </Button>
                                </Box>

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
                                    <TextField
                                        label="Từ ngày"
                                        type="date"
                                        value={reportStartDate}
                                        onChange={(event) => setReportStartDate(event.target.value)}
                                        size="small"
                                        fullWidth
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                    <TextField
                                        label="Đến ngày"
                                        type="date"
                                        value={reportEndDate}
                                        onChange={(event) => setReportEndDate(event.target.value)}
                                        size="small"
                                        fullWidth
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                </Stack>

                                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, maxHeight: 300, overflowX: 'auto' }}>
                                    <Table size="small" stickyHeader sx={{ minWidth: 650 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 140 }}>Nhân viên</TableCell>
                                                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 160 }}>Đơn vị</TableCell>
                                                <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 130 }}>Tên trang bị</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap', minWidth: 80 }}>Cấp phát</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, color: '#dc2626', whiteSpace: 'nowrap', minWidth: 80 }}>Thu hồi</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed', whiteSpace: 'nowrap', minWidth: 90 }}>Điều chuyển</TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap', minWidth: 70 }}>Tổng</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {employeeSummary.length === 0 ? (
                                                <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>Chưa có dữ liệu trong khoảng thời gian đã chọn.</TableCell></TableRow>
                                            ) : employeeSummary.map(row => (
                                                <TableRow key={`${row.employeeName}-${row.department}-${row.equipmentName}`} hover>
                                                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{row.employeeName}</TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.department}</TableCell>
                                                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.equipmentName}</TableCell>
                                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{row.allocated}</TableCell>
                                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{row.revoked}</TableCell>
                                                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{row.transferred}</TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{row.total}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                {/* ── Right Live Print Preview ── */}
                <Grid size={{ xs: 12, lg: 7 }} sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Box sx={{ 
                        width: '100%',
                        overflowX: 'auto', 
                        display: 'flex', 
                        justifyContent: 'center',
                        p: { xs: 0, lg: 2 },
                        bgcolor: { xs: 'transparent', lg: '#e2e8f0' },
                        borderRadius: 3
                    }}>
                        <Paper 
                            id="asset-handover-preview"
                            elevation={4} 
                            sx={{ 
                                bgcolor: 'white', 
                                p: '15mm 15mm', 
                                width: '210mm', 
                                minHeight: '297mm', 
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
                                border: '1px solid #e2e8f0',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <Box ref={printRef} className="asset-handover-document" sx={{ fontFamily: 'Times New Roman', fontSize: '11pt', color: '#000', flexGrow: 1 }}>
                                
                                {/* Header */}
                                <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '55%' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontWeight: 'bold', color: '#003087', fontSize: '10.5pt', textTransform: 'uppercase' }}>CTY CỔ PHẦN VIỄN THÔNG ACT</div>
                                            <div style={{ fontWeight: 'bold', color: '#003087', fontSize: '10.5pt', textTransform: 'uppercase' }}>TRUNG TÂM KHU VỰC BẮC SÀI GÒN</div>
                                        </div>
                                    </div>
                                    <div style={{ width: '45%', textAlign: 'center' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt' }}>Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
                                        <div style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '10.5pt' }}>Độc lập - Tự do - Hạnh phúc</div>
                                    </div>
                                </div>

                                {/* Date */}
                                <div style={{ textAlign: 'right', fontStyle: 'italic', fontSize: '10.5pt', margin: '10px 0 6px' }}>
                                    {dateStr}
                                </div>

                                {/* Title */}
                                <div className="document-title" style={{ textAlign: 'center', fontSize: '15pt', fontWeight: 'bold', color: '#000', margin: '14px 0 18px', textTransform: 'uppercase', lineHeight: 1.3 }}>
                                    {currentTitle}
                                </div>

                                {/* A revocation reverses the legal handover direction: the employee returns equipment to the warehouse. */}
                                {isRevoke ? (
                                    <>
                                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '6px 0 2px' }}>BÊN GIAO :</div>
                                        <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                            <span style={{ width: 200, flex: '0 0 200px', minWidth: 0, fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{receiverName || '........................................................'}</span>
                                            <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                            <span style={{ flex: 1 }}>{receiverTitle || '......................................'}</span>
                                            <span style={{ width: 110, textAlign: 'right' }}></span>
                                        </div>
                                        <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 'bold', width: 120 }}>Đơn vị:</span>
                                            <span style={{ flex: 1 }}>{receiverDept || '........................................................................................................................'}</span>
                                        </div>
                                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '8px 0 2px' }}>BÊN NHẬN :</div>
                                        {[['giverName', 'giverTitle', 'giverPhone'], ['giverName2', 'giverTitle2', 'giverPhone2']].map(([nameKey, titleKey, phoneKey]) => giverInfo[nameKey as keyof typeof giverInfo] ? (
                                            <div key={nameKey} style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span>
                                                <span style={{ width: 200, flex: '0 0 200px', fontWeight: 'bold', textTransform: 'uppercase' }}>{giverInfo[nameKey as keyof typeof giverInfo] as string}</span>
                                                <span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span>
                                                <span style={{ flex: 1 }}>{giverInfo[titleKey as keyof typeof giverInfo] as string}</span>
                                                <span style={{ width: 110, textAlign: 'right' }}>{formatPhone(giverInfo[phoneKey as keyof typeof giverInfo] as string)}</span>
                                            </div>
                                        ) : null)}
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '6px 0 2px' }}>BÊN GIAO :</div>
                                        {giverInfo.giverName && <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}><span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span><span style={{ width: 200, flex: '0 0 200px', fontWeight: 'bold', textTransform: 'uppercase' }}>{giverInfo.giverName}</span><span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span><span style={{ flex: 1 }}>{giverInfo.giverTitle}</span><span style={{ width: 110, textAlign: 'right' }}>{formatPhone(giverInfo.giverPhone)}</span></div>}
                                        {giverInfo.giverName2 && <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}><span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span><span style={{ width: 200, flex: '0 0 200px', fontWeight: 'bold', textTransform: 'uppercase' }}>{giverInfo.giverName2}</span><span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span><span style={{ flex: 1 }}>{giverInfo.giverTitle2}</span><span style={{ width: 110, textAlign: 'right' }}>{formatPhone(giverInfo.giverPhone2)}</span></div>}
                                        <div style={{ fontWeight: 'bold', fontSize: '10.5pt', color: '#003087', margin: '8px 0 2px' }}>BÊN NHẬN :</div>
                                        <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}><span style={{ fontWeight: 'bold', width: 120 }}>Họ và tên:</span><span style={{ width: 200, flex: '0 0 200px', minWidth: 0, fontWeight: 'bold', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{receiverName || '........................................................'}</span><span style={{ fontWeight: 'bold', width: 75 }}>Chức vụ:</span><span style={{ flex: 1 }}>{receiverTitle || '......................................'}</span><span style={{ width: 110, textAlign: 'right' }}></span></div>
                                        <div style={{ display: 'flex', fontSize: '10.5pt', margin: '3px 0', alignItems: 'center' }}><span style={{ fontWeight: 'bold', width: 120 }}>Đơn vị:</span><span style={{ flex: 1 }}>{receiverDept || '........................................................................................................................'}</span></div>
                                    </>
                                )}

                                {/* Dynamic Table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 14, fontSize: '10pt' }}>
                                    <thead>
                                        {templateType === 'default' ? (
                                            <tr>
                                                {[
                                                    { label: 'Mã tài sản', w: '12%' },
                                                    { label: 'Tên tài sản', w: '38%' },
                                                    { label: 'Số lượng', w: '10%' },
                                                    { label: 'Loại tài sản', w: '15%' },
                                                    { label: 'Serial (nếu có)', w: '15%' },
                                                    { label: 'Ghi Chú', w: '10%' },
                                                ].map((h, i) => (
                                                    <th key={i} style={{ width: h.w, background: '#f2f2f2', color: '#000', border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{h.label}</th>
                                                ))}
                                            </tr>
                                        ) : (
                                            <tr>
                                                {[
                                                    { label: 'STT', w: '5%' },
                                                    { label: 'Nội dung yêu cầu', w: '20%' },
                                                    { label: 'Đơn vị', w: '7%' },
                                                    { label: 'Số lượng định mức', w: '12%' },
                                                    { label: qtyLabel, w: '8%' },
                                                    { label: 'Quy cách, TCKT', w: '15%' },
                                                    { label: 'Ghi chú', w: '33%' },
                                                ].map((h, i) => (
                                                    <th key={i} style={{ width: h.w, background: '#f2f2f2', color: '#000', border: '1px solid #000', padding: '5px 4px', textAlign: 'center', fontWeight: 'bold' }}>{h.label}</th>
                                                ))}
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {templateType === 'default' ? (
                                            defaultAssets.length > 0 ? (
                                                defaultAssets.map((a, i) => (
                                                    <tr key={a.id || i}>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.asset_code || '—'}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_name}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.quantity || 1}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle' }}>{a.asset_type || ''}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{a.serial_number || ''}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle', fontSize: '9pt' }}>{a.note || ''}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={6} style={{ border: '1px solid #888', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                                        Chưa có tài sản nào trong danh sách. Bấm &quot;Thêm tài sản ngoài danh sách&quot; để thêm tài sản cần bàn giao.
                                                    </td>
                                                </tr>
                                            )
                                        ) : (
                                            activeBhlItems.length > 0 ? (
                                                activeBhlItems.map((item, i) => (
                                                    <tr key={i}>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{i + 1}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px 8px', textAlign: 'left', verticalAlign: 'middle' }}>{item.name}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.unit}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle' }}>{item.quota}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center', verticalAlign: 'middle', fontWeight: 'bold' }}>{item.quantity}</td>
                                                        <td style={{ border: '1px solid #888', padding: '4px', verticalAlign: 'middle', fontSize: '9pt', lineHeight: 1.2 }}>
                                                            {item.spec} {item.serial ? `(Serial: ${item.serial})` : ''}
                                                        </td>
                                                        <td style={{ border: '1px solid #888', padding: '5px', verticalAlign: 'top', fontSize: '8.5pt', lineHeight: 1.35, wordWrap: 'break-word' }}>
                                                            {renderBhlItemNote(item)}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                <td colSpan={7} style={{ border: '1px solid #888', padding: '8px', textAlign: 'center', fontStyle: 'italic', color: '#666' }}>
                                                        Không có trang bị bảo hộ nào được chọn (Số lượng &gt; 0).
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                        <tr style={{ fontWeight: 'bold', background: '#f0f0f0' }}>
                                            <td colSpan={templateType === 'default' ? 2 : 4} style={{ border: '1px solid #888', padding: '4px', textAlign: 'center' }}>TỔNG</td>
                                            <td style={{ border: '1px solid #888', padding: '4px', textAlign: 'center' }}>{totalQty}</td>
                                            <td colSpan={templateType === 'default' ? 3 : 2} style={{ border: '1px solid #888', padding: '4px' }}></td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Disclaimer Note */}
                                <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 8, borderTop: '1px solid #ccc', paddingTop: 6 }}>
                                    Biên bản lập như nhau và có hiệu lực từ ngày ký, Đ/c kiểm tra trước khi xác nhận tài sản bàn giao ./.
                                </div>

                                {/* Double / Triple Signature Blocks */}
                                <div className="signatures" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, textAlign: 'center' }}>
                                    <div style={{ width: '30%' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>BÊN GIAO</div>
                                        <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                        <div className="sig-space" style={{ height: 45 }}></div>
                                    </div>
                                    <div style={{ width: '30%' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>BÊN NHẬN</div>
                                        <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                        <div className="sig-space" style={{ height: 45 }}></div>
                                    </div>
                                    <div style={{ width: '30%' }}>
                                        <div style={{ fontWeight: 'bold', fontSize: '11pt' }}>GIÁM ĐỐC TRUNG TÂM</div>
                                        <div style={{ fontStyle: 'italic', fontSize: '9.5pt', marginTop: 2 }}>(Ký, ghi rõ họ tên)</div>
                                        <div className="sig-space" style={{ height: 45 }}></div>
                                    </div>
                                </div>
                            </Box>
                        </Paper>
                    </Box>
                </Grid>

            </Grid>
            {/* Modal Import & In hàng loạt */}
            <AssetHandoverBatchModal
                open={batchModalOpen}
                onClose={() => setBatchModalOpen(false)}
                hrProfiles={hrProfiles}
                giverInfo={giverInfo}
                actionType={actionType}
                onBatchCompleted={fetchHistory}
            />

            {/* Modal Gõ tay tài sản ngoài danh sách */}
            <Dialog
                open={addAssetDialogOpen}
                onClose={() => setAddAssetDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontWeight: 700, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon sx={{ color: '#2563eb' }} /> Thêm tài sản ngoài danh sách (Mẫu mặc định)
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2.5} sx={{ pt: 1 }}>
                        {assets.length > 0 && (
                            <Autocomplete
                                options={assets}
                                getOptionLabel={(option) => `${option.asset_name} (${option.asset_code})${option.serial_number ? ` - SN: ${option.serial_number}` : ''}`}
                                value={selectedCatalogAsset}
                                onChange={(_, val) => handleSelectCatalogAsset(val)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Chọn nhanh từ danh mục tài sản kho (Không bắt buộc)"
                                        placeholder="Tìm theo tên hoặc mã tài sản..."
                                        size="small"
                                        helperText="Bạn có thể chọn tài sản có sẵn hoặc tự gõ thông tin bên dưới"
                                    />
                                )}
                            />
                        )}

                        <TextField
                            label="Tên tài sản *"
                            fullWidth
                            size="small"
                            required
                            value={newAssetForm.asset_name}
                            onChange={(e) => setNewAssetForm(prev => ({ ...prev, asset_name: e.target.value }))}
                            placeholder="VD: Máy đo suy hao quang, Kìm bấm cáp, Laptop Dell..."
                        />

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Mã tài sản"
                                    fullWidth
                                    size="small"
                                    value={newAssetForm.asset_code}
                                    onChange={(e) => setNewAssetForm(prev => ({ ...prev, asset_code: e.target.value }))}
                                    placeholder="VD: TS-001, CCDC-123..."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Số lượng"
                                    type="number"
                                    fullWidth
                                    size="small"
                                    value={newAssetForm.quantity}
                                    onChange={(e) => setNewAssetForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                                    inputProps={{ min: 1 }}
                                />
                            </Grid>
                        </Grid>

                        <Grid container spacing={2}>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Loại tài sản"
                                    fullWidth
                                    size="small"
                                    value={newAssetForm.asset_type}
                                    onChange={(e) => setNewAssetForm(prev => ({ ...prev, asset_type: e.target.value }))}
                                    placeholder="VD: CCDC, TBVP, Thiết bị đo..."
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6 }}>
                                <TextField
                                    label="Số Serial (nếu có)"
                                    fullWidth
                                    size="small"
                                    value={newAssetForm.serial_number}
                                    onChange={(e) => setNewAssetForm(prev => ({ ...prev, serial_number: e.target.value }))}
                                    placeholder="VD: SN202409..."
                                />
                            </Grid>
                        </Grid>

                        <TextField
                            label="Ghi chú"
                            fullWidth
                            size="small"
                            value={newAssetForm.note}
                            onChange={(e) => setNewAssetForm(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="VD: Kèm sạc, tình trạng mới 100%..."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={() => setAddAssetDialogOpen(false)} color="inherit" sx={{ textTransform: 'none' }}>
                        Hủy
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveNewAsset}
                        sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.3)',
                            px: 2.5
                        }}
                    >
                        Thêm vào danh sách
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AssetHandoverBhl;
