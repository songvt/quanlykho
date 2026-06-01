import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';
import { fetchTransactionsForce } from '../../store/slices/transactionsSlice';
import { fetchEmployees } from '../../store/slices/employeesSlice';
import { usePermission } from '../../hooks/usePermission';
import {
    AppBar,
    Box,
    CssBaseline,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    Badge,
    Collapse,
    BottomNavigation,
    BottomNavigationAction,
    SwipeableDrawer,
    useMediaQuery,
    useTheme,
    Chip,
} from '@mui/material';
import {
    Menu as MenuIcon,
    DashboardOutlined as DashboardIcon,
    Inventory2Outlined as InventoryIcon,
    ShoppingCartOutlined as OrderIcon,
    KeyboardReturnOutlined as InputIcon,
    LocalShippingOutlined as OutputIcon,
    PeopleOutline as PeopleIcon,
    Logout as LogoutIcon,
    PersonOutline as PersonIcon,
    SettingsOutlined as SettingsIcon,
    AssessmentOutlined as AssessmentIcon,
    AssignmentReturnOutlined as ReturnIcon,
    NotificationsNoneOutlined as NotificationsIcon,
    ExpandMore as ExpandMoreIcon,
    Business as BusinessIcon,
    QrCode2 as QrCode2Icon,
    HistoryOutlined as HistoryIcon,
    FactCheckOutlined as FactCheckIcon,
    DevicesOther as DevicesOtherIcon,
    ExpandLess as ExpandLessIcon,
    ChevronRight as ChevronRightIcon,
    BarChart as BarChartIcon,
    HomeOutlined as HomeIcon,
    Close as CloseIcon,
    AppsOutlined as AppsIcon,
    WarehouseOutlined as WarehouseIcon,
} from '@mui/icons-material';
import AIChatbot from '../Chatbot/AIChatbot';

const DRAWER_WIDTH = 268;
const UI = {
    primary: '#1d4ed8',
    primaryHover: '#1e40af',
    primarySoft: '#eff6ff',
    border: '#e5e7eb',
    pageBg: '#f6f8fb',
    text: '#0f172a',
    muted: '#64748b',
    hover: '#f8fafc',
};

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(muiTheme.breakpoints.between('sm', 'md'));

    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: transactions } = useSelector((state: RootState) => state.transactions);

    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [expandAssets, setExpandAssets] = useState(false);
    const [expandXnk, setExpandXnk] = useState(false);
    const [expandSettlement, setExpandSettlement] = useState(false);
    const [expandAdminHr, setExpandAdminHr] = useState(false);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

    // Auto-expand menu groups based on current URL
    useEffect(() => {
        if (location.pathname.startsWith('/assets')) setExpandAssets(true);
        if (['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname)) setExpandSettlement(true);
        if (['/employees', '/attendance', '/attendance-summary', '/admin-requests', '/kpi-grades', '/payroll', '/bonus-penalty', '/payroll-settings', '/feedback-box'].includes(location.pathname)) setExpandAdminHr(true);
    }, [location.pathname]);

    // Close drawer on navigation (mobile)
    useEffect(() => {
        if (isMobile) setMobileOpen(false);
    }, [location.pathname, isMobile]);

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    const handleNotificationOpen = (event: React.MouseEvent<HTMLElement>) => setNotificationAnchorEl(event.currentTarget);
    const handleNotificationClose = () => setNotificationAnchorEl(null);

    const recentNotifications = (Array.isArray(transactions) ? transactions : []).slice(0, 5).map(t => ({
        id: t.id,
        text: `${t.type === 'inbound' ? 'Nhập' : 'Xuất'} ${t.quantity} ${t.product_name}`,
        time: new Date(t.created_at || t.date || '').toLocaleTimeString('vi-VN'),
    }));

    const authStatus = useSelector((state: RootState) => state.auth.status);
    useEffect(() => {
        if (!profile && authStatus !== 'loading') navigate('/login');
    }, [profile, authStatus, navigate]);

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const { hasPermission, hasAnyPermission } = usePermission();

    const menuItems = useMemo(() => [
        ...(profile?.role === 'admin' || (profile?.role === 'staff' && (!profile.permissions || profile.permissions.length === 0)) ? [
            { text: 'Trang chủ', icon: <DashboardIcon />, path: '/' }
        ] : []),
        // ── Hành chính: nằm ngay sau Trang chủ ──
        ...(profile?.role === 'admin' || profile?.role === 'manager' || hasPermission('employees.view') ? [
            { text: 'Hành chính', icon: <PeopleIcon sx={{ color: '#059669' }} />, path: '/admin-hr' }
        ] : []),
        ...(hasAnyPermission(['assets.view', 'assets.manage', 'assets.list_only', '*']) ? [
            { text: 'Tài sản', icon: <DevicesOtherIcon />, path: '/assets' }
        ] : []),
        ...(hasAnyPermission(['inventory.view', 'audit.view', 'audit.create', 'inbound.view', 'orders.create', 'orders.view_own', 'outbound.view', 'returns.view', 'returns.create', 'reports.view_all', 'reports.handover']) ? [
            { text: 'Xuất nhập kho', icon: <WarehouseIcon />, path: '/xnk-cdbr' }
        ] : []),
        ...(hasPermission('qr.view') ? [
            { text: 'Tạo QR code', icon: <QrCode2Icon />, path: '/qr-generator' }
        ] : []),
        ...(hasPermission('qr_hcm.view') ? [
            { text: 'QR HCM', icon: <QrCode2Icon sx={{ color: '#1e4b9b' }} />, path: '/qr-generator-hcm' }
        ] : []),
        ...(hasAnyPermission(['reports.view_all', 'reports.handover']) ? [
            { text: 'Lịch sử', icon: <HistoryIcon />, path: '/action-history' }
        ] : []),
        ...(hasPermission('*') ? [
            { text: 'Thiết lập', icon: <SettingsIcon />, path: '/settings' }
        ] : []),
    ], [profile, hasPermission, hasAnyPermission]);

    // Bottom navigation items (top 5 most important for mobile)
    const bottomNavItems = useMemo(() => {
        const items = [];
        if (profile?.role === 'admin' || profile?.role === 'staff') items.push({ label: 'Trang chủ', icon: <HomeIcon />, path: '/' });
        if (hasPermission('inbound.view')) items.push({ label: 'Nhập kho', icon: <InputIcon />, path: '/inbound' });
        if (hasPermission('outbound.view')) items.push({ label: 'Xuất kho', icon: <OutputIcon />, path: '/outbound' });
        if (hasPermission('inventory.view')) items.push({ label: 'Hàng hóa', icon: <InventoryIcon />, path: '/products' });
        if (hasPermission('orders.create') || hasPermission('orders.view_own')) items.push({ label: 'Đặt hàng', icon: <OrderIcon />, path: '/orders' });
        // Always add "More" button
        items.push({ label: 'Thêm', icon: <AppsIcon />, path: '__menu__' });
        return items.slice(0, 5); // max 5 items
    }, [profile, hasPermission]);

    // Redirect if current path is hidden for this user
    useEffect(() => {
        if (location.pathname === '/' && menuItems.length > 0 && !menuItems.find(i => i.path === '/')) {
            navigate(menuItems[0].path, { replace: true });
        }
    }, [location.pathname, menuItems, navigate]);

    const currentMenuItem = menuItems.find(item => item.path === location.pathname);

    // Get bottom nav value
    const bottomNavValue = bottomNavItems.findIndex(i => i.path === location.pathname);

    // ─── Sidebar Drawer Content ───────────────────────────────────────────────
    const drawer = (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            bgcolor: '#ffffff',
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
                    borderRadius: '8px',
                    background: UI.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: 'none',
                    flexShrink: 0,
                }}>
                    <InventoryIcon sx={{ color: 'white', fontSize: 22 }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                        fontWeight: 700,
                        color: UI.text,
                        fontSize: '0.95rem',
                        lineHeight: 1.2,
                        letterSpacing: '-0.3px',
                    }}>
                        QUẢN LÝ KHO
                    </Typography>
                    <Typography sx={{
                        color: '#94a3b8',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}>
                        Hệ thống kho GGS
                    </Typography>
                </Box>
                {/* Close button only on mobile */}
                {isMobile && (
                    <IconButton
                        onClick={handleDrawerToggle}
                        size="small"
                        sx={{ color: '#94a3b8', minWidth: 36, minHeight: 36 }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                )}
            </Box>

            {/* User Profile compact card */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${UI.border}` }}>
                <Box
                    onClick={handleMenuOpen}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'background-color 0.16s ease, border-color 0.16s ease',
                        bgcolor: UI.hover,
                        border: `1px solid ${UI.border}`,
                        '&:hover': { bgcolor: '#f1f5f9' },
                    }}
                >
                    <Avatar sx={{
                        width: 36,
                        height: 36,
                        background: UI.primary,
                        color: 'white',
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        boxShadow: 'none',
                        flexShrink: 0,
                    }}>
                        {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{
                            fontWeight: 700,
                            color: '#0f172a',
                            fontSize: '0.85rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {profile?.full_name || 'Administrator'}
                        </Typography>
                        <Typography sx={{
                            fontSize: '0.7rem',
                            color: '#64748b',
                            fontWeight: 500,
                        }}>
                            {profile?.role === 'admin' ? 'Quản trị viên' : profile?.role === 'manager' ? 'Quản lý' : 'Nhân viên kho'}
                        </Typography>
                    </Box>
                    <ExpandMoreIcon sx={{ color: '#94a3b8', fontSize: 18, flexShrink: 0 }} />
                </Box>
            </Box>

            {/* Menu Items */}
            <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1.5, px: 1.5 }}>
                <List disablePadding>
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;

                        // ── Expandable Assets group
                        if (item.path === '/assets') {
                            const canViewReports = hasAnyPermission(['assets.view', 'assets.manage', '*']);
                            const assetSubItems = [
                                { text: 'Danh sách tài sản', path: '/assets' },
                                { text: 'Bàn giao CCDC-BHLĐ', path: '/assets/handover-bhl' },
                                ...(canViewReports ? [
                                    { text: 'BC tổng hợp CCDC-TSNT', path: '/assets/report-ccdc' },
                                    { text: 'Chi tiết CCDC-TSNT', path: '/assets/detail-ccdc' },
                                    { text: 'BC tổng hợp TBVP', path: '/assets/report-tbvp' },
                                    { text: 'Chi tiết TBVP', path: '/assets/detail-tbvp' },
                                    { text: 'BC CCDC-TBVP hỏng', path: '/assets/broken-report' },
                                ] : []),
                            ];
                            const isGroupActive = location.pathname.startsWith('/assets');
                            return (
                                <React.Fragment key="assets-group">
                                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton
                                            onClick={() => setExpandAssets(p => !p)}
                                            selected={isGroupActive && !expandAssets}
                                            sx={menuItemSx(isGroupActive)}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive)}>
                                                {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } })}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandAssets
                                                ? <ExpandLessIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                                : <ChevronRightIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandAssets} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5 }}>
                                            {assetSubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); setMobileOpen(false); }}
                                                            selected={subActive}
                                                            sx={subItemSx(subActive)}
                                                        >
                                                            <Box sx={{
                                                                width: 6, height: 6, borderRadius: '50%', mr: 1.5, flexShrink: 0,
                                                                bgcolor: subActive ? '#2563eb' : '#cbd5e1'
                                                            }} />
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 700 : 400, color: subActive ? '#2563eb' : '#475569' }}
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
                                ...(hasPermission('orders.create') || hasPermission('orders.view_own') ? [{ text: 'Đặt hàng', path: '/orders', icon: <OrderIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasPermission('outbound.view') ? [{ text: 'Xuất kho', path: '/outbound', icon: <OutputIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasAnyPermission(['returns.view', 'returns.create']) ? [{ text: 'Trả hàng', path: '/employee-returns', icon: <ReturnIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasAnyPermission(['reports.view_all', 'reports.handover']) ? [{ text: 'Báo cáo', path: '/reports', icon: <AssessmentIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasPermission('inventory.view') ? [{ text: 'Hàng hóa', path: '/products', icon: <InventoryIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasAnyPermission(['audit.view', 'audit.create']) ? [{ text: 'Kiểm kê kho', path: '/audit', icon: <FactCheckIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasAnyPermission(['audit.view', 'audit.create']) ? [{ text: 'Quyết toán', path: '/settlement', icon: <AssessmentIcon sx={{fontSize: 20}} /> }] : []),
                                ...(hasPermission('inbound.view') ? [{ text: 'Nhập kho', path: '/inbound', icon: <InputIcon sx={{fontSize: 20}} /> }] : []),
                            ];

                            const settlementSubItems = [
                                { text: 'Báo cáo 17 - XNT', path: '/inventory-report' },
                                { text: 'Báo cáo Xuất trong kỳ', path: '/detailed-outbound-report' },
                                { text: 'Quyết toán vật tư', path: '/monthly-settlement' },
                                { text: 'Quyết toán hàng hóa', path: '/goods-settlement' },
                            ];
                            const isSettlementGroupActive = ['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname);

                            const isGroupActive = xnkSubItems.some(sub => location.pathname === sub.path) || isSettlementGroupActive;
                            
                            return (
                                <React.Fragment key="xnk-group">
                                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton
                                            onClick={() => setExpandXnk(p => !p)}
                                            selected={isGroupActive && !expandXnk}
                                            sx={menuItemSx(isGroupActive)}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive)}>
                                                {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } })}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandXnk
                                                ? <ExpandLessIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                                : <ChevronRightIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandXnk} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5 }}>
                                            {xnkSubItems.map(sub => {
                                                if (sub.path === '/settlement') {
                                                    return (
                                                        <React.Fragment key="settlement-sub-group">
                                                            <ListItem disablePadding sx={{ mb: 0.5 }}>
                                                                <ListItemButton
                                                                    onClick={() => setExpandSettlement(p => !p)}
                                                                    selected={isSettlementGroupActive && !expandSettlement}
                                                                    sx={subItemSx(isSettlementGroupActive)}
                                                                >
                                                                    <ListItemIcon sx={{ minWidth: 32, color: isSettlementGroupActive ? '#2563eb' : '#64748b' }}>
                                                                        {sub.icon}
                                                                    </ListItemIcon>
                                                                    <ListItemText
                                                                        primary={sub.text}
                                                                        primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: isSettlementGroupActive ? 700 : 500, color: isSettlementGroupActive ? '#2563eb' : '#475569' }}
                                                                    />
                                                                    {expandSettlement
                                                                        ? <ExpandLessIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                                                                        : <ChevronRightIcon sx={{ fontSize: 14, color: '#94a3b8' }} />}
                                                                </ListItemButton>
                                                            </ListItem>
                                                            <Collapse in={expandSettlement} timeout="auto" unmountOnExit>
                                                                <List disablePadding sx={{ pl: 1.5 }}>
                                                                    {settlementSubItems.map(sSub => {
                                                                        const sSubActive = location.pathname === sSub.path;
                                                                        return (
                                                                            <ListItem key={sSub.path} disablePadding sx={{ mb: 0.5 }}>
                                                                                <ListItemButton
                                                                                    onClick={() => { navigate(sSub.path); setMobileOpen(false); }}
                                                                                    selected={sSubActive}
                                                                                    sx={subItemSx(sSubActive)}
                                                                                >
                                                                                    <Box sx={{
                                                                                        width: 4, height: 4, borderRadius: '50%', mr: 1.5, flexShrink: 0,
                                                                                        bgcolor: sSubActive ? '#2563eb' : '#cbd5e1'
                                                                                    }} />
                                                                                    <ListItemText
                                                                                        primary={sSub.text}
                                                                                        primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: sSubActive ? 700 : 400, color: sSubActive ? '#2563eb' : '#475569' }}
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
                                                            onClick={() => { navigate(sub.path); setMobileOpen(false); }}
                                                            selected={subActive}
                                                            sx={subItemSx(subActive)}
                                                        >
                                                            <ListItemIcon sx={{ minWidth: 32, color: subActive ? '#2563eb' : '#64748b' }}>
                                                                {sub.icon}
                                                            </ListItemIcon>
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 700 : 500, color: subActive ? '#2563eb' : '#475569' }}
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
                                ...(hasPermission('employees.view') ? [{ text: 'Nhân viên', path: '/employees' }] : []),
                                ...(profile?.role === 'admin' || profile?.role === 'manager' ? [
                                    { text: 'Chấm công', path: '/attendance' },
                                    { text: 'Tổng hợp chấm công', path: '/attendance-summary' },
                                    { text: 'Phiếu hành chính', path: '/admin-requests' },
                                    { text: 'Chấm điểm KPI', path: '/kpi-grades' },
                                    { text: 'Bảng lương', path: '/payroll' },
                                    { text: 'Điểm cộng trừ', path: '/bonus-penalty' },
                                    { text: 'Thiết lập công lương', path: '/payroll-settings' },
                                    { text: 'Hòm thư góp ý', path: '/feedback-box' },
                                ] : [])
                            ];
                            const isGroupActive = ['/employees', '/attendance', '/attendance-summary', '/admin-requests', '/kpi-grades', '/payroll', '/bonus-penalty', '/payroll-settings', '/feedback-box'].includes(location.pathname);
                            return (
                                <React.Fragment key="admin-hr-group">
                                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                                        <ListItemButton
                                            onClick={() => setExpandAdminHr(p => !p)}
                                            selected={isGroupActive && !expandAdminHr}
                                            sx={menuItemSx(isGroupActive, '#059669')}
                                        >
                                            <ListItemIcon sx={menuIconSx(isGroupActive, '#059669')}>
                                                {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } }) : item.icon}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={item.text}
                                                primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                            />
                                            {expandAdminHr
                                                ? <ExpandLessIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
                                                : <ChevronRightIcon sx={{ fontSize: 16, color: '#94a3b8' }} />}
                                        </ListItemButton>
                                    </ListItem>
                                    <Collapse in={expandAdminHr} timeout="auto" unmountOnExit>
                                        <List disablePadding sx={{ pl: 1.5, mb: 0.5 }}>
                                            {adminHrSubItems.map(sub => {
                                                const subActive = location.pathname === sub.path;
                                                return (
                                                    <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                        <ListItemButton
                                                            onClick={() => { navigate(sub.path); setMobileOpen(false); }}
                                                            selected={subActive}
                                                            sx={subItemSx(subActive, '#059669')}
                                                        >
                                                            <Box sx={{
                                                                width: 6, height: 6, borderRadius: '50%', mr: 1.5, flexShrink: 0,
                                                                bgcolor: subActive ? '#059669' : '#cbd5e1'
                                                            }} />
                                                            <ListItemText
                                                                primary={sub.text}
                                                                primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 700 : 400, color: subActive ? '#059669' : '#475569' }}
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
                            <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={() => { navigate(item.path); setMobileOpen(false); }}
                                    selected={isActive}
                                    sx={menuItemSx(isActive)}
                                >
                                    <ListItemIcon sx={menuIconSx(isActive)}>
                                        {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } })}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{ fontWeight: isActive ? 700 : 500, fontSize: '0.875rem' }}
                                    />
                                    {isActive && (
                                        <Box sx={{
                                            width: 4, height: 18, borderRadius: 2,
                                            bgcolor: '#2563eb', flexShrink: 0
                                        }} />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

            {/* Bottom logout */}
            <Box sx={{ p: 1.5, borderTop: '1px solid #f1f5f9' }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: '10px',
                        py: 1.25,
                        color: '#ef4444',
                        '&:hover': { bgcolor: '#fef2f2' },
                        '&:active': { transform: 'scale(0.98)' },
                    }}
                >
                    <ListItemIcon sx={{ minWidth: 32, color: '#ef4444' }}>
                        <LogoutIcon sx={{ fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Đăng xuất"
                        primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem', color: '#ef4444' }}
                    />
                </ListItemButton>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', minHeight: '100svh' }}>
            <CssBaseline />

            {/* ── AppBar (Header) ── */}
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
                    ml: { sm: `${DRAWER_WIDTH}px` },
                    bgcolor: 'rgba(255,255,255,0.98)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    color: UI.text,
                    borderBottom: `1px solid ${UI.border}`,
                    boxShadow: 'none',
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    '@media print': { display: 'none' },
                }}
                elevation={0}
            >
                <Toolbar sx={{
                    justifyContent: 'space-between',
                    minHeight: { xs: '56px !important', sm: '60px !important' },
                    px: { xs: 1.5, sm: 3 },
                    gap: 1,
                }}>
                    {/* Left: Hamburger + Title */}
                    <Box display="flex" alignItems="center" gap={1} sx={{ flex: 1, minWidth: 0 }}>
                        {/* Hamburger - visible on all sizes for tablet, only mobile */}
                        <IconButton
                            color="inherit"
                            aria-label="Mở menu"
                            onClick={handleDrawerToggle}
                            sx={{
                                display: { sm: 'none' },
                                color: '#475569',
                                minWidth: 40,
                                minHeight: 40,
                                borderRadius: '8px',
                                '&:hover': { bgcolor: UI.hover },
                            }}
                        >
                            <MenuIcon sx={{ fontSize: 22 }} />
                        </IconButton>

                        {/* Page Title (mobile) */}
                        <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', minWidth: 0 }}>
                            <Typography sx={{
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                {currentMenuItem?.text || 'Quản lý kho'}
                            </Typography>
                        </Box>

                        {/* Breadcrumb (desktop) */}
                        <Box sx={{ display: { xs: 'none', sm: 'flex' }, flexDirection: 'column' }}>
                            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, lineHeight: 1 }}>
                                Hệ thống quản lý kho
                            </Typography>
                            <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                                {currentMenuItem?.text || 'Trang chủ'}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Right: Actions */}
                    <Box display="flex" alignItems="center" gap={0.5}>
                        {/* Notifications */}
                        <IconButton
                            onClick={handleNotificationOpen}
                            sx={{
                                color: '#64748b',
                                minWidth: 40,
                                minHeight: 40,
                                borderRadius: '8px',
                                '&:hover': { bgcolor: UI.hover, color: UI.text },
                            }}
                        >
                            <Badge
                                badgeContent={recentNotifications.length}
                                color="error"
                                sx={{
                                    '& .MuiBadge-badge': {
                                        fontSize: '0.6rem',
                                        minWidth: 16,
                                        height: 16,
                                        top: 2,
                                        right: 2,
                                    }
                                }}
                            >
                                <NotificationsIcon sx={{ fontSize: 22 }} />
                            </Badge>
                        </IconButton>

                        {/* User Avatar (desktop shows full, mobile icon only) */}
                        <Box
                            onClick={handleMenuOpen}
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                cursor: 'pointer',
                                py: 0.5,
                                px: { xs: 0.5, sm: 1 },
                                borderRadius: '8px',
                                transition: 'background-color 0.16s ease',
                                '&:hover': { bgcolor: UI.hover },
                                '&:active': { transform: 'scale(0.96)' },
                            }}
                        >
                            <Avatar sx={{
                                width: 34,
                                height: 34,
                                background: UI.primary,
                                color: 'white',
                                fontSize: '0.825rem',
                                fontWeight: 700,
                                boxShadow: 'none',
                            }}>
                                {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                            </Avatar>
                            <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
                                    {profile?.full_name?.split(' ').slice(-1)[0] || 'Admin'}
                                </Typography>
                                <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>
                                    {profile?.role === 'admin' ? 'Admin' : profile?.role === 'manager' ? 'Manager' : 'Staff'}
                                </Typography>
                            </Box>
                            <ExpandMoreIcon sx={{ color: '#94a3b8', fontSize: 16, display: { xs: 'none', md: 'block' } }} />
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* ── User Profile Menu ── */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        width: 200,
                        borderRadius: '14px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)',
                        mt: 1,
                        overflow: 'visible',
                        '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                            borderTop: '1px solid #e2e8f0',
                            borderLeft: '1px solid #e2e8f0',
                        },
                    },
                }}
            >
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        {profile?.full_name || 'Administrator'}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {profile?.email || ''}
                    </Typography>
                </Box>
                <Box sx={{ p: 0.5 }}>
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ borderRadius: '8px', py: 1.25, fontSize: '0.875rem' }}>
                        <ListItemIcon><PersonIcon fontSize="small" sx={{ color: '#64748b' }} /></ListItemIcon>
                        Hồ sơ cá nhân
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); navigate('/change-password'); }} sx={{ borderRadius: '8px', py: 1.25, fontSize: '0.875rem' }}>
                        <ListItemIcon><SettingsIcon fontSize="small" sx={{ color: '#64748b' }} /></ListItemIcon>
                        Đổi mật khẩu
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                    <MenuItem onClick={handleLogout} sx={{ borderRadius: '8px', color: '#ef4444', py: 1.25, fontSize: '0.875rem' }}>
                        <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
                        Đăng xuất
                    </MenuItem>
                </Box>
            </Menu>

            {/* ── Notification Menu ── */}
            <Menu
                anchorEl={notificationAnchorEl}
                open={Boolean(notificationAnchorEl)}
                onClose={handleNotificationClose}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        width: { xs: 300, sm: 340 },
                        maxHeight: 400,
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 20px 40px -8px rgba(0,0,0,0.12)',
                        mt: 1,
                    }
                }}
            >
                <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Thông báo</Typography>
                    <Chip label={`${recentNotifications.length} mới`} size="small" color="primary" sx={{ height: 22, fontSize: '0.7rem' }} />
                </Box>
                {recentNotifications.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#94a3b8', fontSize: '0.875rem' }}>Chưa có thông báo</Typography>
                    </Box>
                ) : recentNotifications.map(notif => (
                    <MenuItem key={notif.id} onClick={handleNotificationClose} sx={{ px: 2.5, py: 1.5, alignItems: 'flex-start', gap: 1.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2563eb', mt: 0.6, flexShrink: 0 }} />
                        <Box>
                            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a', lineHeight: 1.4 }}>
                                {notif.text}
                            </Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>
                                {notif.time}
                            </Typography>
                        </Box>
                    </MenuItem>
                ))}
            </Menu>

            {/* ── Sidebar (Desktop: permanent, Mobile: SwipeableDrawer) ── */}
            <Box
                component="nav"
                sx={{
                    width: { sm: DRAWER_WIDTH },
                    flexShrink: { sm: 0 },
                    '@media print': { display: 'none' },
                }}
            >
                {/* Mobile SwipeableDrawer */}
                <SwipeableDrawer
                    variant="temporary"
                    open={mobileOpen}
                    onOpen={() => setMobileOpen(true)}
                    onClose={() => setMobileOpen(false)}
                    disableSwipeToOpen={false}
                    swipeAreaWidth={16}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: DRAWER_WIDTH,
                            borderRight: 'none',
                            boxShadow: '8px 0 32px rgba(0,0,0,0.12)',
                        },
                    }}
                >
                    {drawer}
                </SwipeableDrawer>

                {/* Desktop permanent Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': {
                            boxSizing: 'border-box',
                            width: DRAWER_WIDTH,
                            borderRight: '1px solid #e2e8f0',
                        },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* ── Main Content Area ── */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
                    minHeight: '100svh',
                    bgcolor: UI.pageBg,
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    '@media print': { p: 0, m: 0, width: '100%', bgcolor: 'white' },
                }}
            >
                {/* AppBar spacer */}
                <Toolbar sx={{
                    minHeight: { xs: '56px !important', sm: '60px !important' },
                    '@media print': { display: 'none' },
                }} />

                {/* Page content */}
                <Box sx={{
                    flex: 1,
                    p: { xs: 1.5, sm: 2.5, md: 3 },
                    // Add bottom padding on mobile for bottom nav
                    pb: { xs: 'calc(72px + env(safe-area-inset-bottom, 0px)) !important', sm: 3 },
                    '@media print': { p: 0 },
                }}>
                    <Outlet />
                </Box>
            </Box>

            {/* ── Mobile Bottom Navigation ── */}
            <Box
                className="mobile-bottom-nav"
                sx={{
                    display: { xs: 'block', sm: 'none' },
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: (theme) => theme.zIndex.appBar,
                    bgcolor: 'rgba(255,255,255,0.98)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderTop: `1px solid ${UI.border}`,
                    paddingBottom: 'env(safe-area-inset-bottom)',
                    boxShadow: 'none',
                    '@media print': { display: 'none !important' },
                }}
            >
                <BottomNavigation
                    value={bottomNavValue >= 0 ? bottomNavValue : false}
                    onChange={(_, newValue) => {
                        const item = bottomNavItems[newValue];
                        if (!item) return;
                        if (item.path === '__menu__') {
                            setMobileOpen(true);
                        } else {
                            navigate(item.path);
                        }
                    }}
                    sx={{
                        height: '60px',
                        bgcolor: 'transparent',
                        '& .MuiBottomNavigationAction-root': {
                            minWidth: 48,
                            maxWidth: 80,
                            padding: '6px 4px 4px',
                            color: '#94a3b8',
                            transition: 'all 0.2s',
                            '&.Mui-selected': {
                                color: '#2563eb',
                            },
                            '& .MuiBottomNavigationAction-label': {
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                mt: '2px',
                                opacity: 1,
                                '&.Mui-selected': {
                                    fontSize: '0.6rem',
                                }
                            },
                            '& .MuiSvgIcon-root': {
                                fontSize: '1.5rem',
                                transition: 'transform 0.2s',
                            },
                            '&.Mui-selected .MuiSvgIcon-root': {
                                transform: 'scale(1.1)',
                            },
                        },
                    }}
                >
                    {bottomNavItems.map((item, idx) => (
                        <BottomNavigationAction
                            key={item.path + idx}
                            label={item.label}
                            icon={
                                item.path === '__menu__'
                                    ? (
                                        <Box sx={{
                                            width: 32, height: 32, borderRadius: '10px',
                                            bgcolor: mobileOpen ? '#2563eb' : '#f1f5f9',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            transition: 'all 0.2s',
                                        }}>
                                            <AppsIcon sx={{ fontSize: '1.2rem !important', color: mobileOpen ? 'white' : '#64748b' }} />
                                        </Box>
                                    )
                                    : item.icon
                            }
                        />
                    ))}
                </BottomNavigation>
            </Box>

            {/* Global AI Chatbot */}
            <AIChatbot />
        </Box>
    );
};

// ── Style helpers ──────────────────────────────────────────────────────────────
const menuItemSx = (isActive: boolean, color = '#2563eb') => ({
    height: 40,
    borderRadius: '8px',
    color: isActive ? color : UI.muted,
    px: 1.5,
    transition: 'background-color 0.16s ease, color 0.16s ease',
    bgcolor: isActive ? `${color}12` : 'transparent',
    '&.Mui-selected': {
        bgcolor: `${color}12`,
        color,
        '&:hover': { bgcolor: `${color}12` },
    },
    '&:hover': {
        bgcolor: UI.hover,
        color: UI.text,
    },
});

const menuIconSx = (isActive: boolean, color = '#2563eb') => ({
    minWidth: 30,
    color: isActive ? color : '#94a3b8',
    transition: 'color 0.18s',
});

const subItemSx = (isActive: boolean, color = '#2563eb') => ({
    height: 36,
    borderRadius: '8px',
    color: isActive ? color : UI.muted,
    px: 1.5,
    bgcolor: isActive ? `${color}10` : 'transparent',
    '&.Mui-selected': {
        bgcolor: `${color}10`,
        '&:hover': { bgcolor: `${color}10` },
    },
    '&:hover': { bgcolor: UI.hover },
});

export default MainLayout;
