'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { LATEST_ASSIGNMENTS_QUERY_KEY, myAssignmentsQueryKey } from '../../constants';

// Mounted app-wide (not just on the Quests/Dashboard pages) — a
// mission:assigned/completed/expired event that arrives while the user is
// elsewhere (e.g. on the dashboard, or any other page) still invalidates
// these caches. Without this, navigating to the Quests page afterward would
// serve the stale cached list until the default staleTime (60s) happened to
// elapse or a hard reload forced a fresh fetch — the per-page local
// live-merge state (MissionsList, ActiveMissionsCard) only helps while that
// specific page is actually mounted to receive the event itself.
export function MissionAssignmentCacheSync() {
    const queryClient = useQueryClient();

    const invalidateAssignments = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: myAssignmentsQueryKey() });
        queryClient.invalidateQueries({ queryKey: myAssignmentsQueryKey('ASSIGNED') });
        queryClient.invalidateQueries({ queryKey: myAssignmentsQueryKey('COMPLETED') });
        queryClient.invalidateQueries({ queryKey: myAssignmentsQueryKey('EXPIRED') });
        queryClient.invalidateQueries({ queryKey: LATEST_ASSIGNMENTS_QUERY_KEY });
    }, [queryClient]);

    useSocketEvent<unknown>('mission:assigned', invalidateAssignments);
    useSocketEvent<unknown>('mission:completed', invalidateAssignments);
    useSocketEvent<unknown>('mission:expired', invalidateAssignments);

    return null;
}
