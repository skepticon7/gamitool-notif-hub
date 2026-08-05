import apiFetch from '@/lib/api-fetch';
import ENDPOINTS from '@/config/constants/endpoints';
import type { LoginInput, LoginResponse } from '../types';

export function login(input: LoginInput): Promise<LoginResponse> {
    return apiFetch<LoginInput, LoginResponse>({
        endpoint: ENDPOINTS.AUTH.LOGIN,
        method: 'POST',
        body: input,
    });
}
