import React from 'react';
import { Box, BottomNavigation, BottomNavigationAction, Paper } from '@mui/material';
import { Home, Package, QrCode, CheckSquare, Users } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { usePermission } from '../../hooks/usePermission';
import type { RootState } from '../../store';

const MobileBottomNav: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile } = useSelector((state: RootState) => state.auth);
    const { hasPermission } = usePermission();

    const bottomNavItems = React.useMemo(() => {
        const items = [];
        if (profile?.role === 'admin' || profile?.role === 'staff') items.push({ label: 'Dashboard', icon: <Home size={24} strokeWidth={1.5} />, path: '/' });
        if (hasPermission('inventory.view')) items.push({ label: 'Kho', icon: <Package size={24} strokeWidth={1.5} />, path: '/products' });
        
        // Placeholder for QR
        items.push({ label: 'QR', icon: <Box sx={{ width: 24 }} />, path: '__qr_scan__' });
        
        if (hasPermission('orders.create') || hasPermission('orders.view_own')) items.push({ label: 'Phiếu', icon: <CheckSquare size={24} strokeWidth={1.5} />, path: '/orders' });
        items.push({ label: 'Tài khoản', icon: <Users size={24} strokeWidth={1.5} />, path: '/profile' });
        return items.slice(0, 5);
    }, [profile, hasPermission]);

    const handleNavChange = (_: any, newValue: number) => {
        const path = bottomNavItems[newValue].path;
        if (path === '__qr_scan__') {
            // Open full screen scanner
            navigate('/scanner');
        } else {
            navigate(path);
        }
    };

    // Calculate active value safely
    const value = bottomNavItems.findIndex(i => i.path === location.pathname);

    return (
        <>
            {/* Floating QR Scanner Button */}
            <Box
                onClick={() => navigate('/scanner')}
                sx={{
                    position: 'fixed',
                    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 30px)',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 1400,
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-secondary) 100%)',
                    display: { xs: 'flex', sm: 'none' },
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 30px rgba(37, 99, 235, 0.4)',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                    border: '4px solid var(--bg-default)',
                    '&:active': {
                        transform: 'translateX(-50%) scale(0.95)',
                    }
                }}
            >
                <QrCode color="white" size={28} strokeWidth={2} />
            </Box>

            {/* Bottom Navigation Bar */}
            <Paper
                className="premium-glass"
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: { sm: 'none' },
                    zIndex: 1300,
                    pb: 'env(safe-area-inset-bottom)',
                    borderTop: '1px solid var(--border-color)',
                    boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.03)',
                }}
                elevation={0}
            >
                <BottomNavigation
                    showLabels
                    value={value >= 0 ? value : false}
                    onChange={handleNavChange}
                    sx={{
                        height: 64,
                        bgcolor: 'transparent',
                        '& .MuiBottomNavigationAction-root': {
                            color: 'var(--text-secondary)',
                            minWidth: 'auto',
                            padding: '6px 0',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            '&.Mui-selected': {
                                color: 'var(--brand-primary)',
                                transform: 'scale(1.08)',
                            },
                        },
                        '& .MuiBottomNavigationAction-label': {
                            fontSize: '0.62rem',
                            fontWeight: 600,
                            mt: 0.5,
                            transition: 'all 0.2s ease',
                            '&.Mui-selected': {
                                fontSize: '0.62rem',
                                fontWeight: 700,
                            }
                        }
                    }}
                >
                    {bottomNavItems.map((item, index) => (
                        <BottomNavigationAction
                            key={item.path}
                            label={item.label}
                            icon={item.icon}
                        />
                    ))}
                </BottomNavigation>
            </Paper>
        </>
    );
};

export default MobileBottomNav;
