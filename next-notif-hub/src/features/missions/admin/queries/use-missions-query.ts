import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { MISSIONS_QUERY_KEY } from '../../constants';
import type { Mission } from '../../types';

export function useMissionsQuery() {
    return useApiQuery<Mission[]>({
        queryKey: MISSIONS_QUERY_KEY,
        endpoint: ENDPOINTS.ADMIN.MISSIONS,
    });
}
