import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#2563eb', // Vibrant Blue (Modern Enterprise)
            light: '#60a5fa',
            dark: '#1e40af',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#0f172a', // Deep Slate
            light: '#334155',
            dark: '#020617',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f8fafc', // Slate 50
            paper: '#ffffff',
        },
        text: {
            primary: '#0f172a', // Slate 900
            secondary: '#64748b', // Slate 500
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
        h1: { fontWeight: 800, letterSpacing: '-0.025em', color: '#0f172a' },
        h2: { fontWeight: 700, letterSpacing: '-0.025em', color: '#0f172a' },
        h3: { fontWeight: 700, letterSpacing: '-0.025em', color: '#0f172a' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em', color: '#0f172a' },
        h5: { fontWeight: 600, letterSpacing: '-0.015em', color: '#0f172a' },
        h6: { fontWeight: 600, letterSpacing: '-0.01em', color: '#0f172a' },
        subtitle1: { fontWeight: 500, letterSpacing: '0em', color: '#334155' },
        subtitle2: { fontWeight: 600, letterSpacing: '0em', color: '#334155' },
        body1: { fontSize: '1rem', lineHeight: 1.6, color: '#334155' },
        body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#475569' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
        borderRadius: 10, // Modern rounded corners
    },
    shadows: [
        'none',
        '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.06)', // 1: Soft
        '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)', // 2: Medium
        '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.05)', // 3: Floating
        '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)', // 4: High
        ...Array(20).fill('none') // Reset others to none or custom as needed
    ] as any,
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    padding: '8px 20px',
                    boxShadow: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    }
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #f1f5f9', // Very subtle border
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
                    border: '1px solid #e2e8f0',
                },
                elevation2: {
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
                    border: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
                    '&:hover': {
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
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '16px',
                },
                body: {
                    padding: '16px',
                    color: '#334155',
                    borderBottom: '1px solid #f8fafc',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:hover': {
                        backgroundColor: '#f8fafc !important',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 500,
                    borderRadius: '8px',
                },
                filled: {
                    border: '1px solid transparent',
                },
                outlined: {
                    borderWidth: '1px',
                }
            }
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: '16px',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 10px 10px -5px rgb(0 0 0 / 0.04)',
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#0f172a',
                    boxShadow: 'none',
                }
            }
        }
    },
});

export default theme;

