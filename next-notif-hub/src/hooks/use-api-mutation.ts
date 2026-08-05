import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import apiFetch from '@/lib/api-fetch';

interface UseApiMutationConfig<Payload> {
    endpoint: string | ((payload: Payload) => string);
    method: 'POST' | 'PATCH' | 'DELETE';
    body?: (payload: Payload) => unknown;
    invalidateKeys?: readonly (readonly unknown[])[];
}

export function useApiMutation<Payload, Response>(
    config: UseApiMutationConfig<Payload>,
    options?: Omit<UseMutationOptions<Response, Error, Payload>, 'mutationFn'>,
) {
    const accessToken: string | null = useAuthStore((state) => state.accessToken);
    const queryClient = useQueryClient();

    return useMutation<Response, Error, Payload>({
        mutationFn: (payload) =>
            apiFetch<unknown, Response>({
                endpoint: typeof config.endpoint === 'function' ? config.endpoint(payload) : config.endpoint,
                method: config.method,
                token: accessToken,
                body: config.body ? config.body(payload) : payload,
            }),
        ...options,
        onSuccess: (data, variables, onMutateResult, context) => {
            config.invalidateKeys?.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
            options?.onSuccess?.(data, variables, onMutateResult, context);
        },
    });
}
