# PulseAPI

PulseAPI is an interview-ready API monitoring dashboard built in deliberately small phases. Phase 2 is complete: the project now includes the Phase 1 foundation plus registration, login, access-token authentication, refresh-token rotation, logout, current-user lookup, and a basic protected React interface.

Monitor management, outbound API checking, scheduling, incidents, and dashboard statistics are intentionally not implemented yet.

## Technology stack

- Backend: Node.js 20+, Express 5, JavaScript ES modules, Prisma ORM, PostgreSQL
- Frontend: React 19, Vite, JavaScript, React Router, Tailwind CSS
- Validation: Zod
- Authentication: bcrypt passwords, JSON Web Tokens, SHA-256 refresh-token storage
- Security: Helmet, credential-aware CORS, HttpOnly cookies, route rate limiting
- Logging: Pino JSON logs
- Testing: Vitest, Supertest, and a real isolated PostgreSQL schema

JavaScript with React/Vite is the permanent stack for this project. The project does not use Next.js, TypeScript, microservices, Redis, queues, WebSockets, or AI features.

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
|   |   `-- system/
|   |-- app.js
|   `-- server.js
`-- tests/

frontend/
`-- src/
    |-- components/auth/
    |-- config/
    |-- lib/
    |-- pages/{auth,dashboard}/
    `-- styles/
```

The empty monitor, checking, incident, scheduler, and security-domain folders reserve the specification's later-phase boundaries without implementing those features early.

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

Create the database if it does not exist:

```powershell
psql -U postgres -c "CREATE DATABASE pulseapi;"
```

Configure `backend/.env`, then generate Prisma Client and apply migrations:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate -- --name phase_2_authentication
```

If the migration has already been applied, Prisma reports that the database is in sync.

Start the frontend and backend:

```powershell
npm.cmd run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Liveness: `http://localhost:4000/health`
- Database readiness: `http://localhost:4000/ready`

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Example | Purpose |
|---|---:|---|---|
| `DATABASE_URL` | Yes | `postgresql://postgres:password@localhost:5432/pulseapi?schema=public` | Prisma PostgreSQL connection |
| `JWT_ACCESS_SECRET` | Yes | At least 32 random characters | Signs access tokens |
| `JWT_REFRESH_SECRET` | Yes | A different 32+ character value | Signs refresh tokens |
| `ACCESS_TOKEN_TTL` | No | `15m` | Access-token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | No | `7` | Refresh-token and cookie lifetime |
| `BCRYPT_ROUNDS` | No | `12` | Password-hash work factor |
| `NODE_ENV` | No | `development` | Runtime mode |
| `PORT` | No | `4000` | Express port |
| `FRONTEND_ORIGIN` | No | `http://localhost:5173` | Browser origin allowed by CORS |
| `LOG_LEVEL` | No | `info` | Pino log level |

Generate two different secrets with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Run the command twice. Never commit the resulting `.env` file.

### Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

Both applications validate their environment at startup/build time.

## Prisma models

### `User`

- UUID primary key
- Required name and unique normalized email
- bcrypt password hash
- Created and updated timestamps
- One-to-many relationship with refresh tokens

### `RefreshToken`

- UUID primary key
- User foreign key with cascade deletion
- Unique SHA-256 token hash
- Expiration, revocation, and creation timestamps
- Indexes on `userId` and `expiresAt`

Migration: `20260712124843_phase_2_authentication`.

## API endpoints

| Method | Path | Purpose | Authentication |
|---|---|---|---|
| `GET` | `/health` | Process liveness | None |
| `GET` | `/ready` | PostgreSQL readiness | None |
| `POST` | `/api/v1/auth/register` | Create account and session | None |
| `POST` | `/api/v1/auth/login` | Create session | None |
| `POST` | `/api/v1/auth/refresh` | Rotate refresh token and return access token | HttpOnly cookie |
| `POST` | `/api/v1/auth/logout` | Revoke session and clear cookie | Optional cookie |
| `GET` | `/api/v1/auth/me` | Return current safe user | Bearer access token |

Success responses use:

```json
{ "success": true, "data": {} }
```

Errors use:

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

## Frontend routes

- `/register`: validated registration form
- `/login`: validated login form
- `/app`: protected Phase 2 placeholder with account details and logout

The access token is held in React state and `sessionStorage` for the current browser tab. The raw refresh token is inaccessible to JavaScript because it is stored in an HttpOnly cookie. On reload, the frontend attempts refresh-token rotation and reloads the current user.

## Testing

Run:

```powershell
npm.cmd test
```

The test setup derives an isolated `pulseapi_test` PostgreSQL schema from `DATABASE_URL`, creates it when necessary, applies committed migrations, and runs repository/API behavior against real Prisma and PostgreSQL. It never deletes development-schema users.

The suite covers:

- Health, readiness success/failure, and centralized `404`
- Registration success, validation, normalization, and duplicate rejection
- Login success and indistinguishable unknown-email/incorrect-password failures
- `/me` with valid, missing, and invalid access tokens
- Refresh-token rotation and rejection of the rotated token
- Logout, refresh rejection after logout, and missing-cookie logout
- Absence of password hashes in responses
- SHA-256-only refresh-token storage in PostgreSQL

Build the frontend:

```powershell
npm.cmd run build
```

## Manual authentication test

1. Run `npm.cmd run dev`.
2. Confirm `http://localhost:4000/ready` reports `database: connected`.
3. Open `http://localhost:5173/register` and create an account.
4. Confirm the browser redirects to `/app` and displays safe account data.
5. Refresh the page to verify session restoration.
6. Sign out and confirm `/app` redirects to `/login`.
7. Sign in again with the registered credentials.

## Security decisions

- Passwords are hashed with configurable bcrypt cost and never logged or returned.
- Unknown-email and incorrect-password login attempts return the same public error.
- Access tokens last 15 minutes and carry only user ID and token type.
- Refresh tokens last seven days, use a consistent HttpOnly cookie, and are stored only as SHA-256 hashes.
- Refresh rotation atomically revokes the previous database record before issuing the replacement.
- Logout succeeds even without a cookie and revokes a matching stored token when present.
- Cookies use `SameSite=Lax`; `Secure` is enabled in production.
- Registration and login have separate IP rate limits outside the test environment.
- Helmet, credential-aware CORS, a 100 KB JSON limit, sanitized errors, and non-sensitive structured logs remain enabled.
- User IDs come only from verified access tokens, never request bodies.

## Known limitations

- Rate limiting uses process memory, which is appropriate for the current single-instance phase but not distributed deployment.
- Session management is per refresh token; a future account UI could list and revoke all sessions.
- HTTPS and production secrets must be configured during deployment.
- Monitor management and all monitoring behavior begin in later phases.
