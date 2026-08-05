'use client';

import { DashboardWelcomeBanner, EmployeeStatsGrid } from '@/features/employees';
import { ActiveMissionsCard } from '@/features/missions';
import { RecentActivityCard } from '@/features/activity-feed';

export default function EmployeeDashboardPage() {
    return (
        <div>
            <DashboardWelcomeBanner />

            <EmployeeStatsGrid />

            <div className="grid items-start gap-5 lg:grid-cols-[1.5fr_1fr]">
                <ActiveMissionsCard />
                <RecentActivityCard />
            </div>
        </div>
    );
}
