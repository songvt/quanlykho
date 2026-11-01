import type { AppSession } from './appSession';

type SessionLike = Pick<AppSession, 'role' | 'permissions'>;

function hasPermission(session: SessionLike, permission: string) {
    return Array.isArray(session.permissions) && (session.permissions.includes('*') || session.permissions.includes(permission));
}

export function canViewExamCampaigns(session: SessionLike) {
    return session.role === 'admin' || hasPermission(session, 'inventory.view') || hasPermission(session, 'inventory.manage');
}

export function canManageExamCampaigns(session: SessionLike) {
    return session.role === 'admin' || hasPermission(session, 'inventory.manage') || hasPermission(session, 'outbound.create');
}
