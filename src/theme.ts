import { createTheme, alpha } from '@mui/material/styles';

const colors = {
    primary: '#3B82F6', // --brand-primary
    primaryHover: '#6366F1', // --brand-secondary
    slate900: '#0F172A',
    slate700: '#334155',
    slate600: '#475569',
    slate500: '#64748B',
    slate400: '#94A3B8',
    slate300: '#CBD5E1',
    slate200: '#E2E8F0',
    slate100: '#F1F5F9',
    slate50: '#F8FAFC',
    surface: '#FFFFFF',
};

const theme = createTheme({
    palette: {
        primary: {
            main: colors.primary,
            light: '#3b82f6',
            dark: colors.primaryHover,
            contrastText: '#ffffff',
        },
        secondary: {
            main: colors.slate600,
            light: colors.slate400,
            dark: colors.slate700,
            contrastText: '#ffffff',
        },
        info: {
            main: '#0284c7',
            light: '#38bdf8',
            dark: '#0369a1',
            contrastText: '#ffffff',
        },
        success: {
            main: '#059669',
            light: '#34d399',
            dark: '#047857',
            contrastText: '#ffffff',
        },
        warning: {
            main: '#d97706',
            light: '#fbbf24',
            dark: '#b45309',
            contrastText: '#ffffff',
        },
        error: {
            main: '#dc2626',
            light: '#f87171',
            dark: '#b91c1c',
            contrastText: '#ffffff',
        },
        background: {
            default: '#0B0F19',
            paper: '#0F172A',
        },
        text: {
            primary: '#F8FAFC',
            secondary: '#CBD5E1',
        },
        divider: 'rgba(255, 255, 255, 0.08)',
        action: {
            hover: alpha(colors.primary, 0.05),
            selected: alpha(colors.primary, 0.08),
            disabledBackground: colors.slate100,
        },
    },
    typography: {
        fontFamily: "var(--font-sans)",
        h1: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '32px' },
        h2: { fontWeight: 700, letterSpacing: '-0.01em', fontSize: '24px' },
        h3: { fontWeight: 600, letterSpacing: 0, fontSize: '20px' },
        h4: { fontWeight: 600, letterSpacing: 0, fontSize: '18px' },
        h5: { fontWeight: 600, letterSpacing: 0, fontSize: '16px' },
        h6: { fontWeight: 600, letterSpacing: 0, fontSize: '14px' },
        subtitle1: { fontWeight: 600, letterSpacing: 0, fontSize: '16px' },
        subtitle2: { fontWeight: 600, letterSpacing: 0, fontSize: '14px' },
        body1: { fontSize: '14px', lineHeight: 1.6, letterSpacing: 0 },
        body2: { fontSize: '14px', lineHeight: 1.5, letterSpacing: 0 },
        caption: { fontSize: '12px', letterSpacing: 0 },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: 0, fontSize: '14px' },
    },
    shape: {
        borderRadius: 12,
    },
    shadows: [
        'none',
        '0 1px 2px rgba(15, 23, 42, 0.06)',
        '0 4px 12px rgba(15, 23, 42, 0.08)',
        '0 8px 20px rgba(15, 23, 42, 0.10)',
        '0 12px 28px rgba(15, 23, 42, 0.12)',
        '0 18px 36px rgba(15, 23, 42, 0.14)',
        ...Array(19).fill('none'),
    ] as any,
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
        },
    },
    components: {
        MuiCssBaseline: {
            styleOverrides: {
                body: {
                    fontFamily: "'Be Vietnam Pro', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    letterSpacing: 0,
                    background: 'var(--bg-default)',
                    color: 'var(--text-primary)',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    minHeight: 40,
                    padding: '8px 18px',
                    fontWeight: 600,
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                    },
                    '&:active': {
                        transform: 'translateY(1px)',
                    },
                },
                sizeSmall: {
                    minHeight: 34,
                    padding: '6px 12px',
                    fontSize: '0.8125rem',
                },
                sizeLarge: {
                    minHeight: 48,
                    padding: '12px 24px',
                    fontSize: '0.95rem',
                },
                containedPrimary: {
                    background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryHover} 100%)`,
                    boxShadow: `0 4px 14px 0 ${alpha(colors.primary, 0.35)}`,
                    '&:hover': {
                        background: `linear-gradient(135deg, ${colors.primaryHover} 0%, ${colors.primary} 100%)`,
                        boxShadow: `0 6px 20px 0 ${alpha(colors.primary, 0.45)}`,
                    },
                },
                outlined: {
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                    '&:hover': {
                        borderColor: 'var(--brand-primary)',
                        backgroundColor: 'rgba(37, 99, 235, 0.04)',
                    },
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    minWidth: 40,
                    minHeight: 40,
                    borderRadius: 10,
                    color: 'var(--text-secondary)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        backgroundColor: 'var(--bg-glass-hover)',
                        color: 'var(--text-primary)',
                        transform: 'scale(1.05)',
                    },
                    '&:active': {
                        transform: 'scale(0.95)',
                    },
                },
                sizeSmall: {
                    minWidth: 34,
                    minHeight: 34,
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: 'var(--bg-glass)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'var(--shadow-glass)',
                    color: 'var(--text-primary)',
                    borderRadius: 16,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                },
                elevation0: {
                    border: '1px solid var(--border-glass)',
                },
                elevation1: {
                    boxShadow: 'var(--shadow-glass)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 20,
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'var(--shadow-glass)',
                    backgroundColor: 'var(--bg-glass)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    '&:hover': {
                        borderColor: 'var(--border-glass-hover)',
                        boxShadow: 'var(--shadow-glass-hover)',
                        transform: 'translateY(-4px)',
                        backgroundColor: 'var(--bg-glass-hover)',
                    },
                    '&:active': {
                        transform: 'scale(0.98)',
                        transition: 'transform 0.1s ease',
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundImage: 'linear-gradient(135deg, rgba(15, 23, 42, 0.82) 0%, rgba(30, 41, 59, 0.92) 100%), url(/login_bg_warehouse.png) !important',
                    backgroundSize: 'cover !important',
                    backgroundPosition: 'center !important',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    borderRight: '1px solid rgba(255, 255, 255, 0.1) !important',
                    boxShadow: 'var(--shadow-glass)',
                },
            },
        },
        MuiPopover: {
            styleOverrides: {
                paper: {
                    backgroundColor: 'var(--bg-glass)',
                    backdropFilter: 'blur(24px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(200%)',
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'var(--shadow-glass)',
                    borderRadius: 12,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: 'rgba(0, 0, 0, 0.02)',
                    color: 'var(--text-secondary)',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    borderBottom: '1px solid var(--border-glass)',
                    padding: '10px 16px',
                    whiteSpace: 'nowrap',
                },
                body: {
                    padding: '8px 16px',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--border-glass)',
                    fontSize: '0.875rem',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&.MuiTableRow-hover:hover': {
                        backgroundColor: 'rgba(37, 99, 235, 0.05)',
                    },
                    '&:last-child td': {
                        borderBottom: 0,
                    },
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                    backgroundColor: 'var(--bg-glass)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    minHeight: 40,
                    transition: 'all 0.2s ease',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--border-glass)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--border-glass-hover)',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'var(--brand-primary)',
                        borderWidth: '1.5px',
                    },
                    '&.Mui-focused': {
                        boxShadow: `0 0 0 4px ${alpha(colors.primary, 0.15)}`,
                        backgroundColor: 'var(--bg-glass-hover)',
                    },
                },
                input: {
                    fontSize: 16,
                    padding: '10px 12px',
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '0.875rem',
                    fontWeight: 500,
                },
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    fontSize: 16,
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 20,
                    backgroundColor: 'var(--bg-glass)',
                    backdropFilter: 'blur(24px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(24px) saturate(190%)',
                    border: '1px solid var(--border-glass)',
                    boxShadow: 'var(--shadow-glass-hover)',
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1rem',
                    fontWeight: 700,
                    padding: 'calc(18px + env(safe-area-inset-top, 0px)) 22px 10px',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'var(--bg-glass) !important',
                    backdropFilter: 'blur(20px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(190%)',
                    borderBottom: '1px solid var(--border-glass) !important',
                    boxShadow: 'none',
                    color: 'var(--text-primary)',
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: 26,
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    minHeight: 40,
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    minHeight: 38,
                    borderRadius: 6,
                    margin: '2px 4px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    borderRadius: 6,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: colors.slate900,
                    padding: '6px 9px',
                },
            },
        },
        MuiSkeleton: {
            styleOverrides: {
                root: {
                    borderRadius: 6,
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    minHeight: 40,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                },
            },
        },
        MuiSnackbar: {
            styleOverrides: {
                root: {
                    bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: '1px solid',
                },
            },
        },
        MuiBottomNavigation: {
            styleOverrides: {
                root: {
                    backgroundColor: 'var(--bg-glass) !important',
                    backdropFilter: 'blur(20px) saturate(190%)',
                    WebkitBackdropFilter: 'blur(20px) saturate(190%)',
                    height: 62,
                    borderTop: '1px solid var(--border-glass) !important',
                    boxShadow: 'var(--shadow-glass)',
                },
            },
        },
        MuiBottomNavigationAction: {
            styleOverrides: {
                root: {
                    minWidth: 48,
                    padding: '7px 4px',
                    color: colors.slate400,
                    '&.Mui-selected': {
                        color: colors.primary,
                    },
                    '& .MuiBottomNavigationAction-label': {
                        fontSize: '0.65rem !important',
                        fontWeight: 600,
                        marginTop: 2,
                    },
                },
            },
        },
    },
});

export default theme;
