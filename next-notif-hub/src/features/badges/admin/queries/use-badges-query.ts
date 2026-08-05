import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { BADGES_QUERY_KEY } from '../../constants';
import type { Badge } from '../../types';

export function useBadgesQuery() {
    return useApiQuery<Badge[]>({
        queryKey: BADGES_QUERY_KEY,
        endpoint: ENDPOINTS.ADMIN.BADGES,
    });
}
