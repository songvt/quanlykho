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
                        borderRadius: { xs: '20px', sm: '24px' },
                        margin: { xs: 2, sm: 'auto' },
                        width: { xs: 'calc(100% - 32px)', sm: 'auto' },
                        background: 'rgba(255, 255, 255, 0.65)',
                        backdropFilter: 'blur(20px) saturate(190%)',
                        WebkitBackdropFilter: 'blur(20px) saturate(190%)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08), 0 20px 40px -10px rgba(0, 0, 0, 0.15)',
                        border: '1px solid rgba(255, 255, 255, 0.5)',
                        overflow: 'hidden',
                    }
                }}
            >
                <DialogTitle sx={{ 
                    m: 0, 
                    p: { xs: 2, sm: 2.5 }, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: { xs: 1.5, sm: 2 },
                    background: 'transparent' 
                }}>
                    <Box sx={{
                        width: { xs: 36, sm: 40 },
                        height: { xs: 36, sm: 40 },
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.4) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#d97706',
                        flexShrink: 0,
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.1)',
                    }}>
                        <Bell size={20} style={{ animation: 'bounce 2s infinite' }} />
                    </Box>
                    <Typography 
                        fontWeight={800} 
                        sx={{ 
                            color: '#b45309', 
                            flexGrow: 1, 
                            fontSize: { xs: '1.05rem', sm: '1.25rem' },
                            lineHeight: 1.2,
                            letterSpacing: '-0.01em'
                        }}
                    >
                        {announcement?.title}
                    </Typography>
                    <IconButton
                        aria-label="close"
                        onClick={handleCloseAnnouncement}
                        sx={{ 
                            color: 'text.secondary', 
                            p: 0.75, 
                            bgcolor: 'rgba(0,0,0,0.04)',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.08)' }
                        }}
                    >
                        <X size={18} />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ 
                    borderColor: 'rgba(255, 255, 255, 0.4)', 
                    borderTop: '1px solid rgba(255, 255, 255, 0.4)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.4)',
                    background: 'rgba(255, 255, 255, 0.25)', 
                    p: { xs: 2.5, sm: 3 } 
                }}>
                    <Typography 
                        variant="body1" 
                        sx={{ 
                            whiteSpace: 'pre-line', 
                            py: 0.5, 
                            color: '#1e293b', 
                            fontWeight: 500,
                            fontSize: { xs: '0.95rem', sm: '1.05rem' }, 
                            lineHeight: 1.6 
                        }}
                    >
                        {announcement?.content}
                    </Typography>
                </DialogContent>
                <Box sx={{ width: '100%', px: { xs: 2.5, sm: 3 }, pt: 2, background: 'transparent' }}>
                    <LinearProgress 
                        variant="determinate" 
                        value={progress} 
                        sx={{ 
                            height: 6, 
                            borderRadius: 3,
                            bgcolor: 'rgba(245, 158, 11, 0.15)',
                            '& .MuiLinearProgress-bar': {
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)'
                            }
                        }} 
                    />
                </Box>
                <DialogActions sx={{ p: { xs: 2.5, sm: 3 }, background: 'transparent' }}>
                    <Button 
                        onClick={handleCloseAnnouncement} 
                        variant="contained" 
                        fullWidth
                        sx={{ 
                            borderRadius: '12px', 
                            py: { xs: 1.2, sm: 1.5 }, 
                            fontWeight: 800,
                            fontSize: { xs: '0.9rem', sm: '0.975rem' },
                            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                            boxShadow: '0 4px 15px rgba(245, 158, 11, 0.3)',
                            textTransform: 'none',
                            transition: 'all 0.2s ease-in-out',
                            '&:hover': {
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                boxShadow: '0 6px 20px rgba(245, 158, 11, 0.4)',
                                transform: 'translateY(-1px)'
                            },
                            '&:active': {
                                transform: 'translateY(1px)'
                            }
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
