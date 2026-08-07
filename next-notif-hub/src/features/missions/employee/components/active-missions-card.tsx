'use client';

import {useCallback, useState} from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { ApiError } from '@/lib/api-error';
import ROUTES from '@/config/constants/routes';
import { useLatestMissionAssignmentsQuery } from '../queries/use-latest-mission-assignments-query';
import { useCompleteMissionMutation } from '../mutations/use-complete-mission-mutation';
import { formatDeadline } from '../../utils/format-deadline';
import type { MissionAssignment } from '../../types';

export function ActiveMissionsCard() {
    const assignments = useLatestMissionAssignmentsQuery();
    const completeMission = useCompleteMissionMutation();
    const [liveMissions, setLiveMissions] = useState<MissionAssignment[]>([]);
    const [completingId, setCompletingId] = useState<string | null>(null);

    // REST is the source of truth on load — live pushes are ignored until
    // the initial fetch actually succeeds, so a mission:assigned event that
    // arrives while the first request is still in flight can't race ahead
    // of it (e.g. get merged, then get wiped out or duplicated once the
    // REST response lands).
    const handleMissionAssigned = useCallback(
        (payload: MissionAssignment) => {
            if (!assignments.isSuccess) return;
            setLiveMissions((prev) => [payload, ...prev]);
        },
        [assignments.isSuccess],
    );
    useSocketEvent<MissionAssignment>('mission:assigned', handleMissionAssigned);

    // AssignmentDto guarantees `mission`/`xpStatus` on every row now — no
    // down-mapping or defensive filtering needed, REST rows and live pushes
    // are already the same shape.
    const restItems = assignments.data ?? [];
    const restIds = new Set(restItems.map((item) => item.id));
    // Capped at 5 to match the endpoint's own "latest 5" semantics — without
    // this, a burst of live mission:assigned pushes could grow the panel
    // past what "latest" is supposed to mean.
    const items = [...liveMissions.filter((item) => !restIds.has(item.id)), ...restItems].slice(0, 5);

    const handleComplete = (id: string) => {
        setCompletingId(id);
        completeMission.mutate(id, {
            onSuccess: () => {
                toast.success('Mission completed');
                setLiveMissions((prev) => prev.filter((item) => item.id !== id));
            },
            onError: (err) => {
                toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            },
            onSettled: () => setCompletingId(null),
        });
    };


    return (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
                <h2 className="text-base font-bold text-foreground">Active missions</h2>
                <Link
                    href={ROUTES.EMPLOYEE.MISSIONS}
                    className="text-[13px] font-semibold text-primary hover:underline"
                >
                    View all →
                </Link>
            </div>

            <div>
                {assignments.isLoading && (
                    <div className="p-8 text-center text-[13.5px] text-gray">Loading missions…</div>
                )}
                {assignments.isError && (
                    <div className="p-8 text-center text-[13.5px] text-destructive">Couldn&apos;t load missions.</div>
                )}
                {!assignments.isLoading && !assignments.isError && items.length === 0 && (
                    <div className="p-[30px] text-center text-[13.5px] text-gray">No active missions. Nice work.</div>
                )}

                {items.map((item) => {
                    const deadlineInfo = item.deadline ? formatDeadline(item.deadline) : null;
                    // xpStatus can be false if the admin never wired this
                    // mission's completion to GrantXP — don't promise XP
                    // the backend isn't actually going to grant.
                    const metaParts = [
                        ...(item.xpStatus ? [`+${item.mission.xpGranted} XP`] : []),
                        ...(item.mission.durationDays ? [] : ['No deadline']),
                    ];
                    const metaText = metaParts.join(' · ');

                    return (
                        <div
                            key={item.id}
                            className="flex items-center gap-3.5 border-b border-[#f1f4fa] px-[22px] py-[15px] last:border-b-0"
                        >
                            <div
                                className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                                style={{
                                    background: deadlineInfo?.urgent ? 'var(--red)' : 'var(--primary)',
                                    boxShadow: deadlineInfo?.urgent
                                        ? '0 0 0 4px var(--light-pink)'
                                        : '0 0 0 4px var(--light-blue)',
                                }}
                            />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-semibold text-foreground">{item.mission.name}</div>
                                {metaText && <div className="mt-0.5 text-[12.5px] text-gray">{metaText}</div>}
                            </div>
                            {deadlineInfo && item.mission.durationDays && (
                                <span
                                    className="flex-shrink-0 rounded-pill px-2.5 py-1 text-[11.5px] font-bold whitespace-nowrap"
                                    style={{
                                        color: deadlineInfo.urgent ? 'var(--red)' : 'var(--orange)',
                                        background: deadlineInfo.urgent ? 'var(--light-pink)' : '#fff2e6',
                                    }}
                                >
                                    {deadlineInfo.text}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleComplete(item.id)}
                                disabled={completingId === item.id}
                                className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[10px] border border-primary bg-white px-[15px] text-[13px] font-bold whitespace-nowrap text-primary hover:bg-light-blue"
                            >
                                {completingId === item.id && <Loader2 size={14} className="animate-spin" />}
                                Complete
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
