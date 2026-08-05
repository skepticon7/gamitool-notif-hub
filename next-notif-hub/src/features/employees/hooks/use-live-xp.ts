import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';
import type { XpGrantedPayload } from '../types';

interface UseLiveXpParams {
    baseXp: number | null;
    isReady: boolean;
}

interface XpFlourish {
    key: number;
    amount: number;
}

// REST is the source of truth on load — xp:granted pushes are ignored until
// the initial profile fetch has actually succeeded, same reasoning as the
// dashboard's other live-updating panels (see docs/decisions.md). Only
// reads .xp off the payload — level is a separate independently-updating
// stat, see use-live-level.ts, so this card never waits on it.
export function useLiveXp({ baseXp, isReady }: UseLiveXpParams) {
    const [liveXp, setLiveXp] = useState<number | null>(null);
    const [flourish, setFlourish] = useState<XpFlourish | null>(null);
    const flourishIdRef = useRef(0);

    const handleXpGranted = useCallback(
        (payload: XpGrantedPayload) => {
            if (!isReady) return;
            setLiveXp(payload.xp);
            flourishIdRef.current += 1;
            setFlourish({ key: flourishIdRef.current, amount: payload.amount });
        },
        [isReady],
    );
    useSocketEvent<XpGrantedPayload>('xp:granted', handleXpGranted);

    useEffect(() => {
        if (!flourish) return;
        const timeout = setTimeout(() => setFlourish(null), 2000);
        return () => clearTimeout(timeout);
    }, [flourish]);

    return {
        xp: liveXp ?? baseXp,
        flourish,
    };
}
