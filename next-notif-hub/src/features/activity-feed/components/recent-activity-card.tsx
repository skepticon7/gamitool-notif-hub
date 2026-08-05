'use client';

import { useCallback, useState } from 'react';
import { Award, CheckCircle2, ClipboardList, Clock, Info, TrendingUp } from 'lucide-react';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { useMyActivityFeedQuery } from '../queries/use-my-activity-feed-query';
import { formatRelativeTime } from '../utils/format-relative-time';
import type { ActivityFeedEntry } from '../types';

const EVENT_STYLES: Record<string, { Icon: typeof Info; fg: string; bg: string }> = {
    MissionAssigned: { Icon: ClipboardList, fg: 'var(--primary)', bg: 'var(--light-blue)' },
    MissionCompleted: { Icon: CheckCircle2, fg: 'var(--success)', bg: 'var(--light-green)' },
    MissionExpired: { Icon: Clock, fg: 'var(--destructive)', bg: 'var(--light-pink)' },
    LevelUp: { Icon: TrendingUp, fg: 'var(--info)', bg: 'var(--light-purple)' },
    BadgeUnlocked: { Icon: Award, fg: 'var(--warning)', bg: 'var(--light-yellow)' },
    ReminderDue: { Icon: Clock, fg: 'var(--orange)', bg: '#fff2e6' },
};
const DEFAULT_EVENT_STYLE = { Icon: Info, fg: 'var(--gray)', bg: 'var(--light-gray)' };

const MAX_ENTRIES = 5;

export function RecentActivityCard() {
    const activityFeed = useMyActivityFeedQuery();
    const [liveEntries, setLiveEntries] = useState<ActivityFeedEntry[]>([]);

    const handleActivity = useCallback((payload: ActivityFeedEntry) => {
        setLiveEntries((prev) => [payload, ...prev].slice(0, MAX_ENTRIES));
    }, []);
    useSocketEvent<ActivityFeedEntry>('activity:new', handleActivity);

    const restIds = new Set((activityFeed.data ?? []).map((entry) => entry._id));
    const entries = [...liveEntries.filter((entry) => !restIds.has(entry._id)), ...(activityFeed.data ?? [])].slice(
        0,
        MAX_ENTRIES,
    );

    return (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-border px-[22px] py-[18px]">
                <h2 className="text-base font-bold text-foreground">Recent activity</h2>
                <span className="flex items-center gap-1.5 text-[11px] text-gray">
                    <span className="h-[7px] w-[7px] rounded-full bg-green" />
                    Live
                </span>
            </div>

            <div className="py-2">
                {activityFeed.isLoading && (
                    <div className="p-8 text-center text-[13.5px] text-gray">Loading activity…</div>
                )}
                {activityFeed.isError && (
                    <div className="p-8 text-center text-[13.5px] text-destructive">Couldn&apos;t load activity.</div>
                )}
                {!activityFeed.isLoading && !activityFeed.isError && entries.length === 0 && (
                    <div className="p-8 text-center text-[13.5px] text-gray">Nothing here yet.</div>
                )}

                {entries.map((entry, index) => {
                    const style = EVENT_STYLES[entry.eventType] ?? DEFAULT_EVENT_STYLE;
                    const Icon = style.Icon;
                    const isLast = index === entries.length - 1;

                    return (
                        <div key={entry._id} className="flex gap-3 px-[22px] py-2.5">
                            <div className="flex flex-col items-center">
                                <div
                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[9px]"
                                    style={{ color: style.fg, background: style.bg }}
                                >
                                    <Icon size={14} />
                                </div>
                                {!isLast && <div className="mt-0.5 w-0.5 flex-1 bg-[#eef2f8]" />}
                            </div>
                            <div className="pb-1.5">
                                <div className="text-[13px] leading-snug text-foreground">{entry.message}</div>
                                <div className="mt-0.5 text-[11px] text-[#aab3c6]">
                                    {formatRelativeTime(entry.occurredOn)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
