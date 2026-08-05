'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

// Keying on pathname forces React to fully remount this wrapper on every
// route change, which re-triggers the animate-in classes below — otherwise
// a route change just swaps children in place with no transition at all.
export function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div key={pathname} className="animate-in fade-in slide-in-from-top-3 duration-300 ease-out">
            {children}
        </div>
    );
}
