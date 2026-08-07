# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**EDEN** — a NestJS event-driven notification & gamification engine, built as an internship POC modeled on Gamitool (gamitool.com). Employees complete missions, earn XP/levels/badges; an admin-configurable rule graph wires domain events to actions (grant XP, notify, schedule reminders, etc.) without redeploying code. Real delivery (email/SMS) goes through an external n8n workflow; the app itself never talks to Brevo/Twilio directly.

## Commands

```bash
npm run start:dev       # watch mode, primary dev loop
npm run build            # nest build
npm run lint              # eslint --fix on src/apps/libs/test
npm run format            # prettier --write

npm run test              # jest unit tests (*.spec.ts, colocated under src/)
npm run test:watch
npm run test:cov
npm run test:e2e          # separate jest-e2e config, test/ dir
npx jest src/path/to/file.spec.ts   # run a single test file
```

Runtime deps: MySQL (TypeORM, `synchronize: true` — no migrations, schema follows entities directly; `connectionLimit: 20` set explicitly in `app.module.ts`, since `RuleEngineConsumer`'s concurrent workers made mysql2's implicit default of 10 — shared across the whole app — too easy to saturate), MongoDB (Mongoose, for the employee read-projection only), Redis (event stream + BullMQ), and an external n8n instance. Config is env-driven via `@nestjs/config` (`.env`, not committed) — every Authentik-related variable is prefixed `AUTHENTIK_` (`AUTHENTIK_CLIENT_ID`/`AUTHENTIK_CLIENT_SECRET`/`AUTHENTIK_CALLBACK`/`AUTHENTIK_API_TOKEN`, alongside the existing `AUTHENTIK_URL`/`AUTHENTIK_APP_SLUG`/`AUTHENTIK_LOGIN_FLOW_SLUG`) so that dependency is obvious at a glance — see `N8N_WEBHOOK_BASE_URL`/`N8N_WEBHOOK_SECRET` comments in `.env` for the n8n contract (single workflow, `Webhook -> AI Agent -> Switch(channel) -> send node`, must be **Activated**, not just "listen for test event"). Setup instructions, Swagger (`/api`), and the Authentik/n8n local-only caveats now live in the monorepo root `README.md`, not here.

## Architecture

### Event flow (the spine of the whole system)

```
Command Handler ──(same DB transaction)──> outbox_events (MySQL)
                                                  │
                                    notifyWake() — PUBLISH outbox:wake (Redis)
                                                  │
                    OutboxProcessor (subscribed; drains on wake, on boot, and on
                                      Redis reconnect — no periodic polling at all)
                                                  │
                                 pipelined XADD stream:events (Redis Streams)
                                                  │
        ┌───────────────────┬───────────────────┼───────────────────┬───────────────────┐
        ▼                   ▼                    ▼                   ▼
  RuleEngineConsumer  EmployeeProjection-   ActivityFeedConsumer  EngineActivityConsumer
  (group "rule-engine", Consumer (group      (group "activity-     (group "engine-
   3 concurrent workers) "employees-          feed")                activity") — admin-
                          projection")                              only org-wide feed
```

- **Outbox pattern**: every domain event is written to `outbox_events` in the *same* MySQL transaction as its triggering write (e.g. `AssignMissionHandler` inserts the assignment row and the `MissionAssigned` outbox row together via `dataSource.transaction()`), followed by an explicit `outboxRepository.notifyWake()` call once that transaction has actually committed. `OutboxProcessor` drains pending rows — no periodic timer: it subscribes to a `outbox:wake` Redis Pub/Sub channel and drains on message, on boot (catches anything left over from before this process started), and on every reconnect of its dedicated wake connection (`REDIS_WAKE_CLIENT`) — a wake signal can only be lost if that connection was down at publish time, and reconnect is exactly that window closing. A `draining`/`dirty` flag pair coalesces a burst of wake signals into one continuous drain pass instead of one per signal. Each drain pass pipelines the whole claimed batch's `XADD`s into one round trip and marks successes with one bulk `UPDATE`, instead of one round trip per event. Rows are marked `PROCESSED`/`DEAD` (max 5 attempts).
- **One shared stream, many consumer groups**: every event type flows through `stream:events`; each consumer group filters by `eventType` on read, so adding a new event type needs no new subscription/topic. Four groups today: `rule-engine`, `employees-projection`, `activity-feed`, `engine-activity`.
- **`RuleEngineConsumer`** (`src/rule-engine/services/rule-engine.consumer.ts`) is the actual rule engine: for each incoming event it looks up admin-configured `EventLinkEntity` rows (source event → action → optional target event) from `RulesCache` (in-memory, reloaded on admin edits — no pub/sub needed since there's a single app instance), runs the matched `Action` via `ActionRegistry`, and — if the action says `shouldEmit` — writes a new outbox row with `causationId` set to the triggering event, forming an event chain. Per-rule idempotency is enforced via `processed_events` (unique on `consumerGroup, eventId, ruleId`); action execution + emitted event + dedupe mark all commit in one transaction, so a crash mid-rule is safely retried exactly once, never double-applied. Runs **3 concurrent internal workers** on the same consumer group (each its own duplicated Redis connection + distinct consumer name), and processes messages within a batch — and rules within one event — concurrently (`Promise.allSettled`), not sequentially: a burst of heavy events (e.g. several `MissionCompleted` cascades) no longer head-of-line-blocks a light one (e.g. a fresh `MissionAssigned`) queued behind them.
- **Self-healing on stream loss vs. message-level failure — these are handled differently, on purpose.** If Redis loses the stream/consumer-group (flush, restart without AOF), the *read itself* (`XREADGROUP`) throws `NOGROUP` — every consumer's loop catches this specifically, re-runs `ensureConsumerGroup()`, and calls `OutboxProcessor.replayRecent()`, which re-`XADD`s every `outbox_events` row from the last 24h **regardless of `status`** (a `PROCESSED` row only means "successfully handed off to Redis," not "every consumer group actually finished with it"). A failure while *processing one message* (a bug, bad/missing referenced data) is caught separately, inside that consumer's own `handle()` — it's logged and the message is simply left **unacknowledged** (quarantined in the group's pending-entries list), never triggering `replayRecent()`. Conflating the two used to mean a single permanently-broken message could trigger an unbounded replay-and-fail loop (confirmed the hard way: an `outbox_events` row referencing a deleted employee spun `replayRecent()` continuously, compounded by the multi-worker change above) — this split is the fix, applied identically across all four consumers. Replay safety relies on existing idempotency (`processed_events`, Mongo `$set` upserts) making redundant replay a no-op. Redis itself runs with AOF (`appendfsync everysec`) for crash/restart durability — this does not protect against a deliberate `FLUSHALL`.
- **`ActionRegistry`** is a multi-provider (`ACTION_PROVIDERS` DI token) map of `actionType -> Action`; new actions are added by implementing `Action` (`src/rule-engine/actions/action.interface.ts`) and adding them to the factory list in `rule-engine.module.ts` — nothing else needs to change.
- **`EventLinkGraphValidator`** runs before any `event_links` write and is what makes the rule graph admin-safe rather than admin-dangerous: rejects unknown source/target events, rejects wiring an action to an event that doesn't declare the action's `requiredPayloadFields` in its `event_catalog.payloadFields`, and walks the graph to reject cycles.
- **Redis connections are split by access pattern**, not shared off one client: `REDIS_CLIENT` for fast synchronous commands, `REDIS_STREAM_CLIENT` for the consumers' blocking `XREADGROUP...BLOCK` reads (plus `RuleEngineConsumer`'s own duplicated per-worker connections), `REDIS_WAKE_CLIENT` dedicated to `OutboxProcessor`'s `SUBSCRIBE`. A command that blocks or subscribes holds up everything else queued behind it on the same connection, so each of these needed its own.

### Users: Single Table Inheritance

`UserEntity` (`src/users/entities/user.entity.ts`) is the STI base (`@TableInheritance` on a `role` discriminator column); `EmployeeUserEntity`/`AdminUserEntity` are `@ChildEntity`s of the *same physical `users` table*. This means an employee's `id` **is** their user id — no separate join/lookup table. Role is determined at runtime via `instanceof EmployeeUserEntity`/`AdminUserEntity` after TypeORM hydrates the row (see `AuthService.roleOf()`), not from any external identity provider claim. Employee-only columns (`xp`, `level`, `phone`, `smsMode`) live on `EmployeeUserEntity` and are only ever set for employee rows — no DB defaults, since a default would silently populate them on admin rows too.

**Closed provisioning**: accounts are never auto-created on login. Authentik (OIDC) only proves identity; `AuthService.resolveUser()` looks the `sub` up in MySQL and throws `ACCOUNT_NOT_PROVISIONED` if no EDEN account exists — an admin must have created it first via `POST /admin/accounts`.

### TypeORM version gotcha

This repo pins `typeorm@1.1.0`. Confirmed empirically: `repo.save(entity.create({...relationObject, scalarFkColumn}))` can swap values between a relation object and its paired scalar FK column when both are set on the same entity. Every write path in this codebase that touches an entity with a dual relation+scalar mapping uses `manager.insert()`/`manager.update()` with flat scalar values instead of `save(create())` — follow that pattern for new entities of the same shape rather than reintroducing `save(create())`.

### Auth

`JwtAuthGuard` (Passport JWT strategy) + `RolesGuard` (reads `@Roles(...)` metadata, checks against `groups` in the JWT payload) are applied per-controller/handler, not globally — every new admin-only route needs both guards and `@Roles('admin')` explicitly; there's no catch-all. JWT payload (`AppJwtPayload`) carries `groups: [role]` sourced from the STI class, not from Authentik.

### Notifications

`NotifyAction` (a rule-engine `Action`) routes by channel, and the two classes of channel are handled deliberately differently: `email`/`sms` go to a shared `n8n` BullMQ queue (`N8nProcessor`), which POSTs to the external n8n webhook (`/webhook/notify`, header-secret auth) and — only on the **final** retry attempt — emits `NotificationFailed`, or on success emits `NotificationDelivered`; **`in-app` is delivered inline, synchronously, inside `NotifyAction.execute()` itself** (the `in_app_notifications` insert, the `notification:new` socket emit, and the `NotificationDelivered` tracking write all happen right there, using the same transaction manager as the rest of that rule) — there is no queue and no separate worker for it. `email`/`sms` keep BullMQ because they call an actually-unreliable external system (n8n) and genuinely benefit from retry/backoff; `in-app` never did — it's just a local MySQL write, and routing it through a queue only added latency (a visible, multi-second gap between `in-app`'s `notification:new` and other same-event socket emits like `mission:assigned`, which fire synchronously) for no reliability benefit. A failed in-app insert is caught, logged, and does **not** roll back or block other channels in the same wiring (email in the same `Notify` call still goes out) — no independent retry either, it relies on the same replay-on-error safety net every other rule-engine action already depends on. Tracking writes (`NotificationDelivered`/`NotificationFailed`) are always wrapped in their own try/catch, isolated from the main success/failure path, so a tracking-write failure can never cause a duplicate real send or mask a real delivery error. `GET /admin/notifications` reads this history directly off `outbox_events` (`eventType IN (NotificationDelivered, NotificationFailed)`) — there's no dedicated projection table for it.

A wiring's `params.message` is an admin-authored template — `{{field}}` placeholders get interpolated against the triggering event's payload, plus a synthesized `name` (from the employee lookup `NotifyAction` already does; not part of any payload) — see `interpolateTemplate`/`extractTemplateFields` (`src/notifications/services/interpolate-template.ts`). `EventLinkGraphValidator` rejects saving a wiring whose template references a field the source event doesn't declare in `event_catalog.payloadFields` (`name` is always exempt) — this is what stops a template written for one event (e.g. `{{daysLeft}}`, only on `ReminderDue`) from silently reaching a different one and rendering as an empty string.

In-app notifications persist to `in_app_notifications` — `jobId` (the same deterministic id `NotifyAction` already builds, `${eventId}:${ruleId}:${channel}`) is unique, so a redelivered/replayed event can't double-insert (caught as `ER_DUP_ENTRY`, logged, treated as already-delivered). `GET /notifications` returns every *unread* notification for the caller, unbounded — no `limit` param; marking read is what shrinks the list, not pagination.

**Planned, not built:** a dedicated admin page to fire an ad-hoc broadcast notification (title/description/target/channels) outside the normal event-driven rule graph. Decided direction: "send now" should still go through the same outbox → stream → `NotifyAction` channel-delivery path (via a new `AdminNotificationRequested`-style event), not a bespoke send path; "send later/recurring" should follow the `ScheduledReminderEntity` + `ReminderSweepService` pattern (a durable MySQL row + periodic sweep), explicitly **not** a BullMQ delayed/repeating job — a Redis-only job wouldn't survive a stream flush the way a MySQL row already does everywhere else in this app.

### Real-time (WebSocket)

`NotificationGateway` (`src/websocket/`) is a single Socket.IO gateway shared by the notification bell, the employee activity feed, live dashboard widgets, and the admin engine-activity feed — one room per employee (`user:${employeeId}`) plus a shared `admins` room, joined at handshake after verifying the JWT from `handshake.auth.token`, or an `Authorization: Bearer` header as a fallback for clients that can't set `auth` (e.g. some Socket.IO test tools). `main.ts` must call `app.useWebSocketAdapter(new IoAdapter(app))` — without it, the gateway's engine.io instance doesn't attach to the app's own HTTP server and silently binds a separate one on a random port instead, and `app.listen(PORT)` appears to hang.

Events emitted today, and where from: `notification:new` (inline from `NotifyAction`, see Notifications above), `mission:assigned`/`mission:completed`/`mission:expired` (from `ActivityFeedConsumer`, the latter two carrying a full `AssignmentDto` fed by a fresh DB row — reused as-is, not hand-built, specifically so this shape can never drift from what `GET /missions/my-assignments`/`/assignments/latest` return), `xp:granted`/`level:up`/`badge:granted` (directly from `GrantXPAction`/`CheckLevelThresholdAction`/`GrantBadgeAction`, synchronous with the rest of that action's transaction — same reasoning as `in-app` above: these are always-on live UI sync, not admin-configurable notifications, so they must never depend on whether a `Notify` rule happens to be wired and must never go through a queue), and `engine-activity:new` (admin-only, from `EngineActivityConsumer`, broadcast to the `admins` room). `mission:assigned`'s `xpStatus` field is derived live from `RulesCache` (`MissionCompleted → GrantXP` wired or not), not a mission-catalog field, since it's admin-configurable and independent of any one mission.

`ActivityFeedConsumer` (`src/activity-feed/`) is one of four independent consumer groups (`'activity-feed'`, alongside `rule-engine`, `employees-projection`, `engine-activity`) on `stream:events` — same self-healing pattern (`ensureConsumerGroup()` + `OutboxProcessor.replayRecent()` on genuine read-loop failure; see the self-healing note above for why message-processing failures are handled differently). It upserts into a Mongo `activity_feed` collection (`_id` = source `eventId`, replay-safe) for a fixed, backend-hardcoded set of event types (`MissionAssigned`, `MissionCompleted`, `MissionExpired`, `LevelUp`, `BadgeUnlocked`, `ReminderDue`) — deliberately **not** admin-templated like `Notify`, since there's no per-rule config surface for it. Before emitting any socket event for a message, it checks whether that `eventId` was already recorded in Mongo — `replayRecent()` can legitimately redeliver the same event as a brand-new stream entry, and the Mongo upsert alone is replay-safe but the socket emits aren't, so a naive frontend counter incrementing/decrementing on these events would double-count on every replay without this check. `GET /activity-feed` caps at 5 via `.limit(5)` in the query handler — a read-time display cap only; Mongo keeps full history for a possible future "view all" screen.

### Missions

`MissionEntity.durationDays` (nullable) → `MissionAssignmentEntity.deadline` is computed **once**, at assign time (`assignedAt + durationDays`), and stored — never derived on read. Missions with no `durationDays` get `deadline: null` and are deliberately never scheduled a reminder (`ScheduleReminderAction` short-circuits on `payload.deadline === null`) and never expired (`MissionExpirySweepService` only sweeps rows where `deadline IS NOT NULL AND deadline <= NOW()`). Both the reminder sweep and expiry sweep follow the same pattern: `@Interval`, SKIP LOCKED batch claim, transactional status flip + outbox emission, per-item try/catch so one bad row doesn't block the batch.

### Module layout

Each top-level `src/<domain>` folder is a self-contained Nest module using CQRS (`@nestjs/cqrs`) — `commands/`, `queries/`, `handlers/`, `entities/`, own controller. `rule-engine` is the cross-cutting one: it imports `outbox`, `users`, `badges`, and `notifications` modules directly because its actions (`GrantXPAction`, `GrantBadgeAction`, `NotifyAction`, etc.) need their repositories. `admin` is a thin controller-only module aggregating admin-facing endpoints (accounts, event catalog, event links, mission/badge catalogs) — it has no entities or handlers of its own.

`RulesCache` lives in its own `RulesCacheModule` (`src/rule-engine/rules-cache.module.ts`), not directly in `RuleEngineModule`'s own providers — split out specifically so a domain that only needs to answer "is a rule wired for event X" (e.g. `ActivityFeedConsumer`'s `xpStatus` field, `MissionsModule`'s `AssignmentDto` mapping) can depend on just the cache, instead of importing all of `RuleEngineModule` (every action, CQRS handler, sweep service) for one lookup. `RuleEngineModule` imports `RulesCacheModule` too and re-exports it, so nothing there changed behaviorally — a module can only re-export a provider it doesn't declare itself by re-exporting the *module* that provides it, not the class token directly (confirmed the hard way via `UnknownExportException`).

## Known gaps (don't assume these are done)

- `BulkAssignMissionHandler` currently emits N individual `MissionAssigned` events (one per employee, via `AssignMissionCommand` per employee) with no aggregate event for the batch itself — a `MissionBulkAssigned` summary event (additive, not a replacement for the per-employee ones) is planned to cover that, e.g. for Engine Activity to show something like "mission assigned to 8 employees" faithfully instead of 8 separate lines.
- Admin-triggered ad-hoc broadcast notifications — see the "Planned, not built" note under Notifications above.
