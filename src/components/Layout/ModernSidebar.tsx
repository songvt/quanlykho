import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import {
    Box,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Avatar,
    Collapse,
    IconButton,
} from '@mui/material';
import {
    LayoutDashboard,
    Users,
    MonitorSmartphone,
    Warehouse,
    QrCode,
    History,
    MessageSquare,
    Settings,
    Package,
    ChevronDown,
    ChevronUp,
    ChevronRight,
    LogOut,
    X,
    ShoppingCart,
    ArrowDownToLine,
    Truck,
    CornerUpLeft,
    PieChart,
    CheckSquare,
    List as ListIcon,
    ArrowRightLeft,
    FileSearch,
    AlertTriangle,
    FileText,
    TrendingDown,
    Calculator,
    CalendarCheck,
    ClipboardList,
    FileSignature,
    Target,
    Banknote,
    Calculator as CalculatorIcon,
    Mailbox,
    Bot,
    Send,
    Barcode,
    Scissors
} from 'lucide-react';
import type { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';
import { usePermission } from '../../hooks/usePermission';

const UI = {
    primary: 'var(--brand-primary)',
    primaryHover: 'var(--brand-secondary)',
    border: 'var(--border-color)',
    text: 'var(--text-primary)',
    muted: 'var(--text-secondary)',
    hover: 'var(--bg-default)',
};

const menuItemSx = (isActive: boolean, activeColor: string = UI.primary) => ({
    borderRadius: '12px',
    minHeight: 44,
    px: 2,
    py: 1,
    mb: 0.5,
    color: isActive ? activeColor : UI.muted,
    bgcolor: isActive ? 'var(--bg-default)' : 'transparent',
    transition: 'all 0.2s ease',
    '&:hover': {
        bgcolor: 'var(--bg-default)',
        color: activeColor,
        transform: 'translateX(4px)',
    },
});

const menuIconSx = (isActive: boolean, activeColor: string = UI.primary) => ({
    minWidth: 36,
    color: isActive ? activeColor : UI.muted,
    transition: 'all 0.2s ease',
});

const subItemSx = (isActive: boolean, activeColor: string = UI.primary) => ({
    borderRadius: '10px',
    minHeight: 38,
    pl: 2,
    pr: 2,
    color: isActive ? activeColor : UI.muted,
    bgcolor: isActive ? 'var(--bg-default)' : 'transparent',
    '&:hover': {
        bgcolor: 'var(--bg-default)',
        color: activeColor,
    },
});

interface ModernSidebarProps {
    isMobile: boolean;
    handleDrawerToggle: () => void;
}

const ModernSidebar: React.FC<ModernSidebarProps> = ({ isMobile, handleDrawerToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { hasPermission, hasAnyPermission } = usePermission();

    const [expandAssets, setExpandAssets] = useState(false);
    const [expandXnk, setExpandXnk] = useState(false);
    const [expandSettlement, setExpandSettlement] = useState(false);
    const [expandAdminHr, setExpandAdminHr] = useState(false);
    const [expandZalo, setExpandZalo] = useState(false);
    const [expandTrinhKy, setExpandTrinhKy] = useState(false);

    useEffect(() => {
        if (location.pathname.startsWith('/assets')) setExpandAssets(true);
        if (['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname)) setExpandSettlement(true);
        if (['/employees', '/attendance', '/attendance-summary', '/admin-requests', '/kpi-grades', '/payroll', '/bonus-penalty', '/payroll-settings', '/feedback-box'].includes(location.pathname)) setExpandAdminHr(true);
        if (location.pathname.startsWith('/zalo')) setExpandZalo(true);
        if (location.pathname.startsWith('/trinh-ky')) setExpandTrinhKy(true);
    }, [location.pathname]);

    const handleLogout = () => {
        dispatch(logoutUser());
        navigate('/login');
    };

    const menuItems = useMemo(() => [
        ...(profile?.role === 'admin' || (profile?.role === 'staff' && (!profile.permissions || profile.permissions.length === 0)) ? [
            { text: 'Trang chủ', icon: <LayoutDashboard size={20} />, path: '/' }
        ] : []),
        ...(profile?.role === 'admin' || profile?.role === 'manager' || hasPermission('employees.view') ? [
            { text: 'Hành chính', icon: <Users size={20} color="#10B981" />, path: '/admin-hr' }
        ] : []),
        ...(hasAnyPermission(['assets.view', 'assets.manage', 'assets.list_only', '*']) ? [
            { text: 'Tài sản', icon: <MonitorSmartphone size={20} />, path: '/assets' }
        ] : []),
        ...(hasAnyPermission(['inventory.view', 'audit.view', 'audit.create', 'inbound.view', 'orders.create', 'orders.view_own', 'outbound.view', 'returns.view', 'returns.create', 'reports.view_all', 'reports.handover']) ? [
            { text: 'Xuất nhập kho', icon: <Warehouse size={20} />, path: '/xnk-cdbr' }
        ] : []),
        ...(hasPermission('qr.view') ? [
            { text: 'Mã QR Code', icon: <QrCode size={20} />, path: '/qr-generator' },
            { text: 'MÃ VẠCH VHKT', icon: <Barcode size={20} color="#0d9488" />, path: '/barcode-generator' }
        ] : []),
        ...(hasPermission('qr_hcm.view') ? [
            { text: 'Mã QR Code HCM', icon: <QrCode size={20} color="#1e4b9b" />, path: '/qr-generator-hcm' }
        ] : []),
        ...(hasAnyPermission(['reports.view_all', 'reports.handover']) ? [
            { text: 'Lịch sử', icon: <History size={20} />, path: '/action-history' }
        ] : []),
        ...(profile?.role === 'admin' ? [
            { text: 'Thông báo Zalo', icon: <MessageSquare size={20} color="#0ea5e9" />, path: '/zalo' }
        ] : []),
        ...(profile?.role === 'admin' ? [
            { text: 'Thông báo hệ thống', icon: <Mailbox size={20} color="#f59e0b" />, path: '/announcements' }
        ] : []),
        { text: 'Trợ lý AI', icon: <Bot size={20} color="#2563eb" />, path: '/ai-assistant' },
        { text: 'OCR Image/PDF', icon: <FileText size={20} color="#8b5cf6" />, path: '/ocr-documents' },
        { text: 'Tách/Gộp PDF', icon: <Scissors size={20} color="#ec4899" />, path: '/pdf-tools' },
        ...(hasAnyPermission(['trinhky.create', 'trinhky.approve', 'trinhky.view', '*']) ? [
            { text: 'Trình ký nội bộ', icon: <FileSignature size={20} color="#EF4444" />, path: '/trinh-ky' }
        ] : []),
        ...(hasPermission('*') ? [
            { text: 'Thiết lập', icon: <Settings size={20} />, path: '/settings' }
        ] : []),
    ], [profile, hasPermission, hasAnyPermission]);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            bgcolor: 'var(--bg-sidebar)',
            borderRight: `1px solid ${UI.border}`,
        }}>
            {/* Logo Area */}
            <Box sx={{
                p: 2.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderBottom: `1px solid ${UI.border}`,
            }}>
                <Box sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    background: `linear-gradient(135deg, ${UI.primary} 0%, #4F46E5 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}>
                    <Package color="white" size={22} strokeWidth={2.5} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                        fontWeight: 800,
                        color: UI.text,
                        fontSize: '0.95rem',
                        lineHeight: 1.2,
                        letterSpacing: '-0.01em',
                    }}>
                        Hệ thống quản lý kho
                    </Typography>
                    <Typography sx={{
                        color: UI.muted,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                    }}>
                        Bắc Sài Gòn
                    </Typography>
                </Box>
                {isMobile && (
                    <IconButton onClick={handleDrawerToggle} size="small" sx={{ color: UI.muted }}>
                        <X size={20} />
                    </IconButton>
                )}
            </Box>

            {/* User Profile compact card */}
            <Box sx={{ px: 2, py: 2, borderBottom: `1px solid ${UI.border}` }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        bgcolor: 'var(--bg-default)',
                        border: `1px solid ${UI.border}`,
                        transition: 'all 0.2s ease',
                        '&:hover': { borderColor: UI.primary, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
                    }}
                >
                    <Avatar sx={{
                        width: 36,
                        height: 36,
                        background: UI.primary,
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: 700,
                    }}>
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            fontWeight: 700,
                            color: UI.text,
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {profile?.full_name || 'Administrator'}
                        </Typography>
                        <Typography sx={{
                            fontSize: '0.7rem',
                            color: UI.muted,
                            fontWeight: 500,
                        }}>
                            {profile?.role === 'admin' ? 'Quản trị viên' : profile?.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* Menu Items */}
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 2, px: 2 }}>
                <List disablePadding>
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;

                        // ── Expandable Assets group
                        if (item.path === '/assets') {
                            const canViewReports = hasAnyPermission(['assets.view', 'assets.manage', '*']);
                            const assetSubItems = [
                                { text: 'Danh sách tài sản', path: '/assets', icon: <ListIcon size={18} /> },
                                { text: 'Bàn giao CCDC-BHLĐ', path: '/assets/handover-bhl', icon: <ArrowRightLeft size={18} /> },
                                ...(canViewReports ? [
                                    { text: 'BC tổng hợp CCDC-TSNT', path: '/assets/report-ccdc', icon: <PieChart size={18} /> },
                                    { text: 'Chi tiết CCDC-TSNT', path: '/assets/detail-ccdc', icon: <FileSearch size={18} /> },
                                    { text: 'BC tổng hợp TBVP', path: '/assets/report-tbvp', icon: <FileText size={18} /> },
                                    { text: 'Chi tiết TBVP', path: '/assets/detail-tbvp', icon: <FileSearch size={18} /> },
                                    { text: 'BC CCDC-TBVP hỏng', path: '/assets/broken-report', icon: <AlertTriangle size={18} /> },
                                ] : []),
                            ];
                            const isGroupActive = location.pathname.startsWith('/assets');
                            return (
                                <React.Fragment key="assets-group">
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            onClick={() => setExpandAssets(p => !p)}
                                            sx={menuItemSx(isGroupActive)}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive)}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandAssets ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandAssets} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5, mt: 0.5 }}>
                                            {assetSubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); if(isMobile) handleDrawerToggle(); }}
                                                            sx={subItemSx(subActive)}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? UI.primary : UI.muted }}>
                                                                {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 600 : 400 }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </React.Fragment>
                            );
                        }

                        // ── Expandable Xuất nhập kho group
                        if (item.path === '/xnk-cdbr') {
                            const xnkSubItems = [
                                ...(hasPermission('orders.create') || hasPermission('orders.view_own') ? [{ text: 'Đặt hàng', path: '/orders', icon: <ShoppingCart size={18} /> }] : []),
                                ...(hasPermission('outbound.view') ? [{ text: 'Xuất kho', path: '/outbound', icon: <Truck size={18} /> }] : []),
                                ...(hasAnyPermission(['returns.view', 'returns.create']) ? [{ text: 'Trả hàng', path: '/employee-returns', icon: <CornerUpLeft size={18} /> }] : []),
                                ...(hasAnyPermission(['reports.view_all', 'reports.handover']) ? [{ text: 'Báo cáo - In biên bản', path: '/reports', icon: <PieChart size={18} /> }] : []),
                                ...(hasPermission('inventory.view') ? [{ text: 'Hàng hóa', path: '/products', icon: <Package size={18} /> }] : []),
                                ...(hasAnyPermission(['audit.view', 'audit.create']) ? [{ text: 'Kiểm kê kho', path: '/audit', icon: <CheckSquare size={18} /> }] : []),
                                ...(hasAnyPermission(['audit.view', 'audit.create']) ? [{ text: 'Quyết toán', path: '/settlement', icon: <PieChart size={18} /> }] : []),
                                ...(hasPermission('inbound.view') ? [{ text: 'Nhập kho', path: '/inbound', icon: <ArrowDownToLine size={18} /> }] : []),
                            ];

                            const settlementSubItems = [
                                { text: 'Báo cáo 17 - XNT', path: '/inventory-report', icon: <FileText size={18} /> },
                                { text: 'Báo cáo Xuất trong kỳ', path: '/detailed-outbound-report', icon: <TrendingDown size={18} /> },
                                { text: 'Quyết toán vật tư', path: '/monthly-settlement', icon: <Calculator size={18} /> },
                                { text: 'Quyết toán hàng hóa', path: '/goods-settlement', icon: <Calculator size={18} /> },
                            ];
                            const isSettlementGroupActive = ['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname);
                            const isGroupActive = xnkSubItems.some(sub => location.pathname === sub.path) || isSettlementGroupActive;
                            
                            return (
                                <React.Fragment key="xnk-group">
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            onClick={() => setExpandXnk(p => !p)}
                                            sx={menuItemSx(isGroupActive)}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive)}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandXnk ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandXnk} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5, mt: 0.5 }}>
                                            {xnkSubItems.map(sub => {
                                                if (sub.path === '/settlement') {
                                                    return (
                                                        <React.Fragment key="settlement-sub-group">
                                                            <ListItem disablePadding sx={{ mb: 0.5 }}>
                                                                <ListItemButton
                                                                    onClick={() => setExpandSettlement(p => !p)}
                                                                    sx={subItemSx(isSettlementGroupActive)}
                                                                >
                                                                    <ListItemIcon sx={{ minWidth: 32, color: isSettlementGroupActive ? UI.primary : UI.muted }}>
                                                                        {sub.icon}
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={sub.text}
                                                                        primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: isSettlementGroupActive ? 600 : 400 }}
                                                                    />
                                                                    {expandSettlement ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                </ListItemButton>
                                                            </ListItem>
                                                            <Collapse in={expandSettlement} timeout="auto" unmountOnExit>
                                                                <List disablePadding sx={{ pl: 1.5 }}>
                                                                    {settlementSubItems.map(sSub => {
                                                                        const sSubActive = location.pathname === sSub.path;
                                                                        return (
                                                                            <ListItem key={sSub.path} disablePadding sx={{ mb: 0.5 }}>
                                                                                <ListItemButton
                                                                                    onClick={() => { navigate(sSub.path); if(isMobile) handleDrawerToggle(); }}
                                                                                    sx={subItemSx(sSubActive)}
                                                                                >
                                                                                    <ListItemIcon sx={{ minWidth: 32, color: sSubActive ? UI.primary : UI.muted }}>
                                                                                        {sSub.icon}
                                                                                    </ListItemIcon>
                                                                                    <ListItemText
                                                                                        primary={sSub.text}
                                                                                        primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: sSubActive ? 600 : 400 }}
                                                                                    />
                                                                                </ListItemButton>
                                                                            </ListItem>
                                                                        );
                                                                    })}
                                                                </List>
                                                            </Collapse>
                                                        </React.Fragment>
                                                    );
                                                }
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); if(isMobile) handleDrawerToggle(); }}
                                                            sx={subItemSx(subActive)}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? UI.primary : UI.muted }}>
                                                                {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 600 : 400 }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </React.Fragment>
                            );
                        }

                        // ── Expandable Admin/HR group
                        if (item.path === '/admin-hr') {
                            const adminHrSubItems = [
                                ...(hasPermission('employees.view') ? [{ text: 'Nhân viên', path: '/employees', icon: <Users size={18} /> }] : []),
                                ...(profile?.role === 'admin' || profile?.role === 'manager' ? [
                                    { text: 'Chấm công', path: '/attendance', icon: <CalendarCheck size={18} /> },
                                    { text: 'Tổng hợp chấm công', path: '/attendance-summary', icon: <ClipboardList size={18} /> },
                                    { text: 'Phiếu hành chính', path: '/admin-requests', icon: <FileSignature size={18} /> },
                                    { text: 'Chấm điểm KPI', path: '/kpi-grades', icon: <Target size={18} /> },
                                    { text: 'Bảng lương', path: '/payroll', icon: <Banknote size={18} /> },
                                    { text: 'Điểm cộng trừ', path: '/bonus-penalty', icon: <CalculatorIcon size={18} /> },
                                    { text: 'Thiết lập công lương', path: '/payroll-settings', icon: <Settings size={18} /> },
                                    { text: 'Hòm thư góp ý', path: '/feedback-box', icon: <Mailbox size={18} /> },
                                ] : [])
                            ];
                            const isGroupActive = ['/employees', '/attendance', '/attendance-summary', '/admin-requests', '/kpi-grades', '/payroll', '/bonus-penalty', '/payroll-settings', '/feedback-box'].includes(location.pathname);
                            return (
                                <React.Fragment key="admin-hr-group">
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            onClick={() => setExpandAdminHr(p => !p)}
                                            sx={menuItemSx(isGroupActive, '#10B981')}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive, '#10B981')}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandAdminHr ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandAdminHr} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5, mt: 0.5 }}>
                                            {adminHrSubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); if(isMobile) handleDrawerToggle(); }}
                                                            sx={subItemSx(subActive, '#10B981')}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? '#10B981' : UI.muted }}>
                                                                {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 600 : 400 }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </React.Fragment>
                            );
                        }

                        // ── Expandable Zalo Notification group
                        if (item.path === '/zalo') {
                            const zaloSubItems = [
                                { text: 'Quản lý Bot', path: '/zalo/contacts', icon: <Bot size={18} /> },
                                { text: 'Chiến dịch gửi', path: '/zalo/campaigns', icon: <Send size={18} /> },
                                { text: 'Lịch sử gửi', path: '/zalo/logs', icon: <History size={18} /> }
                            ];
                            const isGroupActive = location.pathname.startsWith('/zalo');
                            return (
                                <React.Fragment key="zalo-group">
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            onClick={() => setExpandZalo(p => !p)}
                                            sx={menuItemSx(isGroupActive, '#0ea5e9')}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive, '#0ea5e9')}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandZalo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandZalo} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5, mt: 0.5 }}>
                                            {zaloSubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); if(isMobile) handleDrawerToggle(); }}
                                                            sx={subItemSx(subActive, '#0ea5e9')}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? '#0ea5e9' : UI.muted }}>
                                                                {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 600 : 400 }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </React.Fragment>
                            );
                        }

                        // ── Expandable Trình ký nội bộ group
                        if (item.path === '/trinh-ky') {
                            const trinhKySubItems = [
                                ...(hasAnyPermission(['trinhky.create', '*']) ? [{ text: 'Tạo trình ký mới', path: '/trinh-ky/create', icon: <FileSignature size={18} /> }] : []),
                                { text: 'Quản lý hồ sơ trình ký', path: '/trinh-ky/list', icon: <ListIcon size={18} /> },
                                { text: 'Hồ sơ chờ ký', path: '/trinh-ky/pending', icon: <CheckSquare size={18} /> },
                                { text: 'Hồ sơ đã xử lý', path: '/trinh-ky/processed', icon: <History size={18} /> },
                                { text: 'Báo cáo thống kê', path: '/trinh-ky/report', icon: <PieChart size={18} /> }
                            ];
                            const isGroupActive = location.pathname.startsWith('/trinh-ky');
                            return (
                                <React.Fragment key="trinhky-group">
                                    <ListItem disablePadding>
                                        <ListItemButton
                                            onClick={() => setExpandTrinhKy(p => !p)}
                                            sx={menuItemSx(isGroupActive, '#EF4444')}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive, '#EF4444')}>
                                                {item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandTrinhKy ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandTrinhKy} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5, mt: 0.5 }}>
                                            {trinhKySubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); if(isMobile) handleDrawerToggle(); }}
                                                            sx={subItemSx(subActive, '#EF4444')}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? '#EF4444' : UI.muted }}>
                                                                 {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 600 : 400 }}
                                                            />
                                                        </ListItemButton>
                                                    </ListItem>
                                                );
                                            })}
                                        </List>
                                    </Collapse>
                                </React.Fragment>
                            );
                        }

                        // ── Default menu item
                        return (
                            <ListItem key={item.text} disablePadding>
                                <ListItemButton
                                    onClick={() => { navigate(item.path); if(isMobile) handleDrawerToggle(); }}
                                    sx={menuItemSx(isActive)}
                                >
                                    <ListItemIcon sx={menuIconSx(isActive)}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.875rem' }}
                                    />
                                    {isActive && (
                                        <Box sx={{ width: 4, height: 24, borderRadius: 2, bgcolor: UI.primary, ml: 'auto' }} />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            {/* Bottom logout */}
            <Box sx={{ p: 2, borderTop: `1px solid ${UI.border}` }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: '12px',
                        py: 1.5,
                        color: 'var(--brand-danger)',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 32, color: 'inherit' }}>
                        <LogOut size={20} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Đăng xuất"
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem', color: 'inherit' }}
                    />
                </ListItemButton>
            </Box>
        </Box>
    );
};

export default ModernSidebar;
