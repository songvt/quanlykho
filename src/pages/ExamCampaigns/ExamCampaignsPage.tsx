import { Add, Print, Refresh } from '@mui/icons-material';
import { Alert, Box, Button, Divider, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { cancelCampaignExport, createCampaignExport, createCampaignInventoryItem, createExamCampaign, createExamSite, listCampaignExports, listCampaignInventoryItems, listExamCampaigns, listExamSites } from '../../services/examCampaigns';
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
    const [tab, setTab] = useState(0);
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);
    const [campaignForm, setCampaignForm] = useState({ campaignCode: '', campaignName: '', description: '' });
    const [siteForm, setSiteForm] = useState({ siteCode: '', siteName: '', address: '' });
    const [itemForm, setItemForm] = useState({ itemCode: '', itemName: '', unit: 'Bộ', quantityReceived: '', serialNumbers: '' });
    const [exportForm, setExportForm] = useState({ siteId: '', recipientEmployeeId: '', itemId: '', quantity: '', notes: '' });

    const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);
    const canManage = profile?.role === 'admin' || profile?.permissions?.includes('inventory.manage') || profile?.permissions?.includes('outbound.create') || profile?.permissions?.includes('*');

    const refresh = async (nextCampaignId = campaignId) => {
        setBusy(true); setMessage('');
        try {
            const nextCampaigns = await listExamCampaigns() as unknown as Row[];
            setCampaigns(nextCampaigns);
            const activeId = nextCampaignId || nextCampaigns[0]?.id || '';
            setCampaignId(activeId);
            if (activeId) {
                const [nextSites, nextItems, nextExports] = await Promise.all([listExamSites(activeId), listCampaignInventoryItems(activeId), listCampaignExports(activeId)]);
                setSites(nextSites as unknown as Row[]); setItems(nextItems as unknown as Row[]); setExports(nextExports as unknown as Row[]);
            } else { setSites([]); setItems([]); setExports([]); }
        } catch (error: any) { setMessage(error.message || 'Không thể tải dữ liệu kỳ thi'); }
        finally { setBusy(false); }
    };

    useEffect(() => { void refresh(); void dispatch(fetchEmployees()); }, []);
    useEffect(() => { if (campaignId) void refresh(campaignId); }, [campaignId]);

    const submit = async (action: () => Promise<unknown>, reset: () => void) => {
        setBusy(true); setMessage('');
        try { await action(); reset(); await refresh(); }
        catch (error: any) { setMessage(error.message || 'Không thể lưu dữ liệu'); }
        finally { setBusy(false); }
    };

    const exportRows = useMemo(() => exports.filter((row) => value(row, 'status', 'status') === 'ISSUED'), [exports]);
    const printDocument = (document: Row) => {
        const lines = value(document, 'campaignExportLines', 'campaign_export_lines') || [];
        const safe = (input: unknown) => String(input ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]!));
        const rows = lines.map((line: Row, index: number) => `<tr><td>${index + 1}</td><td>${safe(line.item_name || line.inventory_item_id)}</td><td>${safe(line.quantity)}</td><td>${safe(line.serial_numbers)}</td></tr>`).join('');
        const win = window.open('', '_blank', 'noopener,noreferrer');
        if (!win) return setMessage('Trình duyệt đã chặn cửa sổ in');
        win.document.write(`<!doctype html><html><head><title>Biên bản bàn giao</title><style>body{font-family:Arial;padding:28px;color:#111}h1{text-align:center;font-size:20px}table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #222;padding:8px;text-align:left}.sign{display:flex;justify-content:space-between;margin-top:48px;text-align:center}</style></head><body><h1>BIÊN BẢN BÀN GIAO VẬT TƯ</h1><p>Số: ${safe(value(document, 'documentNumber', 'document_number'))}</p><p>Chiến dịch: ${safe(value(selectedCampaign || {}, 'campaignName', 'campaign_name'))}</p><p>Ngày bàn giao: ${safe(value(document, 'exportDate', 'export_date'))}</p><table><thead><tr><th>STT</th><th>Vật tư</th><th>Số lượng</th><th>Serial</th></tr></thead><tbody>${rows}</tbody></table><div class="sign"><div><b>BÊN GIAO</b><br><br><br>${safe(profile?.full_name)}</div><div><b>BÊN NHẬN</b><br><br><br>${safe(value(document, 'recipientEmployeeId', 'recipient_employee_id'))}</div></div></body></html>`);
        win.document.close(); win.focus(); window.setTimeout(() => win.print(), 250);
    };

    return <Box sx={{ p: { xs: 2, md: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} mb={2}>
            <Box><Typography variant="h4" fontWeight={700}>Kỳ thi – vật tư</Typography><Typography color="text.secondary">Phân hệ độc lập; không tác động tồn kho GGS.</Typography></Box>
            <Button startIcon={<Refresh />} onClick={() => void refresh()} disabled={busy}>Làm mới</Button>
        </Stack>
        {message && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
        <Paper sx={{ p: 2, mb: 2 }}><Stack direction={{ xs: 'column', md: 'row' }} gap={2} alignItems="center">
            <TextField select label="Chiến dịch" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} fullWidth>
                {campaigns.map((campaign) => <MenuItem key={campaign.id} value={campaign.id}>{value(campaign, 'campaignCode', 'campaign_code')} — {value(campaign, 'campaignName', 'campaign_name')}</MenuItem>)}
            </TextField>
            {canManage && <Button variant="outlined" startIcon={<Add />} onClick={() => setTab(0)}>Tạo chiến dịch</Button>}
        </Stack></Paper>
        <Tabs value={tab} onChange={(_, next) => setTab(next)} sx={{ mb: 2 }} variant="scrollable"><Tab label="Chiến dịch"/><Tab label="Điểm trường" disabled={!campaignId}/><Tab label="Vật tư" disabled={!campaignId}/><Tab label="Xuất & biên bản" disabled={!campaignId}/></Tabs>
        {tab === 0 && <Paper sx={{ p: 2 }}><Typography fontWeight={700} mb={2}>Tạo chiến dịch mới</Typography><Stack gap={2}>{['campaignCode','campaignName','description'].map((key) => <TextField key={key} label={key === 'campaignCode' ? 'Mã chiến dịch' : key === 'campaignName' ? 'Tên chiến dịch' : 'Mô tả'} value={(campaignForm as any)[key]} onChange={(e) => setCampaignForm({ ...campaignForm, [key]: e.target.value })} disabled={!canManage || busy}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} variant="contained" onClick={() => void submit(async () => { const created: any = await createExamCampaign(campaignForm as any); setCampaignId(created.id); }, () => setCampaignForm({ campaignCode: '', campaignName: '', description: '' }))}>Lưu chiến dịch</Button>}</Paper>}
        {tab === 1 && <Paper sx={{ p: 2 }}><Typography fontWeight={700}>Điểm trường</Typography><Stack direction={{ xs:'column', md:'row' }} gap={1} mt={2}>{['siteCode','siteName','address'].map((key) => <TextField key={key} label={key === 'siteCode' ? 'Mã điểm trường' : key === 'siteName' ? 'Tên điểm trường' : 'Địa chỉ'} value={(siteForm as any)[key]} onChange={(e) => setSiteForm({ ...siteForm, [key]: e.target.value })} disabled={!canManage}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} onClick={() => void submit(() => createExamSite({ campaignId, ...siteForm, contactName: null, contactPhone: null } as any), () => setSiteForm({ siteCode:'',siteName:'',address:'' }))}>Thêm điểm trường</Button>}<Divider sx={{ my:2 }}/>{sites.map((site) => <Typography key={site.id}>{value(site,'siteCode','site_code')} — {value(site,'siteName','site_name')} {value(site,'address','address') && `(${value(site,'address','address')})`}</Typography>)}</Paper>}
        {tab === 2 && <Paper sx={{ p: 2 }}><Typography fontWeight={700}>Vật tư theo chiến dịch</Typography><Stack direction={{ xs:'column', md:'row' }} gap={1} mt={2}>{[['itemCode','Mã'],['itemName','Tên vật tư'],['unit','ĐVT'],['quantityReceived','Số lượng']].map(([key,label]) => <TextField key={key} label={label} type={key==='quantityReceived'?'number':'text'} value={(itemForm as any)[key]} onChange={(e) => setItemForm({ ...itemForm, [key]: e.target.value })} disabled={!canManage}/>)}</Stack>{canManage && <Button sx={{ mt: 2 }} onClick={() => void submit(() => createCampaignInventoryItem(campaignId, { ...itemForm, quantityReceived:Number(itemForm.quantityReceived) } as any), () => setItemForm({ itemCode:'',itemName:'',unit:'Bộ',quantityReceived:'',serialNumbers:'' }))}>Nhập vật tư</Button>}<Divider sx={{my:2}}/>{items.map((item) => <Typography key={item.id}>{value(item,'itemCode','item_code')} — {value(item,'itemName','item_name')}: còn {value(item,'quantityAvailable','quantity_available')} {value(item,'unit','unit')}</Typography>)}</Paper>}
        {tab === 3 && <Paper sx={{ p: 2 }}><Typography fontWeight={700}>Xuất bàn giao</Typography>{canManage && <Stack gap={1} mt={2}><TextField select label="Điểm trường" value={exportForm.siteId} onChange={(e) => setExportForm({...exportForm,siteId:e.target.value})}><MenuItem value="">Không chọn</MenuItem>{sites.map((site)=><MenuItem value={site.id} key={site.id}>{value(site,'siteName','site_name')}</MenuItem>)}</TextField><TextField select label="Nhân sự GGS nhận" value={exportForm.recipientEmployeeId} onChange={(e)=>setExportForm({...exportForm,recipientEmployeeId:e.target.value})}>{employees.map((employee)=><MenuItem value={employee.id} key={employee.id}>{employee.full_name}</MenuItem>)}</TextField><TextField select label="Vật tư" value={exportForm.itemId} onChange={(e)=>setExportForm({...exportForm,itemId:e.target.value})}>{items.map((item)=><MenuItem value={item.id} key={item.id}>{value(item,'itemName','item_name')} (còn {value(item,'quantityAvailable','quantity_available')})</MenuItem>)}</TextField><TextField label="Số lượng xuất" type="number" value={exportForm.quantity} onChange={(e)=>setExportForm({...exportForm,quantity:e.target.value})}/><Button variant="contained" onClick={() => void submit(() => createCampaignExport({ campaignId, siteId: exportForm.siteId || undefined, recipientEmployeeId: exportForm.recipientEmployeeId, exportDate: new Date().toISOString().slice(0,10), notes: exportForm.notes, lines: [{ inventoryItemId:exportForm.itemId, quantity:Number(exportForm.quantity) }] }), () => setExportForm({siteId:'',recipientEmployeeId:'',itemId:'',quantity:'',notes:''}))}>Lập phiếu xuất</Button></Stack>}<Divider sx={{my:2}}/>{exportRows.map((doc)=><Stack direction="row" justifyContent="space-between" key={doc.id}><Typography>{value(doc,'documentNumber','document_number')} — {value(doc,'exportDate','export_date')}</Typography><Box><Button size="small" startIcon={<Print/>} onClick={()=>printDocument(doc)}>In biên bản</Button>{profile?.role === 'admin' && <Button size="small" color="error" onClick={() => void submit(() => cancelCampaignExport(doc.id), () => undefined)}>Hủy phiếu</Button>}</Box></Stack>)}</Paper>}
    </Box>;
}
