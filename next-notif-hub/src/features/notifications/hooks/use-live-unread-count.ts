'use client';

import { useCallback, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';

interface UseLiveUnreadCountParams {
    baseCount: number | null;
    isReady: boolean;
}

// Same delta-on-a-baseline shape as useLiveActiveQuests/
// useLiveMissionsCompleted, including the same render-time reconciliation:
// marking one/all read invalidates UNREAD_COUNT_QUERY_KEY (see the
// mutations), so baseCount can itself refresh to already reflect a change
// this hook's delta also applied — trust a fresh baseCount over the local
// delta whenever it changes.
export function useLiveUnreadCount({ baseCount, isReady }: UseLiveUnreadCountParams) {
    const [delta, setDelta] = useState(0);

    const [prevBaseCount, setPrevBaseCount] = useState(baseCount);
    if (baseCount !== prevBaseCount) {
        setPrevBaseCount(baseCount);
        setDelta(0);
    }

    const handleNew = useCallback(() => {
        if (!isReady) return;
        setDelta((d) => d + 1);
    }, [isReady]);
    useSocketEvent<unknown>('notification:new', handleNew);

    return {
        count: baseCount == null ? null : baseCount + delta,
    };
}