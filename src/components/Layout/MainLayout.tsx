import React, { useState } from 'react';
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
    Breadcrumbs
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
} from '@mui/icons-material';
import AIChatbot from '../Chatbot/AIChatbot';

const drawerWidth = 260; 

const MainLayout: React.FC = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);

    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { items: transactions } = useSelector((state: RootState) => state.transactions);
    const { items: employees, status: empStatus } = useSelector((state: RootState) => state.employees);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationOpen = (event: React.MouseEvent<HTMLElement>) => {
        setNotificationAnchorEl(event.currentTarget);
    };

    const handleNotificationClose = () => {
        setNotificationAnchorEl(null);
    };

    // Auto refresh data every 30s to simulate realtime
    React.useEffect(() => {
        const interval = setInterval(() => {
            dispatch(fetchTransactionsForce());
        }, 30000);
        return () => clearInterval(interval);
    }, [dispatch]);

    React.useEffect(() => {
        if (empStatus === 'idle') {
            dispatch(fetchEmployees());
        }
    }, [empStatus, dispatch]);

    const recentNotifications = React.useMemo(() => {
        return [...transactions]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 5);
    }, [transactions]);

    const notificationsCount = React.useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return transactions.filter(t => new Date(t.date || t.inbound_date || t.outbound_date || new Date()) >= todayStart).length;
    }, [transactions]);

    // Force Change Password Check
    React.useEffect(() => {
        const needsChange = profile?.must_change_password === true || (profile?.must_change_password as any) === 'TRUE';
        if (needsChange) {
            navigate('/change-password');
        }
    }, [profile, navigate]);

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const { hasPermission, hasAnyPermission } = usePermission();

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
        ...(hasPermission('inventory.view') ? [
            { text: 'Hàng hóa', icon: <InventoryIcon />, path: '/products' }
        ] : []),
        ...(hasPermission('inbound.view') ? [
            { text: 'Nhập kho', icon: <InputIcon />, path: '/inbound' }
        ] : []),
        ...(hasPermission('inbound.view') ? [
            { text: 'Tạo QR code', icon: <QrCode2Icon />, path: '/qr-generator' }
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
            { text: 'Báo cáo', icon: <AssessmentIcon />, path: '/reports' }
        ] : []),
        ...(hasPermission('employees.view') ? [
            { text: 'Nhân viên', icon: <PeopleIcon />, path: '/employees' }
        ] : []),
        ...(hasPermission('*') ? [
            { text: 'Thiết lập', icon: <SettingsIcon />, path: '/settings' }
        ] : []),
    ];

    const currentMenuItem = menuItems.find(item => item.path === location.pathname);

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0b3d2b', borderRight: 'none' }}>
            {/* Standard SaaS Logo Area */}
            <Box sx={{ 
                p: 2.5, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1.5,
                mb: 2,
                borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
                <Box sx={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: 2, 
                    bgcolor: 'transparent',
                    border: '1px solid rgba(255,255,255,0.3)',
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                }}>
                    <DashboardIcon sx={{ color: 'white', fontSize: 20 }} />
                </Box>
                <Typography
                    variant="h6"
                    sx={{
                        fontWeight: 700,
                        color: 'white',
                        letterSpacing: '-0.5px',
                        fontSize: '1.0rem'
                    }}
                >
                    Inventory Management System
                </Typography>
            </Box>

            <List sx={{ px: 2, flexGrow: 1 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                onClick={() => {
                                    navigate(item.path);
                                    if (mobileOpen) setMobileOpen(false);
                                }}
                                selected={isActive}
                                sx={{
                                    height: 48,
                                    borderRadius: '8px',
                                    color: 'white',
                                    transition: 'all 0.2s',
                                    '&.Mui-selected': {
                                        backgroundColor: 'rgba(255,255,255,0.1)',
                                        color: 'white',
                                        boxShadow: 'none',
                                        border: '1px solid rgba(255,255,255,0.15)',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                        },
                                        '& .MuiListItemIcon-root': {
                                            color: 'white',
                                        },
                                    },
                                    '&:hover': {
                                        backgroundColor: 'rgba(255,255,255,0.05)',
                                        color: 'white',
                                        '& .MuiListItemIcon-root': {
                                            color: 'white',
                                        },
                                    }
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: 36,
                                    color: 'white',
                                    transition: 'color 0.2s'
                                }}>
                                    {React.cloneElement(item.icon as React.ReactElement<any>, { fontSize: 'small' })}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '0.9rem',
                                        color: 'white'
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {/* User Profile at Bottom (Sidebar style) */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)', bgcolor: 'transparent' }}>
                <ListItemButton
                    onClick={handleMenuOpen}
                    sx={{
                        borderRadius: '8px',
                        py: 1,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontSize: '0.875rem', fontWeight: 600, mr: 1.5 }}>
                        {profile?.full_name?.charAt(0) || 'A'}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                         <Typography variant="body2" sx={{ fontWeight: 600, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                              {profile?.full_name || 'Administrator'}
                         </Typography>
                         <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                             {profile?.role === 'admin' || profile?.role === 'manager' ? 'Admin' : 'Staff'}
                         </Typography>
                    </Box>
                    <ExpandMoreIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }} />
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
                    zIndex: (theme) => theme.zIndex.drawer + 1
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
                                 <Typography color="inherit" sx={{ fontSize: '0.875rem', color: '#64748b' }}>
                                    Inventory Management System
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
                        <Box sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}>
                            <BusinessIcon sx={{ color: '#64748b', fontSize: 20 }} />
                            <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#475569' }}>Main HQ</Typography>
                            <ExpandMoreIcon sx={{ color: '#94a3b8', fontSize: 16 }} />
                        </Box>

                        <Divider orientation="vertical" flexItem sx={{ my: 1.5 }} />

                        {/* Notifications */}
                        <IconButton sx={{ color: '#64748b' }} onClick={handleNotificationOpen}>
                            <Badge badgeContent={notificationsCount} color="error" sx={{ '& .MuiBadge-badge': { height: 16, minWidth: 16, fontSize: '0.65rem' } }}>
                                <NotificationsIcon sx={{ fontSize: 22 }} />
                            </Badge>
                        </IconButton>
                    </Box>
                </Toolbar>
            </AppBar>
            
            {/* Notification Menu */}
            <Menu
                sx={{ mt: '10px' }}
                anchorEl={notificationAnchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(notificationAnchorEl)}
                onClose={handleNotificationClose}
                PaperProps={{
                    elevation: 0,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.1))',
                        mt: 1.5,
                        width: 320,
                        maxHeight: 400,
                        borderRadius: 2,
                        border: '1px solid #e2e8f0',
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
                <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#0f172a' }}>
                        Hoạt động gần đây
                    </Typography>
                </Box>
                {recentNotifications.length === 0 ? (
                    <MenuItem disabled sx={{ py: 3, justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>Chưa có hoạt động nào</Typography>
                    </MenuItem>
                ) : (
                    recentNotifications.map((n, idx) => {
                        const employeeName = employees.find(e => e.id === (n as any).created_by || e.auth_user_id === (n as any).created_by)?.full_name || (n as any).created_by || 'Khuyết danh';
                        return (
                            <MenuItem key={n.id || idx} onClick={handleNotificationClose} sx={{ py: 1.5, px: 2, borderBottom: '1px solid #f1f5f9', whiteSpace: 'normal', alignItems: 'flex-start' }}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 500, lineHeight: 1.4 }}>
                                        <Typography component="span" sx={{ fontWeight: 600, color: '#2563eb' }}>{employeeName}</Typography>
                                        {' vừa '}{n.type === 'inbound' ? 'nhập kho' : 'xuất kho'}{' '}
                                        <Typography component="span" sx={{ fontWeight: 600 }}>{n.quantity} {n.product?.name || `Sản phẩm #${n.product_id}`}</Typography>
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                                        {n.date ? new Date(n.date).toLocaleString('vi-VN', { timeStyle: 'short', dateStyle: 'medium' }) : 'N/A'}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        );
                    })
                )}
                <Box sx={{ p: 1, borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <Typography component="a" href="#" onClick={(e) => { e.preventDefault(); navigate('/'); handleNotificationClose(); }} sx={{ fontSize: '0.8rem', color: '#2563eb', textDecoration: 'none', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}>
                        Xem tất cả trong Dashboard
                    </Typography>
                </Box>
            </Menu>

            {/* User Dropdown Menu */}
            <Menu
                sx={{ mt: '10px' }}
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
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
                    My Profile
                </MenuItem>
                <MenuItem disabled sx={{ fontSize: '0.875rem', py: 1 }}>
                    <ListItemIcon><SettingsIcon fontSize="small" sx={{ color: '#64748b' }} /></ListItemIcon>
                    Account Settings
                </MenuItem>
                <Divider sx={{ my: 1 }} />
                <MenuItem onClick={handleLogout} sx={{ color: '#ef4444', fontSize: '0.875rem', py: 1 }}>
                    <ListItemIcon><LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} /></ListItemIcon>
                    Sign out
                </MenuItem>
            </Menu>

            {/* Sidebar */}
            <Box
                component="nav"
                sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
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
                    p: { xs: 2, sm: 4 }, 
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    minHeight: '100vh',
                    bgcolor: '#f1f5f9', // Very light grey bg for SaaS look
                    overflowX: 'hidden'
                }}
            >
                <Toolbar sx={{ minHeight: '64px !important' }} /> {/* Spacer */}
                <Outlet />
            </Box>
            
            {/* Global AI Chatbot */}
            <AIChatbot />
        </Box>
    );
};

export default MainLayout;
