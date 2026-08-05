'use client';

import { Sparkles } from 'lucide-react';
import { useMyEmployeeProfileQuery } from '../queries/use-my-employee-profile-query';
import { useLiveXp } from '../hooks/use-live-xp';
import { StatCard } from './stat-card';

export function TotalXpStatCard() {
    const profile = useMyEmployeeProfileQuery();
    const { xp, flourish } = useLiveXp({ baseXp: profile.data?.xp ?? null, isReady: profile.isSuccess });

    return (
        <StatCard
            label="Total XP"
            value={xp ?? '—'}
            icon={Sparkles}
            accentTextClass="text-purple"
            accentBgClass="bg-light-purple"
            flourish={
                flourish && (
                    <span
                        key={flourish.key}
                        className="animate-in fade-in slide-in-from-bottom-1 text-xs font-extrabold duration-300"
                    >
                        +{flourish.amount}
                    </span>
                )
            }
        />
    );
}
