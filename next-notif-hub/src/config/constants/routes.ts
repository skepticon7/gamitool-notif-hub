import type { UserRole } from '@/types/auth';

const ROUTES = {
    LOGIN: '/',
    EMPLOYEE: {
        DASHBOARD: '/employee/dashboard',
        MISSIONS: '/employee/missions',
        BADGES: '/employee/badges',
    },
    ADMIN: {
        DASHBOARD: '/admin/dashboard',
        RULES: '/admin/rules',
        SCHEDULMENTS: '/admin/schedulments',
        CATALOG: '/admin/catalog',
        ENGINE_ACTIVITY: '/admin/engine-activity',
    },
} as const;

export function homeRouteFor(role: UserRole): string {
    return role === 'admin' ? ROUTES.ADMIN.DASHBOARD : ROUTES.EMPLOYEE.DASHBOARD;
}

export default ROUTES;
