import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
    Box, Paper, Typography, Button, Grid, TextField, Dialog, DialogTitle, DialogContent,
    DialogActions, Alert, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Tab, Tabs, MenuItem, Select, FormControl, InputLabel, Card, CardContent,
    IconButton, InputAdornment, Tooltip, Zoom, Autocomplete, useTheme, useMediaQuery, Divider
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AddIcon from '@mui/icons-material/Add';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { exportStandardReport } from '../../utils/excelUtils';
import { supabase } from '../../config/supabase';

import { fetchHRProfiles } from '../../store/slices/hrProfilesSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import type { RootState, AppDispatch } from '../../store';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Types
interface InfractionReport {
    id: string;
    reportDate: string;
    violatorId: string;
    violatorName: string;
    violatorCode: string;
    violatorJob: string;
    violatorUnit: string;
    violatorPhone: string;
    
    inspectorId: string;
    inspectorName: string;
    inspectorCode: string;
    inspectorJob: string;
    inspectorUnit: string;
    inspectorPhone: string;
    
    supervisorName: string;
    
    clause: string;
    description: string;
    mitigationReq: string;
    explanation: string;
    conclusion: string;
    status: 'draft' | 'approved' | 'closed';
    createdAt: string;
}

interface KpiScore {
    employeeId: string;
    employeeName: string;
    jobPosition: string;
    department: string;
    score: number;
    notes: string;
}

const DEFAULT_CLAUSES = [
    { value: '30.1', label: '30.1 Nghỉ làm việc không có lý do chính đáng;' },
    { value: '30.2', label: '30.2 Làm việc riêng trong giờ làm việc, hoặc tự ý làm việc khác không thuộc chức năng nhiệm vụ được phân công, trường hợp đặc biệt phải được sự chấp thuận của Người phụ trách đơn vị;' },
    { value: '30.3', label: '30.3 Không chấp hành nghiêm túc quy định thời gian làm việc của Công ty (đi muộn về sớm, vắng mặt tại nơi làm việc trong thời gian làm việc mà không có lý do chính đáng);' },
    { value: '30.4', label: '30.4 Tự ý rời nơi làm việc hoặc ngừng làm việc mà không được sự đồng ý của Người phụ trách đơn vị (trừ trường hợp đặc biệt buộc phải ngừng việc nếu không sẽ gây thiệt hại về người, Tài sản, hàng hóa của Công ty);' },
    { value: '30.5', label: '30.5 Không hoàn thành công việc đúng theo khối lượng, chất lượng hoặc tiến độ được giao từ hai (02) lần/tháng trở lên mà không có lý do chính đáng;' },
    { value: '30.6', label: '30.6 Không chấp hành các yêu cầu về tác phong làm việc quy định tại Điều 10 của Nội quy;' },
    { value: '30.7', label: '30.7 Sử dụng, quản lý các thiết bị văn phòng, dụng cụ máy móc, hàng hóa, Tài sản và danh nghĩa của Công ty không đúng quy định, hoặc sử dụng vào mục đích cá nhân;' },
    { value: '30.8', label: '30.8 Sử dụng vật tư, nguyên nhiên vật liệu không đúng quy định hoặc vượt quá định mức gây lãng phí làm thất thoát Tài sản của Công ty;' },
    { value: '30.9', label: '30.9 Sử dụng rượu bia và thức uống có cồn trong giờ làm việc (trừ những trường hợp đặc biệt được Tổng Giám đốc cho phép);' },
    { value: '30.10', label: '30.10 Có lời nói, cử chỉ, thái độ thiếu văn minh lịch sự và/hoặc xúc phạm đối với đồng nghiệp trong giao tiếp khi đang thực hiện công việc hoặc trên các trang mạng xã hội;' },
    { value: '30.11', label: '30.11 Không trang bị, hoặc trang bị không đầy đủ, không đúng chủng loại, chất lượng đối với các dụng cụ cá nhân tự trang bị để đảm bảo thực hiện công việc theo quy định nội bộ;' },
    { value: '30.12', label: '30.12 Cản trở công việc của Người lao động khác khi người đó đang thực hiện nhiệm vụ được giao;' },
    { value: '30.13', label: '30.13 Không chấp hành mệnh lệnh, yêu cầu điều động, phân công công việc của Người phụ trách đơn vị mà không có lý do chính đáng;' },
    { value: '30.14', label: '30.14 Có lời nói, cử chỉ, thái độ thiếu văn minh lịch sự đối với khách hàng trong giao tiếp khi đang thực hiện công việc;' },
    { value: '30.15', label: '30.15 Người phụ trách đơn vị lạm dụng vị trí của mình hoặc có hành vi phân biệt đối xử với nhân viên. Người phụ trách không tạo điều kiện thuận lợi cho nhân viên mình làm việc có hiệu quả hoặc cản trở họ thực hiện quyền lợi và nghĩa vụ của họ; Người phụ trách có hành vi bao che, hoặc cố ý không ngăn chặn kịp thời để nhân viên vi phạm kỷ luật;' },
    { value: '30.16', label: '30.16 Vi phạm quy định - quy trình kỹ thuật, an toàn phòng cháy chữa cháy, an toàn lao động, trang bị bảo hộ lao động, vệ sinh lao động và vệ sinh môi trường có nguy cơ gây ra mất an toàn cho tính mạng, sức khỏe con người và Tài sản;' },
    { value: '30.17', label: '30.17 Vi phạm các quy định, quy trình, hướng dẫn nghiệp vụ quản lý thông tin đối với hệ thống mạng máy tính gây nguy cơ mất an toàn bảo mật thông tin của Công ty;' },
    { value: '30.18', label: '30.18 Gây mất trật tự tại nơi làm việc và các khu vực thuộc Công ty;' },
    { value: '30.19', label: '30.19 Nhờ hoặc thuê người khác không có chức năng nhiệm vụ làm thay nhiệm vụ được giao;' },
    { value: '30.20', label: '30.20 Phát ngôn với báo chí hoặc các kênh thông tin khác về Công ty mà không được sự đồng ý của Tổng Giám đốc;' },
    { value: '30.21', label: '30.21 Mang máy móc, thiết bị, Tài sản của Công ty ra khỏi nơi làm việc mà không được sự đồng ý của Tổng Giám đốc hoặc Người được Tổng Giám đốc phân công quản lý Tài sản của Công ty;' },
    { value: '30.22', label: '30.22 Làm sai lệch số liệu, sổ sách, chứng từ gây khó khăn cho công tác quản lý hoặc và/hoặc gây thiệt hại cho Công ty;' },
    { value: '30.23', label: '30.23 Làm mất hồ sơ, tài liệu, chứng từ hóa đơn. Làm mất, làm hư hỏng hoặc có hành vi khác gây thiệt hại cho máy móc, thiết bị, hàng hóa, Tài sản của Công ty;' },
    { value: '30.24.1', label: '30.24.1 Không tuân thủ các quy định về an toàn lao động gây tai nạn lao động;' },
    { value: '30.24.2', label: '30.24.2 Không tuân thủ các quy định thuộc Bộ quy tắc của Công ty gây thiệt hại cho Công ty;' },
    { value: '30.25', label: '30.25 Không hoàn thành công việc được giao và/hoặc thực hiện không đúng chuyên môn nghiệp vụ và/hoặc thiếu trách nhiệm trong thực hiện, xử lý nghiệp vụ gây thiệt hại cho Tài sản của Công ty;' },
    { value: '30.26', label: '30.26 Đe dọa, dụ dỗ, xúi giục, kích động những Người lao động khác trong Công ty không thực hiện hoặc thực hiện không đúng Nội quy, quy chế của Công ty;' },
    { value: '30.27', label: '30.27 Đánh bạc hoặc tổ chức đánh bạc;' },
    { value: '30.28', label: '30.28 Đòi hỏi, gây phiền hà để nhận tiền (hoặc giá trị vật chất khác), hoa hồng hoặc thù lao của bất kỳ chủ thể nào nhằm mục đích đảm bảo việc được ưu đãi hơn;' },
    { value: '30.29', label: '30.29 Phát ngôn có nội dung không đúng sự thật với báo chí hoặc các kênh thông tin khác về Công ty gây thiệt hại hoặc có nguy cơ gây thiệt hại cho Công ty;' },
    { value: '30.30', label: '30.30 Sử dụng thông tin không trung thực, hồ sơ giả mạo để được tuyển dụng vào Công ty; cung cấp lý lịch giả, sử dụng hồ sơ giấy tờ giả, bằng cấp/chứng chỉ giả trong quá trình làm việc tại Công ty;' },
    { value: '30.31', label: '30.31 Vi phạm chế độ quản lý tiền mặt của Công ty: cho vay mượn tiền, làm mất tiền, sử dụng tiền của Công ty vào mục đích cá nhân;' },
    { value: '30.32', label: '30.32 Báo cáo, tố cáo, tung tin đồn sai sự thật, đăng tải thông tin giả tạo trên trang mạng xã hội gây ảnh hưởng xấu đến uy tín của tập thể, cá nhân trong Công ty, hoặc gây ảnh hưởng xấu uy tín, thương hiệu, hình ảnh Công ty. Có hành vi khác gây mất đoàn kết nội bộ hoặc lôi kéo kích động người khác gây mất đoàn kết nội bộ Công ty;' },
    { value: '30.33', label: '30.33 Có lời lẽ xúc phạm lãnh đạo Công ty trực tiếp bằng lời nói và/hoặc xúc phạm lãnh đạo trên các trang mạng xã hội, gây mất trật tự tại nơi làm việc, ảnh hưởng xấu đến môi trường làm việc, hình ảnh và thiệt hại cho Công ty;' },
    { value: '30.34', label: '30.34 Chống đối, không chấp hành quyết định điều động của Tổng Giám đốc Công ty mà không có lý do chính đáng;' },
    { value: '30.35', label: '30.35 Sử dụng tên Công ty và thông tin của bất kỳ Người lao động nào vào hợp đồng cá nhân hoặc bất kỳ công việc cá nhân nào mà chưa được Tổng Giám đốc đồng ý bằng văn bản;' },
    { value: '30.36', label: '30.36 Tiết lộ bí mật công nghệ, bí mật kinh doanh, các tài liệu, tư liệu, số liệu, các thông tin kinh tế, kỹ thuật... theo chế độ bảo mật của Công ty cho các tổ chức và cá nhân ngoài Công ty;' },
    { value: '30.37', label: '30.37 Có hành vi xâm phạm quyền sở hữu trí tuệ của Công ty;' },
    { value: '30.38', label: '30.38 Nhận hối lộ, đưa hối lộ, môi giới hối lộ gây thiệt hại cho Công ty hoặc làm ảnh hưởng đến uy tín, phẩm chất đạo đức của lãnh đạo và nhân viên Công ty;' },
    { value: '30.39', label: '30.39 Tham ô, trộm cắp hoặc có liên quan đến tham ô, trộm cắp hồ sơ, Tài sản, vật tư, hàng hóa, nguyên nhiên vật liệu của Công ty;' },
    { value: '30.40', label: '30.40 Trộm cắp hoặc có liên quan đến trộm cắp Tài sản của đồng nghiệp, khách hàng của Công ty trong phạm vi nơi làm việc;' },
    { value: '30.41', label: '30.41 Ngụy tạo chứng cứ, hồ sơ, giấy tờ và/hoặc làm giả sổ sách, tài liệu, chứng từ nhằm mục đích lừa dối để che giấu hành vi vi phạm;' },
    { value: '30.42', label: '30.42 Thực hiện hành vi phá hoại, tổ chức phá hoại, lên kế hoạch phá hoại và hoặc các hành vi khác gây thiệt hại Tài sản, hàng hóa, hoạt động kinh doanh và/hoặc các lợi ích khác của Công ty;' },
    { value: '30.43', label: '30.43 Thực hiện các hành vi gây thiệt hại nghiêm trọng hoặc đe dọa gây thiệt hại đặc biệt nghiêm trọng đến Tài sản, hình ảnh, nhãn hiệu, tên thương mại, uy tín của Công ty;' },
    { value: '30.44', label: '30.44 Sử dụng ma túy;' },
    { value: '30.45', label: '30.45 Dùng vũ lực cố ý gây thương tích cho đồng nghiệp, khách hàng của Công ty;' },
    { value: '30.46', label: '30.46 Có hành vi quấy rối tình dục theo quy định tại khoản 23.3 Điều 23 Nội quy của Công ty;' },
    { value: 'custom', label: 'Lỗi vi phạm khác (Tự nhập)' }
];

const timesTheme = createTheme({
    typography: {
        fontFamily: "'Times New Roman', Times, serif",
        allVariants: {
            fontFamily: "'Times New Roman', Times, serif",
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                    textTransform: 'none',
                    fontWeight: 'bold',
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                    textTransform: 'none',
                    fontWeight: 'bold',
                    fontSize: '1.05rem',
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontFamily: "'Times New Roman', Times, serif",
                },
            },
        },
    },
});

const DEFAULT_HANDOVER_TASKS = [
    "Quản lý nhập xuất kho hàng hóa theo quy trình quy định.",
    "Quản lý số lượng, chất lượng hàng hoá trong kho đảm bảo an toàn",
    "Quản lý xuất nhập kho cho nhân viên, hàng thu hồi chuyển đổi, hàng mới hỏng,….. theo đúng quy trình quy định",
    "Nhận hàng từ kho tổng ACT/kho Viettel HCM về kho, cấp phát cho lực lượng kỹ thuật đảm bảo công việc.",
    "Xử lý các công việc phát sinh liên quan (Nếu có)."
];

const getDefaultHandovers = () => DEFAULT_HANDOVER_TASKS.map(task => ({
    task,
    target: '100%',
    recipientName: ''
}));

const LEAVE_TYPES = [
    { value: 'annual', label: 'Nghỉ phép' },
    { value: 'sick', label: 'Nghỉ ốm' },
    { value: 'maternity', label: 'Nghỉ thai sản' },
    { value: 'unpaid', label: 'Nghỉ không lương' },
    { value: 'compensatory', label: 'Nghỉ bù' },
    { value: 'accident', label: 'Nghỉ tai nạn' },
    { value: 'personal_paid', label: 'Nghỉ việc riêng có hưởng lương' },
    { value: 'holiday', label: 'Nghỉ mát' },
    { value: 'public_holiday', label: 'Nghỉ Lễ' },
    { value: 'half_day', label: 'Nghỉ phép nửa ngày' },
    { value: 'saturday', label: 'Nghỉ phép ngày thứ bảy' },
    { value: 'other', label: 'Nghỉ khác' },
];

const getLeaveTypeLabel = (value: string) => {
    const found = LEAVE_TYPES.find(t => t.value === value);
    return found ? found.label : value;
};

const KpiGrades = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const dispatch = useDispatch<AppDispatch>();
    
    // Selectors
    const { items: hrProfiles, status: hrProfilesStatus } = useSelector((state: RootState) => state.hrProfiles);
    const { items: employees, status: employeesStatus } = useSelector((state: RootState) => state.employees);
    const { profile } = useSelector((state: RootState) => state.auth);

    // Dispatch fetches if not loaded
    useEffect(() => {
        if (hrProfilesStatus === 'idle') {
            dispatch(fetchHRProfiles());
        }
        if (employeesStatus === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [dispatch, hrProfilesStatus, employeesStatus]);

    // Active profiles fallback list
    const activeProfilesList = useMemo(() => {
        return hrProfiles.length > 0 ? hrProfiles : employees;
    }, [hrProfiles, employees]);
    
    // UI Local State
    const [activeTab, setActiveTab] = useState<'infractions' | 'grading'>('infractions');
    const [searchTerm, setSearchTerm] = useState('');
    const [kpiSearchTerm, setKpiSearchTerm] = useState('');
    const [reportFilter, setReportFilter] = useState('all');
    const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
    
    // KPI Grading state
    const [kpiMonth, setKpiMonth] = useState<number>(new Date().getMonth() + 1);
    const [kpiYear, setKpiYear] = useState<number>(new Date().getFullYear());
    const [kpiScores, setKpiScores] = useState<KpiScore[]>([]);
    
    // Infraction Reports State
    const [reports, setReports] = useState<InfractionReport[]>([]);

    const fetchReports = async () => {
        try {
            const { data, error } = await supabase.from('kpi_infractions').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                const mapped = data.map((item: any) => ({
                    id: item.id,
                    reportDate: item.report_date,
                    violatorId: item.violator_id,
                    violatorName: item.violator_name,
                    violatorCode: item.violator_code,
                    violatorJob: item.violator_job,
                    violatorUnit: item.violator_unit,
                    violatorPhone: item.violator_phone,
                    inspectorId: item.inspector_id,
                    inspectorName: item.inspector_name,
                    inspectorCode: item.inspector_code,
                    inspectorJob: item.inspector_job,
                    inspectorUnit: item.inspector_unit,
                    inspectorPhone: item.inspector_phone,
                    supervisorName: item.supervisor_name,
                    clause: item.clause,
                    description: item.description,
                    mitigationReq: item.mitigation_req,
                    explanation: item.explanation,
                    conclusion: item.conclusion,
                    status: item.status,
                    createdAt: item.created_at
                }));
                setReports(mapped);
            }
        } catch (e) {
            console.error("Failed to fetch reports from Supabase", e);
        }
    };

    useEffect(() => {
        fetchReports();
    }, []);

    interface LeaveHandoverRow {
        task: string;
        target: string;
        recipientName: string;
    }

    interface LeaveRequest {
        id: string;
        requestDate: string;
        
        employeeId: string;
        employeeName: string;
        employeeCode: string;
        employeeJob: string;
        employeeUnit: string;
        employeePhone: string;
        
        startDate: string;
        startTime: string;
        endDate: string;
        endTime: string;
        totalDays: number;
        
        leaveType: string;
        customLeaveType: string;
        reason: string;
        location: string;
        
        handovers: LeaveHandoverRow[];
        
        status: 'draft' | 'approved';
        createdAt: string;
    }

    // Leave Requests State
    const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
    const [isLeaveFormOpen, setIsLeaveFormOpen] = useState(false);
    const [isLeavePreviewOpen, setIsLeavePreviewOpen] = useState(false);
    const [selectedLeaveRequest, setSelectedLeaveRequest] = useState<LeaveRequest | null>(null);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [leaveFormMode, setLeaveFormMode] = useState<'create' | 'edit'>('create');
    const [leaveFormData, setLeaveFormData] = useState({
        id: '',
        requestDate: new Date().toISOString().split('T')[0],
        employeeId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '08:00',
        endDate: new Date().toISOString().split('T')[0],
        endTime: '17:30',
        totalDays: 1,
        leaveType: 'annual' as string,
        customLeaveType: '',
        reason: 'Nghỉ giải quyết việc gia đình',
        location: 'Thành phố Hồ Chí Minh',
        handovers: getDefaultHandovers()
    });

    const fetchLeaveRequests = async () => {
        try {
            const { data, error } = await supabase.from('kpi_leave_requests').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                const mapped = data.map((item: any) => ({
                    id: item.id,
                    requestDate: item.request_date,
                    employeeId: item.employee_id,
                    employeeName: item.employee_name,
                    employeeCode: item.employee_code,
                    employeeJob: item.employee_job,
                    employeeUnit: item.employee_unit,
                    employeePhone: item.employee_phone,
                    startDate: item.start_date,
                    startTime: item.start_time,
                    endDate: item.end_date,
                    endTime: item.end_time,
                    totalDays: Number(item.total_days),
                    leaveType: item.leave_type,
                    customLeaveType: item.custom_leave_type,
                    reason: item.reason,
                    location: item.location,
                    handovers: typeof item.handovers === 'string' ? JSON.parse(item.handovers) : item.handovers,
                    status: item.status,
                    createdAt: item.created_at
                }));
                setLeaveRequests(mapped);
            }
        } catch (e) {
            console.error("Failed to fetch leave requests", e);
        }
    };

    useEffect(() => {
        fetchLeaveRequests();
    }, []);

    const fetchKpiScores = async () => {
        try {
            const { data, error } = await supabase
                .from('kpi_scores')
                .select('*')
                .eq('month', kpiMonth)
                .eq('year', kpiYear);
                
            if (error) throw error;
            
            if (data && data.length > 0) {
                const mapped = data.map((item: any) => ({
                    employeeId: item.employee_id,
                    employeeName: item.employee_name,
                    jobPosition: item.job_position,
                    department: item.department,
                    score: item.score,
                    notes: item.notes || ''
                }));
                
                // Merge with activeProfilesList to include new employees
                if (activeProfilesList.length > 0) {
                    const merged = activeProfilesList.map(emp => {
                        const existing = mapped.find((m: any) => m.employeeId === emp.id);
                        if (existing) return existing;
                        return {
                            employeeId: emp.id,
                            employeeName: emp.full_name,
                            jobPosition: emp.job_position || 'Nhân viên',
                            department: emp.department || 'BẮC SÀI GÒN',
                            score: 100,
                            notes: ''
                        };
                    });
                    setKpiScores(merged);
                } else {
                    setKpiScores(mapped);
                }
            } else {
                // Default to activeProfilesList
                if (activeProfilesList.length > 0) {
                    const defaults = activeProfilesList.map(emp => ({
                        employeeId: emp.id,
                        employeeName: emp.full_name,
                        jobPosition: emp.job_position || 'Nhân viên',
                        department: emp.department || 'BẮC SÀI GÒN',
                        score: 100, // Default perfect score
                        notes: ''
                    }));
                    setKpiScores(defaults);
                } else {
                    setKpiScores([]);
                }
            }
        } catch (e) {
            console.error("Failed to fetch KPI scores", e);
        }
    };

    // Load / Initialize KPI scores
    useEffect(() => {
        fetchKpiScores();
    }, [kpiMonth, kpiYear, activeProfilesList]);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [selectedReport, setSelectedReport] = useState<InfractionReport | null>(null);
    
    // Form Wizard State
    const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
    const [formData, setFormData] = useState({
        id: '',
        reportDate: new Date().toISOString().split('T')[0],
        violatorId: '',
        inspectorId: '',
        supervisorName: 'TRẦN KIM HÙNG',
        clause: '30.5',
        customClause: '',
        description: 'Không thực hiện CÔNG VIỆC đúng thời gian qui định, nhắc nhở nhiều lần',
        mitigationReq: '',
        explanation: '',
        conclusion: '',
        status: 'approved' as 'draft' | 'approved' | 'closed'
    });

    // ── Infraction Clause Description Generator ──────────────────────────────
    const generateInfractionDescription = (clauseValue: string, violatorName: string) => {
        const name = violatorName ? violatorName : '[Tên nhân viên]';
        const nameUpper = name.toUpperCase();
        
        switch (clauseValue) {
            case '30.1':
                return `Đồng chí ${nameUpper} tự ý nghỉ làm việc không báo cáo Chỉ huy đơn vị và không có lý do chính đáng.`;
            case '30.2':
                return `Đồng chí ${nameUpper} làm việc riêng trong giờ làm việc (sử dụng điện thoại/mạng xã hội cho mục đích cá nhân) hoặc tự ý làm việc khác không thuộc chức năng nhiệm vụ được phân công.`;
            case '30.3':
                return `Đồng chí ${nameUpper} không chấp hành nghiêm túc quy định thời gian làm việc (đi muộn về sớm, vắng mặt tại nơi làm việc trong giờ hành chính mà không có lý do chính đáng và không xin phép).`;
            case '30.4':
                return `Đồng chí ${nameUpper} tự ý rời vị trí nơi làm việc hoặc tự ý ngừng việc khi chưa được sự đồng ý của Người phụ trách đơn vị.`;
            case '30.5':
                return `Đồng chí ${nameUpper} không hoàn thành công việc đúng theo khối lượng, chất lượng hoặc tiến độ được giao từ hai (02) lần trong tháng trở lên mà không có lý do chính đáng.`;
            case '30.6':
                return `Đồng chí ${nameUpper} không chấp hành đúng các quy định về tác phong trang phục, đồng phục làm việc quy định tại Nội quy lao động của Công ty.`;
            case '30.7':
                return `Đồng chí ${nameUpper} quản lý, sử dụng thiết bị văn phòng, máy móc dụng cụ hoặc hàng hóa tài sản công ty sai quy trình quy định, hoặc dùng vào mục đích cá nhân.`;
            case '30.8':
                return `Đồng chí ${nameUpper} sử dụng nguyên nhiên vật liệu, thiết bị vật tư không đúng quy định hoặc vượt định mức cho phép gây lãng phí, thất thoát tài sản Công ty.`;
            case '30.9':
                return `Đồng chí ${nameUpper} có hành vi sử dụng rượu bia hoặc đồ uống có cồn tại nơi làm việc trong giờ hành chính làm việc.`;
            case '30.10':
                return `Đồng chí ${nameUpper} có lời nói, cử chỉ hoặc thái độ thiếu văn minh lịch sự, gây gổ hoặc xúc phạm đối với đồng nghiệp trong giao tiếp công việc hoặc trên mạng xã hội.`;
            case '30.11':
                return `Đồng chí ${nameUpper} không trang bị hoặc trang bị không đầy đủ, không đúng chủng loại, chất lượng đối với dụng cụ cá nhân tự trang bị để bảo đảm thực hiện công việc.`;
            case '30.12':
                return `Đồng chí ${nameUpper} có hành vi cản trở, gây khó khăn cho người lao động khác thực hiện nhiệm vụ được giao.`;
            case '30.13':
                return `Đồng chí ${nameUpper} không chấp hành mệnh lệnh phân công, yêu cầu điều động công tác hợp pháp của Chỉ huy/Người phụ trách đơn vị mà không có lý do chính đáng.`;
            case '30.14':
                return `Đồng chí ${nameUpper} có lời nói, thái độ hoặc cử chỉ thiếu văn minh lịch sự đối với đối tác, khách hàng trong quá trình giao tiếp thực hiện công việc.`;
            case '30.15':
                return `Quản lý lạm dụng vị trí phân biệt đối xử với nhân viên, không tạo điều kiện thuận lợi cho nhân viên làm việc hoặc cố ý bao che hành vi vi phạm kỷ luật của nhân viên.`;
            case '30.16':
                return `Đồng chí ${nameUpper} vi phạm quy quy định, quy trình kỹ thuật hoặc an toàn lao động, phòng cháy chữa cháy, trang bị bảo hộ lao động gây nguy cơ mất an toàn nghiêm trọng cho người và tài sản.`;
            case '30.17':
                return `Đồng chí ${nameUpper} vi phạm các quy trình hướng dẫn nghiệp vụ công nghệ thông tin, sử dụng mạng máy tính gây nguy cơ mất an toàn bảo mật thông tin của Công ty.`;
            case '30.18':
                return `Đồng chí ${nameUpper} có hành vi gây mất trật tự, ồn ào tại khu vực văn phòng làm việc của Công ty.`;
            case '30.19':
                return `Đồng chí ${nameUpper} tự ý nhờ hoặc thuê mướn người bên ngoài không có chức năng nhiệm vụ làm thay công việc được giao.`;
            case '30.20':
                return `Đồng chí ${nameUpper} tự ý phát ngôn với cơ quan báo chí hoặc các kênh truyền thông bên ngoài về thông tin Công ty khi chưa được Tổng Giám đốc ủy quyền bằng văn bản.`;
            case '30.21':
                return `Đồng chí ${nameUpper} mang máy móc thiết bị, tài sản của Công ty ra khỏi văn phòng mà chưa có sự đồng ý của Tổng Giám đốc hoặc người phụ trách quản lý tài sản.`;
            case '30.22':
                return `Đồng chí ${nameUpper} thực hiện hành vi làm sai lệch sổ sách, số liệu chứng từ kế toán gây cản trở công tác quản lý điều hành hoặc gây thiệt hại cho Công ty.`;
            case '30.23':
                return `Đồng chí ${nameUpper} làm thất lạc, làm mất hồ sơ tài liệu quan trọng, hóa đơn chứng từ hoặc làm hư hỏng thiết bị, hàng hóa tài sản của Công ty.`;
            case '30.24.1':
                return `Đồng chí ${nameUpper} không tuân thủ các quy trình an toàn lao động dẫn đến xảy ra sự cố hoặc tai nạn lao động tại nơi làm việc.`;
            case '30.24.2':
                return `Đồng chí ${nameUpper} vi phạm các quy định thuộc Bộ quy tắc ứng xử của Công ty gây thiệt hại vật chất hoặc tổn hại uy tín thương hiệu.`;
            case '30.25':
                return `Đồng chí ${nameUpper} không hoàn thành công việc được giao, thực hiện sai chuyên môn nghiệp vụ hoặc thiếu trách nhiệm trong xử lý công việc gây thiệt hại trực tiếp đến tài sản.`;
            case '30.26':
                return `Đồng chí ${nameUpper} có hành vi đe dọa, xúi giục hoặc kích động nhân viên khác không thực hiện hoặc thực hiện không đúng Nội quy quy chế Công ty.`;
            case '30.27':
                return `Đồng chí ${nameUpper} tham gia hành vi đánh bạc hoặc tổ chức đánh bạc dưới mọi hình thức tại nơi làm việc thuộc Công ty.`;
            case '30.28':
                return `Đồng chí ${nameUpper} đòi hỏi, gây phiền hà cho đối tác hoặc khách hàng nhằm nhận tiền, hoa hồng, thù lao cá nhân trái quy định.`;
            case '30.29':
                return `Đồng chí ${nameUpper} phát ngôn sai sự thật với cơ quan báo chí hoặc truyền thông gây tổn hại hoặc nguy cơ tổn hại uy tín của Công ty.`;
            case '30.30':
                return `Đồng chí ${nameUpper} cung cấp hồ sơ lý lịch không trung thực, sử dụng văn bằng chứng chỉ hoặc giấy tờ giả mạo để được tuyển dụng hoặc trong quá trình làm việc.`;
            case '30.31':
                return `Đồng chí ${nameUpper} vi phạm chế độ quản lý tiền mặt: tự ý cho vay mượn tiền quỹ, làm mất mát tiền quỹ hoặc sử dụng quỹ tiền mặt của Công ty vào mục đích cá nhân.`;
            case '30.32':
                return `Đồng chí ${nameUpper} tung tin đồn sai sự thật, đăng tải thông tin giả mạo gây ảnh hưởng xấu uy tín tập thể/cá nhân, bôi nhọ hình ảnh Công ty hoặc kích động mất đoàn kết nội bộ.`;
            case '30.33':
                return `Đồng chí ${nameUpper} có lời lẽ xúc phạm trực tiếp hoặc bôi nhọ Ban lãnh đạo Công ty trên các trang mạng xã hội, gây mất trật tự nghiêm trọng tại đơn vị.`;
            case '30.34':
                return `Đồng chí ${nameUpper} chống đối, từ chối không chấp hành quyết định điều động công tác hợp pháp của Tổng Giám đốc Công ty mà không có lý do chính đáng.`;
            case '30.35':
                return `Đồng chí ${nameUpper} tự ý dùng tên Công ty hoặc thông tin của nhân viên khác vào hợp đồng cá nhân hoặc các công việc cá nhân khi chưa được Tổng Giám đốc phê duyệt.`;
            case '30.36':
                return `Đồng chí ${nameUpper} tiết lộ bí mật kinh doanh, bí mật công nghệ, số liệu kỹ thuật... thuộc chế độ bảo mật của Công ty ra bên ngoài trái phép.`;
            case '30.37':
                return `Đồng chí ${nameUpper} thực hiện hành vi xâm phạm quyền sở hữu trí tuệ hoặc đánh cắp bản quyền tài sản trí tuệ của Công ty.`;
            case '30.38':
                return `Đồng chí ${nameUpper} thực hiện hành vi nhận hối lộ, đưa hối lộ hoặc môi giới hối lộ làm ảnh hưởng nghiêm trọng uy tín và đạo đức của doanh nghiệp.`;
            case '30.39':
                return `Đồng chí ${nameUpper} thực hiện hành vi tham ô hoặc trộm cắp hồ sơ, tài sản, nguyên vật liệu hoặc hàng hóa thuộc quyền sở hữu của Công ty.`;
            case '30.40':
                return `Đồng chí ${nameUpper} thực hiện trộm cắp hoặc đồng lõa trộm cắp tài sản của đồng nghiệp hoặc của khách hàng trong khuôn viên làm việc của Công ty.`;
            case '30.41':
                return `Đồng chí ${nameUpper} ngụy tạo chứng cứ, tài liệu hoặc làm giả sổ sách chứng từ hóa đơn nhằm mục đích lừa dối, che giấu hành vi vi phạm.`;
            case '30.42':
                return `Đồng chí ${nameUpper} thực hiện hành vi phá hoại hoặc có kế hoạch phá hoại máy móc, thiết bị hàng hóa gây ảnh hưởng đặc biệt nghiêm trọng hoạt động kinh doanh.`;
            case '30.43':
                return `Đồng chí ${nameUpper} thực hiện các hành vi gây thiệt hại đặc biệt nghiêm trọng đến tài sản, thương hiệu, nhãn hiệu hoặc uy tín của Công ty.`;
            case '30.44':
                return `Đồng chí ${nameUpper} tàng trữ hoặc sử dụng chất ma túy, chất kích thích bị cấm tại nơi làm việc.`;
            case '30.45':
                return `Đồng chí ${nameUpper} có hành vi dùng vũ lực hành hung, cố ý gây thương tích cho đồng nghiệp hoặc khách hàng trong phạm vi Công ty.`;
            case '30.46':
                return `Đồng chí ${nameUpper} thực hiện hành vi quấy rối tình dục tại nơi làm việc quy định tại Nội quy lao động của Công ty.`;
            default:
                return 'Đồng chí vi phạm quy định, nội quy lao động tại đơn vị làm việc.';
        }
    };

    // ── Severity-aware Natural Language Generator ─────────────────────────────
    const generateNaturalCommitmentAndConclusion = (
        violatorName: string,
        clauseValue: string,
        description: string
    ) => {
        const violatorNameUpper = violatorName ? violatorName.toUpperCase() : '[TÊN NHÂN VIÊN]';
        
        // Categorize by clause prefix
        const mainClause = clauseValue.split('.')[1] ? `${clauseValue.split('.')[0]}.${clauseValue.split('.')[1]}` : clauseValue;
        
        let category: 'mild' | 'performance' | 'property' | 'critical' = 'performance';
        
        const mildClauses = ['30.1', '30.3', '30.6', '30.9', '30.10', '30.14', '30.18'];
        const performanceClauses = ['30.2', '30.4', '30.5', '30.11', '30.12', '30.13', '30.19', '30.25', '30.26'];
        const propertyClauses = ['30.7', '30.8', '30.16', '30.17', '30.21', '30.23'];
        const criticalClauses = ['30.15', '30.20', '30.22', '30.24', '30.24.1', '30.24.2', '30.27', '30.28', '30.29', '30.30', '30.31', '30.32', '30.33', '30.34', '30.35', '30.36', '30.37', '30.38', '30.39', '30.40', '30.41', '30.42', '30.43', '30.44', '30.45', '30.46'];

        if (mildClauses.includes(mainClause)) {
            category = 'mild';
        } else if (propertyClauses.includes(mainClause)) {
            category = 'property';
        } else if (criticalClauses.includes(mainClause) || criticalClauses.some(c => clauseValue.startsWith(c))) {
            category = 'critical';
        } else {
            category = 'performance';
        }

        let explanation = '';
        let conclusion = '';
        let mitigationReq = '';

        // Extract some text from description to make it feel personalized
        const cleanDesc = description && description !== 'Không thực hiện CÔNG VIỆC đúng thời gian qui định, nhắc nhở nhiều lần' 
            ? description 
            : '';

        // Clean description for first-person representation by removing "Đồng chí [Tên]" prefixes
        let firstPersonDesc = cleanDesc;
        if (firstPersonDesc) {
            const prefixRegex = new RegExp(`^Đồng chí\\s+${violatorName}\\s*`, 'i');
            firstPersonDesc = firstPersonDesc.replace(prefixRegex, '');
            const prefixRegexUpper = new RegExp(`^Đồng chí\\s+${violatorNameUpper}\\s*`, 'i');
            firstPersonDesc = firstPersonDesc.replace(prefixRegexUpper, '');
            if (firstPersonDesc.length > 0) {
                firstPersonDesc = firstPersonDesc.charAt(0).toLowerCase() + firstPersonDesc.slice(1);
            }
        }

        switch (category) {
            case 'mild':
                explanation = '';
                conclusion = `Đồng chí ${violatorNameUpper} vi phạm nội quy về giờ giấc/tác phong làm việc tại điều ${clauseValue}. Ban giám đốc nhắc nhở phê bình nghiêm túc trước tập thể đơn vị, yêu cầu đồng chí chấn chỉnh ngay lập tức, nếu tái phạm sẽ chuyển Hội đồng kỷ luật xử lý hạ thi đua.`;
                mitigationReq = `Yêu cầu đồng chí ${violatorNameUpper} chấn chỉnh ngay tác phong làm việc, nghiêm túc tuân thủ quy định thời gian làm việc của Công ty (đi làm đúng giờ, không tự ý rời vị trí). Mọi trường hợp vắng mặt hoặc đi muộn phải có lý do chính đáng và báo cáo xin phép Chỉ huy trực tiếp trước theo đúng quy trình.`;
                break;
                
            case 'property':
                explanation = '';
                conclusion = `Đồng chí ${violatorNameUpper} vi phạm quy trình kỹ thuật và quản lý tài sản, vật tư theo điều ${clauseValue}. Yêu cầu đồng chí thực hiện khắc phục hoàn toàn hậu quả, bồi hoàn thiết bị (nếu có) dưới sự giám sát chặt chẽ của Chỉ huy trực tiếp. Nếu tiếp tục tái phạm sẽ xử lý kỷ luật sa thải.`;
                mitigationReq = `Yêu cầu đồng chí ${violatorNameUpper} nghiêm túc kiểm điểm sai sót trong quản lý thiết bị/vật tư, thực hiện ngay các biện pháp khắc phục thiệt hại và bàn giao, bảo quản tài sản công ty đúng quy định. Tuân thủ tuyệt đối quy trình kỹ thuật để tránh hao hụt, thất thoát tài sản chung.`;
                break;
                
            case 'critical':
                explanation = '';
                conclusion = `Hành vi vi phạm của đồng chí ${violatorNameUpper} tại điều ${clauseValue} là đặc biệt nghiêm trọng, gây ảnh hưởng xấu trực tiếp đến danh tiếng và hoạt động của đơn vị. Ban Giám đốc quyết định lập hồ sơ chuyển toàn bộ sự việc lên Hội đồng Kỷ luật Công ty để xem xét áp dụng hình thức xử lý kỷ luật ở mức cao nhất (Sa thải/Đình chỉ công tác/Truy cứu trách nhiệm).`;
                mitigationReq = `Yêu cầu đồng chí ${violatorNameUpper} lập tức dừng các hành vi vi phạm kỷ luật lao động, thực hiện bàn giao đầy đủ công việc, hồ sơ và tài sản liên quan cho Chỉ huy trực tiếp. Có mặt tại văn phòng đơn vị để giải trình chi tiết sự việc và chịu sự xử lý trực tiếp từ Hội đồng kỷ luật Công ty.`;
                break;
                
            case 'performance':
            default:
                explanation = '';
                conclusion = `Đồng chí ${violatorNameUpper} vi phạm nội quy lao động theo điều ${clauseValue}.`;
                mitigationReq = `Yêu cầu đồng chí ${violatorNameUpper} tập trung cải thiện tinh thần làm việc, khẩn trương hoàn thành đúng tiến độ và chất lượng các công việc được giao để đảm bảo chỉ tiêu KPI chung của đơn vị. nếu còn tái phạm sẽ chuyển lên hội đồng xem xét kỷ luật bậc tiếp theo.`;
                break;
        }

        return { explanation, conclusion, mitigationReq };
    };

    // Auto-filled texts on Violator, Clause, or Description change (Pristine only)
    useEffect(() => {
        if (!formData.violatorId) return;
        const violator = activeProfilesList.find(p => p.id === formData.violatorId);
        if (violator) {
            // Generate templates with placeholder to detect if fields are pristine
            const genericDesc = DEFAULT_CLAUSES.map(c => generateInfractionDescription(c.value, '[Tên nhân viên]'));
            
            // Generate generic mitigation requirements for all categories
            const genericMitigations = [
                `Yêu cầu đồng chí [TÊN NHÂN VIÊN] chấn chỉnh ngay tác phong làm việc, nghiêm túc tuân thủ quy định thời gian làm việc của Công ty (đi làm đúng giờ, không tự ý rời vị trí). Mọi trường hợp vắng mặt hoặc đi muộn phải có lý do chính đáng và báo cáo xin phép Chỉ huy trực tiếp trước theo đúng quy trình.`,
                `Yêu cầu đồng chí [TÊN NHÂN VIÊN] nghiêm túc kiểm điểm sai sót trong quản lý thiết bị/vật tư, thực hiện ngay các biện pháp khắc phục thiệt hại và bàn giao, bảo quản tài sản công ty đúng quy định. Tuân thủ tuyệt đối quy trình kỹ thuật để tránh hao hụt, thất thoát tài sản chung.`,
                `Yêu cầu đồng chí [TÊN NHÂN VIÊN] lập tức dừng các hành vi vi phạm kỷ luật lao động, thực hiện bàn giao đầy đủ công việc, hồ sơ và tài sản liên quan cho Chỉ huy trực tiếp. Có mặt tại văn phòng đơn vị để giải trình chi tiết sự việc và chịu sự xử lý trực tiếp từ Hội đồng kỷ luật Công ty.`,
                `Yêu cầu đồng chí [TÊN NHÂN VIÊN] tập trung cải thiện tinh thần làm việc, khẩn trương hoàn thành đúng tiến độ và chất lượng các công việc được giao để đảm bảo chỉ tiêu KPI chung của đơn vị. nếu còn tái phạm sẽ chuyển lên hội đồng xem xét kỷ luật bậc tiếp theo.`
            ];

            // Generate generic conclusions for all categories
            const genericConclusions = [
                `Đồng chí [TÊN NHÂN VIÊN] vi phạm nội quy về giờ giấc/tác phong làm việc tại điều [Mục vi phạm]. Ban giám đốc nhắc nhở phê bình nghiêm túc trước tập thể đơn vị, yêu cầu đồng chí chấn chỉnh ngay lập tức, nếu tái phạm sẽ chuyển Hội đồng kỷ luật xử lý hạ thi đua.`,
                `Đồng chí [TÊN NHÂN VIÊN] vi phạm quy trình kỹ thuật và quản lý tài sản, vật tư theo điều [Mục vi phạm]. Yêu cầu đồng chí thực hiện khắc phục hoàn toàn hậu quả, bồi hoàn thiết bị (nếu có) dưới sự giám sát chặt chẽ của Chỉ huy trực tiếp. Nếu tiếp tục tái phạm sẽ xử lý kỷ luật sa thải.`,
                `Hành vi vi phạm của đồng chí [TÊN NHÂN VIÊN] tại điều [Mục vi phạm] là đặc biệt nghiêm trọng, gây ảnh hưởng xấu trực tiếp đến danh tiếng và hoạt động của đơn vị. Ban Giám đốc quyết định lập hồ sơ chuyển toàn bộ sự việc lên Hội đồng Kỷ luật Công ty để xem xét áp dụng hình thức xử lý kỷ luật ở mức cao nhất (Sa thải/Đình chỉ công tác/Truy cứu trách nhiệm).`,
                `Đồng chí [TÊN NHÂN VIÊN] vi phạm nội quy lao động theo điều [Mục vi phạm].`
            ];

            // Normalize current fields by replacing ANY employee's name with placeholders
            let currentGenericDesc = formData.description;
            let currentGenericMitigation = formData.mitigationReq;
            let currentGenericConclusion = formData.conclusion;

            activeProfilesList.forEach(emp => {
                const nameUpper = emp.full_name.toUpperCase();
                
                // Replace description names
                currentGenericDesc = currentGenericDesc.replace(new RegExp(nameUpper, 'g'), '[TÊN NHÂN VIÊN]');
                currentGenericDesc = currentGenericDesc.replace(new RegExp(emp.full_name, 'g'), '[Tên nhân viên]');

                // Replace mitigation names
                currentGenericMitigation = currentGenericMitigation.replace(new RegExp(nameUpper, 'g'), '[TÊN NHÂN VIÊN]');
                currentGenericMitigation = currentGenericMitigation.replace(new RegExp(emp.full_name, 'g'), '[Tên nhân viên]');

                // Replace conclusion names
                currentGenericConclusion = currentGenericConclusion.replace(new RegExp(nameUpper, 'g'), '[TÊN NHÂN VIÊN]');
                currentGenericConclusion = currentGenericConclusion.replace(new RegExp(emp.full_name, 'g'), '[Tên nhân viên]');
            });

            // Normalize conclusion điều khoản
            currentGenericConclusion = currentGenericConclusion.replace(/điều 30\.\d+(\.\d+)?/g, 'điều [Mục vi phạm]');
            currentGenericConclusion = currentGenericConclusion.replace(/điều custom/g, 'điều [Mục vi phạm]');

            // Clean history prefix from currentGenericDesc for checking
            const cleanCurrentGenericDesc = currentGenericDesc.replace(/\[TÁI PHẠM LẦN \d+\].*?\.\n/, '');
            
            // Check if current fields are pristine (default or empty) before auto-filling
            const isDescriptionPristine = !formData.description ||
                formData.description === 'Không thực hiện CÔNG VIỆC đúng thời gian qui định, nhắc nhở nhiều lần' ||
                formData.description.trim() === '' ||
                genericDesc.includes(cleanCurrentGenericDesc);

            const isExplanationPristine = !formData.explanation || 
                formData.explanation.includes('Tôi cam kết nếu tái phạm sẽ không nhận hàng hóa') ||
                formData.explanation.includes('Tôi nhận thức rõ việc chưa hoàn thành') ||
                formData.explanation.includes('Tôi nhận thức sâu sắc lỗi') ||
                formData.explanation.trim() === '';
                
            const isConclusionPristine = !formData.conclusion || 
                formData.conclusion.trim() === '' ||
                genericConclusions.some(c => currentGenericConclusion.includes(c.substring(0, 50)));

            const isMitigationReqPristine = !formData.mitigationReq ||
                formData.mitigationReq.includes('Vi phạm nội qui lao động không hoàn thành khối lượng') ||
                formData.mitigationReq.includes('Không hoàn thành công việc được giao') ||
                formData.mitigationReq.trim() === '' ||
                genericMitigations.includes(currentGenericMitigation);

            const pastInfractions = reports.filter(r => r.violatorId === formData.violatorId && r.id !== formData.id);
            let historyText = '';
            if (pastInfractions.length > 0) {
                const historyParts = pastInfractions.map(r => {
                    if (!r.reportDate) return '';
                    const parts = r.reportDate.split('-');
                    const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : r.reportDate;
                    return `Ngày ${dateStr} (Điều ${r.clause})`;
                }).filter(Boolean);
                if (historyParts.length > 0) {
                    historyText = `[TÁI PHẠM LẦN ${pastInfractions.length + 1}] Lịch sử vi phạm trước đó: ${historyParts.join(', ')}.\n`;
                }
            }

            const generatedDesc = generateInfractionDescription(formData.clause, violator.full_name);
            const newDescription = isDescriptionPristine
                ? (historyText + generatedDesc)
                : formData.description;

            const { explanation, conclusion, mitigationReq } = generateNaturalCommitmentAndConclusion(
                violator.full_name,
                formData.clause,
                newDescription
            );

            setFormData(prev => {
                if (
                    prev.description === newDescription &&
                    prev.mitigationReq === (isMitigationReqPristine ? mitigationReq : prev.mitigationReq) &&
                    prev.explanation === (isExplanationPristine ? explanation : prev.explanation) &&
                    prev.conclusion === (isConclusionPristine ? conclusion : prev.conclusion)
                ) {
                    return prev;
                }
                return {
                    ...prev,
                    description: newDescription,
                    mitigationReq: isMitigationReqPristine ? mitigationReq : prev.mitigationReq,
                    explanation: isExplanationPristine ? explanation : prev.explanation,
                    conclusion: isConclusionPristine ? conclusion : prev.conclusion
                };
            });
        }
    }, [formData.violatorId, formData.clause, formData.description, activeProfilesList]);

    // Manual optimize trigger
    const handleAutoGenerateTexts = () => {
        const violator = activeProfilesList.find(p => p.id === formData.violatorId);
        const violatorName = violator ? violator.full_name : '[TÊN NHÂN VIÊN]';
        
        const pastInfractions = reports.filter(r => r.violatorId === formData.violatorId && r.id !== formData.id);
        let historyText = '';
        if (pastInfractions.length > 0) {
            const historyParts = pastInfractions.map(r => {
                if (!r.reportDate) return '';
                const parts = r.reportDate.split('-');
                const dateStr = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : r.reportDate;
                return `Ngày ${dateStr} (Điều ${r.clause})`;
            }).filter(Boolean);
            if (historyParts.length > 0) {
                historyText = `[TÁI PHẠM LẦN ${pastInfractions.length + 1}] Lịch sử vi phạm trước đó: ${historyParts.join(', ')}.\n`;
            }
        }

        const generatedDesc = generateInfractionDescription(formData.clause, violatorName);
        const description = historyText + generatedDesc;
        
        const { explanation, conclusion, mitigationReq } = generateNaturalCommitmentAndConclusion(
            violatorName,
            formData.clause,
            description
        );
        
        setFormData(prev => ({
            ...prev,
            description,
            mitigationReq,
            explanation,
            conclusion
        }));
        
        setNotification({ type: 'success', message: 'Đã tự động tối ưu hóa toàn bộ nội dung biên bản phù hợp với lỗi vi phạm!' });
        setTimeout(() => setNotification(null), 3000);
    };

    // Set Default Inspector on profile match
    useEffect(() => {
        if (profile && activeProfilesList.length > 0 && !formData.inspectorId) {
            const matchedInspector = activeProfilesList.find(p => 
                p.full_name.toLowerCase() === profile.full_name.toLowerCase() || 
                (p.email && p.email.toLowerCase() === profile.email.toLowerCase())
            );
            if (matchedInspector) {
                setFormData(prev => ({ ...prev, inspectorId: matchedInspector.id }));
            } else {
                setFormData(prev => ({ ...prev, inspectorId: activeProfilesList[0].id }));
            }
        }
    }, [profile, activeProfilesList]);

    // ── Save KPI Grades ───────────────────────────────────────────────────────
    const handleSaveKpiScores = async () => {
        try {
            // First, delete existing scores for this month/year to replace them
            await supabase
                .from('kpi_scores')
                .delete()
                .eq('month', kpiMonth)
                .eq('year', kpiYear);
                
            // Then insert the current scores
            const payload = kpiScores.map(score => ({
                month: kpiMonth,
                year: kpiYear,
                employee_id: score.employeeId,
                employee_name: score.employeeName,
                job_position: score.jobPosition,
                department: score.department,
                score: score.score,
                notes: score.notes
            }));
            
            const { error } = await supabase.from('kpi_scores').insert(payload);
            if (error) throw error;
            
            setNotification({ type: 'success', message: `Đã lưu bảng điểm KPI Tháng ${kpiMonth}/${kpiYear} thành công!` });
        } catch (e) {
            console.error("Lỗi khi lưu bảng điểm KPI:", e);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi lưu bảng điểm KPI!' });
        }
        setTimeout(() => setNotification(null), 3000);
    };

    const handleKpiScoreChange = (employeeId: string, field: keyof KpiScore, value: any) => {
        setKpiScores(prev => 
            prev.map(score => score.employeeId === employeeId ? { ...score, [field]: value } : score)
        );
    };

    // ── Infraction CRUD ────────────────────────────────────────────────────────
    const handleOpenForm = (report?: InfractionReport) => {
        if (report) {
            setFormMode('edit');
            setFormData({
                id: report.id,
                reportDate: report.reportDate,
                violatorId: report.violatorId,
                inspectorId: report.inspectorId,
                supervisorName: report.supervisorName,
                clause: DEFAULT_CLAUSES.some(c => c.value === report.clause) ? report.clause : 'custom',
                customClause: DEFAULT_CLAUSES.some(c => c.value === report.clause) ? '' : report.clause,
                description: report.description,
                mitigationReq: report.mitigationReq,
                explanation: report.explanation,
                conclusion: report.conclusion,
                status: report.status
            });
        } else {
            setFormMode('create');
            let defaultInspectorId = '';
            if (profile) {
                const matched = activeProfilesList.find(p => p.full_name.toLowerCase() === profile.full_name.toLowerCase());
                if (matched) defaultInspectorId = matched.id;
            }
            if (!defaultInspectorId && activeProfilesList.length > 0) defaultInspectorId = activeProfilesList[0].id;

            setFormData({
                id: '',
                reportDate: new Date().toISOString().split('T')[0],
                violatorId: activeProfilesList.length > 0 ? activeProfilesList[0].id : '',
                inspectorId: defaultInspectorId,
                supervisorName: 'TRẦN KIM HÙNG',
                clause: '30.5',
                customClause: '',
                description: 'Không thực hiện CÔNG VIỆC đúng thời gian qui định, nhắc nhở nhiều lần',
                mitigationReq: '',
                explanation: '',
                conclusion: '',
                status: 'approved'
            });
        }
        setIsFormOpen(true);
    };

    const handleSaveReport = async () => {
        const violator = activeProfilesList.find(p => p.id === formData.violatorId);
        const inspector = activeProfilesList.find(p => p.id === formData.inspectorId);
        
        if (!violator || !inspector) {
            setNotification({ type: 'error', message: 'Vui lòng chọn đầy đủ thông tin nhân viên vi phạm và người kiểm tra!' });
            return;
        }

        const clauseText = formData.clause === 'custom' ? formData.customClause : formData.clause;
        if (!clauseText) {
            setNotification({ type: 'error', message: 'Vui lòng nhập mục vi phạm!' });
            return;
        }

        const reportPayload = {
            report_date: formData.reportDate,
            violator_id: violator.id,
            violator_name: violator.full_name,
            violator_code: violator.id,
            violator_job: violator.job_position || 'Nhân viên',
            violator_unit: violator.department || 'BẮC SÀI GÒN',
            violator_phone: violator.phone_number || '',
            
            inspector_id: inspector.id,
            inspector_name: inspector.full_name,
            inspector_code: inspector.id,
            inspector_job: inspector.job_position || 'Quản lý kho',
            inspector_unit: inspector.department || 'KHO TRUNG TÂM',
            inspector_phone: inspector.phone_number || '',
            
            supervisor_name: formData.supervisorName || 'TRẦN KIM HÙNG',
            
            clause: clauseText,
            description: formData.description,
            mitigation_req: formData.mitigationReq,
            explanation: formData.explanation,
            conclusion: formData.conclusion,
            status: formData.status
        };

        try {
            if (formMode === 'create') {
                const { error } = await supabase.from('kpi_infractions').insert([reportPayload]);
                if (error) throw error;
                setNotification({ type: 'success', message: 'Tạo biên bản vi phạm mới thành công!' });
            } else {
                const { error } = await supabase.from('kpi_infractions').update(reportPayload).eq('id', formData.id);
                if (error) throw error;
                setNotification({ type: 'success', message: 'Cập nhật biên bản vi phạm thành công!' });
            }

            fetchReports(); // Refresh data
            setIsFormOpen(false);
        } catch (e) {
            console.error("Lỗi khi lưu biên bản:", e);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi lưu biên bản vi phạm!' });
        }
        
        setTimeout(() => setNotification(null), 3000);
    };

    const handleDeleteReport = async (id: string, name: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa biên bản vi phạm của nhân viên "${name}"?`)) {
            try {
                const { error } = await supabase.from('kpi_infractions').delete().eq('id', id);
                if (error) throw error;
                fetchReports(); // Refresh data
                setNotification({ type: 'success', message: 'Đã xóa biên bản thành công!' });
            } catch (e) {
                console.error("Lỗi khi xóa biên bản:", e);
                setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xóa biên bản!' });
            }
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const handleExportExcel = async () => {
        if (filteredReports.length === 0) {
            setNotification({ type: 'error', message: 'Không có dữ liệu biên bản vi phạm để xuất Excel!' });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        const excelData = filteredReports.map((r, index) => ({
            stt: index + 1,
            reportDate: new Date(r.reportDate).toLocaleDateString('vi-VN'),
            violatorCode: r.violatorId,
            violatorName: r.violatorName,
            violatorUnit: r.violatorUnit,
            clause: r.clause,
            description: r.description,
            inspectorName: r.inspectorName,
            status: r.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'
        }));

        const columns = [
            { header: 'STT', key: 'stt', width: 8, align: 'center' as const },
            { header: 'Ngày lập', key: 'reportDate', width: 15, align: 'center' as const },
            { header: 'Mã NV vi phạm', key: 'violatorCode', width: 18, align: 'center' as const },
            { header: 'Họ tên người vi phạm', key: 'violatorName', width: 28 },
            { header: 'Đơn vị công tác', key: 'violatorUnit', width: 38 },
            { header: 'Điều khoản vi phạm', key: 'clause', width: 18, align: 'center' as const },
            { header: 'Chi tiết vi phạm', key: 'description', width: 45 },
            { header: 'Người kiểm tra/Phát hiện', key: 'inspectorName', width: 28 },
            { header: 'Trạng thái', key: 'status', width: 15, align: 'center' as const }
        ];

        try {
            await exportStandardReport(
                excelData,
                `Lich_Su_Vi_Pham_Lao_Dong_${new Date().toISOString().split('T')[0]}`,
                'LỊCH SỬ BIÊN BẢN VI PHẠM LAO ĐỘNG',
                columns,
                profile?.full_name || 'Quản trị viên'
            );
            setNotification({ type: 'success', message: 'Xuất file Excel lịch sử vi phạm thành công!' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            console.error('Failed to export Excel', error);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xuất file Excel!' });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    // ── Leave Request Handlers ──────────────────────────────────────────────────
    const handleOpenLeaveForm = (req?: LeaveRequest) => {
        if (req) {
            setLeaveFormMode('edit');
            setLeaveFormData({
                id: req.id,
                requestDate: req.requestDate,
                employeeId: req.employeeId,
                startDate: req.startDate,
                startTime: req.startTime,
                endDate: req.endDate,
                endTime: req.endTime,
                totalDays: req.totalDays,
                leaveType: req.leaveType,
                customLeaveType: req.customLeaveType || '',
                reason: req.reason,
                location: req.location,
                handovers: req.handovers.length >= 5 ? req.handovers : [
                    ...req.handovers,
                    ...Array.from({ length: 5 - req.handovers.length }, () => ({ task: '', target: '', recipientName: '' }))
                ]
            });
        } else {
            setLeaveFormMode('create');
            setLeaveFormData({
                id: '',
                requestDate: new Date().toISOString().split('T')[0],
                employeeId: activeProfilesList.length > 0 ? activeProfilesList[0].id : '',
                startDate: new Date().toISOString().split('T')[0],
                startTime: '08:00',
                endDate: new Date().toISOString().split('T')[0],
                endTime: '17:30',
                totalDays: 1,
                leaveType: 'annual',
                customLeaveType: '',
                reason: 'Nghỉ giải quyết việc gia đình',
                location: 'Thành phố Hồ Chí Minh',
                handovers: getDefaultHandovers()
            });
        }
        setIsLeaveFormOpen(true);
    };

    const handleHandoverChange = (index: number, field: keyof LeaveHandoverRow, value: string) => {
        setLeaveFormData(prev => {
            const handovers = [...prev.handovers];
            handovers[index] = { ...handovers[index], [field]: value };
            return { ...prev, handovers };
        });
    };

    const handleSaveLeaveRequest = async () => {
        const emp = activeProfilesList.find(p => p.id === leaveFormData.employeeId);
        if (!emp) {
            setNotification({ type: 'error', message: 'Vui lòng chọn nhân viên làm đơn!' });
            return;
        }

        const payload = {
            request_date: leaveFormData.requestDate,
            employee_id: emp.id,
            employee_name: emp.full_name,
            employee_code: emp.id,
            employee_job: emp.job_position || 'Nhân viên',
            employee_unit: emp.department || 'Bộ phận Kỹ thuật - Hạ tầng Bắc Sài Gòn',
            employee_phone: emp.phone_number || '',
            
            start_date: leaveFormData.startDate,
            start_time: leaveFormData.startTime,
            end_date: leaveFormData.endDate,
            end_time: leaveFormData.endTime,
            total_days: Number(leaveFormData.totalDays) || 1,
            
            leave_type: leaveFormData.leaveType,
            custom_leave_type: leaveFormData.customLeaveType,
            reason: leaveFormData.reason,
            location: leaveFormData.location,
            
            handovers: leaveFormData.handovers.filter(h => h.task.trim() !== '' || h.target.trim() !== ''),
            status: 'approved'
        };

        try {
            if (leaveFormMode === 'create') {
                const { error } = await supabase.from('kpi_leave_requests').insert([payload]);
                if (error) throw error;
                setNotification({ type: 'success', message: 'Tạo đơn xin nghỉ mới thành công!' });
            } else {
                const { error } = await supabase.from('kpi_leave_requests').update(payload).eq('id', leaveFormData.id);
                if (error) throw error;
                setNotification({ type: 'success', message: 'Cập nhật đơn xin nghỉ thành công!' });
            }

            fetchLeaveRequests(); // Refresh data
            setIsLeaveFormOpen(false);
        } catch (e) {
            console.error("Lỗi khi lưu đơn xin nghỉ:", e);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi lưu đơn xin nghỉ!' });
        }
        
        setTimeout(() => setNotification(null), 3000);
    };

    const handleDeleteLeaveRequest = async (id: string, name: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa đơn xin nghỉ của nhân viên "${name}"?`)) {
            try {
                const { error } = await supabase.from('kpi_leave_requests').delete().eq('id', id);
                if (error) throw error;
                fetchLeaveRequests(); // Refresh data
                setNotification({ type: 'success', message: 'Đã xóa đơn xin nghỉ!' });
            } catch (e) {
                console.error("Lỗi khi xóa đơn xin nghỉ:", e);
                setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xóa đơn xin nghỉ!' });
            }
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const handlePrintLeaveRequest = (req: LeaveRequest) => {
        setSelectedReport(null);
        setSelectedLeaveRequest(req);
        setIsLeavePreviewOpen(true);
    };

    const handleExportLeaveExcel = async () => {
        if (leaveRequests.length === 0) {
            setNotification({ type: 'error', message: 'Không có dữ liệu đơn xin nghỉ để xuất Excel!' });
            setTimeout(() => setNotification(null), 3000);
            return;
        }

        const excelData = leaveRequests.map((r, index) => ({
            stt: index + 1,
            requestDate: new Date(r.requestDate).toLocaleDateString('vi-VN'),
            employeeCode: r.employeeCode,
            employeeName: r.employeeName,
            employeeUnit: r.employeeUnit,
            period: `${r.startTime} ${new Date(r.startDate).toLocaleDateString('vi-VN')} - ${r.endTime} ${new Date(r.endDate).toLocaleDateString('vi-VN')}`,
            totalDays: r.totalDays,
            reason: r.reason,
            status: 'Đã duyệt'
        }));

        const columns = [
            { header: 'STT', key: 'stt', width: 8, align: 'center' as const },
            { header: 'Ngày lập', key: 'requestDate', width: 15, align: 'center' as const },
            { header: 'Mã NV', key: 'employeeCode', width: 15, align: 'center' as const },
            { header: 'Họ tên nhân viên', key: 'employeeName', width: 25 },
            { header: 'Đơn vị công tác', key: 'employeeUnit', width: 35 },
            { header: 'Thời gian xin nghỉ', key: 'period', width: 35, align: 'center' as const },
            { header: 'Số ngày', key: 'totalDays', width: 12, align: 'center' as const },
            { header: 'Lý do xin nghỉ', key: 'reason', width: 35 },
            { header: 'Trạng thái', key: 'status', width: 15, align: 'center' as const }
        ];

        try {
            await exportStandardReport(
                excelData,
                `Danh_Sach_Xin_Nghi_Phep_${new Date().toISOString().split('T')[0]}`,
                'DANH SÁCH ĐƠN XIN NGHỈ PHÉP NHÂN SỰ',
                columns,
                profile?.full_name || 'Quản trị viên'
            );
            setNotification({ type: 'success', message: 'Xuất file Excel danh sách xin nghỉ phép thành công!' });
            setTimeout(() => setNotification(null), 3000);
        } catch (error) {
            console.error('Failed to export leave Excel', error);
            setNotification({ type: 'error', message: 'Có lỗi xảy ra khi xuất file Excel!' });
            setTimeout(() => setNotification(null), 3000);
        }
    };

    const handlePrint = (report: InfractionReport) => {
        setSelectedLeaveRequest(null);
        setSelectedReport(report);
        setIsPreviewOpen(true);
    };

    const triggerBrowserPrint = () => {
        setTimeout(() => {
            window.print();
        }, 150);
    };

    const handleExportPDF = async () => {
        if (!selectedLeaveRequest) return;
        setIsExportingPDF(true);
        setTimeout(async () => {
            const input = document.getElementById('hidden-pdf-container');
            if (!input) {
                alert('Lỗi: Không tìm thấy phần tử ẩn để xuất PDF!');
                setIsExportingPDF(false);
                return;
            }
            try {
                // Safe resolution of constructors
                const html2canvasFn = typeof html2canvas === 'function' ? html2canvas : (html2canvas as any).default;
                const jsPDFClass = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).jsPDF || (jsPDF as any).default;

                if (!html2canvasFn) {
                    throw new Error('html2canvas library is not loaded correctly.');
                }
                if (!jsPDFClass) {
                    throw new Error('jsPDF library is not loaded correctly.');
                }

                const canvas = await html2canvasFn(input, { 
                    scale: 2, 
                    useCORS: true,
                    scrollX: 0,
                    scrollY: 0,
                    windowWidth: 794,
                    width: 794,
                    windowHeight: input.scrollHeight,
                    height: input.scrollHeight
                });
                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDFClass('p', 'mm', 'a4');
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = pdf.internal.pageSize.getHeight();
                
                const imgWidth = pdfWidth;
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                
                if (imgHeight > pdfHeight) {
                    const ratio = pdfHeight / imgHeight;
                    const finalWidth = imgWidth * ratio;
                    const finalHeight = pdfHeight;
                    const x = (pdfWidth - finalWidth) / 2;
                    pdf.addImage(imgData, 'PNG', x, 0, finalWidth, finalHeight);
                } else {
                    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                }
                
                const empName = selectedLeaveRequest.employeeName ? selectedLeaveRequest.employeeName.trim() : 'NhanVien';
                const dateFormatted = selectedLeaveRequest.requestDate ? selectedLeaveRequest.requestDate.replace(/-/g, '') : '';
                pdf.save(`Don_Xin_Nghi_${empName}_${dateFormatted}.pdf`);
            } catch (error: any) {
                console.error("Error exporting PDF:", error);
                alert("Lỗi xuất PDF: " + (error?.message || error));
                setNotification({ type: 'error', message: 'Lỗi xuất PDF: ' + (error?.message || error) });
            } finally {
                setIsExportingPDF(false);
            }
        }, 150);
    };

    const filteredKpiScores = useMemo(() => {
        const term = kpiSearchTerm.toLowerCase();
        return kpiScores.filter(score => 
            score.employeeName.toLowerCase().includes(term) ||
            score.employeeId.toLowerCase().includes(term)
        );
    }, [kpiScores, kpiSearchTerm]);

    // Filters for lists
    const filteredReports = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return reports.filter(r => {
            const matchesSearch = r.violatorName.toLowerCase().includes(term) ||
                                  r.violatorCode.toLowerCase().includes(term) ||
                                  r.clause.toLowerCase().includes(term);
            const matchesFilter = reportFilter === 'all' || r.status === reportFilter;
            return matchesSearch && matchesFilter;
        });
    }, [reports, searchTerm, reportFilter]);

    // Metric Calculations
    const totalInfractionsThisMonth = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return reports.filter(r => {
            const d = new Date(r.reportDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
    }, [reports]);

    const pendingActions = useMemo(() => {
        return reports.filter(r => r.status === 'draft').length;
    }, [reports]);

    const filteredLeaveRequests = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return leaveRequests.filter(r => {
            return r.employeeName.toLowerCase().includes(term) ||
                   r.employeeCode.toLowerCase().includes(term) ||
                   r.reason.toLowerCase().includes(term);
        });
    }, [leaveRequests, searchTerm]);

    const totalLeaveDaysThisMonth = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return leaveRequests
            .filter(r => {
                const d = new Date(r.requestDate);
                return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
            })
            .reduce((sum, r) => sum + r.totalDays, 0);
    }, [leaveRequests]);

    const totalLeaveRequestsThisMonth = useMemo(() => {
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        return leaveRequests.filter(r => {
            const d = new Date(r.requestDate);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).length;
    }, [leaveRequests]);

    return (
        <ThemeProvider theme={timesTheme}>
            <Box p={{ xs: 1, sm: 3 }} sx={{ maxWidth: '1200px', mx: 'auto', width: '100%', fontFamily: "'Times New Roman', Times, serif" }}>
            {notification && (
                <Alert severity={notification.type} onClose={() => setNotification(null)} sx={{ mb: 2, borderRadius: 2 }}>
                    {notification.message}
                </Alert>
            )}

            {/* Page Header */}
            <Paper 
                elevation={0}
                sx={{
                    p: { xs: 2.5, sm: 4 },
                    mb: 3.5,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 12px 24px -10px rgba(5, 150, 105, 0.3)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <Box 
                    sx={{
                        position: 'absolute',
                        right: '-50px',
                        top: '-50px',
                        width: '200px',
                        height: '200px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.08)',
                        zIndex: 0
                    }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
                    <Box>
                        <Stack direction="row" alignItems="center" gap={1.5} mb={1}>
                            <TrendingUpIcon sx={{ fontSize: 32, color: '#ffffff' }} />
                            <Typography variant="h5" sx={{ fontWeight: 850, letterSpacing: '-0.5px', color: '#ffffff', fontFamily: "'Times New Roman', Times, serif" }}>
                                Hành Chính & KPI Nhân Sự
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#f1f5f9', fontWeight: 500, maxWidth: 600, fontFamily: "'Times New Roman', Times, serif" }}>
                            Quản lý biểu mẫu chấm điểm KPI tháng và lập Biên bản ghi nhận lỗi vi phạm kỷ luật theo Nội quy lao động công ty.
                        </Typography>
                    </Box>
                </Stack>
            </Paper>

            {/* Main Tabs */}
            <Tabs 
                value={activeTab} 
                onChange={(_, val) => setActiveTab(val)}
                sx={{ 
                    mb: 3, 
                    borderBottom: 1, 
                    borderColor: 'divider',
                    '& .MuiTab-root': { fontWeight: 'bold', minWidth: { xs: '50%', sm: 'auto' } }
                }}
            >
                <Tab label="Biên Bản Vi Phạm Lao Động" value="infractions" />
                <Tab label="Chấm Điểm KPI Tháng" value="grading" />
            </Tabs>

            {/* ── TAB 1: INFRACTIONS ───────────────────────────────────────────────── */}
            {activeTab === 'infractions' && (
                <Box>
                    {/* Metric Cards */}
                    <Grid container spacing={3} mb={4}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper sx={{ 
                                p: 2.5, 
                                borderRadius: '16px', 
                                border: '1px solid #e2e8f0', 
                                borderLeft: '5px solid #10b981', 
                                boxShadow: '0 4px 20px -2px rgba(16, 185, 129, 0.08)',
                                bgcolor: '#ffffff'
                            }}>
                                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>Biên bản trong tháng này</Typography>
                                <Typography variant="h4" sx={{ fontWeight: 850, mt: 0.5, color: '#0f172a', fontFamily: "'Times New Roman', Times, serif" }}>{totalInfractionsThisMonth}</Typography>
                            </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Paper sx={{ 
                                p: 2.5, 
                                borderRadius: '16px', 
                                border: '1px solid #e2e8f0', 
                                borderLeft: '5px solid #f59e0b', 
                                boxShadow: '0 4px 20px -2px rgba(245, 158, 11, 0.08)',
                                bgcolor: '#ffffff'
                            }}>
                                <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>Biên bản bản thảo (Chưa ký)</Typography>
                                <Typography variant="h4" sx={{ fontWeight: 850, mt: 0.5, color: '#d97706', fontFamily: "'Times New Roman', Times, serif" }}>{pendingActions}</Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Toolbar */}
                    <Paper 
                        elevation={0} 
                        sx={{ 
                            p: 2.5, 
                            mb: 3, 
                            borderRadius: '16px', 
                            border: '1px solid rgba(226, 232, 240, 0.8)', 
                            bgcolor: '#ffffff',
                        }}
                    >
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
                            <TextField
                                size="small"
                                placeholder="Tìm kiếm theo nhân viên, mã NV..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon color="action" />
                                        </InputAdornment>
                                    ),
                                    sx: { borderRadius: '10px', bgcolor: '#f8fafc' }
                                }}
                                sx={{ minWidth: 280, width: { xs: '100%', md: 'auto' } }}
                            />
                            
                            <Stack direction="row" spacing={1.5} width={{ xs: '100%', sm: 'auto' }} justifyContent="flex-end" alignItems="center">
                                <FormControl size="small" sx={{ minWidth: 150 }}>
                                    <InputLabel>Trạng thái</InputLabel>
                                    <Select
                                        value={reportFilter}
                                        label="Trạng thái"
                                        onChange={(e) => setReportFilter(e.target.value)}
                                        sx={{ borderRadius: '10px' }}
                                    >
                                        <MenuItem value="all">Tất cả biên bản</MenuItem>
                                        <MenuItem value="approved">Đã phê duyệt</MenuItem>
                                        <MenuItem value="draft">Bản nháp</MenuItem>
                                    </Select>
                                </FormControl>

                                <Button
                                    variant="outlined"
                                    color="success"
                                    startIcon={<FileDownloadIcon />}
                                    onClick={handleExportExcel}
                                    sx={{ borderRadius: '10px', px: 3, height: 40, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                >
                                    Xuất Excel
                                </Button>

                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<AddIcon />}
                                    onClick={() => handleOpenForm()}
                                    sx={{ borderRadius: '10px', px: 3, height: 40, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                >
                                    Lập Biên Bản Mới
                                </Button>
                            </Stack>
                        </Stack>
                    </Paper>

                    {/* Table View */}
                    {isMobile ? (
                        <Stack spacing={2}>
                            {filteredReports.length === 0 ? (
                                <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                    <Typography color="text.secondary" sx={{ fontFamily: "'Times New Roman', Times, serif" }}>
                                        Chưa có biên bản ghi nhận lỗi vi phạm nào được tạo.
                                    </Typography>
                                </Paper>
                            ) : (
                                filteredReports.map((report) => (
                                    <Card key={report.id} variant="outlined" sx={{ borderRadius: '16px', borderColor: '#e2e8f0', fontFamily: "'Times New Roman', Times, serif" }}>
                                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                            <Stack direction="row" justifyContent="space-between" mb={1}>
                                                <Typography variant="subtitle2" fontWeight="bold">
                                                    {report.violatorName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Mã NV: {report.violatorCode}
                                                </Typography>
                                            </Stack>

                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Đơn vị: {report.violatorUnit}
                                            </Typography>

                                            <Divider sx={{ my: 1 }} />

                                            <Typography variant="body2" sx={{ my: 0.5 }}>
                                                <b>Lỗi vi phạm:</b> <span style={{ color: '#ef4444' }}>{report.clause.substring(0, 45)}{report.clause.length > 45 ? '...' : ''}</span>
                                            </Typography>

                                            <Typography variant="body2" sx={{ my: 0.5 }}>
                                                <b>Người phát hiện:</b> {report.inspectorName}
                                            </Typography>

                                            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
                                                <Typography 
                                                    variant="caption" 
                                                    sx={{ 
                                                        px: 1.5, py: 0.5, borderRadius: '12px', fontWeight: 'bold',
                                                        bgcolor: report.status === 'approved' ? '#d1fae5' : '#fef9c3',
                                                        color: report.status === 'approved' ? '#065f46' : '#854d0e'
                                                    }}
                                                >
                                                    {report.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'}
                                                </Typography>
                                                <Stack direction="row" spacing={1}>
                                                    <IconButton size="small" color="primary" onClick={() => handlePrint(report)} sx={{ bgcolor: '#f8fafc' }}>
                                                        <PrintIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="info" onClick={() => handleOpenForm(report)} sx={{ bgcolor: '#f8fafc' }}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteReport(report.id, report.violatorName)} sx={{ bgcolor: '#f8fafc' }}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Stack>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </Stack>
                    ) : (
                        <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                            <Table size="small">
                                <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 800, py: 2, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Ngày lập</TableCell>
                                        <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Mã NV</TableCell>
                                        <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Nhân viên vi phạm</TableCell>
                                        <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Đơn vị</TableCell>
                                        <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Điều khoản vi phạm</TableCell>
                                        <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Người phát hiện</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Trạng thái</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', pr: 3, fontFamily: "'Times New Roman', Times, serif" }}>Thao tác</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {filteredReports.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>
                                                Chưa có biên bản ghi nhận lỗi vi phạm nào được tạo.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredReports.map((report) => (
                                            <TableRow key={report.id} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                <TableCell sx={{ py: 1.5 }}>{new Date(report.reportDate).toLocaleDateString('vi-VN')}</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>{report.violatorCode}</TableCell>
                                                <TableCell sx={{ fontWeight: 600 }}>{report.violatorName}</TableCell>
                                                <TableCell>{report.violatorUnit}</TableCell>
                                                <TableCell sx={{ color: '#ef4444', fontWeight: 500 }}>
                                                    {report.clause.substring(0, 45)}{report.clause.length > 45 ? '...' : ''}
                                                </TableCell>
                                                <TableCell>{report.inspectorName}</TableCell>
                                                <TableCell align="center">
                                                    <Typography 
                                                        variant="caption" 
                                                        sx={{ 
                                                            px: 1.5, py: 0.5, borderRadius: '12px', fontWeight: 'bold',
                                                            bgcolor: report.status === 'approved' ? '#d1fae5' : '#fef9c3',
                                                            color: report.status === 'approved' ? '#065f46' : '#854d0e'
                                                        }}
                                                    >
                                                        {report.status === 'approved' ? 'Đã duyệt' : 'Bản nháp'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right" sx={{ pr: 2 }}>
                                                    <Tooltip title="Xem & In Biên Bản (A4)" TransitionComponent={Zoom}>
                                                        <IconButton size="small" color="primary" onClick={() => handlePrint(report)} sx={{ mr: 0.5 }}>
                                                            <PrintIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Chỉnh sửa">
                                                        <IconButton size="small" color="info" onClick={() => handleOpenForm(report)} sx={{ mr: 0.5 }}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Xóa">
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteReport(report.id, report.violatorName)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Box>
            )}



            {/* ── TAB 2: KPI GRADING ────────────────────────────────────────────────── */}
            {activeTab === 'grading' && (
                <Box>
                    <Paper 
                        elevation={0}
                        sx={{ 
                            p: 3, 
                            mb: 3.5, 
                            borderRadius: '16px', 
                            border: '1px solid #e2e8f0',
                            bgcolor: '#ffffff'
                        }}
                    >
                        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2.5} mb={3}>
                            <Box>
                                <Typography variant="h6" fontWeight="bold" color="#0f172a">
                                    Bảng Đánh Giá KPI Nhân Sự
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Nhập điểm hiệu suất làm việc định kỳ cho từng cán bộ nhân viên trong đơn vị.
                                </Typography>
                            </Box>
                            
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                                <TextField
                                    size="small"
                                    placeholder="Tìm kiếm nhân viên..."
                                    value={kpiSearchTerm}
                                    onChange={(e) => setKpiSearchTerm(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon color="action" />
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: '10px', bgcolor: '#f8fafc' }
                                    }}
                                    sx={{ minWidth: 200 }}
                                />
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                    <InputLabel>Tháng</InputLabel>
                                    <Select
                                        value={kpiMonth}
                                        label="Tháng"
                                        onChange={(e) => setKpiMonth(Number(e.target.value))}
                                    >
                                        {Array.from({ length: 12 }, (_, i) => (
                                            <MenuItem key={i + 1} value={i + 1}>Tháng {i + 1}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                    <InputLabel>Năm</InputLabel>
                                    <Select
                                        value={kpiYear}
                                        label="Năm"
                                        onChange={(e) => setKpiYear(Number(e.target.value))}
                                    >
                                        {[2024, 2025, 2026, 2027].map(yr => (
                                            <MenuItem key={yr} value={yr}>Năm {yr}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                <Button
                                    variant="contained"
                                    color="success"
                                    startIcon={<SaveIcon />}
                                    onClick={handleSaveKpiScores}
                                    sx={{ borderRadius: '10px', px: 3, height: 40, fontWeight: 'bold', whiteSpace: 'nowrap' }}
                                >
                                    Lưu Bảng Điểm
                                </Button>
                            </Stack>
                        </Stack>

                        {isMobile ? (
                            <Stack spacing={2}>
                                {filteredKpiScores.length === 0 ? (
                                    <Paper sx={{ p: 4, textAlign: 'center', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                                        <Typography color="text.secondary" sx={{ fontFamily: "'Times New Roman', Times, serif" }}>
                                            Không tìm thấy cán bộ nhân viên phù hợp.
                                        </Typography>
                                    </Paper>
                                ) : (
                                    filteredKpiScores.map((score, index) => (
                                        <Card key={score.employeeId} variant="outlined" sx={{ borderRadius: '16px', borderColor: '#e2e8f0', p: 2, fontFamily: "'Times New Roman', Times, serif" }}>
                                            <Stack spacing={2}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                    <Typography variant="subtitle1" fontWeight="bold">
                                                        {index + 1}. {score.employeeName}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        Mã NV: {score.employeeId}
                                                    </Typography>
                                                </Stack>
                                                
                                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                                    <Typography variant="body2" color="text.secondary">
                                                        {score.jobPosition}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary">•</Typography>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {score.department}
                                                    </Typography>
                                                </Stack>

                                                <Divider />

                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <Typography variant="body2" fontWeight="bold" sx={{ minWidth: 100 }}>
                                                        Điểm KPI (0-100):
                                                    </Typography>
                                                    <TextField
                                                        size="small"
                                                        type="number"
                                                        value={score.score}
                                                        onChange={(e) => {
                                                            let val = Number(e.target.value);
                                                            if (val < 0) val = 0;
                                                            if (val > 100) val = 100;
                                                            handleKpiScoreChange(score.employeeId, 'score', val);
                                                        }}
                                                        inputProps={{ min: 0, max: 100, style: { textAlign: 'center', fontWeight: 'bold' } }}
                                                        sx={{ width: 100 }}
                                                    />
                                                </Stack>

                                                <TextField
                                                    size="small"
                                                    fullWidth
                                                    multiline
                                                    rows={2}
                                                    label="Nhận xét / Đánh giá chi tiết"
                                                    placeholder="Nhập nhận xét..."
                                                    value={score.notes}
                                                    onChange={(e) => handleKpiScoreChange(score.employeeId, 'notes', e.target.value)}
                                                    InputProps={{ sx: { borderRadius: '6px' } }}
                                                />
                                            </Stack>
                                        </Card>
                                    ))
                                )}
                            </Stack>
                        ) : (
                            <TableContainer component={Paper} sx={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 800, width: 60, py: 2, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>STT</TableCell>
                                            <TableCell sx={{ fontWeight: 800, width: 120, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Mã NV</TableCell>
                                            <TableCell sx={{ fontWeight: 800, width: 220, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Cán bộ nhân viên</TableCell>
                                            <TableCell sx={{ fontWeight: 800, width: 180, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Chức danh</TableCell>
                                            <TableCell sx={{ fontWeight: 800, width: 180, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Đơn vị/Bộ phận</TableCell>
                                            <TableCell align="center" sx={{ fontWeight: 800, width: 140, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Điểm KPI (0-100)</TableCell>
                                            <TableCell sx={{ fontWeight: 800, fontSize: '0.95rem', color: '#334155', fontFamily: "'Times New Roman', Times, serif" }}>Nhận xét / Đánh giá chi tiết</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredKpiScores.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                                    Không tìm thấy cán bộ nhân viên phù hợp.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredKpiScores.map((score, index) => (
                                                <TableRow key={score.employeeId} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                                    <TableCell align="center" sx={{ py: 1 }}>{index + 1}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{score.employeeId}</TableCell>
                                                    <TableCell sx={{ fontWeight: 600 }}>{score.employeeName}</TableCell>
                                                    <TableCell>{score.jobPosition}</TableCell>
                                                    <TableCell>{score.department}</TableCell>
                                                    <TableCell align="center">
                                                        <TextField
                                                            size="small"
                                                            type="number"
                                                            value={score.score}
                                                            onChange={(e) => {
                                                                let val = Number(e.target.value);
                                                                if (val < 0) val = 0;
                                                                if (val > 100) val = 100;
                                                                handleKpiScoreChange(score.employeeId, 'score', val);
                                                            }}
                                                            inputProps={{ min: 0, max: 100, style: { textAlign: 'center', fontWeight: 'bold' } }}
                                                            sx={{ width: 80 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <TextField
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Nhập nhận xét về hiệu quả công việc..."
                                                            value={score.notes}
                                                            onChange={(e) => handleKpiScoreChange(score.employeeId, 'notes', e.target.value)}
                                                            InputProps={{ sx: { borderRadius: '6px' } }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>
                </Box>
            )}

            {/* ── FORM DIALOG: CREATE/EDIT INFRACTION ──────────────────────────────── */}
            <Dialog 
                open={isFormOpen} 
                onClose={() => setIsFormOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '16px', p: 1.5 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentIcon sx={{ color: '#10b981' }} />
                        {formMode === 'create' ? 'Lập Biên Bản Vi Phạm Lao Động Mới' : 'Chỉnh Sửa Biên Bản Vi Phạm'}
                    </Typography>
                    <IconButton onClick={() => setIsFormOpen(false)}><CloseIcon /></IconButton>
                </DialogTitle>
                
                <DialogContent dividers sx={{ bgcolor: '#f8fafc', p: 3.5 }}>
                    <Stack spacing={3.5}>
                        {/* Section A: Personnel & General Parameters */}
                        <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Thông tin chung & Nhân sự liên quan
                            </Typography>
                            <Grid container spacing={2.5}>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <TextField
                                        label="Ngày lập biên bản"
                                        type="date"
                                        fullWidth
                                        value={formData.reportDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, reportDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth>
                                        <InputLabel>Trạng thái biên bản</InputLabel>
                                        <Select
                                            value={formData.status}
                                            label="Trạng thái biên bản"
                                            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                                        >
                                            <MenuItem value="approved">Đã ký / Phê duyệt</MenuItem>
                                            <MenuItem value="draft">Bản thảo (Chưa ký)</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <Autocomplete
                                        options={activeProfilesList as any[]}
                                        getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                                        value={(activeProfilesList as any[]).find(p => p.id === formData.violatorId) || null}
                                        onChange={(_, newValue) => {
                                            setFormData(prev => ({ ...prev, violatorId: newValue ? newValue.id : '' }));
                                        }}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Nhân viên vi phạm (Người vi phạm)" fullWidth />
                                        )}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <Autocomplete
                                        options={activeProfilesList as any[]}
                                        getOptionLabel={(option) => `${option.full_name} (${option.id})`}
                                        value={(activeProfilesList as any[]).find(p => p.id === formData.inspectorId) || null}
                                        onChange={(_, newValue) => {
                                            setFormData(prev => ({ ...prev, inspectorId: newValue ? newValue.id : '' }));
                                        }}
                                        renderInput={(params) => (
                                            <TextField {...params} label="Người kiểm tra / Phát hiện vi phạm" fullWidth />
                                        )}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <TextField
                                        label="Chỉ huy trực tiếp (Ký xác nhận)"
                                        fullWidth
                                        placeholder="TRẦN KIM HÙNG"
                                        value={formData.supervisorName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, supervisorName: e.target.value }))}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth>
                                        <InputLabel>Mục vi phạm (Nội quy lao động)</InputLabel>
                                        <Select
                                            value={formData.clause}
                                            label="Mục vi phạm (Nội quy lao động)"
                                            onChange={(e) => setFormData(prev => ({ ...prev, clause: e.target.value }))}
                                        >
                                            {DEFAULT_CLAUSES.map(clause => (
                                                <MenuItem key={clause.value} value={clause.value}>
                                                    {clause.label.substring(0, 70)}{clause.label.length > 70 ? '...' : ''}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {formData.clause === 'custom' && (
                                    <Grid size={{ xs: 12 }}>
                                        <TextField
                                            label="Nhập điều khoản vi phạm tùy chỉnh"
                                            fullWidth
                                            placeholder="Ví dụ: 30.47 Không chấp hành nội quy kho bãi..."
                                            value={formData.customClause}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customClause: e.target.value }))}
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </Paper>

                        {/* Section B: Full Width Spacious Text Fields using clean Box layout elements */}
                        <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Nội dung chi tiết biên bản vi phạm
                                </Typography>
                                <Button
                                    variant="outlined"
                                    color="success"
                                    startIcon={<AutoAwesomeIcon />}
                                    onClick={handleAutoGenerateTexts}
                                    sx={{ borderRadius: '8px', textTransform: 'none', height: 32, fontSize: '0.8rem' }}
                                >
                                    Tự động tối ưu hóa biên bản (AI)
                                </Button>
                            </Stack>
                            
                            <Box sx={{ width: '100%' }}>
                                <TextField
                                    label="1. Mô tả chi tiết lỗi vi phạm, mức độ thiệt hại, bằng chứng"
                                    multiline
                                    rows={3}
                                    fullWidth
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Nhập mô tả chi tiết lỗi vi phạm, mức độ thiệt hại, bằng chứng..."
                                    helperText="Hiển thị tại mục 1 của biên bản A4"
                                />
                            </Box>

                            <Box sx={{ width: '100%' }}>
                                <TextField
                                    label="2. Yêu cầu của người phát hiện/kiểm tra về việc khắc phục lỗi"
                                    multiline
                                    rows={4}
                                    fullWidth
                                    value={formData.mitigationReq}
                                    onChange={(e) => setFormData(prev => ({ ...prev, mitigationReq: e.target.value }))}
                                    placeholder="Đồng chí: [Tên nhân viên] vi phạm nội quy..."
                                    helperText="Hiển thị tại mục 2 của biên bản A4"
                                />
                            </Box>

                            <Box sx={{ width: '100%' }}>
                                <TextField
                                    label="3. Giải trình (hoặc ý kiến) và cam kết của người phạm lỗi"
                                    multiline
                                    rows={4}
                                    fullWidth
                                    value={formData.explanation}
                                    onChange={(e) => setFormData(prev => ({ ...prev, explanation: e.target.value }))}
                                    placeholder="Tôi cam kết..."
                                    helperText="Hiển thị tại mục 3 của biên bản A4"
                                />
                            </Box>

                            <Box sx={{ width: '100%' }}>
                                <TextField
                                    label="4. Kết luận lỗi của Ban GĐ đơn vị"
                                    multiline
                                    rows={3}
                                    fullWidth
                                    value={formData.conclusion}
                                    onChange={(e) => setFormData(prev => ({ ...prev, conclusion: e.target.value }))}
                                    placeholder="Đồng chí: [Tên nhân viên] đã vi phạm điều khoản..."
                                    helperText="Hiển thị tại mục 4 của biên bản A4"
                                />
                            </Box>
                        </Paper>
                    </Stack>
                </DialogContent>
                
                <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => setIsFormOpen(false)} variant="outlined" sx={{ borderRadius: '10px', height: 42, px: 3 }}>Hủy Bỏ</Button>
                    <Button onClick={handleSaveReport} variant="contained" color="success" sx={{ borderRadius: '10px', px: 4, height: 42, fontWeight: 'bold' }}>
                        Lưu Biên Bản
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── PREVIEW & PRINT DIALOG ─────────────────────────────────────────── */}
            <Dialog
                open={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '12px', bgcolor: '#f8fafc', p: 0 }
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'white', borderBottom: '1px solid #e2e8f0', py: 1.5 }}>
                    <Typography sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                        Xem Trước & In Biên Bản Vi Phạn
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PrintIcon />}
                            onClick={triggerBrowserPrint}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                        >
                            In Biên Bản (A4)
                        </Button>
                        <IconButton onClick={() => setIsPreviewOpen(false)} size="small"><CloseIcon /></IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent sx={{ p: { xs: 1, sm: 4 }, display: 'flex', justifyContent: 'center' }}>
                    {selectedReport && <PrintableReportTemplate report={selectedReport} />}
                </DialogContent>
            </Dialog>

            {/* ── FORM DIALOG: CREATE/EDIT LEAVE REQUEST ───────────────────────────── */}
            <Dialog 
                open={isLeaveFormOpen} 
                onClose={() => setIsLeaveFormOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '16px', p: 1.5 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AssignmentIcon sx={{ color: '#10b981' }} />
                        {leaveFormMode === 'create' ? 'Lập Đơn Xin Nghỉ Mới' : 'Chỉnh Sửa Đơn Xin Nghỉ'}
                    </Typography>
                    <IconButton onClick={() => setIsLeaveFormOpen(false)}><CloseIcon /></IconButton>
                </DialogTitle>
                
                <DialogContent dividers sx={{ bgcolor: '#f8fafc', p: 3.5 }}>
                    <Stack spacing={3.5}>
                        {/* Section A: Personnel */}
                        <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Thông tin nhân sự làm đơn
                            </Typography>
                            <Grid container spacing={2.5}>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <FormControl fullWidth>
                                        <InputLabel>Nhân viên làm đơn</InputLabel>
                                        <Select
                                            value={leaveFormData.employeeId}
                                            label="Nhân viên làm đơn"
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                                        >
                                            {activeProfilesList.map(emp => (
                                                <MenuItem key={emp.id} value={emp.id}>
                                                    {emp.full_name} ({emp.id})
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6 }}>
                                    <TextField
                                        label="Ngày làm đơn"
                                        type="date"
                                        fullWidth
                                        value={leaveFormData.requestDate}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, requestDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Section B: Leave Details */}
                        <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Thông tin xin nghỉ phép
                            </Typography>
                            <Grid container spacing={2.5}>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Từ ngày"
                                        type="date"
                                        fullWidth
                                        value={leaveFormData.startDate}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, startDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Giờ bắt đầu"
                                        type="time"
                                        fullWidth
                                        value={leaveFormData.startTime}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, startTime: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Đến ngày"
                                        type="date"
                                        fullWidth
                                        value={leaveFormData.endDate}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, endDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Giờ kết thúc"
                                        type="time"
                                        fullWidth
                                        value={leaveFormData.endTime}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, endTime: e.target.value }))}
                                        InputLabelProps={{ shrink: true }}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Tổng số ngày nghỉ"
                                        type="number"
                                        fullWidth
                                        inputProps={{ min: 0.1, step: 0.1 }}
                                        value={leaveFormData.totalDays}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, totalDays: Number(e.target.value) || 0 }))}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth>
                                        <InputLabel>Loại nghỉ</InputLabel>
                                        <Select
                                            value={leaveFormData.leaveType}
                                            label="Loại nghỉ"
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, leaveType: e.target.value as string }))}
                                        >
                                            {LEAVE_TYPES.map((type) => (
                                                <MenuItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                {leaveFormData.leaveType === 'other' && (
                                    <Grid size={{ xs: 12, sm: 5 }}>
                                        <TextField
                                            label="Loại nghỉ khác"
                                            fullWidth
                                            placeholder="Nhập loại nghỉ..."
                                            value={leaveFormData.customLeaveType}
                                            onChange={(e) => setLeaveFormData(prev => ({ ...prev, customLeaveType: e.target.value }))}
                                        />
                                    </Grid>
                                )}

                                <Grid size={{ xs: 12, sm: leaveFormData.leaveType === 'other' ? 12 : 5 }}>
                                    <TextField
                                        label="Nơi nghỉ"
                                        fullWidth
                                        placeholder="Địa chỉ nơi nghỉ phép..."
                                        value={leaveFormData.location}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, location: e.target.value }))}
                                    />
                                </Grid>

                                <Grid size={{ xs: 12 }}>
                                    <TextField
                                        label="Lý do xin nghỉ"
                                        fullWidth
                                        multiline
                                        rows={2}
                                        placeholder="Nhập lý do cụ thể xin nghỉ..."
                                        value={leaveFormData.reason}
                                        onChange={(e) => setLeaveFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>

                        {/* Section C: Handovers Table */}
                        <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e2e8f0', bgcolor: 'white' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Bàn giao công việc (Tối đa 5 công việc)
                            </Typography>
                            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                        <TableRow>
                                            <TableCell align="center" sx={{ fontWeight: 'bold', width: 60 }}>STT</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>CÔNG VIỆC</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', width: '35%' }}>MỤC TIÊU / KẾT QUẢ</TableCell>
                                            <TableCell sx={{ fontWeight: 'bold', width: '25%' }}>NGƯỜI NHẬN BÀN GIAO</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {leaveFormData.handovers.map((row, index) => (
                                            <TableRow key={index}>
                                                <TableCell align="center" sx={{ fontWeight: 'bold' }}>{index + 1}</TableCell>
                                                <TableCell sx={{ py: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        fullWidth
                                                        placeholder="Nhập nội dung công việc..."
                                                        value={row.task}
                                                        onChange={(e) => handleHandoverChange(index, 'task', e.target.value)}
                                                        InputProps={{ sx: { borderRadius: '6px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ py: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        fullWidth
                                                        placeholder="Nhập mục tiêu/kết quả cần đạt..."
                                                        value={row.target}
                                                        onChange={(e) => handleHandoverChange(index, 'target', e.target.value)}
                                                        InputProps={{ sx: { borderRadius: '6px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ py: 1 }}>
                                                    <FormControl size="small" fullWidth>
                                                        <Select
                                                            value={row.recipientName}
                                                            onChange={(e) => handleHandoverChange(index, 'recipientName', e.target.value)}
                                                            displayEmpty
                                                            sx={{ borderRadius: '6px' }}
                                                        >
                                                            <MenuItem value="">
                                                                <span style={{ color: '#94a3b8' }}>-- Chọn người nhận --</span>
                                                            </MenuItem>
                                                            {activeProfilesList.map(emp => (
                                                                <MenuItem key={emp.id} value={emp.full_name}>
                                                                    {emp.full_name} ({emp.id})
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Stack>
                </DialogContent>
                
                <DialogActions sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <Button onClick={() => setIsLeaveFormOpen(false)} variant="outlined" sx={{ borderRadius: '10px', height: 42, px: 3 }}>Hủy Bỏ</Button>
                    <Button onClick={handleSaveLeaveRequest} variant="contained" color="success" sx={{ borderRadius: '10px', px: 4, height: 42, fontWeight: 'bold' }}>
                        Lưu Đơn Xin Nghỉ
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── LEAVE PREVIEW & PRINT DIALOG ────────────────────────────────────── */}
            <Dialog
                open={isLeavePreviewOpen}
                onClose={() => setIsLeavePreviewOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: '12px', bgcolor: '#f8fafc', p: 0 }
                }}
            >
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'white', borderBottom: '1px solid #e2e8f0', py: 1.5 }}>
                    <Typography sx={{ fontWeight: 'bold', color: '#1e293b' }}>
                        Xem Trước & In Đơn Xin Nghỉ Phép
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<FileDownloadIcon />}
                            onClick={handleExportPDF}
                            disabled={isExportingPDF}
                            sx={{ borderRadius: '8px', textTransform: 'none', bgcolor: '#ef4444', '&:hover': { bgcolor: '#dc2626' } }}
                        >
                            {isExportingPDF ? 'Đang xuất...' : 'Xuất PDF'}
                        </Button>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<PrintIcon />}
                            onClick={triggerBrowserPrint}
                            sx={{ borderRadius: '8px', textTransform: 'none' }}
                        >
                            In Đơn Xin Nghỉ (A4)
                        </Button>
                        <IconButton onClick={() => setIsLeavePreviewOpen(false)} size="small"><CloseIcon /></IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent sx={{ p: { xs: 1, sm: 4 }, display: 'flex', justifyContent: 'center' }}>
                    {selectedLeaveRequest && <PrintableLeaveRequestTemplate leaveRequest={selectedLeaveRequest} />}
                </DialogContent>
            </Dialog>

            {/* Hidden container for PDF Generation */}
            {selectedLeaveRequest && (
                <Box sx={{ position: 'absolute', top: '20000px', left: '0px', width: '794px', bgcolor: 'white', zIndex: -1000, pointerEvents: 'none' }}>
                    <div id="hidden-pdf-container">
                        <PrintableLeaveRequestTemplate leaveRequest={selectedLeaveRequest} />
                    </div>
                </Box>
            )}

            {/* Portal Printable */}
            {selectedReport && createPortal(
                <div id="print-portal-root">
                    <PrintableReportTemplate report={selectedReport} />
                </div>,
                document.body
            )}

            {selectedLeaveRequest && createPortal(
                <div id="print-portal-root">
                    <PrintableLeaveRequestTemplate leaveRequest={selectedLeaveRequest} />
                </div>,
                document.body
            )}

            <style>
                {`
                    @media print {
                        body > * {
                            display: none !important;
                        }
                        body > #print-portal-root {
                            display: block !important;
                            position: absolute;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            z-index: 999999;
                            background: white;
                            padding: 0px !important;
                            margin: 0px !important;
                        }
                        @page {
                            size: A4 portrait;
                            margin: 0;
                        }
                    }
                    #print-portal-root {
                        display: none;
                    }
                `}
            </style>
            </Box>
        </ThemeProvider>
    );
};

// ── COMPONENT DỰA TRÊN DÒNG KẺ ĐỨT THỰC TẾ A4 ─────────────────────────────
const DottedTextLines = ({ text, clausePrefix, totalLines = 5, onlyShowTextLines = false }: { text: string; clausePrefix?: string; totalLines?: number; onlyShowTextLines?: boolean }) => {
    // Tách text theo dòng
    const rawLines = text ? text.split('\n') : [];
    
    // Nếu có tiền tố mục vi phạm, chèn vào trước dòng đầu tiên
    const lines = [...rawLines];
    if (clausePrefix && lines.length > 0) {
        lines[0] = `${clausePrefix} ${lines[0]}`;
    } else if (clausePrefix) {
        lines.push(clausePrefix);
    }
    
    // Bổ sung các dòng trống cho đủ chỉ tiêu dòng kẻ đứt của mẫu
    const renderedLines = [...lines];
    if (!onlyShowTextLines) {
        while (renderedLines.length < totalLines) {
            renderedLines.push('');
        }
    }
    
    return (
        <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0, width: '100%' }}>
            {renderedLines.map((line, idx) => (
                <Box 
                    key={idx}
                    sx={{
                        borderBottom: '1px dotted #555555',
                        minHeight: '27px',
                        lineHeight: '27px',
                        fontSize: '11pt',
                        fontFamily: "'Times New Roman', Times, serif",
                        display: 'flex',
                        alignItems: 'flex-end',
                        pb: '1px',
                        color: '#000000',
                        width: '100%',
                        textAlign: 'justify'
                    }}
                >
                    {line || '\u00A0'}
                </Box>
            ))}
        </Box>
    );
};

// ── PRINTABLE COMPONENT: PURE TIMES NEW ROMAN A4 STYLE ─────────────────────
const PrintableReportTemplate = ({ report }: { report: InfractionReport }) => {
    const reportDateObj = new Date(report.reportDate);
    
    // Tìm tiêu đề lỗi chuẩn để hiển thị trong mục 1
    const cleanClause = useMemo(() => {
        const found = DEFAULT_CLAUSES.find(c => c.value === report.clause);
        const rawLabel = found ? found.label : report.clause;
        // Trả về nhãn lỗi đã lược bỏ các kí tự dư thừa
        return rawLabel.replace(/^Điều\s+/, '');
    }, [report.clause]);

    return (
        <Box
            sx={{
                width: '794px',
                height: '1123px',
                p: '20mm 15mm 20mm 30mm',
                bgcolor: 'white',
                color: '#000000',
                fontFamily: "'Times New Roman', Times, serif",
                boxSizing: 'border-box',
                '@media print': {
                    p: '20mm 15mm 20mm 30mm !important',
                    width: '794px !important',
                    height: 'auto !important',
                }
            }}
        >
            {/* Header Columns */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, borderBottom: '2px solid #000000', pb: 1.5 }}>
                <Box sx={{ width: '45%' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        CÔNG TY CỔ PHẦN VIỄN THÔNG ACT
                    </Typography>
                </Box>
                <Box sx={{ width: '55%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        BIÊN BẢN GHI NHẬN LỖI VI PHẠM
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        THEO NỘI QUY LAO ĐỘNG
                    </Typography>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '10pt', mt: 0.5, fontFamily: "'Times New Roman', Times, serif" }}>
                        Ngày {String(reportDateObj.getDate()).padStart(2, '0')} tháng {String(reportDateObj.getMonth() + 1).padStart(2, '0')} năm {reportDateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>

            {/* Two Column Personnel Block */}
            <Grid container spacing={4} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6 }} sx={{ pr: 3 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11.5pt', mb: 1.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        NGƯỜI KIỂM TRA/PHÁT HIỆN
                    </Typography>
                    <Stack spacing={0.5}>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Họ và tên: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{report.inspectorName}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Mã NV: <span>{report.inspectorCode}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Chức danh: <span>{report.inspectorJob}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Đơn vị: <span>{report.inspectorUnit}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Số điện thoại: <span>{report.inspectorPhone}</span>
                        </Typography>
                    </Stack>
                </Grid>

                <Grid size={{ xs: 6 }} sx={{ pl: 3, borderLeft: '1px solid #000000' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11.5pt', mb: 1.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        NGƯỜI VI PHẠM
                    </Typography>
                    <Stack spacing={0.5}>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Họ và tên: <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{report.violatorName}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Mã NV: <span>{report.violatorCode}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Chức danh: <span>{report.violatorJob}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Đơn vị: <span>{report.violatorUnit}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            Số điện thoại: <span>{report.violatorPhone}</span>
                        </Typography>
                    </Stack>
                </Grid>
            </Grid>

            {/* Sections using precise dotted underlines */}
            <Stack spacing={3} sx={{ mb: 4 }}>
                
                {/* SECTION 1 */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', mb: 0.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        1. Lỗi vi phạm (theo Nội quy LĐ) và mô tả chi tiết lỗi vi phạm, mức độ thiệt hại, bằng chứng đính kèm (nếu có)
                    </Typography>
                    <DottedTextLines clausePrefix={cleanClause} text={report.description} totalLines={5} onlyShowTextLines={true} />
                </Box>

                {/* SECTION 2 */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', mb: 0.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        2. Yêu cầu của người phát hiện/kiểm tra về việc khắc phục lỗi
                    </Typography>
                    <DottedTextLines text={report.mitigationReq} totalLines={5} onlyShowTextLines={true} />
                </Box>

                {/* SECTION 3 */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', mb: 0.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        3. Giải trình (hoặc ý kiến) và cam kết của người phạm lỗi
                    </Typography>
                    <DottedTextLines text={report.explanation} totalLines={3} />
                </Box>

                {/* SECTION 4 */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', mb: 0.2, fontFamily: "'Times New Roman', Times, serif" }}>
                        4. Kết luận lỗi của Ban GĐ đơn vị : (CBNV vi phạm mục nào của điều 30 của Nội quy LĐ hoặc lỗi khác)
                    </Typography>
                    <DottedTextLines text={report.conclusion} totalLines={3} onlyShowTextLines={true} />
                </Box>

            </Stack>

            {/* Signatures at the bottom - Separated by rows to prevent misalignment due to text wrapping */}
            <Box sx={{ mt: 5, '@media print': { mt: 4 } }}>
                {/* Row 1: Titles */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            NGƯỜI VI PHẠM
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            CHỈ HUY TRỰC TIẾP
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif" }}>
                            NGƯỜI PHÁT HIỆN/KIỂM TRA
                        </Typography>
                    </Box>
                </Box>

                {/* Row 2: Space for signature */}
                <Box sx={{ height: 85 }} />

                {/* Row 3: Names */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {report.violatorName}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {report.supervisorName}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', width: '30%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {report.inspectorName}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

// ── PRINTABLE COMPONENT: LEAVE REQUEST A4 STYLE ────────────────────────────
const PrintableLeaveRequestTemplate = ({ leaveRequest }: { leaveRequest: any }) => {
    const reqDateObj = new Date(leaveRequest.requestDate);
    const startDateObj = new Date(leaveRequest.startDate);
    const endDateObj = new Date(leaveRequest.endDate);
    
    // Parse hours and minutes
    const [startHour, startMin] = leaveRequest.startTime.split(':');
    const [endHour, endMin] = leaveRequest.endTime.split(':');

    // Ensure handovers has exactly 5 rows
    const fullHandovers = useMemo(() => {
        const rows = [...leaveRequest.handovers];
        while (rows.length < 5) {
            rows.push({ task: '', target: '', recipientName: '' });
        }
        return rows;
    }, [leaveRequest.handovers]);

    // Find unique recipient name(s) for signature
    const uniqueRecipients = useMemo(() => {
        if (!leaveRequest.handovers || !Array.isArray(leaveRequest.handovers)) return [];
        const names = leaveRequest.handovers
            .map((h: any) => h.recipientName?.trim())
            .filter((name: string) => name && name !== '');
        return Array.from(new Set(names)) as string[];
    }, [leaveRequest.handovers]);

    return (
        <Box
            sx={{
                width: '794px',
                minHeight: '1123px',
                height: 'auto',
                p: '15mm 15mm 15mm 30mm',
                bgcolor: 'white',
                color: '#000000',
                fontFamily: "'Times New Roman', Times, serif",
                boxSizing: 'border-box',
                '@media print': {
                    p: '10mm 15mm 10mm 30mm !important',
                    width: '794px',
                    height: 'auto !important',
                }
            }}
        >
            {/* Header section with ACT company and Country credentials */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box sx={{ width: '45%', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        CÔNG TY CP VIỄN THÔNG ACT
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '10pt', fontFamily: "'Times New Roman', Times, serif", textDecoration: 'underline', lineHeight: 1.2 }}>
                        TRUNG TÂM ACT KV BSG
                    </Typography>
                </Box>
                <Box sx={{ width: '55%', textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", lineHeight: 1.2 }}>
                        CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                    </Typography>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", textDecoration: 'underline', lineHeight: 1.2 }}>
                        Độc lập – Tự do – Hạnh phúc
                    </Typography>
                    <Typography sx={{ fontStyle: 'italic', fontSize: '10pt', mt: 0.5, fontFamily: "'Times New Roman', Times, serif", textAlign: 'right', pr: 2 }}>
                        Tp Hồ Chí Minh, ngày {String(reqDateObj.getDate()).padStart(2, '0')} tháng {String(reqDateObj.getMonth() + 1).padStart(2, '0')} năm {reqDateObj.getFullYear()}
                    </Typography>
                </Box>
            </Box>
 
            {/* Document Title */}
            <Box sx={{ textAlign: 'center', my: 1 }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '15pt', letterSpacing: '0.5px', fontFamily: "'Times New Roman', Times, serif" }}>
                    ĐƠN XIN NGHỈ
                </Typography>
            </Box>
 
            {/* Content Body */}
            <Stack spacing={0.8} sx={{ mb: 1, fontSize: '11pt', lineHeight: 1.4 }}>
                
                {/* SECTION I */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        I. Thông tin nhân viên:
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', rowGap: 1.5, width: '100%' }}>
                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Tôi tên là:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px', 
                                fontWeight: 'bold', 
                                textTransform: 'uppercase',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeName || '\u00A0'}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Mã nhân viên:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                width: '160px', 
                                paddingLeft: '8px', 
                                fontWeight: 'bold',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeCode || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Vị trí công việc:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeJob || '\u00A0'}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Đơn vị công tác:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                width: '220px', 
                                paddingLeft: '8px', 
                                color: '#ef4444', // Highlight unit text as in the original image (red color TTKV Bắc Sài Gòn)
                                fontWeight: 'bold',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeeUnit || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Số điện thoại liên hệ:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px',
                                lineHeight: '1.2' 
                            }}>
                                {leaveRequest.employeePhone || '\u00A0'}
                            </span>
                        </Box>
                    </Box>
                </Box>

                {/* SECTION II */}
                <Box>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '12pt', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        II. Nội dung:
                    </Typography>

                    <Stack spacing={0.8} sx={{ width: '100%' }}>
                        <Box>
                            <span style={{ fontStyle: 'italic', textDecoration: 'underline' }}>Thời gian xin nghỉ:</span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end' }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Từ ngày (giờ):</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
                                {startDateObj.toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>Giờ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {startHour || '00'}
                            </span>
                            <span style={{ paddingLeft: '4px', paddingRight: '4px', color: '#ef4444', fontWeight: 'bold' }}>:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {startMin || '00'}
                            </span>
                            
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '12px' }}>Đến ngày (giờ):</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '120px', textAlign: 'center', fontWeight: 'bold' }}>
                                {endDateObj.toLocaleDateString('vi-VN')}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>Giờ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {endHour || '00'}
                            </span>
                            <span style={{ paddingLeft: '4px', paddingRight: '4px', color: '#ef4444', fontWeight: 'bold' }}>:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '40px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {endMin || '00'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Số ngày nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', width: '80px', textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>
                                {leaveRequest.totalDays}
                            </span>
                            <span style={{ whiteSpace: 'nowrap', marginLeft: '8px', color: '#ef4444', fontWeight: 'bold' }}>ngày</span>
                            <span style={{ flexGrow: 1 }} />
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Loại nghỉ:</span>
                            <span style={{ 
                                borderBottom: '1px dotted #000', 
                                flexGrow: 1, 
                                paddingLeft: '8px',
                                fontWeight: 'bold'
                            }}>
                                {leaveRequest.leaveType === 'other' ? (leaveRequest.customLeaveType || 'Khác') : getLeaveTypeLabel(leaveRequest.leaveType)}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Lý do xin nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', flexGrow: 1, paddingLeft: '8px' }}>
                                {leaveRequest.reason || '\u00A0'}
                            </span>
                        </Box>

                        <Box sx={{ display: 'flex', width: '100%', alignItems: 'flex-end', mt: 1 }}>
                            <span style={{ whiteSpace: 'nowrap' }}>Nơi nghỉ:</span>
                            <span style={{ borderBottom: '1px dotted #000', flexGrow: 1, paddingLeft: '8px' }}>
                                {leaveRequest.location || '\u00A0'}
                            </span>
                        </Box>
                    </Stack>
                </Box>

                {/* HANDOVER DETAILS */}
                <Box sx={{ mt: 1 }}>
                    <Typography sx={{ fontStyle: 'italic', mb: 1, fontFamily: "'Times New Roman', Times, serif" }}>
                        Trong thời gian nghỉ, tôi đã bàn giao công việc như sau:
                    </Typography>
                    
                    <TableContainer component={Box} sx={{ border: '1px solid #000000', borderRadius: '0px', overflow: 'hidden' }}>
                        <Table size="small" sx={{ 
                            '& td, & th': { 
                                border: '1px solid #000000', 
                                color: '#000000',
                                p: '4px 6px',
                                fontSize: '10pt',
                                fontFamily: "'Times New Roman', Times, serif",
                            } 
                        }}>
                            <TableHead sx={{ bgcolor: 'transparent' }}>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '5%', py: 0.5 }}>STT</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '40%' }}>CÔNG VIỆC</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '30%' }}>MỤC TIÊU/KẾT QUẢ</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold', width: '25%' }}>NGƯỜI NHẬN BÀN GIAO</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {fullHandovers.map((row, index) => (
                                    <TableRow key={index} sx={{ height: '26px' }}>
                                        <TableCell align="center">{index + 1}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.task}</TableCell>
                                        <TableCell sx={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{row.target}</TableCell>
                                        <TableCell align="center">{row.recipientName}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            </Stack>

            {/* Under Table Promises */}
            <Stack spacing={0.4} sx={{ mt: 1, fontSize: '11pt', lineHeight: 1.3, pl: 2 }}>
                <Typography sx={{ textIndent: '20px', textAlign: 'justify', fontFamily: "'Times New Roman', Times, serif" }}>
                    Tôi cam kết sẽ trở lại làm việc tại Công ty sau khi hết thời gian xin nghỉ nêu trên, nếu không tôi xin hoàn toàn chịu trách nhiệm.
                </Typography>
                <Typography sx={{ textIndent: '20px', fontFamily: "'Times New Roman', Times, serif" }}>
                    Kính mong Trưởng đơn vị xem xét và chấp thuận.
                </Typography>
                <Typography sx={{ textIndent: '20px', fontStyle: 'italic', fontFamily: "'Times New Roman', Times, serif" }}>
                    Trân trọng cảm ơn!
                </Typography>
            </Stack>

            {/* Bottom Signatures Layout matching image */}
            <Box sx={{ mt: 1.5, '@media print': { mt: 1.5 } }}>
                {/* Director Title Centered */}
                <Box sx={{ textAlign: 'center', width: '100%', mb: 8 }}>
                    <Typography sx={{ fontWeight: 'bold', fontSize: '11.5pt', fontFamily: "'Times New Roman', Times, serif" }}>
                        BAN GIÁM ĐỐC TRUNG TÂM
                    </Typography>
                </Box>
 
                {/* Sub signatures spaced apart */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ textAlign: 'center', width: '45%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", mb: 8 }}>
                            NGƯỜI LÀM ĐƠN
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {'\u00A0'}
                        </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'center', width: '45%' }}>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', fontFamily: "'Times New Roman', Times, serif", mb: 8 }}>
                            NGƯỜI NHẬN BÀN GIAO
                        </Typography>
                        <Typography sx={{ fontWeight: 'bold', fontSize: '11pt', textTransform: 'uppercase', fontFamily: "'Times New Roman', Times, serif" }}>
                            {'\u00A0'}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default KpiGrades;
