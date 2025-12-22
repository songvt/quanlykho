import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';
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
    Stack
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    Inventory as InventoryIcon,
    ShoppingCart as OrderIcon,
    Input as InputIcon,
    Output as OutputIcon,
    People as PeopleIcon,
    Logout as LogoutIcon,
    Person as PersonIcon,
    Settings as SettingsIcon,
    Assessment as AssessmentIcon,
} from '@mui/icons-material';

const drawerWidth = 260; // Slightly wider for better look

const MainLayout: React.FC = () => {
    // const theme = useTheme();
    // const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useDispatch<AppDispatch>();
    const { profile } = useSelector((state: RootState) => state.auth);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    // Force Change Password Check
    React.useEffect(() => {
        if (profile?.must_change_password) {
            navigate('/change-password');
        }
    }, [profile, navigate]);

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
        ...(profile?.role === 'admin' ? [
            { text: 'Hàng hóa', icon: <InventoryIcon />, path: '/products' },
            { text: 'Nhập kho', icon: <InputIcon />, path: '/inbound' },
        ] : []),
        { text: 'Đặt hàng', icon: <OrderIcon />, path: '/orders' },
        { text: 'Xuất kho', icon: <OutputIcon />, path: '/outbound' },
        { text: 'Báo cáo', icon: <AssessmentIcon />, path: '/reports' },
        ...(profile?.role === 'admin' ? [{ text: 'Nhân viên', icon: <PeopleIcon />, path: '/employees' }] : []),
    ];

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Logo Area */}
            <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '1.2rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                    }}
                >
                    Q
                </Box>
                <Typography variant="h6" fontWeight="bold" sx={{ color: 'white', letterSpacing: '0.5px' }}>
                    Quan Ly Kho
                </Typography>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', mb: 2, mx: 2 }} />

            {/* Menu Items */}
            <List sx={{ px: 2, flexGrow: 1 }}>
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
                            <ListItemButton
                                onClick={() => navigate(item.path)}
                                selected={isActive}
                                sx={{
                                    height: 48
                                }}
                            >
                                <ListItemIcon sx={{
                                    minWidth: 40,
                                    color: isActive ? 'white' : '#9ca3af'
                                }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '0.95rem'
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            {/* User Profile at Bottom */}
            <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)' }}>
                <ListItemButton
                    onClick={handleLogout}
                    sx={{
                        borderRadius: '8px',
                        color: '#faa5a5',
                        '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }
                    }}
                >
                    <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
                        <LogoutIcon />
                    </ListItemIcon>
                    <ListItemText primary="Đăng xuất" />
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
                    zIndex: (theme) => theme.zIndex.drawer + 1
                }}
                elevation={0}
            >
                <Toolbar sx={{ justifyContent: 'space-between' }}>
                    <Box display="flex" alignItems="center">
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="start"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 2, display: { sm: 'none' } }}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Stack direction="column">
                            <Typography variant="h6" noWrap component="div" sx={{ color: 'text.primary', fontWeight: 700 }}>
                                {menuItems.find(item => item.path === location.pathname)?.text || 'Dashboard'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                                {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </Typography>
                        </Stack>
                    </Box>

                    <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' } }}>
                            <Typography variant="subtitle2" color="text.primary" fontWeight="600">
                                {profile?.full_name || 'Administrator'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {profile?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                            </Typography>
                        </Box>
                        <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
                            <Avatar sx={{ bgcolor: 'primary.main' }}>
                                {profile?.full_name?.charAt(0) || 'A'}
                            </Avatar>
                        </IconButton>
                        <Menu
                            sx={{ mt: '45px' }}
                            anchorEl={anchorEl}
                            anchorOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem disabled>
                                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                                Hồ sơ
                            </MenuItem>
                            <MenuItem disabled>
                                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                                Cài đặt
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                                <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                                Đăng xuất
                            </MenuItem>
                        </Menu>
                    </Box>
                </Toolbar>
            </AppBar>

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
                    ModalProps={{
                        keepMounted: true,
                    }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                >
                    {drawer}
                </Drawer>

                {/* Desktop Drawer */}
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main Content */}
            <Box
                component="main"
                sx={{ flexGrow: 1, p: { xs: 2, sm: 3 }, width: { sm: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh', bgcolor: 'background.default' }}
            >
                <Toolbar /> {/* Spacer for fixed AppBar */}
                <Outlet />
            </Box>
        </Box>
    );
};

export default MainLayout;
