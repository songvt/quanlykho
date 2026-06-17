import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Box, CssBaseline, Drawer, SwipeableDrawer, useMediaQuery, useTheme, Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, LinearProgress, Typography } from '@mui/material';
import { Bell, X } from 'lucide-react';
import { supabase } from '../../config/supabase';

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
    const [announcement, setAnnouncement] = useState<{ id: string; title: string; content: string } | null>(null);
    const [announcementOpen, setAnnouncementOpen] = useState(false);
    const [progress, setProgress] = useState(100);

    // Fetch active announcement upon mounting or profile change
    useEffect(() => {
        if (!profile) return;

        const checkAnnouncements = async () => {
            try {
                const { data, error } = await supabase
                    .from('announcements')
                    .select('id, title, content')
                    .eq('active', true)
                    .order('created_at', { ascending: false })
                    .limit(1);

                if (error) throw error;

                if (data && data.length > 0) {
                    const activeAnn = data[0];
                    const storageKey = `seen_announcements_${profile.id || profile.email}`;
                    const seenList = localStorage.getItem(storageKey);
                    const seenIds = seenList ? JSON.parse(seenList) : [];
                    
                    if (!seenIds.includes(activeAnn.id)) {
                        setAnnouncement(activeAnn);
                        setAnnouncementOpen(true);
                        setProgress(100);
                    }
                }
            } catch (err) {
                console.error('Failed to check announcements:', err);
            }
        };

        checkAnnouncements();
    }, [profile]);

    // Timer & Progress logic
    useEffect(() => {
        if (!announcementOpen || !announcement) return;

        const duration = 10000; // 10s
        const intervalTime = 100; // 100ms
        const steps = duration / intervalTime;
        let currentStep = 0;

        const progressInterval = setInterval(() => {
            currentStep += 1;
            setProgress(Math.max(0, 100 - (currentStep / steps) * 100));
        }, intervalTime);

        const closeTimeout = setTimeout(() => {
            handleCloseAnnouncement();
        }, duration);

        return () => {
            clearInterval(progressInterval);
            clearTimeout(closeTimeout);
        };
    }, [announcementOpen, announcement]);

    const handleCloseAnnouncement = () => {
        if (announcement && profile) {
            const storageKey = `seen_announcements_${profile.id || profile.email}`;
            const seenList = localStorage.getItem(storageKey);
            const seenIds = seenList ? JSON.parse(seenList) : [];
            if (!seenIds.includes(announcement.id)) {
                seenIds.push(announcement.id);
                localStorage.setItem(storageKey, JSON.stringify(seenIds));
            }
        }
        setAnnouncementOpen(false);
    };

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

            {/* System Announcement Popup Modal */}
            <Dialog
                open={announcementOpen}
                onClose={handleCloseAnnouncement}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: { xs: '16px', sm: '20px' },
                        margin: { xs: 2, sm: 'auto' },
                        width: { xs: 'calc(100% - 32px)', sm: 'auto' },
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.3)',
                    }
                }}
            >
                <DialogTitle sx={{ m: 0, p: { xs: 1.5, sm: 2 }, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 } }}>
                    <Box sx={{
                        width: { xs: 32, sm: 36 },
                        height: { xs: 32, sm: 36 },
                        borderRadius: '50%',
                        bgcolor: 'warning.light',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'warning.dark',
                        flexShrink: 0
                    }}>
                        <Bell size={18} />
                    </Box>
                    <Typography 
                        fontWeight="bold" 
                        sx={{ 
                            color: 'warning.dark', 
                            flexGrow: 1, 
                            fontSize: { xs: '1rem', sm: '1.2rem' },
                            lineHeight: 1.2
                        }}
                    >
                        {announcement?.title}
                    </Typography>
                    <IconButton
                        aria-label="close"
                        onClick={handleCloseAnnouncement}
                        sx={{ color: 'text.secondary', p: 0.5 }}
                    >
                        <X size={18} />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ borderColor: 'rgba(0, 0, 0, 0.08)', p: { xs: 1.5, sm: 2 } }}>
                    <Typography 
                        variant="body1" 
                        sx={{ 
                            whiteSpace: 'pre-line', 
                            py: 0.5, 
                            color: 'text.primary', 
                            fontSize: { xs: '0.925rem', sm: '1.05rem' }, 
                            lineHeight: 1.5 
                        }}
                    >
                        {announcement?.content}
                    </Typography>
                </DialogContent>
                <Box sx={{ width: '100%', px: { xs: 2, sm: 3 }, pt: 1.5 }}>
                    <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        color="warning" 
                        sx={{ 
                            height: 4, 
                            borderRadius: 2,
                            bgcolor: 'rgba(245, 158, 11, 0.15)',
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 2
                            }
                        }} 
                    />
                </Box>
                <DialogActions sx={{ p: { xs: 1.5, sm: 2 } }}>
                    <Button 
                        onClick={handleCloseAnnouncement} 
                        variant="contained" 
                        color="warning"
                        fullWidth
                        sx={{ 
                            borderRadius: '10px', 
                            py: { xs: 0.8, sm: 1 }, 
                            fontWeight: 'bold',
                            fontSize: { xs: '0.875rem', sm: '1rem' }
                        }}
                    >
                        Đồng ý (Tự đóng sau {Math.ceil(progress / 10)}s)
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default MainLayout;
