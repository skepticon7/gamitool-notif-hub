import { useCallback, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';
import type { LevelUpPayload, XpGrantedPayload } from '../types';

interface UseLiveLevelParams {
    baseLevel: number | null;
    isReady: boolean;
}

// Level can be confirmed by two independent events that may arrive a few
// hundred ms apart: xp:granted carries the recomputed level as a side
// effect of the XP grant, level:up is the dedicated "you actually leveled"
// signal (which also separately triggers the celebratory modal, see
// LevelUpDialog). Whichever lands first updates this card's number — it
// never blocks on the other one to avoid stalling the visible count.
export function useLiveLevel({ baseLevel, isReady }: UseLiveLevelParams) {
    const [liveLevel, setLiveLevel] = useState<number | null>(null);

    const handleXpGranted = useCallback(
        (payload: XpGrantedPayload) => {
            if (!isReady) return;
            setLiveLevel(payload.level);
        },
        [isReady],
    );
    useSocketEvent<XpGrantedPayload>('xp:granted', handleXpGranted);

    const handleLevelUp = useCallback(
        (payload: LevelUpPayload) => {
            if (!isReady) return;
            setLiveLevel(payload.level);
        },
        [isReady],
    );
    useSocketEvent<LevelUpPayload>('level:up', handleLevelUp);

    return {
        level: liveLevel ?? baseLevel,
    };
}
