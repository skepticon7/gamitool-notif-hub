'use client';

import { Briefcase } from 'lucide-react';
import { useMyMissionAssignmentsQuery } from '@/features/missions';
import { StatCard } from './stat-card';

// Deliberately the general-purpose my-assignments query (status: ASSIGNED),
// not assignments/latest — that one's capped at 5 for the dashboard's
// Active Missions panel and would undercount past that.
export function ActiveQuestsStatCard() {
    const assignments = useMyMissionAssignmentsQuery({ status: 'ASSIGNED' });

    return (
        <StatCard
            label="Active quests"
            value={assignments.data?.length ?? '—'}
            icon={Briefcase}
            accentTextClass="text-primary"
            accentBgClass="bg-light-blue"
        />
    );
}
