# System Design — Blogging Platform

## 1. Architecture Overview

```
Browser ──> Edge Middleware (src/middleware.ts)
   │  Verifies JWT on protected routes → redirects to /login if invalid
   ▼
Next.js (App Router)
   │  RSC Server Components prefetch via createTRPCOptionsProxy (src/trpc/server.tsx)
   │  HydrationBoundary dehydrates cache → client components hydrate instantly
   │  Client components use useTRPC() + TanStack Query (mutations, optimistic UI)
   ▼
tRPC handler  app/api/trpc/[trpc]/route.ts   (Node runtime)
         │  createContext: cookies().get('session') → jose.jwtVerify → ctx.user
         │  protectedProcedure middleware for auth
         ▼
   Service layer (auth.service, posts.service)   ← Zod-validated input
         ▼
   Repository layer (posts.repository, users.repository)  ← owner enforcement
         ▼
   Drizzle ORM (lazy singleton db client)
         ▼
   PostgreSQL (Neon / docker-compose)

Route conventions:
   loading.tsx — skeleton during RSC prefetch
   error.tsx   — error boundary with logging + retry
   not-found.tsx — 404 page
```

## 2. Data Flow

1. **Edge middleware**: Verifies JWT cookie on protected routes; redirects to `/login` before the page renders
2. **RSC prefetch**: Server Components use `createTRPCOptionsProxy` to prefetch data into a `QueryClient`; `HydrationBoundary` dehydrates the cache for client consumption
3. **Hydrate**: Client components read from the prefetched TanStack Query cache — no loading flash for initial data
4. **User actions**: Client calls tRPC mutation
5. **Service validates**: Zod input schemas validate at the service boundary
6. **Repository mutates**: Drizzle ORM executes parameterized queries with owner enforcement
7. **Observer**: React Query mutation `onSuccess` invalidates query keys; subscribed components refetch

## 3. Why tRPC?

**tRPC** (`/api/trpc/...`):
- End-to-end type safety for the Next.js client without code generation
- Zero-cost schema sharing between server and client
- Better DX for internal Next.js consumption (autocomplete, type checking, error inference)

All API calls go through tRPC. The service layer handles business logic, the repository layer handles data access, and Zod schemas validate all input.

## 4. Design Patterns

### Repository Pattern (Primary)

**Why**: Isolates Drizzle queries behind interfaces; services depend on interfaces → unit-testable with mock repos, swappable for a different driver.

**Implementation**:
- `IPostsRepository` and `IUsersRepository` define the contracts
- `PostsRepository` and `UsersRepository` implement them with Drizzle
- Services accept repository interfaces as constructor params
- Unit tests inject mock repositories

```typescript
// Service depends on interface, not implementation
export class PostsService {
  constructor(private repo: IPostsRepository = postsRepo()) {}
}
```

### Singleton Pattern

**Why**: The Drizzle `db` instance and repository/service instances should be created once per process for connection-pool reuse.

**Implementation**: Lazy initialization via getter functions (`db()`, `usersRepo()`, `postsService()`) — Node module cache guarantees single instance. Lazy init avoids Turbopack circular-dependency TDZ issues during build.

### Observer Pattern (Bonus)

**Why**: When a mutation succeeds, dependent queries should automatically refetch without manual coordination.

**Implementation**: React Query mutation `onSuccess` callbacks call `queryClient.invalidateQueries()` with tRPC query keys. Subscribed components automatically refetch:

```typescript
// Observer pattern: any useQuery with matching key prefix refetches automatically
const deleteMutation = useMutation(
  trpc.posts.delete.mutationOptions({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trpc.posts.list.queryKey() });
      queryClient.invalidateQueries({ queryKey: trpc.posts.bySlug.queryKey() });
      queryClient.invalidateQueries(trpc.posts.mine.queryOptions());
    },
  })
);
```

## 5. Authentication Flow

1. **Edge middleware** (`src/middleware.ts`): Verifies JWT on protected routes (`/my-posts`, `/posts/new`, `/posts/:slug/edit`) — instant redirect, no client round-trip
2. Register/login runs in **Node runtime** route handler
3. `bcryptjs` hashes (12 rounds) / verifies passwords
4. `jose` signs HS256 JWT (7-day expiry) → `session` httpOnly cookie (secure in prod, sameSite=lax)
5. `createTRPCContext` reads cookie → `jose.jwtVerify` → `ctx.user`
6. Server Components read the cookie to prefetch user data — navbar renders authenticated state on first paint
7. Owner-only enforcement: `WHERE authorId = ctx.user.id` in repository update/delete

## 6. Database Schema

| Table | Key Columns | Indexes |
|-------|-------------|---------|
| `users` | id (uuid PK), email (unique), name, passwordHash | email unique |
| `posts` | id (uuid PK), authorId (FK→users cascade), slug (unique), title, content, published | slug unique, authorId, createdAt desc |
| `comments` | id (uuid PK), postId (FK→posts cascade), authorId (FK→users), content | postId |
| `likes` | id (uuid PK), postId (FK→posts cascade), userId (FK→users cascade) | (postId, userId) unique, postId |

## 7. Testing Strategy

- **Unit tests** (Vitest): `lib/auth` (hash/verify, invalid token, expired token), Zod schemas (valid/invalid), repositories (mock Drizzle)
- **Component tests** (RTL): PostList, Login/Register forms, protected-route guard
- **Integration tests** (Vitest): tRPC `createCaller` against seeded Postgres
- **Coverage**: ≥80% on `lib/`, `trpc/routers/`, `lib/repositories/`, `lib/services/`
- **E2E** (Playwright): Deferred to "Later" per project decision

## 8. CI/CD Pipeline

GitHub Actions (`.github/workflows/ci.yml`):
1. Checkout + setup Node 20 (npm cache)
2. Postgres 16 service container with health check
3. `npm ci` → `db:generate` → `db:migrate` against test DB
4. `lint` → `typecheck` → `test:coverage` (80% gate) → `build`
5. Upload coverage artifact
6. Deploy preview on PR, prod on main (via Vercel action)

## 9. Containerization

Multi-stage Dockerfile:
- **deps**: Install production deps only
- **builder**: Full install + build (standalone output)
- **runner**: `node:20-alpine`, non-root user, Next standalone server, healthcheck

`docker-compose.yml`: PostgreSQL 16 + app service with healthcheck dependency.