// Shared by any panel/list that renders a deadline chip (Active Missions,
// the full missions list) — one place for the "due today" cutoff and
// urgency threshold so they can't drift apart between screens.
//
// Compares calendar days (local midnight to local midnight), not exact
// millisecond duration. A duration:1 mission's deadline sits exactly 24h
// after assignedAt — comparing raw ms via Math.ceil put that right on the
// boundary of exactly 1.0 day, so a live-pushed row (rendered within
// milliseconds of the server generating assignedAt) could tip to the wrong
// side of the boundary from tiny clock skew/latency and show "Due in 2
// days", while a REST fetch moments later — with more real time elapsed —
// landed on "Due today" for the identical deadline. Calendar-day math only
// changes at actual local midnight, so it's immune to that jitter.
export function formatDeadline(deadline: string): { text: string; urgent: boolean } {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfDeadlineDay = new Date(
        deadlineDate.getFullYear(),
        deadlineDate.getMonth(),
        deadlineDate.getDate(),
    ).getTime();
    const diffDays = Math.round((startOfDeadlineDay - startOfToday) / (1000 * 60 * 60 * 24));

    if (diffDays <= 1) return { text: 'Due today', urgent: true };
    return { text: `Due in ${diffDays} days`, urgent: false };
}
