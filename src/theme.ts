import { createTheme, alpha } from '@mui/material/styles';

const colors = {
    primary: '#2563EB', // --brand-primary
    primaryHover: '#4F46E5', // --brand-secondary
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
            default: '#f6f8fb',
            paper: colors.surface,
        },
        text: {
            primary: colors.slate900,
            secondary: colors.slate500,
        },
        divider: colors.slate200,
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
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                    letterSpacing: 0,
                    backgroundColor: '#f6f8fb',
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    minHeight: 40,
                    padding: '8px 16px',
                    transition: 'background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease',
                },
                sizeSmall: {
                    minHeight: 34,
                    padding: '6px 12px',
                    fontSize: '0.8125rem',
                },
                sizeLarge: {
                    minHeight: 48,
                    padding: '12px 20px',
                    fontSize: '0.95rem',
                },
                containedPrimary: {
                    background: colors.primary,
                    '&:hover': {
                        background: colors.primaryHover,
                    },
                },
                outlined: {
                    borderColor: colors.slate300,
                    '&:hover': {
                        borderColor: colors.slate400,
                        backgroundColor: colors.slate50,
                    },
                },
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    minWidth: 40,
                    minHeight: 40,
                    borderRadius: 8,
                    color: colors.slate600,
                    '&:hover': {
                        backgroundColor: colors.slate100,
                        color: colors.slate900,
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
                    border: `1px solid ${colors.slate200}`,
                    borderRadius: 10,
                },
                elevation0: {
                    border: `1px solid ${colors.slate200}`,
                },
                elevation1: {
                    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 20,
                    border: '1px solid var(--border-color)',
                    boxShadow: 'none',
                    backgroundColor: 'var(--bg-card)',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                    '&:hover': {
                        borderColor: 'var(--brand-primary)',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                        transform: 'translateY(-2px)'
                    },
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: colors.slate50,
                    color: colors.slate600,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    borderBottom: `1px solid ${colors.slate200}`,
                    padding: '10px 14px',
                    whiteSpace: 'nowrap',
                },
                body: {
                    padding: '11px 14px',
                    color: colors.slate900,
                    borderBottom: `1px solid ${colors.slate100}`,
                    fontSize: '0.875rem',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&.MuiTableRow-hover:hover': {
                        backgroundColor: colors.slate50,
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
                    borderRadius: 8,
                    backgroundColor: colors.surface,
                    minHeight: 40,
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.slate400,
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: colors.primary,
                        borderWidth: 1,
                    },
                    '&.Mui-focused': {
                        boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
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
                    borderRadius: 12,
                    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1rem',
                    fontWeight: 700,
                    padding: '18px 22px 10px',
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255,255,255,0.96)',
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                    borderBottom: `1px solid ${colors.slate200}`,
                    boxShadow: 'none',
                    color: colors.slate900,
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
                    backgroundColor: 'rgba(255,255,255,0.98)',
                    height: 62,
                    borderTop: `1px solid ${colors.slate200}`,
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
