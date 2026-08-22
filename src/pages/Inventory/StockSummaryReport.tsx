import React, { useMemo, useState } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Button, Chip,
    TextField, InputAdornment, Tabs, Tab, Tooltip,
    TableSortLabel, CircularProgress, Stack,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import {
    FileDownload as FileDownloadIcon,
    Search as SearchIcon,
    Inventory2 as InventoryIcon,
    LocationOn as LocationIcon,
    Category as CategoryIcon,
    FilterAlt as FilterAltIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { selectDetailedStockMap } from '../../store/slices/inventorySlice';
import { fetchTransactions } from '../../store/slices/transactionsSlice';
import { fetchProducts } from '../../store/slices/productsSlice';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { formatNumber } from '../../utils/numberUtils';
import PageHeader from '../../components/Common/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockRow {
    productId: string;
    itemCode: string;
    productName: string;
    unit: string;
    district: string;
    warehouseType: string;
    itemStatus: string;
    quantity: number;
    unitPrice: number;
    totalValue: number;
}

type GroupBy = 'product' | 'status' | 'district';
type SortField = 'productName' | 'itemCode' | 'district' | 'warehouseType' | 'itemStatus' | 'quantity' | 'totalValue';
type SortDir = 'asc' | 'desc';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, 'success' | 'warning' | 'error' | 'info' | 'default'> = {
    'Mới': 'success',
    'Lỗi': 'error',
    'Cũ': 'warning',
    'Thu hồi': 'info',
};

const headerStyle = {
    fontWeight: 700,
    bgcolor: 'primary.dark',
    color: '#fff',
    whiteSpace: 'nowrap' as const,
};

const groupHeaderStyle = {
    bgcolor: 'action.selected',
    fontWeight: 700,
    color: 'primary.main',
    fontSize: '0.82rem',
};

function fmtMoney(val: number) {
    return val.toLocaleString('vi-VN') + ' đ';
}

// ─── Component ────────────────────────────────────────────────────────────────
const StockSummaryReport: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: products } = useSelector((state: RootState) => state.products);
    const detailedStockMap = useSelector(selectDetailedStockMap);
    const { status: txStatus, items: transactions } = useSelector((state: RootState) => state.transactions);

    const [tab, setTab] = useState<GroupBy>('product');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [sortField, setSortField] = useState<SortField>('productName');
    const [sortDir, setSortDir] = useState<SortDir>('asc');
    const [isExporting, setIsExporting] = useState(false);

    // ── Build flat rows ────────────────────────────────────────────────────────
    const allRows: StockRow[] = useMemo(() => {
        const whMap: Record<string, string> = {};
        transactions.forEach(t => {
            if (t.warehouse_type && t.type === 'inbound') {
                const k = `${t.product_id}|${t.district || ''}|${t.item_status || ''}`;
                if (!whMap[k]) whMap[k] = t.warehouse_type;
            }
        });

        const rows: StockRow[] = [];
        Object.entries(detailedStockMap).forEach(([key, qty]) => {
            const parts = key.split('|');
            if (parts.length !== 3) return;
            const [productId, district, status] = parts;
            if (district === '' && status === '') return;
            if (status === '*ALL*') return;
            if (qty <= 0) return;

            const product = products.find(p => p.id === productId);
            if (!product) return;

            rows.push({
                productId,
                itemCode: product.item_code,
                productName: product.name,
                unit: product.unit || 'Cái',
                district: district || 'Chưa phân loại',
                warehouseType: whMap[key] || 'Kho Tổng',
                itemStatus: status || 'Chưa xác định',
                quantity: qty,
                unitPrice: product.unit_price || 0,
                totalValue: qty * (product.unit_price || 0),
            });
        });
        return rows;
    }, [detailedStockMap, products, transactions]);

    // ── Filter options ─────────────────────────────────────────────────────────
    const allStatuses = useMemo(() => ['', ...Array.from(new Set(allRows.map(r => r.itemStatus))).sort()], [allRows]);
    const allDistricts = useMemo(() => ['', ...Array.from(new Set(allRows.map(r => r.district))).sort()], [allRows]);

    // ── Filtered + sorted rows ─────────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const s = search.toLowerCase();
        return allRows
            .filter(r => {
                const ms = !s || r.productName.toLowerCase().includes(s) || r.itemCode.toLowerCase().includes(s) || r.district.toLowerCase().includes(s) || r.warehouseType.toLowerCase().includes(s);
                const mst = !filterStatus || r.itemStatus === filterStatus;
                const md = !filterDistrict || r.district === filterDistrict;
                return ms && mst && md;
            })
            .sort((a, b) => {
                let av: string | number = '', bv: string | number = '';
                if (sortField === 'productName') { av = a.productName; bv = b.productName; }
                else if (sortField === 'itemCode') { av = a.itemCode; bv = b.itemCode; }
                else if (sortField === 'district') { av = a.district; bv = b.district; }
                else if (sortField === 'warehouseType') { av = a.warehouseType; bv = b.warehouseType; }
                else if (sortField === 'itemStatus') { av = a.itemStatus; bv = b.itemStatus; }
                else if (sortField === 'quantity') { av = a.quantity; bv = b.quantity; }
                else if (sortField === 'totalValue') { av = a.totalValue; bv = b.totalValue; }
                if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
                return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
            });
    }, [allRows, search, filterStatus, filterDistrict, sortField, sortDir]);

    // ── Summary ────────────────────────────────────────────────────────────────
    const totalQty = filteredRows.reduce((s, r) => s + r.quantity, 0);
    const totalValue = filteredRows.reduce((s, r) => s + r.totalValue, 0);
    const uniqueProducts = new Set(filteredRows.map(r => r.productId)).size;
    const uniqueDistricts = new Set(filteredRows.map(r => r.district)).size;
    const uniqueStatuses = new Set(filteredRows.map(r => r.itemStatus)).size;

    // ── Grouped ────────────────────────────────────────────────────────────────
    const groupedData = useMemo(() => {
        const groups: Record<string, StockRow[]> = {};
        filteredRows.forEach(row => {
            const key =
                tab === 'product' ? `${row.itemCode} — ${row.productName}` :
                tab === 'status' ? row.itemStatus :
                row.district;
            if (!groups[key]) groups[key] = [];
            groups[key].push(row);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredRows, tab]);

    const handleSort = (field: SortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('asc'); }
    };

    const handleRefresh = () => {
        dispatch(fetchProducts() as any);
        dispatch(fetchTransactions() as any);
    };

    // ── Excel Export ───────────────────────────────────────────────────────────
    const handleExportExcel = async () => {
        if (filteredRows.length === 0) return;
        setIsExporting(true);
        try {
            const wb = new ExcelJS.Workbook();
            const now = new Date();
            wb.creator = 'GGS Warehouse';
            wb.created = now;

            const H: Partial<ExcelJS.Style> = {
                font: { name: 'Times New Roman', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
            };
            const D: Partial<ExcelJS.Style> = {
                font: { name: 'Times New Roman', size: 10 },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
                alignment: { vertical: 'middle', wrapText: true },
            };
            const GH: Partial<ExcelJS.Style> = {
                font: { name: 'Times New Roman', bold: true, size: 10, color: { argb: 'FF1565C0' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4FD' } },
                alignment: { vertical: 'middle', wrapText: true },
                border: { top: { style: 'thin', color: { argb: 'FF90CAF9' } }, left: { style: 'thin', color: { argb: 'FF90CAF9' } }, bottom: { style: 'thin', color: { argb: 'FF90CAF9' } }, right: { style: 'thin', color: { argb: 'FF90CAF9' } } },
            };
            const SUB: Partial<ExcelJS.Style> = {
                font: { name: 'Times New Roman', bold: true, size: 10 },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } },
                alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
                border: { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } },
            };
            const TOT: Partial<ExcelJS.Style> = {
                font: { name: 'Times New Roman', bold: true, size: 11, color: { argb: 'FFFFFFFF' } },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } },
                alignment: { horizontal: 'right', vertical: 'middle', wrapText: true },
                border: { top: { style: 'medium' }, left: { style: 'medium' }, bottom: { style: 'medium' }, right: { style: 'medium' } },
            };

            const addTitle = (ws: ExcelJS.Worksheet, title: string, sub: string, cols: number) => {
                const colLetter = String.fromCharCode(64 + cols);
                ws.mergeCells(`A1:${colLetter}1`);
                const c = ws.getCell('A1');
                c.value = title;
                c.font = { name: 'Times New Roman', bold: true, size: 14, color: { argb: 'FF1E293B' } };
                c.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 28;
                ws.mergeCells(`A2:${colLetter}2`);
                const c2 = ws.getCell('A2');
                c2.value = sub;
                c2.font = { name: 'Times New Roman', italic: true, size: 10, color: { argb: 'FF64748B' } };
                c2.alignment = { horizontal: 'center' };
                ws.getRow(2).height = 16;
            };

            // ── Sheet 6: Báo cáo BCCS ─────────────────────────────────────────
            const ws6 = wb.addWorksheet('Báo cáo BCCS');
            ws6.columns = [
                { key: 'name', width: 70 },
                { key: 'status', width: 22 },
                { key: 'qty', width: 15 },
                { key: 'days', width: 20 },
                { key: 'desc', width: 40 }
            ];
            
            const bccsHeader = [
                "Vật tư hàng hóa kho BCCS:",
                "Hiện tại, vật tư hàng hóa kho BCCS đảm bảo công việc đến hết lễ, không có hàng hóa thiếu, không đảm bảo ảnh hưởng đến KPIs.",
                "Kèm file chi tiết -Vật tư hàng hóa BCCS đính kèm",
                "Cấp phát hàng đảm bảo phát triển sủa chữa UCTT",
                "Điều hành công tác thu hồi thiết bị lỗi thời,Rời mạng GPON,BOX,HWF",
                "Thực hiện kiểm kê trên hệ thống BCCS"
            ];
            
            bccsHeader.forEach((text, i) => {
                const r = ws6.addRow([text]);
                ws6.mergeCells(`A${r.number}:E${r.number}`);
                const cell = r.getCell(1);
                cell.font = { name: 'Times New Roman', size: 12, bold: i === 0, italic: i > 0 };
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
                
                // Thêm viền mờ màu xám nhạt (như trong hình) cho mỗi dòng
                const borderStyle = { style: 'thin' as ExcelJS.BorderStyle, color: { argb: 'FFE0E0E0' } };
                for(let col = 1; col <= 5; col++) {
                    r.getCell(col).border = { 
                        top: i === 0 ? borderStyle : undefined,
                        bottom: borderStyle,
                        left: col === 1 ? borderStyle : undefined,
                        right: col === 5 ? borderStyle : undefined
                    };
                }
                r.height = 26;
            });
            ws6.addRow([]); // Dòng trống
            
            const h6 = ws6.addRow(['TÊN VẬT TƯ HÀNG HÓA', 'TRẠNG THÁI', 'SỐ LƯỢNG', 'SỐ NGÀY ĐẢM BẢO', 'DIỄN GIẢI']);
            h6.height = 28;
            h6.eachCell(c => Object.assign(c, H));
            
            const bccsMap: Record<string, { name: string, status: string, qty: number }> = {};
            filteredRows.forEach(r => {
                const key = `${r.productName}|${r.itemStatus}`;
                if (!bccsMap[key]) {
                    bccsMap[key] = { name: r.productName, status: r.itemStatus, qty: 0 };
                }
                bccsMap[key].qty += r.quantity;
            });
            
            const bccsArr = Object.values(bccsMap).sort((a, b) => a.name.localeCompare(b.name) || a.status.localeCompare(b.status));
            bccsArr.forEach((item, i) => {
                const r = ws6.addRow([item.name, item.status, item.qty, '', '']);
                r.height = 20;
                r.eachCell((c, cn) => {
                    Object.assign(c, D);
                    if (cn === 2 || cn === 3 || cn === 4) c.alignment = { ...D.alignment, horizontal: 'center' };
                    if (cn === 3) c.numFmt = '#,##0';
                    if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                });
            });

            // ── Sheet 4: Theo Quận/Huyện ──────────────────────────────────────
            const ws4 = wb.addWorksheet('Theo Quận Huyện');
            ws4.columns = [{ key: 's', width: 6 }, { key: 'd', width: 22 }, { key: 'wh', width: 22 }, { key: 'st', width: 22 }, { key: 'np', width: 14 }, { key: 'q', width: 14 }, { key: 'v', width: 20 }, { key: 'p', width: 12 }];
            addTitle(ws4, 'TỔNG HỢP TỒN KHO THEO QUẬN/HUYỆN', `Ngày xuất: ${now.toLocaleDateString('vi-VN')}`, 8);
            const h4 = ws4.addRow(['STT', 'Quận/Huyện', 'Loại Kho', 'Trạng Thái', 'Số Mặt Hàng', 'Số Lượng', 'Thành Tiền', 'Tỷ Lệ (%)']);
            h4.height = 28; h4.eachCell(c => Object.assign(c, H));
            const dMap: Record<string, { d: string, wh: string, st: string, prods: Set<string>; qty: number; val: number }> = {};
            filteredRows.forEach(r => {
                const key = `${r.district}|${r.warehouseType}|${r.itemStatus}`;
                if (!dMap[key]) dMap[key] = { d: r.district, wh: r.warehouseType, st: r.itemStatus, prods: new Set(), qty: 0, val: 0 };
                dMap[key].prods.add(r.productId);
                dMap[key].qty += r.quantity;
                dMap[key].val += r.totalValue;
            });
            const dArr = Object.values(dMap).sort((a, b) => a.d.localeCompare(b.d) || a.wh.localeCompare(b.wh) || a.st.localeCompare(b.st));
            const dTot = dArr.reduce((s, v) => s + v.qty, 0);
            dArr.forEach((v, i) => {
                const pct = dTot > 0 ? ((v.qty / dTot) * 100).toFixed(1) + '%' : '0%';
                const r = ws4.addRow([i + 1, v.d, v.wh, v.st, v.prods.size, v.qty, v.val, pct]);
                r.height = 18;
                r.eachCell((c, cn) => {
                    Object.assign(c, D);
                    if (cn === 1 || cn === 5 || cn === 6 || cn === 8) c.alignment = { ...D.alignment, horizontal: 'center' };
                    if (cn === 7) { c.alignment = { ...D.alignment, horizontal: 'right' }; c.numFmt = '#,##0'; }
                    if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                });
            });
            const t4 = ws4.addRow(['TỔNG CỘNG', '', '', '', new Set(filteredRows.map(r => r.productId)).size, dTot, filteredRows.reduce((s, r) => s + r.totalValue, 0), '100%']);
            ws4.mergeCells(`A${t4.number}:D${t4.number}`);
            t4.height = 24; 
            t4.eachCell({ includeEmpty: true }, (c, cn) => { 
                Object.assign(c, TOT); 
                if (cn <= 4) c.alignment = { ...TOT.alignment, horizontal: 'left' }; 
                if (cn === 5 || cn === 6 || cn === 8) c.alignment = { ...TOT.alignment, horizontal: 'center' };
                if (cn === 6 || cn === 7) c.numFmt = '#,##0'; 
            });

            // ── Sheet 2: Theo Hàng Hóa ─────────────────────────────────────────
            const ws2 = wb.addWorksheet('Theo Hàng Hóa');
            ws2.columns = [{ key: 's', width: 6 }, { key: 'c', width: 35 }, { key: 'n', width: 70 }, { key: 'u', width: 8 }, { key: 'wh', width: 22 }, { key: 'st', width: 22 }, { key: 'q', width: 14 }, { key: 'v', width: 20 }];
            addTitle(ws2, 'TỔNG HỢP TỒN KHO THEO HÀNG HÓA', `Ngày xuất: ${now.toLocaleDateString('vi-VN')}`, 8);
            const h2 = ws2.addRow(['STT', 'Mã Hàng', 'Tên Hàng Hóa', 'ĐVT', 'Loại Kho', 'Trạng Thái', 'Tổng SL', 'Thành Tiền']);
            h2.height = 28; h2.eachCell(c => Object.assign(c, H));
            const pMap: Record<string, { code: string; name: string; unit: string; wh: string; st: string; qty: number; val: number }> = {};
            filteredRows.forEach(r => {
                const key = `${r.productId}|${r.warehouseType}|${r.itemStatus}`;
                if (!pMap[key]) pMap[key] = { code: r.itemCode, name: r.productName, unit: r.unit, wh: r.warehouseType, st: r.itemStatus, qty: 0, val: 0 };
                pMap[key].qty += r.quantity;
                pMap[key].val += r.totalValue;
            });
            const pArr = Object.values(pMap).sort((a, b) => a.name.localeCompare(b.name) || a.wh.localeCompare(b.wh) || a.st.localeCompare(b.st));
            pArr.forEach((p, i) => {
                const r = ws2.addRow([i + 1, p.code, p.name, p.unit, p.wh, p.st, p.qty, p.val]);
                r.height = 18;
                r.eachCell((c, cn) => {
                    Object.assign(c, D);
                    if (cn === 1 || cn === 7) c.alignment = { ...D.alignment, horizontal: 'center' };
                    if (cn === 8) { c.alignment = { ...D.alignment, horizontal: 'right' }; c.numFmt = '#,##0'; }
                    if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                });
            });
            const t2 = ws2.addRow(['TỔNG CỘNG', '', '', '', '', '', pArr.reduce((s, p) => s + p.qty, 0), pArr.reduce((s, p) => s + p.val, 0)]);
            ws2.mergeCells(`A${t2.number}:F${t2.number}`);
            t2.height = 24; 
            t2.eachCell({ includeEmpty: true }, (c, cn) => { 
                Object.assign(c, TOT); 
                if (cn <= 6) c.alignment = { ...TOT.alignment, horizontal: 'left' }; 
                if (cn === 7) c.alignment = { ...TOT.alignment, horizontal: 'center' };
                if (cn === 7 || cn === 8) c.numFmt = '#,##0'; 
            });

            // ── Sheet 3: Theo Trạng Thái ──────────────────────────────────────
            const ws3 = wb.addWorksheet('Theo Trạng Thái');
            ws3.columns = [{ key: 's', width: 6 }, { key: 'st', width: 25 }, { key: 'wh', width: 22 }, { key: 'q', width: 14 }, { key: 'v', width: 20 }, { key: 'p', width: 12 }];
            addTitle(ws3, 'TỔNG HỢP TỒN KHO THEO TRẠNG THÁI', `Ngày xuất: ${now.toLocaleDateString('vi-VN')}`, 6);
            const h3 = ws3.addRow(['STT', 'Trạng Thái', 'Loại Kho', 'Số Lượng', 'Thành Tiền', 'Tỷ Lệ (%)']);
            h3.height = 28; h3.eachCell(c => Object.assign(c, H));
            const stMap: Record<string, { st: string, wh: string, qty: number; val: number }> = {};
            filteredRows.forEach(r => {
                const key = `${r.itemStatus}|${r.warehouseType}`;
                if (!stMap[key]) stMap[key] = { st: r.itemStatus, wh: r.warehouseType, qty: 0, val: 0 };
                stMap[key].qty += r.quantity;
                stMap[key].val += r.totalValue;
            });
            const stArr = Object.values(stMap).sort((a, b) => a.st.localeCompare(b.st) || a.wh.localeCompare(b.wh));
            const stTot = stArr.reduce((s, v) => s + v.qty, 0);
            stArr.forEach((v, i) => {
                const pct = stTot > 0 ? ((v.qty / stTot) * 100).toFixed(1) + '%' : '0%';
                const r = ws3.addRow([i + 1, v.st, v.wh, v.qty, v.val, pct]);
                r.height = 18;
                r.eachCell((c, cn) => {
                    Object.assign(c, D);
                    if (cn === 1 || cn === 4 || cn === 6) c.alignment = { ...D.alignment, horizontal: 'center' };
                    if (cn === 5) { c.alignment = { ...D.alignment, horizontal: 'right' }; c.numFmt = '#,##0'; }
                    if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                });
            });
            const t3 = ws3.addRow(['TỔNG CỘNG', '', '', stTot, filteredRows.reduce((s, r) => s + r.totalValue, 0), '100%']);
            ws3.mergeCells(`A${t3.number}:C${t3.number}`);
            t3.height = 24; 
            t3.eachCell({ includeEmpty: true }, (c, cn) => { 
                Object.assign(c, TOT); 
                if (cn <= 3) c.alignment = { ...TOT.alignment, horizontal: 'left' }; 
                if (cn === 4 || cn === 6) c.alignment = { ...TOT.alignment, horizontal: 'center' };
                if (cn === 4 || cn === 5) c.numFmt = '#,##0'; 
            });

            // ── Sheet 1: Chi tiết (nhóm theo tab đang chọn) ──────────────────
            const ws1 = wb.addWorksheet('Chi Tiết Tồn Kho');
            ws1.columns = [
                { key: 'stt', width: 6 }, { key: 'itemCode', width: 35 }, { key: 'productName', width: 70 },
                { key: 'unit', width: 8 }, { key: 'district', width: 20 }, { key: 'warehouseType', width: 22 },
                { key: 'itemStatus', width: 22 }, { key: 'quantity', width: 12 }, { key: 'unitPrice', width: 16 }, { key: 'totalValue', width: 18 },
            ];
            const groupLabel = tab === 'product' ? 'Tên Hàng Hóa' : tab === 'status' ? 'Trạng Thái' : 'Quận/Huyện';
            addTitle(ws1, 'BÁO CÁO TỒN KHO CHI TIẾT',
                `Ngày xuất: ${now.toLocaleDateString('vi-VN')}  |  Nhóm theo: ${groupLabel}  |  Lọc: ${filterStatus || 'Tất cả TT'} / ${filterDistrict || 'Tất cả QH'}`, 10);

            const hr = ws1.addRow(['STT', 'Mã Hàng', 'Tên Hàng Hóa', 'ĐVT', 'Quận/Huyện', 'Loại Kho', 'Trạng Thái', 'Số Lượng', 'Đơn Giá', 'Thành Tiền']);
            hr.height = 30; hr.eachCell(c => Object.assign(c, H));

            let stt = 1;
            groupedData.forEach(([gk, rows]) => {
                const gRow = ws1.addRow([`▶ ${groupLabel}: ${gk}`]);
                ws1.mergeCells(`A${gRow.number}:J${gRow.number}`);
                gRow.height = 20; gRow.eachCell({ includeEmpty: true }, c => Object.assign(c, GH));

                let gQty = 0, gVal = 0;
                rows.forEach((r, ri) => {
                    gQty += r.quantity; gVal += r.totalValue;
                    const dr = ws1.addRow([stt++, r.itemCode, r.productName, r.unit, r.district, r.warehouseType, r.itemStatus, r.quantity, r.unitPrice, r.totalValue]);
                    dr.height = 18;
                    dr.eachCell((c, cn) => {
                        Object.assign(c, D);
                        if (cn === 1 || cn === 8) c.alignment = { ...D.alignment, horizontal: 'center' };
                        if (cn === 9 || cn === 10) { c.alignment = { ...D.alignment, horizontal: 'right' }; c.numFmt = '#,##0'; }
                        if (ri % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                    });
                });
                const sr = ws1.addRow([`Cộng: ${gk}`, '', '', '', '', '', '', gQty, '', gVal]);
                ws1.mergeCells(`A${sr.number}:G${sr.number}`);
                sr.height = 22;
                sr.eachCell({ includeEmpty: true }, (c, cn) => {
                    Object.assign(c, SUB);
                    if (cn <= 7) c.alignment = { ...SUB.alignment, horizontal: 'left' };
                    if (cn === 8) c.alignment = { ...SUB.alignment, horizontal: 'center' };
                    if (cn === 8 || cn === 10) c.numFmt = '#,##0';
                });
            });
            const gr = ws1.addRow(['TỔNG CỘNG', '', '', '', '', '', '', totalQty, '', totalValue]);
            ws1.mergeCells(`A${gr.number}:G${gr.number}`);
            gr.height = 26;
            gr.eachCell({ includeEmpty: true }, (c, cn) => {
                Object.assign(c, TOT);
                if (cn <= 7) c.alignment = { ...TOT.alignment, horizontal: 'left' };
                if (cn === 8) c.alignment = { ...TOT.alignment, horizontal: 'center' };
                if (cn === 8 || cn === 10) c.numFmt = '#,##0';
            });

            // ── Sheet 5: Chi Tiết Serial ──────────────────────────────────────
            const ws5 = wb.addWorksheet('Chi Tiết Serial');
            ws5.columns = [
                { key: 'stt', width: 6 }, { key: 'itemCode', width: 35 }, { key: 'productName', width: 70 },
                { key: 'serial', width: 30 }, { key: 'district', width: 20 }, { key: 'wh', width: 22 }, { key: 'status', width: 22 } 
            ];
            addTitle(ws5, 'BÁO CÁO CHI TIẾT SERIAL TỒN KHO', `Ngày xuất: ${now.toLocaleDateString('vi-VN')}  |  Lọc: ${filterStatus || 'Tất cả TT'} / ${filterDistrict || 'Tất cả QH'}`, 7);
            const h5 = ws5.addRow(['STT', 'Mã Hàng', 'Tên Hàng Hóa', 'Số Serial', 'Quận/Huyện', 'Loại Kho', 'Trạng Thái']);
            h5.height = 28; h5.eachCell(c => Object.assign(c, H));
            
            // Lấy danh sách serial tồn kho
            const stockBySerial: Record<string, any> = {};
            transactions.forEach((t: any) => {
                if (t.type === 'inbound') {
                    const wh = (t.warehouse_type || '').trim().toUpperCase();
                    if (wh !== 'KHO_DV_Q12' && wh !== 'KHO_DV_HMN' && wh !== 'KHO_DV_CCI' && wh !== 'KHO_NV_Q12' && wh !== 'KHO_NV_HMN') return;
                    
                    const key = t.serial_code ? `serial_${t.serial_code}` : `noserial_${t.id}`;
                    if (!stockBySerial[key]) {
                        stockBySerial[key] = {
                            productId: t.product_id,
                            serial: t.serial_code || '',
                            status: t.item_status || 'Mới',
                            district: t.district || 'Kho Tổng',
                            wh: wh || 'Kho Tổng',
                            qty: 0
                        };
                    }
                    stockBySerial[key].qty += Number(t.quantity);
                } else if (t.type === 'outbound') {
                    const key = t.serial_code ? `serial_${t.serial_code}` : null;
                    if (key && stockBySerial[key]) stockBySerial[key].qty -= Number(t.quantity);
                }
            });
            let activeSerials = Object.values(stockBySerial).filter(s => s.qty > 0);
            
            // Lọc theo điều kiện tìm kiếm và bộ lọc hiện tại
            activeSerials = activeSerials.filter(s => {
                const p = products.find(prod => prod.id === s.productId);
                const sText = search.toLowerCase();
                const ms = !sText || (p?.name?.toLowerCase().includes(sText)) || (p?.item_code?.toLowerCase().includes(sText)) || s.district.toLowerCase().includes(sText) || s.serial.toLowerCase().includes(sText);
                const mst = !filterStatus || s.status === filterStatus;
                const md = !filterDistrict || s.district === filterDistrict;
                return ms && mst && md;
            });
            
            activeSerials.sort((a, b) => {
                const pA = products.find(prod => prod.id === a.productId)?.name || '';
                const pB = products.find(prod => prod.id === b.productId)?.name || '';
                return pA.localeCompare(pB) || a.serial.localeCompare(b.serial);
            });
            
            activeSerials.forEach((s, i) => {
                const p = products.find(prod => prod.id === s.productId);
                const r = ws5.addRow([i + 1, p?.item_code || '', p?.name || '', s.serial || '(Không có serial)', s.district, s.wh, s.status]);
                r.height = 18;
                r.eachCell((c, cn) => {
                    Object.assign(c, D);
                    if (cn === 1 || cn === 7) c.alignment = { ...D.alignment, horizontal: 'center' };
                    if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
                });
            });

            const buf = await wb.xlsx.writeBuffer();
            const ds = now.toLocaleDateString('vi-VN').replace(/\//g, '-');
            saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Bao_cao_ton_kho_chi_tiet_${ds}.xlsx`);
        } finally {
            setIsExporting(false);
        }
    };

    const isLoading = txStatus === 'loading';

    return (
        <Box sx={{ pb: 5 }}>
            <PageHeader
                title="Báo Cáo Tồn Kho Chi Tiết"
                subtitle="Xem tồn kho theo tên hàng hóa, trạng thái và quận huyện. Xuất Excel đa sheet."
            />

            {/* Summary cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 2, mb: 3 }}>
                {[
                    { label: 'Mặt hàng', value: uniqueProducts, color: '#3b82f6' },
                    { label: 'Quận/Huyện', value: uniqueDistricts, color: '#10b981' },
                    { label: 'Trạng thái', value: uniqueStatuses, color: '#f59e0b' },
                    { label: 'Tổng số lượng', value: formatNumber(totalQty), color: '#6366f1' },
                    { label: 'Tổng giá trị', value: fmtMoney(totalValue), color: '#ef4444' },
                ].map((card, i) => (
                    <Paper key={i} sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${card.color}` }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>{card.label}</Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: card.color, fontSize: i === 4 ? '0.9rem' : '1.2rem', mt: 0.5 }}>
                            {card.value}
                        </Typography>
                    </Paper>
                ))}
            </Box>

            {/* Filters */}
            <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" flexWrap="wrap">
                    <TextField
                        size="small"
                        placeholder="Tìm tên hàng, mã hàng, quận huyện..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        sx={{ minWidth: 260, flexGrow: 1 }}
                        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment> }}
                    />
                    <FormControl size="small" sx={{ minWidth: 155 }}>
                        <InputLabel>Trạng thái</InputLabel>
                        <Select value={filterStatus} label="Trạng thái" onChange={e => setFilterStatus(e.target.value)}>
                            {allStatuses.map(s => <MenuItem key={s} value={s}>{s || 'Tất cả'}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 155 }}>
                        <InputLabel>Quận/Huyện</InputLabel>
                        <Select value={filterDistrict} label="Quận/Huyện" onChange={e => setFilterDistrict(e.target.value)}>
                            {allDistricts.map(d => <MenuItem key={d} value={d}>{d || 'Tất cả'}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={handleRefresh}
                        disabled={isLoading} sx={{ borderRadius: 2, textTransform: 'none' }}>
                        Làm mới
                    </Button>
                    <Button variant="contained" size="small"
                        startIcon={isExporting ? <CircularProgress size={14} color="inherit" /> : <FileDownloadIcon />}
                        onClick={handleExportExcel}
                        disabled={filteredRows.length === 0 || isExporting}
                        sx={{ borderRadius: 2, textTransform: 'none', bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}>
                        {isExporting ? 'Đang xuất...' : 'Xuất báo cáo chi tiết'}
                    </Button>
                </Stack>
            </Paper>

            {/* Table */}
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}
                    sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: 'background.paper' }}>
                    <Tab value="product" label="Theo Hàng Hóa" icon={<CategoryIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
                    <Tab value="status" label="Theo Trạng Thái" icon={<FilterAltIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
                    <Tab value="district" label="Theo Quận/Huyện" icon={<LocationIcon fontSize="small" />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 600 }} />
                </Tabs>

                {isLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                ) : filteredRows.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
                        <InventoryIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1 }} />
                        <Typography>Không có dữ liệu tồn kho phù hợp</Typography>
                        <Typography variant="caption">Hàng hóa sẽ hiển thị sau khi đồng bộ dữ liệu từ kho tổng (in_stock)</Typography>
                    </Box>
                ) : (
                    <TableContainer sx={{ maxHeight: 600 }}>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={headerStyle} align="center" width={52}>STT</TableCell>
                                    <TableCell sx={headerStyle}>
                                        <TableSortLabel active={sortField === 'itemCode'} direction={sortField === 'itemCode' ? sortDir : 'asc'}
                                            onClick={() => handleSort('itemCode')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Mã Hàng
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle}>
                                        <TableSortLabel active={sortField === 'productName'} direction={sortField === 'productName' ? sortDir : 'asc'}
                                            onClick={() => handleSort('productName')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Tên Hàng Hóa
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle} align="center" width={70}>ĐVT</TableCell>
                                    <TableCell sx={headerStyle}>
                                        <TableSortLabel active={sortField === 'district'} direction={sortField === 'district' ? sortDir : 'asc'}
                                            onClick={() => handleSort('district')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Quận/Huyện
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle}>
                                        <TableSortLabel active={sortField === 'warehouseType'} direction={sortField === 'warehouseType' ? sortDir : 'asc'}
                                            onClick={() => handleSort('warehouseType')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Loại Kho
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle}>
                                        <TableSortLabel active={sortField === 'itemStatus'} direction={sortField === 'itemStatus' ? sortDir : 'asc'}
                                            onClick={() => handleSort('itemStatus')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Trạng Thái
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle} align="center">
                                        <TableSortLabel active={sortField === 'quantity'} direction={sortField === 'quantity' ? sortDir : 'asc'}
                                            onClick={() => handleSort('quantity')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Số Lượng
                                        </TableSortLabel>
                                    </TableCell>
                                    <TableCell sx={headerStyle} align="right">Đơn Giá</TableCell>
                                    <TableCell sx={headerStyle} align="right">
                                        <TableSortLabel active={sortField === 'totalValue'} direction={sortField === 'totalValue' ? sortDir : 'asc'}
                                            onClick={() => handleSort('totalValue')}
                                            sx={{ color: '#fff !important', '& .MuiTableSortLabel-icon': { color: '#94a3b8 !important' } }}>
                                            Thành Tiền
                                        </TableSortLabel>
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {groupedData.map(([groupKey, rows]) => {
                                    const gQty = rows.reduce((s, r) => s + r.quantity, 0);
                                    const gVal = rows.reduce((s, r) => s + r.totalValue, 0);
                                    return (
                                        <React.Fragment key={groupKey}>
                                            <TableRow>
                                                <TableCell colSpan={10} sx={groupHeaderStyle}>
                                                    {groupKey}
                                                    <Chip label={`${formatNumber(gQty)} cái`} size="small" sx={{ ml: 1, height: 18, fontSize: '0.7rem', bgcolor: '#dbeafe', color: '#1d4ed8' }} />
                                                    {gVal > 0 && <Chip label={fmtMoney(gVal)} size="small" sx={{ ml: 0.5, height: 18, fontSize: '0.7rem', bgcolor: '#dcfce7', color: '#15803d' }} />}
                                                </TableCell>
                                            </TableRow>
                                            {rows.map((row, idx) => (
                                                <TableRow key={`${row.productId}|${row.district}|${row.itemStatus}`} hover
                                                    sx={{ bgcolor: idx % 2 === 0 ? 'background.paper' : 'action.hover' }}>
                                                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{idx + 1}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.secondary' }}>{row.itemCode}</TableCell>
                                                    <TableCell sx={{ fontWeight: 500, color: 'text.primary' }}>
                                                        <Tooltip title={row.productName} placement="top-start"><span>{row.productName}</span></Tooltip>
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{row.unit}</TableCell>
                                                    <TableCell>
                                                        <Chip label={row.district} size="small" variant="outlined"
                                                            sx={{ fontWeight: 500, fontSize: '0.72rem' }} color="success" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip label={row.warehouseType} size="small" variant="outlined"
                                                            sx={{ fontWeight: 500, fontSize: '0.72rem' }} color="primary" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip label={row.itemStatus} size="small"
                                                            color={STATUS_COLOR[row.itemStatus] || 'default'}
                                                            variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                                                    </TableCell>
                                                    <TableCell align="center" sx={{ fontWeight: 700, color: 'primary.main' }}>{formatNumber(row.quantity)}</TableCell>
                                                    <TableCell align="right" sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>{formatNumber(row.unitPrice)}</TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 700, color: 'success.main' }}>{fmtMoney(row.totalValue)}</TableCell>
                                                </TableRow>
                                            ))}
                                            <TableRow sx={{ bgcolor: 'action.selected' }}>
                                                <TableCell colSpan={7} sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.8rem', pl: 3 }}>
                                                    Cộng: {groupKey}
                                                </TableCell>
                                                <TableCell align="center" sx={{ fontWeight: 800, color: 'primary.main' }}>{formatNumber(gQty)}</TableCell>
                                                <TableCell />
                                                <TableCell align="right" sx={{ fontWeight: 800, color: 'success.main' }}>{fmtMoney(gVal)}</TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    );
                                })}
                                <TableRow sx={{ bgcolor: 'primary.dark' }}>
                                    <TableCell colSpan={7} sx={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem', pl: 2 }}>TỔNG CỘNG</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 800, color: '#93c5fd', fontSize: '1rem' }}>{formatNumber(totalQty)}</TableCell>
                                    <TableCell />
                                    <TableCell align="right" sx={{ fontWeight: 800, color: '#86efac', fontSize: '1rem' }}>{fmtMoney(totalValue)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>
        </Box>
    );
};

export default StockSummaryReport;
