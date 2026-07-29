import { RecurrenceInterval } from '../entities/mission-schedulment.entity';

// Fixed calendar anchors, not a rolling offset from `from` — daily means
// "every midnight," weekly means "every Monday," monthly means "every 1st
// of the month," regardless of what moment `from` happens to be. This is
// always computing the NEXT occurrence, so if `from` already sits exactly
// on an anchor (e.g. today IS Monday), the result still jumps forward a
// full cycle rather than returning "today" again.
export function computeNextRecurrence(from: Date, interval: RecurrenceInterval): Date {
  const next = new Date(from);
  next.setHours(0, 0, 0, 0);

  if (interval === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (interval === 'weekly') {
    const daysUntilMonday = (1 - next.getDay() + 7) % 7 || 7;
    next.setDate(next.getDate() + daysUntilMonday);
  } else {
    next.setMonth(next.getMonth() + 1, 1);
  }

  return next;
}
