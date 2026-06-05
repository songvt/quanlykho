import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CssBaseline, Drawer, SwipeableDrawer, useMediaQuery, useTheme } from '@mui/material';

import type { RootState } from '../../store';
import ModernSidebar from './ModernSidebar';
import ModernHeader from './ModernHeader';
import MobileBottomNav from './MobileBottomNav';
import AIChatbot from '../Chatbot/AIChatbot';

const DRAWER_WIDTH = 268;

const MainLayout: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const muiTheme = useTheme();
    const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
    const { profile, status: authStatus } = useSelector((state: RootState) => state.auth);

    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        if (!profile && authStatus !== 'loading') navigate('/login');
    }, [profile, authStatus, navigate]);

    useEffect(() => {
        if (isMobile) setMobileOpen(false);
    }, [location.pathname, isMobile]);

    const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

    // Get a basic title for mobile header based on pathname
    const getCurrentMenuText = () => {
        if (location.pathname === '/') return 'Dashboard';
        if (location.pathname.includes('products')) return 'Hàng hóa';
        if (location.pathname.includes('orders')) return 'Đặt hàng';
        if (location.pathname.includes('profile')) return 'Tài khoản';
        if (location.pathname.includes('assets')) return 'Tài sản';
        if (location.pathname.includes('inbound')) return 'Nhập kho';
        if (location.pathname.includes('outbound')) return 'Xuất kho';
        return 'Quản lý kho';
    };

    return (
        <Box sx={{ display: 'flex', minHeight: '100svh' }}>
            <CssBaseline />

            <ModernHeader 
                DRAWER_WIDTH={DRAWER_WIDTH} 
                handleDrawerToggle={handleDrawerToggle} 
                currentMenuText={getCurrentMenuText()}
            />

            {/* Sidebar Desktop/Mobile */}
            <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
                {isMobile ? (
                    <SwipeableDrawer
                        variant="temporary"
                        open={mobileOpen}
                        onOpen={handleDrawerToggle}
                        onClose={handleDrawerToggle}
                        ModalProps={{ keepMounted: true }}
                        sx={{
                            display: { xs: 'block', sm: 'none' },
                            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none' },
                        }}
                    >
                        <ModernSidebar isMobile={true} handleDrawerToggle={handleDrawerToggle} />
                    </SwipeableDrawer>
                ) : (
                    <Drawer
                        variant="permanent"
                        sx={{
                            display: { xs: 'none', sm: 'block' },
                            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, border: 'none' },
                        }}
                        open
                    >
                        <ModernSidebar isMobile={false} handleDrawerToggle={handleDrawerToggle} />
                    </Drawer>
                )}
            </Box>

            {/* Main Content Area */}
            <Box
                component="main"
                className="main-content-mobile-pad"
                sx={{
                    flexGrow: 1,
                    minWidth: 0,
                    pt: { xs: '64px', sm: '72px' }, // AppBar height
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                <Box sx={{ p: { xs: 2, sm: 3 }, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                    <Outlet />
                </Box>
            </Box>

            {/* Floating Action Button & Bottom Nav on Mobile */}
            <MobileBottomNav />

            {/* Chatbot */}
            <AIChatbot />
        </Box>
    );
};

export default MainLayout;
