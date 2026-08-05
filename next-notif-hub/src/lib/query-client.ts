import { QueryClient } from '@tanstack/react-query';

// A module-level singleton (not created inside QueryProvider via useState)
// so it's reachable from outside React — specifically auth-store.ts's
// clearSession(), which needs to wipe every cached query on logout. Without
// this, user-scoped query keys (activity feed, employee profile, etc.)
// aren't parameterized by user id, so the next person to log in on the same
// tab would see the previous user's cached data until a refetch overwrote it.
export const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});
