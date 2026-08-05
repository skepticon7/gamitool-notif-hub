'use client';

import { Award } from 'lucide-react';
import { useMyEmployeeProfileQuery } from '../queries/use-my-employee-profile-query';
import { useLiveBadgesEarned } from '../hooks/use-live-badges-earned';
import { StatCard } from './stat-card';

export function BadgesEarnedStatCard() {
    const profile = useMyEmployeeProfileQuery();
    const { badgesEarned } = useLiveBadgesEarned({
        baseBadgesEarned: profile.data?.badgesEarned ?? null,
        isReady: profile.isSuccess,
    });

    return (
        <StatCard
            label="Badges earned"
            value={profile.data ? `${badgesEarned ?? profile.data.badgesEarned}/${profile.data.totalBadges}` : '—'}
            icon={Award}
            accentTextClass="text-orange"
            accentBgClass="bg-light-yellow"
        />
    );
}
