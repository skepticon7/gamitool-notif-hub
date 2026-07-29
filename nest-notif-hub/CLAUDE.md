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

Runtime deps: MySQL (TypeORM, `synchronize: true` — no migrations, schema follows entities directly), MongoDB (Mongoose, for the employee read-projection only), Redis (event stream + BullMQ), and an external n8n instance. Config is env-driven via `@nestjs/config` (`.env`, not committed) — see `N8N_WEBHOOK_BASE_URL`/`N8N_WEBHOOK_SECRET` comments in `.env` for the n8n contract (single workflow, `Webhook -> AI Agent -> Switch(channel) -> send node`, must be **Activated**, not just "listen for test event").

## Architecture

### Event flow (the spine of the whole system)

```
Command Handler ──(same DB transaction)──> outbox_events (MySQL)
                                                  │
                              OutboxProcessor (@Interval 5s, SKIP LOCKED batch claim)
                                                  │
                                          XADD stream:events (Redis Streams)
                                                  │
                        ┌─────────────────────────┴─────────────────────────┐
                        ▼                                                   ▼
          RuleEngineConsumer (group "rule-engine")          EmployeeProjectionConsumer (group "employees-projection")
          runs admin-configured rules per event type         updates the Mongo read-model (xp, level) for fast reads
```

- **Outbox pattern**: every domain event is written to `outbox_events` in the *same* MySQL transaction as its triggering write (e.g. `AssignMissionHandler` inserts the assignment row and the `MissionAssigned` outbox row together via `dataSource.transaction()`). `OutboxProcessor` then asynchronously publishes pending rows to a single shared Redis stream (`stream:events`) and marks them `PROCESSED`/`DEAD` (max 5 attempts).
- **One shared stream, many consumer groups**: every event type flows through `stream:events`; each consumer group filters by `eventType` on read, so adding a new event type needs no new subscription/topic.
- **`RuleEngineConsumer`** (`src/rule-engine/services/rule-engine.consumer.ts`) is the actual rule engine: for each incoming event it looks up admin-configured `EventLinkEntity` rows (source event → action → optional target event) from `RulesCache` (in-memory, reloaded on admin edits — no pub/sub needed since there's a single app instance), runs the matched `Action` via `ActionRegistry`, and — if the action says `shouldEmit` — writes a new outbox row with `causationId` set to the triggering event, forming an event chain. Per-rule idempotency is enforced via `processed_events` (unique on `consumerGroup, eventId, ruleId`); action execution + emitted event + dedupe mark all commit in one transaction, so a crash mid-rule is safely retried exactly once, never double-applied.
- **Self-healing on stream loss**: if Redis loses the stream/consumer-group (flush, restart without AOF), `XREADGROUP` throws `NOGROUP`. Both consumers' read loops catch this, re-run `ensureConsumerGroup()`, and `RuleEngineConsumer` additionally calls `OutboxProcessor.replayRecent()` — which re-`XADD`s every `outbox_events` row from the last 24h **regardless of `status`** (a `PROCESSED` row only means "successfully hand off to Redis," not "every consumer group actually finished with it," so filtering by status would miss exactly the at-risk rows). Replay safety relies on existing idempotency (`processed_events`, Mongo `$set` upserts) making redundant replay a no-op. Redis itself runs with AOF (`appendfsync everysec`) for crash/restart durability — this does not protect against a deliberate `FLUSHALL`.
- **`ActionRegistry`** is a multi-provider (`ACTION_PROVIDERS` DI token) map of `actionType -> Action`; new actions are added by implementing `Action` (`src/rule-engine/actions/action.interface.ts`) and adding them to the factory list in `rule-engine.module.ts` — nothing else needs to change.
- **`EventLinkGraphValidator`** runs before any `event_links` write and is what makes the rule graph admin-safe rather than admin-dangerous: rejects unknown source/target events, rejects wiring an action to an event that doesn't declare the action's `requiredPayloadFields` in its `event_catalog.payloadFields`, and walks the graph to reject cycles.

### Users: Single Table Inheritance

`UserEntity` (`src/users/entities/user.entity.ts`) is the STI base (`@TableInheritance` on a `role` discriminator column); `EmployeeUserEntity`/`AdminUserEntity` are `@ChildEntity`s of the *same physical `users` table*. This means an employee's `id` **is** their user id — no separate join/lookup table. Role is determined at runtime via `instanceof EmployeeUserEntity`/`AdminUserEntity` after TypeORM hydrates the row (see `AuthService.roleOf()`), not from any external identity provider claim. Employee-only columns (`xp`, `level`, `phone`, `smsMode`) live on `EmployeeUserEntity` and are only ever set for employee rows — no DB defaults, since a default would silently populate them on admin rows too.

**Closed provisioning**: accounts are never auto-created on login. Authentik (OIDC) only proves identity; `AuthService.resolveUser()` looks the `sub` up in MySQL and throws `ACCOUNT_NOT_PROVISIONED` if no EDEN account exists — an admin must have created it first via `POST /admin/accounts`.

### TypeORM version gotcha

This repo pins `typeorm@1.1.0`. Confirmed empirically: `repo.save(entity.create({...relationObject, scalarFkColumn}))` can swap values between a relation object and its paired scalar FK column when both are set on the same entity. Every write path in this codebase that touches an entity with a dual relation+scalar mapping uses `manager.insert()`/`manager.update()` with flat scalar values instead of `save(create())` — follow that pattern for new entities of the same shape rather than reintroducing `save(create())`.

### Auth

`JwtAuthGuard` (Passport JWT strategy) + `RolesGuard` (reads `@Roles(...)` metadata, checks against `groups` in the JWT payload) are applied per-controller/handler, not globally — every new admin-only route needs both guards and `@Roles('admin')` explicitly; there's no catch-all. JWT payload (`AppJwtPayload`) carries `groups: [role]` sourced from the STI class, not from Authentik.

### Notifications

`NotifyAction` (a rule-engine `Action`) routes by channel: `in-app` goes to an `in-app` BullMQ queue (`InAppProcessor`); `email`/`sms` go to a shared `n8n` BullMQ queue (`N8nProcessor`), which POSTs to the external n8n webhook (`/webhook/notify`, header-secret auth) and — only on the **final** retry attempt — emits `NotificationFailed`, or on success emits `NotificationDelivered`. Tracking writes are always wrapped in their own try/catch, isolated from the job's main success/failure path, so a tracking-write failure can never cause a duplicate real send or mask a real delivery error. `GET /admin/notifications` reads this history directly off `outbox_events` (`eventType IN (NotificationDelivered, NotificationFailed)`) — there's no dedicated projection table for it.

A wiring's `params.message` is an admin-authored template — `{{field}}` placeholders get interpolated against the triggering event's payload, plus a synthesized `name` (from the employee lookup `NotifyAction` already does; not part of any payload) — see `interpolateTemplate`/`extractTemplateFields` (`src/notifications/services/interpolate-template.ts`). `EventLinkGraphValidator` rejects saving a wiring whose template references a field the source event doesn't declare in `event_catalog.payloadFields` (`name` is always exempt) — this is what stops a template written for one event (e.g. `{{daysLeft}}`, only on `ReminderDue`) from silently reaching a different one and rendering as an empty string.

In-app notifications persist to `in_app_notifications` (written by `InAppProcessor`) — `jobId` (the same deterministic id `NotifyAction` builds for BullMQ, `${eventId}:${ruleId}:${channel}`) is unique, so a job retried after partial failure can't double-insert. `GET /notifications` returns every *unread* notification for the caller, unbounded — no `limit` param; marking read is what shrinks the list, not pagination.

### Real-time (WebSocket)

`NotificationGateway` (`src/websocket/`) is a single Socket.IO gateway shared by the notification bell and the employee activity feed — one room per employee (`user:${employeeId}`), joined at handshake after verifying the JWT from `handshake.auth.token`, or an `Authorization: Bearer` header as a fallback for clients that can't set `auth` (e.g. some Socket.IO test tools). `main.ts` must call `app.useWebSocketAdapter(new IoAdapter(app))` — without it, the gateway's engine.io instance doesn't attach to the app's own HTTP server and silently binds a separate one on a random port instead, and `app.listen(PORT)` appears to hang.

`ActivityFeedConsumer` (`src/activity-feed/`) is a third independent consumer group (`'activity-feed'`) on `stream:events`, alongside `rule-engine` and `employees-projection` — same self-healing pattern (`ensureConsumerGroup()` + `OutboxProcessor.replayRecent()` on read-loop error). It upserts into a Mongo `activity_feed` collection (`_id` = source `eventId`, replay-safe) for a fixed, backend-hardcoded set of event types (`MissionAssigned`, `MissionCompleted`, `MissionExpired`, `LevelUp`, `BadgeUnlocked`, `ReminderDue`) — deliberately **not** admin-templated like `Notify`, since there's no per-rule config surface for it. `GET /activity-feed` caps at 5 via `.limit(5)` in the query handler — a read-time display cap only; Mongo keeps full history for a possible future "view all" screen.

### Missions

`MissionEntity.durationDays` (nullable) → `MissionAssignmentEntity.deadline` is computed **once**, at assign time (`assignedAt + durationDays`), and stored — never derived on read. Missions with no `durationDays` get `deadline: null` and are deliberately never scheduled a reminder (`ScheduleReminderAction` short-circuits on `payload.deadline === null`) and never expired (`MissionExpirySweepService` only sweeps rows where `deadline IS NOT NULL AND deadline <= NOW()`). Both the reminder sweep and expiry sweep follow the same pattern: `@Interval`, SKIP LOCKED batch claim, transactional status flip + outbox emission, per-item try/catch so one bad row doesn't block the batch.

### Module layout

Each top-level `src/<domain>` folder is a self-contained Nest module using CQRS (`@nestjs/cqrs`) — `commands/`, `queries/`, `handlers/`, `entities/`, own controller. `rule-engine` is the cross-cutting one: it imports `outbox`, `users`, `badges`, and `notifications` modules directly because its actions (`GrantXPAction`, `GrantBadgeAction`, `NotifyAction`, etc.) need their repositories. `admin` is a thin controller-only module aggregating admin-facing endpoints (accounts, event catalog, event links, mission/badge catalogs) — it has no entities or handlers of its own.

## Known gaps (don't assume these are done)

- Admin "Engine Activity" — an org-wide, admin-only event feed (distinct from the employee activity feed above) — is designed but not built. Planned to read `outbox_events` directly (no new Mongo projection, same reasoning as `GET /admin/notifications`), with full event-type coverage (not curated — it's an audit tool) and third-person messages with employee-name resolution (a plain join, since `outbox_events` and `users` share a database). `BulkAssignMissionHandler` currently emits N individual `MissionAssigned` events (one per employee, via `AssignMissionCommand` per employee) with no aggregate event for the batch itself — a `MissionBulkAssigned` summary event (additive, not a replacement for the per-employee ones) is planned to cover that before this view can show something like "mission assigned to 8 employees" faithfully.
