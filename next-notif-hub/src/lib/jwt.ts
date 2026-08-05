/**
 * Decodes a JWT's payload without verifying its signature — this is a
 * client-side display concern only, the backend is the source of truth
 * for auth.
 */
export function decodeJwt<T>(token: string): T {
    const payload = token.split('.')[1];
    if (!payload) {
        throw new Error('Invalid JWT: missing payload segment');
    }

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);

    return JSON.parse(json) as T;
}
