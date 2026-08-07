'use client';

import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useAuthStore } from '@/store/auth-store';
import ROUTES from '@/config/constants/routes';
import {
    useMyEmployeeProfileQuery,
    computeLevelProgress,
    useLiveXp,
    useLiveLevel,
    useLiveMissionsCompleted,
    useLiveBadgesEarned,
} from '@/features/employees';
import { SignOutIcon } from './nav-icons';
import type { AuthUser } from '@/types/auth';

interface ProfileDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: AuthUser;
}

export function ProfileDrawer({ open, onOpenChange, user }: ProfileDrawerProps) {
    const router = useRouter();
    const clearSession = useAuthStore((s) => s.clearSession);

    const roleLabel = user.role === 'admin' ? 'Administrator' : 'Employee';
    const isEmployee = user.role === 'employee';

    const profile = useMyEmployeeProfileQuery({ enabled: open && isEmployee });
    const profileData = profile.data;

    // Same live hooks the dashboard stat cards use — the drawer isn't a
    // separate surface with its own staleness, it's just another consumer
    // of the same xp/level/missionsCompleted/badgesEarned facts.
    const { xp } = useLiveXp({ baseXp: profileData?.xp ?? null, isReady: profile.isSuccess });
    const { level } = useLiveLevel({ baseLevel: profileData?.level ?? null, isReady: profile.isSuccess });
    const { missionsCompleted } = useLiveMissionsCompleted({
        baseCount: profileData?.missionsCompleted ?? null,
        isReady: profile.isSuccess,
    });
    const { badgesEarned } = useLiveBadgesEarned({
        baseBadgesEarned: profileData?.badgesEarned ?? null,
        isReady: profile.isSuccess,
    });

    const hasXp = isEmployee && xp != null && level != null;
    const levelProgress = hasXp ? computeLevelProgress(xp!) : null;

    const rows: { label: string; value: string }[] = [
        { label: 'Email', value: user.email },
        { label: 'Role', value: roleLabel },
    ];

    if (isEmployee) {
        rows.push(
            {
                label: 'Total XP',
                value: profile.isLoading ? '…' : `${xp}`
            },
            {
                label: 'Level',
                value : profile.isLoading ? '…' : `${level}`
            },
            {
                label: 'Missions completed',
                value: profile.isLoading ? '…' : String(missionsCompleted ?? 0),
            },
            {
                label: 'Badges earned',
                value: profile.isLoading
                    ? '…'
                    : `${badgesEarned ?? 0} of ${profileData?.totalBadges ?? 0}`,
            },
        );
    }

    const doSignOut = () => {
        clearSession();
        router.push(ROUTES.LOGIN);
    };

    return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="right">
            <DrawerContent className="w-[340px] max-w-[340px] gap-0 rounded-none  p-0">
                <div
                    className="relative overflow-hidden px-[22px] pt-6 pb-[26px] text-white"
                    style={{ backgroundImage: 'var(--gradient-primary-to-secondary-2)' }}
                >
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            backgroundImage: 'radial-gradient(120% 120% at 100% 0, rgba(255,255,255,.25), transparent 55%)',
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        aria-label="Close"
                        className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] border border-white/40 bg-white/15 text-white"
                    >
                        <X size={16} />
                    </button>

                    <div className="relative flex h-[66px] w-[66px] items-center justify-center rounded-full border-2 border-white/60 bg-white/20 text-2xl font-extrabold">
                        {user.initials}
                    </div>
                    <DrawerTitle className="relative mt-3.5 text-xl font-extrabold text-white">
                        {user.name}
                    </DrawerTitle>
                    <div className="relative text-[13px] opacity-90">{roleLabel}</div>

                    {hasXp && levelProgress && (
                        <div className="relative mt-4">
                            <div className="mb-1.5 flex justify-between text-[11.5px] opacity-90">
                                <span>Level {level}</span>
                                <span>
                                    {levelProgress.xpInto.toLocaleString('en-US')} /{' '}
                                    {levelProgress.xpForNextLevel.toLocaleString('en-US')} XP
                                </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-md bg-white/28">
                                <div
                                    className="h-full rounded-md bg-white"
                                    style={{ width: `${levelProgress.percent}%` }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-[22px] py-3">
                    {rows.map((row) => (
                        <div
                            key={row.label}
                            className="flex items-center justify-between gap-4 border-b border-[#f1f4fa] py-3.5"
                        >
                            <span className="flex-shrink-0 text-[13px] font-semibold text-gray">{row.label}</span>
                            <span className="truncate text-right text-[13px] font-semibold text-foreground">
                                {row.value}
                            </span>
                        </div>
                    ))}
                </div>

                <div className="border-t border-border px-[22px] py-4">
                    <button
                        type="button"
                        onClick={doSignOut}
                        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-white text-sm font-bold text-foreground hover:bg-muted"
                    >
                        <SignOutIcon className="h-[17px] w-[17px]" />
                        Sign out
                    </button>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
