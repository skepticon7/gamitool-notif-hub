'use client';

import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import ROUTES from '@/config/constants/routes';
import { useMyMissionAssignmentsQuery } from '@/features/missions';
import { useLiveActiveQuests } from '@/features/employees';
import {
    BadgesIcon,
    CatalogIcon,
    DashboardIcon,
    EngineActivityIcon,
    MissionsIcon,
    RulesIcon,
    SchedulmentsIcon,
    SignOutIcon,
} from './nav-icons';

const EMPLOYEE_NAV = [
    { href: ROUTES.EMPLOYEE.DASHBOARD, label: 'Dashboard', Icon: DashboardIcon },
    { href: ROUTES.EMPLOYEE.MISSIONS, label: 'Quests', Icon: MissionsIcon },
    { href: ROUTES.EMPLOYEE.BADGES, label: 'Badge case', Icon: BadgesIcon },
];

const ADMIN_NAV = [
    { href: ROUTES.ADMIN.DASHBOARD, label: 'Dashboard', Icon: DashboardIcon },
    { href: ROUTES.ADMIN.RULES, label: 'Rule graph', Icon: RulesIcon },
    { href: ROUTES.ADMIN.SCHEDULMENTS, label: 'Schedulments', Icon: SchedulmentsIcon },
    { href: ROUTES.ADMIN.CATALOG, label: 'Missions & Badges', Icon: CatalogIcon },
    { href: ROUTES.ADMIN.ENGINE_ACTIVITY, label: 'Engine activity', Icon: EngineActivityIcon },
];

const COLLAPSE_THRESHOLD = 150;
const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 238;
const MIN_WIDTH = 64;
const MAX_WIDTH = 300;

export function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const clearSession = useAuthStore((s) => s.clearSession);

    const [navWidth, setNavWidth] = useState(EXPANDED_WIDTH);
    const resizingRef = useRef(false);

    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => {
            if (!resizingRef.current) return;
            setNavWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX)));
        };
        const onMouseUp = () => {
            if (!resizingRef.current) return;
            resizingRef.current = false;
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            setNavWidth((w) => (w < COLLAPSE_THRESHOLD ? COLLAPSED_WIDTH : EXPANDED_WIDTH));
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, []);

    // Hooks must run unconditionally (before the `if (!user)` early return
    // below) — disabled via `enabled` for admins instead of skipping the
    // call, same pattern used everywhere else a query is role-gated.
    const activeQuests = useMyMissionAssignmentsQuery({
        status: 'ASSIGNED',
        enabled: user?.role === 'employee',
    });
    const { count: activeQuestsCount } = useLiveActiveQuests({
        baseCount: activeQuests.data?.length ?? null,
        isReady: activeQuests.isSuccess,
    });

    if (!user) {
        return null;
    }

    const collapsed = navWidth < COLLAPSE_THRESHOLD;
    const items = user.role === 'admin' ? ADMIN_NAV : EMPLOYEE_NAV;

    const startResize = (e: ReactMouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
    };

    const toggleNav = () => {
        setNavWidth((w) => (w < COLLAPSE_THRESHOLD ? EXPANDED_WIDTH : COLLAPSED_WIDTH));
    };

    const doSignOut = () => {
        clearSession();
        router.push(ROUTES.LOGIN);
    };

    return (
        <>
            <nav
                style={{ width: navWidth }}
                className="flex flex-shrink-0 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-border bg-white py-[18px] transition-[width] duration-150"
            >
                <div
                    className={`px-3 pb-2.5 text-[11px] font-extrabold tracking-[.09em] text-gray uppercase ${
                        collapsed ? 'text-center' : 'text-left'
                    }`}
                >
                    {collapsed ? '•••' : user.role === 'admin' ? 'Configuration' : 'My workspace'}
                </div>

                {items.map(({ href, label, Icon }) => {
                    const active = pathname === href;
                    const badgeCount = href === ROUTES.EMPLOYEE.MISSIONS ? activeQuestsCount : null;
                    return (
                        <Link
                            key={href}
                            href={href}
                            title={label}
                            className={`mx-1.5 flex items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                                collapsed ? 'justify-center' : 'justify-start'
                            } ${active ? 'bg-light-blue text-[#2563eb]' : 'text-foreground hover:bg-muted'}`}
                        >
                            <Icon className="h-5 w-5 flex-shrink-0" />
                            {!collapsed && <span className="flex-1 truncate">{label}</span>}
                            {!collapsed && badgeCount != null && badgeCount > 0 && (
                                <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
                                    {badgeCount}
                                </span>
                            )}
                        </Link>
                    );
                })}

                <div className="flex-1" />

                {!collapsed && (
                    <div
                        className="mx-1.5 mt-2 rounded-2xl border border-[#dfe8ff] p-3.5"
                        style={{ background: 'linear-gradient(160deg, #f2f6ff, #eaf1ff)' }}
                    >
                        <div className="mb-1 text-xs font-bold text-foreground">
                            {user.role === 'admin' ? 'Guardrails on' : 'Keep your streak alive'}
                        </div>
                        <div className="text-[11.5px] leading-snug text-gray">
                            {user.role === 'admin'
                                ? 'You can only wire pre-approved events and actions. Invalid combinations are blocked automatically.'
                                : 'Complete a mission today to keep earning XP.'}
                        </div>
                    </div>
                )}

                <button
                    type="button"
                    onClick={doSignOut}
                    title="Sign out"
                    className={`mx-1.5 mt-2.5 flex cursor-pointer items-center gap-2.5 rounded-[11px] border border-border bg-white px-3 py-2.5 text-[13.5px] font-semibold text-gray hover:bg-muted ${
                        collapsed ? 'justify-center' : 'justify-start'
                    }`}
                >
                    <SignOutIcon className="h-[18px] w-[18px] flex-shrink-0" />
                    {!collapsed && <span>Sign out</span>}
                </button>
            </nav>

            <div
                onMouseDown={startResize}
                onDoubleClick={toggleNav}
                title="Drag to resize · double-click to toggle"
                className="relative z-20 w-1.5 flex-shrink-0 cursor-col-resize bg-transparent hover:bg-primary/10"
            >
                <span className="absolute top-1/2 left-1/2 h-[34px] w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-border" />
            </div>
        </>
    );
}
