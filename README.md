# Blogging Platform

A full-stack, responsive blogging platform built with Next.js 15 (App Router), tRPC v11, Drizzle ORM, PostgreSQL, and TailwindCSS + shadcn/ui.

## Features

- **Authentication**: Custom JWT session with bcrypt (httpOnly cookie, no NextAuth)
- **Blog CRUD**: Create, read, update, delete posts with owner-only enforcement
- **Bonus**: Post likes, comments, categories
- **Responsive**: Mobile-first with shadcn Table↔Card, mobile sheet nav, `max-w-prose` reading
- **Accessible**: Labels, focus-visible, AA contrast, keyboard navigation, aria attributes
- **Design patterns**: Repository (primary), Singleton (DB client), Observer (React Query invalidation)
- **Dockerized**: Multi-stage Dockerfile + docker-compose for portability
- **CI/CD**: GitHub Actions → lint, typecheck, tests, build, Vercel deploy

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| API | tRPC v11 + TanStack React Query |
| Database | PostgreSQL (Neon / docker-compose) via Drizzle ORM |
| Auth | bcryptjs + jose (JWT, httpOnly cookie) |
| UI | TailwindCSS v4 + shadcn/ui (base-ui) |
| State | React Context (auth) + TanStack Query (server) |
| Testing | Vitest + Testing Library + @vitest/coverage-v8 |
| CI/CD | GitHub Actions → Vercel |
| Container | Docker (multi-stage, non-root) |

## Getting Started

```bash
# Install dependencies
npm i

# Set up environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and JWT_SECRET

# Start local Postgres (or use Neon URL directly)
docker compose up -d db

# Generate and run migrations
npm run db:generate && npm run db:migrate

# Start dev server
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm run db:generate` | Generate Drizzle migration |
| `npm run db:migrate` | Run Drizzle migration |
| `npm run db:push` | Push schema directly to DB |
| `npm run test` | Run tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |
| `NEXT_PUBLIC_APP_URL` | Public app URL |

## Architecture

See [`docs/SYSTEM_DESIGN.md`](docs/SYSTEM_DESIGN.md) for the full system design, data flow, dual-surface justification, and design pattern documentation.

## Docker

```bash
# Full containerized stack
docker compose up --build

# Or just the database
docker compose up -d db
```

## Deployment

The app deploys to Vercel via GitHub Actions:
- **Preview**: On every PR
- **Production**: On push to `main`

Required GitHub secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL`.