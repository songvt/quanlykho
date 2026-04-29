import React from 'react';
import { Box, Grid, Paper, Skeleton } from '@mui/material';

/**
 * DashboardSkeleton
 * Hiển thị khung xám khi Dashboard đang tải dữ liệu.
 * Giúp giao diện không bị giật lag và trông chuyên nghiệp hơn.
 */
const DashboardSkeleton = () => {
    return (
        <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
            {/* Header Skeleton */}
            <Box mb={4}>
                <Skeleton variant="text" width={200} height={40} sx={{ mb: 1 }} />
                <Skeleton variant="text" width={340} height={24} />
            </Box>

            {/* KPI Cards Skeleton */}
            <Grid container spacing={2} mb={3}>
                {[1, 2, 3, 4].map((i) => (
                    <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid #e2e8f0', height: 140 }}>
                            <Box display="flex" alignItems="center" gap={1} mb={2}>
                                <Skeleton variant="circular" width={24} height={24} />
                                <Skeleton variant="text" width={100} />
                            </Box>
                            <Skeleton variant="text" width="60%" height={48} sx={{ mb: 1 }} />
                            <Skeleton variant="text" width="80%" />
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Charts Skeleton */}
            <Grid container spacing={3} mb={4}>
                <Grid size={{ xs: 12, lg: 8 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: 420, border: '1px solid #e2e8f0' }}>
                        <Box display="flex" justifyContent="space-between" mb={3}>
                            <Skeleton variant="text" width={250} height={32} />
                            <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 1 }} />
                        </Box>
                        <Skeleton variant="rectangular" width="100%" height="80%" sx={{ borderRadius: 2 }} />
                    </Paper>
                </Grid>
                <Grid size={{ xs: 12, lg: 4 }}>
                    <Paper elevation={0} sx={{ p: 3, borderRadius: 3, height: 420, border: '1px solid #e2e8f0' }}>
                        <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
                        <Box display="flex" justifyContent="center" alignItems="center" height="70%">
                            <Skeleton variant="circular" width={200} height={200} />
                        </Box>
                        <Box mt={2} display="flex" justifyContent="center" gap={1}>
                             {[1,2,3].map(i => <Skeleton key={i} variant="text" width={60} />)}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Recent Activity Skeleton */}
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <Box sx={{ px: 3, py: 2.5, borderBottom: '1px solid #e2e8f0' }}>
                    <Skeleton variant="text" width={200} height={32} />
                </Box>
                {[1, 2, 3, 4, 5].map((i) => (
                    <Box key={i} sx={{ py: 2, px: 3, display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                        <Skeleton variant="circular" width={40} height={40} sx={{ mr: 2 }} />
                        <Box sx={{ flexGrow: 1 }}>
                            <Skeleton variant="text" width="40%" height={24} />
                            <Skeleton variant="text" width="20%" />
                        </Box>
                        <Box textAlign="right">
                             <Skeleton variant="text" width={60} height={24} />
                             <Skeleton variant="text" width={80} />
                        </Box>
                    </Box>
                ))}
            </Paper>
        </Box>
    );
};

export default DashboardSkeleton;
