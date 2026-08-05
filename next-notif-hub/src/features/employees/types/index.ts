export interface EmployeeProfile {
    xp: number | null;
    level: number | null;
    missionsCompleted: number;
    badgesEarned: number;
    totalBadges: number;
}

// `xp:granted`/`level:up` socket payloads (backend TBD) — `amount` is what
// was just granted (for the "+N XP" flourish), `xp`/`level` are the
// employee's new cumulative totals, trusted as-is rather than added to
// locally so the bar can never drift from the server's own math.
export interface XpGrantedPayload {
    amount: number;
    xp: number;
    level: number;
}

export interface LevelUpPayload {
    level: number;
}
