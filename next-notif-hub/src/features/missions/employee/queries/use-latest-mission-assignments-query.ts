import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { LATEST_ASSIGNMENTS_QUERY_KEY } from '../../constants';
import type { MissionAssignment } from '../../types';

interface UseLatestMissionAssignmentsQueryParams {
    enabled?: boolean;
}

// GET /missions/assignments/latest — the employee's 5 most-recent ASSIGNED
// assignments, mission relation embedded, already filtered/ordered/capped
// server-side (status: 'ASSIGNED', assignedAt DESC, take: 5) — no query
// params needed here, unlike the general-purpose my-assignments endpoint.
export function useLatestMissionAssignmentsQuery({ enabled }: UseLatestMissionAssignmentsQueryParams = {}) {
    return useApiQuery<MissionAssignment[]>({
        queryKey: LATEST_ASSIGNMENTS_QUERY_KEY,
        endpoint: ENDPOINTS.MISSIONS.LATEST_ASSIGNMENTS,
        enabled,
    });
}
