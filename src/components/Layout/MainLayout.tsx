import React, { useState, useEffect } from 'react';
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
    InputBase,
    Badge,
    Breadcrumbs,
    Collapse,
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
    Search as SearchIcon,
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
} from '@mui/icons-material';
import AIChatbot from '../Chatbot/AIChatbot';

const drawerWidth = 260; 

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: transactions } = useSelector((state: RootState) => state.transactions);

    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [expandAssets, setExpandAssets] = useState(false);
    const [expandSettlement, setExpandSettlement] = useState(false);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

    // Auto-expand menu groups based on current URL
    useEffect(() => {
        if (location.pathname.startsWith('/assets')) {
            setExpandAssets(true);
        }
        if (['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname)) {
            setExpandSettlement(true);
        }
    }, [location.pathname]);

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

    // Check if user has required profile to see anything
    // Chỉ redirect khi đã xác nhận không có session (không phải đang loading)
    const authStatus = useSelector((state: RootState) => state.auth.status);
    useEffect(() => {
        if (!profile && authStatus !== 'loading') {
            navigate('/login');
        }
    }, [profile, authStatus, navigate]);

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const { hasPermission, hasAnyPermission } = usePermission();

    const menuItems = [
        ...(profile?.role === 'admin' || (profile?.role === 'staff' && (!profile.permissions || profile.permissions.length === 0)) ? [
            { text: 'Dashboard', icon: <DashboardIcon />, path: '/' }
        ] : []),
        ...(hasAnyPermission(['assets.view', 'assets.manage', 'assets.list_only', '*']) ? [
            { text: 'Tài sản', icon: <DevicesOtherIcon />, path: '/assets' }
        ] : []),
        ...(hasPermission('inventory.view') ? [
            { text: 'Hàng hóa', icon: <InventoryIcon />, path: '/products' }
        ] : []),
        ...(hasAnyPermission(['audit.view', 'audit.create']) ? [
            { text: 'Kiểm kê kho', icon: <FactCheckIcon />, path: '/audit' }
        ] : []),
        ...(hasAnyPermission(['audit.view', 'audit.create']) ? [
            { text: 'Quyết toán', icon: <AssessmentIcon />, path: '/settlement' }
        ] : []),
        ...(hasPermission('inbound.view') ? [
            { text: 'Nhập kho', icon: <InputIcon />, path: '/inbound' }
        ] : []),
        ...(hasPermission('qr.view') ? [
            { text: 'Tạo QR code', icon: <QrCode2Icon />, path: '/qr-generator' }
        ] : []),
        ...(hasPermission('qr_hcm.view') ? [
            { text: 'Tạo QR code CN_HCM', icon: <QrCode2Icon sx={{ color: '#1e4b9b' }} />, path: '/qr-generator-hcm' }
        ] : []),
        ...(hasPermission('orders.create') || hasPermission('orders.view_own') ? [
            { text: 'Đặt hàng', icon: <OrderIcon />, path: '/orders' }
        ] : []),
        ...(hasPermission('outbound.view') ? [
            { text: 'Xuất kho', icon: <OutputIcon />, path: '/outbound' }
        ] : []),
        ...(hasAnyPermission(['returns.view', 'returns.create']) ? [
            { text: 'Trả hàng', icon: <ReturnIcon />, path: '/employee-returns' }
        ] : []),
        ...(hasAnyPermission(['reports.view_all', 'reports.handover']) ? [
            { text: 'Báo cáo', icon: <AssessmentIcon />, path: '/reports' },
            { text: 'Lịch sử tác động', icon: <HistoryIcon />, path: '/action-history' }
        ] : []),
        ...(hasPermission('employees.view') ? [
            { text: 'Nhân viên', icon: <PeopleIcon />, path: '/employees' }
        ] : []),
        ...(hasPermission('*') ? [
            { text: 'Thiết lập', icon: <SettingsIcon />, path: '/settings' }
        ] : []),
    ];

    // Redirect if current path is hidden for this user (e.g. Dashboard)
    useEffect(() => {
        if (location.pathname === '/' && menuItems.length > 0 && !menuItems.find(i => i.path === '/')) {
            const firstAvailable = menuItems[0].path;
            navigate(firstAvailable, { replace: true });
        }
    }, [location.pathname, menuItems, navigate]);

    const currentMenuItem = menuItems.find(item => item.path === location.pathname);

    const drawer = (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            bgcolor: 'white', 
            borderRight: '1px solid #e2e8f0',
            boxShadow: '4px 0 24px rgba(0,0,0,0.02)'
        }}>
            {/* Standard SaaS Logo Area */}
            <Box sx={{ 
                p: 3, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                mb: 1,
            }}>
                <Box sx={{ 
                    width: 40, 
                    height: 40, 
                    borderRadius: 2.5, 
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
                }}>
                    <DashboardIcon sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Box>
                    <Typography
                        variant="h6"
                        sx={{
                            fontWeight: 800,
                            color: '#0f172a',
                            letterSpacing: '-0.5px',
                            fontSize: '1.1rem',
                            lineHeight: 1.2
                        }}
                    >
                        QUẢN LÝ KHO
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                        Hệ thống quản lý
                    </Typography>
                </Box>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    // ── Special: expandable "Tài sản" group
                    if (item.path === '/assets') {
                        const canViewReports = hasAnyPermission(['assets.view', 'assets.manage', '*']);
                        const assetSubItems = [
                            { text: 'Danh sách tài sản', path: '/assets' },
                            { text: 'Bàn giao CCDC-BHLĐ', path: '/assets/handover-bhl' },
                            ...(canViewReports ? [
                                { text: 'Báo cáo tổng hợp CCDC-TSNT', path: '/assets/report-ccdc' },
                                { text: 'Chi tiết tài sản CCDC-TSNT', path: '/assets/detail-ccdc' },
                                { text: 'Báo cáo tổng hợp TBVP', path: '/assets/report-tbvp' },
                                { text: 'Chi tiết tài sản TBVP', path: '/assets/detail-tbvp' },
                                { text: 'Báo cáo CCDC-TBVP hỏng', path: '/assets/broken-report' },
                            ] : []),
                        ];
                        const isGroupActive = location.pathname.startsWith('/assets');
                        return (
                            <React.Fragment key="assets-group">
                                <ListItem disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => setExpandAssets(p => !p)}
                                        selected={isGroupActive}
                                        sx={{
                                            height: 44, borderRadius: '10px', color: '#64748b',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', px: 2,
                                            '&.Mui-selected': {
                                                backgroundColor: '#eff6ff', color: '#2563eb',
                                                '&:hover': { backgroundColor: '#dbeafe' },
                                                '& .MuiListItemIcon-root': { color: '#2563eb' },
                                            },
                                            '&:hover': { backgroundColor: '#f1f5f9', color: '#0f172a' },
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32, color: isGroupActive ? '#2563eb' : '#94a3b8' }}>
                                            {React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } })}
                                        </ListItemIcon>
                                        <ListItemText primary={item.text}
                                            primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                        />
                                        {expandAssets ? <ExpandLessIcon sx={{ fontSize: 18, color: '#94a3b8' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: '#94a3b8' }} />}
                                    </ListItemButton>
                                </ListItem>
                                <Collapse in={expandAssets} timeout="auto" unmountOnExit>
                                    <List disablePadding sx={{ pl: 2 }}>
                                        {assetSubItems.map(sub => {
                                            const subActive = location.pathname === sub.path;
                                            return (
                                                <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                    <ListItemButton
                                                        onClick={() => { navigate(sub.path); if (mobileOpen) setMobileOpen(false); }}
                                                        selected={subActive}
                                                        sx={{
                                                            height: 38, borderRadius: '8px', color: '#64748b', px: 1.5,
                                                            '&.Mui-selected': {
                                                                backgroundColor: '#eff6ff', color: '#2563eb',
                                                                '& .MuiListItemIcon-root': { color: '#2563eb' },
                                                            },
                                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                                        }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 26, color: subActive ? '#2563eb' : '#cbd5e1' }}>
                                                            <BarChartIcon sx={{ fontSize: 16 }} />
                                                        </ListItemIcon>
                                                        <ListItemText primary={sub.text}
                                                            primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 700 : 400 }}
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

                    // ── Special: expandable "Quyết toán" group
                    if (item.path === '/settlement') {
                        const settlementSubItems = [
                            { text: 'Báo cáo 17 - XNT', path: '/inventory-report' },
                            { text: 'Báo cáo Xuất trong kỳ', path: '/detailed-outbound-report' },
                            { text: 'Quyết toán vật tư', path: '/monthly-settlement' },
                            { text: 'Quyết toán hàng hóa', path: '/goods-settlement' },
                        ];
                        const isGroupActive = ['/inventory-report', '/detailed-outbound-report', '/monthly-settlement', '/goods-settlement'].includes(location.pathname);
                        return (
                            <React.Fragment key="settlement-group">
                                <ListItem disablePadding sx={{ mb: 0.5 }}>
                                    <ListItemButton
                                        onClick={() => setExpandSettlement(p => !p)}
                                        selected={isGroupActive}
                                        sx={{
                                            height: 44, borderRadius: '10px', color: '#64748b',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', px: 2,
                                            '&.Mui-selected': {
                                                backgroundColor: '#eff6ff', color: '#2563eb',
                                                '&:hover': { backgroundColor: '#dbeafe' },
                                                '& .MuiListItemIcon-root': { color: '#2563eb' },
                                            },
                                            '&:hover': { backgroundColor: '#f1f5f9', color: '#0f172a' },
                                        }}
                                    >
                                        <ListItemIcon sx={{ minWidth: 32, color: isGroupActive ? '#2563eb' : '#94a3b8' }}>
                                            {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { sx: { fontSize: 20 } }) : item.icon}
                                        </ListItemIcon>
                                        <ListItemText primary={item.text}
                                            primaryTypographyProps={{ fontWeight: isGroupActive ? 700 : 500, fontSize: '0.875rem' }}
                                        />
                                        {expandSettlement ? <ExpandLessIcon sx={{ fontSize: 18, color: '#94a3b8' }} /> : <ChevronRightIcon sx={{ fontSize: 18, color: '#94a3b8' }} />}
                                    </ListItemButton>
                                </ListItem>
                                <Collapse in={expandSettlement} timeout="auto" unmountOnExit>
                                    <List disablePadding sx={{ pl: 2 }}>
                                        {settlementSubItems.map(sub => {
                                            const subActive = location.pathname === sub.path;
                                            return (
                                                <ListItem key={sub.path} disablePadding sx={{ mb: 0.5 }}>
                                                    <ListItemButton
                                                        onClick={() => { navigate(sub.path); if (mobileOpen) setMobileOpen(false); }}
                                                        selected={subActive}
                                                        sx={{
                                                            height: 38, borderRadius: '8px', color: '#64748b', px: 1.5,
                                                            '&.Mui-selected': {
                                                                backgroundColor: '#eff6ff', color: '#2563eb',
                                                                '& .MuiListItemIcon-root': { color: '#2563eb' },
                                                            },
                                                            '&:hover': { backgroundColor: '#f1f5f9' },
                                                        }}
                                                    >
                                                        <ListItemIcon sx={{ minWidth: 26, color: subActive ? '#2563eb' : '#cbd5e1' }}>
                                                            <BarChartIcon sx={{ fontSize: 16 }} />
                                                        </ListItemIcon>
                                                        <ListItemText primary={sub.text}
                                                            primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: subActive ? 700 : 400 }}
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
                                onClick={() => {
                                    navigate(item.path);
                                    if (mobileOpen) setMobileOpen(false);
                                }}
                                selected={isActive}
                                sx={{
                                    height: 44,
                                    borderRadius: '10px',
                                    color: '#64748b',
                                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    px: 2,
                                    '&.Mui-selected': {
                                        backgroundColor: '#eff6ff',
                                        color: '#2563eb',
                                        '&:hover': {
                                            backgroundColor: '#dbeafe',
                                        },
                                        '& .MuiListItemIcon-root': {
                                            color: '#2563eb',
                                        },
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            right: 8,
                                            width: 4,
                                            height: 16,
                                            borderRadius: 2,
                                            backgroundColor: '#2563eb'
                                        }
                                    },
                                    '&:hover': {
                                        backgroundColor: '#f1f5f9',
                                        color: '#0f172a',
                                        '& .MuiListItemIcon-root': {
                                            color: '#0f172a',
                                        },
                                    }
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: 32,
                                    color: isActive ? '#2563eb' : '#94a3b8',
                                    transition: 'color 0.2s'
                                }}>
                                    {React.cloneElement(item.icon as React.ReactElement<any>, { 
                                        sx: { fontSize: 20 } 
                                    })}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontWeight: isActive ? 700 : 500,
                                        fontSize: '0.875rem',
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {/* Bottom User Profile Section */}
            <Box sx={{ p: 2, borderTop: '1px solid #f1f5f9', mt: 'auto' }}>
                <ListItemButton 
                    onClick={handleMenuOpen}
                    sx={{ 
                        borderRadius: '12px',
                        py: 1,
                        px: 1,
                        '&:hover': { bgcolor: '#f8fafc' }
                    }}
                >
                    <Avatar sx={{ 
                        width: 36, 
                        height: 36, 
                        bgcolor: '#2563eb', 
                        color: 'white', 
                        fontSize: '0.875rem', 
                        fontWeight: 700, 
                        mr: 1.5,
                        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.2)'
                    }}>
                        {profile?.full_name?.charAt(0) || 'A'}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                         <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {profile?.full_name || 'Administrator'}
                         </Typography>
                         <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontWeight: 600 }}>
                             {profile?.role === 'admin' || profile?.role === 'manager' ? 'Administrator' : 'Warehouse Staff'}
                         </Typography>
                    </Box>
                    <ExpandMoreIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                </ListItemButton>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <CssBaseline />

            {/* Header */}
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                    bgcolor: 'white',
                    color: '#0f172a',
                    borderBottom: '1px solid #e2e8f0',
                    zIndex: (theme) => theme.zIndex.drawer + 1,
                    '@media print': { display: 'none' }
                }}
                elevation={0}
            >
                <Toolbar sx={{ justifyContent: 'space-between', minHeight: '64px !important', px: { xs: 2, sm: 4 } }}>
                    <Box display="flex" alignItems="center" gap={2}>
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ display: { sm: 'none' }, color: '#64748b' }}
                        >
                            <MenuIcon />
                        </IconButton>
                        
                        {/* Breadcrumbs / Page Title */}
                        <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                             <Breadcrumbs aria-label="breadcrumb" sx={{ '& .MuiBreadcrumbs-separator': { margin: '0 4px' } }}>
                                 <Typography color="inherit" sx={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>
                                    Quản lý kho
                                 </Typography>
                                 <Typography sx={{ color: '#0f172a', fontWeight: 600, fontSize: '0.875rem' }}>
                                     {currentMenuItem?.text || 'Dashboard'}
                                 </Typography>
                             </Breadcrumbs>
                        </Box>
                    </Box>

                    <Box display="flex" alignItems="center" gap={3}>
                        {/* Global Search */}
                        <Box sx={{ 
                            display: { xs: 'none', md: 'flex' }, 
                            alignItems: 'center',
                            bgcolor: '#f1f5f9',
                            borderRadius: 2,
                            px: 1.5,
                            py: 0.5,
                            width: 250,
                            border: '1px solid transparent',
                            transition: 'all 0.2s',
                            '&:focus-within': {
                                bgcolor: 'white',
                                border: '1px solid #cbd5e1',
                                boxShadow: '0 0 0 2px rgba(37,99,235,0.1)'
                            }
                        }}>
                            <SearchIcon sx={{ color: '#94a3b8', fontSize: 20, mr: 1 }} />
                            <InputBase 
                                placeholder="Search everything..." 
                                sx={{ fontSize: '0.875rem', width: '100%', color: '#0f172a' }} 
                            />
                            <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', bgcolor: 'white', px: 0.5, borderRadius: 1, border: '1px solid #e2e8f0' }}>⌘K</Typography>
                        </Box>

                        {/* Org Switcher (Mocked visually) */}
                        <Box 
                            onClick={() => navigate('/')}
                            sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                        >
                            <BusinessIcon sx={{ color: '#64748b', fontSize: 20 }} />
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Main HQ</Typography>
                            <ExpandMoreIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                        </Box>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Profile Menu */}
            <Menu
                anchorEl={anchorEl}
                id="account-menu"
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.1))',
                        mt: 1.5,
                        width: 200,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
                        '& .MuiAvatar-root': {
                            width: 32,
                            height: 32,
                            ml: -0.5,
                            mr: 1,
                        },
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
                <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ fontSize: '0.875rem', py: 1 }}>
                    <ListItemIcon><PersonIcon fontSize="small" sx={{ color: '#64748b' }} /></ListItemIcon>
                    Hồ sơ
                </MenuItem>
                <MenuItem disabled sx={{ fontSize: '0.875rem', py: 1 }}>
                    <ListItemIcon><SettingsIcon fontSize="small" sx={{ color: '#64748b' }} /></ListItemIcon>
                    Cài đặt tài khoản
                </MenuItem>
                <Divider sx={{ my: 1 }} />
                <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', fontSize: '0.875rem', py: 1 }}>
                    <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
                    Đăng xuất
                </MenuItem>
            </Menu>

            {/* Sidebar */}
            <Box
                component="nav"
                sx={{ 
                    width: { sm: drawerWidth }, 
                    flexShrink: { sm: 0 },
                    '@media print': { display: 'none' }
                }}
                aria-label="mailbox folders"
            >
                {/* Mobile Drawer */}
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none' },
                    }}
                >
                    {drawer}
                </Drawer>

                {/* Desktop Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none' },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main Content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, sm: 3, md: 4 },
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    minHeight: '100vh',
                    bgcolor: 'background.default',
                    overflowX: 'hidden',
                    '@media print': {
                        p: 0,
                        m: 0,
                        width: '100%',
                        bgcolor: 'white'
                    }
                }}
            >
                <Toolbar sx={{ minHeight: '64px !important', '@media print': { display: 'none' } }} /> {/* Spacer */}
                <Outlet />
            </Box>
            
            {/* Global AI Chatbot */}
            <AIChatbot />
        </Box>
    );
};

export default MainLayout;
