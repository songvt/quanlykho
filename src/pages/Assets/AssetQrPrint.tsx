import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    Alert, Autocomplete, Box, Button, Chip, Divider, Paper, Stack,
    TextField, Typography,
} from '@mui/material';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import PrintIcon from '@mui/icons-material/Print';
import AddIcon from '@mui/icons-material/Add';
import { QRCodeSVG } from 'qrcode.react';

import type { AppDispatch, RootState } from '../../store';
import type { Asset } from '../../types';
import { fetchAssets } from '../../store/slices/assetsSlice';
import { useNotification } from '../../contexts/NotificationContext';
import { readExcelFile } from '../../utils/excelUtils';
import { sortAssetsByNameAndUser } from '../../utils/assetSorting';

const normalizeCode = (value: unknown) => String(value || '').trim().toLocaleUpperCase('vi');

const AssetQrPrint = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: assets, status } = useSelector((state: RootState) => state.assets);
    const { error: notifyError, success } = useNotification();
    const printRef = useRef<HTMLDivElement>(null);

    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
    const [assetType, setAssetType] = useState<'all' | 'ccdc' | 'tbvp'>('all');
    const [printAssetIds, setPrintAssetIds] = useState<string[]>([]);

    useEffect(() => {
        if (status === 'idle') dispatch(fetchAssets());
    }, [dispatch, status]);

    const assetsByCode = useMemo(
        () => new Map(assets.map(asset => [normalizeCode(asset.asset_code), asset])),
        [assets],
    );

    const employees = useMemo(() => Array.from(new Set(
        assets.map(asset => asset.user_employee_name?.trim()).filter((name): name is string => Boolean(name)),
    )).sort((a, b) => a.localeCompare(b, 'vi', { sensitivity: 'base' })), [assets]);

    const selectedAssets = useMemo(() => sortAssetsByNameAndUser(
        printAssetIds.map(id => assets.find(asset => asset.id === id)).filter((asset): asset is Asset => Boolean(asset)),
    ), [assets, printAssetIds]);

    const addAssets = (items: Asset[]) => {
        const currentIds = new Set(printAssetIds);
        const newIds = items.map(item => item.id).filter(id => !currentIds.has(id));
        if (!newIds.length) {
            notifyError('Các tài sản này đã có trong danh sách in.');
            return;
        }
        setPrintAssetIds(previous => [...previous, ...newIds]);
        success(`Đã thêm ${newIds.length} mã QR tài sản vào danh sách in.`);
    };

    const addSingleAsset = () => {
        if (!selectedAsset) {
            notifyError('Vui lòng chọn một tài sản để in mã QR.');
            return;
        }
        addAssets([selectedAsset]);
        setSelectedAsset(null);
    };

    const addAssetsByEmployee = () => {
        if (!selectedEmployee) {
            notifyError('Vui lòng chọn tên nhân viên.');
            return;
        }

        const normalizedEmployee = selectedEmployee.trim().toLocaleLowerCase('vi');
        const matchingAssets = assets.filter(asset => {
            const employeeMatches = (asset.user_employee_name || '').trim().toLocaleLowerCase('vi') === normalizedEmployee;
            const typeValue = `${asset.asset_group || ''} ${asset.asset_type || ''}`.toLocaleLowerCase('vi');
            const typeMatches = assetType === 'all'
                || (assetType === 'ccdc' && typeValue.includes('ccdc'))
                || (assetType === 'tbvp' && typeValue.includes('tbvp'));
            return employeeMatches && typeMatches;
        });

        if (!matchingAssets.length) {
            notifyError('Không tìm thấy tài sản phù hợp với nhân viên và loại tài sản đã chọn.');
            return;
        }
        addAssets(matchingAssets);
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const rows = await readExcelFile(file);
            const codes = rows.map(row => normalizeCode(
                row['Mã tài sản'] ?? row['MÃ TÀI SẢN'] ?? row['MA_TAI_SAN'] ?? row.asset_code ?? Object.values(row)[0],
            )).filter(Boolean);
            const uniqueCodes = [...new Set(codes)];
            const foundAssets = uniqueCodes.map(code => assetsByCode.get(code)).filter((asset): asset is Asset => Boolean(asset));
            const missingCount = uniqueCodes.length - foundAssets.length;

            if (!foundAssets.length) {
                notifyError('Không tìm thấy mã tài sản nào trong file Excel. File cần có cột “Mã tài sản”.');
                return;
            }
            addAssets(foundAssets);
            if (missingCount > 0) notifyError(`${missingCount} mã trong file chưa có trên hệ thống nên không được thêm.`);
        } catch (error: any) {
            notifyError(`Không thể đọc file Excel: ${error.message || 'Định dạng không hợp lệ'}`);
        } finally {
            event.target.value = '';
        }
    };

    const handlePrint = () => {
        if (!selectedAssets.length || !printRef.current) {
            notifyError('Danh sách in đang trống.');
            return;
        }
        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (!printWindow) {
            notifyError('Không thể mở cửa sổ in. Vui lòng cho phép cửa sổ bật lên.');
            return;
        }
        printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>In mã QR tài sản</title>
            <style>@page { size: A4 portrait; margin: 8mm 12mm; } * { box-sizing: border-box; } body { margin: 0; font-family: 'Times New Roman', serif; color: #000; } .qr-print-title { font-size: 14pt; font-weight: 700; text-align: center; margin: 0 0 4mm; } .qr-print-subtitle { font-size: 10pt; text-align: center; margin: 0 0 5mm; } .qr-print-row { display: grid; grid-template-columns: 24% 52% 24%; min-height: 26mm; border-bottom: 1px solid #d1d5db; page-break-inside: avoid; align-items: center; } .qr-print-code { font-size: 11pt; font-weight: 700; text-align: center; word-break: break-word; padding: 3mm; } .qr-print-name { font-size: 11pt; text-align: center; padding: 3mm; } .qr-print-user { font-size: 9pt; margin-top: 1mm; color: #444; } .qr-print-image { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1mm; } .qr-print-image svg { width: 19mm; height: 19mm; shape-rendering: crispEdges; } .qr-print-caption { font: 7pt Arial, sans-serif; margin-top: 0.5mm; text-align: center; }</style>
            </head><body>${printRef.current.innerHTML}<script>window.onload = () => window.print();</script></body></html>`);
        printWindow.document.close();
    };

    return (
        <Box p={{ xs: 1, sm: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} mb={3}>
                <Box>
                    <Typography variant="h4" fontWeight={900} color="primary">IN MÃ QR TÀI SẢN</Typography>
                    <Typography color="text.secondary">Chọn lẻ, nhập Excel mã tài sản hoặc lập danh sách theo nhân viên để in.</Typography>
                </Box>
                <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint} disabled={!selectedAssets.length}>
                    In {selectedAssets.length || ''} mã QR
                </Button>
            </Stack>

            <Stack spacing={2}>
                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography fontWeight={800} mb={1.5}><QrCode2Icon sx={{ verticalAlign: 'middle', mr: 1 }} />Thêm mã QR đơn lẻ</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                        <Autocomplete
                            options={sortAssetsByNameAndUser(assets)}
                            value={selectedAsset}
                            onChange={(_, value) => setSelectedAsset(value)}
                            getOptionLabel={asset => `${asset.asset_code} — ${asset.asset_name}`}
                            renderInput={params => <TextField {...params} label="Mã hoặc tên tài sản" placeholder="Tìm tài sản..." />}
                            sx={{ flex: 1 }}
                            loading={status === 'loading'}
                        />
                        <Button variant="contained" startIcon={<AddIcon />} onClick={addSingleAsset}>Thêm vào danh sách in</Button>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography fontWeight={800} mb={1.5}><CloudUploadIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Nhập danh sách từ Excel</Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={1.5}>
                        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />}>
                            Chọn file Excel
                            <input hidden type="file" accept=".xlsx,.xls" onChange={handleImport} />
                        </Button>
                        <Typography variant="body2" color="text.secondary">File cần có cột <b>Mã tài sản</b>; mỗi dòng là một mã cần in.</Typography>
                    </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
                    <Typography fontWeight={800} mb={1.5}><PersonSearchIcon sx={{ verticalAlign: 'middle', mr: 1 }} />Thêm toàn bộ theo nhân viên</Typography>
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                        <Autocomplete options={employees} value={selectedEmployee} onChange={(_, value) => setSelectedEmployee(value)} renderInput={params => <TextField {...params} label="Tên nhân viên" />} sx={{ flex: 1 }} />
                        <TextField select label="Loại CCDC - TBVP" value={assetType} onChange={event => setAssetType(event.target.value as typeof assetType)} SelectProps={{ native: true }} sx={{ minWidth: 210 }}>
                            <option value="all">Tất cả</option><option value="ccdc">CCDC</option><option value="tbvp">TBVP</option>
                        </TextField>
                        <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={addAssetsByEmployee}>Thêm tài sản nhân viên</Button>
                    </Stack>
                </Paper>
            </Stack>

            <Paper variant="outlined" sx={{ mt: 3, p: 2.5, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} mb={2}>
                    <Typography fontWeight={800}>Danh sách chờ in ({selectedAssets.length})</Typography>
                    <Button color="error" startIcon={<DeleteSweepIcon />} onClick={() => setPrintAssetIds([])} disabled={!selectedAssets.length}>Xóa danh sách</Button>
                </Stack>
                {!selectedAssets.length ? <Alert severity="info">Chưa có tài sản nào trong danh sách in.</Alert> : (
                    <Stack direction="row" flexWrap="wrap" gap={1}>
                        {selectedAssets.map(asset => <Chip key={asset.id} label={`${asset.asset_code} — ${asset.asset_name}`} onDelete={() => setPrintAssetIds(previous => previous.filter(id => id !== asset.id))} />)}
                    </Stack>
                )}
            </Paper>

            <Box ref={printRef} sx={{ display: 'none' }}>
                <div className="qr-print-title">DANH SÁCH MÃ QR TÀI SẢN</div>
                <div className="qr-print-subtitle">Mã tài sản — Tên tài sản — Mã QR</div>
                {selectedAssets.map(asset => (
                    <div className="qr-print-row" key={asset.id}>
                        <div className="qr-print-code">{asset.asset_code}</div>
                        <div className="qr-print-name">{asset.asset_name}<div className="qr-print-user">{asset.user_employee_name || 'Chưa phân người sử dụng'}</div></div>
                        <div className="qr-print-image"><QRCodeSVG value={asset.asset_code} level="M" includeMargin={false} /><div className="qr-print-caption">{asset.asset_code}</div></div>
                    </div>
                ))}
            </Box>
        </Box>
    );
};

export default AssetQrPrint;
