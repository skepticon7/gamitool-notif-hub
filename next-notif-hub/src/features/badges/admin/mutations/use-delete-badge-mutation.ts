import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { BADGES_QUERY_KEY } from '../../constants';

export function useDeleteBadgeMutation() {
    return useApiMutation<string, void>({
        endpoint: (id) => ENDPOINTS.ADMIN.BADGE(id),
        method: 'DELETE',
        body: () => undefined,
        invalidateKeys: [BADGES_QUERY_KEY],
    });
}
