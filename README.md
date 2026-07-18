# PulseAPI

[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/docs/Web/JavaScript)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
![Tests](https://img.shields.io/badge/tests-109%20passing-brightgreen)
![Status](https://img.shields.io/badge/status-MVP%20complete-22c55e)

PulseAPI is a full-stack API uptime monitoring application. Each user creates a **Project** for an application and adds any number of **Endpoints** to it. Endpoints can be checked immediately or automatically on a schedule, while PulseAPI records availability, latency, history, and classified failures.

Repository: [github.com/swayamshah01/PulseApi](https://github.com/swayamshah01/PulseApi)

The permanent stack is JavaScript:

- Backend: Node.js 20+, Express 5, Prisma ORM, PostgreSQL
- Frontend: React 19, Vite, React Router, Tailwind CSS, Recharts
- Security: bcrypt, JWT access tokens, rotating HttpOnly refresh cookies, Helmet, CORS, rate limiting, and SSRF protection
- Operations: node-cron, Pino structured logs, graceful shutdown
- Testing: Vitest, Supertest, and an isolated PostgreSQL test schema

The project intentionally does not use TypeScript, Next.js, microservices, Redis, queues, WebSockets, or AI features.

## Project status

The local MVP is feature-complete. It includes authentication, project and endpoint management, secure manual checks, automatic scheduling, history, statistics, and a dashboard. A Render Blueprint is included, but a public production URL is not claimed until the deployment checklist below has been completed.

Verified on July 18, 2026:

- 109 backend integration tests pass against PostgreSQL
- Frontend production build passes
- Prisma schema is valid and all four migrations are applied
- Existing endpoint history survives the Project migration
- A Project containing multiple real public endpoints was tested in the browser
- Manual and automatic checks returned HTTP 200 and were persisted

## Screenshots

![PulseAPI project portfolio](docs/screenshots/projects.png)

![Project containing multiple API endpoints](docs/screenshots/project-details.png)

![Endpoint health and performance statistics](docs/screenshots/endpoint-details.png)

## Completed scope

- Phase 1: foundation, environment validation, logging, errors, health, and readiness
- Phase 2: registration, login, access/refresh tokens, rotation, logout, and protected routes
- Phase 3: owned endpoint CRUD, pause/resume, filtering, sorting, and limits
- Phase 4: secure manual HTTP checks, persistence, timing, status comparison, and failure classification
- Phase 5: automatic scheduling with batching, concurrency limits, overlap protection, and restart recovery
- Phase 6: paginated history, filters, uptime and latency statistics, charts, failures, and dashboard summary
- Project hierarchy: owned Projects group multiple independently scheduled Endpoints
- Live monitoring UI: visible operational screens refresh every 10 seconds and immediately when the tab regains focus

Incidents, notification delivery, and public status pages are outside the current MVP.

## Architecture

```mermaid
flowchart LR
    Browser["React + Vite client"] -->|"JSON + access token"| Express["Express API"]
    Express --> Auth["Authentication"]
    Express --> Projects["Projects"]
    Projects --> Endpoints["Endpoints"]
    Scheduler["node-cron scheduler"] --> Checks["Check service"]
    Endpoints --> Checks
    Checks --> Guard["DNS validation + SSRF guard"]
    Guard --> Target["Public HTTP/HTTPS endpoint"]
    Auth --> Prisma["Prisma ORM"]
    Projects --> Prisma
    Endpoints --> Prisma
    Checks --> Prisma
    Prisma --> PostgreSQL[(PostgreSQL)]
```

The backend is one long-running service because the scheduler and API share the same endpoint/check domain. Controllers handle HTTP details, services hold business rules, repositories isolate Prisma queries, and Zod schemas validate input.

The internal Prisma table is still named `Monitor` to preserve existing data and migration safety. In the product UI and current API it represents an **Endpoint**. The compatibility route `/api/v1/monitors` remains available, but new clients should use `/api/v1/endpoints`.

```text
backend/
|-- prisma/{migrations,schema.prisma}
|-- src/
|   |-- common/{errors,middleware,types,utils}
|   |-- config
|   |-- modules/{auth,checks,dashboard,monitors,projects,system}
|   |-- scheduler
|   |-- security
|   |-- app.js
|   `-- server.js
`-- tests

frontend/
`-- src/
    |-- components/{auth,charts,layout,monitors,projects}
    |-- config
    |-- lib
    |-- pages/{auth,dashboard,monitors,projects}
    `-- styles
```

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Local installation

Open PowerShell in the repository root:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
psql -U postgres -c "CREATE DATABASE pulseapi;"
```

Edit `backend/.env` with the real PostgreSQL username and password. Then run:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:deploy
npm.cmd run dev
```

Local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Liveness: `http://localhost:4000/health`
- Database readiness: `http://localhost:4000/ready`

Production-style local verification:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd start --workspace backend
```

In a second terminal:

```powershell
npm.cmd run preview --workspace frontend
```

On Windows, stop a running backend before `prisma:generate` if the Prisma query-engine DLL is locked.

Generate two different production secrets by running this command twice:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Local value / rule |
|---|---:|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/pulseapi?schema=public` |
| `JWT_ACCESS_SECRET` | Yes | At least 32 random characters |
| `JWT_REFRESH_SECRET` | Yes | A different value of at least 32 characters |
| `NODE_ENV` | No | `development`, `test`, or `production`; default `development` |
| `PORT` | No | Default `4000` |
| `FRONTEND_ORIGIN` | No | Default `http://localhost:5173`; exact production origin |
| `LOG_LEVEL` | No | Default `info` |
| `ACCESS_TOKEN_TTL` | No | Default `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | No | Default `7` |
| `BCRYPT_ROUNDS` | No | Default `12` |
| `MAX_ENDPOINTS_PER_USER` | No | Default `20` |
| `SCHEDULER_ENABLED` | No | `true` or `false`; default `true` |
| `SCHEDULER_CRON` | No | Default `* * * * *` |
| `SCHEDULER_BATCH_SIZE` | No | Default `25` |
| `SCHEDULER_CONCURRENCY` | No | Default `5` |

Startup fails with a readable validation error if required values are missing or invalid. If upgrading an older local checkout, replace `MAX_MONITORS_PER_USER` with `MAX_ENDPOINTS_PER_USER`.

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Only `.env.example` files are committed. Real secrets, dependencies, builds, and coverage are ignored.

## Database

Prisma models:

- `User`: UUID identity, normalized email, bcrypt password hash
- `RefreshToken`: hashed rotating token with expiry and revocation state
- `Project`: user-owned application grouping with aggregate endpoint health
- `Monitor` (Endpoint): project-owned configuration, schedule, and latest health
- `CheckResult`: immutable outcome, timing, HTTP status, size, and failure class

Committed migrations:

- `20260712124843_phase_2_authentication`
- `20260712132245_phase_3_monitor_management`
- `20260712204727_phase_4_manual_endpoint_checking`
- `20260718120000_phase_7_projects_and_endpoints`

The Project migration creates one `Imported endpoints` Project per existing user and attaches all existing endpoints to it, preserving check history.

Apply committed migrations in local or production environments with:

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
| `GET` | `/health` | Process liveness; independent of PostgreSQL |
| `GET` | `/ready` | PostgreSQL readiness; returns `503` when unavailable |
| `POST` | `/api/v1/auth/register` | Register and start a session |
| `POST` | `/api/v1/auth/login` | Log in |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and issue an access token |
| `POST` | `/api/v1/auth/logout` | Revoke refresh token and clear the cookie |
| `GET` | `/api/v1/auth/me` | Return the authenticated user |
| `POST` | `/api/v1/projects` | Create a project |
| `GET` | `/api/v1/projects` | List owned projects with aggregate health |
| `GET` | `/api/v1/projects/:projectId` | Get an owned project |
| `PATCH` | `/api/v1/projects/:projectId` | Update project metadata |
| `DELETE` | `/api/v1/projects/:projectId` | Delete project, endpoints, and results |
| `POST` | `/api/v1/endpoints` | Add an endpoint to a project |
| `GET` | `/api/v1/endpoints` | List owned endpoints; filter with `projectId` |
| `GET` | `/api/v1/endpoints/:endpointId` | Get an owned endpoint |
| `PATCH` | `/api/v1/endpoints/:endpointId` | Update or move an endpoint |
| `DELETE` | `/api/v1/endpoints/:endpointId` | Delete an endpoint and its results |
| `POST` | `/api/v1/endpoints/:endpointId/pause` | Pause automatic checks |
| `POST` | `/api/v1/endpoints/:endpointId/resume` | Resume and make due |
| `POST` | `/api/v1/endpoints/:endpointId/check` | Run a secure manual check |
| `GET` | `/api/v1/endpoints/:endpointId/checks` | Paginated check history |
| `GET` | `/api/v1/endpoints/:endpointId/stats` | Uptime and latency statistics |
| `GET` | `/api/v1/dashboard/summary` | User-scoped summary and recent failures |

Project, endpoint, and dashboard routes require `Authorization: Bearer <access-token>`. Ownership is enforced in database queries, so another user's IDs receive the same not-found response as missing records.

### Minimal API example

Register and save `data.accessToken`:

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo User","email":"demo@example.com","password":"StrongPassword123!"}'
```

Create a Project:

```bash
curl -X POST http://localhost:4000/api/v1/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"name":"Storefront","description":"Customer-facing APIs"}'
```

Add an Endpoint using the returned Project ID:

```bash
curl -X POST http://localhost:4000/api/v1/endpoints \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access-token>" \
  -d '{"projectId":"<project-id>","name":"Products API","url":"https://example.com/","expectedStatusCode":200,"timeoutMs":5000,"intervalSeconds":300}'
```

Run it immediately:

```bash
curl -X POST http://localhost:4000/api/v1/endpoints/<endpoint-id>/check \
  -H "Authorization: Bearer <access-token>"
```

## Endpoint checking and scheduler behavior

Each endpoint check:

1. Accepts only HTTP/HTTPS URLs without embedded credentials.
2. Resolves DNS and rejects localhost, metadata, private, loopback, link-local, multicast, and reserved addresses.
3. Pins the connection to a validated DNS address to reduce DNS-rebinding risk.
4. Revalidates each redirect and allows at most three redirects.
5. Performs `GET` with the endpoint timeout and a 1 MiB response-body cap.
6. Measures elapsed time and compares the response to `expectedStatusCode`.
7. Saves success or failure and atomically updates endpoint health and `nextCheckAt`.

Failures are classified as `TIMEOUT`, `DNS`, `NETWORK`, `SSL`, `INVALID_STATUS`, `BLOCKED_URL`, or `UNKNOWN`. Internal technical details are not returned to clients.

The scheduler polls every minute by default, selects active endpoints whose `nextCheckAt` is due, limits batch size and concurrency, skips in-flight endpoints, and prevents overlapping cycles. A cycle runs at startup so overdue checks resume after a restart.

The dashboard, project portfolio, project details, and endpoint analytics request fresh data every 10 seconds while visible. Hidden tabs do not generate background traffic; returning to the tab triggers an immediate refresh. API GET requests use `no-store` so browser caching cannot leave monitoring data stale.

## Testing and verification

The backend suite derives a separate PostgreSQL schema named `pulseapi_test` from `DATABASE_URL`, applies committed migrations, and tests real Prisma behavior.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run prisma:validate
npm.cmd run prisma:status
```

| Check | Verified result |
|---|---|
| Backend integration suite | 8 files, 109 tests passed |
| Project ownership and cascade behavior | Passed |
| Multiple endpoints in one project | Passed |
| Legacy data migration and API alias | Passed |
| Frontend production build | Passed |
| Prisma validation and migration status | Passed |
| Manual public endpoint check | HTTP 200 persisted |
| Automatic scheduled check | HTTP 200 persisted |

Manual smoke test:

1. Run `npm.cmd run dev`.
2. Confirm `/health` and `/ready` return successful JSON envelopes.
3. Register, create one Project, and add two public Endpoints.
4. Run both checks and confirm their independent results and Project aggregate health.
5. Wait until an endpoint is due and confirm an automatic history row appears.
6. Stop and restart the backend with an overdue endpoint; confirm it runs on startup.
7. Temporarily stop PostgreSQL and confirm `/health` stays `200` while `/ready` returns `503`.

## Production deployment with Render

`render.yaml` declares PostgreSQL, a long-running Express service, migration deployment, and the React static site with a React Router rewrite.

The scheduler requires an always-running backend. Do not use a service that sleeps when inactive.

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint** and select the repository.
3. Set `FRONTEND_ORIGIN` to the final HTTPS frontend origin.
4. Set frontend `VITE_API_BASE_URL` to `https://<backend-host>/api/v1`.
5. Apply the Blueprint and confirm the migration command succeeds.
6. Verify `https://<backend-host>/ready`.
7. Register through the deployed frontend and create a demo Project.
8. Add two stable public Endpoints, run manual checks, and leave the service active for more than one interval.
9. Confirm automatic results appear, then add the final URLs and verification date to this README.

Production refresh cookies use `Secure`. `FRONTEND_ORIGIN` must exactly match the HTTPS frontend origin for credentialed CORS.

### Production launch checklist

- [ ] Repository pushed with a clean worktree and passing tests
- [ ] PostgreSQL provisioned with backups suitable for the selected tier
- [ ] JWT secrets generated independently
- [ ] `FRONTEND_ORIGIN` and `VITE_API_BASE_URL` set to final HTTPS URLs
- [ ] Prisma migrations completed during deployment
- [ ] `/health` and `/ready` verified
- [ ] Registration, login, refresh rotation, logout, and CORS verified
- [ ] Project creation and multiple Endpoint creation verified
- [ ] Manual and scheduled checks verified against stable public targets
- [ ] Backend configured as one always-running instance
- [ ] Logs checked for accidental credentials, cookies, or request bodies
- [ ] Production URLs and verification date added above

## Security and operational decisions

- Passwords and raw tokens are neither logged nor stored; refresh tokens are SHA-256 hashes.
- Refresh tokens rotate after each refresh and are revoked on logout.
- Project and endpoint ownership is included in repository lookups and mutations.
- Request logs exclude bodies, cookies, authorization headers, and tokens.
- Outbound requests use validated and pinned transport and revalidate redirects.
- Timeouts, redirect limits, body-size limits, scheduler batching, and concurrency bound resource usage.
- Prisma disconnects and the scheduler stops on `SIGINT` and `SIGTERM`.
- Rate limiting is process-local and is suitable for the current single-backend architecture.

## Known limitations

- Only HTTP `GET` endpoints are supported.
- Deleting a Project intentionally deletes all its Endpoints and check history after confirmation.
- There are no incidents, email/SMS/webhook alerts, public status pages, or multi-region probes.
- The scheduler is single-service/in-memory; run one backend instance unless distributed locking is added.
- Uptime is calculated from persisted checks and is not a formal SLA.
- Production provider accounts, DNS, billing, backups, and secret ownership require manual configuration.
