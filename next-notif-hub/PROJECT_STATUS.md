# Project status

Snapshot as of this session's end. See `docs/decisions.md` for the *why* behind the architectural choices referenced here, `CLAUDE.md` for the current API/data contract, and `docs/design/README.md` for the source design mockup.

## What was completed

**App shell & auth** (prior session, unchanged this session)
- Full login flow, in-memory access token + persisted refresh token, route protection, resizable sidebar, profile drawer, design tokens, shadcn primitives.

**Admin: Missions & Badges catalog** (`/admin/catalog`)
- Full CRUD for both missions and badges, unchanged from prior session except: the "New mission"/"New badge" button moved out of each table component and into the page itself, sharing one row with the tab selector — both tables now take `createOpen`/`onCreateOpenChange` props instead of owning their own trigger button, so the page controls dialog-open state while each table still owns its own edit flow.

**Employee: Dashboard** (`/employee/dashboard`)
- **Welcome banner** replacing the old plain-text header — gradient card with the employee's first name, an illustration (`public/illustrations/person.svg`) layered on top of (not clipped by) the card via a separate background layer, matching a design reference the user provided directly (not in `EDEN.dc.html`).
- **Stats grid** (`EmployeeStatsGrid`) replacing the old single XP hero card — five independent stat cards (Total XP, Level, Badges earned, Missions completed, Active quests), each owning its own REST baseline query *and* its own live-update socket subscription via a dedicated hook (`useLiveXp`, `useLiveLevel`, `useLiveBadgesEarned`, `useLiveMissionsCompleted`, `useLiveActiveQuests`). No single card's number is ever gated on another card's event.
- Active Missions panel and Recent Activity panel unchanged in shape, but Active Missions now consumes the richer `AssignmentDto` shape directly (no more mapping REST rows down to a narrower type).

**Employee: Quests** (`/employee/missions`, `MissionsList`) — built from scratch this session
- Full table (not a scrollable card list) — Quest / Assigned / Completed / Deadline / XP / Action columns, fixed-width grid matching the admin catalog tables' visual language.
- Status filter tabs (Assigned/Completed/Expired, no "All"), sortable column headers (asc/desc toggle with arrow indicators) on Quest/Assigned/Completed/Deadline/XP, client-side pagination (7/page — this endpoint has no server-side page/limit params), a "Reset" button scoped to sort+page only (never touches the active tab).
- Live-updated via `mission:assigned`/`mission:completed`/`mission:expired`, merged against the REST-loaded list with id-based dedup.
- Empty state gets a `Frown` icon (applied here and on the Badge Case's empty catalog state — deliberately *not* applied to the Active Missions panel's "No active missions. Nice work." message, which is a positive framing, not a sad one).

**Employee: Badge Case** (`/employee/badges`, `BadgeCase`) — built from scratch this session
- Full catalog grid (locked + unlocked badges, matching `EDEN.dc.html`'s design almost exactly) plus a progress bar to the next locked badge, using the exact math the design reference itself uses.
- Required a new backend endpoint (`GET /badges/catalog`) — the badge case's core feature (showing locked badges with progress) was impossible against the previously-existing `GET /badges/my-badges` (unlocked only). "Unlocked" is computed client-side from `missionsCompleted` vs. each badge's `threshold`; no unlock computation happens server-side.

**Reward feedback (dashboard-wide)** — built from scratch this session
- `LevelUpDialog` and `BadgeGrantedDialog` — celebratory modals matching `EDEN.dc.html`'s "LEVEL-UP OVERLAY"/"BADGE-UNLOCK OVERLAY" markup (confetti, pulsing/orbiting level ring, tier-colored hero band on the badge card).
- Both enqueue into one shared zustand store (`reward-queue-store.ts`) instead of owning independent `open` state, so a mission completion that cascades through both `level:up` and `badge:granted` in one rule-graph chain shows them one at a time instead of two dialogs racing to open simultaneously. The queue is intentionally order-agnostic — badge unlock and level-up are causally independent (see `CLAUDE.md`'s WebSocket section), so no ordering is assumed or required between them.

**Notification bell** (`NotificationBell`) — built from scratch this session, closing a documented-but-unwired feature
- Full implementation matching `EDEN.dc.html`'s bell/dropdown markup: eager unread-count badge (capped display at `9+`), lazy-loaded dropdown list (only fetched once first opened), mark-one-read (click a row) and mark-all-read, `kind: 'reminder'` items get distinct orange styling plus a `toast.warning` regardless of dropdown state, slide-down entrance animation, click-outside-to-close.
- Sidebar also gained a live count badge next to "Quests", reusing `useLiveActiveQuests` — the same hook the dashboard's Active Quests card uses, not a separate implementation.

**Real-time infrastructure hardening**
- Fixed a real WebSocket bug: `SocketProvider`'s cleanup effect disconnected the socket on every React Strict Mode dev-mode double-invoke (mount → cleanup → mount), and since Socket.IO never auto-reconnects after a *manual* `.disconnect()`, the socket was permanently dead for the component's whole lifetime in dev. Fixed by calling `.connect()` at the top of the effect too.
- Fixed a cross-user data leak: the `QueryClient` was created via `useState` inside `QueryProvider` (never cleared), and user-scoped query keys weren't parameterized by user id — so logging out and back in as a different user on the same tab could show the previous user's cached data. Fixed by lifting the `QueryClient` to a module-level singleton (`src/lib/query-client.ts`) reachable from `auth-store.ts`, and calling `queryClient.clear()` in `clearSession()`.
- Introduced the "global cache-sync component" pattern: `MissionAssignmentCacheSync` and `EmployeeProfileCacheSync`, always mounted in `AppShell`, whose only job is invalidating specific React Query cache keys on specific socket events — needed because a page's own live-update hooks only help while that page is mounted; a page that was elsewhere when an event fired and later remounts needs the cache itself marked stale, not just a local delta.
- Fixed a real-time double-counting bug: once `MissionAssignmentCacheSync` started invalidating the same query key `ActiveQuestsStatCard` uses as its baseline, a single `mission:assigned` event could apply *both* a local `+1` delta *and* get counted again when the invalidated query refetched. Fixed with a render-time reconciliation pattern (track the previous baseline value, reset the delta to 0 the moment a fresh baseline arrives) — applied to `useLiveActiveQuests` and `useLiveMissionsCompleted`. `useLiveXp`/`useLiveLevel` aren't susceptible (they override the baseline rather than adding to it).
- Fixed a stale-list bug in `MissionsList`: a live-pushed `mission:assigned` row keeps a frozen `status: 'ASSIGNED'` snapshot forever; if that same assignment later completes, nothing updated it, so it could keep passing the tab's status filter even after the REST data correctly dropped it. Fixed by pruning the id from local state on `mission:completed`/`mission:expired`, and immediately on the user's own Complete click.
- Fixed a `Math.ceil`-on-exact-24h-duration bug in `formatDeadline`: a duration:1 mission's deadline sits exactly 24h after `assignedAt`, so computing days-remaining from raw millisecond difference put the calculation right on a boundary sensitive to clock skew between server-generated timestamps and the client's `Date.now()` — a live-pushed row could show "Due in 2 days" while the identical deadline showed "Due today" after a refresh. Fixed by comparing calendar days (local midnight to local midnight) instead of exact duration.
- Fixed a production build failure: `src/hooks/use-socket-event.ts` and six `use-live-*.ts` hook files used raw React state/effect hooks without a `'use client'` directive — this only worked by accident because every prior import path into them happened to pass through a file that already had the directive. The new cache-sync components broke that accident by being imported from Server-Component `app-shell.tsx` via barrel files with no boundary marker of their own.
- Added a page-transition animation (`PageTransition`, keyed on `pathname`) so route changes fade/drop the new content in instead of swapping it in statically.

**Backend changes made this session** (in the sibling `nest-notif-hub`, applied directly by the user in parallel with this session — not written by this session's backend-prompt-doc workflow the way earlier endpoints were)
- Shared `AssignmentDto` — now the single response shape for `GET /missions/my-assignments`, `GET /missions/assignments/latest`, and the `mission:assigned`/`mission:completed`/`mission:expired` socket pushes. Includes the previously-missing mission relation embed and the new `xpStatus` flag.
- `mission:completed`, `mission:expired` — new socket events, mirroring `mission:assigned`'s existing pattern.
- `xp:granted`, `level:up`, `badge:granted` — new socket events feeding the reward-dialog/stats-grid real-time system.
- `GET /badges/catalog` — new, employee-readable full badge catalog (no unlock computation server-side).

## Current objective

No single "next" objective locked in before this session ended. The employee-facing experience (dashboard, quests, badge case, notifications) is now essentially feature-complete against the current API contract. The natural next area is the **admin-facing pages**, all four of which are still placeholder `<h1>`s: Rule graph (drag-to-wire canvas), Schedulments, Engine Activity (live feed), Admin Dashboard (delivery stats).

## Remaining work

- **Admin pages** — Rule graph, Schedulments, Engine Activity, Admin Dashboard. `docs/structure-reference.md` has the intended component/file layout conventions to follow.
- **Global 401/token-expiry handling** — discussed this session, not implemented. Confirmed there's no interceptor and no proactive `exp`-claim check; an expired access token mid-session just surfaces as a generic per-request error, not a forced re-login. Needs a decision: retry-once-via-refresh, or force logout.
- **`activity:new`'s `id`/`_id` mismatch** — confirmed root cause (`activity-feed.consumer.ts` emits a literal `id` key instead of `_id`), one-line backend fix, not yet applied. Causes the recurring "missing key" React warnings on `RecentActivityCard`.
- **XP progress-bar accuracy** — unchanged gap. Still approximates the default `CheckLevelThreshold` curve (`xpPerLevel: 100`, `growthRate: 1.5`); no endpoint exposes an org's actual configured values.
- **No employee-readable full mission catalog** — unchanged gap, distinct from the now-closed badge catalog gap. Blocks any "browse all missions" screen (as opposed to "my assignments", which is fully built).

## Files modified

This session touched dozens of files across the frontend; for the exhaustive list, `git diff`/`git log` are authoritative. Summary by area:

- `src/features/employees/` — five new stat card components + their `use-live-*` hooks, `dashboard-welcome-banner.tsx`, `level-up-dialog.tsx`, `employee-profile-cache-sync.tsx`, `employee-stats-grid.tsx` rewritten.
- `src/features/missions/` — `missions-list.tsx` (new, the Quests page), `mission-assignment-cache-sync.tsx` (new), `active-missions-card.tsx` (simplified to consume `AssignmentDto` directly), `utils/format-deadline.ts` (extracted + calendar-day fix), `types/index.ts` (`AssignmentSummary`/`MissionAssignment` shapes updated, `ActiveMissionSummary` type deleted as redundant).
- `src/features/badges/` — `badge-case.tsx` (new, the Badge Case page), `badge-granted-dialog.tsx` (new), `use-badge-catalog-query.ts` (new).
- `src/features/notifications/` — new feature end to end (types, constants, queries, mutations, one live hook, `notification-bell.tsx`).
- `src/features/activity-feed/` — exported `formatRelativeTime` from the barrel for reuse by the notification bell.
- `src/store/reward-queue-store.ts` (new), `src/lib/query-client.ts` (new singleton, replacing the `useState`-based instance in `query-provider.tsx`).
- `src/components/shared/app-shell/` — `page-transition.tsx` (new), `app-shell.tsx` (mounts the new cache-sync components + page transition), `sidebar.tsx` (live Quests badge), `top-bar.tsx` (real `NotificationBell` replacing the placeholder button), `profile-drawer.tsx` (now uses the same live hooks as the dashboard cards), `employee-reward-overlays.tsx` (mounts the two reward dialogs).
- `src/hooks/use-socket-event.ts`, and every `use-live-*.ts` hook — added missing `'use client'` directives (build fix).
- `src/app/(protected)/admin/catalog/page.tsx`, `src/app/(protected)/employee/{dashboard,missions,badges}/page.tsx` — wired to the above.
- `src/config/constants/endpoints.ts` — added `BADGES.CATALOG`, `NOTIFICATIONS.*`.
- Backend (`nest-notif-hub`) — `AssignmentDto`, `mission:completed`/`mission:expired` emits, `xp:granted`/`level:up`/`badge:granted` emits, `GET /badges/catalog` — all applied directly by the user in parallel with this session.

## Known issues

- **`activity:new`'s socket payload key mismatch** (`id` vs `_id`) — see Remaining Work.
- **No global access-token-expiry handling** — see Remaining Work.
- **`docs/mission-assignment-relation-backend-prompt.md` is now stale** — the problem it describes was solved via the shared `AssignmentDto`, not the fix that doc originally proposed. Left in place for historical context but shouldn't be followed literally by a future session.
- **`npm audit` flagged pre-existing high-severity issues** in `next`/`postcss`/`sharp`/`brace-expansion` (unrelated to anything added this or last session) — not addressed, since fixing means jumping Next.js versions, a call left to the user.
