'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { Frown, Lock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { EMPLOYEE_PROFILE_QUERY_KEY, useMyEmployeeProfileQuery } from '@/features/employees';
import type { ActivityFeedEntry } from '@/features/activity-feed';
import { useBadgeCatalogQuery } from '../queries/use-badge-catalog-query';
import type { BadgeTier } from '../../types';

const TIER_STYLES: Record<BadgeTier, { label: string; fgClass: string; bgClass: string }> = {
    bronze: { label: 'Bronze', fgClass: 'text-trophy-bronze-fg', bgClass: 'bg-trophy-bronze-bg' },
    silver: { label: 'Silver', fgClass: 'text-trophy-silver-fg', bgClass: 'bg-trophy-silver-bg' },
    gold: { label: 'Gold', fgClass: 'text-trophy-gold-fg', bgClass: 'bg-trophy-gold-bg' },
    diamond: { label: 'Diamond', fgClass: 'text-trophy-diamond-fg', bgClass: 'bg-trophy-diamond-bg' },
};

// "Unlocked" is never returned by the API — it's derived here from
// employees/me's missionsCompleted vs. each catalog badge's threshold, same
// math the design reference uses client-side. This page owns its own
// activity:new subscription (rather than relying on EmployeeStatsGrid's)
// since it can be opened without the dashboard ever mounting.
export function BadgeCase() {
    const queryClient = useQueryClient();
    const profile = useMyEmployeeProfileQuery();
    const catalog = useBadgeCatalogQuery();

    const handleActivity = useCallback(
        (payload: ActivityFeedEntry) => {
            if (payload.eventType === 'MissionCompleted') {
                queryClient.invalidateQueries({ queryKey: EMPLOYEE_PROFILE_QUERY_KEY });
            }
        },
        [queryClient],
    );
    useSocketEvent<ActivityFeedEntry>('activity:new', handleActivity);

    const completedCount = profile.data?.missionsCompleted ?? 0;
    const badges = [...(catalog.data ?? [])].sort((a, b) => a.threshold - b.threshold);

    const nextLocked = badges.find((b) => completedCount < b.threshold);
    const prevUnlocked = [...badges].reverse().find((b) => completedCount >= b.threshold);
    let nextBadgePct = 100;
    let nextBadgeText = 'All badges earned!';
    if (nextLocked) {
        const base = prevUnlocked ? prevUnlocked.threshold : 0;
        nextBadgePct = Math.round(((completedCount - base) / (nextLocked.threshold - base)) * 100);
        const remaining = nextLocked.threshold - completedCount;
        nextBadgeText = `${remaining} more mission${remaining === 1 ? '' : 's'} → ${nextLocked.name}`;
    }

    const unlockedCount = badges.filter((b) => completedCount >= b.threshold).length;
    const isLoading = profile.isLoading || catalog.isLoading;
    const isError = profile.isError || catalog.isError;

    return (
        <div>
            <div className="mb-1.5">
                <h1 className="mb-1 text-[27px] font-extrabold text-foreground">Badge case</h1>
                <p className="text-[15px] text-gray">
                    Earn badges by completing missions.{' '}
                    {!isLoading && !isError && `${unlockedCount} of ${badges.length} unlocked.`}
                </p>
            </div>

            {!isLoading && !isError && badges.length > 0 && (
                <div className="my-[18px] flex items-center gap-3.5 rounded-[14px] border border-card-border bg-white px-[18px] py-3.5">
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                            className="h-full rounded-full transition-[width] duration-700"
                            style={{ width: `${nextBadgePct}%`, backgroundImage: 'var(--gradient-primary-to-secondary)' }}
                        />
                    </div>
                    <div className="text-[13px] font-semibold whitespace-nowrap text-gray">{nextBadgeText}</div>
                </div>
            )}

            {isLoading && (
                <div className="rounded-card border border-card-border bg-white p-8 text-center text-sm text-gray shadow-card">
                    Loading badges…
                </div>
            )}
            {isError && (
                <div className="rounded-card border border-card-border bg-white p-8 text-center text-sm text-destructive shadow-card">
                    Couldn&apos;t load badges.
                </div>
            )}
            {!isLoading && !isError && badges.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-card border border-card-border bg-white p-10 text-center text-sm text-gray shadow-card">
                    <Frown size={28} className="text-[#cbd3e0]" />
                    No badges in the catalog yet.
                </div>
            )}

            {!isLoading && !isError && badges.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
                    {badges.map((badge) => {
                        const unlocked = completedCount >= badge.threshold;
                        const tier = TIER_STYLES[badge.tier];

                        return (
                            <div
                                key={badge.id}
                                className={`rounded-[18px] border border-card-border bg-white px-4 pt-[22px] pb-5 text-center shadow-card ${
                                    unlocked ? '' : 'opacity-90'
                                }`}
                            >
                                <div className="relative mx-auto mb-3 flex h-[88px] w-[88px] items-center justify-center">
                                    {unlocked && (
                                        <span className={`absolute inset-1.5 rounded-full blur-md ${tier.bgClass}`} />
                                    )}
                                    <Image
                                        src={`/trophies/${badge.tier}.svg`}
                                        alt=""
                                        width={72}
                                        height={72}
                                        className={`relative ${
                                            unlocked ? 'drop-shadow-[0_6px_10px_rgba(0,0,0,.14)]' : 'opacity-40 grayscale'
                                        }`}
                                    />
                                    {!unlocked && (
                                        <span className="absolute right-0 bottom-0 flex h-[26px] w-[26px] items-center justify-center rounded-full border border-border bg-white text-gray">
                                            <Lock size={13} />
                                        </span>
                                    )}
                                </div>
                                <div className={`text-[15px] font-bold ${unlocked ? 'text-foreground' : 'text-[#aab3c6]'}`}>
                                    {badge.name}
                                </div>
                                <span
                                    className={`mt-1.5 inline-block rounded-pill px-2.5 py-1 text-[11px] font-extrabold tracking-[.05em] ${
                                        unlocked ? `${tier.bgClass} ${tier.fgClass}` : 'bg-light-gray text-[#aab3c6]'
                                    }`}
                                >
                                    {tier.label}
                                </span>
                                <div className="mt-2 text-xs text-gray">
                                    {unlocked ? 'Unlocked' : 'Locked'} · {badge.threshold} missions
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
