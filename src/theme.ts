import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#0f172a', // Deep Navy - The Core Style
            light: '#334155',
            dark: '#020617', // Almost Black Navy
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#0ea5e9', // Cyan/Sky Blue - Neon Accent
            light: '#38bdf8',
            dark: '#0284c7',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f1f5f9', // Light Slate for content readability
            paper: '#ffffff',
        },
        text: {
            primary: '#0f172a',
            secondary: '#475569',
        },
        action: {
            hover: 'rgba(56, 189, 248, 0.08)', // Cyan hover
            selected: 'rgba(56, 189, 248, 0.12)',
        },
    },
    typography: {
        fontFamily: [
            '"Public Sans"', // Professional, data-focused font
            '"Inter"',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            'sans-serif',
        ].join(','),
        h1: { fontWeight: 800, letterSpacing: '-0.025em' },
        h2: { fontWeight: 700, letterSpacing: '-0.025em' },
        h3: { fontWeight: 700, letterSpacing: '-0.02em' },
        h4: { fontWeight: 700, letterSpacing: '-0.015em' },
        h5: { fontWeight: 600, letterSpacing: '-0.01em' },
        h6: { fontWeight: 600 },
        subtitle1: { fontWeight: 500, letterSpacing: '0.01em' },
        subtitle2: { fontWeight: 600, letterSpacing: '0.01em' },
        body1: { lineHeight: 1.6 },
        body2: { lineHeight: 1.5 },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.02em' },
    },
    shape: {
        borderRadius: 6, // Sharper corners for corporate feel
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '6px',
                    padding: '8px 20px',
                    boxShadow: 'none',
                    fontWeight: 600,
                    '&:hover': {
                        transform: 'none',
                        boxShadow: '0 2px 4px -1px rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
                    },
                    transition: 'all 0.2s ease-in-out',
                },
                containedPrimary: {
                    '&:hover': {
                        backgroundColor: '#1e293b', // Slate 800
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none', // Remove default dark mode overlay if present
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
                    border: '1px solid #e2e8f0', // Subtle border definition
                },
                elevation1: { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.06)' },
                elevation2: { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)' },
                elevation3: { boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)' },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f1f5f9', // Slate 100
                    color: '#475569', // Slate 600
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e2e8f0',
                },
                body: {
                    fontSize: '0.875rem',
                    color: '#334155', // Slate 700
                    borderBottom: '1px solid #f1f5f9',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: '#f8fafc',
                    },
                },
            },
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    boxShadow: 'none',
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(8px)',
                    color: '#0f172a',
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: '#020617', // Deepest Navy (The Core)
                    color: '#e2e8f0',
                    borderRight: '1px solid #1e293b',
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: '6px',
                    margin: '4px 8px',
                    '&.Mui-selected': {
                        backgroundColor: '#D32F2F', // ACT Red for selected item
                        color: 'white',
                        '&:hover': {
                            backgroundColor: '#9a0007', // Darker Red
                        },
                        '& .MuiListItemIcon-root': {
                            color: 'white',
                        },
                    },
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    },
                },
            },
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    color: '#94a3b8', // Slate 400
                    minWidth: '40px',
                },
            },
        },
    },
});

export default theme;
