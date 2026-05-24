import React from 'react';
import { Box, Typography, Paper, Stack, Grid } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    gradientType?: 'blue' | 'dark' | 'green' | 'amber' | 'slate';
}

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon,
    actions,
    gradientType = 'blue'
}) => {
    // Define gradients and shadows based on type
    const configs = {
        blue: {
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #1d4ed8 100%)',
            shadow: '0 10px 25px -5px rgba(37, 99, 235, 0.3)',
            glowBg: 'rgba(255, 255, 255, 0.1)',
            iconBg: 'rgba(255, 255, 255, 0.18)',
        },
        dark: {
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
            shadow: '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
            glowBg: 'rgba(250, 204, 21, 0.08)',
            iconBg: 'rgba(255, 255, 255, 0.08)',
        },
        green: {
            background: 'linear-gradient(135deg, #064e3b 0%, #10b981 50%, #047857 100%)',
            shadow: '0 10px 25px -5px rgba(16, 185, 129, 0.3)',
            glowBg: 'rgba(255, 255, 255, 0.1)',
            iconBg: 'rgba(255, 255, 255, 0.18)',
        },
        amber: {
            background: 'linear-gradient(135deg, #78350f 0%, #f59e0b 50%, #b45309 100%)',
            shadow: '0 10px 25px -5px rgba(245, 158, 11, 0.3)',
            glowBg: 'rgba(255, 255, 255, 0.1)',
            iconBg: 'rgba(255, 255, 255, 0.18)',
        },
        slate: {
            background: 'linear-gradient(135deg, #334155 0%, #64748b 50%, #475569 100%)',
            shadow: '0 10px 25px -5px rgba(100, 116, 139, 0.3)',
            glowBg: 'rgba(255, 255, 255, 0.1)',
            iconBg: 'rgba(255, 255, 255, 0.15)',
        }
    };

    const config = configs[gradientType] || configs.blue;

    return (
        <Paper
            elevation={3}
            sx={{
                p: { xs: 2.5, md: 3.5 },
                mb: 4,
                background: config.background,
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
                color: 'white',
                boxShadow: config.shadow,
                borderRadius: '20px',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: -50,
                    right: -50,
                    width: 200,
                    height: 200,
                    borderRadius: '50%',
                    background: config.glowBg,
                    filter: 'blur(35px)',
                    pointerEvents: 'none'
                }
            }}
        >
            <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                <Grid size={{ xs: 12, md: actions ? 7 : 12 }}>
                    <Stack direction="row" spacing={2.5} alignItems="center">
                        {icon && (
                            <Box
                                sx={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: '14px',
                                    background: config.iconBg,
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    backdropFilter: 'blur(10px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.08)'
                                }}
                            >
                                {icon}
                            </Box>
                        )}
                        <Box>
                            <Typography
                                variant="h4"
                                sx={{
                                    fontWeight: 900,
                                    color: '#ffffff',
                                    letterSpacing: '-0.02em',
                                    fontSize: { xs: '1.5rem', sm: '1.85rem', md: '2.1rem' },
                                    textTransform: 'uppercase',
                                    textShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                {title}
                            </Typography>
                            {subtitle && (
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: 'rgba(255, 255, 255, 0.85)',
                                        fontWeight: 500,
                                        mt: 0.5,
                                        fontSize: { xs: '0.8rem', sm: '0.9rem' }
                                    }}
                                >
                                    {subtitle}
                                </Typography>
                            )}
                        </Box>
                    </Stack>
                </Grid>
                {actions && (
                    <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' } }}>
                        <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1} width={{ xs: '100%', sm: 'auto' }}>
                            {actions}
                        </Stack>
                    </Grid>
                )}
            </Grid>
        </Paper>
    );
};

export default PageHeader;
