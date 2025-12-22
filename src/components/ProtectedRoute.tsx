import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { CircularProgress, Box } from '@mui/material';

interface Props {
    allowedRoles?: ('admin' | 'manager' | 'staff')[];
}

const ProtectedRoute = ({ allowedRoles }: Props) => {
    const { isAuthenticated, status, profile } = useSelector((state: RootState) => state.auth);
    const location = useLocation();

    // Show loading while checking session
    if (status === 'loading' && !isAuthenticated) {
        return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Role-based access control
    if (allowedRoles && profile && !allowedRoles.includes(profile.role as any)) {
        // User is logged in but doesn't have permission
        // You might want a specific "Unauthorized" page, for now redirect root
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
