import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { MISSIONS_QUERY_KEY } from '../../constants';
import type { Mission, UpdateMissionInput } from '../../types';

export interface UpdateMissionPayload {
    id: string;
    data: UpdateMissionInput;
}

export function useUpdateMissionMutation() {
    return useApiMutation<UpdateMissionPayload, Mission>({
        endpoint: (payload) => ENDPOINTS.ADMIN.MISSION(payload.id),
        method: 'PATCH',
        body: (payload) => payload.data,
        invalidateKeys: [MISSIONS_QUERY_KEY],
    });
}
