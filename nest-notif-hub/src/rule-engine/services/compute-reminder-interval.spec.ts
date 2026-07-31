import { computeReminderInterval } from './compute-reminder-interval';

describe('computeReminderInterval', () => {
  // 10-day mission, deadline fixed at a known instant so every case just
  // varies how far "now" sits from it.
  const durationDays = 10;
  const deadline = new Date('2026-01-11T00:00:00.000Z');

  it('returns the full base interval when more than 50% of the duration remains', () => {
    const now = new Date('2026-01-03T00:00:00.000Z'); // 8 days left of 10 = 80%
    expect(computeReminderInterval(deadline, durationDays, 24, now)).toBe(24);
  });

  it('halves the base interval when 20-50% of the duration remains', () => {
    const now = new Date('2026-01-08T00:00:00.000Z'); // 3 days left of 10 = 30%
    expect(computeReminderInterval(deadline, durationDays, 24, now)).toBe(12);
  });

  it('quarters the base interval when less than 20% of the duration remains', () => {
    const now = new Date('2026-01-10T00:00:00.000Z'); // 1 day left of 10 = 10%
    expect(computeReminderInterval(deadline, durationDays, 24, now)).toBe(6);
  });

  it('floors the interval at 6h even when the quarter tier would go lower', () => {
    const now = new Date('2026-01-10T00:00:00.000Z'); // 1 day left of 10 = 10%
    // base=8h -> quarter tier would be 2h, but MIN_INTERVAL_HOURS clamps it to 6h.
    expect(computeReminderInterval(deadline, durationDays, 8, now)).toBe(6);
  });

  it('treats a 0 duration as 0% time remaining and falls into the quarter tier' , () => {
    const now = new Date('2026-01-05T00:00:00.000Z');
    expect(computeReminderInterval(deadline, 0, 40, now)).toBe(10);
  })

});
