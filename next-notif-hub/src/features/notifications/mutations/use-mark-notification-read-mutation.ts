import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY } from '../constants';

export function useMarkNotificationReadMutation() {
    return useApiMutation<string, void>({
        endpoint: (id) => ENDPOINTS.NOTIFICATIONS.MARK_READ(id),
        method: 'POST',
        body: () => undefined,
        invalidateKeys: [NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY],
    });
}
