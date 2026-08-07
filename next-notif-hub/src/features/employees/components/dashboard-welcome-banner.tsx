'use client';

import Image from 'next/image';
import { useAuthStore } from '@/store/auth-store';

export function DashboardWelcomeBanner() {
    const user = useAuthStore((s) => s.user);
    const firstName = user?.name.trim().split(/\s+/)[0] ?? '';

    return (
        <div className="relative mb-5 ">
            {/* Rounded/clipped background layer, separate from the
                illustration below — so the illustration (a sibling, not a
                child of this) can extend past the card's edges instead of
                being clipped by this layer's own overflow-hidden. */}
            <div className="absolute inset-0 overflow-hidden rounded-[20px] bg-gradient-to-br from-light-blue to-light-purple">
                <span className="pointer-events-none absolute top-[62%] left-[30%] h-16 w-16 rounded-full bg-white/50 blur-xl" />
                <span className="pointer-events-none absolute top-[68%] left-[38%] h-6 w-6 rounded-full bg-white/60 blur-[2px]" />
            </div>

            <div className="relative flex items-center justify-between gap-6 px-8 py-10">
                <div className="max-w-lg">
                    <h1 className="mb-1.5 text-[22px] font-extrabold text-foreground">
                        Welcome {firstName} 👋 to your Dashboard
                    </h1>
                    <p className="text-[14px] leading-relaxed text-primary">
                        Ready to continue your journey?
                        <br />
                        You&apos;re doing amazing!
                    </p>
                </div>
            </div>

            <div className="absolute right-10 -top-5 z-10">
                <Image src="/illustrations/person.svg" alt="" width={220} height={150} priority />
            </div>
        </div>
    );
}
