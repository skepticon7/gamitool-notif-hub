import apiFetch from '@/lib/api-fetch';
import ENDPOINTS from '@/config/constants/endpoints';
import type { LoginResponse } from '../types';

export function refresh(refreshToken: string): Promise<LoginResponse> {
    return apiFetch<{ refreshToken: string }, LoginResponse>({
        endpoint: ENDPOINTS.AUTH.REFRESH,
        method: 'POST',
        body: { refreshToken },
    });
}
