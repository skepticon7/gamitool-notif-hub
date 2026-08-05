import { ApiError } from './api-error';

interface ApiFetchParams<T> {
    body?: T;
    token?: string | null;
    endpoint: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    params?: Record<string, string>;
}

interface ApiErrorBody {
    message?: string;
    errorCode?: string;
}

export default async function apiFetch<Payload, Response>({
    body,
    token,
    endpoint,
    method,
    params,
}: ApiFetchParams<Payload>): Promise<Response> {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!baseUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not set');
    }

    const url = new URL(endpoint, baseUrl);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
    }

    const headers: Record<string, string> = {};
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url.toString(), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        let parsed: ApiErrorBody = {};
        try {
            parsed = await res.json();
        } catch {
            // non-JSON error body (e.g. a raw proxy error page) — fall through with defaults
        }
        throw new ApiError(parsed.message ?? res.statusText, res.status, parsed.errorCode);
    }

    if (res.status === 204 || res.headers.get('content-length') === '0') {
        return undefined as Response;
    }

    return (await res.json()) as Response;
}
