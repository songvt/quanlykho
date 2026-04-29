import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#2563eb', // 5F Template Modern Blue
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#64748b', // Slate accent
            light: '#94a3b8',
            dark: '#475569',
            contrastText: '#ffffff',
        },
        info: {
            main: '#0ea5e9',
            light: '#38bdf8',
            dark: '#0369a1',
            contrastText: '#ffffff',
        },
        success: {
            main: '#10b981',
            light: '#34d399',
            dark: '#059669',
            contrastText: '#ffffff',
        },
        warning: {
            main: '#f59e0b',
            light: '#fbbf24',
            dark: '#d97706',
            contrastText: '#ffffff',
        },
        error: {
            main: '#ef4444',
            light: '#f87171',
            dark: '#dc2626',
            contrastText: '#ffffff',
        },
        background: {
            default: '#fbfbfb', // 5F Style Background
            paper: '#ffffff',
        },
        text: {
            primary: '#09090b', // Zinc 950
            secondary: '#71717a', // Zinc 500
        },
        action: {
            hover: 'rgba(37, 99, 235, 0.04)',
            selected: 'rgba(37, 99, 235, 0.08)',
        },
    },
    typography: {
        fontFamily: [
            '"Inter"',
            '"Public Sans"',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            'sans-serif',
        ].join(','),
        h1: { fontWeight: 800, letterSpacing: '-0.025em', color: '#09090b' },
        h2: { fontWeight: 700, letterSpacing: '-0.025em', color: '#09090b' },
        h3: { fontWeight: 700, letterSpacing: '-0.025em', color: '#09090b' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em', color: '#09090b' },
        h5: { fontWeight: 600, letterSpacing: '-0.015em', color: '#09090b' },
        h6: { fontWeight: 600, letterSpacing: '-0.01em', color: '#09090b' },
        subtitle1: { fontWeight: 500, letterSpacing: '0em', color: '#27272a' },
        subtitle2: { fontWeight: 600, letterSpacing: '0em', color: '#27272a' },
        body1: { fontSize: '0.9375rem', lineHeight: 1.6, color: '#3f3f46' },
        body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#71717a' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
        borderRadius: 12, // 5F Style Large Radius
    },
    shadows: [
        'none',
        '0 1px 2px 0 rgba(0, 0, 0, 0.05)', // 1
        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // 2
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // 3
        '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // 4
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)', // 5
        ...Array(19).fill('none') 
    ] as any,
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease-in-out',
                },
                containedPrimary: {
                    backgroundColor: '#2563eb',
                    '&:hover': {
                        backgroundColor: '#1d4ed8',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                    },
                },
                outlined: {
                    borderWidth: '1.5px',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                        borderWidth: '1.5px',
                        backgroundColor: '#f8fafc',
                    }
                }
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: '16px',
                },
                elevation0: {
                    border: '1px solid #e2e8f0',
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    border: '1px solid #f1f5f9',
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        borderColor: '#cbd5e1',
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontWeight: 600,
                    textTransform: 'none',
                    fontSize: '0.875rem',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '12px 16px',
                },
                body: {
                    padding: '16px',
                    color: '#09090b',
                    borderBottom: '1px solid #f1f5f9',
                },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#94a3b8',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#2563eb',
                        borderWidth: '2px',
                    }
                }
            }
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(8px)',
                    borderBottom: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    color: '#09090b',
                }
            }
        }
    },
});

export default theme;
