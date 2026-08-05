import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { MISSIONS_QUERY_KEY } from '../../constants';

export function useDeleteMissionMutation() {
    return useApiMutation<string, void>({
        endpoint: (id) => ENDPOINTS.ADMIN.MISSION(id),
        method: 'DELETE',
        body: () => undefined,
        invalidateKeys: [MISSIONS_QUERY_KEY],
    });
}
