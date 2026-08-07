'use client';

import { useCallback, useState } from 'react';
import { useSocketEvent } from '@/hooks/use-socket-event';
import type { BadgeGrantedPayload } from '@/features/badges';

interface UseLiveBadgesEarnedParams {
    baseBadgesEarned: number | null;
    isReady: boolean;
}

// One badge:granted event fires per badge actually earned (GrantBadgeAction
// loops and emits once per newly-earned badge), so a plain +1 per event is
// exact — no need to read anything off the payload itself.
export function useLiveBadgesEarned({ baseBadgesEarned, isReady }: UseLiveBadgesEarnedParams) {
    const [increment, setIncrement] = useState(0);

    const handleBadgeGranted = useCallback(() => {
        if (!isReady) return;
        setIncrement((n) => n + 1);
    }, [isReady]);
    useSocketEvent<BadgeGrantedPayload>('badge:granted', handleBadgeGranted);

    return {
        badgesEarned: baseBadgesEarned == null ? null : baseBadgesEarned + increment,
    };
}