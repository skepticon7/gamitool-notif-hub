# Project structure — modeled on `frontend-core` (the official Gamitool frontend)

Source examined: `~/Desktop/frontend-core` (real production Next.js app for the platform EDEN is modeled on — mentor/admin dashboards, projects/arenas, badges, XP, notifications, leaderboard). This doc extracts the conventions worth replicating here, and explicitly flags what NOT to copy (that project solves problems EDEN doesn't have).

## Stack to adopt

- **Next.js App Router**, TypeScript, Tailwind v4
- **`@tanstack/react-query`** — all server state (queries + mutations), not `useEffect`/`useState` fetching
- **`zod`** + **`react-hook-form`** — form validation
- **`zustand`** — client-only state (UI state, not server data)
- **shadcn/ui + Radix primitives** — component primitives, installed via `components.json` (see below)
- **`tailwind-merge`** — for conditional className composition

## Top-level `src/` layout

```
src/
  app/                  # routing ONLY — thin, no real logic (see below)
  features/             # the real code — one folder per domain feature
  components/
    ui/                  # shadcn primitives (Button, Dialog, ...) — generated, rarely hand-edited
    shared/              # cross-feature reusable components (not shadcn primitives, not feature-specific)
    providers/           # React context providers (QueryClientProvider, etc.)
  hooks/
    api/                 # the two generic hooks every feature's queries/mutations are built on
  lib/                   # the fetch wrapper + other framework-agnostic utilities
  config/
    constants/
      endpoints.ts        # every API path, centralized, in one typed object
      routes.ts            # every frontend route path, centralized
  store/                 # zustand stores
  types/                  # truly global types only (most types live inside their feature)
  utils/                  # generic helpers (not feature-specific)
```

**The rule that matters most**: `app/` contains almost no logic. A page file imports a component from `features/<x>` and renders it — routing glue, not implementation. All real logic, all real components, all data-fetching lives in `features/`.

## Feature-folder anatomy (the pattern to replicate exactly)

Every feature — `notifications`, `dashboard`, `achievements`, `leaderboard`, etc. — follows the same internal shape:

```
features/notifications/
  index.ts                # barrel — re-exports everything below
  constants.ts             # feature-local constants
  types/
    index.ts
  queries/
    use-notifications-query.tsx
    use-unread-count-query.tsx
  mutations/
    use-mark-notification-read-mutation.tsx
  hooks/
    use-notification-toast.ts   # feature-specific hooks that aren't a bare query/mutation
                                 # (e.g. combine a query with local UI state, or wrap a
                                 # WebSocket subscription) — the generic query/mutation
                                 # wrappers themselves live in the global hooks/api/, not here
  components/
    notification-item.tsx
    notification-list.tsx
    notifications-drawer.tsx
```

Not every feature needs every folder (a display-only feature might have no `mutations/`, and most won't need `hooks/` at all — only add it when a feature has logic that doesn't fit cleanly in a query, mutation, schema, or component) — but the folders that exist always follow this naming. Confirmed against `frontend-core`'s own README, which lists `hooks/` explicitly in its feature anatomy.

**The barrel file (`index.ts`)** re-exports everything the outside world is allowed to import — types, queries, mutations, and only the components meant to be used elsewhere:
```ts
export * from "./types"
export * from "./queries/use-notifications-query"
export * from "./mutations/use-mark-notification-read-mutation"
export { NotificationsDrawer } from "./components/notifications-drawer"
```
Other features (and `app/`) import from the feature root (`@/features/notifications`), never reach into a feature's internal files directly.

## The API layer (adapt, don't copy verbatim — EDEN's auth is simpler)

`frontend-core` has real production concerns EDEN doesn't need: CSRF tokens, multi-tenant headers, httpOnly-cookie token refresh, Firebase. **Skip all of that.** EDEN's auth is a plain JWT bearer token — no cookies, no CSRF, no tenant header, no silent refresh flow. Keep the *pattern*, drop the extra machinery:

**`lib/api-fetch.ts`** — one typed fetch wrapper, EDEN's simplified version needs only:
```ts
export interface ApiFetchParams<T> {
  body?: T
  token?: string
  endpoint: string
  method: "GET" | "POST" | "PATCH" | "DELETE"
  params?: Record<string, string>
}

export default async function apiFetch<Payload, Response>(params: ApiFetchParams<Payload>): Promise<Response> {
  // build URL from NEXT_PUBLIC_API_URL + endpoint + params
  // Authorization: `Bearer ${token}` header if token present
  // JSON body, JSON response, throw a typed error on non-2xx
}
```

**`hooks/api/use-api-query.ts`** and **`hooks/api/use-api-mutation.ts`** — thin wrappers around `useQuery`/`useMutation` that call `apiFetch` and pull the token from wherever the app stores it (e.g. a `zustand` auth store, or `next-auth`/whatever session mechanism gets picked — not decided yet, see open question below).

**`config/constants/endpoints.ts`** — every backend path in one place, grouped by domain, matching `next-notif-hub/CLAUDE.md`'s endpoint list exactly:
```ts
const ENDPOINTS = {
  MISSIONS: {
    MY_ASSIGNMENTS: "/missions/my-assignments",
    COMPLETE: (assignmentId: string) => `/missions/assignments/${assignmentId}/complete`,
  },
  NOTIFICATIONS: {
    MY_NOTIFICATIONS: "/notifications",
    UNREAD_COUNT: "/notifications/unread-count",
    MARK_READ: (id: string) => `/notifications/${id}/read`,
    READ_ALL: "/notifications/read-all",
  },
  ADMIN: {
    EVENT_LINKS: "/admin/event-links",
    EVENT_CATALOG: "/admin/event-catalog",
    ACTIONS: "/admin/actions",
    // ...
  },
}
export default ENDPOINTS
```

## Naming conventions (consistent throughout `frontend-core`, keep them)

- **Files**: kebab-case, always — `notification-item.tsx`, `use-notifications-query.tsx`
- **Query hooks**: `use-<thing>-query.ts(x)` exporting `use<Thing>Query`, plus a matching `<THING>_QUERY_KEY` string constant exported alongside it (mutations invalidate by referencing that key, not a magic string)
- **Mutation hooks**: `use-<thing>-mutation.ts(x)` exporting `use<Thing>Mutation`, same query-key-constant pattern
- **Components**: exported as PascalCase named exports (not default exports) — `export function NotificationItem() {}`
- **Types**: live in `features/<x>/types/index.ts`, not scattered per-file

## Role-based split — direct template for EDEN's employee/admin divide

`frontend-core` already solves almost exactly EDEN's problem: one `dashboard` feature, two audiences (mentor vs admin), mostly-disjoint UI:
```
features/dashboard/
  components/          # shared pieces both roles use
  helpers/               # shared transform functions
  queries/                # shared queries
  admin/
    index.tsx             # the admin dashboard page's real implementation
  mentor/
    index.tsx
    components/            # mentor-only components
    queries/                # mentor-only queries
```
Apply this directly: any EDEN feature that has both an employee view and an admin view (missions, badges, notifications) gets this same `feature/{employee,admin}/` split — shared pieces at the feature root, role-specific pieces in their own subfolder. This maps onto the design brief's "two almost entirely separate UIs" framing exactly.

## What NOT to copy from `frontend-core`

- **`app/[lang]/` i18n routing** (`next-intl`) — EDEN is a single-language internal tool. Don't add a locale segment to every route for a language switcher nobody asked for.
- **CSRF token handling, multi-tenant headers, cookie-based token refresh** — EDEN's auth is a plain bearer token, not a cookie-session system. Adding this machinery would be solving a problem EDEN doesn't have.
- **Firebase / chat / tawk-widget features** — unrelated to EDEN's feature set entirely.
- **Sentry, Azure Pipelines, Docker** — legitimate for a real production app; not something to set up for an internship POC unless asked.

## Token storage — decided

Access and refresh tokens live **in-memory only** (e.g. a `zustand` store, no `persist` middleware, no cookie, no `localStorage`) — not `frontend-core`'s cookie + refresh-token flow. Simplest thing that matches EDEN's plain-bearer-token auth; refetched/re-authed on a hard reload rather than persisted across sessions.
