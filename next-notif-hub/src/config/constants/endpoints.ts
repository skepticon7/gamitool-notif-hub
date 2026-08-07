const ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        OIDC_LOGIN: '/auth/oidc/login',
        REFRESH: '/auth/refresh',
    },
    MISSIONS: {
        MY_ASSIGNMENTS: '/missions/my-assignments',
        LATEST_ASSIGNMENTS: '/missions/assignments/latest',
        COMPLETE_ASSIGNMENT: (assignmentId: string) => `/missions/assignments/${assignmentId}/complete`,
    },
    BADGES: {
        MY_BADGES: '/badges/my-badges',
        CATALOG: '/badges/catalog',
    },
    EMPLOYEES: {
        ME: '/employees/me',
    },
    NOTIFICATIONS: {
        LIST: '/notifications',
        UNREAD_COUNT: '/notifications/unread-count',
        MARK_READ: (id: string) => `/notifications/${id}/read`,
        READ_ALL: '/notifications/read-all',
    },
    ACTIVITY_FEED: '/activity-feed',
    ADMIN: {
        MISSIONS: '/admin/missions',
        MISSION: (id: string) => `/admin/missions/${id}`,
        BADGES: '/admin/badges',
        BADGE: (id: string) => `/admin/badges/${id}`,
    },
} as const;

export default ENDPOINTS;
