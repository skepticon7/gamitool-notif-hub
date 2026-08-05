'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Award, Layers, Pencil, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ApiError } from '@/lib/api-error';
import { useBadgesQuery } from '../queries/use-badges-query';
import { useDeleteBadgeMutation } from '../mutations/use-delete-badge-mutation';
import { BadgeFormDialog } from './badge-form-dialog';
import type { Badge, BadgeTier } from '../../types';

// Fixed-width columns (no `auto`) — see the same note in missions-table.tsx.
// Each row is its own independent grid, so an `auto` column sizes to that
// row's own content; the header's empty icon/action cells would then drift
// out of alignment with a data row's trophy image and icon buttons.
const GRID_COLS = 'grid-cols-[56px_2fr_1fr_1.4fr_92px]';

const TIER_STYLES: Record<BadgeTier, { label: string; bg: string; fg: string }> = {
    bronze: { label: 'Bronze', bg: 'bg-trophy-bronze-bg', fg: 'text-trophy-bronze-fg' },
    silver: { label: 'Silver', bg: 'bg-trophy-silver-bg', fg: 'text-trophy-silver-fg' },
    gold: { label: 'Gold', bg: 'bg-trophy-gold-bg', fg: 'text-trophy-gold-fg' },
    diamond: { label: 'Diamond', bg: 'bg-trophy-diamond-bg', fg: 'text-trophy-diamond-fg' },
};

interface BadgesTableProps {
    createOpen: boolean;
    onCreateOpenChange: (open: boolean) => void;
}

export function BadgesTable({ createOpen, onCreateOpenChange }: BadgesTableProps) {
    const { data : badges, isLoading, isError } = useBadgesQuery();
    const deleteBadge = useDeleteBadgeMutation();

    const [editingBadge, setEditingBadge] = useState<Badge | null>(null);
    const [pendingDelete, setPendingDelete] = useState<Badge | null>(null);

    const dialogOpen = createOpen || Boolean(editingBadge);

    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setEditingBadge(null);
            onCreateOpenChange(false);
        }
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        deleteBadge.mutate(pendingDelete.id, {
            onSuccess: () => {
                toast.success('Badge deleted');
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
                    <div />
                    <div className="flex items-center gap-1.5">
                        <Award size={13} />
                        Badge
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Layers size={13} />
                        Tier
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Target size={13} />
                        Unlock at
                    </div>
                    <div />
                </div>

                {isLoading && <div className="p-8 text-center text-sm text-gray">Loading badges…</div>}
                {isError && <div className="p-8 text-center text-sm text-destructive">Couldn&apos;t load badges.</div>}
                {!isLoading && !isError && badges?.length === 0 && (
                    <div className="p-8 text-center text-sm text-gray">No badges yet.</div>
                )}

                {badges?.map((badge) => {
                    const tierStyle = TIER_STYLES[badge.tier];
                    return (
                        <div
                            key={badge.id}
                            className={`grid ${GRID_COLS} items-center gap-4 border-b border-[#f1f4fa] px-5 py-4 last:border-b-0`}
                        >
                            <Image
                                src={`/trophies/${badge.tier}.svg`}
                                alt=""
                                width={32}
                                height={31}
                                className="h-8 w-8"
                            />
                            <div className="text-sm font-bold text-foreground">{badge.name}</div>
                            <div>
                                <span
                                    className={`inline-block rounded-pill px-2.5 py-1 text-[12.5px] font-bold ${tierStyle.bg} ${tierStyle.fg}`}
                                >
                                    {tierStyle.label}
                                </span>
                            </div>
                            <div className="text-[13.5px] text-foreground">{badge.threshold} missions completed</div>
                            <div className="flex justify-end gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setEditingBadge(badge)}
                                    aria-label="Edit badge"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-light-blue text-[#2563eb] hover:bg-[#2563eb]/20"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPendingDelete(badge)}
                                    aria-label="Delete badge"
                                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-light-pink text-destructive hover:bg-destructive/20"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            <BadgeFormDialog open={dialogOpen} onOpenChange={handleDialogOpenChange} badge={editingBadge ?? undefined} />

            <ConfirmDialog
                open={Boolean(pendingDelete)}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title="Delete badge"
                description={`Are you sure you want to delete "${pendingDelete?.name}"? This can't be undone.`}
                onConfirm={handleDelete}
                isPending={deleteBadge.isPending}
            />
        </div>
    );
}
