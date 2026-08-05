'use client';

import { useEffect, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

// Redeems a persisted refresh token (if any) for a fresh session before
// rendering anything, so a reload doesn't flash the login screen for a
// user who's actually still logged in — see auth-store.ts's hydrate().
export function AuthProvider({ children }: { children: ReactNode }) {
    const isHydrating = useAuthStore((s) => s.isHydrating);
    const hydrate = useAuthStore((s) => s.hydrate);

    useEffect(() => {
        hydrate();
    }, [hydrate]);

    if (isHydrating) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-app-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return <>{children}</>;
}
