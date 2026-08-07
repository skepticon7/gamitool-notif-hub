'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { EMPLOYEE_PROFILE_QUERY_KEY } from '../constants';

// Mounted app-wide — same reasoning as MissionAssignmentCacheSync.
// xp:granted/level:up/badge:granted/mission:completed all affect fields on
// GET /employees/me. The per-stat live hooks (useLiveXp, useLiveLevel, ...)
// only keep a CURRENTLY MOUNTED component fresh; a component that unmounts
// (e.g. the dashboard's stat cards, when the user navigates away) and later
// remounts needs this invalidation, or it serves the cached profile from
// before the event fired. The profile drawer never has this problem
// because it's always mounted (TopBar renders it unconditionally — `open`
// only toggles visibility), so its own live hooks never lose their
// subscription in the first place.
export function EmployeeProfileCacheSync() {
    const queryClient = useQueryClient();

    const invalidateProfile = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: EMPLOYEE_PROFILE_QUERY_KEY });
    }, [queryClient]);

    useSocketEvent<unknown>('xp:granted', invalidateProfile);
    useSocketEvent<unknown>('level:up', invalidateProfile);
    useSocketEvent<unknown>('badge:granted', invalidateProfile);
    useSocketEvent<unknown>('mission:completed', invalidateProfile);

    return null;
}
