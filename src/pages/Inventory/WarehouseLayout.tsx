import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Box, Button, Chip, CircularProgress, FormControl, IconButton, InputLabel, MenuItem, Paper, Select, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { CloudCheck, Download, LayoutGrid, MapPinned, PackageSearch, RefreshCw, Save, Search, Sparkles, Tag, Trash2, Upload } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import PageHeader from '../../components/Common/PageHeader';
import { fetchProducts } from '../../store/slices/productsSlice';
import { fetchTransactions, fetchTransactionsForce } from '../../store/slices/transactionsSlice';
import { fetchInventory, selectStockMap } from '../../store/slices/inventorySlice';
import { supabase } from '../../config/supabase';
import { useNotification } from '../../contexts/NotificationContext';
import { readExcelFile } from '../../utils/excelUtils';
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
const serialAssignmentStorageKey = 'qlkho_warehouse_serial_assignments';
const CLOUD_CONFIG_KEY = 'WAREHOUSE_LAYOUT_CONFIG';
const EXCEL_FONT = { name: 'Times New Roman', size: 12 };

const applyExcelFont = (worksheet: ExcelJS.Worksheet) => {
    worksheet.eachRow({ includeEmpty: false }, row => {
        row.eachCell({ includeEmpty: false }, cell => {
            cell.font = { ...cell.font, ...EXCEL_FONT };
        });
    });
};

const getShelfLabel = (shelf: Shelf, shelfNames: Record<string, string>) => shelfNames[shelf.id]?.trim() || shelf.label;
const getZoneTitle = (zone: typeof zones[number], zoneNames: Record<string, string>) => zoneNames[zone.id]?.trim() || zone.title;
const resolveWarehouseType = (transaction: { warehouse_type?: string; district?: string }) => {
    const rawWh = (transaction.warehouse_type || '').trim().toUpperCase();
    if (rawWh.startsWith('KHO_DV_')) return rawWh;
    const rawDistrict = (transaction.district || '').trim().toUpperCase();
    if (rawDistrict) return `KHO_DV_${rawDistrict}`;
    return 'KHO_DV_Q12'; // Fallback về kho đơn vị mặc định
};

const suggestedShelf = (productId: string) => {
    let value = 0;
    for (const char of productId) value = (value * 31 + char.charCodeAt(0)) >>> 0;
    return shelves[value % shelves.length].id;
};

const WarehouseLayout: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { success, error: notifyError } = useNotification();
    const products = useSelector((state: RootState) => state.products.items);
    const productStatus = useSelector((state: RootState) => state.products.status);
    const transactions = useSelector((state: RootState) => state.transactions.items);
    // Dùng đúng selector của màn hình Tồn kho để mọi số lượng hiển thị nhất quán,
    // gồm cả quy tắc lọc kho và khấu trừ các phiếu đang chờ xử lý.
    const stockMap = useSelector(selectStockMap);
    const [search, setSearch] = useState('');
    const [selectedProductId, setSelectedProductId] = useState('');
    const [assignments, setAssignments] = useState<Record<string, string>>({});
    const [serialAssignments, setSerialAssignments] = useState<Record<string, string>>({});
    const [shelfNames, setShelfNames] = useState<Record<string, string>>({});
    const [zoneNames, setZoneNames] = useState<Record<string, string>>({});
    const [selectedZoneId, setSelectedZoneId] = useState(zones[0].id);
    const [zoneNameDraft, setZoneNameDraft] = useState('');
    const [selectedShelfId, setSelectedShelfId] = useState(shelves[0].id);
    const [shelfNameDraft, setShelfNameDraft] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [cloudSynced, setCloudSynced] = useState(false);

    // Dùng ref để lưu trữ state mới nhất tránh stale closure khi auto-save
    const stateRef = useRef({ assignments, serialAssignments, shelfNames, zoneNames });
    useEffect(() => {
        stateRef.current = { assignments, serialAssignments, shelfNames, zoneNames };
    }, [assignments, serialAssignments, shelfNames, zoneNames]);

    // Hàm đồng bộ lên Supabase Cloud
    const syncToCloud = async (
        newAssignments?: Record<string, string>,
        newShelfNames?: Record<string, string>,
        newZoneNames?: Record<string, string>,
        newSerialAssignments?: Record<string, string>
    ) => {
        const payloadToSave = {
            assignments: newAssignments ?? stateRef.current.assignments,
            serialAssignments: newSerialAssignments ?? stateRef.current.serialAssignments,
            shelfNames: newShelfNames ?? stateRef.current.shelfNames,
            zoneNames: newZoneNames ?? stateRef.current.zoneNames,
            updated_at: new Date().toISOString()
        };
        try {
            setIsSyncing(true);
            const { error } = await supabase.from('district_storekeepers').upsert({
                district: CLOUD_CONFIG_KEY,
                storekeeper_name: JSON.stringify(payloadToSave),
                updated_at: new Date().toISOString()
            });
            if (error) {
                console.error('Lỗi lưu cấu hình sơ đồ kho lên Supabase:', error);
            } else {
                setCloudSynced(true);
            }
        } catch (err) {
            console.error('Lỗi khi gửi cấu hình sơ đồ kho:', err);
        } finally {
            setIsSyncing(false);
        }
    };

    // Tải dữ liệu ban đầu từ LocalStorage và Supabase
    useEffect(() => {
        if (productStatus === 'idle') dispatch(fetchProducts());
        // Sơ đồ phải thấy toàn bộ tồn kho đã đồng bộ, kể cả các lô có ngày nhập
        // cũ hơn cửa sổ 30 ngày mặc định của danh sách giao dịch.
        dispatch(fetchTransactionsForce({ all: true }));
        dispatch(fetchInventory());

        // 1. Khôi phục nhanh từ LocalStorage trước
        let localAssignments: Record<string, string> = {};
        let localSerialAssignments: Record<string, string> = {};
        let localShelfNames: Record<string, string> = {};
        let localZoneNames: Record<string, string> = {};
        try { localAssignments = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch { /* ignore */ }
        try { localSerialAssignments = JSON.parse(localStorage.getItem(serialAssignmentStorageKey) || '{}'); } catch { /* ignore */ }
        try { localShelfNames = JSON.parse(localStorage.getItem(shelfNameStorageKey) || '{}'); } catch { /* ignore */ }
        try { localZoneNames = JSON.parse(localStorage.getItem(zoneNameStorageKey) || '{}'); } catch { /* ignore */ }

        if (Object.keys(localAssignments).length) setAssignments(localAssignments);
        if (Object.keys(localSerialAssignments).length) setSerialAssignments(localSerialAssignments);
        if (Object.keys(localShelfNames).length) setShelfNames(localShelfNames);
        if (Object.keys(localZoneNames).length) setZoneNames(localZoneNames);

        // 2. Tải bản mới nhất từ Supabase Cloud
        const loadFromCloud = async () => {
            try {
                const { data, error } = await supabase
                    .from('district_storekeepers')
                    .select('storekeeper_name')
                    .eq('district', CLOUD_CONFIG_KEY)
                    .maybeSingle();

                if (!error && data?.storekeeper_name) {
                    try {
                        const cloudConfig = JSON.parse(data.storekeeper_name);
                        if (cloudConfig) {
                            const cloudAssignments = cloudConfig.assignments || {};
                            const cloudSerialAssignments = cloudConfig.serialAssignments || {};
                            const cloudShelf = cloudConfig.shelfNames || {};
                            const cloudZone = cloudConfig.zoneNames || {};

                            setAssignments(cloudAssignments);
                            setSerialAssignments(cloudSerialAssignments);
                            setShelfNames(cloudShelf);
                            setZoneNames(cloudZone);

                            localStorage.setItem(storageKey, JSON.stringify(cloudAssignments));
                            localStorage.setItem(serialAssignmentStorageKey, JSON.stringify(cloudSerialAssignments));
                            localStorage.setItem(shelfNameStorageKey, JSON.stringify(cloudShelf));
                            localStorage.setItem(zoneNameStorageKey, JSON.stringify(cloudZone));
                            setCloudSynced(true);
                            return;
                        }
                    } catch (parseErr) {
                        console.warn('Lỗi phân tích JSON cấu hình sơ đồ kho từ Supabase:', parseErr);
                    }
                }

                // Nếu Cloud chưa có nhưng LocalStorage có dữ liệu, tự động đẩy dữ liệu LocalStorage lên Cloud
                if (Object.keys(localAssignments).length > 0 || Object.keys(localShelfNames).length > 0 || Object.keys(localZoneNames).length > 0) {
                    syncToCloud(localAssignments, localShelfNames, localZoneNames, localSerialAssignments);
                }
            } catch (loadErr) {
                console.warn('Không thể tải cấu hình sơ đồ kho từ Cloud:', loadErr);
            }
        };

        loadFromCloud();
    }, [dispatch, productStatus]);

    useEffect(() => {
        // Làm mới tồn kho đơn vị từ nguồn dữ liệu, kể cả khi thay đổi phát sinh ở máy khác.
        const refreshId = window.setInterval(() => { dispatch(fetchTransactionsForce({ all: true })); }, 30_000);
        const refreshWhenVisible = () => { if (document.visibilityState === 'visible') dispatch(fetchTransactionsForce({ all: true })); };
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
            if (!transaction.product_id) return;
            const warehouseType = resolveWarehouseType(transaction);
            const key = `${transaction.product_id}|${warehouseType}`;
            const quantity = Number(transaction.quantity) || 0;
            if (!next[key]) next[key] = { productId: transaction.product_id, warehouseType, quantity: 0 };
            next[key].quantity += transaction.type === 'inbound' ? quantity : -quantity;
        });
        return Object.values(next).filter(row => row.quantity > 0);
    }, [transactions]);

    const productsWithStock = useMemo(() => products.flatMap(product => {
        const quantity = stockMap[product.id] || 0;
        if (quantity <= 0) return [];

        // Vị trí gán vẫn được xác định theo kho đơn vị. Một mã hàng chỉ xuất hiện
        // một lần với chính số tồn đang hiển thị tại danh sách Hàng hóa, tránh cộng
        // trùng khi lịch sử có nhiều dòng nhập/xuất cho cùng mã hàng.
        const productRows = unitStockRows.filter(row => row.productId === product.id);
        const row = productRows.find(item => assignments[`${product.id}|${item.warehouseType}`]) || productRows[0];
        const warehouseType = row?.warehouseType || 'KHO_DV';
        const assignmentKey = `${product.id}|${warehouseType}`;
        const defaultShelfId = assignments[assignmentKey] || '';

        // Serial là ngoại lệ của vị trí mặc định theo mã hàng. Chỉ các serial còn
        // tồn mới được tách sang kệ riêng, và tổng số lượng giữa các kệ luôn bằng tồn kho.
        const outboundSerials = new Set(transactions
            .filter(transaction => transaction.type === 'outbound' && transaction.serial_code)
            .map(transaction => `${transaction.product_id}|${resolveWarehouseType(transaction)}|${transaction.serial_code!.trim().toUpperCase()}`));
        const activeSerialKeys = new Set(transactions
            .filter(transaction => transaction.type === 'inbound' && transaction.product_id && transaction.serial_code)
            .map(transaction => `${transaction.product_id}|${resolveWarehouseType(transaction)}|${transaction.serial_code!.trim().toUpperCase()}`)
            .filter(key => !outboundSerials.has(key)));
        const serialShelves = Object.entries(serialAssignments)
            .filter(([key]) => key.startsWith(`${assignmentKey}|`) && activeSerialKeys.has(key))
            .reduce<Record<string, number>>((result, [, shelfId]) => {
                result[shelfId] = (result[shelfId] || 0) + 1;
                return result;
            }, {});

        let remainingQuantity = quantity;
        const entries: Array<typeof product & { quantity: number; shelfId: string; warehouseType: string; assignmentKey: string }> = [];
        Object.entries(serialShelves).forEach(([shelfId, serialQuantity]) => {
            const quantityForShelf = Math.min(serialQuantity, remainingQuantity);
            if (quantityForShelf > 0) {
                entries.push({ ...product, quantity: quantityForShelf, shelfId, warehouseType, assignmentKey: `${assignmentKey}|serial|${shelfId}` });
                remainingQuantity -= quantityForShelf;
            }
        });
        if (remainingQuantity > 0) entries.push({ ...product, quantity: remainingQuantity, shelfId: defaultShelfId, warehouseType, assignmentKey });
        return entries;
    }), [products, stockMap, unitStockRows, assignments, serialAssignments, transactions]);

    const assignedProducts = useMemo(() => productsWithStock.filter(product => product.shelfId), [productsWithStock]);

    const matchedProducts = useMemo(() => {
        const term = search.trim().toLowerCase();
        const unassignedProducts = productsWithStock.filter(product => !product.shelfId);
        if (!term) return unassignedProducts;
        return unassignedProducts.filter(product => product.name.toLowerCase().includes(term) || product.item_code.toLowerCase().includes(term) || product.warehouseType.toLowerCase().includes(term));
    }, [productsWithStock, search]);

    const serialRows = useMemo(() => {
        const outboundSerials = new Set(transactions
            .filter(transaction => transaction.type === 'outbound' && transaction.serial_code)
            .map(transaction => transaction.serial_code!.trim().toUpperCase()));
        const rows = new Map<string, { key: string; productId: string; itemCode: string; productName: string; warehouseType: string; serialCode: string; shelfId: string }>();
        transactions.forEach(transaction => {
            const serialCode = transaction.serial_code?.trim();
            if (transaction.type !== 'inbound' || !transaction.product_id || !serialCode || outboundSerials.has(serialCode.toUpperCase())) return;
            const warehouseType = resolveWarehouseType(transaction);
            const assignmentKey = `${transaction.product_id}|${warehouseType}`;
            const key = `${assignmentKey}|${serialCode.toUpperCase()}`;
            const shelfId = serialAssignments[key] || assignments[assignmentKey] || '';
            const product = products.find(item => item.id === transaction.product_id);
            rows.set(key, {
                key,
                productId: transaction.product_id,
                itemCode: product?.item_code || '',
                productName: product?.name || transaction.product_name || '',
                warehouseType,
                serialCode,
                shelfId,
            });
        });
        return [...rows.values()];
    }, [transactions, assignments, serialAssignments, products]);

    const assignedSerialRows = useMemo(() => serialRows.filter(row => row.shelfId), [serialRows]);

    const saveSerialAssignment = (serialKey: string, shelfId: string) => {
        const next = { ...serialAssignments };
        if (shelfId) next[serialKey] = shelfId;
        else delete next[serialKey];
        setSerialAssignments(next);
        localStorage.setItem(serialAssignmentStorageKey, JSON.stringify(next));
        syncToCloud(assignments, shelfNames, zoneNames, next);
    };

    const downloadAssignmentTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Gan ke');
        sheet.columns = [{ width: 20 }, { width: 30 }, { width: 18 }];
        sheet.addRow(['MA_HANG', 'SERIAL', 'MA_KE']);
        sheet.addRow(['8041', '', 'A-1']);
        sheet.addRow(['8041', 'SERIAL-001', 'A-2']);
        sheet.getRow(1).eachCell(cell => { cell.font = { name: 'Times New Roman', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } }; });
        sheet.getRow(2).eachCell(cell => { cell.font = { name: 'Times New Roman', size: 12 }; });
        sheet.getRow(3).eachCell(cell => { cell.font = { name: 'Times New Roman', size: 12 }; });
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Mau_gan_ke_theo_ma_hang_serial.xlsx');
    };

    const importAssignments = async (file: File) => {
        const rows = await readExcelFile(file);
        const nextAssignments = { ...assignments };
        const nextSerialAssignments = { ...serialAssignments };
        let imported = 0;
        const findShelf = (value: unknown) => shelves.find(shelf => shelf.id.toUpperCase() === String(value || '').trim().toUpperCase() || getShelfLabel(shelf, shelfNames).toUpperCase() === String(value || '').trim().toUpperCase());
        for (const row of rows) {
            const shelf = findShelf(row.MA_KE || row['MÃ_KỆ']);
            if (!shelf) continue;
            const serial = String(row.SERIAL || '').trim().toUpperCase();
            const code = String(row.MA_HANG || row['MÃ_HÀNG'] || '').trim();
            if (serial) {
                const serialRow = serialRows.find(item => item.serialCode.toUpperCase() === serial && (!code || item.itemCode === code));
                if (!serialRow) continue;
                nextSerialAssignments[serialRow.key] = shelf.id;
            } else {
                const product = products.find(item => item.item_code === code || item.id === code);
                if (!product) continue;
                const warehouse = unitStockRows.find(item => item.productId === product.id)?.warehouseType || 'KHO_DV';
                nextAssignments[`${product.id}|${warehouse}`] = shelf.id;
            }
            imported += 1;
        }
        if (!imported) throw new Error('Không có dòng hợp lệ. Kiểm tra MA_HANG/SERIAL và MA_KE trong mẫu.');
        setAssignments(nextAssignments);
        setSerialAssignments(nextSerialAssignments);
        localStorage.setItem(storageKey, JSON.stringify(nextAssignments));
        localStorage.setItem(serialAssignmentStorageKey, JSON.stringify(nextSerialAssignments));
        await syncToCloud(nextAssignments, shelfNames, zoneNames, nextSerialAssignments);
        success(`Đã nhập ${imported} vị trí kệ.`);
    };

    const saveAssignment = (productId: string, shelfId: string) => {
        const next = { ...assignments };
        if (shelfId) next[productId] = shelfId;
        else delete next[productId];
        setAssignments(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        syncToCloud(next, shelfNames, zoneNames);
    };

    const optimizeLayout = () => {
        const next: Record<string, string> = {};
        productsWithStock.forEach(product => { next[product.assignmentKey] = suggestedShelf(product.assignmentKey); });
        setAssignments(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
        syncToCloud(next, shelfNames, zoneNames);
        success('Đã áp dụng và lưu gợi ý sắp xếp sơ đồ kho');
    };

    const clearAssignments = () => {
        if (!window.confirm('Xóa toàn bộ phân bổ mặt hàng vào kệ? Thao tác này chỉ xóa vị trí gán, không xóa tồn kho, hàng hóa hoặc chứng từ.')) return;
        setAssignments({});
        setSelectedProductId('');
        localStorage.removeItem(storageKey);
        syncToCloud({}, shelfNames, zoneNames);
        success('Đã xóa toàn bộ phân bổ mặt hàng');
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
        syncToCloud(assignments, next, zoneNames);
        success('Đã lưu tên kệ');
    };

    const saveZoneName = () => {
        const name = zoneNameDraft.trim();
        const next = { ...zoneNames };
        if (name && name !== selectedZone.title) next[selectedZone.id] = name;
        else delete next[selectedZone.id];
        setZoneNames(next);
        localStorage.setItem(zoneNameStorageKey, JSON.stringify(next));
        syncToCloud(assignments, shelfNames, next);
        success('Đã lưu tên khu');
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
        applyExcelFont(sheet);
        applyExcelFont(unassigned);
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
        applyExcelFont(sheet);
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
        syncToCloud(next, shelfNames, zoneNames);
        success(`Đã gỡ các mặt hàng khỏi ${getShelfLabel(selectedShelf, shelfNames)}`);
    };

    const handleManualSave = async () => {
        await syncToCloud(assignments, shelfNames, zoneNames);
        success('Đã lưu toàn bộ cấu hình sơ đồ kho lên hệ thống đám mây (Cloud)');
    };

    return (
        <Box p={{ xs: 1.5, sm: 3 }}>
            <PageHeader
                title="SƠ ĐỒ KHO THÔNG MINH"
                subtitle="Tra cứu vị trí kệ và phân bổ hàng hóa theo tồn kho đơn vị (KHO_DV)"
                icon={<MapPinned size={28} color="white" />}
                gradientType="blue"
                actions={<Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                    <Button
                        variant="contained"
                        onClick={handleManualSave}
                        disabled={isSyncing}
                        startIcon={isSyncing ? <CircularProgress size={16} color="inherit" /> : <Save size={17} />}
                        sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' }, color: 'white', fontWeight: 700 }}
                    >
                        {isSyncing ? 'Đang lưu Cloud...' : 'Lưu sơ đồ kho'}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            dispatch(fetchTransactionsForce({ all: true }));
                            success('Đã làm mới dữ liệu tồn kho từ hệ thống');
                        }}
                        startIcon={<RefreshCw size={16} />}
                        sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}
                    >
                        Làm mới tồn kho
                    </Button>
                    <Button variant="contained" onClick={downloadAssignmentTemplate} startIcon={<Download size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>Tải mẫu gán kệ</Button>
                    <Button component="label" variant="contained" startIcon={<Upload size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>
                        Nhập gán kệ
                        <input hidden type="file" accept=".xlsx,.xls" onChange={async event => { const file = event.target.files?.[0]; if (file) { try { await importAssignments(file); } catch (error: any) { notifyError(error.message || 'Không thể nhập file gán kệ.'); } } event.target.value = ''; }} />
                    </Button>
                    <Button variant="contained" disabled={!assignedSerialRows.length} onClick={exportAssignedSerials} startIcon={<Download size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>Xuất serial đã gán</Button>
                    <Button variant="contained" onClick={clearAssignments} startIcon={<Trash2 size={17} />} sx={{ bgcolor: 'rgba(220,38,38,.86)', border: '1px solid rgba(254,202,202,.5)', color: 'white' }}>Xóa gán kệ</Button>
                    <Button variant="contained" onClick={exportExcel} startIcon={<Download size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.26)', border: '1px solid rgba(255,255,255,.35)', color: 'white' }}>Xuất Excel</Button>
                    <Button variant="contained" onClick={optimizeLayout} startIcon={<Sparkles size={17} />} sx={{ bgcolor: 'rgba(255,255,255,.16)', border: '1px solid rgba(255,255,255,.3)', color: 'white' }}>Gợi ý sắp xếp</Button>
                </Stack>}
            />

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2.5}>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(30, 58, 138, .22)' }}><Typography color="#bfdbfe" variant="caption">TỒN KHO ĐƠN VỊ ĐƯỢC GÁN VỊ TRÍ</Typography><Typography variant="h5" fontWeight={800}>{totalStock.toLocaleString('vi-VN')} đơn vị</Typography></Paper>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(6, 78, 59, .22)' }}><Typography color="#a7f3d0" variant="caption">KỆ ĐANG SỬ DỤNG</Typography><Typography variant="h5" fontWeight={800}>{activeShelves}/{shelves.length} kệ</Typography></Paper>
                <Paper sx={{ p: 2, flex: 1, bgcolor: 'rgba(88, 28, 135, .22)' }}><Typography color="#ddd6fe" variant="caption">DÒNG TỒN KHO / ĐÃ GÁN</Typography><Typography variant="h5" fontWeight={800}>{productsWithStock.length} / {assignedProducts.length}</Typography></Paper>
            </Stack>

            <Box display="grid" gridTemplateColumns={{ xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.65fr) minmax(330px, .85fr)' }} gap={2.5} alignItems="start">
                <Paper sx={{ p: { xs: 1.5, sm: 2.5 }, minWidth: 0, overflow: 'hidden' }}>
                    <Stack direction="row" alignItems="center" spacing={1} mb={2}><LayoutGrid size={20} color="#60a5fa" /><Typography fontWeight={800}>Bản đồ vị trí kệ</Typography><Chip size="small" label="Khớp số liệu tồn kho" color="primary" variant="outlined" /></Stack>
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
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>Tên khu, tên vị trí và thao tác gán hàng được tự động lưu trữ an toàn trên Hệ thống Đám mây (Cloud) và máy cục bộ; đồng bộ xuyên suốt khi tắt mở lại ứng dụng.</Typography>
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
                    <Paper variant="outlined" sx={{ mt: 2, p: 1.25, borderColor: 'rgba(167,139,250,.35)', bgcolor: 'rgba(88,28,135,.08)' }}>
                        <Typography fontWeight={800} fontSize=".9rem">Gán vị trí theo serial</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mb={1}>Vị trí serial được ưu tiên hơn vị trí gán chung của mã hàng.</Typography>
                        <Stack spacing={.75} maxHeight={260} overflow="auto">
                            {serialRows.slice(0, 150).map(row => <Stack key={row.key} direction="row" spacing={1} alignItems="center">
                                <Box minWidth={0} flex={1}><Typography fontSize=".72rem" fontWeight={700} noWrap>{row.serialCode}</Typography><Typography fontSize=".65rem" color="text.secondary" noWrap>{row.productName}</Typography></Box>
                                <FormControl size="small" sx={{ minWidth: 145 }}><Select value={serialAssignments[row.key] || ''} displayEmpty onChange={event => saveSerialAssignment(row.key, event.target.value)}><MenuItem value=""><em>Theo vị trí mã hàng</em></MenuItem>{shelves.map(shelf => <MenuItem key={shelf.id} value={shelf.id}>{getShelfLabel(shelf, shelfNames)}</MenuItem>)}</Select></FormControl>
                            </Stack>)}
                            {!serialRows.length && <Typography variant="body2" color="text.secondary">Chưa có serial còn tồn kho.</Typography>}
                        </Stack>
                    </Paper>
                </Paper>
            </Box>
        </Box>
    );
};

export default WarehouseLayout;
