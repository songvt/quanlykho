import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Chip, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { Download, LayoutGrid, MapPinned, PackageSearch, Save, Search, Sparkles, Tag, Trash2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import PageHeader from '../../components/Common/PageHeader';
import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchTransactions, fetchTransactionsForce } from '../../store/slices/transactionsSlice';
import { fetchInventory } from '../../store/slices/inventorySlice';
import type { AppDispatch, RootState } from '../../store';

type Shelf = { id: string; zone: string; label: string };

const zones = [
    { id: 'A', title: 'Khu A · Hàng hóa', color: '#38bdf8' },
    { id: 'B', title: 'Khu B · Vật tư', color: '#a78bfa' },
    { id: 'C', title: 'Khu C · Thiết bị', color: '#34d399' },
    { id: 'D', title: 'Khu D · Chờ xử lý', color: '#fbbf24' },
    { id: 'E', title: 'Khu E · Hàng hóa', color: '#f472b6' },
];

const shelves: Shelf[] = zones.flatMap(zone => Array.from({ length: 6 }, (_, index) => ({
    id: `${zone.id}-${index + 1}`,
    zone: zone.id,
    label: `Kệ ${zone.id}${index + 1}`,
})));

const storageKey = 'qlkho_warehouse_shelf_assignments';
const shelfNameStorageKey = 'qlkho_warehouse_shelf_names';
const zoneNameStorageKey = 'qlkho_warehouse_zone_names';

const getShelfLabel = (shelf: Shelf, shelfNames: Record<string, string>) => shelfNames[shelf.id]?.trim() || shelf.label;
const getZoneTitle = (zone: typeof zones[number], zoneNames: Record<string, string>) => zoneNames[zone.id]?.trim() || zone.title;
const isUnitWarehouse = (warehouse?: string) => (warehouse || '').trim().toUpperCase().startsWith('KHO_DV_');

const suggestedShelf = (productId: string) => {
    let value = 0;
    for (const char of productId) value = (value * 31 + char.charCodeAt(0)) >>> 0;
    return shelves[value % shelves.length].id;
};

const WarehouseLayout: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const products = useSelector((state: RootState) => state.products.items);
    const productStatus = useSelector((state: RootState) => state.products.status);
    const transactions = useSelector((state: RootState) => state.transactions.items);
    const [search, setSearch] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [shelfNames, setShelfNames] = useState<Record<string, string>>({});
    const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
    const [selectedZoneId, setSelectedZoneId] = useState(zones[0].id);
    const [zoneNameDraft, setZoneNameDraft] = useState('');
    const [selectedShelfId, setSelectedShelfId] = useState(shelves[0].id);
    const [shelfNameDraft, setShelfNameDraft] = useState('');

    useEffect(() => {
        if (productStatus === 'idle') dispatch(fetchProducts());
        dispatch(fetchTransactions());
        dispatch(fetchInventory());
        try { setAssignments(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { setAssignments({}); }
        try { setShelfNames(JSON.parse(localStorage.getItem(shelfNameStorageKey) || '{}')); } catch { setShelfNames({}); }
        try { setZoneNames(JSON.parse(localStorage.getItem(zoneNameStorageKey) || '{}')); } catch { setZoneNames({}); }
    }, [dispatch, productStatus]);

    useEffect(() => {
        // Làm mới tồn kho đơn vị từ nguồn dữ liệu, kể cả khi thay đổi phát sinh ở máy khác.
        const refreshId = window.setInterval(() => { dispatch(fetchTransactionsForce()); }, 30_000);
        const refreshWhenVisible = () => { if (document.visibilityState === 'visible') dispatch(fetchTransactionsForce()); };
        document.addEventListener('visibilitychange', refreshWhenVisible);
        return () => {
            window.clearInterval(refreshId);
            document.removeEventListener('visibilitychange', refreshWhenVisible);
        };
    }, [dispatch]);

    const selectedShelf = shelves.find(shelf => shelf.id === selectedShelfId) || shelves[0];
    const selectedZone = zones.find(zone => zone.id === selectedZoneId) || zones[0];

    useEffect(() => {
        setShelfNameDraft(getShelfLabel(selectedShelf, shelfNames));
    }, [selectedShelf, shelfNames]); // Đồng bộ nội dung ô đặt tên khi người dùng chọn kệ khác.

    useEffect(() => {
        setZoneNameDraft(getZoneTitle(selectedZone, zoneNames));
    }, [selectedZone, zoneNames]);

    const unitStockRows = useMemo(() => {
        const next: Record<string, { productId: string; warehouseType: string; quantity: number }> = {};
        transactions.forEach(transaction => {
            if (!transaction.product_id || !isUnitWarehouse(transaction.warehouse_type)) return;
            const warehouseType = transaction.warehouse_type!.trim().toUpperCase();
            const key = `${transaction.product_id}|${warehouseType}`;
            const quantity = Number(transaction.quantity) || 0;
            if (!next[key]) next[key] = { productId: transaction.product_id, warehouseType, quantity: 0 };
            next[key].quantity += transaction.type === 'inbound' ? quantity : -quantity;
        });
        return Object.values(next).filter(row => row.quantity > 0);
    }, [transactions]);

    const productsWithStock = useMemo(() => products.flatMap(product => unitStockRows
        .filter(row => row.productId === product.id)
        // Chỉ những mặt hàng đã được người dùng gán (hoặc gán bằng nút gợi ý) mới hiện trên sơ đồ.
        // Số lượng vẫn được đọc trực tiếp từ tồn kho hiện hành ở Redux.
        .map(row => ({ ...product, quantity: row.quantity, shelfId: assignments[`${product.id}|${row.warehouseType}`] || '', warehouseType: row.warehouseType, assignmentKey: `${product.id}|${row.warehouseType}` }))), [products, unitStockRows, assignments]);

    const assignedProducts = useMemo(() => productsWithStock.filter(product => product.shelfId), [productsWithStock]);

    const matchedProducts = useMemo(() => {
        const term = search.trim().toLowerCase();
        const unassignedProducts = productsWithStock.filter(product => !product.shelfId);
        if (!term) return unassignedProducts;
        return unassignedProducts.filter(product => product.name.toLowerCase().includes(term) || product.item_code.toLowerCase().includes(term) || product.warehouseType.toLowerCase().includes(term));
    }, [productsWithStock, search]);

    const assignedSerialRows = useMemo(() => {
        const outboundSerials = new Set(transactions
            .filter(transaction => transaction.type === 'outbound' && transaction.serial_code)
            .map(transaction => transaction.serial_code!.trim().toUpperCase()));
        const serialRows = new Map<string, { productId: string; itemCode: string; productName: string; warehouseType: string; serialCode: string; shelfId: string }>();
        transactions.forEach(transaction => {
            const serialCode = transaction.serial_code?.trim();
            if (transaction.type !== 'inbound' || !transaction.product_id || !serialCode || !isUnitWarehouse(transaction.warehouse_type) || outboundSerials.has(serialCode.toUpperCase())) return;
            const warehouseType = transaction.warehouse_type!.trim().toUpperCase();
            const assignmentKey = `${transaction.product_id}|${warehouseType}`;
            const shelfId = assignments[assignmentKey];
            if (!shelfId) return;
            const product = products.find(item => item.id === transaction.product_id);
            serialRows.set(`${assignmentKey}|${serialCode.toUpperCase()}`, {
                productId: transaction.product_id,
                itemCode: product?.item_code || '',
                productName: product?.name || transaction.product_name || '',
                warehouseType,
                serialCode,
                shelfId,
            });
        });
        return [...serialRows.values()];
    }, [transactions, assignments, products]);

    const saveAssignment = (productId: string, shelfId: string) => {
        const next = { ...assignments };
        if (shelfId) next[productId] = shelfId;
        else delete next[productId];
        setAssignments(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const optimizeLayout = () => {
        const next: Record<string, string> = {};
        productsWithStock.forEach(product => { next[product.assignmentKey] = suggestedShelf(product.assignmentKey); });
        setAssignments(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const clearAssignments = () => {
        if (!window.confirm('Xóa toàn bộ phân bổ mặt hàng vào kệ? Thao tác này chỉ xóa vị trí gán, không xóa tồn kho, hàng hóa hoặc chứng từ.')) return;
        setAssignments({});
        setSelectedProductId('');
        localStorage.removeItem(storageKey);
    };

    const removeAssignment = (assignmentKey: string, productName: string) => {
        if (!window.confirm(`Gỡ "${productName}" khỏi kệ ${getShelfLabel(selectedShelf, shelfNames)}? Hàng sẽ trở lại danh sách chờ gán.`)) return;
        saveAssignment(assignmentKey, '');
    };

    const saveShelfName = () => {
        const name = shelfNameDraft.trim();
        const next = { ...shelfNames };
        if (name && name !== selectedShelf.label) next[selectedShelf.id] = name;
        else delete next[selectedShelf.id];
        setShelfNames(next);
        localStorage.setItem(shelfNameStorageKey, JSON.stringify(next));
    };

    const saveZoneName = () => {
        const name = zoneNameDraft.trim();
        const next = { ...zoneNames };
        if (name && name !== selectedZone.title) next[selectedZone.id] = name;
        else delete next[selectedZone.id];
        setZoneNames(next);
        localStorage.setItem(zoneNameStorageKey, JSON.stringify(next));
    };

    const exportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'QL Kho';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet('So do kho');
        sheet.columns = [
            { header: 'Khu vực', key: 'zone', width: 22 },
            { header: 'Mã kệ', key: 'shelfCode', width: 12 },
            { header: 'Tên / vị trí kệ', key: 'shelfName', width: 28 },
            { header: 'Mã hàng', key: 'itemCode', width: 18 },
            { header: 'Tên hàng hóa / vật tư', key: 'productName', width: 38 },
            { header: 'Kho đơn vị', key: 'warehouse', width: 24 },
            { header: 'Đơn vị tính', key: 'unit', width: 16 },
            { header: 'Tồn kho', key: 'quantity', width: 16 },
        ];
        sheet.mergeCells('A1:H1');
        const title = sheet.getCell('A1');
        title.value = 'BÁO CÁO SƠ ĐỒ SẮP XẾP KHO ĐƠN VỊ';
        title.font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } };
        title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
        title.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 28;
        sheet.mergeCells('A2:H2');
        sheet.getCell('A2').value = `Ngày xuất: ${new Date().toLocaleString('vi-VN')} · Bao gồm cả các kệ chưa có hàng`;
        sheet.getCell('A2').font = { italic: true, color: { argb: 'FF475569' } };
        sheet.getCell('A2').alignment = { horizontal: 'center' };
        const header = sheet.getRow(3);
        header.values = ['Khu vực', 'Mã kệ', 'Tên / vị trí kệ', 'Mã hàng', 'Tên hàng hóa / vật tư', 'Kho đơn vị', 'Đơn vị tính', 'Tồn kho'];
        header.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });

        shelves.forEach(shelf => {
            const zone = zones.find(item => item.id === shelf.zone);
            const items = productsWithStock.filter(product => product.shelfId === shelf.id);
            const common = [zone ? getZoneTitle(zone, zoneNames) : shelf.zone, shelf.id, getShelfLabel(shelf, shelfNames)];
            if (!items.length) sheet.addRow([...common, '', 'Chưa gán hàng hóa', '', '', 0]);
            else items.forEach(product => sheet.addRow([...common, product.item_code, product.name, product.warehouseType, product.unit || '', product.quantity]));
        });
        for (let index = 4; index <= sheet.rowCount; index += 1) {
            const row = sheet.getRow(index);
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
                cell.alignment = { vertical: 'middle', wrapText: true };
            });
            row.getCell(8).numFmt = '#,##0';
        }
        sheet.views = [{ state: 'frozen', ySplit: 3 }];

        const unassigned = workbook.addWorksheet('Chua gan vi tri');
        unassigned.columns = [
            { header: 'Mã hàng', key: 'itemCode', width: 20 },
            { header: 'Tên hàng hóa / vật tư', key: 'productName', width: 42 },
            { header: 'Kho đơn vị', key: 'warehouse', width: 24 },
            { header: 'Đơn vị tính', key: 'unit', width: 16 },
            { header: 'Tồn kho', key: 'quantity', width: 16 },
        ];
        const unassignedHeader = unassigned.getRow(1);
        unassignedHeader.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF64748B' } };
        });
        productsWithStock.filter(product => !product.shelfId).forEach(product => unassigned.addRow([product.item_code, product.name, product.warehouseType, product.unit || '', product.quantity]));
        unassigned.getColumn(5).numFmt = '#,##0';
        unassigned.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `So_do_kho_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const exportAssignedSerials = async () => {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'QL Kho';
        const sheet = workbook.addWorksheet('Serial da gan ke');
        sheet.columns = [
            { header: 'Khu vực', key: 'zone', width: 22 },
            { header: 'Mã kệ', key: 'shelfCode', width: 14 },
            { header: 'Tên kệ', key: 'shelfName', width: 26 },
            { header: 'Kho đơn vị', key: 'warehouse', width: 20 },
            { header: 'Mã hàng', key: 'itemCode', width: 18 },
            { header: 'Tên hàng hóa / vật tư', key: 'productName', width: 42 },
            { header: 'Serial', key: 'serial', width: 28 },
        ];
        const header = sheet.getRow(1);
        header.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        });
        assignedSerialRows.forEach(row => {
            const shelf = shelves.find(item => item.id === row.shelfId);
            const zone = zones.find(item => item.id === shelf?.zone);
            sheet.addRow([zone ? getZoneTitle(zone, zoneNames) : '', row.shelfId, shelf ? getShelfLabel(shelf, shelfNames) : row.shelfId, row.warehouseType, row.itemCode, row.productName, row.serialCode]);
        });
        for (let index = 2; index <= sheet.rowCount; index += 1) {
            sheet.getRow(index).eachCell(cell => {
                cell.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
                cell.alignment = { vertical: 'middle', wrapText: true };
            });
        }
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Serial_da_gan_ke_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const totalStock = assignedProducts.reduce((total, product) => total + product.quantity, 0);
    const activeShelves = new Set(assignedProducts.map(product => product.shelfId)).size;
    const selectedShelfItems = useMemo(() => assignedProducts.filter(product => product.shelfId === selectedShelf.id), [assignedProducts, selectedShelf]);
    const selectedShelfQuantity = selectedShelfItems.reduce((total, product) => total + product.quantity, 0);

    const clearSelectedShelfAssignments = () => {
        if (!selectedShelfItems.length) return;
        if (!window.confirm(`Gỡ toàn bộ ${selectedShelfItems.length} mặt hàng khỏi ${getShelfLabel(selectedShelf, shelfNames)}? Hàng sẽ trở lại danh sách chờ gán.`)) return;
        const next = { ...assignments };
        selectedShelfItems.forEach(product => delete next[product.assignmentKey]);
        setAssignments(next);
        setSelectedProductId('');
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    return (
        <Box p={{ xs: 1.5, sm: 3 }}>
            <PageHeader
                title="SƠ ĐỒ KHO THÔNG MINH"
                subtitle="Tra cứu vị trí kệ và phân bổ hàng hóa theo tồn kho đơn vị (KHO_DV)"
                icon={<MapPinned size={28} color="white" />}
                gradientType="blue"
                actions={<Stack direction="row" spacing={1} flexWrap="wrap"><Button variant="contained" disabled={!assignedSerialRows.length} onClick={exportAssignedSerials} startIcon={<Download size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>Xuất serial đã gán</Button><Button variant="contained" onClick={clearAssignments} startIcon={<Trash2 size={17} />} sx={{ bgcolor: 'rgba(220,38,38,.86)', border: '1px solid rgba(254,202,202,.5)', color: 'white' }}>Xóa gán kệ</Button><Button variant="contained" onClick={exportExcel} startIcon={<Download size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>Xuất Excel</Button><Button variant="contained" onClick={optimizeLayout} startIcon={<Sparkles size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', color: 'white' }}>Gợi ý sắp xếp</Button></Stack>}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2.5}>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(30, 58, 138, .22)' }}><Typography color="#bfdbfe" variant="caption">TỒN KHO ĐƠN VỊ ĐƯỢC GÁN VỊ TRÍ</Typography><Typography variant="h5" fontWeight={800}>{totalStock.toLocaleString('vi-VN')} đơn vị</Typography></Paper>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(6, 78, 59, .22)' }}><Typography color="#a7f3d0" variant="caption">KỆ ĐANG SỬ DỤNG</Typography><Typography variant="h5" fontWeight={800}>{activeShelves}/{shelves.length} kệ</Typography></Paper>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(88, 28, 135, .22)' }}><Typography color="#ddd6fe" variant="caption">DÒNG TỒN KHO / ĐÃ GÁN</Typography><Typography variant="h5" fontWeight={800}>{productsWithStock.length} / {assignedProducts.length}</Typography></Paper>
            </Stack>

            <Box display="grid" gridTemplateColumns={{ xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.65fr) minmax(330px, .85fr)' }} gap={2.5} alignItems="start">
                <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0, overflow: 'hidden' }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}><LayoutGrid size={20} color="#60a5fa" /><Typography fontWeight={800}>Bản đồ vị trí kệ</Typography><Chip size="small" label="Cập nhật theo tồn kho" color="primary" variant="outlined" /></Stack>
                    <Box display="grid" gridTemplateColumns={{ xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' }} gap={2}>
                        {zones.map(zone => <Box key={zone.id} sx={{ minWidth: 0, overflow: 'hidden', border: `1px solid ${zone.color}44`, borderRadius: 2, p: 1.5, bgcolor: `${zone.color}0d` }}>
                            <Typography fontWeight={700} fontSize=".85rem" color={zone.color} mb={1.25} noWrap>{getZoneTitle(zone, zoneNames)}</Typography>
                            <Box display="grid" gridTemplateColumns="repeat(3, minmax(0, 1fr))" gap={1}>
                                {shelves.filter(shelf => shelf.zone === zone.id).map(shelf => {
                                    const items = assignedProducts.filter(product => product.shelfId === shelf.id);
                                    const quantity = items.reduce((sum, product) => sum + product.quantity, 0);
                                    return <Box key={shelf.id} onClick={() => setSelectedShelfId(shelf.id)} sx={{ cursor: 'pointer', minWidth: 0, overflow: 'hidden', minHeight: 96, borderRadius: 1.5, p: 1, border: `2px solid ${selectedShelfId === shelf.id ? '#60a5fa' : items.length ? zone.color : 'rgba(148,163,184,.25)'}`, bgcolor: items.length ? `${zone.color}18` : 'rgba(15,23,42,.4)', transition: 'all .15s' }}>
                                        <Typography fontSize=".68rem" fontWeight={800} noWrap>{getShelfLabel(shelf, shelfNames)}</Typography>
                                        <Typography fontSize=".72rem" color="text.secondary" mt={.75}>{items.length ? `${items.length} mặt hàng` : 'Trống'}</Typography>
                                        {items.length > 0 && <Typography fontSize=".72rem" color={zone.color} fontWeight={800}>{quantity.toLocaleString('vi-VN')} SL</Typography>}
                                        {items.slice(0, 2).map(item => <Typography key={item.id} fontSize=".62rem" lineHeight={1.25} noWrap title={`${item.item_code} — ${item.name}`}>{item.name}</Typography>)}
                                        {items.length > 2 && <Typography fontSize=".62rem" color="text.secondary">+{items.length - 2} mặt hàng khác</Typography>}
                                    </Box>;
                                })}
                            </Box>
                        </Box>)}
                    </Box>
                    <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderColor: 'rgba(96,165,250,.38)', bgcolor: 'rgba(15,23,42,.36)' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={.75} mb={1.25}>
                            <Stack direction="row" alignItems="center" spacing={1}><PackageSearch size={18} color="#60a5fa" /><Typography fontWeight={800} fontSize=".9rem">Chi tiết {getShelfLabel(selectedShelf, shelfNames)}</Typography></Stack>
                            <Stack direction="row" alignItems="center" spacing={1}><Typography variant="caption" color="text.secondary">{selectedShelfItems.length} mặt hàng · {selectedShelfQuantity.toLocaleString('vi-VN')} đơn vị</Typography><Button size="small" color="error" variant="outlined" disabled={!selectedShelfItems.length} onClick={clearSelectedShelfAssignments} startIcon={<Trash2 size={14} />}>Xóa gán kệ này</Button></Stack>
                        </Stack>
                        {selectedShelfItems.length > 0 ? <Stack spacing={.75} maxHeight={230} overflow="auto" pr={.5}>
                            {selectedShelfItems.map(product => <Box key={product.assignmentKey} sx={{ px: 1, py: .8, borderRadius: 1, bgcolor: 'rgba(59,130,246,.08)', border: '1px solid rgba(96,165,250,.18)' }}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center"><Box minWidth={0}><Typography fontSize=".8rem" fontWeight={700} noWrap>{product.name}</Typography><Typography fontSize=".7rem" color="text.secondary">{product.item_code}</Typography><Typography fontSize=".68rem" color="primary.main" noWrap>Kho: {product.warehouseType}</Typography></Box><Stack direction="row" alignItems="center" spacing={.25}><Chip size="small" label={`${product.quantity.toLocaleString('vi-VN')} ${product.unit || ''}`} /><Tooltip title="Gỡ khỏi kệ"><IconButton size="small" color="error" aria-label={`Gỡ ${product.name} khỏi kệ`} onClick={() => removeAssignment(product.assignmentKey, product.name)}><Trash2 size={16} /></IconButton></Tooltip></Stack></Stack>
                            </Box>)}
                        </Stack> : <Typography variant="body2" color="text.secondary" py={1}>Kệ này chưa được gán vật tư hoặc hàng hóa.</Typography>}
                    </Paper>
                    <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderColor: 'rgba(96,165,250,.35)', bgcolor: 'rgba(30,58,138,.08)' }}>
                        <Stack direction="row" alignItems="center" spacing={1} mb={1.25}><Tag size={18} color="#60a5fa" /><Typography fontWeight={800} fontSize=".9rem">Đặt tên khu & vị trí kệ</Typography></Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={1.25}>
                            <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Chọn khu</InputLabel><Select value={selectedZone.id} label="Chọn khu" onChange={event => setSelectedZoneId(event.target.value)}>{zones.map(zone => <MenuItem key={zone.id} value={zone.id}>{zone.id} — {getZoneTitle(zone, zoneNames)}</MenuItem>)}</Select></FormControl>
                            <TextField size="small" fullWidth label="Tên / mô tả khu" value={zoneNameDraft} onChange={event => setZoneNameDraft(event.target.value)} inputProps={{ maxLength: 60 }} />
                            <Button variant="contained" onClick={saveZoneName} startIcon={<Save size={16} />} sx={{ whiteSpace: 'nowrap' }}>Lưu khu</Button>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <FormControl size="small" sx={{ minWidth: 130 }}><InputLabel>Chọn kệ</InputLabel><Select value={selectedShelf.id} label="Chọn kệ" onChange={event => setSelectedShelfId(event.target.value)}>{shelves.map(shelf => <MenuItem key={shelf.id} value={shelf.id}>{shelf.id} — {getShelfLabel(shelf, shelfNames)}</MenuItem>)}</Select></FormControl>
                            <TextField size="small" fullWidth label="Tên / mô tả vị trí" value={shelfNameDraft} onChange={event => setShelfNameDraft(event.target.value)} inputProps={{ maxLength: 60 }} />
                            <Button variant="contained" onClick={saveShelfName} startIcon={<Save size={16} />} sx={{ whiteSpace: 'nowrap' }}>Lưu tên</Button>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>Tên khu, tên vị trí và thao tác gán hàng được lưu cục bộ trên trình duyệt; không thay đổi số lượng tồn hoặc chứng từ xuất nhập.</Typography>
                    </Paper>
                </Paper>

                <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0, width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} mb={1}><Stack direction="row" alignItems="center" spacing={1}><PackageSearch size={20} color="#60a5fa" /><Typography fontWeight={800}>Tra cứu & gán vị trí</Typography></Stack><Chip size="small" label={`${matchedProducts.length} mặt hàng`} /></Stack>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>Đang chọn: <Box component="span" color="primary.main" fontWeight={800}>{getShelfLabel(selectedShelf, shelfNames)}</Box>. Chỉ hiển thị tồn kho đơn vị (KHO_DV_*); bấm nút gán để đưa hàng vào kệ này.</Typography>
                    <TextField fullWidth size="small" placeholder="Tên hàng hoặc mã SKU..." value={search} onChange={event => setSearch(event.target.value)} InputProps={{ startAdornment: <Search size={18} style={{ marginRight: 8, color: '#94a3b8' }} /> }} />
                    <Stack spacing={1} mt={1.5} maxHeight={370} overflow="auto">
                        {matchedProducts.map(product => <Box key={product.assignmentKey} sx={{ p: 1.25, borderRadius: 1.5, border: '1px solid rgba(148,163,184,.18)', bgcolor: selectedProductId === product.assignmentKey ? 'rgba(59,130,246,.12)' : 'transparent', cursor: 'pointer' }} onClick={() => setSelectedProductId(product.assignmentKey)}>
                            <Typography fontWeight={700} fontSize=".82rem" noWrap>{product.name}</Typography>
                            <Stack direction="row" justifyContent="space-between" mt={.4}><Typography fontSize=".72rem" color="text.secondary">{product.item_code}</Typography><Chip size="small" label={`${product.quantity.toLocaleString('vi-VN')} ${product.unit || ''}`} /></Stack>
                            <Typography fontSize=".7rem" color="primary.main" mt={.55} noWrap>Thuộc kho: {product.warehouseType}</Typography>
                            <Button size="small" variant={product.shelfId === selectedShelf.id ? 'contained' : 'outlined'} disabled={product.shelfId === selectedShelf.id} sx={{ mt: 1, textTransform: 'none' }} onClick={event => { event.stopPropagation(); saveAssignment(product.assignmentKey, selectedShelf.id); setSelectedProductId(product.assignmentKey); }}>{product.shelfId === selectedShelf.id ? 'Đã ở kệ này' : product.shelfId ? `Chuyển vào ${getShelfLabel(selectedShelf, shelfNames)}` : `Gán vào ${getShelfLabel(selectedShelf, shelfNames)}`}</Button>
                            {selectedProductId === product.assignmentKey && <FormControl size="small" fullWidth sx={{ mt: 1 }}><InputLabel>Gán vào vị trí kệ</InputLabel><Select value={product.shelfId} label="Gán vào vị trí kệ" onChange={event => saveAssignment(product.assignmentKey, event.target.value)}><MenuItem value=""><em>Chưa gán vị trí</em></MenuItem>{shelves.map(shelf => <MenuItem key={shelf.id} value={shelf.id}>{getShelfLabel(shelf, shelfNames)}</MenuItem>)}</Select></FormControl>}
                        </Box>)}
                        {!matchedProducts.length && <Typography py={4} textAlign="center" color="text.secondary">Không tìm thấy mặt hàng có tồn.</Typography>}
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
};

export default WarehouseLayout;
