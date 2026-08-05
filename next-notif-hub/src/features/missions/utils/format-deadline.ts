// Shared by any panel/list that renders a deadline chip (Active Missions,
// the full missions list) — one place for the "due today" cutoff and
// urgency threshold so they can't drift apart between screens.
export function formatDeadline(deadline: string): { text: string; urgent: boolean } {
    const diffDays = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return { text: 'Due today', urgent: true };
    return { text: `Due in ${diffDays} days`, urgent: false };
}
