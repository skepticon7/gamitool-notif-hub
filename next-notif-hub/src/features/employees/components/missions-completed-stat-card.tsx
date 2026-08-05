'use client';

import { CheckCircle2 } from 'lucide-react';
import { useMyEmployeeProfileQuery } from '../queries/use-my-employee-profile-query';
import { StatCard } from './stat-card';

// No dedicated live event for this count — kept in sync by
// EmployeeStatsGrid's activity:new-triggered profile refetch, same as
// badgesEarned's baseline (see that card's parent for the invalidation).
export function MissionsCompletedStatCard() {
    const profile = useMyEmployeeProfileQuery();

    return (
        <StatCard
            label="Missions completed"
            value={profile.data?.missionsCompleted ?? '—'}
            icon={CheckCircle2}
            accentTextClass="text-green"
            accentBgClass="bg-light-green"
        />
    );
}
