'use client';

import { useState } from 'react';
import { Clock, Pencil, Sparkles, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ApiError } from '@/lib/api-error';
import { useMissionsQuery } from '../queries/use-missions-query';
import { useDeleteMissionMutation } from '../mutations/use-delete-mission-mutation';
import { MissionFormDialog } from './mission-form-dialog';
import type { Mission } from '../../types';

// Fixed-width columns (no `auto`) on purpose — each row below is its own
// independent grid container, not one shared table, so an `auto` column
// would size to *that row's own* content. The header row's near-empty
// actions cell and a data row's two icon buttons would then compute
// different column widths and drift out of alignment with each other.
const GRID_COLS = 'grid-cols-[2fr_1fr_.8fr_92px]';

interface MissionsTableProps {
    createOpen: boolean;
    onCreateOpenChange: (open: boolean) => void;
}

export function MissionsTable({ createOpen, onCreateOpenChange }: MissionsTableProps) {
    const { data: missions, isLoading, isError } = useMissionsQuery();
    const deleteMission = useDeleteMissionMutation();

    const [editingMission, setEditingMission] = useState<Mission | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Mission | null>(null);

    const dialogOpen = createOpen || Boolean(editingMission);

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setEditingMission(null);
            onCreateOpenChange(false);
        }
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        deleteMission.mutate(pendingDelete.id, {
            onSuccess: () => {
                toast.success('Mission deleted');
                setPendingDelete(null);
            },
            onError: (err) => {
                toast.error(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
            },
        });
    };

    return (
        <div>
            <div className="w-full overflow-hidden rounded-card border border-card-border bg-white shadow-card">
                <div
                    className={`grid ${GRID_COLS} items-center gap-4 border-b border-border bg-[#f8fafd] px-5 py-3 text-[11.5px] font-extrabold tracking-[.04em] text-gray uppercase`}
                >
                    <div className="flex items-center gap-1.5">
                        <Target size={13} />
                        Mission
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Clock size={13} />
                        Duration
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Sparkles size={13} />
                        XP
                    </div>
                    <div />
                </div>

                {isLoading && <div className="p-8 text-center text-sm text-gray">Loading missions…</div>}
                {isError && (
                    <div className="p-8 text-center text-sm text-destructive">Couldn&apos;t load missions.</div>
                )}
                {!isLoading && !isError && missions?.length === 0 && (
                    <div className="p-8 text-center text-sm text-gray">No missions yet.</div>
                )}

                {missions?.map((mission) => (
                    <div
                        key={mission.id}
                        className={`grid ${GRID_COLS} items-center gap-4 border-b border-[#f1f4fa] px-5 py-4 last:border-b-0`}
                    >
                        <div className="text-sm font-bold text-foreground">{mission.name}</div>
                        <div className="text-[13.5px] font-semibold text-foreground">
                            {mission.durationDays
                                ? `${mission.durationDays} day${mission.durationDays === 1 ? '' : 's'}`
                                : 'No deadline'}
                        </div>
                        <div className="text-[13.5px] font-extrabold text-primary">+{mission.xpGranted}</div>
                        <div className="flex justify-end gap-1.5">
                            <button
                                type="button"
                                onClick={() => setEditingMission(mission)}
                                aria-label="Edit mission"
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-light-blue text-[#2563eb] hover:bg-[#2563eb]/20"
                            >
                                <Pencil size={14} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setPendingDelete(mission)}
                                aria-label="Delete mission"
                                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-light-pink text-destructive hover:bg-destructive/20"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <MissionFormDialog open={dialogOpen} onOpenChange={handleDialogOpenChange} mission={editingMission ?? undefined} />

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete mission"
                description={`Are you sure you want to delete "${pendingDelete?.name}"? This can't be undone.`}
                onConfirm={handleDelete}
                isPending={deleteMission.isPending}
            />
        </div>
    );
}
