'use client';

import { useCallback, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';

interface UseLiveActiveQuestsParams {
    baseCount: number | null;
    isReady: boolean;
}

// Active quests moves on three independent transitions of the same
// underlying fact (an assignment's status): mission:assigned adds one,
// mission:completed/mission:expired each remove one. All three just nudge
// a local delta — none of them need the payload's actual fields, only the
// fact that they fired.
export function useLiveActiveQuests({ baseCount, isReady }: UseLiveActiveQuestsParams) {
    const [delta, setDelta] = useState(0);

    // MissionAssignmentCacheSync invalidates this same underlying query on
    // these same three events (so pages that aren't currently mounted stay
    // correct on next visit) — which means baseCount can itself refetch to
    // already reflect an event this hook also just applied a delta for.
    // Whenever a fresh baseCount arrives, trust it completely and drop the
    // delta, or the two would double-count the same change. Adjusting state
    // during render (not in an effect) per React's own recommended pattern
    // for "reset state when a prop changes" — avoids the extra render an
    // effect-based reset would cause, and this project's lint rules flag
    // synchronous setState-in-effect for exactly that reason.
    const [prevBaseCount, setPrevBaseCount] = useState(baseCount);
    if (baseCount !== prevBaseCount) {
        setPrevBaseCount(baseCount);
        setDelta(0);
    }

    const handleAssigned = useCallback(() => {
        if (!isReady) return;
        setDelta((d) => d + 1);
    }, [isReady]);
    useSocketEvent<unknown>('mission:assigned', handleAssigned);

    const handleCompleted = useCallback(() => {
        if (!isReady) return;
        setDelta((d) => d - 1);
    }, [isReady]);
    useSocketEvent<unknown>('mission:completed', handleCompleted);

    const handleExpired = useCallback(() => {
        if (!isReady) return;
        setDelta((d) => d - 1);
    }, [isReady]);
    useSocketEvent<unknown>('mission:expired', handleExpired);

    return {
        count: baseCount == null ? null : baseCount + delta,
    };
}