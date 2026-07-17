import React, { useState } from 'react';
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
    InputBase,
} from '@mui/material';
import { Menu as MenuIcon, Bell, Search, Sun, Moon, Settings, LogOut, User } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState, AppDispatch } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';

interface ModernHeaderProps {
    DRAWER_WIDTH: number;
    handleDrawerToggle: () => void;
    currentMenuText: string;
}

const ModernHeader: React.FC<ModernHeaderProps> = ({ DRAWER_WIDTH, handleDrawerToggle, currentMenuText }) => {
    const dispatch = useDispatch<AppDispatch>();
    const navigate = useNavigate();
    const { profile } = useSelector((state: RootState) => state.auth);

    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleMenuClose();
        dispatch(logoutUser());
        navigate('/login');
    };

    const toggleTheme = () => {
        const newTheme = themeMode === 'light' ? 'dark' : 'light';
        setThemeMode(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
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
                            sx={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-primary)' }}
                        />
                    </Box>
                </Box>

                {/* Right Side: Actions */}
                <Box display="flex" alignItems="center" gap={{ xs: 1, sm: 2 }}>
                    <Typography sx={{ display: { xs: 'none', md: 'block' }, color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
                        {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </Typography>

                    <IconButton onClick={toggleTheme} sx={{ color: 'var(--text-secondary)' }}>
                        {themeMode === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    </IconButton>

                    <IconButton sx={{ color: 'var(--text-secondary)' }}>
                        <Badge badgeContent={3} color="error" sx={{ '& .MuiBadge-badge': { right: 2, top: 2 } }}>
                            <Bell size={20} />
                        </Badge>
                    </IconButton>

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
