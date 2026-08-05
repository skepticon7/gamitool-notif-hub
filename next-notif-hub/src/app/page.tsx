'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { LoginForm } from '@/features/auth';
import { useAuthStore } from '@/store/auth-store';
import { homeRouteFor } from '@/config/constants/routes';

export default function RootPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);

    useEffect(() => {
        if (user) {
            router.replace(homeRouteFor(user.role));
        }
    }, [user, router]);

    if (user) {
        return null;
    }

    return (
        <div className="fixed inset-0 flex bg-white">
            {/* Left brand panel */}
            <div
                className="relative hidden w-[44%] min-w-[360px] flex-col overflow-hidden px-12 py-[52px] text-white md:flex"
                style={{ backgroundImage: 'var(--gradient-primary-to-secondary-2)' }}
            >
                <div
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: 'var(--gradient-login-overlay)' }}
                />
                <div className="relative flex items-center">
                    <Image
                        src="/logos/gamitool-logo-light.svg"
                        alt="GamiTool"
                        width={139}
                        height={26}
                        className="h-[30px] w-auto drop-shadow-logo"
                        priority
                    />
                </div>
                <div className="relative flex flex-1 max-w-[480px] flex-col justify-center">
                    <h1 className="mb-3.5 text-[34px] leading-[1.15] font-semibold text-balance">
                        Missions, XP and rewards — wired to your org&apos;s events.
                    </h1>
                    <p className="text-[15px] leading-[1.55] opacity-90">
                        Sign in to complete missions and earn badges, or manage the rules that drive them.
                        Everything updates in real time.
                    </p>
                </div>
                <div className="relative text-[12.5px] opacity-80">© Copyright 2026. Made by Game Changers.</div>
            </div>

            {/* Right form panel */}
            <div className="flex flex-1 items-center justify-center bg-app-background p-10">
                <div className="w-full max-w-[420px] rounded-[22px] border border-card-border bg-white p-9 shadow-login-card">
                    <h2 className="mb-1 text-[23px] font-semibold">Welcome back</h2>
                    <p className="mb-[22px] text-sm text-gray">Sign in to your workspace.</p>
                    <LoginForm />
                </div>
            </div>
        </div>
    );
}
