import { useSelector } from 'react-redux';
import type { RootState } from '../store';
import type { PermissionCode } from '../types';

export const usePermission = () => {
    const { profile } = useSelector((state: RootState) => state.auth);

    const hasPermission = (code: PermissionCode) => {
        if (!profile) return false;

        // Admin and Manager usually have full access, or at least Admin does
        // Based on requirements, Admin has full power. 
        if (profile.role === 'admin') return true;

        const permissions = profile.permissions || [];

        // Check for wildcard access
        if (permissions.includes('*')) return true;

        // Check specific permission
        return permissions.includes(code);
    };

    /**
     * Check if user has ANY of the provided permissions
     */
    const hasAnyPermission = (codes: PermissionCode[]) => {
        return codes.some(code => hasPermission(code));
    };

    /**
     * Check if user has ALL of the provided permissions
     */
    const hasAllPermissions = (codes: PermissionCode[]) => {
        return codes.every(code => hasPermission(code));
    };

    return { hasPermission, hasAnyPermission, hasAllPermissions, role: profile?.role };
};
