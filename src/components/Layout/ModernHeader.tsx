import React, { useEffect, useState, useMemo } from 'react';
import {
    AppBar,
    Toolbar,
    Box,
    IconButton,
    Typography,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    Badge,
    CircularProgress,
    InputBase,
} from '@mui/material';
import { Menu as MenuIcon, Bell, Search, Sun, Moon, Settings, LogOut, User, Clock3 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';
import { GoogleSheetService } from '../../services/GoogleSheetService';

interface ModernHeaderProps {
    DRAWER_WIDTH: number;
    handleDrawerToggle: () => void;
    currentMenuText: string;
}

type RecentActivity = {
    id: string;
    createdAt: string;
    action: string;
    subject: string;
    performedBy: string;
};

const ModernHeader: React.FC<ModernHeaderProps> = ({ DRAWER_WIDTH, handleDrawerToggle, currentMenuText }) => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notificationAnchorEl, setNotificationAnchorEl] = useState<null | HTMLElement>(null);
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [loadingActivities, setLoadingActivities] = useState(false);
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
        const savedTheme = localStorage.getItem('qlkho_theme');
        return savedTheme === 'dark' ? 'dark' : 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', themeMode);
        localStorage.setItem('qlkho_theme', themeMode);
    }, [themeMode]);

    const formattedDate = useMemo(() => {
        return new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }, []);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const loadRecentActivities = async () => {
        setLoadingActivities(true);
        try {
            const [qrLogs, assetLogs] = await Promise.all([
                GoogleSheetService.getActionLogs(),
                GoogleSheetService.getAssetLogs(),
            ]);
            const activities: RecentActivity[] = [
                ...(Array.isArray(qrLogs) ? qrLogs : []).map((log: any) => ({
                    id: `qr-${log.id}`, createdAt: log.created_at, action: log.action || 'Thao tác QR',
                    subject: log.doc_title || 'Thao tác mã QR', performedBy: log.created_by || 'Hệ thống',
                })),
                ...(Array.isArray(assetLogs) ? assetLogs : []).map((log: any) => ({
                    id: `asset-${log.id}`, createdAt: log.created_at, action: log.action || 'Thao tác tài sản',
                    subject: log.asset_name ? `${log.asset_name}${log.asset_code ? ` (${log.asset_code})` : ''}` : 'Thao tác tài sản',
                    performedBy: log.performed_by || 'Hệ thống',
                })),
            ].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 8);
            setRecentActivities(activities);
        } catch (error) {
            console.error('Không thể tải lịch sử thao tác gần nhất:', error);
            setRecentActivities([]);
        } finally {
            setLoadingActivities(false);
        }
    };

    useEffect(() => {
        void loadRecentActivities();
        // Refresh when the signed-in account changes, so the bell count is current on first display.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id]);

    const handleNotificationsOpen = (event: React.MouseEvent<HTMLElement>) => {
        setNotificationAnchorEl(event.currentTarget);
        void loadRecentActivities();
    };

    const formatActivityTime = (value: string) => value
        ? new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        : 'Không rõ thời gian';

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const toggleTheme = () => {
        const newTheme = themeMode === 'light' ? 'dark' : 'light';
        setThemeMode(newTheme);
    };

    return (
        <AppBar
            position="fixed"
            className="premium-glass"
            sx={{
                width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
                ml: { sm: `${DRAWER_WIDTH}px` },
                color: 'var(--text-primary)',
                borderBottom: '1px solid var(--border-color)',
                boxShadow: 'none',
                zIndex: (theme) => theme.zIndex.drawer + 1,
                '@media print': { display: 'none' },
            }}
            elevation={0}
        >
            <Toolbar sx={{
                justifyContent: 'space-between',
                minHeight: { xs: '64px !important', sm: '72px !important' },
                px: { xs: 2, sm: 3 },
                gap: 2,
            }}>
                {/* Left Side: Mobile Hamburger & Page Title / Desktop Search */}
                <Box display="flex" alignItems="center" gap={2} sx={{ flex: 1, minWidth: 0 }}>
                    <IconButton
                        color="inherit"
                        aria-label="Mở menu điều hướng"
                        onClick={handleDrawerToggle}
                        sx={{
                            display: { sm: 'none' },
                            color: 'var(--text-secondary)',
                            p: 1,
                        }}
                    >
                        <MenuIcon size={24} />
                    </IconButton>

                    {/* Mobile Title */}
                    <Typography sx={{
                        display: { xs: 'block', sm: 'none' },
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {currentMenuText}
                    </Typography>

                    {/* Desktop Search Bar */}
                    <Box sx={{
                        display: { xs: 'none', sm: 'flex' },
                        alignItems: 'center',
                        bgcolor: 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '12px',
                        px: 2,
                        py: 1,
                        width: '100%',
                        maxWidth: 400,
                        border: '1px solid var(--border-color)',
                        transition: 'all 0.2s',
                        '&:focus-within': {
                            borderColor: 'var(--brand-primary)',
                            boxShadow: '0 0 0 2px rgba(37,99,235,0.1)'
                        }
                    }}>
                        <Search size={18} color="var(--text-secondary)" style={{ marginRight: 8 }} />
                        <InputBase
                            placeholder="Tìm kiếm tài sản, hàng hóa, serial..."
                            inputProps={{ 'aria-label': 'Tìm kiếm tài sản, hàng hóa hoặc serial' }}
                            sx={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)' }}
                        />
                    </Box>
                </Box>

                {/* Right Side: Actions */}
                <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 2 }}>
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                        {formattedDate}
                    </Typography>

                    <IconButton
                        aria-label={themeMode === 'light' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
                        onClick={toggleTheme}
                        sx={{ color: 'var(--text-secondary)' }}
                    >
                        {themeMode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </IconButton>

                    <IconButton aria-label="Lịch sử thao tác gần nhất" onClick={handleNotificationsOpen} sx={{ color: 'var(--text-secondary)' }}>
                        <Badge badgeContent={Math.min(recentActivities.length, 9)} color="error" invisible={!recentActivities.length} sx={{ '& .MuiBadge-badge': { right: 2, top: 2 } }}>
                            <Bell size={20} />
                        </Badge>
                    </IconButton>

                    <Menu
                        anchorEl={notificationAnchorEl}
                        open={Boolean(notificationAnchorEl)}
                        onClose={() => setNotificationAnchorEl(null)}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        PaperProps={{ sx: { mt: 1.5, width: { xs: 330, sm: 390 }, maxHeight: 510, borderRadius: 3, bgcolor: 'var(--bg-card)', border: '1px solid var(--border-color)' } }}
                    >
                        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Clock3 size={18} color="var(--brand-primary)" />
                            <Box>
                                <Typography fontWeight={800}>Lịch sử thao tác gần nhất</Typography>
                                <Typography variant="caption" color="text.secondary">Các tác động mới phát sinh trong hệ thống</Typography>
                            </Box>
                        </Box>
                        <Divider sx={{ borderColor: 'var(--border-color)' }} />
                        {loadingActivities ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box> : recentActivities.length ? recentActivities.map((activity) => (
                            <MenuItem key={activity.id} disableRipple sx={{ alignItems: 'flex-start', whiteSpace: 'normal', py: 1.25, cursor: 'default' }}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" fontWeight={700} noWrap>{activity.action}</Typography>
                                    <Typography variant="caption" display="block" noWrap color="text.secondary">{activity.subject}</Typography>
                                    <Typography variant="caption" display="block" sx={{ mt: .35, color: 'var(--text-secondary)' }}>{activity.performedBy} · {formatActivityTime(activity.createdAt)}</Typography>
                                </Box>
                            </MenuItem>
                        )) : <Box sx={{ px: 2, py: 3, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">Chưa có lịch sử thao tác.</Typography></Box>}
                        <Divider sx={{ borderColor: 'var(--border-color)' }} />
                        <MenuItem onClick={() => { setNotificationAnchorEl(null); navigate('/action-history'); }} sx={{ justifyContent: 'center', fontWeight: 700, color: 'var(--brand-primary)' }}>
                            Xem toàn bộ lịch sử
                        </MenuItem>
                    </Menu>

                    <Box
                        onClick={handleMenuOpen}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            cursor: 'pointer',
                            pl: { sm: 1 },
                            borderLeft: { sm: '1px solid var(--border-color)' },
                        }}
                    >
                        <Avatar sx={{ width: 36, height: 36, bgcolor: 'var(--brand-primary)', fontWeight: 700 }}>
                            {profile?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                        </Avatar>
                    </Box>

                    {/* Profile Dropdown */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                        PaperProps={{
                            sx: {
                                mt: 1.5,
                                width: 220,
                                borderRadius: '16px',
                                boxShadow: '0 12px 36px rgba(0,0,0,0.1)',
                                border: '1px solid var(--border-color)',
                                bgcolor: 'var(--bg-card)',
                            }
                        }}
                    >
                        <Box sx={{ px: 2, py: 1.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                {profile?.full_name}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {profile?.email || 'admin@ggs.vn'}
                            </Typography>
                        </Box>
                        <Divider sx={{ borderColor: 'var(--border-color)' }} />
                        <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }} sx={{ gap: 1.5, py: 1.2 }}>
                            <User size={18} color="var(--text-secondary)" /> Thông tin cá nhân
                        </MenuItem>
                        <MenuItem onClick={() => { handleMenuClose(); navigate('/change-password'); }} sx={{ gap: 1.5, py: 1.2 }}>
                            <Settings size={18} color="var(--text-secondary)" /> Cài đặt & Mật khẩu
                        </MenuItem>
                        <Divider sx={{ borderColor: 'var(--border-color)' }} />
                        <MenuItem onClick={handleLogout} sx={{ gap: 1.5, py: 1.2, color: 'var(--brand-danger)' }}>
                            <LogOut size={18} /> Đăng xuất
                        </MenuItem>
                    </Menu>
                </Box>
            </Toolbar>
        </AppBar>
    );
};

export default ModernHeader;
