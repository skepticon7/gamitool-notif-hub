import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { MY_BADGES_QUERY_KEY } from '../../constants';
import type { Badge } from '../../types';

interface UseMyBadgesQueryParams {
    enabled?: boolean;
}

// Only badges already unlocked — GET /badges/my-badges doesn't return the
// full catalog, so this can't be used to show locked badges or progress
// toward the next one, just a count/list of what's earned.
export function useMyBadgesQuery({ enabled }: UseMyBadgesQueryParams = {}) {
    return useApiQuery<Badge[]>({
        queryKey: MY_BADGES_QUERY_KEY,
        endpoint: ENDPOINTS.BADGES.MY_BADGES,
        enabled,
    });
}
