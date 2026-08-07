import { TotalXpStatCard } from './total-xp-stat-card';
import { LevelStatCard } from './level-stat-card';
import { BadgesEarnedStatCard } from './badges-earned-stat-card';
import { MissionsCompletedStatCard } from './missions-completed-stat-card';
import { ActiveQuestsStatCard } from './active-quests-stat-card';

// No activity:new-triggered profile refetch anymore — every field here now
// has its own dedicated live event (xp:granted, level:up, badge:granted,
// mission:completed), so the old blanket "refetch the whole profile on
// MissionCompleted/BadgeUnlocked" fallback is fully superseded, not just
// redundant with it.
export function EmployeeStatsGrid() {
    return (
        <div className="mb-5 mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <TotalXpStatCard />
            <LevelStatCard />
            <BadgesEarnedStatCard />
            <MissionsCompletedStatCard />
            <ActiveQuestsStatCard />
        </div>
    );
}
