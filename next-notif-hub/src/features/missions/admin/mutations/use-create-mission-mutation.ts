import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { MISSIONS_QUERY_KEY } from '../../constants';
import type { CreateMissionInput, Mission } from '../../types';

export function useCreateMissionMutation() {
    return useApiMutation<CreateMissionInput, Mission>({
        endpoint: ENDPOINTS.ADMIN.MISSIONS,
        method: 'POST',
        invalidateKeys: [MISSIONS_QUERY_KEY],
    });
}
