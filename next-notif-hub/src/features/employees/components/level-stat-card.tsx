'use client';

import { TrendingUp } from 'lucide-react';
import { useMyEmployeeProfileQuery } from '../queries/use-my-employee-profile-query';
import { useLiveLevel } from '../hooks/use-live-level';
import { StatCard } from './stat-card';

export function LevelStatCard() {
    const profile = useMyEmployeeProfileQuery();
    const { level } = useLiveLevel({ baseLevel: profile.data?.level ?? null, isReady: profile.isSuccess });

    return (
        <StatCard
            label="Level"
            value={level ?? '—'}
            icon={TrendingUp}
            accentTextClass="text-secondary"
            accentBgClass="bg-light-gray"
        />
    );
}
