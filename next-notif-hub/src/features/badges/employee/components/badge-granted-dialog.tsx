'use client';

import { useCallback } from 'react';
import Image from 'next/image';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { useRewardQueueStore } from '@/store/reward-queue-store';
import { MY_BADGES_QUERY_KEY } from '../../constants';
import type { BadgeGrantedPayload, BadgeTier } from '../../types';

const TIER_STYLES: Record<BadgeTier, { label: string; bgClass: string; fgClass: string }> = {
    bronze: { label: 'Bronze', bgClass: 'bg-trophy-bronze-bg', fgClass: 'text-trophy-bronze-fg' },
    silver: { label: 'Silver', bgClass: 'bg-trophy-silver-bg', fgClass: 'text-trophy-silver-fg' },
    gold: { label: 'Gold', bgClass: 'bg-trophy-gold-bg', fgClass: 'text-trophy-gold-fg' },
    diamond: { label: 'Diamond', bgClass: 'bg-trophy-diamond-bg', fgClass: 'text-trophy-diamond-fg' },
};

// Mirrors the "BADGE-UNLOCK OVERLAY" mockup (EDEN design reference) —
// tier-colored hero band, glowing trophy reveal. Enqueues into the shared
// reward queue (see reward-queue-store.ts) instead of owning its own `open`
// state, so it can't show at the same time as LevelUpDialog.
export function BadgeGrantedDialog() {
    const queryClient = useQueryClient();
    const current = useRewardQueueStore((s) => s.current);
    const enqueueReward = useRewardQueueStore((s) => s.enqueueReward);
    const dismissCurrent = useRewardQueueStore((s) => s.dismissCurrent);

    const handleBadgeGranted = useCallback(
        (payload: BadgeGrantedPayload) => {
            enqueueReward({ type: 'badge-granted', badge: payload.badge });
            queryClient.invalidateQueries({ queryKey: MY_BADGES_QUERY_KEY });
        },
        [enqueueReward, queryClient],
    );
    useSocketEvent<BadgeGrantedPayload>('badge:granted', handleBadgeGranted);

    const open = current?.type === 'badge-granted';
    const badge = current?.type === 'badge-granted' ? current.badge : null;
    const tier = badge ? TIER_STYLES[badge.tier] : null;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && dismissCurrent()}>
            <DialogContent
                showCloseButton={false}
                className="w-[360px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[26px] border-none p-0 text-center shadow-[0_30px_80px_-20px_rgba(3,20,60,.5)] duration-[450ms] ease-[cubic-bezier(.2,.9,.3,1.4)] data-[state=open]:zoom-in-75"
            >
                <div className="relative px-8 pt-9 pb-7">
                    {tier && <div className={`pointer-events-none absolute inset-x-0 top-0 h-[120px] ${tier.bgClass}`} />}

                    <div className="relative mx-auto mb-4 h-[130px] w-[130px]">
                        {tier && (
                            <span className={`absolute -inset-1.5 animate-ping rounded-full opacity-60 blur-md ${tier.fgClass.replace('text-', 'bg-')}`} />
                        )}
                        {badge && (
                            <Image
                                src={`/trophies/${badge.tier}.svg`}
                                alt=""
                                width={130}
                                height={130}
                                className="relative animate-in zoom-in-50 spin-in-[18deg] duration-700 ease-out [filter:drop-shadow(0_10px_18px_rgba(0,0,0,.18))]"
                            />
                        )}
                    </div>

                    <div className={`text-[13px] font-extrabold tracking-[.16em] ${tier?.fgClass ?? ''}`}>
                        BADGE UNLOCKED!
                    </div>
                    <div className="mt-1.5 text-[23px] font-extrabold text-foreground">{badge?.name}</div>
                    {tier && (
                        <span className={`mt-2 inline-block rounded-pill px-3.5 py-1 text-xs font-extrabold ${tier.bgClass} ${tier.fgClass}`}>
                            {tier.label} Tier
                        </span>
                    )}
                    <div className="mt-3 text-[13.5px] leading-[1.45] text-gray">
                        {badge?.description ??
                            `Unlocked at ${badge?.threshold} completed missions. This badge is now in your case.`}
                    </div>

                    <Button
                        type="button"
                        onClick={dismissCurrent}
                        className="mt-[22px] h-[46px] w-full cursor-pointer rounded-[13px] bg-primary font-extrabold text-white"
                    >
                        Add to case
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
