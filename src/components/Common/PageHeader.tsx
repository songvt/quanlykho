import React from 'react';
import { Box, Typography, Paper, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface PageHeaderProps {
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    gradientType?: 'blue' | 'dark' | 'green' | 'amber' | 'slate';
}

const accentMap: Record<NonNullable<PageHeaderProps['gradientType']>, string> = {
    blue: '#1d4ed8',
    dark: '#0f172a',
    green: '#059669',
    amber: '#d97706',
    slate: '#475569',
};

const PageHeader: React.FC<PageHeaderProps> = ({
    title,
    subtitle,
    icon,
    actions,
    gradientType = 'blue',
}) => {
    const accent = accentMap[gradientType] || accentMap.blue;

    return (
        <Paper
            elevation={0}
            sx={{
                px: { xs: 2, sm: 2.5 },
                py: { xs: 1.75, sm: 2 },
                mb: { xs: 2, sm: 2.5 },
                borderRadius: '10px',
                bgcolor: 'background.paper',
                borderLeft: `4px solid ${accent}`,
            }}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={{ xs: 1.5, md: 2 }}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
            >
                <Stack direction="row" spacing={1.5} alignItems="center" minWidth={0}>
                    {icon && (
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '8px',
                                bgcolor: alpha(accent, 0.1),
                                color: accent,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                '& .MuiSvgIcon-root': {
                                    color: accent,
                                    fontSize: 22,
                                },
                            }}
                        >
                            {icon}
                        </Box>
                    )}

                    <Box minWidth={0}>
                        <Typography
                            variant="h5"
                            sx={{
                                color: 'text.primary',
                                fontWeight: 700,
                                fontSize: { xs: '1.1rem', sm: '1.25rem' },
                                lineHeight: 1.25,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: { xs: 'normal', sm: 'nowrap' },
                            }}
                        >
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    mt: 0.25,
                                    maxWidth: 760,
                                }}
                            >
                                {subtitle}
                            </Typography>
                        )}
                    </Box>
                </Stack>

                {actions && (
                    <Stack
                        direction="row"
                        spacing={1}
                        useFlexGap
                        flexWrap="wrap"
                        justifyContent={{ xs: 'flex-start', md: 'flex-end' }}
                        sx={{
                            '& .MuiButton-root': {
                                borderRadius: '8px !important',
                                boxShadow: 'none !important',
                                transform: 'none !important',
                                '&:hover': {
                                    transform: 'none !important',
                                },
                            },
                            '& .MuiButton-contained:not(.MuiButton-colorError):not(.MuiButton-colorSuccess)': {
                                bgcolor: '#1d4ed8 !important',
                                color: '#ffffff !important',
                                border: '1px solid #1d4ed8 !important',
                                '&:hover': {
                                    bgcolor: '#1e40af !important',
                                },
                            },
                            '& .MuiButton-outlined, & .MuiButton-text': {
                                bgcolor: '#ffffff !important',
                            },
                        }}
                    >
                        {actions}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
};

export default PageHeader;
