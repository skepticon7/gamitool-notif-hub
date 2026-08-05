'use client';

import { useAuthStore } from '@/store/auth-store';
import { LevelUpDialog } from '@/features/employees';
import { BadgeGrantedDialog } from '@/features/badges';

// Mounted once at the app-shell level (not inside the dashboard) since XP,
// level-up, and badge grants can fire while an employee is on any page, not
// just the dashboard.
export function EmployeeRewardOverlays() {
    const role = useAuthStore((s) => s.user?.role);

    if (role !== 'employee') {
        return null;
    }

    return (
        <>
            <LevelUpDialog />
            <BadgeGrantedDialog />
        </>
    );
}
