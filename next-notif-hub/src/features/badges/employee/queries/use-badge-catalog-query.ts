import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { BADGE_CATALOG_QUERY_KEY } from '../../constants';
import type { Badge } from '../../types';

interface UseBadgeCatalogQueryParams {
    enabled?: boolean;
}

// The full badge catalog (locked + unlocked) — unlike my-badges, this
// returns every badge regardless of whether the caller has earned it, so
// the badge case can render locked silhouettes and a progress-to-next bar.
// Unlock status itself isn't part of the response — it's derived client
// side from employees/me's missionsCompleted vs. each badge's threshold.
export function useBadgeCatalogQuery({ enabled }: UseBadgeCatalogQueryParams = {}) {
    return useApiQuery<Badge[]>({
        queryKey: BADGE_CATALOG_QUERY_KEY,
        endpoint: ENDPOINTS.BADGES.CATALOG,
        enabled,
    });
}
