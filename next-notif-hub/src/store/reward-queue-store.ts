import { create } from 'zustand';
import type { Badge } from '@/features/badges';

export type RewardQueueItem = { type: 'level-up'; level: number } | { type: 'badge-granted'; badge: Badge };

interface RewardQueueState {
    current: RewardQueueItem | null;
    queue: RewardQueueItem[];
    enqueueReward: (item: RewardQueueItem) => void;
    dismissCurrent: () => void;
}

// A single shared slot both LevelUpDialog and BadgeGrantedDialog enqueue
// into, so a mission completion that cascades through GrantXP -> LevelUp ->
// GrantBadge in one go shows its rewards one at a time instead of two
// dialogs fighting to open simultaneously.
export const useRewardQueueStore = create<RewardQueueState>((set, get) => ({
    current: null,
    queue: [],
    enqueueReward: (item) => {
        const { current, queue } = get();
        if (!current) {
            set({ current: item });
        } else {
            set({ queue: [...queue, item] });
        }
    },
    dismissCurrent: () => {
        const [next, ...rest] = get().queue;
        set({ current: next ?? null, queue: rest });
    },
}));
