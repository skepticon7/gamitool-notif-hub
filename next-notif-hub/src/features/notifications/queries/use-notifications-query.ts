import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { NOTIFICATIONS_QUERY_KEY } from '../constants';
import type { AppNotification } from '../types';

interface UseNotificationsQueryParams {
    enabled?: boolean;
}

// Every unread notification, unbounded (no pagination) — marking read is
// what shrinks this list. Fetched lazily (enabled: dropdown open) rather
// than on every page load, since it's unbounded and most sessions never
// open the bell.
export function useNotificationsQuery({ enabled }: UseNotificationsQueryParams = {}) {
    return useApiQuery<AppNotification[]>({
        queryKey: NOTIFICATIONS_QUERY_KEY,
        endpoint: ENDPOINTS.NOTIFICATIONS.LIST,
        enabled,
    });
}
