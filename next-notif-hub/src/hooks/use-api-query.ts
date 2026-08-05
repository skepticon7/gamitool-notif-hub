import {useAuthStore} from "@/store/auth-store";
import {useQuery} from "@tanstack/react-query";
import apiFetch from "@/lib/api-fetch";

interface UseApiQueryParams {
    queryKey:readonly unknown[];
    endpoint: string;
    params?:Record<string, string>;
    enabled?:boolean;
}

export function useApiQuery<Response>({queryKey , endpoint , params, enabled} : UseApiQueryParams) {
    const accessToken : string | null = useAuthStore((state) => state.accessToken);

    return useQuery({
        queryKey,
        enabled: enabled ?? Boolean(accessToken),
        queryFn : () => apiFetch<undefined , Response>({
            endpoint,
            method: 'GET',
            token : accessToken,
            params
        })
    })
}