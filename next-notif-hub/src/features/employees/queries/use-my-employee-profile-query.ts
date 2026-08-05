import { useApiQuery } from '@/hooks/use-api-query';
import ENDPOINTS from '@/config/constants/endpoints';
import { EMPLOYEE_PROFILE_QUERY_KEY } from '../constants';
import type { EmployeeProfile } from '../types';

interface UseMyEmployeeProfileQueryParams {
    enabled?: boolean;
}

export function useMyEmployeeProfileQuery({ enabled }: UseMyEmployeeProfileQueryParams = {}) {
    return useApiQuery<EmployeeProfile>({
        queryKey: EMPLOYEE_PROFILE_QUERY_KEY,
        endpoint: ENDPOINTS.EMPLOYEES.ME,
        enabled,
    });
}
