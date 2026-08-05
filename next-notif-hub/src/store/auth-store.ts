import { create } from 'zustand';
import { decodeJwt } from '@/lib/jwt';
import { queryClient } from '@/lib/query-client';
import { refresh } from '@/features/auth/api/refresh';
import type { AppJwtPayload, AuthUser } from '@/types/auth';

const REFRESH_TOKEN_STORAGE_KEY = 'eden.refreshToken';

function toAuthUser(payload: AppJwtPayload): AuthUser {
    const role = payload.groups[0] === 'admin' ? 'admin' : 'employee';

    const words = payload.name.trim().split(/\s+/).filter(Boolean);
    const initials =
        words.length > 1
            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
            : (words[0] ?? '').slice(0, 2).toUpperCase();

    return { ...payload, role, initials };
}

interface AuthState {
    accessToken: string | null;
    refreshToken: string | null;
    user: AuthUser | null;
    isHydrating: boolean;
    setSession: (tokens: { accessToken: string; refreshToken: string }) => void;
    clearSession: () => void;
    hydrate: () => Promise<void>;
}

// The access token stays in-memory only — never persisted. The refresh
// token is persisted to localStorage (see hydrate()) purely so a reload
// doesn't force a full re-login; it's redeemed for a new access token on
// load via POST /auth/refresh rather than trusted directly for anything.
export const useAuthStore = create<AuthState>((set, get) => ({
    accessToken: null,
    refreshToken: null,
    user: null,
    isHydrating: true,
    setSession: ({ accessToken, refreshToken }) => {
        const payload = decodeJwt<AppJwtPayload>(accessToken);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
        }
        set({ accessToken, refreshToken, user: toAuthUser(payload) });
    },
    clearSession: () => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
        }
        // Query keys (activity feed, employee profile, etc.) aren't
        // parameterized by user id — without this, the next person to log
        // in on the same tab would see this user's cached data until a
        // refetch happened to overwrite it.
        queryClient.clear();
        set({ accessToken: null, refreshToken: null, user: null });
    },
    hydrate: async () => {
        if (typeof window === 'undefined') {
            return;
        }

        const storedRefreshToken = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        if (!storedRefreshToken) {
            set({ isHydrating: false });
            return;
        }

        try {
            const { accessToken, refreshToken: newRefreshToken } = await refresh(storedRefreshToken);
            get().setSession({ accessToken, refreshToken: newRefreshToken });
        } catch {
            get().clearSession();
        } finally {
            set({ isHydrating: false });
        }
    },
}));
