# PulseAPI

PulseAPI is an API monitoring dashboard. This repository currently contains only **Phase 1: Project Foundation**: a React/Vite frontend, an Express backend, PostgreSQL connectivity through Prisma, environment validation, structured request logging, centralized errors, and liveness/readiness endpoints.

Authentication, monitor management, outbound API checking, scheduling, incidents, and dashboard data are intentionally not implemented yet.

## Technology stack

- Backend: Node.js 20+, Express 5, JavaScript (ES modules), Prisma ORM, PostgreSQL
- Frontend: React 19, Vite, JavaScript, Tailwind CSS
- Validation: Zod
- Logging: Pino JSON logs
- Tests: Vitest and Supertest

## Repository structure

```text
.
├── backend/
│   ├── prisma/{migrations,schema.prisma}
│   ├── src/
│   │   ├── common/{errors,middleware,types,utils}/
│   │   ├── config/
│   │   ├── modules/{auth,checks,dashboard,incidents,monitors,system}/
│   │   ├── scheduler/
│   │   ├── security/
│   │   ├── app.js
│   │   └── server.js
│   └── tests/
└── frontend/
    └── src/
        ├── components/{charts,dashboard,forms,monitors,ui}/
        ├── config/
        ├── hooks/
        ├── lib/
        ├── pages/{auth,dashboard,incidents,monitors}/
        ├── styles/
        └── types/
```

The empty domain folders preserve the specification's intended modular boundaries without implementing later phases. The frontend structure is the Vite/React JavaScript equivalent of the document's Next.js/TypeScript structure.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Exact local setup commands

Run these commands in PowerShell from the repository root:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Create the PostgreSQL database (run this only if it does not already exist):

```powershell
psql -U postgres -c "CREATE DATABASE pulseapi;"
```

Update `backend/.env` if your PostgreSQL username, password, host, port, or database name differs. Then generate the Prisma client and apply the current schema state:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name phase_1_foundation
```

Because Phase 1 intentionally has no domain models, Prisma may report that the database is already in sync and create no SQL migration. Migrations begin when the first phase-owned models are added.

Start both applications:

```powershell
npm.cmd run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Liveness: `http://localhost:4000/health`
- Readiness: `http://localhost:4000/ready`

To run the applications separately:

```powershell
npm.cmd run dev --workspace backend
npm.cmd run dev --workspace frontend
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Example | Purpose |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:postgres@localhost:5432/pulseapi?schema=public` | PostgreSQL connection used by Prisma |
| `NODE_ENV` | No | `development` | Runtime mode; defaults to `development` |
| `PORT` | No | `4000` | Express port; defaults to `4000` |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin; defaults to the Vite dev server |
| `LOG_LEVEL` | No | `info` | Pino log level; defaults to `info` |

The backend validates these values at startup and exits immediately with a concise error if validation fails. Phase 2 secrets such as JWT keys are not required because authentication is not implemented.

### Frontend (`frontend/.env`)

| Variable | Required | Example | Purpose |
|---|---:|---|---|
| `VITE_API_BASE_URL` | Yes | `http://localhost:4000/api/v1` | Base URL reserved for future versioned API calls |

Vite exposes only variables prefixed with `VITE_`. The frontend validates this value when it starts or builds.

## API endpoints

All responses follow the specification's JSON envelope.

| Method | Path | Purpose | Database query |
|---|---|---|---:|
| `GET` | `/health` | Confirms the Express process is alive | No |
| `GET` | `/ready` | Confirms PostgreSQL is reachable | Yes, lightweight `SELECT 1` through Prisma |

Success responses use `{ "success": true, "data": {} }`. Errors use `{ "success": false, "error": { "code": "...", "message": "...", "details": [] } }`.

## Tests

The backend tests inject a small database substitute, so they are deterministic and do not need a running PostgreSQL server.

```powershell
npm.cmd test
```

The suite covers:

- `/health` response, ISO timestamp, request ID, and lack of a database query
- `/ready` success when the database responds
- `/ready` standard `503` envelope when the database is unavailable
- Standard `404` error handling for unknown routes

Build the frontend after creating its `.env` file:

```powershell
npm.cmd run build
```

## Logging and errors

Each completed request emits one JSON log containing request ID, method, route, status code, duration, and authenticated user ID when a later phase supplies one. The logger never serializes request headers, cookies, tokens, or request bodies.

`AppError` represents expected operational failures. The final Express error middleware converts all failures to the standard envelope, logs internal diagnostics, and never sends stack traces or database errors to clients.

## Prisma and database scope

Prisma is configured for PostgreSQL and `/ready` verifies the connection through the Prisma client. The schema intentionally contains no domain models in Phase 1. User/authentication models belong to Phase 2; monitor models and related checking data belong to later phases.

## Known limitations and manual configuration

- A local or hosted PostgreSQL database and a correct `DATABASE_URL` must be supplied manually.
- The initial migration command requires PostgreSQL to be running.
- The frontend is a foundation screen only; product pages and API integration are later-phase work.
- This phase contains no authentication, monitor CRUD, outbound checks, scheduler, Redis, queues, WebSockets, or AI features.
