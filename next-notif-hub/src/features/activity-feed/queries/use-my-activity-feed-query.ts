import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { ACTIVITY_FEED_QUERY_KEY } from '../constants';
import type { ActivityFeedEntry } from '../types';

interface UseMyActivityFeedQueryParams {
    enabled?: boolean;
}

// Server already caps this at 5 most-recent entries (.limit(5)) — not a
// client-side concern for the initial load.
export function useMyActivityFeedQuery({ enabled }: UseMyActivityFeedQueryParams = {}) {
    return useApiQuery<ActivityFeedEntry[]>({
        queryKey: ACTIVITY_FEED_QUERY_KEY,
        endpoint: ENDPOINTS.ACTIVITY_FEED,
        enabled,
    });
}
