# Region-Aware Event Assignment System

## 1) High-Level Architecture


                ┌──────────────────────────────┐
                │         Frontend UI          │
                │     (React + EventSource)    │
                │  - Login / Claim / Ack       │
                │  - SSE Live Updates          │
                └─────────────┬────────────────┘
                              │
                 REST APIs    │    SSE Stream (/events/stream)
                              │
        ┌─────────────────────▼─────────────────────┐
        │           NestJS API Gateway              │
        │-------------------------------------------│
        │  - Auth (mock login + JWT)                │
        │  - Event & Assignment Logic               │
        │  - SSE Publisher                          │
        │  - Cache Layer (in-memory)                │
        │  - Cache Invalidation Hooks               │
        └──────────────┬───────────────┬────────────┘
                       │               │
           DB Queries  │               │ Cache Reads
                       │               │
        ┌──────────────▼──────┐   ┌────▼────────────┐
        │     PostgreSQL      │   │     Redis       │
        │   (Primary DB)      │   │   (Optional)    │
        └──────────────┬──────┘   └─────────────────┘
                       │
        ┌──────────────▼────────────────────────────┐
        │         Python Worker Service             │
        │-------------------------------------------│
        │  - Polls for expired assignments          │
        │  - Marks assignments EXPIRED              │
        │  - Releases events → AVAILABLE            │
        │  - Calls internal API endpoint            │
        └──────────────┬────────────────────────────┘
                       │
                       │ HTTP (internal, token-protected)
                       ▼
        ┌───────────────────────────────────────────┐
        │  POST /internal/assignments/expired       │
        │-------------------------------------------│
        │  - Invalidates cache                      │
        │  - Triggers SSE updates to clients        │
        └───────────────────────────────────────────┘

## 2) Data Modeling (PostgreSQL)

### Tables

- `moderators`
  - `id UUID PK`
  - `userId TEXT UNIQUE NOT NULL`
  - `region ENUM(ASIA, EUROPE, US)`

- `events`
  - `id UUID PK`
  - `title TEXT NOT NULL`
  - `region ENUM(ASIA, EUROPE, US)`
  - `status ENUM(AVAILABLE, CLAIMED)`
  - `payload JSONB`
  - `createdAt TIMESTAMP`

- `assignments`
  - `id UUID PK`
  - `eventId UUID FK events(id)`
  - `moderatorId UUID FK moderators(id)`
  - `status ENUM(ACTIVE, ACKNOWLEDGED, EXPIRED)`
  - `claimedAt TIMESTAMP`
  - `expiresAt TIMESTAMP`
  - `acknowledgedAt TIMESTAMP NULL`

### Indexing

- `events(region, status)`
- `events(region, createdAt)`
- `assignments(status, expiresAt)`
- `assignments(moderatorId, status)`
- Partial unique index: one active assignment per event

## 3) NestJS Project Structure

```text
services/api/src/
 ├── modules/
 │   ├── auth/
 │   ├── events/
 │   ├── assignments/
 │   ├── moderators/
 │   └── metrics/
 ├── common/
 │   ├── auth/
 │   └── enums/
 ├── app.module.ts
 └── main.ts
```

## 4) REST API Design

- `POST /auth/login`
- `GET /events/available`
- `GET /events/stream?access_token=<jwt>` (SSE live updates)
- `POST /events/:id/claim`
- `POST /events/:id/acknowledge`
- `POST /events/reseed`
- `GET /assignments/me/active`
- `GET /metrics`
- `POST /internal/assignments/expired` (internal worker callback, token-protected)

### REST API Examples (curl)

Login:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userId":"mod-asia-1","region":"ASIA"}'
```

Set the token from login response:

```bash
TOKEN=<paste_access_token>
```

List available events:

```bash
curl http://localhost:3000/events/available \
  -H "Authorization: Bearer $TOKEN"
```

Claim an event:

```bash
curl -X POST http://localhost:3000/events/<event_id>/claim \
  -H "Authorization: Bearer $TOKEN"
```

Acknowledge an event:

```bash
curl -X POST http://localhost:3000/events/<event_id>/acknowledge \
  -H "Authorization: Bearer $TOKEN"
```

SSE stream (browser/EventSource):

```javascript
const stream = new EventSource(`http://localhost:3000/events/stream?access_token=${TOKEN}`);
stream.onmessage = (event) => console.log(JSON.parse(event.data));
```

## 5) GraphQL

Endpoint: `/graphql`

- Query:
  - `availableEvents`
  - `myActiveAssignments`
- Mutations:
  - `login(userId, region)`
  - `claimEvent(eventId)`
  - `acknowledgeEvent(eventId)` — acknowledge by event ID
  - `acknowledgeAssignment(assignmentId)` — acknowledge by assignment ID

## 6) Core Logic

- Claim flow uses DB transaction + `FOR UPDATE SKIP LOCKED`.
- Claim sets `events.status = CLAIMED` and creates assignment with expiry window controlled by `ASSIGNMENT_TTL_MINUTES` (default: 15 minutes).
- Acknowledge flow validates active, unexpired assignment for current moderator.
- Worker marks stale assignments `EXPIRED` and releases events back to `AVAILABLE`.
- Frequently read queries (`/events/available`, `/assignments/me/active`, `/metrics`) use short-lived in-memory caching with cache invalidation on claim/ack/reseed/expiry notifications.
- API exposes authenticated SSE stream (`/events/stream`) to push live assignment/event updates to clients.

## 7) Concurrency Strategy

- Row-level lock in claim transaction prevents race conditions.
- Partial unique index prevents double active claims.
- Expiry updates are idempotent and safe under repeated polling.

## 8) Event Ingestion

- Seed data from `data/events.json` on API startup.
- Initial events are created with `status = AVAILABLE`.

## 9) Python Worker

- File: `services/worker/worker.py`
- Polling interval controlled by `POLL_INTERVAL_SECONDS`.
- Responsibilities:
  - expire stale active assignments
  - release corresponding events for reassignment
  - notify API internal endpoint so caches are invalidated and SSE subscribers get expiry updates quickly
- Internal notification config:
  - `INTERNAL_API_URL` (default: `http://localhost:3000/internal/assignments/expired`)
  - `INTERNAL_API_TOKEN` (default: `dev-internal-token`)

## 10) Docker Setup

### Full stack (single command)

```bash
docker compose up --build
```

### Infrastructure only (recommended for local API/frontend development)

```bash
docker compose up -d db redis
```

Services:
- `frontend` (React, `:5173`)
- `api` (NestJS, `:3000`)
- `worker` (Python scheduler)
- `db` (PostgreSQL)
- `redis` (optional cache)

## 11) Minimal Frontend Flow

- Login (`user_id + region`)
- Load available events
- Claim event
- Load active assignments
- Acknowledge event

Frontend path: `services/frontend`

## 12) Metrics

`GET /metrics` response:

```json
{
  "totalAssigned": 120,
  "active": 45,
  "expired": 75
}
```

## 13) Local Development (Windows / PowerShell)

From workspace root:

### 1) Start infrastructure

```powershell
docker compose up -d db redis
```

### 2) Start API

```powershell
cd services/api
npm install
$env:DB_HOST='localhost'
$env:DB_PORT='5432'
$env:DB_USER='postgres'
$env:DB_PASSWORD='Post123#'
$env:DB_NAME='moderation'
$env:JWT_SECRET='super-secret-change-me'
$env:ASSIGNMENT_TTL_MINUTES='15'
npm run start:dev
```

### 3) Start frontend (new terminal)

```powershell
cd services/frontend
npm install
npm run dev -- --host
```

### 4) Start worker (new terminal)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r services/worker/requirements.txt
$env:DATABASE_URL='postgresql://postgres:Post123%23@localhost:5432/moderation'
$env:POLL_INTERVAL_SECONDS='10'
$env:INTERNAL_API_URL='http://localhost:3000/internal/assignments/expired'
$env:INTERNAL_API_TOKEN='dev-internal-token'
python services/worker/worker.py
```

### 5) Verify

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:3000/metrics
Invoke-WebRequest -UseBasicParsing http://localhost:5173
```

## 14) Design Decisions & Trade-offs

- DB transactions chosen over Redis locks for correctness and simplicity.
- Python worker polling chosen for operational simplicity over queue/event-driven complexity.
- Redis included as optional optimization for caching/rate limiting.

## 15) Future Improvements

- Replace TypeORM `synchronize` with migrations.
- Expand to integration/e2e tests (concurrency, worker notification flow, SSE event assertions).
- Move from single-process in-memory cache to distributed cache strategy for horizontal scaling.
- Add OpenTelemetry + Prometheus metrics.

## 16) Testing

- API test command: `cd services/api && npm test`
- Current automated coverage includes unit tests for:
  - cache behavior
  - claim transaction success/failure paths
  - assignment acknowledge and metrics aggregation

## 17) Final Deliverables

- Source code: backend (`services/api`), frontend (`services/frontend`), worker (`services/worker`), Docker setup (`docker-compose.yml`).
- Setup instructions: included in this README (Docker + local development).
- Event ingestion approach: file-based seed from `data/events.json` on API startup.
- API documentation: endpoint list + curl examples in Section 4.
- Design decisions/trade-offs: documented in Section 14.
- Loom video: add your link here → `https://loom.com/share/<your-video-id>`
