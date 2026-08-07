@AGENTS.md

# CLAUDE.md

Frontend for **EDEN** — a NestJS event-driven gamification/notification engine (internship POC modeled on Gamitool). This file is the API/data contract the frontend builds against. The backend itself lives in the sibling repo `../nest-notif-hub` (its own `CLAUDE.md` covers backend architecture/internals — not needed for frontend work, everything relevant to consuming the API is summarized here).

Backend dev server: `http://localhost:8080` (adjust if it's running elsewhere).

UI is being built against a Claude Design mockup — the full source is checked into `docs/design/EDEN.dc.html` (see `docs/design/README.md`) so it doesn't depend on re-fetching from `claude.ai/design`. Consult it for layout/spacing/copy before building any screen that isn't already implemented.

## Auth

JWT-based, `Authorization: Bearer <token>` header on every request. No cookies/sessions for the API itself (a short-lived session exists only during the OIDC handshake, irrelevant to normal API calls).

JWT payload shape (`AppJwtPayload`):
```ts
{ sub: string; userId: string; email: string; name: string; groups: string[] }
```
`groups` is `['admin']` or `['employee']` — this is what the UI should branch its whole experience on (two almost entirely separate UIs, see the design brief). `userId` is the caller's own id — for employee-facing endpoints, the backend derives "your own data" from this claim, never from a URL param, so there's no `/employees/:id/...` shape to worry about — it's always "my" data via the token.

Real login goes through Authentik OIDC (`GET /auth/oidc/login` → redirect flow → `GET /auth/oidc/callback`). There's also `POST /auth/login` (password-based, same underlying flow). Either way, the response is `{ accessToken, refreshToken, tokenType }` — store `accessToken` and send it as the bearer token.

**Token storage (decided):** access token in memory only (never persisted); refresh token persisted to `localStorage` and redeemed on load via `POST /auth/refresh` (confirmed live, end-to-end tested against the running backend — see `docs/decisions.md`). Body: `{ refreshToken }`. Response: same `{ accessToken, refreshToken, tokenType }` shape as login (the refresh token itself may rotate — always persist whatever comes back, not the one you sent). An expired/invalid refresh token returns `401` with `errorCode: 'INVALID_REFRESH_TOKEN'` — treat that as "log in again," distinct from a generic failure.

## Employee-facing REST endpoints

All require `Authorization: Bearer <employee token>`.

- `GET /missions/my-assignments?status=&assignedFrom=&assignedTo=&completedFrom=&completedTo=` — the caller's own mission assignments, general-purpose/filterable. **Confirmed** (previously an unconfirmed gap): rows now embed the mission relation via the shared `AssignmentDto` (see below) — `{ id, missionId, employeeId, status: 'ASSIGNED'|'COMPLETED'|'EXPIRED', assignedAt, completedAt, deadline, mission: { name, xpGranted, durationDays }, xpStatus }`. `deadline` is `null` for missions with no duration — never show a countdown/deadline UI for those. Backs the employee Quests page (`/employee/missions`, `MissionsList`) — filterable by status, client-side sorted/paginated (no server-side pagination on this endpoint).
- `GET /missions/assignments/latest` — the caller's 5 most-recent `ASSIGNED` assignments, purpose-built for the dashboard's "Active missions" panel. **Confirmed**, same `AssignmentDto` shape as above, ordered `assignedAt DESC`, capped at 5, pre-filtered to `status: 'ASSIGNED'` server-side.
- `POST /missions/assignments/:assignmentId/complete` — complete one of your own assignments. No body.
- `GET /badges/catalog` — **new this session, closes a real gap.** Every badge in the catalog regardless of unlock status — same shape as `GET /admin/badges` (`{ id, name, description, threshold, tier, createdAt, updatedAt }[]`), just employee-readable. Does **not** compute or return unlock status — the frontend derives `unlocked = missionsCompleted >= badge.threshold` itself using `GET /employees/me`. Backs the Badge Case page (`/employee/badges`), including the "N more missions → next badge" progress bar.
- `GET /badges/my-badges` — the caller's own **already-unlocked** badges only, full `Badge` objects. Superseded by `/badges/catalog` + `/employees/me` for the Badge Case screen (which needs locked badges too), but still used elsewhere (e.g. invalidated on `badge:granted` in case anything still reads it).
- `GET /notifications` — every **unread** in-app notification for the caller. Unbounded (no `limit`/pagination) — marking read is what shrinks the list. Items: `{ id, message, kind: 'general'|'reminder', read, createdAt }`. Fully wired in the frontend now (`NotificationBell`) — fetched lazily (only once the bell dropdown is first opened), since it's unbounded and most sessions never open it.
- `GET /notifications/unread-count` — **confirmed: returns a bare `number`, not `{ count }`.** (`GetUnreadNotificationCountQueryHandler` is a plain `repository.count(...)` with no response envelope.) Fetched eagerly on page load for the bell badge, before the socket connects.
- `POST /notifications/:id/read` — mark one read. Triggered by clicking a notification row in the dropdown.
- `POST /notifications/read-all` — mark all read (this is what actually shrinks the unread list — no pagination model here). Triggered by the dropdown's "Mark all as read" button.
- `GET /activity-feed` — capped at 5 most-recent items server-side (`.limit(5)`, not a client concern). Items: `{ _id, eventType, message, occurredOn }` — **note the `_id`, not `id`**. **Known live bug, unfixed**: the `activity:new` *socket* push (see below) constructs its payload with a literal `id: eventId` key instead of `_id` — confirmed at `activity-feed.consumer.ts`'s emit call. This means every live-pushed activity entry has `entry._id === undefined` in `RecentActivityCard`, breaking both its React `key` and its dedup-against-REST logic (`restIds.has(entry._id)`) — visible as recurring "Each child in a list should have a unique key prop... RecentActivityCard" console warnings. One-line backend fix: `id: eventId` → `_id: eventId` in that emit.
- `GET /employees/me` — `{ xp: number | null, level: number | null, missionsCompleted: number, badgesEarned: number, totalBadges: number }`. `xp`/`level` are `null`-able because those columns only mean something for employee rows (same DB table as admins, STI). `missionsCompleted` = count of the caller's `COMPLETED` assignments; `badgesEarned`/`totalBadges` = unlocked count vs. full catalog size. No endpoint returns *how much XP is needed for the next level* — see the leveling-curve note below.

### The shared `AssignmentDto`

`GET /missions/my-assignments`, `GET /missions/assignments/latest`, and all three mission socket events (`mission:assigned`/`mission:completed`/`mission:expired`) now return/emit the **exact same shape** — one `AssignmentDto` class on the backend, not per-endpoint DTOs:

```ts
{
  id: string;
  missionId: string;
  employeeId: string;
  status: 'ASSIGNED' | 'COMPLETED' | 'EXPIRED';
  assignedAt: string;   // ISO datetime
  completedAt: string | null;
  deadline: string | null;
  mission: { name: string; xpGranted: number; durationDays: number | null };
  xpStatus: boolean;
}
```

`xpStatus` is **not** per-mission or per-assignment — it's a single global flag answering "does the rule graph currently wire `MissionCompleted → GrantXP` at all," computed once per request/emit and stamped onto every row identically. A mission's completion never guarantees `xpGranted` will actually be awarded (that mapping is entirely admin-configurable via the rule graph), so the frontend gates the "+XP" line on this flag rather than assuming it — see `MissionsList`/`ActiveMissionsCard`.

## Admin-facing REST endpoints

All require `Authorization: Bearer <admin token>`. Admin is HR, not a developer — every screen built against these should read as "configure within guardrails," not "write logic." See the design brief for the full framing.

**Accounts** (`/admin/accounts`) — closed provisioning: this is the *only* way an account gets created (aside from a one-time manual DB seed for the very first admin — not something the frontend needs to handle).
- `POST /admin/accounts` — `{ email, name, role: 'admin'|'employee' }` → creates the account via a real Authentik provisioning call, returns `{ id, email, name, role, temporaryPassword }`. The admin relays `temporaryPassword` to the employee out of band — no invite email flow exists.
- `GET /admin/accounts/employees?level=&order=` — list employees.

**Missions** (`/admin/missions`) — `GET` (list), `POST { name, xpGranted, durationDays? }`, `PATCH /:id`, `DELETE /:id`. `durationDays` omitted/null → mission never expires, never gets reminders.

**Badges** (`/admin/badges`) — `GET`, `POST { name, threshold, tier: 'bronze'|'silver'|'gold'|'diamond', description? }`, `PATCH /:id`, `DELETE /:id`. `threshold` = completed-mission count required to earn it. `tier` is purely a display/grouping field (bronze/silver/gold/diamond, matching the design system's tier colors) — the backend never uses it for logic, just returns it.

**Mission assignment** — same mission endpoints employees hit, but admin-scoped:
- `POST /missions/assign` — `{ missionId, employeeId }` → assigns on behalf of any employee.
- `POST /missions/assign-all` — `{ missionId, employeeIds?: string[] }` → bulk assign; omit `employeeIds` for "everyone." Already-assigned employees are silently skipped, not an error.

**Recurring assignment / "Schedulments"** (`/admin/schedulments`) — `GET`, `POST`, `PATCH /:id`, `POST /:id/cancel`. Body shape: `{ missionId, recurrenceInterval: 'daily'|'weekly'|'monthly', scope: 'all'|'specific', employeeIds?: string[] }` (`employeeIds` required + non-empty when `scope: 'specific'`). Recurrence anchors are fixed calendar points, not rolling offsets from creation time — daily resets at midnight, weekly on Monday, monthly on the 1st.

**Event wiring / the rule graph** (`/admin/event-links`) — this is the actual "rule engine" admin surface, see the vocabulary section below before building this screen.
- `GET` — list all wirings: `{ id, sourceEvent, action, params, targetEvent }`.
- `POST { sourceEvent, action, params, targetEvent? }` — create. Validated server-side (see vocabulary section) — a rejection returns `400` with a specific `errorCode` (`UNKNOWN_SOURCE_EVENT`, `UNKNOWN_ACTION`, `INCOMPATIBLE_WIRING`, `INCOMPATIBLE_SOURCE_EVENT`, `INCOMPATIBLE_TEMPLATE`, `UNKNOWN_TARGET_EVENT`, `CYCLE_DETECTED`) and a human-readable `message` — surface these directly, they're already written for a non-technical reader.
- `PATCH /:id` — partial update, same validation. An empty body returns a clean `400 EMPTY_UPDATE`.
- `DELETE /:id`.

**Event catalog** (`/admin/event-catalog`) — `GET` only. Developer-owned, seeded from code — the admin can *read* this (to know what events/fields exist for the wiring UI) but never write to it. Response: `[{ eventType, payloadFields: { fieldName: type, ... } }]`.

**Actions catalog** (`/admin/actions`) — `GET` only. The fixed, developer-defined action list, each with `{ actionType, requiredPayloadFields, allowedSourceEvents }`. `allowedSourceEvents` is the allowlist the wiring UI should use to grey out / hide nonsensical combinations *before* the user even tries to save — `'*'` means the action is generic and fits any source event.

**Engine Activity** (`/admin/engine-activity`) — `GET`, org-wide real-time audit feed (distinct from the employee activity feed — full event-type coverage, not curated, third-person with employee names resolved, e.g. *"Fatima Arif completed Security Training"*). Also live-pushed over WebSocket, see below.

**Notification delivery stats** (`/admin/notifications`) — `GET` (history), `GET /admin/notifications/stats` (per-channel delivered/failed counts — `email`/`sms`/`in-app`). Monitoring view, not a primary workflow — a simple stat-tile layout is enough.

## WebSocket (Socket.IO)

Single gateway, same host/port as the REST API. Connect with the JWT in the handshake:
```ts
io(baseUrl, { auth: { token: jwtToken } })
```
(A plain `Authorization: Bearer` header also works as a fallback, for any client that can't set `auth` — prefer `auth.token` for a real frontend.)

On connect, the server joins the socket to a room based on the JWT's `groups` claim — this is automatic, nothing to do client-side beyond connecting with a valid token.

**Employee sockets receive:**
- `notification:new` — a new in-app notification, live. Payload: `{ id, message, kind, read: false, createdAt }`. **Fully wired in the frontend** (`NotificationBell`) — bumps the bell badge (capped display at `9+` past 9) and prepends to the dropdown; `kind: 'reminder'` additionally fires a `toast.warning` regardless of whether the dropdown is open, satisfying the "more prominent than just the bell" note without a full modal.
- `activity:new` — a new entry for the employee's own recent-activity feed. Prepend and trim client-side to 5. Payload: `{ id, eventType, message, occurredOn }` (see the `_id` bug noted above — the socket payload's key is wrong even though the field is correctly named `_id` over REST). Fires for `MissionAssigned`/`MissionCompleted`/`MissionExpired`/`LevelUp`/`BadgeUnlocked`/`ReminderDue`.
- `mission:assigned` / `mission:completed` / `mission:expired` — fire on each of an assignment's three possible transitions, all sharing the `AssignmentDto` shape (see above). `mission:assigned` fires on both employee- and admin-initiated assignment. `mission:completed` fires wherever `CompleteMissionCommand` succeeds — including for the completing employee's own action, so a self-triggered complete round-trips back over the socket too. `mission:expired` fires from the expiry sweep. All three feed `ActiveQuestsStatCard`'s live count (`+1`/`-1`/`-1` respectively) and `MissionsList`'s live table; `mission:completed` additionally feeds `MissionsCompletedStatCard` (`+1`) and invalidates `GET /employees/me` (see `EmployeeProfileCacheSync`, below).
- `xp:granted` — fires wherever `GrantXP` executes. Payload: `{ amount: number; xp: number; level: number }` — `xp`/`level` are the employee's new **cumulative** totals (trust these as-is, don't add `amount` locally); `amount` is only for the dashboard's "+N XP" flourish. Only ever wired from `MissionCompleted` (`GrantXP.allowedSourceEvents`).
- `level:up` — fires only on an actual level increase (not every XP grant) from `CheckLevelThreshold`. Payload: `{ level: number }`. Triggers both the live level number update and the celebratory `LevelUpDialog`. Only ever wired from `XPGranted`.
- `badge:granted` — fires wherever `GrantBadge` executes, once per badge newly earned (not once per check — `GrantBadgeAction` loops and emits per badge). Payload: `{ badge: Badge }` (full object, same shape as `GET /badges/my-badges` items). Triggers the live badges-earned count and the celebratory `BadgeGrantedDialog`. **Not causally related to `xp:granted`/`level:up`** — badge unlock is driven by completed-mission *count* crossing a threshold, wired directly off `MissionCompleted` (`GrantBadge.allowedSourceEvents`), independent of XP/level entirely. A mission completion can cascade through all of `xp:granted`/`level:up`/`badge:granted` in one rule-graph chain, but there's no guaranteed ordering between the XP branch and the badge branch — the frontend's reward queue (`reward-queue-store.ts`) is order-agnostic by design because of this.

Real-time coverage is *not* uniform — some things intentionally have no dedicated push, and `activity:new`'s coverage is limited to whatever `formatActivityMessage`'s switch statement handles. If a rule-graph wiring routes an effect through a path that isn't one of the covered event types, nothing gets pushed to the client at all.

### Global cache-sync components

Two always-mounted, invisible components live in `AppShell` (not tied to any one page) whose only job is `socket event → queryClient.invalidateQueries`: `MissionAssignmentCacheSync` (`mission:assigned`/`completed`/`expired` → invalidates all `my-assignments` status variants + `assignments/latest`) and `EmployeeProfileCacheSync` (`xp:granted`/`level:up`/`badge:granted`/`mission:completed` → invalidates `GET /employees/me`). These exist because a component's own live-update hooks only help while that component is actually mounted — a stat card that's unmounted (user navigated away) and later remounts would otherwise serve a stale React Query cache entry from before the event fired. See `docs/decisions.md` for the full reasoning.

**Admin sockets receive:**
- `engine-activity:new` — the org-wide audit feed, live. Same shape as `GET /admin/engine-activity`'s items.

Real-time push is a first-class pattern throughout this app, not a nice-to-have layered on top — REST gives you the initial snapshot on page load, the socket keeps it live from then on. Both are needed; neither replaces the other.

## The fixed event/action vocabulary (for the rule-graph builder specifically)

The admin can only wire from these — nothing else exists, and nothing here should be presented as free text:

**Events** (`sourceEvent`/`targetEvent` values — fetch the live, authoritative list from `GET /admin/event-catalog`, this is illustrative): `MissionAssigned`, `MissionCompleted`, `MissionExpired`, `MissionBulkAssigned`, `XPGranted`, `LevelUp`, `BadgeUnlocked`, `ReminderDue`, `EmployeeAccountCreated`, `AdminAccountCreated`, `NotificationDelivered`, `NotificationFailed`.

**Actions** (`action` values — fetch the live list + their `allowedSourceEvents`/`requiredPayloadFields` from `GET /admin/actions`): `Notify`, `GrantXP`, `CheckLevelThreshold`, `GrantBadge`, `ScheduleReminder`, `CancelReminder`, `EmitEvent`.

`Notify`'s `params` shape specifically: `{ kind: 'general'|'reminder', message: string, channels: ('in-app'|'email'|'sms')[] }`. `message` supports `{{field}}` placeholders — the wiring UI should offer an autocomplete/chip list of the *source event's* declared `payloadFields` (plus the always-available `name`) while the admin is typing, since the backend will reject the save if an unknown field is referenced.

`ScheduleReminder`'s `params` shape: `{ baseIntervalHours: number }` — the admin sets one number; the actual reminder cadence auto-escalates as the mission's deadline approaches (halves at 20-50% time remaining, quarters below 20%, floored at 6h). The UI should explain this behavior near the input, since a single number doesn't convey it.

`CheckLevelThreshold`'s `params` shape: `{ xpPerLevel?: number; growthRate?: number }` (defaults `100`/`1.5` — level *n*'s cost is `xpPerLevel * growthRate^(n-2)`, cumulative). **This means the leveling curve is per-org configurable, not a fixed constant** — `GET /employees/me` only returns cumulative `xp`/`level`, not which params produced them, so there's no way to compute "XP into current level / XP needed for next" with certainty from that endpoint alone. The frontend approximates using the *default* params (see `features/employees/utils/compute-level-progress.ts`) — this will silently be wrong for any org that wired custom `xpPerLevel`/`growthRate` values.

## Known gaps / not yet built on the backend

- No email/SMS delivery UI feedback beyond the stats endpoint — actual send/failure detail per notification isn't exposed beyond aggregate counts.
- No account self-service (password reset, profile edit) — accounts are fully admin-managed.
- No employee-readable full mission catalog — an employee can only see missions they're already assigned (via `my-assignments`/`assignments/latest`), never the full set of missions that exist. Blocks anything like a "browse all missions" screen. (Distinct from the badge catalog gap below, which **is** now closed.)
- No endpoint exposes the actual configured `CheckLevelThreshold` params (`xpPerLevel`/`growthRate`) for a given org — see the leveling-curve note above. XP-progress-bar UIs can only approximate.
- **No global handling of access-token expiry mid-session.** Confirmed by reading `api-fetch.ts`/`query-client.ts`: there's no 401 interceptor and no proactive expiry check against the JWT's `exp` claim. `clearSession()` only runs on an explicit sign-out or when `hydrate()`'s refresh call fails *on a fresh page load*. If the access token expires while the app is open and not reloaded, the next API call just surfaces as a generic error (a toast, a "couldn't load X" message) rather than a redirect to login. Worth deciding whether to add a 401 handler that retries once via `/auth/refresh` before failing, or forces a logout.
- `activity:new`'s socket payload uses `id` instead of `_id` — see that endpoint's entry above. Confirmed root cause, one-line backend fix, not yet applied.

### Closed this session
- ~~No employee-readable full badge catalog~~ — closed by `GET /badges/catalog` (employee-readable, full catalog including locked badges).
- ~~`GET /missions/my-assignments`'s mission-relation embedding is unconfirmed~~ — closed via the shared `AssignmentDto`; confirmed by reading the actual handler code. `docs/mission-assignment-relation-backend-prompt.md` is now superseded/stale — the relation-embedding problem it describes was solved via `AssignmentDto`, not the narrower fix that doc proposed.
