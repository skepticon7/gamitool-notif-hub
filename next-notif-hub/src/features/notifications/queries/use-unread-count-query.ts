import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { UNREAD_COUNT_QUERY_KEY } from '../constants';

// GET /notifications/unread-count returns a bare number (confirmed against
// GetUnreadNotificationCountQueryHandler — a plain repository.count() with
// no response envelope), not { count }.
export function useUnreadCountQuery() {
    return useApiQuery<number>({
        queryKey: UNREAD_COUNT_QUERY_KEY,
        endpoint: ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
    });
}
