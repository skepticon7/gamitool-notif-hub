'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/use-socket-event';
import type { ActivityFeedEntry } from '@/features/activity-feed';
import { EMPLOYEE_PROFILE_QUERY_KEY } from '../constants';
import { TotalXpStatCard } from './total-xp-stat-card';
import { LevelStatCard } from './level-stat-card';
import { BadgesEarnedStatCard } from './badges-earned-stat-card';
import { MissionsCompletedStatCard } from './missions-completed-stat-card';
import { ActiveQuestsStatCard } from './active-quests-stat-card';

// missionsCompleted/badgesEarned/totalBadges have no dedicated socket event
// of their own (unlike xp/level/badge counts, which each update live via
// their own card's hook) — activity:new carrying one of these event types
// is still the only signal to refresh that baseline. Carried over verbatim
// from the XpHeroCard this grid replaces.
const PROFILE_AFFECTING_EVENTS = new Set(['MissionCompleted', 'BadgeUnlocked']);

export function EmployeeStatsGrid() {
    const queryClient = useQueryClient();

    const handleActivity = useCallback(
        (payload: ActivityFeedEntry) => {
            if (PROFILE_AFFECTING_EVENTS.has(payload.eventType)) {
                queryClient.invalidateQueries({ queryKey: EMPLOYEE_PROFILE_QUERY_KEY });
            }
        },
        [queryClient],
    );
    useSocketEvent<ActivityFeedEntry>('activity:new', handleActivity);

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
