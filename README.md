# EDEN — Notification & Gamification Hub

EDEN is an event-driven gamification and notification engine, built as an internship POC modeled on [Gamitool](https://gamitool.com). Employees complete missions, earn XP, level up, and unlock badges; an admin-configurable rule graph wires domain events (a mission being assigned, completed, expired, XP granted, a level-up, ...) to actions (grant XP, notify, schedule a reminder, ...) without redeploying code. Real delivery (email/SMS) goes through an external [n8n](https://n8n.io) workflow — EDEN itself never talks to a provider like Brevo or Twilio directly.

This is the monorepo root: `nest-notif-hub` (backend, NestJS) and `next-notif-hub` (frontend, Next.js) are siblings here, with `infrastructure/` holding the supporting Docker Compose projects and this root holding the Nix flake + `justfile` used to run everything.

## What exists so far

**Missions & progression**
- Assign a mission to one employee or to everyone at once; mark a mission complete; automatic expiry once a deadline passes; recurring missions via "schedulments."
- XP grants, level-ups (configurable XP-per-level curve), and badges (threshold-based, awarded automatically off completed-mission count).

**Admin-configurable rule engine**
- An `event_catalog` (developer-owned, GET-only) plus admin-editable `event_links` wire a source event → an action (GrantXP, GrantBadge, CheckLevelThreshold, Notify, ScheduleReminder, CancelReminder, EmitEvent) → an optional target event, forming a chainable rule graph.
- Validated at write time: unknown events are rejected, actions can't be wired to events that don't carry the fields they need, and cycles in the graph are rejected.

**Notifications**
- In-app notifications (bell), and email/SMS via the external n8n workflow. Delivery outcome is tracked (`NotificationDelivered` / `NotificationFailed`) and readable by admins.

**Real-time (WebSocket)**
- One shared gateway; employees get pushed `notification:new`, `activity:new`, `mission:assigned`, `mission:completed`, `mission:expired`, `xp:granted`, `level:up`, and `badge:granted` as they happen. Admins get a live `engine-activity:new` feed.

**Admin tooling**
- Manage the mission catalog, badge catalog, rule graph (`event_links`), accounts, and view notification/engine activity history — all under `/admin/*`, gated by role.

**Architecture notes worth knowing**
- Every domain event is written to a MySQL outbox table in the same transaction as its triggering write, then handed off to a Redis Stream (`stream:events`) that multiple independent consumer groups read from (the rule engine, an employee read-projection, the activity feed, admin engine activity). Handoff is wake-signal driven (a `PUBLISH` right after each transaction commits), not a polling loop, so a new event is picked up in milliseconds rather than on a fixed timer.
- Every consumer self-heals if Redis ever loses the stream/group (a restart, a flush): it recreates the group and replays the last 24h of events so nothing is silently lost.

## Tech stack

NestJS (CQRS), MySQL via TypeORM (`synchronize: true`, no migrations), MongoDB via Mongoose (used only where a denormalized read-projection genuinely earns its keep — e.g. the activity feed), Redis (event stream + BullMQ queues), Socket.IO, Authentik (OIDC identity provider), n8n (outbound notification delivery), Next.js (frontend).

## Development environment

This repo ships a Nix flake and a `justfile` at its root for a one-command setup. You'll need three tools installed on your machine first — none of them come bundled with each other. Whichever way you end up running things, everything below needs its `.env` in place first — set those up before touching any install/run command.

### Configuration — backend

Copy your own `.env` into `nest-notif-hub/` (not committed) with at least:

```
PORT=
MYSQL_HOST=
MYSQL_PORT=
MYSQL_USERNAME=
MYSQL_PASSWORD=
MYSQL_DATABASE=
MONGO_URI=
REDIS_HOST=
REDIS_PORT=
JWT_SECRET=
JWT_EXPIRES_IN=
SESSION_SECRET=
AUTHENTIK_URL=
AUTHENTIK_CLIENT_ID=
AUTHENTIK_CLIENT_SECRET=
AUTHENTIK_APP_SLUG=
AUTHENTIK_LOGIN_FLOW_SLUG=
AUTHENTIK_CALLBACK=
AUTHENTIK_API_TOKEN=
N8N_WEBHOOK_BASE_URL=
N8N_WEBHOOK_SECRET=
```

MySQL/Mongo schema is created automatically on boot (`synchronize: true` / Mongoose model registration) — no migration step needed for this POC. Every Authentik-related variable is prefixed `AUTHENTIK_` so that dependency is obvious at a glance.

### Configuration — frontend

Copy your own `.env.local` into `next-notif-hub/` (not committed) with:

```
NEXT_PUBLIC_API_URL=
```

Point it at wherever the backend is actually reachable — for local dev against the setup below, `http://localhost:8080` (the backend's `PORT`). The frontend runs on Next's default dev port, `http://localhost:3000`; the backend's CORS config (`src/main.ts`) already allows both `localhost:3000` and `localhost:3100`.

### Configuration — infrastructure (Docker Compose)

Each of these is its own Compose project with its own `.env` (not committed):

**`infrastructure/gamitool/compose.yml`** — Redis, the n8n container, and two ngrok tunnels (one for the backend, one for Authentik itself — see the note further below on why). Needs `infrastructure/gamitool/.env`:
```
NGROK_AUTHTOKEN=
```

**`infrastructure/authentik/compose.yml`** — Authentik's own Postgres, server, and worker containers. Needs `infrastructure/authentik/.env`:
```
PG_PASS=
AUTHENTIK_SECRET_KEY=
```
(`PG_DB`/`PG_USER`/`AUTHENTIK_IMAGE`/`AUTHENTIK_TAG`/`COMPOSE_PORT_HTTP`/`COMPOSE_PORT_HTTPS` all have working defaults in the compose file itself — only the two above are actually required.) Authentik's own web UI (for the first-admin bootstrap below) is reachable at `http://localhost:9000` once this is up.

### Windows

None of Nix, `direnv`, or this `justfile` are a realistic option on plain Windows. Nix has no native Windows build at all. `just` itself does have a native Windows build, but this repo's `justfile` recipes (`cd` + `&&` chains, `docker compose -f ...`) assume a Unix-y shell and aren't verified to work under `cmd.exe`/PowerShell — don't rely on them there. You have two real options:

- **Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install)** (a real Linux environment inside Windows) and follow every instruction below *inside* the WSL2 shell — `nix`, `direnv`, and `just` all work exactly as documented there, since it's genuinely Linux.
- **Skip all three tools and run everything by hand** — this is the path for Windows without WSL2 (e.g. a supervisor just running the demo directly). With the three `.env` files above already in place, and Node.js, pnpm, and Docker Desktop for Windows installed natively:
  ```powershell
  # infrastructure (from the monorepo root)
  docker compose -f infrastructure/gamitool/compose.yml up -d
  docker compose -f infrastructure/authentik/compose.yml up -d

  # backend
  cd nest-notif-hub
  npm install
  npm run start:dev

  # frontend (separate terminal)
  cd next-notif-hub
  pnpm install
  pnpm dev
  ```

### 1. Install Nix

The flake needs Nix with flakes enabled (not on by default in a stock install).

```bash
# official installer (multi-user, works on Linux and macOS — or inside WSL2 on Windows)
sh <(curl -L https://nixos.org/nix/install) --daemon
```

Then enable flakes — add this line to `~/.config/nix/nix.conf` (create it if it doesn't exist):

```
experimental-features = nix-command flakes
```

Restart your shell (or the Nix daemon) afterward.

### 2. Install direnv

`direnv` is what auto-loads the flake's dev shell when you `cd` into this repo — it has to be installed *outside* the Nix shell, since it's what gets you into that shell in the first place.

```bash
# macOS
brew install direnv
# Debian/Ubuntu
sudo apt install direnv
# or the official installer (any Linux/macOS)
curl -sfL https://direnv.net/install.sh | bash
```

Then hook it into your shell — add the matching line to your shell's rc file and restart your shell:

```bash
eval "$(direnv hook bash)"   # ~/.bashrc
eval "$(direnv hook zsh)"    # ~/.zshrc
direnv hook fish | source    # ~/.config/fish/config.fish
```

### 3. Install `just`

The Nix flake's dev shell does **not** include `just` — it needs to be installed separately too.

```bash
# macOS
brew install just
# Debian/Ubuntu (recent versions)
sudo apt install just
# or the official installer (any Linux/macOS — installs to ~/.local/bin, make sure that's on PATH)
curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to ~/.local/bin
```

### 4. Run everything

From this directory, once the three tools above are installed:

```bash
# one-time: enter the dev shell (Node, pnpm, docker, git, curl, jq, openssl)
direnv allow          # auto-loads the flake shell on cd from now on
# or, without direnv:
nix develop

# install dependencies for both backend and frontend
just install

# start supporting infrastructure — Redis, n8n, and Authentik (runs both
# Compose projects from Configuration above; see the Authentication section
# below before relying on the Authentik container)
just infra-up

# run the backend in watch mode
just backend

# run the frontend
just frontend
```

Without Nix/just at all, the equivalent from inside each package directory:

```bash
# backend — nest-notif-hub/
npm install
npm run start:dev

# frontend — next-notif-hub/
pnpm install
pnpm dev
```

## Infrastructure that isn't reachable remotely yet

Two pieces of infrastructure only run **locally** right now, tunnelled via ngrok for development rather than hosted anywhere stable — both are planned to be **permanently delegated to a cloud VPS**, which is what will actually resolve the limitations below:

- **Authentik** (identity provider) — see the Authentication section right below.
- **n8n** (outbound email/SMS delivery workflow) — `Notify` actions wired to the `email`/`sms` channels enqueue a job that calls n8n's webhook; since this n8n instance isn't reachable from anywhere but this machine, **real email/SMS delivery will not work for this demo**. In-app notifications (the bell) don't depend on n8n at all and work regardless.

## Authentication — important note for this demo

EDEN never accepts a password itself. Every login — even the "traditional" one — is proxied through **Authentik** (the OIDC provider), which is what actually verifies the credential and returns identity.

Two very different login paths exist, and only one of them is realistically usable for a remote demo:

- **`POST /auth/login`** (email + password) performs Authentik's resource-owner-password (ROPC) grant server-to-server — only *this backend* needs network access to Authentik, not the person viewing the demo. **This is the one to use for the demo.**
- **`GET /auth/oidc/login`** (browser redirect flow) requires the *viewer's own browser* to be redirected to a publicly reachable Authentik instance. Our Authentik instance is currently only running locally (tunnelled via ngrok for development, not a stable public host) — so this path, and anything that depends on it, **does not work for an external demo audience right now**.
- **Login via Microsoft** is a federated identity provider configured *inside* Authentik, reached only through the browser-redirect flow above — since that flow isn't available for this demo, **Microsoft login is not available either**.

In short: for this demo, only email/password via `POST /auth/login` is guaranteed to work.

### Creating the first admin

There is currently **no automated bootstrap script** for the very first admin account — `POST /admin/accounts` (the normal way to create any account) itself requires an existing admin JWT, so the first one has to be created by hand:

1. In Authentik's own admin UI, create a user with an email and password, and note the user's generated ID (its `sub`).
2. Insert a matching row directly into MySQL's `users` table (Single Table Inheritance — `role` is the discriminator column):
   ```sql
   INSERT INTO users (id, sub, email, name, role, createdAt, updatedAt)
   VALUES (UUID(), '<authentik-sub>', '<email>', '<name>', 'admin', NOW(), NOW());
   ```
3. `POST /auth/login` with that email/password now returns a working admin JWT.

### Seeding employees

Once you have an admin JWT, every subsequent account (admin or employee) goes through:

```
POST /admin/accounts
{ "email": "...", "name": "...", "role": "employee" }
```

This creates the identity in Authentik *and* the matching EDEN row in one call, and returns a `temporaryPassword` for that account — there's no bulk-import or email-invite flow yet, so employees are seeded one call at a time and the temporary password is relayed to them out of band.

## API documentation

Interactive Swagger UI is served at **`/api`** once the backend is running (raw OpenAPI JSON at `/api-json`). Log in via `POST /auth/login` (or `/admin/accounts` bootstrap above), then paste the returned access token into the "Authorize" button to call guarded routes directly from the UI.

## Tests

From `nest-notif-hub/`:

```bash
npm run test               # unit tests
npm run test:integration   # integration tests (real MySQL/Redis — see test/integration/jest-integration.json)
npm run test:e2e           # e2e tests
```
