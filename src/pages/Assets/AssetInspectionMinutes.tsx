import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, CircularProgress, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ExcelJS from 'exceljs';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import type { HRProfile } from '../../types';
import { downloadAsDataUri } from '../../utils/excelUtils';
import { resolveEmployeeDistrict } from '../../utils/employeeDistrict';
import { getInspectionProtectiveItems } from '../../utils/assetInspectionItems';
import { GoogleSheetService } from '../../services/GoogleSheetService';

const currentDate = () => new Date().toLocaleDateString('vi-VN');
const currentTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
interface EmployeeGroup { id: string; name: string; department: string; email?: string; }
const DEFAULT_INSPECTION_TEAM = [
    'Trần Kim Hùng | Trưởng Ban',
    'Trần Việt Bắc | Phó Ban',
    'Võ Thanh Song | Ủy Viên',
    'Phạm Nguyễn Minh Quyền | Ủy Viên',
    'Trần Dũng | Ủy Viên',
    'Nguyễn Thái Sơn | Ủy Viên',
].join('\n');

// Danh mục được giữ cố định theo biểu mẫu kiểm tra CCDC-CĐBR đã cung cấp.
const FIXED_INSPECTION_ITEMS = [
    { name: 'Dao cắt chính xác sợi cáp quang FC-6S', quota: '1 Bộ/1NV' },
    { name: 'Kim tuốt sợi quang 3 lỗ CFS-3', quota: '1 Bộ/1NV' },
    { name: 'Bút soi dò lỗi sợi quang', quota: '1 Chiếc/1NV' },
    { name: 'Thang nhôm rút 3.4m', quota: '1 Chiếc/1NV', specification: 'Thang nhôm rút 3.4m (Chắc chắn, có bọc chống trượt)' },
    { name: 'Tô vít 2 đầu 6x250mm', quota: '1 Chiếc/1NV' },
    { name: 'Kim cắt cáp cầm tay', quota: '1 Chiếc/1NV' },
    { name: 'Bút thử điện', quota: '1 Chiếc/1NV' },
    { name: 'Dao trổ loại lớn', quota: '1 Chiếc/1NV' },
    { name: 'Kim bấm mạng RJ45, RJ11', quota: '1 Chiếc/1NV' },
    { name: 'Túi đựng dụng cụ', quota: '1 Chiếc/1NV' },
    { name: 'Sào luồn cáp vào gông', quota: '1 Chiếc/1NV', specification: 'Sào luồn cáp vào gông (Phải có cách điện)' },
    { name: 'Máy đo công suất quang', quota: '1 Cái/1NV' },
];

const AssetInspectionMinutes = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: employees, status } = useSelector((state: RootState) => state.hrProfiles);
    const { profile } = useSelector((state: RootState) => state.auth);
    const printRef = useRef<HTMLDivElement>(null);
    const blankPrintRef = useRef<HTMLDivElement>(null);
    const [keyword, setKeyword] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [inspectionDate, setInspectionDate] = useState(currentDate());
    const [inspectionTime, setInspectionTime] = useState(currentTime());
    const [includeTimestamp, setIncludeTimestamp] = useState(true);
    const [location, setLocation] = useState('Văn phòng Trung tâm ACT KV Bắc Sài Gòn');
    const [inspectionTeam, setInspectionTeam] = useState(DEFAULT_INSPECTION_TEAM);
    const [content, setContent] = useState('Kiểm tra CCDC cá nhân theo danh mục và Bảo hộ lao động.');
    const [notes, setNotes] = useState('');
    const inspectionProtectiveItems = getInspectionProtectiveItems();
    const inspectionPeriod = (() => {
        const [, month, year] = inspectionDate.split('/');
        return month && year ? `Kỳ kiểm tra tháng ${month}.${year}` : 'Kỳ kiểm tra tháng chưa xác định';
    })();
    const inspectionOpening = includeTimestamp
        ? `Hôm nay, vào lúc ${inspectionTime} ngày ${inspectionDate}, tại ${location}, chúng tôi gồm:`
        : `Hôm nay, vào lúc ........ giờ ........ phút, ngày ........ tháng ........ năm ........, tại ${location}, chúng tôi gồm:`;

    useEffect(() => { dispatch(fetchHRProfiles()); }, [dispatch]);

    const employeeGroups = useMemo(() => {
        return employees.filter((employee: HRProfile) => employee.full_name?.trim()).map((employee: HRProfile) => ({ id: employee.id, name: employee.full_name.trim(), department: employee.department || '', email: employee.email })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }, [employees]);
    const filteredEmployees = useMemo(() => {
        const needle = keyword.trim().toLocaleLowerCase('vi');
        return employeeGroups.filter(group => !needle || `${group.name} ${group.department}`.toLocaleLowerCase('vi').includes(needle));
    }, [employeeGroups, keyword]);
    const printGroups = useMemo(() => employeeGroups.filter(group => selectedEmployees.includes(group.id)), [employeeGroups, selectedEmployees]);
    const toggleEmployee = (id: string) => setSelectedEmployees(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id]);
    const toggleAllFiltered = () => setSelectedEmployees(previous => {
        const ids = filteredEmployees.map(group => group.id);
        return ids.every(id => previous.includes(id)) ? previous.filter(id => !ids.includes(id)) : [...new Set([...previous, ...ids])];
    });

    const printMinutes = () => {
        if (!printGroups.length) return;
        const body = printRef.current?.innerHTML;
        if (!body) return;
        const popup = window.open('', '_blank', 'width=1100,height=800');
        if (!popup) return;
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Biên bản kiểm tra tài sản</title><style>
            @page { size: A4 portrait; margin: 11mm 13mm; } * { box-sizing: border-box; } body { margin: 0; color: #000; font: 10.5pt 'Times New Roman', serif; line-height: 1.25; }
            .inspection-page { break-after: page; page-break-after: always; } .inspection-page:last-child { break-after: auto; page-break-after: auto; }
            .header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 7px; text-align: center; font-weight: bold; } .header p { margin: 0 0 2px; } .company-unit { border-bottom: 1px solid #000; display: inline-block; padding: 0 10px 2px; }
            .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 8px 0; } .line { margin: 4px 0; text-align: justify; } .section { font-weight: bold; margin-top: 7px; } .team-row, .subject-row, .subject-heading { display: grid; grid-template-columns: 1fr 180px; gap: 18px; margin: 3px 0; } .subject-heading { align-items: end; margin-top: 7px; } .subject-heading .section { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 8.8pt; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } th, td { border: 1px solid #000; padding: 3px; vertical-align: middle; } th { text-align: center; font-weight: bold; } td.center { text-align: center; }
            .section-two { margin-top: 9px; } .proposal-line { display: flex; align-items: baseline; gap: 4px; } .proposal-leader { flex: 1; overflow: hidden; white-space: nowrap; letter-spacing: 0.2px; } .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 6px; text-align: center; font-weight: bold; break-inside: avoid; page-break-inside: avoid; } .sign-space { height: 56px; }
        </style></head><body>${body}</body></html>`);
        popup.document.close(); popup.focus(); window.setTimeout(() => popup.print(), 500);
        const performedBy = profile?.full_name || profile?.username || profile?.email || 'Hệ thống';
        void Promise.all(printGroups.map(group => GoogleSheetService.saveAssetLog({
            asset_code: 'BIEN_BAN_KIEM_TRA', asset_name: 'Biên bản kiểm tra CCDC', action: 'In biên bản kiểm tra',
            details: `In biên bản kiểm tra CCDC và trang bị bảo hộ lao động; ngày ${inspectionDate}, ${inspectionTime}.`,
            employee_name: group.name, department: group.department, performed_by: performedBy,
        }))).catch(error => console.error('Không thể lưu log in biên bản:', error));
    };

    const printBlankTemplate = () => {
        const body = blankPrintRef.current?.innerHTML;
        if (!body) return;
        const popup = window.open('', '_blank', 'width=1100,height=800');
        if (!popup) return;
        popup.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>Mẫu biên bản kiểm tra trống</title><style>
            @page { size: A4 portrait; margin: 11mm 13mm; } * { box-sizing: border-box; } body { margin: 0; color: #000; font: 10.5pt 'Times New Roman', serif; line-height: 1.25; }
            .inspection-page { break-after: page; page-break-after: always; } .inspection-page:last-child { break-after: auto; page-break-after: auto; }
            .header { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 7px; text-align: center; font-weight: bold; } .header p { margin: 0 0 2px; } .company-unit { border-bottom: 1px solid #000; display: inline-block; padding: 0 10px 2px; }
            .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 8px 0; } .line { margin: 4px 0; text-align: justify; } .section { font-weight: bold; margin-top: 7px; } .team-row, .subject-heading { display: grid; grid-template-columns: 1fr 180px; gap: 18px; margin: 3px 0; } .subject-heading { align-items: end; margin-top: 7px; } .subject-heading .section { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 8.8pt; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } th, td { border: 1px solid #000; padding: 3px; vertical-align: middle; } th { text-align: center; font-weight: bold; } td.center { text-align: center; }
            .section-two { margin-top: 9px; } .proposal-line { display: flex; align-items: baseline; gap: 4px; } .proposal-leader { flex: 1; overflow: hidden; white-space: nowrap; letter-spacing: 0.2px; } .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 6px; text-align: center; font-weight: bold; break-inside: avoid; page-break-inside: avoid; } .sign-space { height: 56px; }
        </style></head><body>${body}</body></html>`);
        popup.document.close(); popup.focus(); window.setTimeout(() => popup.print(), 500);
    };

    const exportInspectionExcel = async () => {
        if (!printGroups.length) return;
        let assetLogs: any[];
        try {
            const result = await GoogleSheetService.getAssetLogs();
            assetLogs = Array.isArray(result) ? result : [];
        } catch (error) {
            console.error('Không thể tải log kiểm tra để xuất báo cáo:', error);
            window.alert('Không thể tải lịch sử kiểm tra. Vui lòng thử lại sau để xuất báo cáo đối chiếu chính xác.');
            return;
        }
        const [, inspectionMonth, inspectionYear] = inspectionDate.split('/');
        const vietnamDateParts = (value: string) => {
            const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
            return Object.fromEntries(parts.filter(part => ['year', 'month', 'day'].includes(part.type)).map(part => [part.type, part.value]));
        };
        const periodLogs = assetLogs.filter(log => {
            if (log.asset_code !== 'BIEN_BAN_KIEM_TRA' || log.action !== 'In biên bản kiểm tra' || !log.employee_name || !log.created_at) return false;
            const date = vietnamDateParts(log.created_at);
            return date.month === inspectionMonth && date.year === inspectionYear;
        });
        const latestLogByEmployeeDay = new Map<string, any>();
        periodLogs.forEach(log => {
            const date = vietnamDateParts(log.created_at);
            const key = `${log.employee_name.trim().toLocaleLowerCase('vi')}|${date.year}-${date.month}-${date.day}`;
            const saved = latestLogByEmployeeDay.get(key);
            if (!saved || new Date(log.created_at).getTime() > new Date(saved.created_at).getTime()) latestLogByEmployeeDay.set(key, log);
        });
        const reportLogs = [...latestLogByEmployeeDay.values()].sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime());
        const checkedEmployeeNames = new Set(reportLogs.map(log => log.employee_name.trim().toLocaleLowerCase('vi')));
        const employeeAccounts = await GoogleSheetService.fetchEmployees().catch(error => {
            console.warn('Không thể tải Quận/Huyện của nhân viên để xuất Excel:', error);
            return [];
        });
        const formatLogTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)).replace(',', '');
        const workbook = new ExcelJS.Workbook();
        const performedBy = profile?.full_name || profile?.username || profile?.email || 'Hệ thống';
        const tableBorder = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } };
        printGroups.forEach((group, index) => {
            const sheet = workbook.addWorksheet(`Bien ban ${index + 1}`);
            sheet.columns = [{ width: 5 }, { width: 27 }, { width: 10 }, { width: 13 }, { width: 35 }, { width: 9 }];
            sheet.views = [{ showGridLines: false }];
            sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.25, right: 0.25, top: 0.35, bottom: 0.35, header: 0.1, footer: 0.1 } };
            const center = { horizontal: 'center' as const, vertical: 'middle' as const, wrapText: true };
            const writeMerged = (range: string, value: string, options: { bold?: boolean; size?: number; italic?: boolean; alignment?: Partial<ExcelJS.Alignment> } = {}) => {
                sheet.mergeCells(range);
                const cell = sheet.getCell(range.split(':')[0]);
                cell.value = value;
                cell.font = { name: 'Times New Roman', size: options.size || 10, bold: options.bold, italic: options.italic };
                cell.alignment = { vertical: 'middle', ...(options.alignment || {}) };
            };

            writeMerged('A1:C1', 'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT', { bold: true, alignment: center });
            writeMerged('D1:F1', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true, alignment: center });
            writeMerged('A2:C2', 'TRUNG TÂM BẮC SÀI GÒN', { bold: true, alignment: center });
            writeMerged('D2:F2', 'Độc lập - Tự do - Hạnh phúc', { alignment: center });
            ['A2', 'D2'].forEach(address => sheet.getCell(address).border = { bottom: { style: 'thin' } });
            writeMerged('A4:F4', 'BIÊN BẢN KIỂM TRA', { bold: true, size: 14, alignment: center });
            writeMerged('A5:F5', inspectionOpening, { size: 10 });
            writeMerged('A6:F6', 'A. ĐOÀN KIỂM TRA', { bold: true });
            let rowNumber = 7;
            teamMembers.forEach(member => {
                writeMerged(`A${rowNumber}:C${rowNumber}`, `Họ và tên: ${member.name}`, { size: 10 });
                writeMerged(`D${rowNumber}:F${rowNumber}`, `Chức vụ: ${member.title || '................................'}`, { size: 10 });
                rowNumber += 1;
            });
            writeMerged(`A${rowNumber}:C${rowNumber}`, 'B. ĐỐI TƯỢNG KIỂM TRA', { bold: true });
            writeMerged(`D${rowNumber}:F${rowNumber}`, group.department ? `Nhóm/đơn vị: ${group.department}` : '', { size: 10 }); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, `1. Họ và tên: ${group.name}`, { size: 10 }); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, `1. Nội dung kiểm tra: ${content}`, { bold: true, size: 10 }); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, '2. Kết quả kiểm tra như sau:', { bold: true, size: 10 }); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, 'I. CÔNG CỤ DỤNG CỤ (CCDC)', { bold: true }); rowNumber += 1;
            const inspectionHeaderRow = rowNumber;
            sheet.getRow(rowNumber).values = ['STT', 'Nội dung yêu cầu', 'Số lượng', 'Số lượng định mức', 'Quy cách, TCKT', 'Ghi chú']; rowNumber += 1;
            FIXED_INSPECTION_ITEMS.forEach((item, itemIndex) => { sheet.getRow(rowNumber).values = [itemIndex + 1, item.name, '', item.quota, item.specification || item.name, '']; rowNumber += 1; });
            const protectiveTitleRow = rowNumber;
            writeMerged(`A${rowNumber}:F${rowNumber}`, 'II. TRANG BỊ BẢO HỘ LAO ĐỘNG', { bold: true }); rowNumber += 1;
            const protectiveHeaderRow = rowNumber;
            sheet.getRow(rowNumber).values = ['STT', 'Nội dung yêu cầu', 'Đơn vị tính', 'Số lượng', 'Ghi chú', '']; rowNumber += 1;
            inspectionProtectiveItems.forEach((item, itemIndex) => { sheet.getRow(rowNumber).values = [itemIndex + 1, item.name, item.unit, '', '', '']; rowNumber += 1; });
            writeMerged(`A${rowNumber}:F${rowNumber}`, 'Đề xuất, đánh giá: ........................................................................................................................................................................', { bold: true }); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, '......................................................................................................................................................................................................'); rowNumber += 1;
            writeMerged(`A${rowNumber}:F${rowNumber}`, 'Biên bản lập thành 02 bản có giá trị như nhau và có hiệu lực từ ngày ký.', { italic: true }); rowNumber += 1;
            const signatureRow = rowNumber;
            writeMerged(`A${rowNumber}:B${rowNumber}`, 'NHÂN VIÊN KIỂM TRA', { bold: true, alignment: center });
            writeMerged(`C${rowNumber}:D${rowNumber}`, 'NHÂN VIÊN ĐƯỢC KIỂM TRA', { bold: true, alignment: center });
            writeMerged(`E${rowNumber}:F${rowNumber}`, 'P. GIÁM ĐỐC TRUNG TÂM', { bold: true, alignment: center });
            sheet.mergeCells(`A${rowNumber + 1}:B${rowNumber + 4}`); sheet.mergeCells(`C${rowNumber + 1}:D${rowNumber + 4}`); sheet.mergeCells(`E${rowNumber + 1}:F${rowNumber + 4}`);
            sheet.getCell(`C${rowNumber + 4}`).value = group.name;
            sheet.getCell(`C${rowNumber + 4}`).font = { name: 'Times New Roman', size: 10, bold: true };
            sheet.getCell(`C${rowNumber + 4}`).alignment = center;

            sheet.eachRow((row, currentRow) => row.eachCell((cell, column) => {
                const inspectionTable = currentRow >= inspectionHeaderRow && currentRow < protectiveTitleRow;
                const protectiveTable = currentRow >= protectiveHeaderRow && currentRow <= signatureRow - 4 && column <= 5;
                if (!inspectionTable && !protectiveTable) return;
                const header = currentRow === inspectionHeaderRow || currentRow === protectiveHeaderRow;
                cell.font = { name: 'Times New Roman', size: 9, bold: header };
                cell.border = tableBorder;
                cell.alignment = header || column === 1 || (inspectionTable && (column === 3 || column === 4)) || (protectiveTable && (column === 3 || column === 4)) ? center : { vertical: 'middle', wrapText: true };
            }));
            sheet.getRow(4).height = 22;
            for (let row = inspectionHeaderRow; row < signatureRow; row += 1) sheet.getRow(row).height = 18;
            sheet.getRow(signatureRow + 1).height = 16; sheet.getRow(signatureRow + 2).height = 16; sheet.getRow(signatureRow + 3).height = 16; sheet.getRow(signatureRow + 4).height = 16;
        });
        const logSheet = workbook.addWorksheet('Log in bien ban');
        logSheet.columns = [{ width: 7 }, { width: 22 }, { width: 24 }, { width: 30 }, { width: 28 }, { width: 24 }, { width: 28 }];
        logSheet.addRow(['STT', 'Kỳ kiểm tra tháng', 'Thời gian lập', 'Loại biên bản', 'Nhân viên được kiểm tra', 'Đơn vị / bộ phận', 'Người lập / in']);
        reportLogs.forEach((log, index) => logSheet.addRow([index + 1, inspectionPeriod, formatLogTime(log.created_at), log.asset_name || 'Biên bản kiểm tra CCDC', log.employee_name, log.department || '-', log.performed_by || '-']));
        logSheet.eachRow((row, rowIndex) => row.eachCell(cell => { cell.font = { name: 'Times New Roman', size: 10, bold: rowIndex === 1 }; cell.border = tableBorder; cell.alignment = { vertical: 'middle', wrapText: true, horizontal: rowIndex === 1 ? 'center' : 'left' }; }));
        const uncheckedEmployees = employeeGroups.filter(group => !checkedEmployeeNames.has(group.name.toLocaleLowerCase('vi')));
        const uncheckedSheet = workbook.addWorksheet('Chưa kiểm tra');
        uncheckedSheet.columns = [{ width: 8 }, { width: 24 }, { width: 30 }, { width: 27 }, { width: 18 }, { width: 22 }];
        uncheckedSheet.mergeCells('A1:F1');
        uncheckedSheet.getCell('A1').value = `DANH SÁCH NHÂN VIÊN CHƯA KIỂM TRA - NGÀY ${inspectionDate}`;
        uncheckedSheet.getCell('A1').font = { name: 'Times New Roman', size: 13, bold: true };
        uncheckedSheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        uncheckedSheet.getRow(1).height = 24;
        uncheckedSheet.getRow(3).values = ['STT', 'Kỳ kiểm tra tháng', 'Họ và tên', 'Đơn vị / bộ phận', 'Quận/Huyện', 'Trạng thái'];
        uncheckedEmployees.forEach((group, index) => uncheckedSheet.addRow([index + 1, inspectionPeriod, group.name, group.department || '-', resolveEmployeeDistrict(group, Array.isArray(employeeAccounts) ? employeeAccounts : []), 'Chưa kiểm tra']));
        uncheckedSheet.eachRow((row, rowIndex) => row.eachCell((cell, column) => {
            if (rowIndex < 3) return;
            cell.font = { name: 'Times New Roman', size: 11, bold: rowIndex === 3 };
            cell.border = tableBorder;
            cell.alignment = { vertical: 'middle', wrapText: true, horizontal: rowIndex === 3 || column === 1 ? 'center' : 'left' };
        }));
        uncheckedSheet.views = [{ showGridLines: false }];
        uncheckedSheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.35, right: 0.35, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
        downloadAsDataUri(await workbook.xlsx.writeBuffer(), 'Bieu_mau_bien_ban_kiem_tra.xlsx');
    };

    const allFilteredSelected = !!filteredEmployees.length && filteredEmployees.every(group => selectedEmployees.includes(group.id));
    const someFilteredSelected = filteredEmployees.some(group => selectedEmployees.includes(group.id));
    const teamMembers = inspectionTeam.split('\n').map(value => {
        const [name, title] = value.split('|').map(part => part.trim());
        return { name, title: title || '' };
    }).filter(member => member.name);

    return <Box p={{ xs: 1, sm: 3 }}>
        <Typography variant="h4" fontWeight={900} color="primary">BIÊN BẢN KIỂM TRA TÀI SẢN</Typography>
        <Typography color="text.secondary" mb={2}>Chọn nhân viên để in biên bản riêng cho từng người. Danh mục CCDC trong biên bản được cố định theo mẫu Word.</Typography>
        <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
            <Stack spacing={1.5} direction={{ xs: 'column', md: 'row' }}><TextField label="Ngày lập biên bản" value={inspectionDate} onChange={event => setInspectionDate(event.target.value)} fullWidth /><TextField label="Thời gian" value={inspectionTime} onChange={event => setInspectionTime(event.target.value)} fullWidth /><TextField label="Địa điểm kiểm tra" value={location} onChange={event => setLocation(event.target.value)} fullWidth /></Stack>
            <FormControlLabel sx={{ mt: 0.75, ml: 0 }} control={<Checkbox checked={includeTimestamp} onChange={event => setIncludeTimestamp(event.target.checked)} />} label="Ghi ngày, giờ vào biên bản" />
            <Stack spacing={1.5} direction={{ xs: 'column', md: 'row' }} mt={1.5}><TextField label="Đoàn kiểm tra" helperText="Mỗi dòng theo cấu trúc: Họ và tên | Chức vụ." value={inspectionTeam} onChange={event => setInspectionTeam(event.target.value)} fullWidth multiline minRows={6} /><TextField label="Nội dung kiểm tra" value={content} onChange={event => setContent(event.target.value)} fullWidth multiline minRows={3} /><TextField label="Ghi chú kết quả" value={notes} onChange={event => setNotes(event.target.value)} fullWidth multiline minRows={3} /></Stack>
        </Paper>
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} p={1.5} alignItems={{ md: 'center' }} flexWrap="wrap">
                <TextField size="small" label="Tìm nhân viên hoặc đơn vị" value={keyword} onChange={event => setKeyword(event.target.value)} sx={{ flex: '1 1 260px' }} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} />
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: '0 1 auto' }}>
                    <Button variant="outlined" startIcon={<PrintIcon />} onClick={printBlankTemplate} sx={{ minWidth: 142, height: 40, borderRadius: 2, fontWeight: 700, textTransform: 'none', color: '#e2e8f0', borderColor: '#64748b', '&:hover': { borderColor: '#cbd5e1', bgcolor: 'rgba(148,163,184,0.12)' } }}>In mẫu trống</Button>
                    <Button variant="outlined" startIcon={<DownloadIcon />} disabled={!printGroups.length} onClick={exportInspectionExcel} sx={{ minWidth: 166, height: 40, borderRadius: 2, fontWeight: 700, textTransform: 'none', color: '#bfdbfe', borderColor: '#60a5fa', '&:hover': { borderColor: '#93c5fd', bgcolor: 'rgba(96,165,250,0.12)' }, '&.Mui-disabled': { color: 'rgba(191,219,254,0.48)', borderColor: 'rgba(96,165,250,0.36)' } }}>Xuất biên bản Excel</Button>
                    <Button variant="contained" startIcon={<PrintIcon />} disabled={!printGroups.length} onClick={printMinutes} sx={{ minWidth: 188, height: 40, borderRadius: 2, fontWeight: 800, textTransform: 'none', bgcolor: '#2563eb', color: '#fff', boxShadow: '0 5px 14px rgba(37,99,235,0.3)', '&:hover': { bgcolor: '#1d4ed8', boxShadow: '0 6px 18px rgba(37,99,235,0.42)' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.55)', bgcolor: 'rgba(37,99,235,0.38)' } }}>In biên bản ({printGroups.length} đã chọn / {employeeGroups.length} NV)</Button>
                </Stack>
            </Stack>
            {status === 'loading' ? <Box textAlign="center" p={4}><CircularProgress /></Box> : <Box sx={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: '#4b5563', color: '#f8fafc' }}><th style={{ padding: 8 }}><Checkbox size="small" checked={allFilteredSelected} indeterminate={someFilteredSelected && !allFilteredSelected} onChange={toggleAllFiltered} /></th><th>NHÂN VIÊN</th><th>ĐƠN VỊ / BỘ PHẬN</th><th>SỐ DÒNG MẪU</th><th>DANH MỤC KIỂM TRA</th></tr></thead><tbody>{filteredEmployees.map(group => <tr key={group.id}><td align="center"><Checkbox size="small" checked={selectedEmployees.includes(group.id)} onChange={() => toggleEmployee(group.id)} /></td><td>{group.name}</td><td>{group.department || '-'}</td><td align="center">{FIXED_INSPECTION_ITEMS.length}</td><td>CCDC kỹ thuật cố định theo biểu mẫu</td></tr>)}{!filteredEmployees.length && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>Chưa có dữ liệu nhân viên.</td></tr>}</tbody></table></Box>}
        </Paper>
        <Box ref={printRef} sx={{ display: 'none' }}>{printGroups.map(group => <div className="inspection-page" key={group.id}>
            <div className="header"><div><p>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</p><p className="company-unit">TRUNG TÂM BẮC SÀI GÒN</p></div><div><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p className="company-unit">Độc lập - Tự do - Hạnh phúc</p></div></div><div className="title">BIÊN BẢN KIỂM TRA</div>
            <div className="line">{inspectionOpening}</div><div className="section">A. ĐOÀN KIỂM TRA</div>{teamMembers.length ? teamMembers.map(member => <div className="team-row" key={member.name}><div>Họ và tên: {member.name}</div><div>Chức vụ: {member.title || '................................'}</div></div>) : <div className="line">Họ và tên: ................................................................................................</div>}
            <div className="subject-heading"><div className="section">B. ĐỐI TƯỢNG KIỂM TRA</div><div>{group.department ? `Nhóm/đơn vị: ${group.department}` : ''}</div></div><div className="line">1. Họ và tên: {group.name}</div><div className="line"><b>1. Nội dung kiểm tra:</b> {content}</div><div className="line"><b>2. Kết quả kiểm tra như sau:</b></div>
            <div className="section">I. CÔNG CỤ DỤNG CỤ (CCDC)</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Số lượng</th><th>Số lượng định mức</th><th>Quy cách, TCKT</th><th>Ghi chú</th></tr></thead><tbody>{FIXED_INSPECTION_ITEMS.map((item, index) => <tr key={item.name}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center"></td><td className="center">{item.quota}</td><td>{item.specification || item.name}</td><td></td></tr>)}</tbody></table>
            <div className="section section-two">II. TRANG BỊ BẢO HỘ LAO ĐỘNG</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Đơn vị tính</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>{inspectionProtectiveItems.map((item, index) => <tr key={item.name}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center">{item.unit}</td><td className="center"></td><td></td></tr>)}</tbody></table>
            {notes && <div className="line"><b>Ghi chú:</b> {notes}</div>}<div className="line proposal-line" style={{ marginTop: 12 }}><b>Đề xuất, đánh giá:</b><span className="proposal-leader">................................................................................................................................................................................................................................................................</span></div><div className="line proposal-line"><span className="proposal-leader">................................................................................................................................................................................................................................................................</span></div><div className="line" style={{ fontStyle: 'italic' }}>Biên bản lập thành 02 bản có giá trị như nhau và có hiệu lực từ ngày ký.</div><div className="signatures"><div>NHÂN VIÊN KIỂM TRA<div className="sign-space"></div></div><div>NHÂN VIÊN ĐƯỢC KIỂM TRA<div className="sign-space"></div>{group.name}</div><div>P. GIÁM ĐỐC TRUNG TÂM<div className="sign-space"></div></div></div>
        </div>)}</Box>
        <Box ref={blankPrintRef} sx={{ display: 'none' }}><div className="inspection-page">
            <div className="header"><div><p>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</p><p className="company-unit">TRUNG TÂM BẮC SÀI GÒN</p></div><div><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p className="company-unit">Độc lập - Tự do - Hạnh phúc</p></div></div><div className="title">BIÊN BẢN KIỂM TRA</div>
            <div className="line">Hôm nay, vào lúc ........ giờ ........ phút, ngày ........ tháng ........ năm ........, tại ................................................................, chúng tôi gồm:</div><div className="section">A. ĐOÀN KIỂM TRA</div>{teamMembers.map(member => <div className="team-row" key={`blank-${member.name}`}><div>Họ và tên: {member.name}</div><div>Chức vụ: {member.title || '................................'}</div></div>)}
            <div className="subject-heading"><div className="section">B. ĐỐI TƯỢNG KIỂM TRA</div><div>Nhóm/đơn vị: ................................</div></div><div className="line">1. Họ và tên: ........................................................................................................................</div><div className="line"><b>1. Nội dung kiểm tra:</b> {content}</div><div className="line"><b>2. Kết quả kiểm tra như sau:</b></div>
            <div className="section">I. CÔNG CỤ DỤNG CỤ (CCDC)</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Số lượng</th><th>Số lượng định mức</th><th>Quy cách, TCKT</th><th>Ghi chú</th></tr></thead><tbody>{FIXED_INSPECTION_ITEMS.map((item, index) => <tr key={`blank-${item.name}`}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center"></td><td className="center">{item.quota}</td><td>{item.specification || item.name}</td><td></td></tr>)}</tbody></table>
            <div className="section section-two">II. TRANG BỊ BẢO HỘ LAO ĐỘNG</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Đơn vị tính</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>{inspectionProtectiveItems.map((item, index) => <tr key={`blank-protective-${item.name}`}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center">{item.unit}</td><td className="center"></td><td></td></tr>)}</tbody></table>
            <div className="line proposal-line" style={{ marginTop: 12 }}><b>Đề xuất, đánh giá:</b><span className="proposal-leader">................................................................................................................................................................................................................................................................</span></div><div className="line proposal-line"><span className="proposal-leader">................................................................................................................................................................................................................................................................</span></div><div className="line" style={{ fontStyle: 'italic' }}>Biên bản lập thành 02 bản có giá trị như nhau và có hiệu lực từ ngày ký.</div><div className="signatures"><div>NHÂN VIÊN KIỂM TRA<div className="sign-space"></div></div><div>NHÂN VIÊN ĐƯỢC KIỂM TRA<div className="sign-space"></div></div><div>P. GIÁM ĐỐC TRUNG TÂM<div className="sign-space"></div></div></div>
        </div></Box>
    </Box>;
};

export default AssetInspectionMinutes;
