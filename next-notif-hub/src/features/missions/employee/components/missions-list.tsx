'use client';

import {useCallback, useState} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Calendar,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Frown,
    Loader2,
    RotateCcw,
    Sparkles,
    Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-error';
import { useMyMissionAssignmentsQuery } from '../queries/use-my-mission-assignments-query';
import { useCompleteMissionMutation } from '../mutations/use-complete-mission-mutation';
import { formatDeadline } from '../../utils/format-deadline';
import type {MissionAssignment, MissionAssignmentStatus} from '../../types';
import {useSocketEvent} from "@/hooks/use-socket-event";

const FILTERS: { value: MissionAssignmentStatus; label: string }[] = [
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'EXPIRED', label: 'Expired' },
];

// Fixed-width columns (no `auto`) — same reasoning as the admin catalog
// tables: each row is its own independent grid container, so an `auto`
// column sizes to that row's own content and drifts out of alignment with
// the header/other rows. The trailing action column only ever renders
// something for ASSIGNED (Complete button) and EXPIRED (label) rows — on
// the Completed tab it'd just be dead space, so it's dropped entirely
// there and the remaining columns spread out to fill the width instead.
const GRID_COLS_WITH_ACTION = 'grid-cols-[1.6fr_1.1fr_1.1fr_1fr_.9fr_128px]';
const GRID_COLS_NO_ACTION = 'grid-cols-[1.8fr_1.2fr_1.2fr_1.1fr_1fr]';

const PAGE_SIZE = 7;

const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });

type SortField = 'name' | 'assignedAt' | 'completedAt' | 'deadline' | 'xp';
type SortDirection = 'asc' | 'desc';

// Nulls sort to the end regardless of direction (an unset deadline/
// completedAt isn't meaningfully "smaller" or "larger" than a real date).
function getSortValue(assignment: MissionAssignment, field: SortField): number | string {
    switch (field) {
        case 'name':
            return assignment.mission.name.toLowerCase();
        case 'assignedAt':
            return new Date(assignment.assignedAt).getTime();
        case 'completedAt':
            return assignment.completedAt ? new Date(assignment.completedAt).getTime() : Infinity;
        case 'deadline':
            return assignment.deadline ? new Date(assignment.deadline).getTime() : Infinity;
        case 'xp':
            return assignment.mission.xpGranted;
    }
}

interface SortableHeaderProps {
    label: string;
    icon: LucideIcon;
    field: SortField;
    activeSort: { field: SortField; direction: SortDirection } | null;
    onSort: (field: SortField) => void;
}

function SortableHeader({ label, icon: Icon, field, activeSort, onSort }: SortableHeaderProps) {
    const isActive = activeSort?.field === field;
    return (
        <button
            type="button"
            onClick={() => onSort(field)}
            className="flex cursor-pointer items-center gap-1.5 hover:text-foreground"
        >
            <Icon size={13} />
            {label}
            {isActive ? (
                activeSort.direction === 'asc' ? (
                    <ArrowUp size={12} />
                ) : (
                    <ArrowDown size={12} />
                )
            ) : (
                <ArrowUpDown size={12} className="opacity-40" />
            )}
        </button>
    );
}

const DEFAULT_FILTER: MissionAssignmentStatus = 'ASSIGNED';

export function MissionsList() {
    const [filter, setFilter] = useState<MissionAssignmentStatus>(DEFAULT_FILTER);
    const [page, setPage] = useState(0);
    const assignments = useMyMissionAssignmentsQuery({ status: filter });
    const completeMission = useCompleteMissionMutation();
    const [completingId, setCompletingId] = useState<string | null>(null);
    const [liveAssignments , setLiveAssignments] = useState<MissionAssignment[]>([]);
    const [sort, setSort] = useState<{ field: SortField; direction: SortDirection } | null>(null);
    const showActionColumn = filter !== 'COMPLETED';
    const gridCols = showActionColumn ? GRID_COLS_WITH_ACTION : GRID_COLS_NO_ACTION;
    // Scoped to sort/pagination only — the active tab is the user's own
    // navigation choice, not something a "reset" should override.
    const isFiltered = sort !== null || page !== 0;

    const handleFilterChange = (value: MissionAssignmentStatus) => {
        setFilter(value);
        setPage(0);
    };

    const handleReset = () => {
        setSort(null);
        setPage(0);
    };

    const handleSort = (field: SortField) => {
        setSort((prev) => (prev?.field === field ? { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : { field, direction: 'asc' }));
        setPage(0);
    };

    const handleComplete = (id: string) => {
        setCompletingId(id);
        completeMission.mutate(id, {
            onSuccess: () => {
                toast.success('Mission completed');
                // Don't wait on the mission:completed round-trip for this
                // one — an item that arrived via a live mission:assigned
                // push has a frozen status:'ASSIGNED' snapshot in
                // liveAssignments that nothing else updates, so it'd keep
                // passing the `a.status === filter` check below forever.
                setLiveAssignments((prev) => prev.filter((a) => a.id !== id));
            },
            onError: (err) => {
                toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            },
            onSettled: () => setCompletingId(null),
        });
    };

    // AssignmentDto guarantees `mission`/`xpStatus` on every row now — the
    // socket push is already the exact same shape as the REST rows, no
    // manual reconstruction needed.
    const handleMissionAssigned = useCallback(
        (payload: MissionAssignment) => {
            if(!assignments.isSuccess) return;
            if(filter !== 'ASSIGNED') return;
            setLiveAssignments(prev => [payload , ...prev]);
        },
        [assignments.isSuccess , filter]
    )

    useSocketEvent<MissionAssignment>("mission:assigned" , handleMissionAssigned);

    // General backstop for the same staleness, beyond just this user's own
    // Complete click — e.g. an assignment expiring while this page is open.
    // A liveAssignments entry never updates its own status after being
    // pushed, so once it's no longer ASSIGNED it has to be removed outright
    // rather than relying on the status check to exclude it.
    const handleMissionTransitioned = useCallback((payload: MissionAssignment) => {
        setLiveAssignments((prev) => prev.filter((a) => a.id !== payload.id));
    }, []);
    useSocketEvent<MissionAssignment>('mission:completed', handleMissionTransitioned);
    useSocketEvent<MissionAssignment>('mission:expired', handleMissionTransitioned);

    const restItems = assignments.data ?? [];
    const restId = new Set(restItems.map(a => a.id));
    // liveAssignments accumulates across filter switches (it's never
    // cleared) — a live push added while viewing "Assigned" must not keep
    // rendering after switching to "Completed", so it's filtered against
    // the *current* tab here, not just deduped against the REST result.
    const items = [
        ...liveAssignments.filter(
            a => !restId.has(a.id) && a.status === filter
        ),
        ...restItems
    ]
    const sortedItems = sort
        ? [...items].sort((a, b) => {
              const va = getSortValue(a, sort.field);
              const vb = getSortValue(b, sort.field);
              const cmp = va < vb ? -1 : va > vb ? 1 : 0;
              return sort.direction === 'asc' ? cmp : -cmp;
          })
        : items;

    // No page/limit params on this endpoint (see CLAUDE.md) — pagination is
    // client-side over the already-fetched, filtered result set.
    const totalPages = Math.max(1, Math.ceil(sortedItems.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages - 1);
    const pageItems = sortedItems.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    return (
        <div>
            <div className="mb-5">
                <h1 className="mb-1 text-[27px] font-extrabold text-foreground">Your Quests</h1>
                <p className="text-[15px] text-gray">Complete quests to earn XP and unlock badges.</p>
            </div>

            <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex gap-2">
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

                {isFiltered && (
                    <button
                        type="button"
                        onClick={handleReset}
                        className="flex h-10 cursor-pointer items-center gap-1.5 rounded-[11px] px-4 text-[13.5px] font-bold text-gray hover:bg-muted hover:text-foreground"
                    >
                        <RotateCcw size={14} />
                        Reset
                    </button>
                )}
            </div>

            <div className="w-full overflow-hidden rounded-card border border-card-border bg-white shadow-card">
                <div
                    className={`grid ${gridCols} items-center gap-4 border-b border-border bg-[#f8fafd] px-5 py-3 text-[11.5px] font-extrabold tracking-[.04em] text-gray uppercase`}
                >
                    <SortableHeader label="Quest" icon={Target} field="name" activeSort={sort} onSort={handleSort} />
                    <SortableHeader
                        label="Assigned"
                        icon={Calendar}
                        field="assignedAt"
                        activeSort={sort}
                        onSort={handleSort}
                    />
                    <SortableHeader
                        label="Completed"
                        icon={CheckCircle2}
                        field="completedAt"
                        activeSort={sort}
                        onSort={handleSort}
                    />
                    <SortableHeader
                        label="Deadline"
                        icon={Clock}
                        field="deadline"
                        activeSort={sort}
                        onSort={handleSort}
                    />
                    <SortableHeader label="XP" icon={Sparkles} field="xp" activeSort={sort} onSort={handleSort} />
                    {showActionColumn && <div />}
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
                    const mission = assignment.mission;
                    const deadlineInfo = assignment.deadline ? formatDeadline(assignment.deadline) : null;
                    const assignedAtText = formatDateTime(assignment.assignedAt);
                    const completedAtText = assignment.completedAt ? formatDateTime(assignment.completedAt) : null;

                    return (
                        <div
                            key={assignment.id}
                            className={`grid ${gridCols} items-center gap-4 border-b border-[#f1f4fa] px-5 py-4 last:border-b-0 ${
                                assignment.status === 'EXPIRED' ? 'opacity-70' : ''
                            }`}
                        >
                            <div className="truncate text-sm font-bold text-foreground">{mission.name}</div>

                            <div className="text-[13.5px] font-semibold text-foreground">{assignedAtText}</div>

                            <div className="text-[13.5px] font-semibold text-foreground">
                                {completedAtText ?? <span className="font-normal text-[#aab3c6]">—</span>}
                            </div>

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

                            {showActionColumn && (
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
                            )}
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
