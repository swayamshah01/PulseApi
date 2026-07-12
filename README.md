# PulseAPI

PulseAPI is an interview-ready API monitoring dashboard built in deliberately small phases. Phase 3 is complete: authenticated users can configure and manage their own HTTP `GET` monitors through the Express API and React interface.

Actual external endpoint checking is intentionally not implemented yet. New monitor health remains unknown (`Not Checked`) until Phase 4.

## Technology stack

- Backend: Node.js 20+, Express 5, JavaScript ES modules, Prisma ORM, PostgreSQL
- Frontend: React 19, Vite, JavaScript, React Router, Tailwind CSS
- Validation: Zod
- Authentication: bcrypt, JSON Web Tokens, rotating refresh tokens
- Security: Helmet, credential-aware CORS, HttpOnly cookies, route rate limiting
- Logging: Pino JSON logs
- Testing: Vitest, Supertest, and a real isolated PostgreSQL schema

JavaScript with React/Vite is the permanent project stack. The project does not use Next.js, TypeScript, microservices, Redis, queues, WebSockets, or AI features.

## Completed features

### Phase 1: Foundation

- Express and React/Vite applications
- Prisma/PostgreSQL connection
- Environment validation
- Structured request logging
- Central errors and response envelopes
- `/health` and `/ready`

### Phase 2: Authentication

- Registration and login
- Bearer access tokens
- Rotating HttpOnly refresh-token cookie
- Logout and current-user endpoint
- Protected frontend routes

### Phase 3: Monitor management

- Create, list, view, edit, pause, resume, and delete monitors
- Per-user ownership on every database operation
- Maximum 20 monitors per user
- Pagination, filtering, searching, and sorting
- Functional dashboard and monitor-management pages
- Basic URL validation without making external requests

## Repository structure

```text
backend/
|-- prisma/
|   |-- migrations/
|   `-- schema.prisma
|-- src/
|   |-- common/{errors,middleware,types,utils}/
|   |-- config/
|   |-- modules/
|   |   |-- auth/
|   |   |-- monitors/
|   |   `-- system/
|   |-- app.js
|   `-- server.js
`-- tests/

frontend/
`-- src/
    |-- components/{auth,layout,monitors}/
    |-- config/
    |-- lib/
    |-- pages/{auth,dashboard,monitors}/
    `-- styles/
```

Check execution, results, incidents, and the scheduler remain reserved for later phases.

## Prerequisites

- Node.js 20 or newer
- npm 10 or newer
- PostgreSQL 15 or newer

## Installation and local setup

Run from the repository root in PowerShell:

```powershell
npm.cmd install
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Create the PostgreSQL database if necessary:

```powershell
psql -U postgres -c "CREATE DATABASE pulseapi;"
```

Configure `backend/.env`, then run Prisma before starting the development server:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name phase_3_monitor_management
```

Start both applications:

```powershell
npm.cmd run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Liveness: `http://localhost:4000/health`
- Database readiness: `http://localhost:4000/ready`

On Windows, stop the running backend before regenerating Prisma Client because the process holds Prisma's query-engine DLL open.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Example | Purpose |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/pulseapi?schema=public` | PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Yes | 32+ random characters | Signs access tokens |
| `JWT_REFRESH_SECRET` | Yes | Different 32+ character value | Signs refresh tokens |
| `ACCESS_TOKEN_TTL` | No | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | No | `7` | Refresh-token lifetime |
| `BCRYPT_ROUNDS` | No | `12` | Password hashing cost |
| `MAX_MONITORS_PER_USER` | No | `20` | Per-user monitor limit |
| `NODE_ENV` | No | `development` | Runtime mode |
| `PORT` | No | `4000` | Express port |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Allowed browser origin |
| `LOG_LEVEL` | No | `info` | Pino log level |

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

`.env` files, dependencies, builds, and coverage are ignored by Git.

## Prisma models and migrations

### `User`

- UUID primary key
- Unique normalized email and bcrypt password hash
- Relationships to refresh tokens and monitors

### `RefreshToken`

- UUID primary key and user foreign key
- Unique SHA-256 token hash
- Expiration and revocation timestamps

### `Monitor`

- UUID primary key and required user foreign key with cascade deletion
- Name, URL, forced `GET` method, expected status, timeout, and interval
- `ACTIVE` or `PAUSED` status
- Nullable health/status/latency/last-check summary fields
- `nextCheckAt`, consecutive failure count, and timestamps
- Index on `userId`
- Composite index on `status` and `nextCheckAt`

Committed migrations:

- `20260712124843_phase_2_authentication`
- `20260712132245_phase_3_monitor_management`

No `CheckResult` or `Incident` model exists yet.

## API response envelopes

Success:

```json
{ "success": true, "data": {} }
```

Paginated list:

```json
{ "success": true, "data": [], "meta": {} }
```

Error:

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

### System and authentication

| Method | Path | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/health` | Process liveness | None |
| `GET` | `/ready` | PostgreSQL readiness | None |
| `POST` | `/api/v1/auth/register` | Create account and session | None |
| `POST` | `/api/v1/auth/login` | Create session | None |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token | HttpOnly cookie |
| `POST` | `/api/v1/auth/logout` | Revoke session | Optional cookie |
| `GET` | `/api/v1/auth/me` | Current user | Bearer token |

### Monitors

All monitor endpoints require `Authorization: Bearer <access-token>`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/monitors` | Create monitor |
| `GET` | `/api/v1/monitors` | List owned monitors |
| `GET` | `/api/v1/monitors/:monitorId` | Get owned monitor |
| `PATCH` | `/api/v1/monitors/:monitorId` | Update editable configuration |
| `DELETE` | `/api/v1/monitors/:monitorId` | Delete monitor with `204` |
| `POST` | `/api/v1/monitors/:monitorId/pause` | Pause idempotently |
| `POST` | `/api/v1/monitors/:monitorId/resume` | Resume idempotently |

Missing and cross-user monitors both return `404 MONITOR_NOT_FOUND`.

## Monitor validation

- Name: trimmed, 2–100 characters
- URL: absolute HTTP/HTTPS, maximum 2048 characters
- URL fragments are removed before storage
- Embedded URL usernames/passwords are rejected
- Expected status: integer from 100–599, default `200`
- Timeout: integer from 1000–30000 ms, default `5000`
- Interval: integer from 60–86400 seconds, default `300`
- Method is never accepted as configuration and is always stored as `GET`
- New monitors are `ACTIVE`, have unknown health, and receive `nextCheckAt = now`

This phase performs only syntactic URL validation. DNS resolution, private-address rejection, redirect checks, and full SSRF protection must be added before Phase 4 sends any request.

## Pagination, filters, and sorting

`GET /api/v1/monitors` supports:

| Parameter | Values |
|---|---|
| `page` | Integer, default `1` |
| `limit` | 1–100, default `10` |
| `status` | `ACTIVE`, `PAUSED` |
| `health` | `up`, `down`, `unknown` |
| `search` | Case-insensitive name/URL search |
| `sortBy` | `name`, `createdAt`, `updatedAt`, `lastCheckedAt` |
| `sortOrder` | `asc`, `desc` |

Metadata contains `page`, `limit`, `total`, and `totalPages`.

## Authorization behavior

- The authenticated user ID comes only from the verified access token.
- Body, query, and URL-supplied user IDs are never trusted.
- Owned-record queries include both monitor ID and authenticated user ID.
- Update and delete mutations also include both IDs.
- Cross-user access returns the same `404` as a missing monitor.
- Public monitor responses omit `userId`.

## Frontend routes

- `/dashboard`: Phase 3 overview without invented statistics
- `/monitors`: searchable/filterable monitor table and actions
- `/monitors/new`: validated creation form
- `/monitors/:monitorId`: configuration and honest monitoring placeholders
- `/monitors/:monitorId/edit`: permitted settings only

Protected frontend requests attach the access token. On `401`, they attempt refresh-token rotation once; failed refresh clears the local session and redirects to login. Delete actions require browser confirmation.

## Testing

Run:

```powershell
npm.cmd test
```

The setup derives a separate `pulseapi_test` PostgreSQL schema from `DATABASE_URL`, applies committed migrations, and tests real Prisma/database behavior without touching development records.

The Phase 3 coverage includes:

- Creation, authentication, defaults, forced GET, URL normalization, and validation
- The 20-monitor limit
- Strict per-user listing and ownership
- Pagination metadata
- Status, health, search, and sorting filters
- Owned and cross-user retrieval
- Editable and protected update fields
- URL/interval rescheduling timestamps
- Idempotent pause and resume
- Deletion, post-deletion `404`, and cross-user mutation prevention

Build the frontend:

```powershell
npm.cmd run build
```

## Manual Phase 3 verification

1. Run `npm.cmd run dev`.
2. Confirm `/ready` reports `database: connected`.
3. Register or log in through the frontend.
4. Open `/monitors/new` and create an HTTP/HTTPS monitor.
5. Confirm its health is `Not Checked`.
6. View and edit the monitor.
7. Pause it and confirm `nextCheckAt` becomes empty.
8. Resume it and confirm it becomes active without showing check results.
9. Search/filter it from `/monitors`.
10. Delete it and confirm the deletion prompt first.

## Security decisions

- Passwords and tokens are never logged or returned unsafely.
- Refresh tokens are stored only as SHA-256 hashes and rotate atomically.
- Monitor ownership is enforced in repository queries and mutations.
- Protected monitor fields are discarded rather than written.
- Basic URL validation stores configuration only; no outbound request exists yet.
- Helmet, credential-aware CORS, body limits, rate limiting, sanitized errors, and structured logging remain enabled.

## Known limitations

- No external endpoint request is made.
- Monitor health remains unknown until Phase 4.
- No check-result history, uptime calculation, incidents, alerts, or scheduler exists.
- Full SSRF protection must be completed before enabling checks.
- Rate limiting is process-local and intended for the current single-instance phase.
- HTTPS and production secrets remain deployment responsibilities.
