# PulseAPI

PulseAPI is a full-stack API uptime monitor. Authenticated users can create HTTP `GET` monitors, run checks immediately, let the backend schedule checks automatically, and inspect uptime, latency, history, and recent failures.

The permanent stack is JavaScript throughout:

- Backend: Node.js 20+, Express 5, Prisma ORM, PostgreSQL
- Frontend: React 19, Vite, React Router, Tailwind CSS, Recharts
- Security: bcrypt, JWT access tokens, rotating HttpOnly refresh cookies, Helmet, CORS, rate limiting, and SSRF protection
- Operations: node-cron, Pino structured logs, graceful shutdown
- Testing: Vitest, Supertest, and an isolated PostgreSQL test schema

The project intentionally does not use TypeScript, Next.js, microservices, Redis, queues, WebSockets, or AI features.

## Screenshots

![PulseAPI dashboard](docs/screenshots/dashboard.png)

![Monitor configuration and current health](docs/screenshots/monitor-details.png)

![Response-time chart and check history](docs/screenshots/monitor-history.png)

## Completed scope

- Phase 1: project foundation, environment validation, logging, errors, health, and readiness
- Phase 2: registration, login, access/refresh tokens, rotation, logout, and protected frontend routes
- Phase 3: owned monitor CRUD, pause/resume, filtering, sorting, and limits
- Phase 4: secure manual HTTP checks, persistence, timing, status comparison, and failure classification
- Phase 5: automatic due-monitor scheduler with batching, concurrency limits, overlap protection, and restart recovery
- Phase 6: paginated history, date/result filters, uptime and latency statistics, charts, recent failures, and dashboard summary

Incidents, notifications, and alert delivery are outside the completed MVP scope.

## Architecture

```mermaid
flowchart LR
    Browser["React + Vite browser client"] -->|"JSON API + access token"| Express["Express API"]
    Express --> Auth["Authentication module"]
    Express --> Monitors["Monitor and analytics modules"]
    Scheduler["node-cron scheduler"] --> Checks["Check service"]
    Monitors --> Checks
    Checks --> Guard["DNS validation + SSRF guard"]
    Guard --> Target["Public HTTP/HTTPS endpoint"]
    Auth --> Prisma["Prisma ORM"]
    Monitors --> Prisma
    Checks --> Prisma
    Prisma --> PostgreSQL[(PostgreSQL)]
```

The API remains a single long-running service because the scheduler and API share the same monitor/check domain. Controllers handle HTTP details, services hold business logic, repositories isolate Prisma queries, and Zod schemas validate input.

```text
backend/
|-- prisma/{migrations,schema.prisma}
|-- src/
|   |-- common/{errors,middleware,types,utils}
|   |-- config
|   |-- modules/{auth,checks,dashboard,monitors,system}
|   |-- scheduler
|   |-- security
|   |-- app.js
|   `-- server.js
`-- tests

frontend/
`-- src/
    |-- components/{auth,charts,layout,monitors}
    |-- config
    |-- lib
    |-- pages/{auth,dashboard,monitors}
    `-- styles
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Exact local installation commands

Run these commands from the repository root in PowerShell:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
psql -U postgres -c "CREATE DATABASE pulseapi;"
```

Edit `backend/.env` with the real PostgreSQL username and password. Then generate Prisma Client and apply every committed migration:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:deploy
```

Start the backend and frontend together:

```powershell
npm.cmd run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Liveness: `http://localhost:4000/health`
- Database readiness: `http://localhost:4000/ready`

Production-style local commands:

```powershell
npm.cmd run build
npm.cmd start --workspace backend
npm.cmd run preview --workspace frontend
```

On Windows, stop a running backend before regenerating Prisma Client because the process can hold Prisma's query-engine DLL open.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Local value / rule |
|---|---:|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/pulseapi?schema=public` |
| `JWT_ACCESS_SECRET` | Yes | At least 32 random characters |
| `JWT_REFRESH_SECRET` | Yes | A different value of at least 32 characters |
| `NODE_ENV` | No | `development`, `test`, or `production`; default `development` |
| `PORT` | No | Default `4000` |
| `FRONTEND_ORIGIN` | No | Default `http://localhost:5173`; exact production frontend origin |
| `LOG_LEVEL` | No | Default `info` |
| `ACCESS_TOKEN_TTL` | No | Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | No | Default `7` |
| `BCRYPT_ROUNDS` | No | Default `12` |
| `MAX_MONITORS_PER_USER` | No | Default `20` |
| `SCHEDULER_ENABLED` | No | `true` or `false`; default `true` |
| `SCHEDULER_CRON` | No | Default `* * * * *` |
| `SCHEDULER_BATCH_SIZE` | No | Default `25` |
| `SCHEDULER_CONCURRENCY` | No | Default `5` |

Startup fails with a readable validation error if required values are missing or invalid.

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Only `.env.example` files are committed. Real `.env` files, dependencies, builds, and coverage are ignored.

## Database

Prisma models:

- `User`: UUID identity, normalized unique email, bcrypt password hash
- `RefreshToken`: hashed rotating token, expiry/revocation state, user cascade
- `Monitor`: owned configuration, scheduling fields, current health summary
- `CheckResult`: immutable check outcome, timing, status, size, and classified failure

Committed migrations:

- `20260712124843_phase_2_authentication`
- `20260712132245_phase_3_monitor_management`
- `20260712204727_phase_4_manual_endpoint_checking`

Apply migrations without creating a new development migration:

```powershell
npm.cmd run prisma:deploy
```

## API response envelopes

```json
{ "success": true, "data": {} }
```

```json
{ "success": true, "data": [], "meta": { "page": 1, "limit": 50, "total": 0, "totalPages": 0 } }
```

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Readable message.",
    "details": []
  }
}
```

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Process liveness, independent of PostgreSQL |
| `GET` | `/ready` | PostgreSQL readiness; returns `503` when unavailable |
| `POST` | `/api/v1/auth/register` | Register and start a session |
| `POST` | `/api/v1/auth/login` | Log in |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and issue access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token and clear cookie |
| `GET` | `/api/v1/auth/me` | Return current user |
| `POST` | `/api/v1/monitors` | Create a monitor |
| `GET` | `/api/v1/monitors` | List owned monitors |
| `GET` | `/api/v1/monitors/:monitorId` | Get an owned monitor |
| `PATCH` | `/api/v1/monitors/:monitorId` | Update monitor configuration |
| `DELETE` | `/api/v1/monitors/:monitorId` | Delete monitor and results |
| `POST` | `/api/v1/monitors/:monitorId/pause` | Pause automatic checks |
| `POST` | `/api/v1/monitors/:monitorId/resume` | Resume and make due |
| `POST` | `/api/v1/monitors/:monitorId/check` | Run a secure manual check |
| `GET` | `/api/v1/monitors/:monitorId/checks` | Paginated check history |
| `GET` | `/api/v1/monitors/:monitorId/stats` | Uptime and response-time statistics |
| `GET` | `/api/v1/dashboard/summary` | User-scoped health and recent failures |

All `/api/v1/monitors` and dashboard routes require `Authorization: Bearer <access-token>`. Missing and cross-user monitors return the same `404 MONITOR_NOT_FOUND` response.

History query parameters:

- `page` (default `1`), `limit` (1-100, default `50`)
- `from` and `to` as ISO date/time values
- `result=all|successful|failed`

Statistics supports `range=1h|24h|7d|30d|all`, defaulting to `24h`.

## Endpoint checking and scheduler behavior

Each check:

1. Accepts only HTTP/HTTPS without embedded credentials.
2. Resolves DNS and rejects localhost, metadata, private, loopback, link-local, multicast, and reserved addresses.
3. Pins the outbound connection to a validated DNS address to reduce DNS-rebinding risk.
4. Revalidates every redirect and limits redirects to three.
5. Performs `GET` with the monitor timeout and a 1 MiB response-body cap.
6. Measures elapsed time and compares the status to `expectedStatusCode`.
7. Persists success or failure and atomically updates the monitor summary and `nextCheckAt`.

Failures are classified as `TIMEOUT`, `DNS`, `NETWORK`, `SSL`, `INVALID_STATUS`, `BLOCKED_URL`, or `UNKNOWN`. Technical error details are not exposed to clients.

The scheduler polls every minute by default, selects only active monitors whose `nextCheckAt` is due, limits the batch and concurrent outbound requests, skips an in-flight monitor, and prevents overlapping cycles. It runs one cycle at startup so overdue monitors resume after a restart.

## Testing and verification

The backend suite derives a separate `pulseapi_test` schema from `DATABASE_URL`, applies committed migrations, and verifies real Prisma/PostgreSQL behavior.

```powershell
npm.cmd test
npm.cmd run build
```

Coverage includes foundation, authentication, ownership, monitor CRUD, URL/DNS security, real local HTTP transport, redirect handling, all failure classes, persistence, scheduling, concurrency, restart recovery, pagination, filters, statistics, and dashboard scoping.

Manual smoke test:

1. Run `npm.cmd run dev`.
2. Confirm `/health` and `/ready` return successful JSON envelopes.
3. Register and create a monitor for `https://example.com/`.
4. Click **Run check** and confirm the result is persisted.
5. Wait until the monitor is due and confirm an automatic result appears.
6. Stop and restart the backend with an overdue active monitor; confirm it runs on startup.
7. Temporarily stop PostgreSQL and confirm `/health` remains `200` while `/ready` returns `503`.

## Deployment with Render

`render.yaml` declares PostgreSQL, a long-running Express service, Prisma migration deployment, and the React static site with the required React Router rewrite.

The scheduler requires an always-running backend. Do not use a service that sleeps when inactive.

1. Push this repository to GitHub or GitLab.
2. In Render, choose **New > Blueprint** and select the repository.
3. When prompted, set `FRONTEND_ORIGIN` to the final frontend origin, for example `https://pulseapi-frontend.onrender.com`.
4. Set frontend `VITE_API_BASE_URL` to the final backend API URL, for example `https://pulseapi-backend.onrender.com/api/v1`.
5. Apply the Blueprint. If Render assigns different service slugs, update both values and redeploy.
6. Verify `https://<backend-host>/ready` before registering through the production frontend.
7. Create the stable demo monitor using `https://<backend-host>/health`, expected status `200`, and an interval of at least `60` seconds.
8. Leave the production service running for more than one interval and confirm automatic history entries are created.

Production behavior automatically uses secure refresh cookies. `FRONTEND_ORIGIN` must be the exact HTTPS frontend origin for credentialed CORS.

## Security and operational decisions

- Raw passwords and tokens are neither logged nor stored; refresh tokens are SHA-256 hashes in PostgreSQL.
- Refresh tokens rotate on every refresh and are revoked on logout.
- Monitor ownership is included in repository lookups and mutations.
- Request logging excludes bodies, cookies, authorization headers, and tokens.
- Outbound checks use a separate validated/pinned transport and never trust redirect destinations.
- Check execution has timeout, redirect, response-size, batch, and concurrency limits.
- Prisma disconnects and the scheduler stops on `SIGINT` or `SIGTERM`.
- Rate limiting is process-local, suitable for the current single-backend deployment.

## Known limitations

- Only HTTP `GET` monitors are supported.
- No incidents, email/SMS/webhook alerts, public status pages, or multi-region probes are included.
- The scheduler is intentionally single-service/in-memory; deploy only one backend instance unless distributed job locking is added.
- Uptime represents persisted checks, not a formal SLA calculation.
- TLS termination, DNS names, provider billing, and production secret ownership require deployment-provider configuration.
