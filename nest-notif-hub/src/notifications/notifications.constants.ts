// 'in-app' is the only channel EDEN delivers itself (see InAppProcessor).
// Every other value here is just a label the admin picks in a Notify
// wiring's params.channels — the actual delivery for all of them is
// outsourced to n8n (see N8nProcessor). Add a new channel name here any
// time you build a new n8n workflow for it — no other code needs to change.
export const NOTIFICATION_CHANNELS = ['email', 'sms', 'in-app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
