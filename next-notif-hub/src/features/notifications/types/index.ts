export type NotificationKind = 'general' | 'reminder';

export interface AppNotification {
    id: string;
    message: string;
    kind: NotificationKind;
    read: boolean;
    createdAt: string;
}
