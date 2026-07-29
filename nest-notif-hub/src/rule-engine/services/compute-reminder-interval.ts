const MIN_INTERVAL_HOURS = 6;

// Escalating urgency from one admin-set base interval — the admin only ever
// configures baseIntervalHours (how often to remind when there's plenty of
// time left); how much MORE often it fires as the deadline approaches is
// automatic, not a separate admin-facing setting:
//   > 50% of the mission's duration remaining -> base interval
//   20-50% remaining                          -> base / 2
//   < 20% remaining                            -> base / 4
// Floored at MIN_INTERVAL_HOURS so a small base interval (or a mission
// close to its deadline) can never produce an absurdly spammy cadence.
export function computeReminderInterval(
  deadline: Date,
  durationDays: number,
  baseIntervalHours: number,
  now: Date = new Date(),
): number {
  const totalDurationMs = durationDays * 24 * 60 * 60 * 1000;
  const remainingMs = deadline.getTime() - now.getTime();
  const percentRemaining = totalDurationMs > 0 ? remainingMs / totalDurationMs : 0;

  const intervalHours =
    percentRemaining > 0.5
      ? baseIntervalHours
      : percentRemaining >= 0.2
        ? baseIntervalHours / 2
        : baseIntervalHours / 4;

  return Math.max(intervalHours, MIN_INTERVAL_HOURS);
}
