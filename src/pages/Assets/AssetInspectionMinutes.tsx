import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Checkbox, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import ExcelJS from 'exceljs';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { Employee } from '../../types';
import { downloadAsDataUri } from '../../utils/excelUtils';
import { GoogleSheetService } from '../../services/GoogleSheetService';

const currentDate = () => new Date().toLocaleDateString('vi-VN');
const currentTime = () => new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
interface EmployeeGroup { id: string; name: string; department: string; }
const DEFAULT_INSPECTION_TEAM = [
    'Trần Kim Hùng | Trưởng Ban',
    'Trần Việt Bắc | Phó Ban',
    'Võ Thanh Song | Ủy Viên',
    'Phạm Nguyễn Minh Quyền | Ủy Viên',
    'Trần Dũng | Ủy Viên',
    'Võ Hoàng Ngọc Quí | Ủy Viên',
].join('\n');

// Danh mục được giữ cố định theo biểu mẫu kiểm tra CCDC-CĐBR đã cung cấp.
const FIXED_INSPECTION_ITEMS = [
    { name: 'Dao cắt chính xác sợi cáp quang FC-6S', quota: '1 Bộ/1NV' },
    { name: 'Kim tuốt sợi quang 3 lỗ CFS-3', quota: '1 Bộ/1NV' },
    { name: 'Bút soi dò lỗi sợi quang', quota: '1 Chiếc/1NV' },
    { name: 'Thang nhôm rút 3.4m', quota: '1 Chiếc/1NV' },
    { name: 'Tô vít 2 đầu 6x250mm', quota: '1 Chiếc/1NV' },
    { name: 'Kim cắt cáp cầm tay', quota: '1 Chiếc/1NV' },
    { name: 'Bút thử điện', quota: '1 Chiếc/1NV' },
    { name: 'Dao trổ loại lớn', quota: '1 Chiếc/1NV' },
    { name: 'Kim bấm mạng RJ45, RJ11', quota: '1 Chiếc/1NV' },
    { name: 'Túi đựng dụng cụ', quota: '1 Chiếc/1NV' },
    { name: 'Sào luồn cáp vào gông', quota: '1 Chiếc/1NV' },
    { name: 'Máy đo công suất quang', quota: '1 Cái/1NV' },
];

const FIXED_PROTECTIVE_ITEMS = [
    { name: 'Dây đai bảo hiểm', unit: 'Chiếc' },
    { name: 'Mũ cứng bảo hộ', unit: 'Chiếc' },
    { name: 'Quần áo bảo hộ lao động', unit: 'Bộ' },
    { name: 'Giày Bảo Hộ Lao Động', unit: 'Đôi' },
    { name: 'Bảng tên nhân viên', unit: 'Cái' },
];

const AssetInspectionMinutes = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { items: employees, status } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);
    const printRef = useRef<HTMLDivElement>(null);
    const [keyword, setKeyword] = useState('');
    const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
    const [inspectionDate, setInspectionDate] = useState(currentDate());
    const [inspectionTime, setInspectionTime] = useState(currentTime());
    const [location, setLocation] = useState('Văn phòng Trung tâm ACT KV Bắc Sài Gòn');
    const [inspectionTeam, setInspectionTeam] = useState(DEFAULT_INSPECTION_TEAM);
    const [content, setContent] = useState('Kiểm tra tài sản cá nhân theo danh mục và định mức được giao.');
    const [notes, setNotes] = useState('');

    useEffect(() => { dispatch(fetchEmployees()); }, [dispatch]);

    const employeeGroups = useMemo(() => {
        return employees.filter((employee: Employee) => employee.full_name?.trim()).map((employee: Employee) => ({ id: employee.id, name: employee.full_name.trim(), department: employee.department || employee.district || '' })).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
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
            .title { text-align: center; font-size: 14pt; font-weight: bold; margin: 8px 0; } .line { margin: 4px 0; text-align: justify; } .section { font-weight: bold; margin-top: 7px; } .team-row { display: grid; grid-template-columns: 1fr 180px; gap: 18px; margin: 3px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 8.8pt; } thead { display: table-header-group; } tr { break-inside: avoid; page-break-inside: avoid; } th, td { border: 1px solid #000; padding: 3px; vertical-align: middle; } th { text-align: center; font-weight: bold; } td.center { text-align: center; }
            .section-two { margin-top: 9px; } .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 10px; text-align: center; font-weight: bold; break-inside: avoid; page-break-inside: avoid; } .sign-space { height: 32px; }
        </style></head><body>${body}</body></html>`);
        popup.document.close(); popup.focus(); window.setTimeout(() => popup.print(), 500);
        const performedBy = profile?.full_name || profile?.username || profile?.email || 'Hệ thống';
        void Promise.all(printGroups.map(group => GoogleSheetService.saveAssetLog({
            asset_code: 'BIEN_BAN_KIEM_TRA', asset_name: 'Biên bản kiểm tra CCDC', action: 'In biên bản kiểm tra',
            details: `In biên bản kiểm tra CCDC và trang bị bảo hộ lao động; ngày ${inspectionDate}, ${inspectionTime}.`,
            employee_name: group.name, department: group.department, performed_by: performedBy,
        }))).catch(error => console.error('Không thể lưu log in biên bản:', error));
    };

    const exportInspectionExcel = async () => {
        if (!printGroups.length) return;
        const workbook = new ExcelJS.Workbook();
        const logSheet = workbook.addWorksheet('Log in bien ban');
        logSheet.columns = [{ width: 7 }, { width: 22 }, { width: 30 }, { width: 28 }, { width: 24 }, { width: 28 }];
        logSheet.addRow(['STT', 'Thời gian lập', 'Loại biên bản', 'Nhân viên được kiểm tra', 'Đơn vị / bộ phận', 'Người lập / in']);
        const performedBy = profile?.full_name || profile?.username || profile?.email || 'Hệ thống';
        printGroups.forEach((group, index) => logSheet.addRow([index + 1, `${inspectionTime} ${inspectionDate}`, 'Biên bản kiểm tra CCDC', group.name, group.department || '-', performedBy]));
        logSheet.getRow(1).font = { name: 'Times New Roman', size: 11, bold: true };
        logSheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        logSheet.eachRow(row => row.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; cell.alignment = { vertical: 'middle', wrapText: true }; }));
        printGroups.forEach((group, index) => {
            const sheet = workbook.addWorksheet(`Kiem tra ${index + 1}`);
            sheet.columns = [{ width: 7 }, { width: 42 }, { width: 16 }, { width: 18 }, { width: 42 }, { width: 20 }];
            const headerLines = [
                'CÔNG TY CỔ PHẦN VIỄN THÔNG ACT - TRUNG TÂM BẮC SÀI GÒN',
                'BIÊN BẢN KIỂM TRA',
                `Thời gian: ${inspectionTime}, ngày ${inspectionDate} | Địa điểm: ${location}`,
                `Đoàn kiểm tra: ${inspectionTeam || '-'}`,
                `Đối tượng kiểm tra: ${group.name}${group.department ? ` - ${group.department}` : ''}`,
                'I. CÔNG CỤ DỤNG CỤ (CCDC)',
            ];
            headerLines.forEach((value, row) => { sheet.mergeCells(`A${row + 1}:F${row + 1}`); sheet.getCell(`A${row + 1}`).value = value; });
            sheet.addRow(['STT', 'Nội dung yêu cầu', 'Số lượng', 'Số lượng định mức', 'Quy cách, TCKT', 'Ghi chú']);
            FIXED_INSPECTION_ITEMS.forEach((item, itemIndex) => sheet.addRow([itemIndex + 1, item.name, '', item.quota, item.name, '']));
            const protectiveTitleRow = sheet.rowCount + 1;
            sheet.mergeCells(`A${protectiveTitleRow}:F${protectiveTitleRow}`); sheet.getCell(`A${protectiveTitleRow}`).value = 'II. TRANG BỊ BẢO HỘ LAO ĐỘNG';
            sheet.addRow(['STT', 'Nội dung yêu cầu', 'Đơn vị tính', 'Số lượng', 'Ghi chú', '']);
            FIXED_PROTECTIVE_ITEMS.forEach((item, itemIndex) => sheet.addRow([itemIndex + 1, item.name, item.unit, '', '', '']));
            sheet.eachRow((row, rowNumber) => {
                row.alignment = { vertical: 'middle', wrapText: true, horizontal: rowNumber === 7 || rowNumber === protectiveTitleRow + 1 ? 'center' : 'left' };
                row.font = { name: 'Times New Roman', size: rowNumber <= 2 ? 14 : 11, bold: rowNumber <= 2 || rowNumber === 6 || rowNumber === 7 || rowNumber === protectiveTitleRow || rowNumber === protectiveTitleRow + 1 };
                if (rowNumber >= 7) row.eachCell(cell => { cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }; });
            });
            sheet.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 2 };
        });
        downloadAsDataUri(await workbook.xlsx.writeBuffer(), 'Log_in_bien_ban_kiem_tra.xlsx');
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
            <Stack spacing={1.5} direction={{ xs: 'column', md: 'row' }} mt={1.5}><TextField label="Đoàn kiểm tra" helperText="Mỗi dòng theo cấu trúc: Họ và tên | Chức vụ." value={inspectionTeam} onChange={event => setInspectionTeam(event.target.value)} fullWidth multiline minRows={6} /><TextField label="Nội dung kiểm tra" value={content} onChange={event => setContent(event.target.value)} fullWidth multiline minRows={3} /><TextField label="Ghi chú kết quả" value={notes} onChange={event => setNotes(event.target.value)} fullWidth multiline minRows={3} /></Stack>
        </Paper>
        <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} p={1.5} alignItems={{ sm: 'center' }}><TextField size="small" fullWidth label="Tìm nhân viên hoặc đơn vị" value={keyword} onChange={event => setKeyword(event.target.value)} InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} /> }} /><Button variant="outlined" startIcon={<DownloadIcon />} disabled={!printGroups.length} onClick={exportInspectionExcel} sx={{ whiteSpace: 'nowrap', color: '#bfdbfe', borderColor: '#60a5fa', '&:hover': { borderColor: '#93c5fd', bgcolor: 'rgba(96,165,250,0.12)' }, '&.Mui-disabled': { color: 'rgba(191,219,254,0.48)', borderColor: 'rgba(96,165,250,0.36)' } }}>Xuất log in biên bản</Button><Button variant="contained" startIcon={<PrintIcon />} disabled={!printGroups.length} onClick={printMinutes} sx={{ whiteSpace: 'nowrap', bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, '&.Mui-disabled': { color: 'rgba(255,255,255,0.55)', bgcolor: 'rgba(37,99,235,0.38)' } }}>In biên bản ({printGroups.length} NV)</Button></Stack>
            {status === 'loading' ? <Box textAlign="center" p={4}><CircularProgress /></Box> : <Box sx={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}><thead><tr style={{ background: '#4b5563', color: '#f8fafc' }}><th style={{ padding: 8 }}><Checkbox size="small" checked={allFilteredSelected} indeterminate={someFilteredSelected && !allFilteredSelected} onChange={toggleAllFiltered} /></th><th>NHÂN VIÊN</th><th>ĐƠN VỊ / BỘ PHẬN</th><th>SỐ DÒNG MẪU</th><th>DANH MỤC KIỂM TRA</th></tr></thead><tbody>{filteredEmployees.map(group => <tr key={group.id}><td align="center"><Checkbox size="small" checked={selectedEmployees.includes(group.id)} onChange={() => toggleEmployee(group.id)} /></td><td>{group.name}</td><td>{group.department || '-'}</td><td align="center">{FIXED_INSPECTION_ITEMS.length}</td><td>CCDC kỹ thuật cố định theo biểu mẫu</td></tr>)}{!filteredEmployees.length && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center' }}>Chưa có dữ liệu nhân viên.</td></tr>}</tbody></table></Box>}
        </Paper>
        <Box ref={printRef} sx={{ display: 'none' }}>{printGroups.map(group => <div className="inspection-page" key={group.id}>
            <div className="header"><div><p>CÔNG TY CỔ PHẦN VIỄN THÔNG ACT</p><p className="company-unit">TRUNG TÂM BẮC SÀI GÒN</p></div><div><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p className="company-unit">Độc lập - Tự do - Hạnh phúc</p></div></div><div className="title">BIÊN BẢN KIỂM TRA</div>
            <div className="line">Hôm nay, vào lúc {inspectionTime} ngày {inspectionDate}, tại {location}, chúng tôi gồm:</div><div className="section">A. ĐOÀN KIỂM TRA</div>{teamMembers.length ? teamMembers.map(member => <div className="team-row" key={member.name}><div>Họ và tên: {member.name}</div><div>Chức vụ: {member.title || '................................'}</div></div>) : <div className="line">Họ và tên: ................................................................................................</div>}
            <div className="section">B. ĐỐI TƯỢNG KIỂM TRA</div><div className="line">1. Họ và tên: {group.name}{group.department ? `    Nhóm/đơn vị: ${group.department}` : ''}</div><div className="line"><b>1. Nội dung kiểm tra:</b> {content}</div><div className="line"><b>2. Kết quả kiểm tra như sau:</b></div>
            <div className="section">I. CÔNG CỤ DỤNG CỤ (CCDC)</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Số lượng</th><th>Số lượng định mức</th><th>Quy cách, TCKT</th><th>Ghi chú</th></tr></thead><tbody>{FIXED_INSPECTION_ITEMS.map((item, index) => <tr key={item.name}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center"></td><td className="center">{item.quota}</td><td>{item.name}</td><td></td></tr>)}</tbody></table>
            <div className="section section-two">II. TRANG BỊ BẢO HỘ LAO ĐỘNG</div><table><thead><tr><th>STT</th><th>Nội dung yêu cầu</th><th>Đơn vị tính</th><th>Số lượng</th><th>Ghi chú</th></tr></thead><tbody>{FIXED_PROTECTIVE_ITEMS.map((item, index) => <tr key={item.name}><td className="center">{index + 1}</td><td>{item.name}</td><td className="center">{item.unit}</td><td className="center"></td><td></td></tr>)}</tbody></table>
            {notes && <div className="line"><b>Ghi chú:</b> {notes}</div>}<div className="line" style={{ marginTop: 12, fontStyle: 'italic' }}>Biên bản lập thành 02 bản có giá trị như nhau và có hiệu lực từ ngày ký.</div><div className="signatures"><div>NHÂN VIÊN KIỂM TRA<div className="sign-space" style={{ height: 85 }}></div></div><div>NHÂN VIÊN ĐƯỢC KIỂM TRA<div className="sign-space" style={{ height: 85 }}></div>{group.name}</div><div>P. GIÁM ĐỐC TRUNG TÂM<div className="sign-space" style={{ height: 85 }}></div></div></div>
        </div>)}</Box>
    </Box>;
};

export default AssetInspectionMinutes;
