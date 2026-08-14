import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, TextField, Button, Grid, MenuItem, Select, InputLabel, FormControl, Divider, CircularProgress, Autocomplete
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../config/supabase';
import { PrintTemplates } from './PrintTemplates';
import dayjs from 'dayjs';

const KCSWarrantyForm: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const printId = searchParams.get('print');

    const [loading, setLoading] = useState(false);
    const [employees, setEmployees] = useState<any[]>([]);
    const [assetsOptions, setAssetsOptions] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        form_code: 'KCS' + dayjs().format('YYYYMMDD'),
        form_type: 'YEU_CAU_KCS',
        requester_id: '',
        department: 'Trung Tâm Bắc Sài Gòn',
        reason: 'Thiết bị hư hỏng cần kiểm tra bảo hành',
        kcs_conclusion: '',
        handover_representative: '',
        receiver_representative: '',
    });

    const [equipmentList, setEquipmentList] = useState([{
        product_id: '',
        product_name: '',
        item_code: '',
        serial: '',
        quantity: 1,
        status: 'Không đạt',
        issue_notes: '',
        supplier: '',
        import_date: '',
        manufacturer: '',
        broken_date: '',
        warranty_end: ''
    }]);

    const [printData, setPrintData] = useState<any>(null);

    useEffect(() => {
        fetchOptions();
        if (printId) {
            fetchPrintData(printId);
        }
    }, [printId]);

    const fetchOptions = async () => {
        const { data: empData } = await supabase.from('employees').select('id, full_name, role');
        if (empData) setEmployees(empData);

        const { data: assetData } = await supabase.from('assets').select('id, asset_name, asset_code, serial_number, user_employee_name, user_employee_code, manager_name, manager_code');
        if (assetData) setAssetsOptions(assetData);
    };

    const fetchPrintData = async (id: string) => {
        setLoading(true);
        const { data, error } = await supabase
            .from('warranty_history')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error("Lỗi khi tải dữ liệu bản in:", error);
            alert("Không thể tải dữ liệu bản in: " + error.message);
        }

        if (data) {
            let requester_name = '';
            if (data.requester_id) {
                const { data: empData } = await supabase.from('employees').select('full_name').eq('id', data.requester_id).single();
                if (empData) requester_name = empData.full_name;
            }
            setPrintData({
                ...data,
                requester_name
            });
            // Automatically trigger print on load if in print mode
            setTimeout(() => {
                window.print();
            }, 500);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setLoading(true);
        const record = {
            form_code: formData.form_code,
            form_type: formData.form_type,
            department: formData.department,
            reason: formData.reason,
            requester_id: formData.requester_id || null,
            equipment_list: equipmentList,
            kcs_conclusion: formData.kcs_conclusion,
            handover_representative: formData.handover_representative,
            receiver_representative: formData.receiver_representative,
        };

        const { data, error } = await supabase
            .from('warranty_history')
            .insert(record)
            .select()
            .single();

        setLoading(false);
        if (!error && data) {
            navigate(`/assets/kcs-warranty/new?print=${data.id}`);
        } else {
            console.error(error);
            alert(`Có lỗi xảy ra khi lưu: ${error?.message || JSON.stringify(error)}`);
        }
    };

    // Render print view if printing
    if (printId) {
        if (loading) return <Box p={4}>Đang tải bản in...</Box>;
        return (
            <Box>
                <Box sx={{ mb: 2, display: 'flex', gap: 2 }} className="no-print">
                    <Button variant="contained" onClick={() => window.print()}>In Trang</Button>
                    <Button variant="outlined" onClick={() => navigate('/assets/kcs-warranty')}>Quay lại danh sách</Button>
                </Box>
                <PrintTemplates data={printData} />
                {/* CSS to hide non-print elements */}
                <style>{`
                    @media print {
                        @page { size: A4 portrait; margin: 15mm; }
                        body * { visibility: hidden !important; }
                        .print-page, .print-page * { visibility: visible !important; }
                        .print-page { 
                            position: fixed !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100vw !important; 
                            margin: 0 !important; 
                            padding: 0 !important; 
                            max-width: none !important;
                        }
                        .no-print { display: none !important; }
                    }
                `}</style>
            </Box>
        );
    }

    return (
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h5" fontWeight="bold" mb={3}>Tạo mới Phiếu KCS / Bảo Hành</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 200px' }}>
                            <FormControl fullWidth>
                                <InputLabel>Loại Phiếu</InputLabel>
                                <Select
                                    value={formData.form_type}
                                    label="Loại Phiếu"
                                    onChange={e => setFormData({ ...formData, form_type: e.target.value })}
                                >
                                    <MenuItem value="YEU_CAU_KCS">Phiếu Yêu cầu KCS</MenuItem>
                                    <MenuItem value="KIEM_TRA_KCS">Biên bản Kiểm tra KCS</MenuItem>
                                    <MenuItem value="BAN_GIAO_BH">Biên bản Bàn giao bảo hành</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                        <Box sx={{ flex: '2 1 300px' }}>
                            <TextField fullWidth label="Mã phiếu" value={formData.form_code} onChange={e => setFormData({ ...formData, form_code: e.target.value })} />
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ flex: '1 1 250px' }}>
                            <Autocomplete
                                options={employees}
                                getOptionLabel={(option) => option.full_name || ''}
                                value={employees.find(e => e.id === formData.requester_id) || null}
                                onChange={(event, newValue) => {
                                    setFormData({ ...formData, requester_id: newValue ? newValue.id : '' });
                                }}
                                renderInput={(params) => <TextField {...params} label="Người yêu cầu / sử dụng" />}
                                fullWidth
                                noOptionsText="Không tìm thấy nhân viên"
                            />
                        </Box>
                        <Box sx={{ flex: '2 1 300px' }}>
                            <TextField fullWidth label="Lý do" value={formData.reason} onChange={e => setFormData({ ...formData, reason: e.target.value })} />
                        </Box>
                    </Box>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Thông tin thiết bị</Typography>
                    <Button variant="outlined" size="small" onClick={() => {
                        setEquipmentList([...equipmentList, { product_id: '', product_name: '', item_code: '', serial: '', quantity: 1, status: 'Không đạt', issue_notes: '', supplier: '', import_date: '', manufacturer: '', broken_date: '', warranty_end: '' }]);
                    }}>+ Thêm thiết bị</Button>
                </Box>

                {equipmentList.map((eq, index) => (
                    <Box key={index} sx={{ border: '1px dashed #ccc', p: 2, mb: 2, borderRadius: 1, position: 'relative' }}>
                        {equipmentList.length > 1 && (
                            <Button 
                                color="error" 
                                size="small" 
                                sx={{ position: 'absolute', top: 5, right: 5, minWidth: 'auto', p: 0.5 }}
                                onClick={() => {
                                    const newList = [...equipmentList];
                                    newList.splice(index, 1);
                                    setEquipmentList(newList);
                                }}
                            >
                                Xóa
                            </Button>
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                <Box sx={{ flex: '2 1 300px' }}>
                                    <Autocomplete
                                        options={
                                            formData.requester_id
                                                ? assetsOptions.filter(a => {
                                                    const emp = employees.find(e => e.id === formData.requester_id);
                                                    if (!emp) return false;
                                                    return a.user_employee_name === emp.full_name || 
                                                           a.user_employee_code === emp.id ||
                                                           a.manager_name === emp.full_name || 
                                                           a.manager_code === emp.id;
                                                })
                                                : assetsOptions
                                        }
                                        getOptionLabel={(option) => `${option.asset_code} - ${option.asset_name}`}
                                        value={assetsOptions.find(p => p.id === eq.product_id) || null}
                                        onChange={(event, newValue) => {
                                            const asset = newValue;
                                            const newList = [...equipmentList];
                                            newList[index].product_id = asset ? asset.id : '';
                                            newList[index].product_name = asset ? asset.asset_name : '';
                                            newList[index].item_code = asset ? asset.asset_code : '';
                                            if (asset && asset.serial_number && !newList[index].serial) {
                                                newList[index].serial = asset.serial_number;
                                            }
                                            setEquipmentList(newList);
                                        }}
                                        renderInput={(params) => <TextField {...params} label="Chọn Thiết bị" />}
                                        fullWidth
                                        noOptionsText="Không tìm thấy tài sản"
                                    />
                                </Box>
                                <Box sx={{ flex: '1 1 150px' }}>
                                    <TextField fullWidth label="Số Serial" value={eq.serial} onChange={e => {
                                        const newList = [...equipmentList]; newList[index].serial = e.target.value; setEquipmentList(newList);
                                    }} />
                                </Box>
                            </Box>
                            <Box>
                                <TextField fullWidth label="Tình trạng / Ghi chú lỗi" value={eq.issue_notes} onChange={e => {
                                    const newList = [...equipmentList]; newList[index].issue_notes = e.target.value; setEquipmentList(newList);
                                }} />
                            </Box>
                        </Box>
                    </Box>
                ))}

                {(formData.form_type === 'KIEM_TRA_KCS') && (
                    <Box mt={3}>
                        <Typography variant="h6">Kết luận KCS</Typography>
                        <FormControl fullWidth sx={{ mt: 1 }}>
                            <Select value={formData.kcs_conclusion} onChange={e => setFormData({ ...formData, kcs_conclusion: e.target.value })} displayEmpty>
                                <MenuItem value="">-- Chọn kết luận --</MenuItem>
                                <MenuItem value="DAT">Thiết bị đạt yêu cầu</MenuItem>
                                <MenuItem value="KHONG_DAT">Không đạt, trả kho</MenuItem>
                                <MenuItem value="BAO_HANH">Sửa chữa/Bảo hành</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                )}

                {(formData.form_type === 'BAN_GIAO_BH') && (
                    <Box mt={3}>
                        <Typography variant="h6">Thông tin bàn giao</Typography>
                        <Box sx={{ mt: 1, display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
                            <Box sx={{ flex: 1 }}>
                                <TextField fullWidth label="Đại diện bên giao" value={formData.handover_representative} onChange={e => setFormData({ ...formData, handover_representative: e.target.value })} />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <TextField fullWidth label="Đại diện bên nhận" value={formData.receiver_representative} onChange={e => setFormData({ ...formData, receiver_representative: e.target.value })} />
                            </Box>
                        </Box>
                    </Box>
                )}

                <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                    <Button variant="contained" color="primary" onClick={handleSave} disabled={loading}>
                        {loading ? <CircularProgress size={24} /> : 'Lưu & Chuyển tới Bản in'}
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/assets/kcs-warranty')}>Hủy</Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default KCSWarrantyForm;
