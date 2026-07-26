# Project Journey — Avertra Blogging Platform

> A complete walkthrough of every file, architecture decision, API layer, and design
> pattern in this codebase — written for someone who just found the repo and will
> have to explain it in an interview.

---

## Part 0 — Task Requirements → Implementation Map

| Task Requirement | Where / How |
|---|---|
| React + Next.js frontend | Next.js 16 (App Router), React 19 — `src/app/` |
| User auth (register + login) | `src/lib/auth.ts` (bcrypt + jose JWT), tRPC `authRouter`, `AuthContext` |
| Context API for state | `src/context/AuthContext.tsx` — user state, login/register/logout actions, pending flags |
| Post CRUD (list, detail, create, edit, delete) | tRPC `postsRouter`, pages under `src/app/posts/` |
| Backend API | tRPC (`/api/trpc`) — auth, posts (Node runtime) |
| Validation + error handling | Zod schemas `src/lib/schemas/`, `TRPCError` with codes, `getErrorMessage()` |
| Design pattern: Repository | `IPostsRepository` / `IUsersRepository` interfaces in `src/lib/repositories/` — services depend on interfaces, tests inject mocks |
| Design pattern: Singleton (lazy) | `db()`, `usersRepo()`, `postsRepo()`, `authService()`, `postsService()` — lazy getter singletons avoiding Turbopack TDZ |
| Design pattern: Observer | TanStack Query mutation `onSuccess` → `queryClient.invalidateQueries()` triggers automatic refetch in subscribing components |
| CI/CD: GitHub Actions | `.github/workflows/ci.yml` — lint, typecheck, test:coverage, build, Vercel deploy |
| Unit tests | `tests/unit/` + `tests/trpc/` — schemas, auth, AuthService, PostsService, repositories, router tests — 114 passing |
| Responsive design | Tailwind CSS v4 + shadcn/ui, mobile nav sheet `src/components/layout/navbar.tsx` |
| Dockerized setup | `Dockerfile` (multi-stage standalone) + `docker-compose.yml` (Postgres 16 + app) |
| System design document | `docs/SYSTEM_DESIGN.md` |
| Comments feature | tRPC `posts.comments` query + `posts.createComment` mutation |
| Categories feature | ~~Removed — not in current scope~~ |
| Likes feature | tRPC `posts.like` mutation (toggle), optimistic UI with rollback |

---

## Part 1 — The Journey: What Was Built and Why

### Phase 1: Project scaffold + config

Scaffolded Next.js 16, installed all dependencies. Key config decisions:

| Decision | Why |
|---|---|
| `output: "standalone"` in `next.config.ts:4` | Required for Docker — self-contained server bundle, no `node_modules` at runtime |
| `serverExternalPackages: ["pg", "bcryptjs"]` in `next.config.ts:5` | Prevents Turbopack from bundling native/CJS packages into the edge bundle — keeps them in `node_modules` for Node runtime |
| `.env.local` for DATABASE_URL | Drizzle Kit (`drizzle.config.ts`) loads it via `dotenv` for migrations |
| `vitest.config.ts` with `jsdom` + 80% coverage gate | Unit/component tests run in browser-like env; coverage enforced on `src/lib/**` and `src/trpc/routers/**` |

### Phase 2: Database schema + migrations

Defined 4 tables in `src/db/schema.ts` with Drizzle ORM:

| Table | Key design choices |
|---|---|
| `users` | UUID PK (`defaultRandom()`), `email` unique with index, `passwordHash` (text) |
| `posts` | `slug` unique with index (URL-friendly permalink), `authorId` FK → users with `onDelete: cascade` (delete user = delete their posts), `published` boolean default true, `createdAt` index for ordering |
| `comments` | `postId` FK → posts cascade, `authorId` FK → users cascade, `content` text |
| `likes` | Unique composite index on `(postId, userId)` — enforces one-like-per-user at DB level |

Migration generated to `src/db/migrations/0000_abandoned_cable.sql`.

### Phase 3: Auth system

Built `src/lib/auth.ts` using:

- **bcryptjs** for password hashing (12 rounds) — via `createRequire(import.meta.url)` to avoid Turbopack TDZ with CJS packages
- **jose** for HS256 JWT signing/verification — same `createRequire` pattern
- httpOnly cookie named `session`, 7-day expiry, `sameSite: "lax"`, `secure` in production

The auth module exports: `hashPassword`, `verifyPassword`, `signToken`, `verifyToken`, `setSessionCookie`, `clearSessionCookie`, `getSession`, `requireAuth`.

### Phase 4: Repository + Service layers

Implemented the **Repository pattern** with interface-based contracts:

```
src/lib/repositories/
  users.repository.ts   → IUsersRepository (findByEmail, findById, create)
  posts.repository.ts   → IPostsRepository (findPublished, findBySlug, create, update, delete, toggleLike, getComments, ...)
  index.ts              → lazy singleton getters (usersRepo(), postsRepo())

src/lib/services/
  auth.service.ts       → AuthService (register: check dup → hash → create → sign; login: find → verify → sign; getMe)
  posts.service.ts      → PostsService (delegates to IPostsRepository, thin orchestration)
  index.ts              → lazy singleton getters (authService(), postsService())
```

**Why lazy singletons?** Turbopack's Tree-shaking causes circular dependencies to hit the Temporal Dead Zone (TDZ) if modules are imported eagerly at the top level. Using `let _x = null; function x() { if (!_x) _x = new X(); return _x; }` defers instantiation to runtime, sidestepping TDZ entirely.

**Why interfaces?** The test suite (`auth-service.test.ts`) injects a mock `IUsersRepository` into `AuthService` — proves the pattern works for unit testing without a database.

### Phase 5: Zod validation schemas

`src/lib/schemas/index.ts` defines:

- `registerSchema` — email, name, password (min 8, 1 uppercase, 1 special char via regex)
- `loginSchema` — email, password (min 1)
- `createPostSchema` — title, slug (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`), excerpt, content, published
- `updatePostSchema` — all fields optional
- `createCommentSchema` — content (min 1, max 5000)

Used by tRPC routers (`.input(schema)`) — single source of truth for all input validation.

### Phase 6: tRPC setup (v11 API)

This is the **internal type-safe API** for the Next.js frontend.

**Server side:**

| File | Purpose |
|---|---|
| `src/trpc/init.ts` | Creates tRPC context from request cookies (`cookies().get("session")` → `jose.jwtVerify` → `ctx.user`). Exports `createTRPCRouter`, `publicProcedure`, `protectedProcedure` (auth middleware throws `UNAUTHORIZED`). Also exposes `ctx.setSessionCookie()` and `ctx.clearSessionCookie()` bound to the request's cookie store. |
| `src/trpc/routers/_app.ts` | Root router composing `auth` and `posts` sub-routers. Exports `AppRouter` type for client inference. |
| `src/trpc/routers/auth.ts` | `me` (public, returns current user or null), `register`, `login`, `logout` — mutations call `ctx.setSessionCookie()` / `ctx.clearSessionCookie()`. |
| `src/trpc/routers/posts.ts` | `list` (paginated, public), `bySlug` (public, passes `ctx.user?.id` for `hasLiked`), `mine` (protected), `create` (protected, catches unique-constraint → CONFLICT), `update` (protected), `delete` (protected), `like` (protected, toggle), `createComment` (protected), `comments` (public). |
| `src/app/api/trpc/[trpc]/route.ts` | Next.js route handler — `fetchRequestHandler` from `@trpc/server/adapters/fetch`, `runtime: "nodejs"`, `createContext: createTRPCContext`. |

**Server-side tRPC proxy (RSC prefetch):**

| File | Purpose |
|---|---|
| `src/trpc/server.tsx` | Server-only tRPC proxy via `createTRPCOptionsProxy` — builds `trpc` server proxy whose `.queryOptions()` produces identical TanStack cache keys as the client's `useTRPC()`. Exports `HydrateClient` (wraps children in `HydrationBoundary` + `dehydrate`) and `prefetch` helper. |
| `src/trpc/query-client.ts` | `makeQueryClient()` factory — shared between server prefetch (via `cache()`) and browser provider. Same `QueryClient` config everywhere. |

**Client side (tRPC v11 API):**

| File | Purpose |
|---|---|
| `src/trpc/client.ts` | `createTRPCContext<AppRouter>()` returns `{ TRPCProvider, useTRPC }`. `makeTRPCClient()` creates a `createTRPCClient` with `httpBatchLink` to `/api/trpc`, custom `fetch` with `credentials: "include"` (sends session cookie), and `x-trpc-source` header. |
| `src/trpc/provider.tsx` | `TRPCProviderWrapper` — wraps children with both `TRPCProvider` (tRPC) and `QueryClientProvider` (TanStack Query). Uses shared `makeQueryClient()` from `query-client.ts`. |

**Critical tRPC v11 note:** The API is `useQuery(trpc.X.queryOptions(...))` and `useMutation(trpc.X.mutationOptions(...))` — **NOT** the old `trpc.X.useQuery()`. The `.queryOptions()` / `.mutationOptions()` methods return TanStack Query-compatible objects, which are then spread into the hooks.

### Phase 7: Frontend — React Context + TanStack Query + SSR Hydration

**Auth Context** (`src/context/AuthContext.tsx`):

- `AuthProvider` uses `useTRPC()` to call `trpc.auth.me.queryOptions()` on mount (`enabled: loading`) — this hydrates the user from the session cookie (now also server-prefetched via RSC hydration).
- `login`, `register`, `logout` are wrapped with `useMutation(trpc.auth.xxx.mutationOptions(...))` — each mutation's `onSuccess`/`onSettled` updates local `user` state.
- Exposes `loginPending` and `registerPending` booleans (from `mutation.isPending`) for UI loading states.
- `onSettled` (not `onSuccess`) for logout — ensures `setUser(null)` runs even if the server call fails.

**Provider tree** (`src/app/providers.tsx`):

```
TRPCProviderWrapper  (tRPC client + QueryClient)
  └── AuthProvider   (user state via tRPC.me query)
        └── children
        └── Toaster
```

### Phase 8: Pages + Server Components + Optimistic Like

All data-fetching pages are **Server Components** (async RSC) that prefetch data via `createTRPCOptionsProxy` + `HydrationBoundary`, then delegate to client components for interactive UI. Protected pages check the session cookie server-side and `redirect("/login")` if not authed — no loading flash.

**Post detail page** (`src/app/posts/[slug]/page.tsx` RSC → `post-detail.tsx` client) — the most complex:

- Fetches post by slug: `useQuery(trpc.posts.bySlug.queryOptions({ slug }))`
- Fetches comments: `useQuery(trpc.posts.comments.queryOptions(...))` enabled when `post?.id` exists
- **Optimistic like** (`likeMutation`):
  - `onMutate`: cancels in-flight `bySlugQuery`, snapshots previous data, optimistically toggles `hasLiked` and `likes` count via `queryClient.setQueryData()`
  - `onError`: restores snapshot from `context.previousPost`
  - `onSettled`: invalidates `bySlugQuery` to refetch real data from server
- Heart button: shows red (`bg-red-500`, `fill-current`) when `isLiked` is true (lines 174-184)
- Comment form with `commentMutation` + error display via `getErrorMessage()`
- Delete with confirm dialog + redirect to home

### Phase 9: Error handling

Centralized in `src/lib/error-utils.ts` — `getErrorMessage(err)`:

1. Checks `ZodError` → joins issue messages
2. Checks `TRPCClientError` → maps known error strings (`INVALID_CREDENTIALS` → "Invalid email or password") from `ERROR_MESSAGES` map, falls back to server message if human-readable
3. Checks native `Error` → maps known messages
4. Fallback: "An unexpected error occurred"

Every page imports and uses `getErrorMessage()` instead of raw `err.message`.

---

## Part 2 — File-by-File Purpose Guide

### Database Layer (`src/db/`)

| File | Purpose |
|---|---|
| `src/db/schema.ts` | Drizzle ORM schema — defines 4 tables (users, posts, comments, likes) with types, indexes, and foreign key constraints |
| `src/db/index.ts` | Lazy singleton `db()` function — creates a `pg.Pool` + Drizzle instance on first call, reuses thereafter. Avoids Turbopack TDZ circular deps |
| `src/db/migrations/0000_abandoned_cable.sql` | Generated SQL migration — creates all 4 tables with indexes |

### Edge Middleware

| File | Purpose |
|---|---|
| `src/middleware.ts` | Next.js Edge middleware — verifies JWT session cookie on protected routes (`/my-posts`, `/posts/new`, `/posts/:slug/edit`). Uses `jose.jwtVerify` directly (Edge-safe). Redirects to `/login` on missing/invalid token. Runs before the page renders — no client round-trip. |

### Auth Layer (`src/lib/auth.ts`)

| File | Purpose |
|---|---|
| `src/lib/auth.ts` | Core auth primitives — `hashPassword` (bcryptjs 12 rounds), `verifyPassword`, `signToken` (jose HS256, 7d expiry), `verifyToken`, `setSessionCookie` / `clearSessionCookie` (httpOnly), `getSession`, `requireAuth`. Uses `createRequire` for CJS packages. |

### Validation (`src/lib/schemas/index.ts`)

| File | Purpose |
|---|---|
| `src/lib/schemas/index.ts` | All Zod schemas — `registerSchema` (password rules), `loginSchema`, `createPostSchema` (slug regex), `updatePostSchema`, `createCommentSchema`. Exports inferred TypeScript types. |

### Repository Layer (`src/lib/repositories/`)

| File | Purpose |
|---|---|
| `src/lib/repositories/users.repository.ts` | `IUsersRepository` interface + `UsersRepository` — `findByEmail`, `findById`, `create` using Drizzle |
| `src/lib/repositories/posts.repository.ts` | `IPostsRepository` interface + `PostsRepository` — full CRUD, `findPublished` (paginated), `findBySlug` (with `hasLiked` + counts), `toggleLike`, `getComments`. Uses shared `mapPost()` helper and `authorSelect`/`postSelect` constants to avoid repetition |
| `src/lib/repositories/index.ts` | Lazy singleton getters — `usersRepo()`, `postsRepo()`. Exports interfaces + classes |

### Service Layer (`src/lib/services/`)

| File | Purpose |
|---|---|
| `src/lib/services/auth.service.ts` | `AuthService` — register (dup check → hash → create → sign), login (find → verify → sign), getMe. Depends on `IUsersRepository` interface for testability |
| `src/lib/services/posts.service.ts` | `PostsService` — thin orchestration over `IPostsRepository`. `listPublished`, `getBySlug`, `create`, `update`, `delete`, `toggleLike`, `createComment`, `getComments` |
| `src/lib/services/index.ts` | Lazy singleton getters — `authService()`, `postsService()` |

### API Helpers (`src/lib/`)

| File | Purpose |
|---|---|
| `src/lib/error-utils.ts` | `getErrorMessage()` — extracts friendly messages from TRPCClientError, ZodError, and known app errors. Used by all pages |
| `src/lib/utils.ts` | shadcn utility — `cn()` function merging Tailwind classes via `clsx` + `tailwind-merge` |

### tRPC Layer (`src/trpc/`)

| File | Purpose |
|---|---|
| `src/trpc/init.ts` | Server-side tRPC bootstrap — `createTRPCContext()` reads cookie → verifies JWT → returns `{ user, setSessionCookie, clearSessionCookie }`. Exports `createTRPCRouter`, `publicProcedure`, `protectedProcedure` (auth middleware) |
| `src/trpc/routers/_app.ts` | Root router — composes `auth` and `posts` sub-routers. Exports `AppRouter` type |
| `src/trpc/routers/auth.ts` | Auth router — `me`, `register`, `login`, `logout`. Mutations call `ctx.setSessionCookie()` / `ctx.clearSessionCookie()` |
| `src/trpc/routers/posts.ts` | Posts router — `list`, `bySlug`, `mine`, `create`, `update`, `delete`, `like`, `createComment`, `comments`. Mix of public and protected procedures |
| `src/trpc/client.ts` | Client-side tRPC setup — `createTRPCContext<AppRouter>()` → `{ TRPCProvider, useTRPC }`. `makeTRPCClient()` with `httpBatchLink`, custom fetch with `credentials: "include"` |
| `src/trpc/provider.tsx` | `TRPCProviderWrapper` — wraps tRPC + TanStack Query providers. `QueryClient` with 5min staleTime |
| `src/app/api/trpc/[trpc]/route.ts` | Next.js route handler — `fetchRequestHandler` with `createTRPCContext`, `runtime: "nodejs"` |

### Context Layer (`src/context/`)

| File | Purpose |
|---|---|
| `src/context/AuthContext.tsx` | Auth state management — `AuthProvider` hydrates user from `trpc.auth.me`, exposes `login`/`register`/`logout` actions + `loginPending`/`registerPending` booleans. `useAuth()` hook |

### App Pages (`src/app/`)

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout — Geist fonts, `<Providers>` wrapper, `<Navbar>`, `<main>` |
| `src/app/providers.tsx` | Client component wrapping `TRPCProviderWrapper` → `AuthProvider` → `Toaster` |
| `src/app/globals.css` | Tailwind CSS v4 imports + global styles |
| `src/app/loading.tsx` | Root loading skeleton — `animate-pulse bg-muted` blocks during RSC prefetch |
| `src/app/error.tsx` | Root error boundary (`"use client"`) — logs errors via `console.error`, shows message + "Try again" button |
| `src/app/not-found.tsx` | Static 404 page — "Page not found" + back-to-home link |
| `src/app/page.tsx` | Home page (RSC) — prefetches `posts.list` + `auth.me` via `createTRPCOptionsProxy`, wraps `PostsListClient` in `HydrateClient` |
| `src/app/_components/posts-list.tsx` | Client component — renders post card list with `useQuery(trpc.posts.list.queryOptions())`, hydrated from server cache |
| `src/app/posts/[slug]/page.tsx` | Post detail (RSC) — prefetches `bySlug` + `comments` + `auth.me`, wraps `PostDetailClient` in `HydrateClient` |
| `src/app/posts/[slug]/post-detail.tsx` | Client component — post content, optimistic like, comment form. All mutations work from hydrated cache |
| `src/app/posts/new/page.tsx` | New post (RSC) — server redirects to `/login` if not authed, wraps `NewPostClient` in `HydrateClient` |
| `src/app/posts/new/new-post-client.tsx` | Client component — new post form with slug auto-generation |
| `src/app/posts/[slug]/edit/page.tsx` | Edit post (RSC) — server redirects if not authed, prefetches `posts.mine`, wraps `EditPostClient` in `HydrateClient` |
| `src/app/posts/[slug]/edit/edit-post-client.tsx` | Client component — edit form, pre-fills from cached `posts.mine` data |
| `src/app/my-posts/page.tsx` | My posts (RSC) — server redirects if not authed, prefetches `posts.mine`, wraps `MyPostsClient` in `HydrateClient` |
| `src/app/my-posts/_components/my-posts-client.tsx` | Client component — my posts list with delete mutation |
| `src/app/login/page.tsx` | Login form — email + password, uses `useAuth().login`, shows `getErrorMessage()` on failure |
| `src/app/register/page.tsx` | Register form — email, name, password with live rules checklist (min 8, uppercase, special char), uses `useAuth().register` |

### Components (`src/components/`)

| File | Purpose |
|---|---|
| `src/components/layout/navbar.tsx` | Sticky top navbar — desktop links + dropdown user menu, mobile hamburger → Sheet. Uses `render={<Button/>}` prop for base-ui trigger elements (avoids nested button hydration) |
| `src/components/auth/require-auth.tsx` | Client-side auth wrapper — redirects to `/login` if user is not authenticated. Loading skeleton during auth check. Used as safety net inside RSC-protected pages for mid-session token expiry |
| `src/components/ui/*` | shadcn/ui primitives — avatar, badge, button, card, dialog, dropdown-menu, input, label, separator, sheet, table, textarea, toast. All use `@base-ui/react` (shadcn v4) |

### Tests (`tests/`)

| File | Purpose |
|---|---|
| `tests/setup.ts` | Vitest setup — imports `@testing-library/jest-dom` matchers |
| `tests/unit/schemas.test.ts` | Validates all Zod schemas — valid inputs pass, invalid inputs produce correct error messages |
| `tests/unit/auth.test.ts` | Tests `hashPassword`/`verifyPassword`/`signToken`/`verifyToken` — hash verify roundtrip, invalid password, invalid JWT, expired JWT |
| `tests/unit/auth-service.test.ts` | Tests `AuthService` with mock `IUsersRepository` — register creates user, duplicate email throws, login validates credentials, getMe returns user or null |

### Config + CI/CD

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js config — `output: "standalone"`, `serverExternalPackages: ["pg", "bcryptjs"]` |
| `drizzle.config.ts` | Drizzle Kit config — loads `.env.local`, generates migrations to `src/db/migrations/` |
| `vitest.config.ts` | Vitest config — jsdom environment, `@/` alias, 80% coverage threshold on `src/lib/**` + `src/trpc/routers/**` |
| `tsconfig.json` | TypeScript config — path alias `@/*` → `src/*` |
| `docker-compose.yml` | Docker Compose — Postgres 16 + migrate (one-shot) + app service with healthcheck dependency |
| `Dockerfile` | Multi-stage build — builder (node:22-alpine, npm install, Next standalone) → runner (non-root, healthcheck) → migrate (drizzle-kit migrate) |
| `.github/workflows/ci.yml` | GitHub Actions CI/CD — Postgres service container → `npm install` → `db:generate` → `db:migrate` → lint → typecheck → test:coverage → build → Vercel deploy (prod on main via Vercel CLI) |

---

## Part 3 — API Layers & Call Sequence

### Layered Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    EDGE MIDDLEWARE                             │
│  src/middleware.ts — JWT verification on protected routes     │
│  Redirects to /login before page renders                     │
└──────────────────────────┬───────────────────────────────────┘
                           │ (if authed or public route)
┌──────────────────────────▼───────────────────────────────────┐
│                  NEXT.JS SERVER (Node runtime)                │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  RSC Server Components (page.tsx)                        │ │
│  │  createTRPCOptionsProxy → prefetch → HydrateClient      │ │
│  │  Server reads cookies() → prefetches auth.me + data     │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                           │ dehydrate(cache)                  │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Client Components (_components/posts-list.tsx, post-detail.tsx...)  │ │
│  │  useTRPC() + TanStack Query (hydrated from server cache)│ │
│  │  AuthContext (login/register/logout via tRPC mutations)  │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                           │ fetch (credentials: include)       │
│                           ▼                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  SERVICE LAYER                           │  │
│  │  AuthService: register/login/getMe                      │  │
│  │  PostsService: listPublished/getBySlug/create/update/    │  │
│  │                delete/toggleLike/createComment/getComments│  │
│  │                                                          │  │
│  │  (validates input via Zod schemas, orchestrates logic)  │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               REPOSITORY LAYER                           │  │
│  │  IUsersRepository → UsersRepository                      │  │
│  │  IPostsRepository → PostsRepository                      │  │
│  │                                                          │  │
│  │  (Drizzle ORM queries, owner enforcement in WHERE)       │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  db() — lazy singleton Drizzle client (pg Pool)         │  │
│  └───────────────────────┬─────────────────────────────────┘  │
└───────────────────────────┼───────────────────────────────────┘
                            │ TCP / SQL
                            ▼
                   PostgreSQL (Neon / localhost)
```

### Why tRPC?

- End-to-end type safety for the Next.js frontend — no code generation, full autocomplete, type-checked errors
- All API calls go through tRPC. The service layer handles business logic, the repository layer handles data access
- TanStack Query integration gives caching, background refetching, and optimistic updates for free

### Request Sequence: Register

```
Browser                    tRPC Handler              AuthService         UsersRepository      PostgreSQL
  │                            │                         │                     │                  │
  │  POST /api/trpc/auth.register│                         │                     │                  │
  │  {email,name,password}     │                         │                     │                  │
  │ ──────────────────────────>│                         │                     │                  │
  │                            │ createTRPCContext():     │                     │                  │
  │                            │   cookies() → no token   │                     │                  │
  │                            │   ctx.user = null        │                     │                  │
  │                            │                         │                     │                  │
  │                            │ publicProcedure:         │                     │                  │
  │                            │   registerSchema.parse() │                     │                  │
  │                            │   authService().register │                     │                  │
  │                            │ ────────────────────────>│                     │                  │
  │                            │                         │ findByEmail(email)   │                  │
  │                            │                         │ ───────────────────>│ SELECT ...       │
  │                            │                         │ <── null ───────────│                  │
  │                            │                         │                     │                  │
  │                            │                         │ hashPassword(pw, 12) │                  │
  │                            │                         │ create({email,name,hash})              │
  │                            │                         │ ───────────────────>│ INSERT ...       │
  │                            │                         │ <── user ───────────│                  │
  │                            │                         │                     │                  │
  │                            │                         │ signToken(user)      │                  │
  │                            │                         │ return {user, token} │                  │
  │                            │ <────────────────────────│                     │                  │
  │                            │                         │                     │                  │
  │                            │ ctx.setSessionCookie(token)                     │                  │
  │                            │   cookies().set("session", token, {httpOnly...})│                  │
  │                            │                         │                     │                  │
  │                            │ return {user}           │                     │                  │
  │ <──────────────────────────│                         │                     │                  │
  │                            │                         │                     │                  │
  │  (browser stores cookie automatically)               │                     │                  │
```

### Request Sequence: View Post (with hasLiked)

```
Browser                    tRPC Handler              PostsService         PostsRepository      PostgreSQL
  │                            │                         │                     │                  │
  │  GET /api/trpc/posts.bySlug│                         │                     │                  │
  │  {slug:"my-post"}          │                         │                     │                  │
  │ ──────────────────────────>│                         │                     │                  │
  │                            │ createTRPCContext():     │                     │                  │
  │                            │   cookies → "session"   │                     │                  │
  │                            │   verifyToken → {id,e}  │                     │                  │
  │                            │   ctx.user = {id:u1,...}│                     │                  │
  │                            │                         │                     │                  │
  │                            │ publicProcedure:         │                     │                  │
  │                            │   postsService().getBySlug│                    │                  │
  │                            │   (slug, ctx.user?.id)  │                     │                  │
  │                            │ ────────────────────────>│                     │                  │
  │                            │                         │ findBySlug(slug, userId)               │
  │                            │                         │ ───────────────────>│                  │
  │                            │                         │                     │ SELECT posts      │
  │                            │                         │                     │ JOIN users        │
  │                            │                         │                     │ WHERE slug = ?    │
  │                            │                         │                     │ WHERE slug = ?    │
  │                            │                         │                     │                  │
  │                            │                         │                     │ SELECT count(likes)│
  │                            │                         │                     │ SELECT count(comments)│
  │                            │                         │                     │                  │
  │                            │                         │                     │ SELECT from likes │
  │                            │                         │                     │ WHERE postId=?    │
  │                            │                         │                     │ AND userId=u1     │
  │                            │                         │                     │ → hasLiked: true  │
  │                            │                         │                     │                  │
  │                            │                         │ return {post, author,│                  │
  │                            │                         │   _count, hasLiked}  │                  │
  │                            │ <────────────────────────│                     │                  │
  │                            │                         │                     │                  │
  │                            │ return post             │                     │                  │
  │ <──────────────────────────│                         │                     │                  │
  │                            │                         │                     │                  │
  │ Heart renders RED, "fill-current", count=12         │                     │                  │
```

### Request Sequence: Optimistic Like

```
User clicks Heart
        │
        ▼
   likeMutation.mutate({postId})
        │
        ├─ onMutate:  ← FIRES IMMEDIATELY (no server wait)
        │   cancelQueries(bySlugQuery)      // stop in-flight fetch
        │   snapshot = getQueryData(slug)   // save for rollback
        │   setQueryData(slug, {            // optimistic update
        │     hasLiked: !wasLiked,
        │     _count: { likes: count + 1 }
        │   })
        │   return { previousPost: snapshot }
        │
        │   (Heart turns red INSTANTLY, count +1)
        │
        ├─ Server call: POST /api/trpc/posts.like
        │   protectedProcedure → postsService().toggleLike()
        │   → DB: INSERT INTO likes (or DELETE if exists)
        │   → returns { liked: true }
        │
        ├─ onSettled:  ← FIRES AFTER SUCCESS OR FAILURE
        │   invalidateQueries(bySlugQuery)
        │   (TanStack Query refetches real data from server)
        │
        └─ onError (if server fails):    ← FIRES ON FAILURE
            setQueryData(slug, snapshot) // RESTORE PREVIOUS
            (Heart snaps back to original state)
```

### Request Sequence: Create/Update/Delete Post (Owner-Enforced)

```
Browser                    tRPC PostsRouter           PostsService         PostsRepository
  │                            │                         │                     │
  │ create.mutation({          │                         │                     │
  │   title, slug, content     │                         │                     │
  │ })                         │                         │                     │
  │ ──────────────────────────>│                         │                     │
  │                            │ protectedProcedure:      │                     │
  │                            │   ctx.user exists? ✓     │                     │
  │                            │   createPostSchema.parse │                     │
  │                            │   postsService().create  │                     │
  │                            │ ────────────────────────>│                     │
  │                            │                         │ repo.create({       │
  │                            │                         │   ...input,         │
  │                            │                         │   authorId: userId  │ ← owner bound
  │                            │                         │ })                  │
  │                            │                         │ ───────────────────>│ INSERT posts
  │                            │                         │ <── post ───────────│
  │                            │ <────────────────────────│                     │
  │                            │                         │                     │
  │ For UPDATE/DELETE:          │                         │                     │
  │                            │   postsService().update( │                     │
  │                            │     id, ctx.user.id, ... │                     │
  │                            │   )                      │                     │
  │                            │                         │ repo.update(id, authorId, input)
  │                            │                         │ ───────────────────>│ UPDATE posts
  │                            │                         │                     │ WHERE id = ?
  │                            │                         │                     │ AND authorId = ? ← owner check
  │                            │                         │ <── null if no match│
  │                            │ <────────────────────────│                     │
  │                            │                         │                     │
  │                            │ if null → TRPCError:     │                     │
  │                            │   NOT_FOUND              │                     │
  │                            │ (catches unauthorized   │                     │
  │                            │  update/delete attempts) │                     │
```

---

## Part 4 — tRPC v11 Setup (End-to-End)

### Server Side

```
src/trpc/init.ts                        src/trpc/routers/_app.ts
─────────────────                       ─────────────────────────
initTRPC                                createTRPCRouter({
  .context<TRPCContext>()                   auth: authRouter,
  .create()                                posts: postsRouter,
exports:                                      })
  createTRPCRouter                     → exported as appRouter (type only for client)
  publicProcedure
  protectedProcedure  ← middleware:       src/trpc/routers/posts.ts
    if (!ctx.user) throw UNAUTHORIZED      publicProcedure / protectedProcedure
                                            .input(z.object({...}))
                                            .query(async ({input, ctx}) => ...)

src/app/api/trpc/[trpc]/route.ts          src/trpc/routers/auth.ts
──────────────────────────────            ─────────────────────────
fetchRequestHandler({                       publicProcedure
  endpoint: "/api/trpc",                     .input(loginSchema)
  router: appRouter,                         .mutation(async ({input, ctx}) => {
  createContext: createTRPCContext              const result = await authService().login(input)
})                                              await ctx.setSessionCookie(result.token)
                                              return result;
export { handler as GET, handler as POST }  })
```

### Client Side

```
src/trpc/client.ts                          src/trpc/provider.tsx
─────────────────                           ────────────────────────
createTRPCContext<AppRouter>()               TRPCProviderWrapper
  → { TRPCProvider, useTRPC }                  QueryClient (staleTime: 5m)
                                                trpcClient = makeTRPCClient()
makeTRPCClient():                                return (
  createTRPCClient<AppRouter>({                    <TRPCProvider ...>
    links: [httpBatchLink({                          <QueryClientProvider ...>
      url: "/api/trpc",                                {children}
      fetch(url, opts) →                               </QueryClientProvider>
        fetch(url, {                                   </TRPCProvider>
          ...opts,                                   )
          credentials: "include"  ← sends cookie
        })
    })]
  })
```

### Page Consumption Pattern

```tsx
// In any page component:
"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";

const trpc = useTRPC();

// Query — trpc.X.queryOptions() returns { queryKey, queryFn }
const { data, isLoading } = useQuery(
  trpc.posts.list.queryOptions({ page: 1, limit: 10 })
);

// Mutation — trpc.X.mutationOptions() returns { mutationFn, onSuccess, onError }
const mutate = useMutation(
  trpc.posts.like.mutationOptions({
    onMutate: () => { /* optimistic update */ },
    onError: (_err, _vars, ctx) => { /* rollback */ },
    onSettled: () => { /* invalidate */ },
  })
);

// To mutate:
mutate.mutate({ postId: "..." });
```

**Critical distinction from old tRPC API:**
- Old (tRPC v10): `trpc.posts.list.useQuery({ page: 1 })` — the hook was on `trpc` itself
- New (tRPC v11): `useQuery(trpc.posts.list.queryOptions({ page: 1 }))` — `.queryOptions()` returns a plain object, hooks are from TanStack Query

---

## Part 5 — TanStack Query Usage

### QueryClient Configuration

`src/trpc/provider.tsx:14-17`:
```tsx
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // data considered fresh for 5 minutes
      refetchOnWindowFocus: false,   // no refetch when switching tabs
    },
  },
})
```

Created via `useState(() => ...)` — ensures the same instance persists across re-renders (not recreated on every render).

### TanStack Query as Observer Pattern

Every mutation's `onSuccess` / `onSettled` calls `queryClient.invalidateQueries(queryKey)`. TanStack Query automatically re-runs the associated `useQuery` hooks that share that key — components refetch without manual coordination.

```tsx
// In my-posts/page.tsx:
const deleteMutation = useMutation(
  trpc.posts.delete.mutationOptions({
    onSuccess: () => {
      // Observer pattern: any useQuery with this key refetches automatically
      queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
    },
  })
);
```

### Optimistic Update Pattern

The canonical optimistic-update cycle (used in post detail like button):

1. **Cancel** in-flight queries: `queryClient.cancelQueries(queryOptions)`
2. **Snapshot** previous data: `queryClient.getQueryData(queryOptions.queryKey)`
3. **Optimistic write**: `queryClient.setQueryData(queryKey, updater)` — UI reflects change instantly
4. **Return snapshot**: pass as `context` to error handler
5. **On error**: `queryClient.setQueryData(key, context.previousPost)` — restore snapshot
6. **On settled**: `queryClient.invalidateQueries(queryOptions)` — refetch real server data

---

## Part 6 — Cross-Cutting Concerns

### Auth & Cookies

- Passwords hashed with bcryptjs (12 rounds), never stored in plain text
- Session is a JWT (HS256, jose library, 7-day expiry) stored in an httpOnly cookie named `session`
- Cookie set server-side via `next/headers` `cookies().set()` — never accessible to client-side JS (XSS-safe)
- `credentials: "include"` in the tRPC client fetch ensures the cookie is sent with every request
- `createTRPCContext` verifies the JWT on every request — `ctx.user` is populated if the cookie is valid

### Validation

- tRPC routers: `.input(schema)` validates before handler runs; invalid input → `BAD_REQUEST` automatically
- `src/lib/schemas/index.ts` is the single source of truth for all input validation

### The Lazy-Getter / Turbopack TDZ Story

Turbopack (Next.js 16's bundler) resolves module graph at build time. When modules circularly depend on each other (e.g., `db/index.ts` imports `db/schema.ts`, repositories import `db/index.ts`), the module evaluation can hit the Temporal Dead Zone — variables are in scope but not yet initialized.

**Solution:** Lazy initialization via getter functions:
```typescript
let _db = null;
export function db() {
  if (!_db) _db = createConnection();  // deferred to call-time
  return _db;
}
```

Applied to: `db()`, `usersRepo()`, `postsRepo()`, `authService()`, `postsService()`.

### The shadcn v4 / base-ui `render` Prop Story

shadcn v4 uses `@base-ui/react` (not Radix). Trigger components (like `DropdownMenuTrigger`, `SheetTrigger`) render their own `<button>` element internally.

**Trap:** If you wrap `<Button>` as a child of the trigger, you get `<button><button>...</button></button>` — nested buttons cause React hydration errors.

**Correct pattern** (used in `navbar.tsx:58-64`):
```tsx
<DropdownMenuTrigger
  render={
    <Button variant="ghost" size="sm">
      <User className="w-4 h-4 mr-1" />
      {user.name}
    </Button>
  }
/>
```

The `render` prop replaces the trigger's internal button with the provided element — no nesting.

### Slug Handling

- Client-side: `slugify(title)` auto-generates from title, `SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/` validates inline with a hint below the input field
- Server-side: Zod regex validation with friendly message: `"Slug must be URL-friendly (e.g. my-post-title)"`
- `aria-invalid` and `aria-describedby` for accessibility
- Error text placed above the submit buttons for visibility

### Error Handling

- **tRPC server:** `TRPCError` with codes (`NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`) — not bare `throw new Error()`
- **tRPC client:** `getErrorMessage(err)` in `src/lib/error-utils.ts` — handles `TRPCClientError` (maps known messages from `ERROR_MESSAGES`, returns server message if human-readable) and `ZodError` (joins issues)
- **All pages:** Import and use `getErrorMessage()` — never raw `err.message`

### CI/CD Pipeline

`.github/workflows/ci.yml`:

```
push/PR to main
    │
    ▼
  test job (ubuntu-latest)
    ├─ Postgres 16 service container (healthcheck: pg_isready)
    ├─ Node 22 (npm cache)
    ├─ npm install
    ├─ db:generate → db:migrate (against test DB)
    ├─ lint
    ├─ typecheck
    ├─ test:coverage (80% gate)
    ├─ build
    └─ upload coverage artifact
    │
    └─ deploy-prod (main, Vercel CLI) → Vercel production
```

### Testing Strategy

- **Unit tests** (114 passing): Zod schema validation, auth primitives (hash/verify/JWT), AuthService/PostsService with mocked repositories, repository methods with mock Drizzle chain, tRPC router tests via `createCaller`
- **Coverage gate:** 80% lines/functions/branches/statements on `src/lib/**` and `src/trpc/routers/**`
- **E2E:** Deferred (noted as "Later" in project plan)

### Docker

Multi-stage Dockerfile:
1. **builder** — `node:22-alpine`, `npm install` + `next build` (standalone output)
2. **runner** — `node:22-alpine`, non-root user, Next standalone server, healthcheck
3. **migrate** — `node:22-alpine`, `npm install` + `npx drizzle-kit migrate`

`docker-compose.yml`: Postgres 16 + migrate (one-shot, runs first) + app service with healthcheck dependency (`depends_on: db: condition: service_healthy, migrate: condition: service_completed_successfully`).

---

## Part 7 — Interview Cheat Sheet

### "Why tRPC instead of REST?"

> tRPC gives us end-to-end type safety for the Next.js frontend — no code generation, full autocomplete, type-inferred errors. The client never writes `fetch()`, never parses JSON, never handles error codes manually. The `.queryOptions()` / `.mutationOptions()` API integrates directly with TanStack Query, giving us caching, background refetching, and optimistic updates for free. All input validation is done via Zod schemas built into the router definitions.

### "Why Drizzle over Prisma?"

> Drizzle is SQL-first — the schema is close to raw SQL, queries are explicit, and it generates type-safe SQL without a heavy runtime. It has a smaller bundle size and better performance for serverless/edge. Prisma's query engine is heavier and less transparent. For a new project with explicit SQL needs (complex joins in `findBySlug` with conditional `hasLiked`), Drizzle gives more control.

### "Why Context + TanStack Query instead of Redux?"

> Auth state (user object) changes infrequently — perfect for React Context. Server state (posts, comments) changes often and benefits from caching, background refetching, and optimistic updates — that's what TanStack Query excels at. Redux would add boilerplate for both concerns without meaningful benefit. TanStack Query already handles the "cache + refetch + invalidate" cycle that Redux would require custom middleware for.

### "How does owner authorization work?"

> Two layers: (1) Auth middleware (`protectedProcedure`) ensures the user is logged in. (2) Repository methods (`update`, `delete`) include `WHERE authorId = ctx.user.id` in their SQL — a user trying to update/delete another user's post gets zero rows affected, which the router translates to a `NOT_FOUND` error. This prevents both unauthorized access and information leakage (the attacker doesn't learn whether the post exists or they just lack permission).

### "How does the optimistic like work?"

> When the user clicks Heart, `onMutate` fires immediately: cancel in-flight queries, snapshot the current post data, then optimistically flip `hasLiked` and the like count in the query cache. The UI reflects the change instantly. If the server call succeeds, `onSettled` invalidates the query to refetch real data. If it fails, `onError` restores the snapshot — the Heart snaps back. No flicker, no loading state for the like action.

### "Why httpOnly cookie instead of localStorage for auth?"

> httpOnly cookies are inaccessible to client-side JavaScript — immune to XSS attacks that could steal tokens from localStorage. The cookie is automatically sent with every request via `credentials: "include"`. The cookie is set server-side via `next/headers` `cookies().set()` in a Node runtime route handler — the browser never sees the token value directly.

### "Why Node runtime instead of Edge for API routes?"

> The auth system uses `bcryptjs` (bcrypt hashing) and `jose` (JWT), both CJS packages that rely on Node.js APIs not available in Edge runtime. `serverExternalPackages: ["pg", "bcryptjs"]` in `next.config.ts` explicitly marks these as Node-only. Edge would require replacing bcrypt with a WebAssembly-compatible hasher and jose with an Edge-compatible JWT library.

### "Why `output: 'standalone'` in next.config?"

> Required for Docker deployment. The standalone output bundles only the files Next.js needs to run — no `node_modules` in the container image. The runner stage uses `node:22-alpine` and runs `.next/standalone/server.js` directly. Result: ~90MB image instead of 1GB+ with full `node_modules`.

### "What is the Repository pattern and why use it?"

> Repositories isolate database queries behind interfaces. Services depend on interfaces, not concrete implementations. This means: (1) Unit tests can inject mock repositories (proven in `auth-service.test.ts`), (2) Swapping Drizzle for a different ORM requires changing only the repository implementations, (3) Business logic stays in services, data access stays in repositories — clear separation of concerns.

### "How do lazy singletons work and why are they needed?"

> `let _db = null; function db() { if (!_db) _db = new Pool(...); return _db; }` — the connection is created on first call, reused thereafter. Needed because Turbopack (Next.js 16's bundler) can hit the Temporal Dead Zone when modules have circular import chains (db → schema → db). Deferring instantiation to runtime avoids this.

### "Explain the Zod validation strategy."

> Zod schemas are defined in `src/lib/schemas/index.ts` and used by tRPC routers via `.input(schema)`. Password validation: min 8 chars, 1 uppercase, 1 special char — enforced both in Zod and in the client-side register form (live rules checklist). Slug validation: regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` with friendly error message. Single source of truth for all input validation.

### "How does the error handling work end-to-end?"

> Server: `TRPCError` with specific codes (NOT_FOUND, CONFLICT, UNAUTHORIZED) and human-readable messages. Client: `getErrorMessage()` handles TRPCClientError (maps known strings from `ERROR_MESSAGES`, returns server message if human-readable), ZodError (joins issues), and native Error. All pages use `getErrorMessage()` — never raw `err.message`.

### "What testing patterns are used?"

> 114 unit tests across 10 test files: (1) Zod schemas — valid/invalid inputs, (2) Auth primitives — hash/verify roundtrip, invalid JWT, expired JWT, (3) AuthService/PostsService — mocked repositories injected via constructor, (4) Repository methods — mock Drizzle chain helper, (5) tRPC routers — `appRouter.createCaller(ctx)` for auth and posts. Coverage gate: 80% on `lib/` and `trpc/routers/`. Tests run in `jsdom` environment via Vitest. `auth-service.test.ts` demonstrates the Repository pattern's testability: mock the interface, test business logic in isolation.

### "What's the data model?"

> 4 tables: `users` (UUID PK, email unique, passwordHash), `posts` (UUID PK, authorId FK→users cascade, slug unique, title, content, published), `comments` (UUID PK, postId FK→posts cascade, authorId FK→users, content), `likes` (UUID PK, postId FK→posts cascade, userId FK→users cascade, unique composite on postId+userId). The composite unique on likes enforces one-like-per-user at the database level.

---

## Part 8 — Run & Status

### Local Setup

```bash
# 1. Start Postgres (Docker)
docker-compose up -d db

# 2. Install dependencies
npm install

# 3. Set DATABASE_URL in .env.local
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/blogging_platform"' > .env.local

# 4. Run migrations
npm run db:migrate

# 5. Start dev server
npm run dev
```

### Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` | Production build (standalone output) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | `vitest run` (114 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:coverage` | Vitest with 80% coverage report |
| `npm run db:generate` | Drizzle Kit — generate migrations |
| `npm run db:migrate` | Drizzle Kit — run migrations |
| `npm run db:push` | Drizzle Kit — push schema directly |
| `npm run db:studio` | Drizzle Kit — visual DB browser |

### Current Status

- **Completed:** All features implemented — auth, CRUD, likes, comments, error handling, responsive UI, optimistic like, CI/CD, Docker, tests, Server Components with SSR hydration, Edge middleware for protected routes, route conventions (loading/error/not-found)
- **Verified passing:** typecheck, lint, build, 114 unit tests (10 test files)
- **Needs verification run:** After any local changes, run `npm run typecheck && npm run lint && npm run test && npm run build` to confirm everything compiles
- **Runtime dependency:** Postgres must be running locally (via `docker-compose up -d`) or via Neon for the app to work

---

*Generated from a full codebase read — every file:line reference is accurate as of the latest code state.*
