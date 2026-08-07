'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useAuthStore } from '@/store/auth-store';
import { NotificationBell } from '@/features/notifications';
import { ProfileDrawer } from './profile-drawer';

export function TopBar() {
    const user = useAuthStore((s) => s.user);
    const [profileOpen, setProfileOpen] = useState(false);

    if (!user) {
        return null;
    }

    return (
        <header className="relative z-40 flex h-16 flex-shrink-0 items-center gap-5 border-b border-border bg-white px-6">
            <Image src="/logos/gamitool-logo.svg" alt="EDEN" width={123} height={23} className="h-[26px] w-auto" />

            <div className="flex-1" />

            <div className="flex items-center gap-2 text-[13px] font-semibold text-gray">
                <span className="h-2 w-2 rounded-full bg-green" />
                Live · WebSocket
            </div>

            {user.role === 'employee' && <NotificationBell />}

            <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-label="Open profile"
                className="flex cursor-pointer items-center gap-2.5 border-l border-border py-1 pl-3 hover:opacity-80"
            >
                <div className="text-right leading-tight">
                    <div className="text-[13.5px] font-bold text-foreground">{user.name}</div>
                    <div className="text-[11.5px] text-gray">
                        {user.role === 'admin' ? 'Administrator' : 'Employee'}
                    </div>
                </div>
                <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[14px] font-bold text-white"
                    style={{ backgroundImage: 'var(--gradient-primary-to-secondary-2)' }}
                >
                    {user.initials}
                </div>
            </button>

            <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} user={user} />
        </header>
    );
}
