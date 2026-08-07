'use client';

import { useCallback, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';

interface UseLiveMissionsCompletedParams {
    baseCount: number | null;
    isReady: boolean;
}

export function useLiveMissionsCompleted({ baseCount, isReady }: UseLiveMissionsCompletedParams) {
    const [increment, setIncrement] = useState(0);

    // Same reconciliation as useLiveActiveQuests, same render-time-adjustment
    // pattern (not an effect) — if this stat's baseline query is ever
    // invalidated by the same mission:completed event this hook also reacts
    // to, trust the fresh baseline over the local bump instead of
    // double-counting.
    const [prevBaseCount, setPrevBaseCount] = useState(baseCount);
    if (baseCount !== prevBaseCount) {
        setPrevBaseCount(baseCount);
        setIncrement(0);
    }

    const handleCompleted = useCallback(() => {
        if (!isReady) return;
        setIncrement((n) => n + 1);
    }, [isReady]);
    useSocketEvent<unknown>('mission:completed', handleCompleted);

    return {
        missionsCompleted: baseCount == null ? null : baseCount + increment,
    };
}