import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { BADGES_QUERY_KEY } from '../../constants';
import type { Badge, UpdateBadgeInput } from '../../types';

export interface UpdateBadgePayload {
    id: string;
    data: UpdateBadgeInput;
}

export function useUpdateBadgeMutation() {
    return useApiMutation<UpdateBadgePayload, Badge>({
        endpoint: (payload) => ENDPOINTS.ADMIN.BADGE(payload.id),
        method: 'PATCH',
        body: (payload) => payload.data,
        invalidateKeys: [BADGES_QUERY_KEY],
    });
}
