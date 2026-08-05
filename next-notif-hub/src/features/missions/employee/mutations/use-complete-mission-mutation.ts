import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { LATEST_ASSIGNMENTS_QUERY_KEY, myAssignmentsQueryKey } from '../../constants';

// No request body — the backend derives the caller from the JWT, not from
// anything sent here (see CLAUDE.md: "Owner-or-admin" on the assignment id).
export function useCompleteMissionMutation() {
    return useApiMutation<string, void>({
        endpoint: (assignmentId) => ENDPOINTS.MISSIONS.COMPLETE_ASSIGNMENT(assignmentId),
        method: 'POST',
        body: () => undefined,
        invalidateKeys: [LATEST_ASSIGNMENTS_QUERY_KEY, myAssignmentsQueryKey('ASSIGNED'), myAssignmentsQueryKey()],
    });
}
