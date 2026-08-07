'use client';

import { CheckCircle2 } from 'lucide-react';
import { useMyEmployeeProfileQuery } from '../queries/use-my-employee-profile-query';
import { useLiveMissionsCompleted } from '../hooks/use-live-missions-completed';
import { StatCard } from './stat-card';

export function MissionsCompletedStatCard() {
    const profile = useMyEmployeeProfileQuery();
    const { missionsCompleted } = useLiveMissionsCompleted({
        baseCount: profile.data?.missionsCompleted ?? null,
        isReady: profile.isSuccess,
    });

    return (
        <StatCard
            label="Missions completed"
            value={missionsCompleted ?? '—'}
            icon={CheckCircle2}
            accentTextClass="text-green"
            accentBgClass="bg-light-green"
        />
    );
}
