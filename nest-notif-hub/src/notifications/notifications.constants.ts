export const NOTIFICATION_CHANNELS = ['email', 'sms', 'in-app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
