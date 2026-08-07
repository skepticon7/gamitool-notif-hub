'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/use-socket-event';
import { BellIcon } from '@/components/shared/app-shell/nav-icons';
import { formatRelativeTime } from '@/features/activity-feed';
import { useNotificationsQuery } from '../queries/use-notifications-query';
import { useUnreadCountQuery } from '../queries/use-unread-count-query';
import { useMarkNotificationReadMutation } from '../mutations/use-mark-notification-read-mutation';
import { useMarkAllReadMutation } from '../mutations/use-mark-all-read-mutation';
import { useLiveUnreadCount } from '../hooks/use-live-unread-count';
import type { AppNotification } from '../types';

export function NotificationBell() {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const unreadCount = useUnreadCountQuery();
    const { count } = useLiveUnreadCount({
        baseCount: unreadCount.data ?? null,
        isReady: unreadCount.isSuccess,
    });

    const notifications = useNotificationsQuery({ enabled: open });
    const [liveNotifications, setLiveNotifications] = useState<AppNotification[]>([]);
    const markRead = useMarkNotificationReadMutation();
    const markAllRead = useMarkAllReadMutation();

    // A reminder is meant to be more prominent than the badge alone (see
    // CLAUDE.md's WebSocket section) — the toast fires regardless of
    // whether the dropdown has ever been opened. The list merge is gated on
    // notifications.isSuccess (REST-first-then-live, same rule as every
    // other live-updating panel) — safe to drop pre-open pushes here since
    // the eventual first-open fetch reflects true DB state anyway.
    const handleNew = useCallback(
        (payload: AppNotification) => {
            if (payload.kind === 'reminder') {
                toast.warning(payload.message, { duration: 8000 });
            }
            if (!notifications.isSuccess) return;
            setLiveNotifications((prev) => [payload, ...prev]);
        },
        [notifications.isSuccess],
    );
    useSocketEvent<AppNotification>('notification:new', handleNew);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const restItems = notifications.data ?? [];
    const restIds = new Set(restItems.map((n) => n.id));
    const items = [...liveNotifications.filter((n) => !restIds.has(n.id)), ...restItems];

    const handleMarkRead = (id: string) => {
        markRead.mutate(id, {
            onSuccess: () => setLiveNotifications((prev) => prev.filter((n) => n.id !== id)),
        });
    };

    const handleMarkAllRead = () => {
        markAllRead.mutate(undefined, {
            onSuccess: () => setLiveNotifications([]),
        });
    };

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label="Notifications"
                className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-input border border-border bg-white text-foreground"
            >
                <BellIcon className="h-5 w-5" />
                {count != null && count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-destructive px-1 text-[11px] font-extrabold text-white">
                        {count > 9 ? '9+' : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="animate-in fade-in slide-in-from-top-2 absolute top-[52px] right-0 z-50 w-[380px] overflow-hidden rounded-xl border border-border bg-white shadow-[0_16px_44px_-12px_rgba(0,53,128,.28)] duration-200 ease-out">
                    <div className="flex items-center justify-between border-b border-border px-[18px] py-4">
                        <span className="text-[15px] font-bold">Notifications</span>
                        {items.length > 0 && (
                            <button
                                type="button"
                                onClick={handleMarkAllRead}
                                disabled={markAllRead.isPending}
                                className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-primary"
                            >
                                Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[380px] overflow-y-auto">
                        {notifications.isLoading && (
                            <div className="p-8 text-center text-sm text-gray">Loading…</div>
                        )}
                        {notifications.isError && (
                            <div className="p-8 text-center text-sm text-destructive">
                                Couldn&apos;t load notifications.
                            </div>
                        )}
                        {!notifications.isLoading && !notifications.isError && items.length === 0 && (
                            <div className="p-[34px] text-center text-[13px] text-gray">You&apos;re all caught up.</div>
                        )}

                        {items.map((notification) => {
                            const isReminder = notification.kind === 'reminder';
                            return (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => handleMarkRead(notification.id)}
                                    className="flex w-full cursor-pointer items-start gap-3 border-b border-[#f1f4fa] px-[18px] py-3.5 text-left last:border-b-0"
                                    style={{
                                        background: isReminder ? '#fff8f4' : '#f8fbff',
                                        borderLeft: isReminder ? '3px solid var(--orange)' : '3px solid transparent',
                                    }}
                                >
                                    <div
                                        className={`flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px] ${
                                            isReminder ? 'bg-[#fff2e6] text-orange' : 'bg-light-gray text-gray'
                                        }`}
                                    >
                                        {isReminder ? <AlertTriangle size={14} /> : <Info size={14} />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {isReminder && (
                                            <span className="mb-1 inline-block rounded-[5px] bg-orange px-1.5 py-0.5 text-[9.5px] font-extrabold tracking-[.05em] text-white">
                                                REMINDER
                                            </span>
                                        )}
                                        <div className="text-[13px] leading-snug text-foreground">
                                            {notification.message}
                                        </div>
                                        <div className="mt-1 text-[11px] text-[#aab3c6]">
                                            {formatRelativeTime(notification.createdAt)}
                                        </div>
                                    </div>
                                    <span className="mt-1.5 h-[9px] w-[9px] flex-shrink-0 rounded-full bg-primary" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
