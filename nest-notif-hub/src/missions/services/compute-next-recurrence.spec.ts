import { computeNextRecurrence } from './compute-next-recurrence';

describe('computeNextRecurrence', () => {
  it('daily: returns midnight of the next calendar day', () => {
    const from = new Date(2026, 0, 15, 14, 30); // Thu Jan 15 2026, 14:30 local
    const next = computeNextRecurrence(from, 'daily');

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(0); // January
    expect(next.getDate()).toBe(16);
    expect(next.getHours()).toBe(0);
    expect(next.getMinutes()).toBe(0);
  });

  it('weekly: from a non-Monday, jumps forward to the next Monday', () => {
    const from = new Date(2026, 0, 15); // Thu Jan 15 2026
    const next = computeNextRecurrence(from, 'weekly');

    expect(next.getDay()).toBe(1); // Monday
    expect(next.getDate()).toBe(19); // Jan 19 2026
  });

  it('weekly: from a Monday itself, still jumps a full 7 days forward (not "today")', () => {
    const from = new Date(2026, 0, 12); // Mon Jan 12 2026
    const next = computeNextRecurrence(from, 'weekly');

    expect(next.getDay()).toBe(1); // Monday
    expect(next.getDate()).toBe(19); // Jan 19 2026, not Jan 12
  });

  it('monthly: rolls over into next year when "from" is in December', () => {
    const from = new Date(2025, 11, 20); // Dec 20 2025
    const next = computeNextRecurrence(from, 'monthly');

    expect(next.getFullYear()).toBe(2026);
    expect(next.getMonth()).toBe(0); // January
    expect(next.getDate()).toBe(1);
  });
});
