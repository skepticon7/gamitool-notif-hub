import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { BADGES_QUERY_KEY } from '../../constants';
import type { Badge, CreateBadgeInput } from '../../types';

export function useCreateBadgeMutation() {
    return useApiMutation<CreateBadgeInput, Badge>({
        endpoint: ENDPOINTS.ADMIN.BADGES,
        method: 'POST',
        invalidateKeys: [BADGES_QUERY_KEY],
    });
}
