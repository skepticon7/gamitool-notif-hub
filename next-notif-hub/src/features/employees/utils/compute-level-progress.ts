// Mirrors nest-notif-hub's CheckLevelThresholdAction.computeLevel exactly
// (src/rule-engine/actions/check-level-threshold.action.ts) — same growth
// curve, same default params. This is an APPROXIMATION: baseXp/growthRate
// are admin-configurable per event-link wiring (params.xpPerLevel,
// params.growthRate), and /employees/me only returns the cumulative xp/level
// totals, not which params actually produced them. If an org customized
// those params away from the defaults (100, 1.5), this bar will drift from
// the real threshold — there's currently no endpoint that returns the
// actual configured params to compute this exactly.
const DEFAULT_BASE_XP = 100;
const DEFAULT_GROWTH_RATE = 1.5;

export interface LevelProgress {
    xpInto: number;
    xpForNextLevel: number;
    percent: number;
}

export function computeLevelProgress(
    xp: number,
    baseXp: number = DEFAULT_BASE_XP,
    growthRate: number = DEFAULT_GROWTH_RATE,
): LevelProgress {
    let cumulative = 0;
    let xpForNextLevel = baseXp;

    while (xp >= cumulative + xpForNextLevel) {
        cumulative += xpForNextLevel;
        xpForNextLevel = Math.round(xpForNextLevel * growthRate);
    }

    const xpInto = xp - cumulative;
    const percent = Math.min(100, Math.round((xpInto / xpForNextLevel) * 100));

    return { xpInto, xpForNextLevel, percent };
}
