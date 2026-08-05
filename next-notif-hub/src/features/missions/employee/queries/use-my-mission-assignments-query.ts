import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { myAssignmentsQueryKey } from '../../constants';
import type { MissionAssignment, MissionAssignmentStatus } from '../../types';

interface UseMyMissionAssignmentsQueryParams {
    status?: MissionAssignmentStatus;
    enabled?: boolean;
}

export function useMyMissionAssignmentsQuery({ status, enabled }: UseMyMissionAssignmentsQueryParams = {}) {
    return useApiQuery<MissionAssignment[]>({
        queryKey: myAssignmentsQueryKey(status),
        endpoint: ENDPOINTS.MISSIONS.MY_ASSIGNMENTS,
        params: status ? { status } : undefined,
        enabled,
    });
}
