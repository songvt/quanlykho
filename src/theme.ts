import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#0b3d2b', // Dark Green ERP Primary
            light: '#145c42',
            dark: '#06291d',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#0f766e', // Teal accent
            light: '#14b8a6',
            dark: '#0d5e58',
            contrastText: '#ffffff',
        },
        info: {
            main: '#3b82f6',
            light: '#60a5fa',
            dark: '#2563eb',
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
            default: '#f4f7fb', // Soft modern cloud-white
            paper: '#ffffff',
        },
        text: {
            primary: '#0f172a', // Gray 900
            secondary: '#475569', // Gray 600
        },
        action: {
            hover: 'rgba(11, 61, 43, 0.04)', // Tinted hover
            selected: 'rgba(11, 61, 43, 0.08)',
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
        body1: { fontSize: '1rem', lineHeight: 1.6, color: '#475569' },
        body2: { fontSize: '0.875rem', lineHeight: 1.5, color: '#475569' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
        borderRadius: 8, // Standardize globally at 8px for true enterprise software look
    },
    shadows: [
        'none',
        '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)', // 1
        '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', // 2
        '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // 3
        '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', // 4
        '0 25px 50px -12px rgba(0, 0, 0, 0.25)', // 5
        ...Array(19).fill('none') // Pad rest to 25
    ] as any,
    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true, // Modern flat look for contained buttons initially
            },
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    transition: 'all 0.2s ease-in-out',
                },
                sizeSmall: {
                    padding: '4px 12px',
                    fontSize: '0.8125rem',
                },
                sizeMedium: {
                    padding: '8px 24px',
                },
                sizeLarge: {
                    padding: '10px 32px',
                    fontSize: '1rem',
                },
                // Clean contained variants with subtle gradient and dynamic shadow on hover
                contained: {
                    '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                    }
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #145c42 0%, #0b3d2b 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #1b7a58 0%, #0e4c36 100%)',
                        boxShadow: '0 6px 14px rgba(11, 61, 43, 0.3)',
                    },
                },
                containedSecondary: {
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #2dd4bf 0%, #0d5e58 100%)',
                        boxShadow: '0 6px 14px rgba(15, 118, 110, 0.3)',
                    },
                },
                containedError: {
                    background: 'linear-gradient(135deg, #f87171 0%, #dc2626 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                        boxShadow: '0 6px 14px rgba(220, 38, 38, 0.3)',
                    },
                },
                containedSuccess: {
                    background: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                        boxShadow: '0 6px 14px rgba(5, 150, 105, 0.3)',
                    },
                },
                containedWarning: {
                    background: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                        boxShadow: '0 6px 14px rgba(217, 119, 6, 0.3)',
                    },
                },
                containedInfo: {
                    background: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        boxShadow: '0 6px 14px rgba(37, 99, 235, 0.3)',
                    },
                },
                outlined: {
                    borderWidth: '1.5px',
                    borderColor: '#e5e7eb',
                    '&:hover': {
                        borderWidth: '1.5px',
                        backgroundColor: '#f9fafb',
                    }
                },
                outlinedPrimary: {
                    borderColor: '#0b3d2b',
                    '&:hover': {
                        backgroundColor: 'rgba(11, 61, 43, 0.04)',
                        borderColor: '#0b3d2b',
                    }
                },
                text: {
                    '&:hover': {
                        backgroundColor: 'rgba(11, 61, 43, 0.04)',
                    }
                }
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    borderRadius: '8px', 
                    padding: '8px',
                    transition: 'all 0.2s',
                    '&:hover': {
                        backgroundColor: 'rgba(11, 61, 43, 0.08)',
                    }
                }
            }
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    transition: 'all 0.2s ease-in-out',
                    backgroundColor: '#ffffff',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#94a3b8',
                    },
                    '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(11, 61, 43, 0.15)', // ERP Brand glow
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#0b3d2b',
                            borderWidth: '1px',
                        }
                    },
                    '&.Mui-error.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.15)', 
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: '#dc2626',
                            borderWidth: '1px',
                        }
                    }
                },
                notchedOutline: {
                    borderColor: '#cbd5e1',
                    borderWidth: '1px',
                },
                input: {
                    padding: '10.5px 14px', // Nice clean sizing
                },
                sizeSmall: {
                    '& .MuiInputBase-input': {
                        padding: '8.5px 14px',
                    }
                }
            }
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '0.9rem',
                    color: '#64748b',
                    '&.Mui-focused': {
                        color: '#0b3d2b',
                    },
                    '&.Mui-error': {
                        color: '#dc2626',
                    }
                },
                sizeSmall: {
                    transform: 'translate(14px, 9px) scale(1)', // adjust for padding
                    '&.MuiInputLabel-shrink': {
                        transform: 'translate(14px, -9px) scale(0.75)',
                    }
                }
            }
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid #e2e8f0', // soft border 
                },
                elevation1: {
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    border: '1px solid #f1f5f9',
                },
                elevation2: {
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    border: '1px solid #f1f5f9',
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                    transition: 'all 0.25s',
                    '&:hover': {
                        borderColor: '#cbd5e1',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    }
                }
            }
        },
        MuiCardHeader: {
            styleOverrides: {
                root: {
                    padding: '20px 24px',
                    borderBottom: '1px solid #f1f5f9',
                },
                title: {
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: '#0f172a',
                }
            }
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '24px',
                    '&:last-child': {
                        paddingBottom: '24px', // Override MUI default behavior
                    }
                }
            }
        },
        MuiMenu: {
            styleOverrides: {
                paper: {
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    border: '1px solid #e2e8f0',
                    marginTop: '8px',
                }
            }
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    fontSize: '0.875rem',
                    padding: '8px 16px',
                    margin: '4px 8px',
                    borderRadius: '6px',
                    transition: 'background-color 0.15s',
                    '&:hover': {
                        backgroundColor: '#f1f5f9',
                    },
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(11, 61, 43, 0.08)',
                        color: '#0b3d2b',
                        fontWeight: 600,
                        '&:hover': {
                            backgroundColor: 'rgba(11, 61, 43, 0.12)',
                        }
                    }
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#f8fafc',
                    color: '#64748b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                    borderBottom: '1px solid #e2e8f0',
                    padding: '16px',
                },
                body: {
                    padding: '16px',
                    color: '#334155',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.875rem',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    transition: 'background-color 0.15s',
                    '&:hover': {
                        backgroundColor: '#f8fafc !important',
                    },
                },
            },
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    fontWeight: 600,
                    borderRadius: '6px', // modern square-ish chip
                    fontSize: '0.75rem',
                    height: '24px',
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
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                }
            }
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    padding: '24px 24px 16px',
                }
            }
        },
        MuiDialogContent: {
            styleOverrides: {
                root: {
                    padding: '24px',
                }
            }
        },
        MuiDialogActions: {
            styleOverrides: {
                root: {
                    padding: '16px 24px 24px',
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e2e8f0',
                    color: '#0f172a',
                    boxShadow: 'none',
                }
            }
        }
    },
});

export default theme;
