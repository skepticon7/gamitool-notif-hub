'use client';

import {useCallback, useState} from 'react';
import { Calendar, Check, ChevronLeft, ChevronRight, Clock, Frown, Loader2, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-error';
import { useMyMissionAssignmentsQuery } from '../queries/use-my-mission-assignments-query';
import { useCompleteMissionMutation } from '../mutations/use-complete-mission-mutation';
import { formatDeadline } from '../../utils/format-deadline';
import type {ActiveMissionSummary, MissionAssignment, MissionAssignmentStatus} from '../../types';
import {useSocketEvent} from "@/hooks/use-socket-event";

const FILTERS: { value: MissionAssignmentStatus; label: string }[] = [
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'EXPIRED', label: 'Expired' },
];

// Fixed-width columns (no `auto`) — same reasoning as the admin catalog
// tables: each row is its own independent grid container, so an `auto`
// column sizes to that row's own content and drifts out of alignment with
// the header/other rows.
const GRID_COLS = 'grid-cols-[2fr_1fr_1fr_.9fr_128px]';

const PAGE_SIZE = 8;

export function MissionsList() {
    const [filter, setFilter] = useState<MissionAssignmentStatus>('ASSIGNED');
    const [page, setPage] = useState(0);
    const assignments = useMyMissionAssignmentsQuery({ status: filter });
    const completeMission = useCompleteMissionMutation();
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [liveAssignments , setLiveAssignments] = useState<MissionAssignment[]>([]);

    const handleFilterChange = (value: MissionAssignmentStatus) => {
        setFilter(value);
        setPage(0);
    };

    const handleComplete = (id: string) => {
        setCompletingId(id);
        completeMission.mutate(id, {
            onSuccess: () => toast.success('Mission completed'),
            onError: (err) => {
                toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            },
            onSettled: () => setCompletingId(null),
        });
    };

    const handleMissionAssigned = useCallback(
        (payload: MissionAssignment) => {
            if(!assignments.isSuccess) return;
            if(filter !== 'ASSIGNED') return;
            setLiveAssignments(prev => [payload , ...prev]);
        },
        [assignments.isSuccess , filter]
    )

    useSocketEvent("mission:assigned" , handleMissionAssigned);

    // Rows without an embedded `mission` are skipped rather than rendered
    // with an undefined name — GetMyMissionAssignmentsHandler doesn't
    // eager-load the relation yet (see docs/mission-assignment-relation-
    // backend-prompt.md), so until that lands this table will render empty.
    const restItems = (assignments.data ?? []).filter((a) => a.mission);
    const restId = new Set(restItems.map(a => a.id));
    const items = [
        ...liveAssignments.filter(
            a => !restId.has(a.id)
        ),
        ...restItems
    ]
    // No page/limit params on this endpoint (see CLAUDE.md) — pagination is
    // client-side over the already-fetched, filtered result set.
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const pageItems = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    return (
        <div>
            <div className="mb-5">
                <h1 className="mb-1 text-[27px] font-extrabold text-foreground">Your Quests</h1>
                <p className="text-[15px] text-gray">Complete quests to earn XP and unlock badges.</p>
            </div>

            <div className="mb-4 flex gap-2">
                {FILTERS.map((f) => (
                    <button
                        key={f.value}
                        type="button"
                        onClick={() => handleFilterChange(f.value)}
                        className={`h-10 cursor-pointer rounded-[11px] px-4 text-[13.5px] font-bold ${
                            filter === f.value ? 'bg-primary text-white' : 'bg-white text-foreground hover:bg-muted'
                        }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            <div className="w-full overflow-hidden rounded-card border border-card-border bg-white shadow-card">
                <div
                    className={`grid ${GRID_COLS} items-center gap-4 border-b border-border bg-[#f8fafd] px-5 py-3 text-[11.5px] font-extrabold tracking-[.04em] text-gray uppercase`}
                >
                    <div className="flex items-center gap-1.5">
                        <Target size={13} />
                        Quest
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        Assigned
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={13} />
                        Deadline
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={13} />
                        XP
                    </div>
                    <div />
                </div>

                {assignments.isLoading && <div className="p-8 text-center text-sm text-gray">Loading quests…</div>}
                {assignments.isError && (
                    <div className="p-8 text-center text-sm text-destructive">Couldn&apos;t load quests.</div>
                )}
                {!assignments.isLoading && !assignments.isError && items.length === 0 && (
                    <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-gray">
                        <Frown size={28} className="text-[#cbd3e0]" />
                        No quests here yet.
                    </div>
                )}

                {pageItems.map((assignment) => {
                    const mission = assignment.mission!;
                    const deadlineInfo = assignment.deadline ? formatDeadline(assignment.deadline) : null;
                    const assignedAtText = new Date(assignment.assignedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                    });

                    return (
                        <div
                            key={assignment.id}
                            className={`grid ${GRID_COLS} items-center gap-4 border-b border-[#f1f4fa] px-5 py-4 last:border-b-0 ${
                                assignment.status === 'EXPIRED' ? 'opacity-70' : ''
                            }`}
                        >
                            <div className="truncate text-sm font-bold text-foreground">{mission.name}</div>

                            <div className="text-[13.5px] font-semibold text-foreground">{assignedAtText}</div>

                            <div>
                                {deadlineInfo ? (
                                    <span
                                        className="inline-block rounded-pill px-2.5 py-1 text-xs font-bold whitespace-nowrap"
                                        style={{
                                            color: deadlineInfo.urgent ? 'var(--red)' : 'var(--orange)',
                                            background: deadlineInfo.urgent ? 'var(--light-pink)' : '#fff2e6',
                                        }}
                                    >
                                        {deadlineInfo.text}
                                    </span>
                                ) : (
                                    !mission.durationDays && (
                                        <span className="text-xs font-semibold text-[#aab3c6]">No deadline</span>
                                    )
                                )}
                            </div>

                            <div>
                                {/* xpStatus can be false/undefined if the admin never wired
                                    this mission's completion to GrantXP — same gating as
                                    the dashboard's Active Missions panel. */}
                                {assignment.xpStatus ? (
                                    <span className="text-[13.5px] font-extrabold text-primary">
                                        +{mission.xpGranted} XP
                                    </span>
                                ) : (
                                    <span className="text-xs text-[#aab3c6]">—</span>
                                )}
                            </div>

                            <div className="flex justify-end">
                                {assignment.status === 'ASSIGNED' && (
                                    <button
                                        type="button"
                                        onClick={() => handleComplete(assignment.id)}
                                        disabled={completingId === assignment.id}
                                        className="flex h-9 cursor-pointer items-center gap-1.5 rounded-[10px] bg-primary px-4 text-[13px] font-bold whitespace-nowrap text-white shadow-[0_6px_16px_-6px_rgba(90,123,255,.8)]"
                                    >
                                        {completingId === assignment.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Check size={14} />
                                        )}
                                        Complete
                                    </button>
                                )}
                                {assignment.status === 'EXPIRED' && (
                                    <div className="text-[13px] font-semibold text-gray">Expired</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {items.length > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-[13px] text-gray">
                        Page {currentPage + 1} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.max(0, p - 1))}
                            disabled={currentPage === 0}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-border-strong bg-white text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                            disabled={currentPage >= totalPages - 1}
                            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[10px] border border-border-strong bg-white text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
