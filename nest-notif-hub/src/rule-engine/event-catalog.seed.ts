// Single source of truth for the event catalog — developer-owned, not
// admin-editable (see EventCatalogController: GET-only). Adding a new event
// type, or a new field to an existing one's payload, means editing this
// file and restarting — EventCatalogSeedService upserts every entry here
// into event_catalog on every boot, so the table never drifts from what
// the code actually emits.
export const EVENT_CATALOG_SEED: { eventType: string; payloadFields: Record<string, string> }[] = [
  {
    eventType: 'MissionAssigned',
    payloadFields: {
      employeeId: 'string',
      missionId: 'string',
      missionName: 'string',
      deadline: 'string | null',
      assignmentId: 'string',
      durationDays: 'number | null',
    },
  },
  {
    eventType: 'MissionCompleted',
    payloadFields: {
      employeeId: 'string',
      missionId: 'string',
      missionName: 'string',
      xpGranted: 'number',
      assignmentId: 'string',
    },
  },
  {
    eventType: 'MissionExpired',
    payloadFields: {
      employeeId: 'string',
      missionId: 'string',
      missionName: 'string',
      assignmentId: 'string',
    },
  },
  {
    eventType: 'MissionBulkAssigned',
    payloadFields: {
      missionId: 'string',
      missionName: 'string',
      assignedCount: 'number',
      skippedCount: 'number',
      totalEmployees: 'number',
    },
  },
  {
    eventType: 'XPGranted',
    payloadFields: {
      employeeId: 'string',
      xp: 'number',
      xpGranted: 'number',
    },
  },
  {
    eventType: 'LevelUp',
    payloadFields: {
      employeeId: 'string',
      newLevel: 'number',
      previousLevel: 'number',
    },
  },
  {
    eventType: 'BadgeUnlocked',
    payloadFields: {
      employeeId: 'string',
      badges: 'array',
    },
  },
  {
    eventType: 'ReminderDue',
    payloadFields: {
      employeeId: 'string',
      missionId: 'string',
      missionName: 'string',
      daysLeft: 'number',
      deadline: 'string',
      durationDays: 'number',
      assignmentId: 'string',
      baseIntervalHours: 'number',
    },
  },
  {
    eventType: 'NotificationDelivered',
    payloadFields: {
      employeeId: 'string',
      channel: 'string',
      correlationId: 'string',
      sourceEventId: 'string',
    },
  },
  {
    eventType: 'NotificationFailed',
    payloadFields: {
      employeeId: 'string',
      channel: 'string',
      correlationId: 'string',
      sourceEventId: 'string',
      errorReason: 'string',
    },
  },
  {
    eventType: 'EmployeeAccountCreated',
    payloadFields: {
      employeeId: 'string',
      name: 'string',
      email: 'string',
    },
  },
  {
    eventType: 'AdminAccountCreated',
    payloadFields: {
      userId: 'string',
      name: 'string',
      email: 'string',
    },
  },
];
