'use client';

import { Briefcase } from 'lucide-react';
import { useMyMissionAssignmentsQuery } from '@/features/missions';
import { useLiveActiveQuests } from '../hooks/use-live-active-quests';
import { StatCard } from './stat-card';

// Deliberately the general-purpose my-assignments query (status: ASSIGNED),
// not assignments/latest — that one's capped at 5 for the dashboard's
// Active Missions panel and would undercount past that.
export function ActiveQuestsStatCard() {
    const assignments = useMyMissionAssignmentsQuery({ status: 'ASSIGNED' });
    const { count } = useLiveActiveQuests({
        baseCount: assignments.data?.length ?? null,
        isReady: assignments.isSuccess,
    });

    return (
        <StatCard
            label="Active quests"
            value={count ?? '—'}
            icon={Briefcase}
            accentTextClass="text-primary"
            accentBgClass="bg-light-blue"
        />
    );
}
