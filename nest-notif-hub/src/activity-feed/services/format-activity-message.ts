export function formatActivityMessage(
  eventType: string,
  payload: Record<string, any>,
): string | null {
  switch (eventType) {
    case 'MissionAssigned':
      return `New mission assigned: ${payload.missionName}`;
    case 'MissionCompleted':
      return `You completed ${payload.missionName} — +${payload.xpGranted} XP`;
    case 'MissionExpired':
      return `Mission expired: ${payload.missionName}`;
    case 'LevelUp':
      return `You reached Level ${payload.newLevel} — nice work`;
    case 'BadgeUnlocked':
      return `You unlocked the ${payload.badges.map((b: any) => b.name).join(', ')} badge`;
    case 'ReminderDue':
      return `Reminder: ${payload.missionName} expires in ${payload.daysLeft} day(s)`;
    default:
      return null;
  }
}
