# Project status

Snapshot as of this session's end. See `docs/decisions.md` for the *why* behind the architectural choices referenced here, `CLAUDE.md` for the current API/data contract, and `docs/design/README.md` for the source design mockup (persisted into the repo this session specifically so a fresh session isn't dependent on re-fetching it from `claude.ai/design`).

## What was completed

**App shell & auth**
- Full login flow: email/password form (react-hook-form + zod) plus a "Sign in with Microsoft" OIDC redirect button, at `/` (root route doubles as the login screen — no separate `/login`).
- In-memory access token + `localStorage`-persisted refresh token, redeemed via `POST /auth/refresh` on every load (`AuthProvider`'s `hydrate()`), gated behind a loading spinner so a logged-in user never flashes the login screen on reload.
- Route protection (`AuthGuard`) and role-based routing (`ROUTES.EMPLOYEE.*` / `ROUTES.ADMIN.*`, `homeRouteFor(role)`).
- Full app shell: top bar (logo, live-connection indicator, avatar), resizable/collapsible sidebar with role-specific nav, a profile drawer (matches the source design's gradient header + XP progress bar + key/value rows + sign-out).
- Design tokens ported from the GamiTool design system into `src/styles/tokens/*.css`, wired into Tailwind v4 via `globals.css`.
- shadcn/ui primitives installed as needed: button, input, label, form, sonner (toast), dialog, select, textarea, drawer.

**Admin: Missions & Badges catalog** (`/admin/catalog`)
- Full CRUD for both missions and badges — list tables, create/edit dialogs, delete-confirm dialog, all wired to `@tanstack/react-query` against the real `/admin/missions`/`/admin/badges` endpoints.

**Employee: Dashboard** (`/employee/dashboard`)
- XP hero card (Level, XP progress bar — approximated leveling curve, see `CLAUDE.md`'s `CheckLevelThreshold` note — Total XP, Missions done, Badges earned).
- Active Missions panel: initial load via `GET /missions/assignments/latest`, live-updated via the `mission:assigned` socket event, REST-first merge ordering (see `docs/decisions.md`), a working Complete-mission action.
- Recent Activity panel: initial load via `GET /activity-feed`, live-updated via `activity:new`, trimmed to 5 client-side.
- Real-time infrastructure built from scratch this session: `SocketProvider` (single shared Socket.IO connection) + `useSocketEvent` hook, now used by all three dashboard widgets.

**Backend changes made this session** (in `nest-notif-hub`, via prompts written for a separate backend session — see `docs/*-backend-prompt.md`)
- `POST /auth/refresh` — implemented, confirmed working, end-to-end tested (including the `INVALID_REFRESH_TOKEN` failure path) against the live backend.
- `GET /employees/me` — implemented, returns `{ xp, level, missionsCompleted, badgesEarned, totalBadges }`.
- `GET /missions/assignments/latest` — implemented (initial version had bugs — ascending order instead of descending, no status filter, no relation eager-load — all three were flagged and fixes provided; final applied state not independently re-verified, see Known issues).
- `mission:assigned` WebSocket event — implemented on the backend, consumed on the frontend.

## Current objective

Employee Dashboard was the most recently completed page. No single "next" objective was locked in before this session ended — natural next candidates, in rough order of what's already partially scaffolded:
- Employee Missions page (`/employee/missions` — currently a placeholder)
- Employee Badges page (`/employee/badges` — currently a placeholder; blocked on the "no full badge catalog" gap, see below)
- Notification bell (top-bar bell is a non-functional placeholder; `notification:new` socket event and `GET /notifications*` endpoints are documented but unused)
- Admin Rule graph, Schedulments, Engine Activity, Dashboard (all still placeholder pages)

## Remaining work

- **Employee Missions page** — needs the full `/missions/my-assignments` list (not just "latest 5"), filterable by status. Blocked on confirming the mission-relation embedding actually landed on that endpoint (see Known issues).
- **Employee Badges page** — blocked on a real gap: no endpoint returns the full badge catalog (locked + unlocked) to an employee, only `GET /badges/my-badges` (unlocked only). Needs a backend decision before this page can show locked badges with progress, matching the source design.
- **Notification bell** — REST (`GET /notifications`, `/notifications/unread-count`, mark-read endpoints) and the `notification:new` socket event are both documented and confirmed to exist, just never wired into the frontend.
- **Admin pages** — Rule graph (drag-to-wire canvas), Schedulments, Engine Activity (live feed), Admin Dashboard (delivery stats) are all still placeholder `<h1>`s. `docs/structure-reference.md` has the intended component/file layout conventions to follow.
- **XP progress-bar accuracy** — currently approximates the default `CheckLevelThreshold` curve (`xpPerLevel: 100`, `growthRate: 1.5`). Will be wrong for any org that configured custom values, since no endpoint exposes the actual configured params.

## Files modified

This session touched the large majority of `next-notif-hub/src/` (the app was built from an empty `create-next-app` scaffold) plus several files in the sibling `nest-notif-hub` backend repo, applied via a separate backend session using the prompts in `docs/*-backend-prompt.md`. For the exhaustive list, `git status`/`git diff` are authoritative — summary by area:

- `src/app/` — root layout, root page (login), all route pages under `(protected)/`.
- `src/components/` — `providers/` (auth, query, socket), `shared/app-shell/` (top bar, sidebar, profile drawer, nav icons), `shared/` (auth guard, confirm dialog), `ui/` (shadcn primitives).
- `src/features/` — `auth`, `missions` (admin + employee), `badges` (admin + employee), `employees`, `activity-feed`.
- `src/hooks/` — `use-api-query.ts`, `use-api-mutation.ts`, `use-socket-event.ts`.
- `src/lib/` — `api-fetch.ts`, `api-error.ts`, `jwt.ts`, `socket.ts`, `utils.ts`.
- `src/store/auth-store.ts`, `src/config/constants/` (`endpoints.ts`, `routes.ts`), `src/types/auth.ts`.
- `src/styles/tokens/*.css`, `src/app/globals.css`.
- `nest-notif-hub` — auth module (refresh endpoint), users module (new `EmployeesController`/`GET /employees/me`), missions module (`GetLatestMissionAssignmentsHandler`/`GET /missions/assignments/latest`), plus the `mission:assigned` socket push in whichever consumer handles `MissionAssigned` — applied by the user directly in a separate backend session, not by this one.

## Known issues

- **`GET /missions/my-assignments`'s mission-relation embedding is unconfirmed.** A backend prompt was written (`docs/mission-assignment-relation-backend-prompt.md`) but the conversation pivoted to building the separate `/missions/assignments/latest` endpoint instead — unclear whether the original `my-assignments` fix was ever applied. Confirm against a real response before building the Employee Missions page against it.
- **`GET /missions/assignments/latest`'s final shape is unconfirmed.** Three issues were found in the first version of `GetLatestMissionAssignmentsHandler` (ascending instead of descending order, no `status: 'ASSIGNED'` filter, no `relations: { mission: true }`) and fixes were provided, but the corrected handler code was never shown back for verification — the frontend (`useLatestMissionAssignmentsQuery`) assumes the fixed shape.
- **Activity feed's real primary key is `_id`, not `id`** (confirmed against the actual Mongo schema) — CLAUDE.md previously documented `id`, now corrected, but worth double-checking against a live response if anything built against this looks broken.
- **No employee-readable full mission or badge catalog** — see Remaining Work above. Both are real backend gaps, not frontend bugs.
- **`npm audit` flagged pre-existing high-severity issues** in `next`/`postcss`/`sharp`/`brace-expansion` (unrelated to anything added this session) — not addressed, since fixing means jumping Next.js versions, a call left to the user.
