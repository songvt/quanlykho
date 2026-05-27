import { createTheme } from '@mui/material/styles';

const theme = createTheme({
    palette: {
        primary: {
            main: '#2563eb',
            light: '#60a5fa',
            dark: '#1d4ed8',
            contrastText: '#ffffff',
        },
        secondary: {
            main: '#64748b',
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
            default: '#f1f5f9',
            paper: '#ffffff',
        },
        text: {
            primary: '#0f172a',
            secondary: '#64748b',
        },
        action: {
            hover: 'rgba(37, 99, 235, 0.04)',
            selected: 'rgba(37, 99, 235, 0.08)',
        },
    },
    typography: {
        // Inter font - modern, highly legible
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        h1: { fontWeight: 800, letterSpacing: '-0.03em' },
        h2: { fontWeight: 700, letterSpacing: '-0.025em' },
        h3: { fontWeight: 700, letterSpacing: '-0.022em' },
        h4: { fontWeight: 700, letterSpacing: '-0.018em' },
        h5: { fontWeight: 600, letterSpacing: '-0.015em' },
        h6: { fontWeight: 600, letterSpacing: '-0.012em' },
        subtitle1: { fontWeight: 500, letterSpacing: '-0.01em' },
        subtitle2: { fontWeight: 600, letterSpacing: '-0.008em' },
        body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
        body2: { fontSize: '0.875rem', lineHeight: 1.57 },
        caption: { letterSpacing: '0.01em', fontSize: '0.75rem' },
        button: { fontWeight: 600, textTransform: 'none', letterSpacing: '0.01em' },
    },
    shape: {
        borderRadius: 12,
    },
    shadows: [
        'none',
        '0 1px 2px 0 rgba(0,0,0,0.05)',
        '0 2px 4px -1px rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.04)',
        '0 6px 12px -2px rgba(0,0,0,0.08), 0 2px 4px -2px rgba(0,0,0,0.04)',
        '0 12px 24px -4px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.04)',
        '0 20px 40px -8px rgba(0,0,0,0.12)',
        ...Array(19).fill('none')
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
                    letterSpacing: '-0.011em',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
                },
            },
        },
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    // Minimum touch target 44px
                    minHeight: '44px',
                    padding: '10px 20px',
                    transition: 'all 0.2s ease-in-out',
                },
                sizeSmall: {
                    minHeight: '36px',
                    padding: '6px 14px',
                    fontSize: '0.8125rem',
                },
                sizeLarge: {
                    minHeight: '52px',
                    padding: '14px 28px',
                    fontSize: '1rem',
                    borderRadius: '12px',
                },
                containedPrimary: {
                    background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)',
                    },
                    '&:active': {
                        transform: 'translateY(0)',
                    }
                },
                outlined: {
                    borderWidth: '1.5px',
                    borderColor: '#e2e8f0',
                    '&:hover': {
                        borderWidth: '1.5px',
                        backgroundColor: '#f8fafc',
                        borderColor: '#94a3b8',
                    }
                }
            },
        },
        MuiIconButton: {
            styleOverrides: {
                root: {
                    // Touch-friendly minimum 44x44
                    minWidth: '44px',
                    minHeight: '44px',
                    borderRadius: '10px',
                    '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.04)',
                    }
                },
                sizeSmall: {
                    minWidth: '36px',
                    minHeight: '36px',
                }
            }
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
                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                    border: '1px solid #f1f5f9',
                }
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    '&:hover': {
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                        borderColor: '#cbd5e1',
                        transform: 'translateY(-2px)',
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
                    textTransform: 'none',
                    fontSize: '0.8125rem',
                    letterSpacing: '0.01em',
                    borderBottom: '2px solid #e2e8f0',
                    padding: '10px 16px',
                    whiteSpace: 'nowrap',
                },
                body: {
                    padding: '12px 16px',
                    color: '#0f172a',
                    borderBottom: '1px solid #f1f5f9',
                    fontSize: '0.875rem',
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&:last-child td': {
                        borderBottom: 0,
                    }
                }
            }
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    backgroundColor: '#ffffff',
                    // Minimum height for touch
                    minHeight: '44px',
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#94a3b8',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#2563eb',
                        borderWidth: '2px',
                    },
                    '&.Mui-focused': {
                        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
                    }
                },
                input: {
                    fontSize: '16px', // Prevent iOS auto-zoom
                    padding: '11px 14px',
                }
            }
        },
        MuiInputLabel: {
            styleOverrides: {
                root: {
                    fontSize: '0.9rem',
                    fontWeight: 500,
                }
            }
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    fontSize: '16px', // Prevent iOS auto-zoom
                }
            }
        },
        MuiAutocomplete: {
            styleOverrides: {
                inputRoot: {
                    minHeight: '44px',
                }
            }
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: '20px',
                    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.2)',
                }
            }
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: {
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    padding: '20px 24px 12px',
                }
            }
        },
        MuiAppBar: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    borderBottom: '1px solid #e2e8f0',
                    boxShadow: '0 1px 0 #e2e8f0',
                    color: '#0f172a',
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    height: '28px',
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    borderRadius: '10px',
                    // Touch-friendly
                    minHeight: '44px',
                    '&:active': {
                        transform: 'scale(0.98)',
                    }
                }
            }
        },
        MuiMenuItem: {
            styleOverrides: {
                root: {
                    minHeight: '44px',
                    borderRadius: '8px',
                    margin: '2px 4px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                }
            }
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#0f172a',
                    padding: '6px 10px',
                }
            }
        },
        MuiSkeleton: {
            styleOverrides: {
                root: {
                    borderRadius: '8px',
                }
            }
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    minHeight: '44px',
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                }
            }
        },
        MuiSnackbar: {
            styleOverrides: {
                root: {
                    bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
                }
            }
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: '1px solid',
                },
                standardSuccess: {
                    borderColor: '#bbf7d0',
                    backgroundColor: '#f0fdf4',
                },
                standardError: {
                    borderColor: '#fecaca',
                    backgroundColor: '#fef2f2',
                },
                standardWarning: {
                    borderColor: '#fde68a',
                    backgroundColor: '#fffbeb',
                },
                standardInfo: {
                    borderColor: '#bae6fd',
                    backgroundColor: '#f0f9ff',
                },
            }
        },
        MuiBottomNavigation: {
            styleOverrides: {
                root: {
                    backgroundColor: 'rgba(255,255,255,0.95)',
                    backdropFilter: 'blur(12px)',
                    height: '64px',
                    borderTop: '1px solid #e2e8f0',
                }
            }
        },
        MuiBottomNavigationAction: {
            styleOverrides: {
                root: {
                    minWidth: '48px',
                    padding: '8px 4px',
                    color: '#94a3b8',
                    '&.Mui-selected': {
                        color: '#2563eb',
                    },
                    '& .MuiBottomNavigationAction-label': {
                        fontSize: '0.65rem !important',
                        fontWeight: 600,
                        marginTop: '2px',
                        '&.Mui-selected': {
                            fontSize: '0.65rem !important',
                        }
                    }
                }
            }
        }
    },
});

export default theme;
