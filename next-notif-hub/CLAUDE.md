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

- `GET /missions/my-assignments?status=&assignedFrom=&assignedTo=&completedFrom=&completedTo=` — the caller's own mission assignments, general-purpose/filterable. Response items: `{ id, missionId, employeeId, status: 'ASSIGNED'|'COMPLETED'|'EXPIRED', assignedAt, completedAt, deadline }` (`deadline` is `null` for missions with no duration — never show a countdown/deadline UI for those). **Known gap:** rows don't embed the mission's `name`/`xpGranted`/`durationDays` (no relation eager-load on this handler) — only `missionId`. A fix was proposed (`docs/mission-assignment-relation-backend-prompt.md`) but not confirmed applied; don't assume this endpoint returns mission details without checking a real response first.
- `GET /missions/assignments/latest` — **new, added this session.** The caller's 5 most-recent `ASSIGNED` assignments, purpose-built for a dashboard "active missions" panel. Intended response: same assignment shape as above, plus an embedded `mission: { id, name, xpGranted, durationDays, createdAt, updatedAt }` (relation eager-loaded), ordered `assignedAt DESC`, capped at 5, pre-filtered to `status: 'ASSIGNED'` server-side. This is the intended final shape per the fix applied during this session — not independently re-verified against a live response after the last edit, so confirm before trusting the embedded `mission` field is actually present.
- `POST /missions/assignments/:assignmentId/complete` — complete one of your own assignments. No body.
- `GET /notifications` — every **unread** in-app notification for the caller. Unbounded (no `limit`/pagination) — marking read is what shrinks the list. Items: `{ id, message, kind: 'general'|'reminder', read, createdAt }`. `kind: 'reminder'` should get visually distinct treatment (more urgent — see WebSocket section). **Not yet built in the frontend** — the top-bar bell is currently a non-functional placeholder (no query wiring, no dropdown data).
- `GET /notifications/unread-count` — just the count, for the bell badge on initial page load before the socket connects. Also not yet wired in the frontend.
- `POST /notifications/:id/read` — mark one read.
- `POST /notifications/read-all` — mark all read (this is what actually shrinks the unread list — no pagination model here).
- `GET /activity-feed` — capped at 5 most-recent items server-side (`.limit(5)`, not a client concern). Items: `{ _id, eventType, message, occurredOn }` — **note the `_id`, not `id`** (confirmed against the actual Mongo schema, `ActivityFeedEntry._id`; this doc previously said `id`, which doesn't match). Message text reads as second-person ("You completed Security Training"), not third-person despite older docs saying so.
- `GET /badges/my-badges` — **undocumented until this session, confirmed real.** The caller's own **already-unlocked** badges only — full `Badge` objects (`{ id, name, description, threshold, tier, createdAt, updatedAt }`), not just ids. There is no employee-readable *full* badge catalog (locked badges + thresholds) — `GET /admin/badges` has the full catalog but is admin-only, so an employee "badge case" screen showing locked badges with progress can't be built without a further backend change.
- `GET /employees/me` — **new, added this session.** `{ xp: number | null, level: number | null, missionsCompleted: number, badgesEarned: number, totalBadges: number }`. `xp`/`level` are `null`-able because those columns only mean something for employee rows (same DB table as admins, STI). `missionsCompleted` = count of the caller's `COMPLETED` assignments; `badgesEarned`/`totalBadges` = unlocked count vs. full catalog size. No endpoint returns *how much XP is needed for the next level* — see the leveling-curve note below.

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
- `notification:new` — a new in-app notification, live. Payload: `{ id, message, kind, read: false, createdAt }`. Bump the bell badge count and prepend to the dropdown instantly; `kind: 'reminder'` should probably also trigger a more prominent toast/modal, not just the bell. **Not yet consumed in the frontend** (bell is a placeholder).
- `activity:new` — a new entry for the employee's own recent-activity feed. Prepend and trim client-side to 5 (server sends full history via `GET /activity-feed` on load, this just adds new ones live). Payload: `{ id, eventType, message, occurredOn }` — fires for `MissionAssigned`/`MissionCompleted`/`MissionExpired`/`LevelUp`/`BadgeUnlocked`/`ReminderDue` (confirmed via the consumer's event-type switch; any other event type produces no push at all, not even a generic one). **Also used as an invalidation signal**, not just a feed entry — there's no dedicated "your XP/level/badges changed" event, so the frontend refetches `GET /employees/me` whenever `eventType` is `MissionCompleted`/`LevelUp`/`BadgeUnlocked`.
- `mission:assigned` — **new, added this session.** Fires when a mission gets assigned, carrying the full row the "active missions" panel needs directly (no refetch required): `{ id, deadline, mission: { name, xpGranted, durationDays } }`. Room/auth mechanics are the same as every other employee event (`user:${userId}`).

Real-time coverage is *not* uniform — some things intentionally have no dedicated push (see "XP/level" above), and `activity:new`'s coverage is limited to whatever `formatActivityMessage`'s switch statement handles. If a rule-graph wiring routes XP or other effects through a path that isn't one of the six covered event types, nothing gets pushed to the client at all.

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
- No employee-readable full mission catalog — an employee can only see missions they're already assigned (via `my-assignments`/`assignments/latest`), never the full set of missions that exist. Blocks anything like a "browse all missions" screen.
- No employee-readable full badge catalog — `my-badges` only returns *unlocked* badges (see above), so a "badge case" screen showing locked badges + progress-to-next isn't buildable against current endpoints.
- No endpoint exposes the actual configured `CheckLevelThreshold` params (`xpPerLevel`/`growthRate`) for a given org — see the leveling-curve note above. XP-progress-bar UIs can only approximate.
- `GET /missions/my-assignments`'s mission-relation embedding is unconfirmed (see that endpoint's entry above) — treat as still returning bare `missionId` until verified against a real response.
