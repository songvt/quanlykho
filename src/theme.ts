import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#0f2b5b', // Deep Blue Enterprise
            light: '#1e4b9b',
            dark: '#081734',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#e11d48', // Vibrant Crimson Accent
            light: '#fb7185',
            dark: '#be123c',
            contrastText: '#ffffff',
        },
        background: {
            default: '#f4f7fb', // Soft modern cloud-white
            paper: '#ffffff',
        },
        text: {
            primary: '#111827', // Gray 900
            secondary: '#4b5563', // Gray 600
        },
        action: {
            hover: 'rgba(15, 43, 91, 0.04)',
            selected: 'rgba(15, 43, 91, 0.08)',
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
        h1: { fontWeight: 800, letterSpacing: '-0.025em', color: '#111827' },
        h2: { fontWeight: 700, letterSpacing: '-0.025em', color: '#111827' },
        h3: { fontWeight: 700, letterSpacing: '-0.025em', color: '#111827' },
        h4: { fontWeight: 700, letterSpacing: '-0.02em', color: '#111827' },
        h5: { fontWeight: 600, letterSpacing: '-0.015em', color: '#111827' },
        h6: { fontWeight: 600, letterSpacing: '-0.01em', color: '#111827' },
        subtitle1: { fontWeight: 500, letterSpacing: '0em', color: '#374151' },
        subtitle2: { fontWeight: 600, letterSpacing: '0em', color: '#374151' },
        body1: { fontSize: '1rem', lineHeight: 1.6, color: '#4b5563' },
        body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#4b5563' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
        borderRadius: 12, // More rounded modern approach
    },
    shadows: [
        'none',
        '0 2px 5px -1px rgba(0,0,0,0.05)', // 1: Extreme soft (cards)
        '0 4px 10px -2px rgba(0,0,0,0.05)', // 2: Medium elevation
        '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.05)', // 3: Floating dialogs
        '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', // 4: High floating
        ...Array(20).fill('none')
    ] as any,
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    padding: '8px 24px',
                    boxShadow: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.25s ease-out',
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.12)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #1e4b9b 0%, #0f2b5b 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #255bb8 0%, #153a7a 100%)',
                        boxShadow: '0 6px 14px rgba(15, 43, 91, 0.3)',
                    },
                },
                containedError: {
                    background: 'linear-gradient(135deg, #fb7185 0%, #e11d48 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #f43f5e 0%, #be123c 100%)',
                        boxShadow: '0 6px 14px rgba(225, 29, 72, 0.3)',
                    },
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #e5e7eb', // subtle gray border
                },
                elevation1: {
                    boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)',
                    border: '1px solid #f3f4f6',
                },
                elevation2: {
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                    border: 'none',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    border: '1px solid #f3f4f6',
                    boxShadow: '0 2px 8px -2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s',
                    '&:hover': {
                        borderColor: '#e5e7eb',
                        boxShadow: '0 8px 16px -4px rgba(0,0,0,0.08)',
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f8fafc', // extremely subtle blue-gray tint
                    color: '#6b7280',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: '0.05em',
                    borderBottom: '2px solid #e5e7eb',
                    padding: '16px',
                },
                body: {
                    padding: '16px',
                    color: '#374151',
                    borderBottom: '1px solid #f3f4f6',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s',
                    '&:hover': {
                        backgroundColor: '#fbfcfd !important',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                    borderRadius: '8px',
                    fontSize: '0.75rem',
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
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: '1px solid #f3f4f6',
                    color: '#111827',
                    boxShadow: 'none',
                }
            }
        }
    },
});

export default theme;

