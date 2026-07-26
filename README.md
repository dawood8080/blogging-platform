# Avertra Blogging Platform

A full-stack blogging platform built with Next.js 16 (App Router, React 19), tRPC v11, Drizzle ORM, PostgreSQL, TanStack Query, and Tailwind CSS v4 + shadcn/ui v4. Includes user authentication (JWT via bcryptjs + jose), blog CRUD, likes, comments, optimistic UI, SSR hydration, Edge middleware, CI/CD (GitHub Actions), and Docker.

## Features

- **Authentication** — custom JWT session with bcryptjs + jose (httpOnly cookie, no NextAuth)
- **Blog CRUD** — create, read, update, delete posts with owner-only enforcement
- **Bonus** — post likes (toggle, optimistic UI with rollback), comments
- **SSR Hydration** — all data pages are Server Components that prefetch via `createTRPCOptionsProxy` + `HydrationBoundary`; client components hydrate instantly
- **Edge Middleware** — JWT verification on protected routes before page renders
- **Responsive** — mobile-first with shadcn/ui, mobile Sheet nav, `max-w-4xl` centered layout
- **Design Patterns** — Repository (interfaces + mock injection), Singleton (lazy getters), Observer (TanStack Query invalidation)
- **Testing** — 114 unit tests across 10 files; 80% coverage gate on `lib/` + `trpc/`
- **CI/CD** — GitHub Actions: lint → typecheck → test:coverage → build → Vercel deploy
- **Docker** — multi-stage Dockerfile + docker-compose with one-shot migrate service

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| API | tRPC v11 + TanStack React Query |
| Database | PostgreSQL (Neon / docker-compose) via Drizzle ORM |
| Auth | bcryptjs + jose (HS256 JWT, httpOnly cookie) |
| UI | Tailwind CSS v4 + shadcn/ui v4 (base-ui) |
| State | React Context (auth) + TanStack Query (server state) |
| Testing | Vitest + @testing-library/react + @vitest/coverage-v8 |
| CI/CD | GitHub Actions → Vercel (CLI) |
| Container | Docker (multi-stage, non-root) |

---

## Table of Contents

1. [Task Requirements → Implementation Map](#task-requirements--implementation-map)
2. [What Was Built](#what-was-built)
3. [Folder Structure](#folder-structure)
4. [Architecture & API Layers](#architecture--api-layers)
5. [Design Patterns](#design-patterns)
6. [Authentication](#authentication)
7. [TanStack Query & Optimistic UI](#tanstack-query--optimistic-ui)
8. [Cross-Cutting Concerns](#cross-cutting-concerns)
9. [Testing & Coverage](#testing--coverage)
10. [CI/CD Pipeline](#cicd-pipeline)
11. [Docker](#docker)
12. [Local Setup & Scripts](#local-setup--scripts)
13. [Environment Variables](#environment-variables)
14. [System Design (full doc)](#system-design)
15. [Project Journey (full walkthrough)](#project-journey)

---

## Task Requirements → Implementation Map

| Requirement | Implementation |
|---|---|
| React + Next.js frontend | Next.js 16 App Router, React 19 |
| User auth (register + login) | bcryptjs password hashing + jose HS256 JWT in httpOnly cookie; tRPC `authRouter`; `AuthContext` (Context API) |
| Context API for state | `AuthContext` — user state, login/register/logout actions, pending flags |
| Post CRUD (list, detail, create, edit, delete) | tRPC `postsRouter` with owner enforcement (`WHERE authorId = ctx.user.id`) |
| Backend API | tRPC `/api/trpc` — end-to-end type-safe, Zod-validated, no code-gen |
| Validation + error handling | Zod schemas in `src/lib/schemas/`, `TRPCError` with codes, `getErrorMessage()` |
| Design pattern: Repository | `IPostsRepository` / `IUsersRepository` interfaces — services depend on interfaces, tests inject mocks |
| Design pattern: Singleton | Lazy getter singletons for `db()`, `usersRepo()`, `postsRepo()`, `authService()`, `postsService()` |
| Design pattern: Observer | TanStack Query mutation `onSuccess` → `queryClient.invalidateQueries()` triggers automatic refetch |
| CI/CD | GitHub Actions — lint → typecheck → test:coverage → build → Vercel prod on `main` |
| Unit tests | 114 passing across 10 files; 80% coverage gate on `lib/` + `trpc/` |
| Responsive | Tailwind CSS v4 + shadcn/ui, mobile Sheet nav, `max-w-4xl` centered |
| Docker | Multi-stage Dockerfile + docker-compose with one-shot migrate service |
| System design doc | `docs/SYSTEM_DESIGN.md` |
| Bonus — comments + likes | `posts.comments` query, `posts.createComment` mutation, `posts.like` toggle (optimistic UI with rollback) |

---

## What Was Built

**1. Scaffold + config**
Next.js 16 with `output: "standalone"` for Docker, `serverExternalPackages: ["pg","bcryptjs"]` to keep native/CJS packages in `node_modules` for Node runtime (prevents Turbopack TDZ).

**2. Database schema**
4 tables defined with Drizzle ORM: `users` (UUID PK, email unique), `posts` (slug unique, authorId FK cascade, published boolean, createdAt index), `comments` (postId FK cascade, authorId FK cascade), `likes` (composite unique on postId+userId — enforces one-like-per-user at DB level).

**3. Repository + service layers**
Interface-based contracts (`IPostsRepository`, `IUsersRepository`) with Drizzle implementations. Services accept interfaces as constructor params — unit tests inject mock repositories without a database. Lazy singleton getters avoid Turbopack circular-dep TDZ.

**4. tRPC API**
`createTRPCContext` reads cookie → `jose.jwtVerify` → `ctx.user`. Public and protected procedures. Full CRUD: `list` (paginated), `bySlug` (with `hasLiked` + counts), `mine`, `create`, `update`, `delete`, `like` (toggle), `createComment`, `comments`. Mutation `create` catches unique-constraint violations → `CONFLICT`.

**5. Frontend (SSR)**
Every data page is a Server Component that prefetches via `createTRPCOptionsProxy` + `HydrationBoundary`. Client components handle interactivity (forms, mutations, optimistic updates). Edge middleware guards protected routes. Protected RSC pages check cookies server-side → `redirect("/login")` if not authed.

---

## Folder Structure

```
src/
├── app/              # Next.js App Router: RSC pages + co-located client components
│   ├── _components/  # app-level client components (posts-list)
│   ├── api/trpc/     # tRPC HTTP route handler (Node runtime)
│   ├── posts/        # post detail + new + edit (RSC wrapper + client child)
│   └── my-posts/     # my posts (RSC wrapper + client child)
├── components/       # shadcn/ui primitives + layout/navbar + auth/require-auth
├── context/          # AuthContext (user state via Context API)
├── db/               # Drizzle schema, lazy singleton client, migrations
├── lib/              # auth.ts, error-utils.ts, repositories/, services/, schemas/
├── trpc/             # server.tsx (SSR proxy), client.ts, init.ts, routers/
├── middleware.ts     # Edge JWT verification on protected routes
docs/                 # SYSTEM_DESIGN.md, PROJECT_JOURNEY.md
tests/                # unit/ (lib tests) + trpc/ (router tests)
```

---

## Architecture & API Layers

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
│  │  Client Components (post-detail.tsx, posts-list.tsx...)  │ │
│  │  useTRPC() + TanStack Query (hydrated from server cache)│ │
│  │  AuthContext (login/register/logout via tRPC mutations)  │ │
│  └───────────────────────┬─────────────────────────────────┘ │
│                           │ fetch (credentials: include)       │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                  SERVICE LAYER                           │  │
│  │  AuthService: register/login/getMe                      │  │
│  │  PostsService: CRUD + toggleLike + createComment         │  │
│  │  (validates input via Zod schemas, orchestrates logic)  │  │
│  └───────────────────────┬─────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │               REPOSITORY LAYER                           │  │
│  │  IUsersRepository → UsersRepository                      │  │
│  │  IPostsRepository → PostsRepository                      │  │
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

### Call Sequence: Register

```
Browser                    tRPC Handler              AuthService         UsersRepository      PostgreSQL
  │                            │                         │                     │                  │
  │  POST /api/trpc/auth.register│                       │                     │                  │
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

### Call Sequence: Optimistic Like

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

---

## Design Patterns

### Repository Pattern

**What**: `IPostsRepository` and `IUsersRepository` define data-access contracts. `PostsRepository` and `UsersRepository` implement them with Drizzle ORM. Services depend on interfaces, not concrete classes.

**Why**: Unit tests inject mock repositories without a database (`auth-service.test.ts`, `posts-service.test.ts` prove this). Swapping Drizzle for a different ORM requires changing only the repository implementations. Business logic stays in services, data access stays in repositories.

```typescript
export class PostsService {
  constructor(private repo: IPostsRepository = postsRepo()) {}
}
```

### Singleton Pattern

**What**: Lazy getter functions for `db()`, `usersRepo()`, `postsRepo()`, `authService()`, `postsService()` — created on first call, reused thereafter.

**Why**: Turbopack's tree-shaking causes circular dependencies to hit the Temporal Dead Zone (TDZ) if modules are eagerly imported at the top level. Using `let _x = null; function x() { if (!_x) _x = new X(); return _x; }` defers instantiation to runtime, avoiding TDZ entirely. Also reuses the database connection pool.

```typescript
let _db: NodePgDatabase<typeof schema> | null = null;
export function db(): NodePgDatabase<typeof schema> {
  if (!_db) {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
```

### Observer Pattern

**What**: Every mutation's `onSuccess`/`onSettled` calls `queryClient.invalidateQueries(queryKey)`. TanStack Query automatically re-runs associated `useQuery` hooks that share that key — components refetch without manual coordination.

**Why**: When a post is deleted or a like is toggled, every component that displays post data (home list, detail page, my-posts) updates automatically. No event bus, no manual prop drilling, no stale data.

```typescript
const deleteMutation = useMutation(
  trpc.posts.delete.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() });
      queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
    },
  })
);
```

---

## Authentication

### What's Used

- **bcryptjs** — password hashing (12 rounds), imported via `createRequire(import.meta.url)` to avoid Turbopack TDZ with CJS packages
- **jose** — HS256 JWT signing/verification (7-day expiry), same `createRequire` pattern

### Cookie Flow

- Session is a JWT stored in an httpOnly cookie named `session` (`sameSite: "lax"`, `secure` in production)
- Cookie is set server-side via `next/headers` `cookies().set()` — the browser never sees the token value directly (XSS-safe)
- The tRPC client uses `credentials: "include"` in its fetch to send the cookie with every request
- `createTRPCContext` verifies the JWT on every request — `ctx.user` is populated if the cookie is valid

### Edge Middleware (`src/middleware.ts`)

Runs before the page renders on protected routes (`/my-posts`, `/posts/new`, `/posts/:slug/edit`). Uses `jose.jwtVerify` directly (Edge-safe — no Node.js APIs). Instant redirect to `/login` on missing/invalid token. No client round-trip.

### Server-Side Auth in RSC

Protected pages check the session cookie server-side: `cookies()` → `verifyToken()` → `redirect("/login")` if no user. The navbar renders authenticated state on first paint — no loading flash.

### tRPC Context

```typescript
export async function createTRPCContext(): Promise<TRPCContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const user = token ? await verifyToken(token) : null;
  return { user, setSessionCookie, clearSessionCookie };
}
```

`protectedProcedure` middleware throws `UNAUTHORIZED` if `ctx.user` is missing.

### Owner Enforcement

Repository `update`/`delete` methods include `WHERE authorId = ctx.user.id` in their SQL. A user trying to update/delete another user's post gets zero rows affected, which the router translates to `NOT_FOUND`. This prevents both unauthorized access and information leakage.

---

## TanStack Query & Optimistic UI

### QueryClient Configuration

Shared `makeQueryClient()` factory (used by both server prefetch and browser provider):

```typescript
new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // data fresh for 5 minutes
      refetchOnWindowFocus: false,   // no refetch on tab switch
    },
  },
})
```

### Observer Pattern in Practice

Every mutation's `onSuccess`/`onSettled` calls `queryClient.invalidateQueries(queryKey)`. TanStack Query automatically re-runs the associated `useQuery` hooks — components refetch without manual coordination.

### Optimistic Update Cycle

Used in the post detail page like button:

1. **Cancel** in-flight queries: `queryClient.cancelQueries(queryOptions)`
2. **Snapshot** previous data: `queryClient.getQueryData(queryOptions.queryKey)`
3. **Optimistic write**: `queryClient.setQueryData(queryKey, updater)` — UI reflects change instantly
4. **Return snapshot**: pass as `context` to error handler
5. **On error**: `queryClient.setQueryData(key, context.previousPost)` — restore snapshot
6. **On settled**: `queryClient.invalidateQueries(queryOptions)` — refetch real server data

---

## Cross-Cutting Concerns

### Slug Handling

- Client: `slugify(title)` auto-generates from title, `SLUG_PATTERN` validates inline with a hint below the input field
- Server: Zod regex validation with friendly message: `"Slug must be URL-friendly (e.g. my-post-title)"`
- Accessibility: `aria-invalid` and `aria-describedby` for the slug hint

### Error Handling

- **Server**: `TRPCError` with specific codes (`NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`, `FORBIDDEN`) and human-readable messages
- **Client**: `getErrorMessage()` in `src/lib/error-utils.ts` — handles `TRPCClientError` (maps known strings from `ERROR_MESSAGES`, returns server message if human-readable), `ZodError` (joins issues), and native `Error`
- **All pages**: Import and use `getErrorMessage()` — never raw `err.message`

### Lazy Singletons / Turbopack TDZ

Turbopack (Next.js 16's bundler) resolves the module graph at build time. When modules circularly depend on each other, the module evaluation can hit the Temporal Dead Zone — variables are in scope but not yet initialized.

**Solution**: Lazy initialization via getter functions. Applied to: `db()`, `usersRepo()`, `postsRepo()`, `authService()`, `postsService()`.

### shadcn v4 `render` Prop

shadcn v4 uses `@base-ui/react` (not Radix). Trigger components (like `DropdownMenuTrigger`, `SheetTrigger`) render their own `<button>` internally. Wrapping `<Button>` as a child causes nested `<button>` elements — React hydration error.

**Correct pattern**: Use `render={<Button/>}` to replace the trigger's internal button with the provided element.

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

---

## Testing & Coverage

**114 passing tests** across 10 files (Vitest + jsdom environment):

| Layer | Test file | Tests |
|---|---|---|
| Zod schemas | `tests/unit/schemas.test.ts` | Valid/invalid inputs |
| Auth primitives | `tests/unit/auth.test.ts` | Hash/verify roundtrip, invalid JWT, expired JWT |
| Auth service | `tests/unit/auth-service.test.ts` | Mock `IUsersRepository` — register, login, getMe |
| Posts service | `tests/unit/posts-service.test.ts` | Mock `IPostsRepository` — CRUD, likes, comments |
| Error utils | `tests/unit/error-utils.test.ts` | TRPCClientError, ZodError, native Error, known messages |
| Lazy singletons | `tests/unit/lazy-singletons.test.ts` | `db()`, `usersRepo()`, `postsRepo()` are singletons |
| Users repo | `tests/unit/users-repository.test.ts` | Mock Drizzle chain — findByEmail, findById, create |
| Posts repo | `tests/unit/posts-repository.test.ts` | Mock Drizzle chain — findPublished, findBySlug, create, update, delete, toggleLike |
| Auth router | `tests/trpc/auth-router.test.ts` | `appRouter.createCaller(ctx)` — me, register, login, logout |
| Posts router | `tests/trpc/posts-router.test.ts` | `appRouter.createCaller(ctx)` — list, bySlug, create, update, delete, like, comments |

**Coverage gate**: 80% lines/functions/branches/statements on `src/lib/**` + `src/trpc/**`.

---

## CI/CD Pipeline

```
push/PR to main
    │
    ▼
  test job (ubuntu-latest)
    ├─ Postgres 16 service container (healthcheck: pg_isready)
    ├─ Node 22
    ├─ npm install
    ├─ db:generate → db:migrate (against test DB)
    ├─ lint
    ├─ typecheck
    ├─ test:coverage (80% gate)
    ├─ build
    └─ upload coverage artifact
    ▼ (main only)
  deploy-prod → vercel deploy --prod --yes (Vercel CLI)
```

**Required GitHub secrets**:

| Secret | Description |
|---|---|
| `VERCEL_TOKEN` | Vercel deployment token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
| `DATABASE_URL` | Production PostgreSQL connection string |
| `JWT_SECRET` | Production JWT signing secret (min 32 chars) |

Workflow file: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

---

## Docker

Multi-stage Dockerfile:

| Stage | Base | Purpose |
|---|---|---|
| **builder** | `node:22-alpine` | `npm install` + `next build` (standalone output) |
| **runner** | `node:22-alpine` | Non-root user, Next standalone server, healthcheck |
| **migrate** | `node:22-alpine` | One-shot `npx drizzle-kit migrate` |

`docker-compose.yml` — 3 services:
- **db**: PostgreSQL 16 with healthcheck
- **migrate**: runs first (one-shot, `restart: "no"`), depends on db healthy
- **app**: depends on migrate `service_completed_successfully`

```bash
# Full containerized stack
docker compose up --build

# Or just the database
docker compose up -d db
```

---

## Local Setup & Scripts

```bash
# 1. Start Postgres (Docker)
docker compose up -d db

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and JWT_SECRET

# 4. Run migrations
npm run db:generate && npm run db:migrate

# 5. Start dev server
npm run dev
```

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Turbopack) |
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

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

---

## System Design

For the full system-design document — architecture diagram, data flow, design patterns, authentication flow, testing strategy, CI/CD, and containerization — see **[docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)**.

---

## Project Journey

For the deep file-by-file walkthrough, every API layer, tRPC v11 setup guide, call sequences, and per-file purpose — see **[docs/PROJECT_JOURNEY.md](docs/PROJECT_JOURNEY.md)**.
