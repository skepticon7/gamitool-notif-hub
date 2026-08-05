'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import ROUTES from '@/config/constants/routes';

export function AuthGuard({ children }: { children: ReactNode }) {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    useEffect(() => {
        if (!user) {
            router.replace(ROUTES.LOGIN);
        }
    }, [user, router]);

    if (!user) {
        return null;
    }

    return <>{children}</>;
}
