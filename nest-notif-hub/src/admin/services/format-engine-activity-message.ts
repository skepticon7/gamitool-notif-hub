// Third-person, admin-facing counterpart to the employee activity feed's
// formatActivityMessage (src/activity-feed/services/format-activity-message.ts).
// Deliberately full-coverage, not curated — this is an audit view, so an
// unrecognized event type still renders something (the default case) rather
// than being silently dropped like the employee feed does.
export function formatEngineActivityMessage(
  eventType: string,
  payload: Record<string, any>,
  employeeName?: string,
): string {
  switch (eventType) {
    case 'MissionAssigned':
      return `${employeeName} was assigned ${payload.missionName}`;
    case 'MissionCompleted':
      return `${employeeName} completed ${payload.missionName}`;
    case 'MissionExpired':
      return `${employeeName}'s mission ${payload.missionName} expired`;
    case 'MissionBulkAssigned':
      return `${payload.missionName} assigned to ${payload.assignedCount} employee(s)`;
    case 'LevelUp':
      return `${employeeName} reached Level ${payload.newLevel}`;
    case 'BadgeUnlocked':
      return `${employeeName} unlocked ${payload.badges.map((b: any) => b.name).join(', ')}`;
    case 'XPGranted':
      return `${employeeName} earned ${payload.xpGranted} XP`;
    case 'ReminderDue':
      return `Reminder fired for ${employeeName}: ${payload.missionName}`;
    case 'NotificationDelivered':
      return `Notification delivered to ${employeeName} via ${payload.channel}`;
    case 'NotificationFailed':
      return `${payload.channel} to ${employeeName} bounced`;
    case 'EmployeeAccountCreated':
      return `Account created for ${payload.name} (${payload.email})`;
    case 'AdminAccountCreated':
      return `Admin account created for ${payload.name} (${payload.email})`;
    default:
      return employeeName ? `${eventType} for ${employeeName}` : eventType;
  }
}
