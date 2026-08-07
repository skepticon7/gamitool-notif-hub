export type NotificationKind = 'general' | 'reminder';

export interface AppNotification {
    id: string;
    message: string;
    kind: NotificationKind;
    eventType: string;
    read: boolean;
    createdAt: string;
}

export interface NotificationPayload {
    notification: AppNotification;
    unreadCount : number;
}
