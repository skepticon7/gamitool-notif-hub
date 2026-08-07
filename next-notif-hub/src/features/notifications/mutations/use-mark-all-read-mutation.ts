import { useApiMutation } from '@/hooks/use-api-mutation';
import ENDPOINTS from '@/config/constants/endpoints';
import { NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY } from '../constants';

export function useMarkAllReadMutation() {
    return useApiMutation<void, void>({
        endpoint: ENDPOINTS.NOTIFICATIONS.READ_ALL,
        method: 'POST',
        body: () => undefined,
        invalidateKeys: [NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY],
    });
}
