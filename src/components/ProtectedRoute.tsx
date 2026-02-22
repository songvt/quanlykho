import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import { CircularProgress, Box } from '@mui/material';
import { usePermission } from '../hooks/usePermission';
import type { PermissionCode } from '../types';

interface Props {
    allowedRoles?: ('admin' | 'manager' | 'staff')[];
    allowedPermissions?: PermissionCode[];
}

const ProtectedRoute = ({ allowedRoles, allowedPermissions }: Props) => {
    const { isAuthenticated, status, profile } = useSelector((state: RootState) => state.auth);
    const location = useLocation();
    const { hasAnyPermission } = usePermission();

    // Show loading while checking session
    if (status === 'loading' && !isAuthenticated) {
        return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Permission-based access control (preferred)
    if (allowedPermissions && allowedPermissions.length > 0) {
        if (!hasAnyPermission(allowedPermissions)) {
            return <Navigate to="/" replace />;
        }
    }
    // Fallback to Role-based access control (legacy)
    else if (allowedRoles && profile && !allowedRoles.includes(profile.role as any)) {
        return <Navigate to="/" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
