'use client';

import { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { useRewardQueueStore } from '@/store/reward-queue-store';
import type { LevelUpPayload } from '../types';

const CONFETTI_COLORS = ['#fff', '#e8ecff', '#ffe08a', '#b6f5c8', '#ffd0e0'];

function Confetti() {
    return (
        <>
            {Array.from({ length: 18 }).map((_, i) => (
                <span
                    key={i}
                    className="absolute -top-3.5 h-3 w-2 rounded-[2px] opacity-0"
                    style={{
                        left: `${6 + i * 5.2}%`,
                        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                        animation: `eden-confetti ${1.6 + (i % 5) * 0.35}s ease-in ${(i % 6) * 0.12}s infinite`,
                    }}
                />
            ))}
        </>
    );
}

// Mirrors the "LEVEL-UP OVERLAY" mockup (EDEN design reference) — gradient
// hero card, pulsing/orbiting level ring, falling confetti. Enqueues into
// the shared reward queue (see reward-queue-store.ts) instead of owning its
// own `open` state, so it can't show at the same time as BadgeGrantedDialog.
export function LevelUpDialog() {
    const current = useRewardQueueStore((s) => s.current);
    const enqueueReward = useRewardQueueStore((s) => s.enqueueReward);
    const dismissCurrent = useRewardQueueStore((s) => s.dismissCurrent);

    const handleLevelUp = useCallback(
        (payload: LevelUpPayload) => enqueueReward({ type: 'level-up', level: payload.level }),
        [enqueueReward],
    );
    useSocketEvent<LevelUpPayload>('level:up', handleLevelUp);

    const open = current?.type === 'level-up';
    const level = current?.type === 'level-up' ? current.level : null;

    return (
        <Dialog open={open} onOpenChange={(next) => !next && dismissCurrent()}>
            <DialogContent
                showCloseButton={false}
                className="w-[380px] max-w-[calc(100%-2rem)] gap-0 overflow-hidden rounded-[26px] border-none bg-transparent p-0 text-center text-white shadow-[0_30px_80px_-20px_rgba(90,123,255,.8)] duration-500 ease-[cubic-bezier(.2,.9,.3,1.4)] data-[state=open]:zoom-in-75"
                style={{ backgroundImage: 'var(--gradient-primary-to-secondary-2)' }}
            >
                <div className="relative overflow-hidden px-[34px] pt-[38px] pb-[30px]">
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">{open && <Confetti />}</div>

                    <div className="relative mx-auto mb-[18px] h-[132px] w-[132px]">
                        <span className="absolute inset-0 animate-ping rounded-full border-[3px] border-white/50" />
                        <span className="absolute -inset-2.5 animate-[spin_10s_linear_infinite] rounded-full border-2 border-dashed border-white/55" />
                        <div className="absolute inset-4 flex flex-col items-center justify-center rounded-full border-2 border-white/70 bg-white/18">
                            <span className="text-[11px] font-bold tracking-[.14em] opacity-90">LEVEL</span>
                            <span className="text-[52px] leading-none font-extrabold">{level ?? '—'}</span>
                        </div>
                    </div>

                    <div className="text-[13px] font-extrabold tracking-[.18em] opacity-90">LEVEL UP!</div>
                    <div className="mt-1.5 text-[22px] font-extrabold">You reached Level {level}</div>
                    <div className="mt-1.5 text-[13.5px] leading-[1.45] opacity-90">
                        Higher level, tougher quests, bigger rewards. Keep going.
                    </div>

                    <Button
                        type="button"
                        onClick={dismissCurrent}
                        className="mt-[22px] h-[46px] w-full cursor-pointer rounded-[13px] bg-white font-extrabold text-primary hover:bg-white/90"
                    >
                        Continue
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
