import { Add, Download, Print, Refresh, UploadFile } from '@mui/icons-material';
import { Alert, Box, Button, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cancelCampaignExport, createCampaignExport, createCampaignInventoryItem, createExamCampaign, createExamSite, deleteCampaignInventoryItem, deleteExamCampaign, deleteExamSite, listCampaignExports, listCampaignInventoryItems, listExamCampaigns, listExamSites, updateCampaignInventoryItem, updateExamCampaign, updateExamCampaignStatus, updateExamSite } from '../../services/examCampaigns';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { AppDispatch, RootState } from '../../store';

type Row = Record<string, any>;
const value = (row: Row, camel: string, snake: string) => row?.[camel] ?? row?.[snake] ?? '';

export default function ExamCampaignsPage() {
    const dispatch = useDispatch<AppDispatch>();
    const employees = useSelector((state: RootState) => state.employees.items);
    const profile = useSelector((state: RootState) => state.auth.profile);
    const [campaigns, setCampaigns] = useState<Row[]>([]);
    const [sites, setSites] = useState<Row[]>([]);
    const [items, setItems] = useState<Row[]>([]);
    const [exports, setExports] = useState<Row[]>([]);
    const [campaignId, setCampaignId] = useState('');
    const campaignIdRef = useRef('');
    const [tab, setTab] = useState(0);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [campaignForm, setCampaignForm] = useState({ campaignCode: '', campaignName: '', description: '' });
    const [editingCampaign, setEditingCampaign] = useState(false);
    const [siteForm, setSiteForm] = useState({ siteCode: '', siteName: '', address: '' });
    const [itemForm, setItemForm] = useState({ itemCode: '', itemName: '', unit: 'Bộ', quantityReceived: '', serialNumbers: '' });
    const [exportForm, setExportForm] = useState({ siteId: '', recipientEmployeeId: '', notes: '' });
    const [exportLines, setExportLines] = useState<Record<string, { quantity: string; serialNumbers: string }>>({});

    const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);
    const canManage = profile?.role === 'admin' || profile?.permissions?.includes('inventory.manage') || profile?.permissions?.includes('outbound.create') || profile?.permissions?.includes('*');
    const isAdmin = profile?.role === 'admin';

    useEffect(() => { campaignIdRef.current = campaignId; }, [campaignId]);

    const selectCampaign = (nextCampaignId: string) => {
        if (nextCampaignId === campaignIdRef.current) return;
        campaignIdRef.current = nextCampaignId;
        setCampaignId(nextCampaignId);
    };

    const refresh = async (nextCampaignId?: string) => {
        setBusy(true); setMessage('');
        try {
            const nextCampaigns = await listExamCampaigns() as unknown as Row[];
            setCampaigns(nextCampaigns);
            const activeId = (nextCampaignId ?? campaignIdRef.current) || nextCampaigns[0]?.id || '';
            selectCampaign(activeId);
            if (activeId) {
                const [nextSites, nextItems, nextExports] = await Promise.all([listExamSites(activeId), listCampaignInventoryItems(activeId), listCampaignExports(activeId)]);
                setSites(nextSites as unknown as Row[]); setItems(nextItems as unknown as Row[]); setExports(nextExports as unknown as Row[]);
            } else { setSites([]); setItems([]); setExports([]); }
        } catch (error: any) { setMessage(error.message || 'Không thể tải dữ liệu kỳ thi'); }
        finally { setBusy(false); }
    };

    useEffect(() => { void refresh(); void dispatch(fetchEmployees()); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (campaignId) void refresh(campaignId); }, [campaignId]); // eslint-disable-line react-hooks/exhaustive-deps

    const submit = async (action: () => Promise<unknown>, reset: () => void) => {
        setBusy(true); setMessage('');
        try { await action(); reset(); await refresh(campaignIdRef.current); }
        catch (error: any) { setMessage(error.message || 'Không thể lưu dữ liệu'); }
        finally { setBusy(false); }
    };

    const exportRows = useMemo(() => exports.filter((row) => value(row, 'status', 'status') === 'ISSUED'), [exports]);

    const editSite = (site: Row) => void submit(async () => {
        const siteCode = window.prompt('Mã điểm trường', value(site, 'siteCode', 'site_code')); if (siteCode === null) return;
        const siteName = window.prompt('Tên điểm trường', value(site, 'siteName', 'site_name')); if (siteName === null) return;
        const address = window.prompt('Địa chỉ', value(site, 'address', 'address')); if (address === null) return;
        const contactName = window.prompt('Người liên hệ', value(site, 'contactName', 'contact_name')); if (contactName === null) return;
        const contactPhone = window.prompt('Số điện thoại', value(site, 'contactPhone', 'contact_phone')); if (contactPhone === null) return;
        await updateExamSite({ id: site.id, siteCode, siteName, address, contactName, contactPhone });
    }, () => undefined);
    const editItem = (item: Row) => void submit(async () => {
        const itemCode = window.prompt('Mã vật tư', value(item, 'itemCode', 'item_code')); if (itemCode === null) return;
        const itemName = window.prompt('Tên vật tư', value(item, 'itemName', 'item_name')); if (itemName === null) return;
        const unit = window.prompt('Đơn vị tính', value(item, 'unit', 'unit')); if (unit === null) return;
        const quantityReceived = window.prompt('Số lượng đã nhập', value(item, 'quantityReceived', 'quantity_received')); if (quantityReceived === null) return;
        const serialNumbers = window.prompt('Serial (phân cách bằng dấu phẩy)', value(item, 'serialNumbers', 'serial_numbers')); if (serialNumbers === null) return;
        await updateCampaignInventoryItem({ id: item.id, campaignId, itemCode, itemName, unit, quantityReceived: Number(quantityReceived), quantityAvailable: Number(value(item, 'quantityAvailable', 'quantity_available')), serialNumbers });
    }, () => undefined);

    const downloadTemplate = async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet(tab === 0 ? 'Chiến dịch' : tab === 1 ? 'Điểm trường' : 'Vật tư');
        const headers = tab === 0
            ? ['Mã chiến dịch', 'Tên chiến dịch', 'Mô tả']
            : tab === 1
                ? ['Mã điểm trường', 'Tên điểm trường', 'Địa chỉ', 'Người liên hệ', 'Số điện thoại']
                : ['Mã vật tư', 'Tên vật tư', 'Đơn vị tính', 'Số lượng', 'Serial (nếu có)'];
        sheet.addRow(headers);
        sheet.addRow(tab === 0 ? ['CT-2026-01', 'Kỳ thi mẫu', 'Nhập mô tả nếu có'] : tab === 1 ? ['DT-01', 'Điểm trường mẫu', 'Địa chỉ mẫu', 'Nguyễn Văn A', '0900000000'] : ['VT-001', 'Vật tư mẫu', 'Bộ', 1, '']);
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1F4E78' } };
        sheet.columns.forEach((column) => { column.width = 24; });
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Mau_import_${sheet.name.replaceAll(' ', '_')}.xlsx`);
    };

    const importWorkbook = async (file: File) => {
        if ((tab === 1 || tab === 2) && !campaignId) return setMessage('Chọn chiến dịch trước khi nhập dữ liệu này');
        setBusy(true); setMessage('');
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(await file.arrayBuffer());
            const sheet = workbook.worksheets[0];
            if (!sheet) throw new Error('File Excel không có trang dữ liệu');
            const rows = sheet.getSheetValues().slice(2).map((cells: any) => (cells || []).slice(1).map((cell: any) => String(cell?.text ?? cell ?? '').trim())).filter((cells) => cells.some(Boolean));
            if (!rows.length) throw new Error('File Excel chưa có dòng dữ liệu');
            const failures: string[] = [];
            for (let index = 0; index < rows.length; index += 1) {
                const cells = rows[index];
                try {
                    if (tab === 0) await createExamCampaign({ campaignCode: cells[0], campaignName: cells[1], description: cells[2] || '' });
                    if (tab === 1) await createExamSite({ campaignId, siteCode: cells[0], siteName: cells[1], address: cells[2] || null, contactName: cells[3] || null, contactPhone: cells[4] || null } as any);
                    if (tab === 2) await createCampaignInventoryItem(campaignId, { itemCode: cells[0], itemName: cells[1], unit: cells[2], quantityReceived: Number(cells[3]), serialNumbers: cells[4] || null });
                } catch (error: any) { failures.push(`Dòng ${index + 2}: ${error.message || 'không thể nhập'}`); }
            }
            await refresh();
            setMessage(failures.length ? `Đã nhập ${rows.length - failures.length}/${rows.length} dòng. ${failures.slice(0, 3).join('; ')}` : `Đã nhập thành công ${rows.length} dòng.`);
        } catch (error: any) { setMessage(error.message || 'Không thể đọc file Excel'); }
        finally { setBusy(false); }
    };

    const exportReport = async () => {
        if (!campaignId) return setMessage('Chọn chiến dịch trước khi xuất báo cáo');
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Hệ thống quản lý kho GGS';
        workbook.created = new Date();
        const thinBorder = { style: 'thin' as const, color: { argb: 'FF000000' } };
        const title = 'BÁO CÁO VẬT TƯ KỲ THI';
        const reportDate = new Date().toLocaleDateString('vi-VN');
        const formatSheet = (sheet: ExcelJS.Worksheet, headerRow: number, lastColumn: string) => {
            sheet.properties.defaultRowHeight = 20;
            sheet.eachRow((row) => {
                row.eachCell((cell) => {
                    cell.font = { name: 'Times New Roman', size: 11 };
                    cell.alignment = { vertical: 'middle', wrapText: true };
                });
            });
            const header = sheet.getRow(headerRow);
            header.height = 30;
            header.eachCell((cell) => {
                cell.font = { name: 'Times New Roman', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            });
            for (let rowNumber = headerRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
                for (let column = 1; column <= sheet.getColumn(lastColumn).number; column += 1) {
                    const cell = sheet.getRow(rowNumber).getCell(column);
                    cell.border = { top: thinBorder, left: thinBorder, bottom: thinBorder, right: thinBorder };
                }
            }
            sheet.views = [{ state: 'frozen', ySplit: headerRow }];
            sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.45, bottom: 0.45, header: 0.15, footer: 0.15 } };
        };
        const summary = workbook.addWorksheet('Tổng hợp');
        summary.mergeCells('A1:D1'); summary.getCell('A1').value = title;
        summary.mergeCells('A2:D2'); summary.getCell('A2').value = `Chiến dịch: ${value(selectedCampaign || {}, 'campaignName', 'campaign_name')}`;
        summary.mergeCells('A3:D3'); summary.getCell('A3').value = `Mã chiến dịch: ${value(selectedCampaign || {}, 'campaignCode', 'campaign_code')}     |     Ngày lập báo cáo: ${reportDate}`;
        summary.addRows([[], ['CHỈ TIÊU', 'SỐ LƯỢNG'], ['Tổng số vật tư', items.length], ['Tồn khả dụng', items.reduce((sum, item) => sum + Number(value(item, 'quantityAvailable', 'quantity_available') || 0), 0)], ['Phiếu đã lập', exports.length]]);
        summary.getCell('A1').font = { name: 'Times New Roman', size: 16, bold: true }; summary.getCell('A1').alignment = { horizontal: 'center' };
        summary.getCell('A2').font = { name: 'Times New Roman', size: 12, bold: true }; summary.getCell('A2').alignment = { horizontal: 'center' };
        summary.getCell('A3').font = { name: 'Times New Roman', size: 11, italic: true }; summary.getCell('A3').alignment = { horizontal: 'center' };
        summary.columns = [{ width: 35 }, { width: 18 }, { width: 18 }, { width: 18 }];
        formatSheet(summary, 5, 'B');
        const siteSheet = workbook.addWorksheet('Điểm trường');
        siteSheet.mergeCells('A1:E1'); siteSheet.getCell('A1').value = 'DANH SÁCH ĐIỂM TRƯỜNG';
        siteSheet.addRow(['Mã điểm trường', 'Tên điểm trường', 'Địa chỉ', 'Người liên hệ', 'Số điện thoại']);
        sites.forEach((row) => siteSheet.addRow([value(row, 'siteCode', 'site_code'), value(row, 'siteName', 'site_name'), value(row, 'address', 'address'), value(row, 'contactName', 'contact_name'), value(row, 'contactPhone', 'contact_phone')]));
        siteSheet.getCell('A1').font = { name: 'Times New Roman', size: 15, bold: true }; siteSheet.getCell('A1').alignment = { horizontal: 'center' };
        siteSheet.columns = [{ width: 18 }, { width: 30 }, { width: 42 }, { width: 25 }, { width: 18 }]; formatSheet(siteSheet, 2, 'E');
        const itemSheet = workbook.addWorksheet('Báo cáo tồn vật tư');
        itemSheet.mergeCells('A1:G1'); itemSheet.getCell('A1').value = 'BÁO CÁO NHẬP - XUẤT - TỒN VẬT TƯ';
        itemSheet.mergeCells('A2:G2'); itemSheet.getCell('A2').value = `Chiến dịch: ${value(selectedCampaign || {}, 'campaignName', 'campaign_name')}`;
        itemSheet.addRow(['Mã vật tư', 'Tên vật tư', 'ĐVT', 'Nhập', 'Xuất', 'Tồn cuối', 'Serial']);
        items.forEach((row) => {
            const received = Number(value(row, 'quantityReceived', 'quantity_received') || 0);
            const available = Number(value(row, 'quantityAvailable', 'quantity_available') || 0);
            itemSheet.addRow([value(row, 'itemCode', 'item_code'), value(row, 'itemName', 'item_name'), value(row, 'unit', 'unit'), received, received - available, available, value(row, 'serialNumbers', 'serial_numbers')]);
        });
        itemSheet.addRow(['TỔNG CỘNG', '', '', { formula: `SUM(D4:D${items.length + 3})` }, { formula: `SUM(E4:E${items.length + 3})` }, { formula: `SUM(F4:F${items.length + 3})` }, '']);
        itemSheet.getCell('A1').font = { name: 'Times New Roman', size: 15, bold: true }; itemSheet.getCell('A1').alignment = { horizontal: 'center' };
        itemSheet.getCell('A2').font = { name: 'Times New Roman', size: 11, italic: true }; itemSheet.getCell('A2').alignment = { horizontal: 'center' };
        itemSheet.columns = [{ width: 16 }, { width: 34 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 30 }]; formatSheet(itemSheet, 3, 'G');
        itemSheet.getRow(items.length + 4).font = { name: 'Times New Roman', size: 11, bold: true };
        const exportSheet = workbook.addWorksheet('Chi tiết phiếu xuất');
        exportSheet.mergeCells('A1:K1'); exportSheet.getCell('A1').value = 'BÁO CÁO CHI TIẾT PHIẾU XUẤT VẬT TƯ';
        exportSheet.mergeCells('A2:K2'); exportSheet.getCell('A2').value = `Chiến dịch: ${value(selectedCampaign || {}, 'campaignName', 'campaign_name')}`;
        exportSheet.addRow(['Số phiếu', 'Ngày xuất', 'Trạng thái', 'Điểm trường', 'Tên người nhận', 'Mã vật tư', 'Tên vật tư', 'ĐVT', 'Số lượng xuất', 'Serial', 'Ghi chú']);
        exports.forEach((document) => {
            const recipientId = value(document, 'recipientEmployeeId', 'recipient_employee_id');
            const recipient = employees.find((employee) => employee.id === recipientId);
            const site = sites.find((candidate) => candidate.id === value(document, 'siteId', 'site_id'));
            const lines = value(document, 'campaignExportLines', 'campaign_export_lines') || [];
            if (!lines.length) {
                exportSheet.addRow([value(document, 'documentNumber', 'document_number'), value(document, 'exportDate', 'export_date'), value(document, 'status', 'status'), value(site || {}, 'siteName', 'site_name'), recipient?.full_name || recipientId, '', '', '', '', '', value(document, 'notes', 'notes')]);
                return;
            }
            lines.forEach((line: Row) => {
                const item = items.find((candidate) => candidate.id === (line.inventory_item_id || line.inventoryItemId));
                exportSheet.addRow([value(document, 'documentNumber', 'document_number'), value(document, 'exportDate', 'export_date'), value(document, 'status', 'status'), value(site || {}, 'siteName', 'site_name'), recipient?.full_name || recipientId, value(item || line, 'itemCode', 'item_code'), value(item || line, 'itemName', 'item_name') || line.inventory_item_id, value(item || line, 'unit', 'unit'), line.quantity, line.serial_numbers || line.serialNumbers || '', value(document, 'notes', 'notes')]);
            });
        });
        exportSheet.getCell('A1').font = { name: 'Times New Roman', size: 15, bold: true }; exportSheet.getCell('A1').alignment = { horizontal: 'center' };
        exportSheet.getCell('A2').font = { name: 'Times New Roman', size: 11, italic: true }; exportSheet.getCell('A2').alignment = { horizontal: 'center' };
        exportSheet.columns = [{ width: 25 }, { width: 14 }, { width: 14 }, { width: 24 }, { width: 25 }, { width: 16 }, { width: 32 }, { width: 10 }, { width: 16 }, { width: 24 }, { width: 30 }]; formatSheet(exportSheet, 3, 'K');
        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Bao_cao_ky_thi_${value(selectedCampaign || {}, 'campaignCode', 'campaign_code') || 'du_lieu'}.xlsx`);
    };
    const printDocument = (document: Row) => {
        const lines = value(document, 'campaignExportLines', 'campaign_export_lines') || [];
        const safe = (input: unknown) => String(input ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));
        const rows = lines.map((line: Row, index: number) => {
            const item = items.find((candidate) => candidate.id === (line.inventory_item_id || line.inventoryItemId));
            return `<tr><td class="center">${index + 1}</td><td>${safe(value(item || line, 'itemName', 'item_name') || line.inventory_item_id)}</td><td class="center">${safe(value(item || line, 'unit', 'unit') || 'Bộ')}</td><td class="center">${safe(line.quantity)}</td><td>${safe(line.serial_numbers || line.serialNumbers || '-')}</td></tr>`;
        }).join('');
        const recipientId = value(document, 'recipientEmployeeId', 'recipient_employee_id');
        const recipient = employees.find((employee) => employee.id === recipientId);
        const recipientName = recipient?.full_name || recipientId;
        const site = sites.find((candidate) => candidate.id === value(document, 'siteId', 'site_id'));
        const date = new Date(`${value(document, 'exportDate', 'export_date')}T00:00:00`);
        const dateLabel = Number.isNaN(date.getTime()) ? value(document, 'exportDate', 'export_date') : `Ngày ${String(date.getDate()).padStart(2, '0')} tháng ${String(date.getMonth() + 1).padStart(2, '0')} năm ${date.getFullYear()}`;
        // `noopener` makes Chromium return null here, leaving the newly opened
        // tab at about:blank. Write the controlled, escaped document first,
        // then remove the opener before printing.
        const win = window.open('', '_blank');
        if (!win) return setMessage('Trình duyệt đã chặn cửa sổ in');
        win.document.write(`<!doctype html><html><head><title>Biên bản bàn giao</title><style>@page{size:A4 portrait;margin:18mm 16mm}body{font-family:'Times New Roman',serif;color:#000;font-size:13pt;line-height:1.35}.header{display:grid;grid-template-columns:48% 52%;margin-bottom:20px}.company{text-align:center;font-weight:bold;font-size:10pt;white-space:nowrap}.company .line{width:55%;border-bottom:1px solid #000;margin:5px auto}.title{text-align:center}.title h1{font-size:17pt;margin:0 0 4px}.title p{margin:0}.number{display:inline-block;border:1px solid #000;padding:3px 16px;margin-top:7px;font-weight:bold}.info{margin:15px 0}.info p{margin:4px 0}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #000;padding:7px 6px}th{text-align:center;font-weight:bold}.center{text-align:center}.notice{font-style:italic;margin-top:12px}.sign{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;margin-top:48px}.sign b{display:block;text-transform:uppercase}.sign small{font-style:italic}.name{margin-top:65px;font-weight:bold}@media print{body{margin:0}}</style></head><body><div class="header"><div class="company">CÔNG TY CỔ PHẦN VIỄN THÔNG ACT<div class="line"></div>TRUNG TÂM ACT BẮC SÀI GÒN</div><div class="title"><h1>BIÊN BẢN BÀN GIAO VẬT TƯ</h1><p>${safe(dateLabel)}</p><div class="number">Số: ${safe(value(document, 'documentNumber', 'document_number'))}</div></div></div><div class="info"><p><b>Chiến dịch:</b> ${safe(value(selectedCampaign || {}, 'campaignName', 'campaign_name'))}</p><p><b>Điểm trường:</b> ${safe(value(site || {}, 'siteName', 'site_name') || '-')}</p><p><b>Người nhận:</b> ${safe(recipientName)}</p></div><table><thead><tr><th>STT</th><th>TÊN HÀNG HÓA, VẬT TƯ</th><th>ĐVT</th><th>SL</th><th>GHI CHÚ / SERIAL</th></tr></thead><tbody>${rows}<tr><td colspan="3" class="center"><b>TỔNG CỘNG</b></td><td class="center"><b>${lines.reduce((total: number, line: Row) => total + Number(line.quantity || 0), 0)}</b></td><td></td></tr></tbody></table><p class="notice">Người nhận đã kiểm tra số lượng, tình trạng vật tư và chịu trách nhiệm quản lý sau khi ký nhận.</p><div class="sign"><div><b>Người nhận</b><small>(Ký, ghi rõ họ tên)</small><div class="name">${safe(recipientName)}</div></div><div><b>Thủ kho</b><small>(Ký, ghi rõ họ tên)</small><div class="name">${safe(profile?.full_name)}</div></div><div><b>Trưởng bộ phận</b><small>(Ký, ghi rõ họ tên)</small></div></div></body></html>`);
        win.document.close();
        try { win.opener = null; } catch {}
        win.focus(); window.setTimeout(() => win.print(), 250);
    };

    return <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={2}>
            <Box><Typography variant="h4" fontWeight={700}>Kỳ thi – vật tư</Typography><Typography color="text.secondary">Phân hệ độc lập; không tác động tồn kho GGS.</Typography></Box>
            <Button startIcon={<Refresh />} onClick={() => void refresh()} disabled={busy}>Làm mới</Button>
        </Stack>
        {message && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
        <Paper sx={{ p: 2, mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="center">
            <TextField select label="Chiến dịch" value={campaignId} onChange={(e) => selectCampaign(e.target.value)} fullWidth>
                {campaigns.map((campaign) => <MenuItem key={campaign.id} value={campaign.id}>{value(campaign, 'campaignCode', 'campaign_code')} — {value(campaign, 'campaignName', 'campaign_name')}</MenuItem>)}
            </TextField>
            {canManage && <Button variant="outlined" startIcon={<Add />} onClick={() => setTab(0)}>Tạo chiến dịch</Button>}
        </Stack></Paper>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }} variant="scrollable"><Tab label="Chiến dịch"/><Tab label="Điểm trường" disabled={!campaignId}/><Tab label="Vật tư" disabled={!campaignId}/><Tab label="Xuất & biên bản" disabled={!campaignId}/></Tabs>
        {canManage && tab < 3 && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mb: 2 }}>
            <Button variant="outlined" startIcon={<Download />} onClick={() => void exportReport()} disabled={!campaignId}>Xuất báo cáo Excel</Button>
            <Button variant="outlined" startIcon={<Download />} onClick={() => void downloadTemplate()}>Tải mẫu Excel</Button>
            <Button component="label" variant="outlined" startIcon={<UploadFile />} disabled={busy}>Import Excel<input hidden type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importWorkbook(file); event.currentTarget.value = ''; }} /></Button>
        </Stack>}
        {tab === 0 && <Paper sx={{ p: 2 }}><Typography fontWeight={700} mb={2}>{editingCampaign ? 'Cập nhật chiến dịch' : 'Tạo chiến dịch mới'}</Typography><Stack gap={2}>{['campaignCode','campaignName','description'].map((key) => <TextField key={key} label={key === 'campaignCode' ? 'Mã chiến dịch' : key === 'campaignName' ? 'Tên chiến dịch' : 'Mô tả'} value={(campaignForm as any)[key]} onChange={(e) => setCampaignForm({ ...campaignForm, [key]: e.target.value })} disabled={!canManage || busy}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} variant="contained" disabled={busy} onClick={() => void submit(async () => { if (editingCampaign) await updateExamCampaign({ id: campaignId, ...campaignForm }); else { const created: any = await createExamCampaign(campaignForm as any); selectCampaign(created.id); } }, () => { setCampaignForm({ campaignCode: '', campaignName: '', description: '' }); setEditingCampaign(false); })}>{editingCampaign ? 'Cập nhật chiến dịch' : 'Lưu chiến dịch'}</Button>}{isAdmin && selectedCampaign && <Button sx={{ mt: 2, ml: 1 }} variant="outlined" onClick={() => { setCampaignForm({ campaignCode: value(selectedCampaign, 'campaignCode', 'campaign_code'), campaignName: value(selectedCampaign, 'campaignName', 'campaign_name'), description: value(selectedCampaign, 'description', 'description') }); setEditingCampaign(true); }}>Sửa chiến dịch đã chọn</Button>}{isAdmin && selectedCampaign && <Button sx={{ mt: 2, ml: 1 }} color="error" variant="outlined" onClick={() => { if (window.confirm('Xóa chiến dịch này? Dữ liệu liên quan phải được xóa hoặc hủy trước.')) void submit(async () => { await deleteExamCampaign(campaignId); selectCampaign(''); }, () => undefined); }}>Xóa chiến dịch</Button>}{selectedCampaign && canManage && value(selectedCampaign, 'status', 'status') === 'DRAFT' && <Button sx={{ mt: 2, ml: 1 }} variant="outlined" onClick={() => void submit(() => updateExamCampaignStatus(campaignId, 'ACTIVE'), () => undefined)}>Kích hoạt chiến dịch</Button>}</Paper>}
        {tab === 1 && <Paper sx={{ p: 2 }}><Typography fontWeight={700}>Điểm trường</Typography><Stack direction={{ xs:'column', md:'row' }} gap={1} mt={2}>{['siteCode','siteName','address'].map((key) => <TextField key={key} label={key === 'siteCode' ? 'Mã điểm trường' : key === 'siteName' ? 'Tên điểm trường' : 'Địa chỉ'} value={(siteForm as any)[key]} onChange={(e) => setSiteForm({ ...siteForm, [key]: e.target.value })} disabled={!canManage}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} onClick={() => void submit(() => createExamSite({ campaignId, ...siteForm, contactName: null, contactPhone: null } as any), () => setSiteForm({ siteCode:'',siteName:'',address:'' }))}>Thêm điểm trường</Button>}<Divider sx={{ my:2 }}/>{sites.map((site) => <Stack key={site.id} direction="row" justifyContent="space-between" alignItems="center"><Typography>{value(site,'siteCode','site_code')} — {value(site,'siteName','site_name')} {value(site,'address','address') && `(${value(site,'address','address')})`}</Typography>{isAdmin && <Box><Button size="small" onClick={() => editSite(site)}>Sửa</Button><Button size="small" color="error" onClick={() => { if (window.confirm('Xóa điểm trường này?')) void submit(() => deleteExamSite(site.id), () => undefined); }}>Xóa</Button></Box>}</Stack>)}</Paper>}
        {tab === 2 && <Paper sx={{ p: 2 }}><Typography fontWeight={700}>Vật tư theo chiến dịch</Typography><Stack direction={{ xs:'column', md:'row' }} gap={1} mt={2}>{[['itemCode','Mã'],['itemName','Tên vật tư'],['unit','ĐVT'],['quantityReceived','Số lượng'],['serialNumbers','Serial']].map(([key,label]) => <TextField key={key} label={label} type={key==='quantityReceived'?'number':'text'} value={(itemForm as any)[key]} onChange={(e) => setItemForm({ ...itemForm, [key]: e.target.value })} disabled={!canManage} helperText={key === 'serialNumbers' ? 'Nhiều serial, cách nhau bằng dấu phẩy' : undefined}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} onClick={() => void submit(() => createCampaignInventoryItem(campaignId, { ...itemForm, quantityReceived:Number(itemForm.quantityReceived) } as any), () => setItemForm({ itemCode:'',itemName:'',unit:'Bộ',quantityReceived:'',serialNumbers:'' }))}>Nhập vật tư</Button>}<Divider sx={{my:2}}/>{items.map((item) => <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="center"><Typography>{value(item,'itemCode','item_code')} — {value(item,'itemName','item_name')}: còn {value(item,'quantityAvailable','quantity_available')} {value(item,'unit','unit')}{value(item,'serialNumbers','serial_numbers') && ` · Serial: ${value(item,'serialNumbers','serial_numbers')}`}</Typography>{isAdmin && <Box><Button size="small" onClick={() => editItem(item)}>Sửa</Button><Button size="small" color="error" onClick={() => { if (window.confirm('Xóa vật tư này?')) void submit(() => deleteCampaignInventoryItem(item.id), () => undefined); }}>Xóa</Button></Box>}</Stack>)}</Paper>}
        {tab === 3 && <Paper sx={{ p: 2 }}>
            <Stack direction={{ xs:'column', sm:'row' }} justifyContent="space-between" gap={1}><Typography fontWeight={700}>Xuất bàn giao</Typography><Button startIcon={<Download />} variant="outlined" onClick={() => void exportReport()}>Tải báo cáo Excel</Button></Stack>
            {canManage && <Stack gap={1} mt={2}>
                <TextField select label="Điểm trường" value={exportForm.siteId} onChange={(e) => setExportForm({...exportForm, siteId:e.target.value})}><MenuItem value="">Không chọn</MenuItem>{sites.map((site)=><MenuItem value={site.id} key={site.id}>{value(site,'siteName','site_name')}</MenuItem>)}</TextField>
                <TextField select label="Nhân sự GGS nhận" value={exportForm.recipientEmployeeId} onChange={(e)=>setExportForm({...exportForm, recipientEmployeeId:e.target.value})}>{employees.map((employee)=><MenuItem value={employee.id} key={employee.id}>{employee.full_name}</MenuItem>)}</TextField>
                <Typography fontWeight={700}>Danh sách vật tư xuất</Typography>
                {items.map((item) => <Stack key={item.id} direction={{ xs:'column', md:'row' }} gap={1} alignItems={{ md:'center' }} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}><Typography sx={{ flex: 1 }}>{value(item,'itemCode','item_code')} — {value(item,'itemName','item_name')} (còn {value(item,'quantityAvailable','quantity_available')} {value(item,'unit','unit')})</Typography><TextField label="Số lượng xuất" type="number" size="small" value={exportLines[item.id]?.quantity || ''} onChange={(e) => setExportLines({ ...exportLines, [item.id]: { quantity: e.target.value, serialNumbers: exportLines[item.id]?.serialNumbers || '' } })}/><TextField label="Serial xuất" size="small" value={exportLines[item.id]?.serialNumbers || ''} onChange={(e) => setExportLines({ ...exportLines, [item.id]: { quantity: exportLines[item.id]?.quantity || '', serialNumbers: e.target.value } })}/></Stack>)}
                <Button variant="contained" onClick={() => void submit(() => createCampaignExport({ campaignId: campaignIdRef.current || campaignId, siteId: exportForm.siteId || undefined, recipientEmployeeId: exportForm.recipientEmployeeId, exportDate: new Date().toISOString().slice(0,10), notes: exportForm.notes, lines: items.map((item) => ({ inventoryItemId: item.id, quantity: Number(exportLines[item.id]?.quantity), serialNumbers: exportLines[item.id]?.serialNumbers || undefined })).filter((line) => line.quantity > 0) }), () => { setExportForm({siteId:'',recipientEmployeeId:'',notes:''}); setExportLines({}); })}>Lập phiếu xuất</Button>
            </Stack>}
            <Divider sx={{my:2}}/>{exportRows.map((doc)=><Stack direction="row" justifyContent="space-between" key={doc.id}><Typography>{value(doc,'documentNumber','document_number')} — {value(doc,'exportDate','export_date')}</Typography><Box><Button size="small" startIcon={<Print/>} onClick={()=>printDocument(doc)}>In biên bản</Button>{profile?.role === 'admin' && <Button size="small" color="error" onClick={() => void submit(() => cancelCampaignExport(doc.id), () => undefined)}>Hủy phiếu</Button>}</Box></Stack>)}
        </Paper>}
    </Box>;
}
