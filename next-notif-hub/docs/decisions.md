# Architectural decisions

Decisions made during frontend build-out, in roughly chronological order. Each entry is the decision, why, and how to apply it going forward — not a changelog of what code changed.

## Package manager: pnpm

**Decision:** pnpm, not npm/yarn — matches `frontend-core` (the reference production app this frontend is modeled on).
**Why:** explicit consistency with the reference codebase's conventions.
**How to apply:** always use `pnpm add`/`pnpm dlx`, never `npm install`. `pnpm-workspace.yaml` holds `onlyBuiltDependencies` (currently `sharp`, `unrs-resolver`) — new packages needing postinstall scripts will need adding there too (pnpm blocks postinstall scripts by default; this is intentional, not a bug to work around by disabling the check globally).

## Token storage: in-memory access token, persisted refresh token

**Decision:** access token lives only in the zustand auth store (`src/store/auth-store.ts`), never persisted. Refresh token is persisted to `localStorage` and redeemed via `POST /auth/refresh` on every app load (see `auth-store.ts`'s `hydrate()`, wired through `AuthProvider`).
**Why:** minimizes the XSS-exposed window (access token never touches persistent storage) while still surviving a page reload (refresh token does). Explicit user decision early in the build ("the access and refresh token will be in-memory ofc" — then extended to "use the refresh token to get a new access token" once a plain reload-loses-session was actually experienced as bad UX).
**How to apply:** never add `persist` middleware to the access token. Any future "am I logged in" check should go through the store's `user`/`accessToken`, not a synchronous localStorage read — the real answer isn't known until `hydrate()`'s async `/auth/refresh` call resolves (see `AuthProvider`'s loading-spinner gate).

## Root route doubles as the login screen

**Decision:** `/` *is* the login screen (`src/app/page.tsx`) — there's no separate `/login` route. `ROUTES.LOGIN = '/'`.
**Why:** avoids an extra redirect hop and a blank-flash intermediate page. Originally built as a separate `/login` route, then explicitly merged into `/` per direct instruction.
**How to apply:** any "redirect to login" logic should target `ROUTES.LOGIN`, not a hardcoded `/login` string. `AuthGuard` and the root page both handle the inverse cases (protected page with no session → `/`; `/` with an active session → role's dashboard).

## App shell: full-width content, no reading-column cap

**Decision:** `AppShell`'s content wrapper has no `max-w` constraint (removed a `max-w-[1140px]` that was there initially).
**Why:** admin data tables (Catalog, eventually Rule graph/Engine activity) need the full available width next to the sidebar; a fixed narrow column fought against that. If a future content-heavy page (e.g. a long-form settings page) wants a narrower reading column, it should apply its own `max-w` wrapper internally rather than the shell imposing one on everything.

## shadcn/ui: installed piecemeal via `add`, never `init`

**Decision:** shadcn components are added one at a time via `pnpm dlx shadcn add <component>`. `shadcn init` was never run.
**Why:** this project already has a hand-built design-token system (`src/styles/tokens/*.css`, wired into Tailwind v4 via `globals.css`'s `@theme inline` block) extracted from the actual GamiTool design system. `shadcn init` would scaffold its own opinionated token setup and likely conflict with or overwrite it. Adding components individually via `add` picks up the existing `components.json`/alias config without touching `globals.css`.
**Consequence to know about:** `add`-without-`init` does *not* reliably install everything a component needs. Two real incidents this session: (1) the first `add button/input/label/form` batch silently failed to write `lib/utils.ts` or add `clsx`/`tailwind-merge`/`class-variance-authority`/`lucide-react` to `package.json`, despite reporting success — caught via `tsc`, fixed by hand-installing and writing `utils.ts` to match the standard shadcn `cn()` helper. (2) `tw-animate-css` (which `dialog.tsx`/`select.tsx`'s `animate-in`/`fade-in-0`/`zoom-in-95` classes depend on) was never installed or imported, since that's normally part of `init`, not `add` — dialogs/selects had zero animation until this was caught and fixed (`pnpm add tw-animate-css` + `@import "tw-animate-css";` in `globals.css`). **When adding a new shadcn component, verify its imports actually resolve and its dependencies actually landed in `package.json` — don't trust the CLI's "success" output alone.**

## Dark mode neutralized entirely

**Decision:** `@custom-variant dark (&:where(.dark, .dark *));` in `globals.css`, and no `.dark` class is ever applied anywhere in the app.
**Why:** GamiTool's design system is explicitly light-mode only (see `colors.css`'s own header comment). Every shadcn-generated component ships `dark:*` utility classes by default, and Tailwind's default `dark:` strategy follows the OS `prefers-color-scheme` media query — meaning on a system in dark mode, those `dark:*` styles would silently activate and fight the intended light-only design, even though nothing in the app ever opts into dark mode. This was a real, hard-to-diagnose bug (a login button's colors looked "randomly" wrong depending on OS theme) before being traced to this. Switching `dark:` to be class-scoped instead of media-query-scoped makes every `dark:*` utility permanently inert, since `.dark` is never applied.
**How to apply:** if dark mode is ever actually wanted later, this is the point to revisit — don't just remove the `@custom-variant` line, since that reverts to the OS-media-query strategy which isn't what a deliberate light/dark toggle would want either (that needs `.dark` applied programmatically, which this setup already supports, it's just never triggered).

## `tailwind-merge` extended for custom token names

**Decision:** `src/lib/utils.ts`'s `cn()` uses `extendTailwindMerge` with custom `theme.radius`/`theme.shadow`/`theme['drop-shadow']` entries covering every custom-named token (`rounded-input`, `rounded-card`, `shadow-card`, `shadow-primary-glow`, `drop-shadow-logo`, etc.), not the plain `twMerge` shadcn ships by default.
**Why:** `tailwind-merge`'s default config only recognizes T-shirt-size suffixes (`sm`/`md`/`lg`/...) as valid values for `rounded-*`/`shadow-*`/`drop-shadow-*` groups. Custom-named tokens like `rounded-input` aren't recognized as conflicting with shadcn's built-in `rounded-md`, so `cn(buttonVariants({...}), 'rounded-input')` would leave *both* classes in the output — and which one visually won depended on unrelated CSS source order, not override intent. This produced a genuinely confusing bug (border/background overrides that "randomly" didn't apply) before being traced to this root cause.
**How to apply:** any new custom-named radius/shadow/drop-shadow token added to `foundations.css` needs a matching entry added to `extendTailwindMerge`'s config in `src/lib/utils.ts`, or the same override-doesn't-stick bug will resurface for it specifically.

## Real-time: one shared socket, generic subscription hook

**Decision:** a single Socket.IO connection for the whole app (`SocketProvider` + `SocketContext`, `src/components/providers/socket-provider.tsx`), not one connection per component/feature. Components subscribe via a generic `useSocketEvent<T>(event, handler)` hook (`src/hooks/use-socket-event.ts`).
**Why:** CLAUDE.md frames real-time as "first-class... not layered on top," implying multiple features (dashboard panels, eventually the notification bell) all need live data concurrently — one shared connection avoids each one independently reconnecting/re-authenticating.
**Implementation note:** the socket instance is created via `useMemo` keyed on the access token, not `useState`+`useEffect`, specifically to satisfy `eslint-plugin-react-hooks`'s `set-state-in-effect` rule (calling `setState` synchronously in an effect body is flagged even for legitimate "derive from external system" cases) — the only actual `useEffect` present just disconnects the previous socket in its cleanup.

## Real-time merge strategy: REST first, then live

**Decision:** every panel that combines an initial REST fetch with live socket updates (Active Missions, Recent Activity) treats REST as the source of truth on load and only starts merging live-pushed events *after* the initial fetch has actually succeeded (gated on the query's `isSuccess`, not just "mounted").
**Why:** without this gate, a socket event arriving in the split-second before the initial REST response lands can race it — get merged into local state, then get silently duplicated or wiped out once the REST data arrives and the merge-by-id logic runs against a baseline that didn't include it yet. Explicit requirement: "pull the latest assigned missions before launching the websocket... so we can maintain a source of truth."
**How to apply:** any new live-updating panel should follow the same pattern — a `useCallback` handler that no-ops (`if (!query.isSuccess) return;`) until the initial fetch resolves, not an unconditional subscription from mount.
