# LuxRide

Premium car rental platform for Bulgaria. Browse a fleet of vehicles, search by dates and locations, hold a car temporarily, pay securely via Stripe Checkout, and receive booking confirmation emails. Includes an admin panel for managing cars, orders, contacts, and payments.

## Screenshots

| Home | Search results |
|------|----------------|
| ![Home page](docs/screenshots/home.png) | ![Search results](docs/screenshots/search.png) |

| Car detail | Booking review |
|------------|----------------|
| ![Car detail](docs/screenshots/car-detail.png) | ![Order review](docs/screenshots/order.png) |

## Tech Stack

### Backend (`backend/`)

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 22 |
| Framework | Express 5 |
| Language | JavaScript |
| Database | PostgreSQL 16 (raw SQL via `pg`, no ORM) |
| Auth | `express-session` + `connect-pg-simple` (session stored in Postgres) |
| Payments | Stripe Checkout Sessions |
| Email | Nodemailer (optional SMTP) |
| Image storage | Local filesystem or S3-compatible storage |
| Logging | Pino (structured JSON) |
| Monitoring | Prometheus metrics, Grafana dashboards, Alertmanager, Sentry (optional) |
| Tests | Jest + Supertest |

### Frontend (`front end/`)

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Server state | TanStack React Query |
| Routing | React Router v7 |
| Tests | Vitest + Testing Library |

## Project Structure

```
rent-a-car-v3/
├── backend/          # Express API, SQL schema, migrations, Docker
├── front end/        # React SPA
├── docs/screenshots/ # README screenshots
└── README.md
```

## Prerequisites

- **Node.js** 22+
- **PostgreSQL** 16+ (local install or Docker)
- **Stripe** account with test keys (for payments)
- **Stripe CLI** (optional, for local webhook testing)

## Backend Setup

```bash
cd backend
npm install
cp .env.example .env   # edit with your values
npm run db:setup       # apply schema + migrations
npm run dev            # http://localhost:3000
```

### Backend scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start API with nodemon |
| `npm start` | Start API (production) |
| `npm test` | Run Jest tests |
| `npm run test:coverage` | Run Jest with coverage reports and global floors |
| `npm run test:db` | Run DB consistency tests (`RUN_DB_TESTS=1`) |
| `npm run test:integration` | Run concurrency + webhook integration tests (`RUN_INTEGRATION_TESTS=1`) |
| `npm run db:schema` | Apply initial SQL schema |
| `npm run db:migrate` | Apply versioned migrations |
| `npm run db:seed` | Seed demo data and dev users |
| `npm run db:reset` | Drop schema, re-apply setup + seed (dev only) |
| `npm run db:backup` | Create SQL backup in `backend/backups/` |
| `npm run db:restore` | Restore from backup (dev only) |
| `npm run db:setup` | Schema + migrations |
| `npm run reconcile:stripe` | Reconcile stuck Stripe sessions |

## Frontend Setup

```bash
cd "front end"
npm install
cp .env.example .env   # set VITE_API_BASE_URL
npm run dev            # http://localhost:5173
```

### Frontend scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm test` | Run Vitest tests |
| `npm run test:coverage` | Run Vitest with coverage reports and global floors |
| `npm run check` | Lint + typecheck + test |

## Database Setup

LuxRide uses PostgreSQL with raw SQL — no ORM. Database CLI commands are available from the **repo root** (they delegate to `backend/`).

### Option A: Docker (recommended for local dev)

```bash
docker compose -f docker-compose.dev.yml up -d db
```

Default credentials:

- Database: `luxride`
- User: `luxride`
- Password: `luxride`
- URL: `postgres://luxride:luxride@localhost:5432/luxride`

### Option B: Existing PostgreSQL instance

Create a database and set `DATABASE_URL` in `backend/.env`.

### Commands (from repo root)

| Command | Description |
|---------|-------------|
| `npm run db:setup` | Apply schema + migrations (first-time setup) |
| `npm run db:migrate` | Apply pending migrations only |
| `npm run db:seed` | Insert demo data + admin/demo users |
| `npm run db:reset` | Wipe DB and re-run setup + seed (development only) |
| `npm run db:backup` | Export plain SQL dump to `backend/backups/` |
| `npm run db:restore` | Restore from a backup file (development only) |

Typical local workflow:

```bash
npm run db:setup
npm run db:seed
```

Full dev reset (requires confirmation):

```bash
npm run db:reset -- --confirm
# or: FORCE_DB_RESET=1 npm run db:reset -- --confirm
```

Backup and restore:

```bash
npm run db:backup
npm run db:restore -- --file=backend/backups/luxride_YYYY-MM-DD_HH-mm-ss.sql --confirm
# or latest backup:
npm run db:restore -- --latest --confirm
```

`db:reset` and `db:restore` are blocked when `NODE_ENV=production`.

Backup/restore require PostgreSQL client tools (`pg_dump`, `psql`) in PATH. If they are not installed locally, use Docker:

```bash
docker compose -f docker-compose.dev.yml exec -T db pg_dump -U luxride luxride > backup.sql
docker compose -f docker-compose.dev.yml exec -T db psql -U luxride luxride < backup.sql
```

### Schema and migrations

- **Schema** — `backend/sql/schema/` (16 files: categories, cars, users, sessions, reservations, orders, etc.)
- **Migrations** — `backend/migrations/` (tracked in `schema_migrations` table)

### Demo data

`npm run db:seed` inserts categories, cars, sample contacts, demo orders, and two users:

| Role | Default email | Default password |
|------|---------------|------------------|
| Admin | `admin@luxride.local` | `Admin123!` |
| User | `demo@luxride.local` | `Demo123!` |

Override via `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_DEMO_USER_EMAIL`, and `SEED_DEMO_USER_PASSWORD` in `backend/.env` (see [`backend/.env.example`](backend/.env.example)).

Seed is idempotent — safe to re-run without duplicating data.

## Environment Variables

Copy the example files and fill in your values:

- **Backend:** [`backend/.env.example`](backend/.env.example)
- **Frontend:** [`front end/.env.example`](front%20end/.env.example)

### Required (backend, non-test)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Min 32 characters; used for session cookies |
| `STRIPE_SECRET` | Stripe secret key (`sk_test_...` in dev, `sk_live_...` in prod) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `FRONTEND_BASE_URL` | Required in production; defaults to `http://localhost:5173` in dev |

### Commonly configured

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3000` | API port |
| `CORS_ORIGINS` | dev defaults | Comma-separated allowed origins |
| `EMAIL_ENABLED` | `false` | Enable SMTP email sending |
| `STORAGE_DRIVER` | `local` | `local` or `s3` for car images |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Backend API base URL |

## Running Tests

From the **repo root**:

```bash
npm test                 # backend Jest + frontend Vitest
npm run test:unit        # backend Jest only
npm run test:frontend    # frontend Vitest only
npm run test:db          # DB consistency (needs PostgreSQL)
npm run test:integration # concurrency / webhooks (needs PostgreSQL)
npm run test:e2e         # Playwright
npm run test:all         # everything above
```

`npm test` does not need a database. `test:db`, `test:integration`, and `test:e2e` use a dedicated test Postgres.

Copy `.env.test.example` to `.env.test` (gitignored) and point `DATABASE_URL` at `luxride_test`, not `rent_a_car`. Test runners load that file automatically — no need to export `DATABASE_URL` in the shell. CI can still set `DATABASE_URL` in the environment (it wins over `.env.test`).

```bash
# Once: create the DB, then apply schema
createdb luxride_test
npm run db:setup:test

npm run test:integration
npm run test:e2e
```

### Backend

```bash
cd backend
npm test
npm run test:coverage
```

Jest runs unit tests in `backend/tests/` with `--runInBand`. Tests use a mocked environment (see `tests/setup.js`). Coverage reports land in `backend/coverage/` and `front end/coverage/`; CI uploads them as artifacts. Unit coverage floors are enforced by Jest `coverageThreshold` and Vitest `coverage.thresholds`. Local `npm test` and `npm run check` do not apply the gate. Floors are global integers from the 2026-08-22 baseline; raise them later when coverage actually goes up — do not lower them to make a PR green. Slow tests are printed via Jest/Vitest `slowTestThreshold` (500ms unit, 8000ms integration). Playwright JSON and HTML reports are CI artifacts; retries in the JSON are the flake signal.

Optional database consistency tests (from repo root, uses `.env.test`):

```bash
npm run test:db
```

### Integration & E2E tests

Concurrency and webhook integration tests use a **separate test database** with real PostgreSQL, HTTP, and signed Stripe webhooks (no mocked `bookingFinalizationService` or `reservationSqlService`).

```bash
createdb luxride_test
npm run db:setup:test
npm run test:integration
npm run test:e2e
```

Recommended env for local integration/E2E:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgres://luxride:luxride@localhost:5432/luxride_test` |
| `RUN_INTEGRATION_TESTS` | `1` |
| `STRIPE_STUB` | `1` (mock Checkout create/retrieve; webhooks stay real + signed) |
| `STRIPE_WEBHOOK_SECRET` | fixed test secret |
| `SESSION_SECRET` | 32+ char test secret |
| `EMAIL_ENABLED` | `false` |

Playwright E2E (full UI journey: search → checkout → webhook → admin):

```bash
# From repo root
npm run e2e:install
DATABASE_URL=postgres://luxride:luxride@localhost:5432/luxride_test npm run db:setup
npm run e2e

# Interactive UI mode
npm run e2e:ui
```

E2E starts backend (`STRIPE_STUB=1`) and frontend via Playwright `webServer`, or reuses already-running dev servers locally.

### Frontend

```bash
cd "front end"
npm test          # single run
npm run test:watch
npm run test:coverage
npm run check     # lint + typecheck + test (no coverage)
```

Tests are co-located under `front end/src/` (API client, routes, utilities).

## Stripe Payment Flow

LuxRide uses **Stripe Checkout Sessions** (hosted payment page). No Stripe publishable key is needed on the frontend — users are redirected to Stripe.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant DB
    participant Stripe

    User->>Frontend: Select car + dates
    Frontend->>API: POST /api/orders
    API->>DB: Create reservation (status=pending_payment, 35min hold)
    API-->>Frontend: Pricing preview

    User->>Frontend: Continue to checkout
    Frontend->>API: POST /api/checkout
    API->>DB: Update reservation (status=processing_payment)
    API->>Stripe: checkout.sessions.create
    API->>DB: Store stripe_session_id
    API-->>Frontend: checkoutUrl
    Frontend->>Stripe: Redirect to hosted checkout

    Stripe->>API: POST /webhook/stripe (checkout.session.completed)
    API->>DB: Block dates + create order + status paid then confirmed
    API->>API: Send confirmation emails (async)

    Stripe-->>Frontend: Redirect /checkout/success?session_id=...
    Frontend->>API: GET /api/checkout/success
    API-->>Frontend: Confirmation (fallback if webhook delayed)
```

### Key endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/orders` | Create pending reservation + price preview |
| `POST` | `/api/checkout` | Create Stripe Checkout Session |
| `GET` | `/api/checkout/success` | Confirm payment (webhook fallback) |
| `POST` | `/api/checkout/cancel` | Release hold on cancel |
| `POST` | `/webhook/stripe` | Stripe webhook (raw body) |

### Local webhook testing

```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```

Copy the webhook signing secret (`whsec_...`) into `STRIPE_WEBHOOK_SECRET`.

### Reconciliation

If a reservation stays in `processing_payment` after payment, run:

```bash
cd backend
npm run reconcile:stripe
```

## Booking / Reservation Logic

### Flow

1. **Search** — User picks dates, times, and pickup/return locations.
2. **Hold** — `POST /api/orders` creates a `pending_payment` reservation with a **35-minute hold**.
3. **Checkout** — `POST /api/checkout` links a Stripe Checkout Session (expires in **30 minutes**) and sets status to `processing_payment`.
4. **Payment** — Stripe webhook `checkout.session.completed` finalizes the booking (`paid` → `confirmed`).
5. **Confirmation** — Date range is blocked in `car_date_blocks`, an order is created, reservation becomes `confirmed`, and emails are sent.

### Reservation statuses

| Status | Meaning |
|--------|---------|
| `pending_payment` | Hold created, not yet in Stripe |
| `processing_payment` | Stripe Checkout Session active |
| `paid` | Payment received; confirming booking |
| `confirmed` | Paid; order created |
| `car_prepared` | Vehicle prepared for pickup |
| `picked_up` | Customer has the car |
| `active_rental` | Rental in progress |
| `returned` | Car returned |
| `completed` | Rental closed |
| `cancelled` | User released or checkout cancelled |
| `expired` | Hold timed out |
| `no_show` | Customer did not pick up |
| `manual_review` | Paid but overlap conflict — needs admin action |
| `refunded` | Payment refunded |

Statuses `pending_payment` and `processing_payment` block availability for other users. Status changes go through `ReservationStatusService` with history in `reservation_status_history`. Admin ops: `/admin/reservations`.

### Availability checking

Two layers prevent double-booking:

1. **Active holds** — Overlapping `pending_payment`/`processing_payment` reservations on the same car (with `hold_expires_at > now`).
2. **Confirmed blocks** — `car_date_blocks` table with a GiST EXCLUDE constraint preventing date-range overlaps.

Creation uses a per-car PostgreSQL advisory lock inside a transaction.

### Pricing

```
total = (dayPrice × rentalDays) + deliveryFee + returnFee
```

Day price uses tiered rates based on rental length:

- **1–3 days** → `price_tier_1_3`
- **4–31 days** → `price_tier_7_31`
- **32+ days** → `price_tier_31_plus`

Falls back to `cars.price` when tiers are not set. Delivery/return fees depend on the selected location.

### Cancellation / release

| Action | Endpoint | Effect |
|--------|----------|--------|
| Release hold | `POST /api/reservations/release` | Sets `cancelled` |
| Checkout cancel | `POST /api/checkout/cancel` | Releases hold + shows support info |
| Admin delete order | Admin panel | Soft-deletes order, removes date blocks |

There is no customer-facing API to cancel a confirmed order.

## Docker Setup

Docker files live in `backend/`:

- [`backend/Dockerfile`](backend/Dockerfile) — Node 22 Alpine, exposes port 3000
- [`backend/docker-compose.yml`](backend/docker-compose.yml) — `app` + `db` services

### Database only

```bash
cd backend
docker compose up -d db
```

### Full stack

```bash
cd backend
cp .env.example .env   # set DATABASE_URL to postgres://luxride:luxride@db:5432/luxride
docker compose up --build
```

The `app` service depends on `db`, loads env from `.env`, and exposes port 3000 with a health check on `/health`.

> **Note:** The frontend is not included in Docker Compose. Build and serve it separately (e.g. Vite preview, Nginx, or a static host) and point `VITE_API_BASE_URL` at the API.

## Deployment Plan

### 1. Infrastructure

| Component | Recommendation |
|-----------|----------------|
| API | Container from `backend/Dockerfile` (Node 22) |
| Database | Managed PostgreSQL 16 |
| Frontend | Static build (`npm run build`) served via CDN/Nginx |
| Images | `STORAGE_DRIVER=s3` with S3-compatible bucket + CDN URL |

### 2. Environment (production)

Set these in the production `.env`:

```env
NODE_ENV=production
DATABASE_URL=postgres://...
SESSION_SECRET=<32+ random chars>
FRONTEND_BASE_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STORAGE_DRIVER=s3
S3_BUCKET=...
STORAGE_PUBLIC_BASE_URL=https://cdn.your-domain.com
SENTRY_DSN=https://...
EMAIL_ENABLED=true
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=noreply@your-domain.com
```

Production validation (in `backend/src/config/env.js`) enforces:

- `SESSION_SECRET` strength (min 32 chars, no weak defaults)
- Live Stripe key (`sk_live_...`)
- `FRONTEND_BASE_URL` is set
- S3 vars when `STORAGE_DRIVER=s3`
- Full SMTP config when `EMAIL_ENABLED=true`

### 3. Deploy steps

1. **Database** — Provision PostgreSQL, run `npm run db:setup` against production DB.
2. **Stripe** — Register webhook endpoint `https://api.your-domain.com/webhook/stripe` for `checkout.session.completed`.
3. **API** — Build and deploy Docker container behind a reverse proxy with `trust proxy` enabled (Express sets this in production).
4. **Frontend** — `cd "front end" && npm run build`, deploy `dist/` with `VITE_API_BASE_URL` pointing to the API.
5. **Verify** — Health check (`GET /health/live`), readiness (`GET /health/ready`), test booking flow end-to-end with Stripe test mode first.
6. **Monitoring** — See [Observability](#observability) below.

### 4. CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR:

- **Backend:** `npm run test:coverage` (Jest unit tests + coverage artifact; fails if coverage drops below the floor). Jest JSON results upload as `backend-unit-jest-results` even if the job fails.
- **Frontend:** `npm run check` (lint + typecheck + Vitest, no coverage floor), then `npm run test:coverage` (coverage artifact + floor). Vitest JSON results upload as `frontend-unit-vitest-results`.
- **Integration + E2E:** PostgreSQL service, `npm run test:integration`, Playwright. JSON + HTML reports and integration Jest results upload as artifacts (`if: always()`). Playwright retries in the JSON are the flake signal.

### 5. Post-deploy operations

- Run `npm run reconcile:stripe` periodically or on alert for stuck `processing_payment` reservations.
- Apply new migrations with `npm run db:migrate` on each release.

## Observability

The stack includes structured logging, Prometheus metrics, Grafana dashboards, and Alertmanager alerts (via root `docker-compose.dev.yml` / `docker-compose.prod.yml`).

### Request tracing

Every API request gets a `requestId` (UUID). Response headers:

- `X-Request-Id` (primary)
- `X-Correlation-Id` (backward compatible alias)

Pass `X-Request-Id` from clients/upstream to correlate logs across services.

### Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /health/live` | Liveness — process up, uptime, app version |
| `GET /health/ready` | Readiness — PostgreSQL, Stripe config, migration status |
| `GET /health` | Alias for `/health/live` |
| `GET /ready` | Alias for `/health/ready` |

### Metrics

| Endpoint | Auth (prod) | Format |
|----------|-------------|--------|
| `GET /metrics` | `METRICS_TOKEN` | JSON snapshot |
| `GET /prometheus` | `METRICS_TOKEN` | Prometheus text |

Key business gauges (polled every 30s from DB):

- `paid_not_confirmed_count` — **critical** — Stripe paid but reservation not confirmed
- `processing_paid_count` — stuck in `processing_payment` with Stripe session
- `active_reservations_count`, `db_pool_*`, `unresolved_payment_failures_count`

### Structured business events (Pino logs)

Events include `checkout.started`, `checkout.completed`, `checkout.failed`, `reservation.created`, `reservation.confirmed`, `reservation.cancelled`, `stripe.webhook.received`, `stripe.payment.succeeded`, `stripe.payment.failed`, `admin.login.success`, `admin.login.failed`, `email.confirmation.failed`.

Slow requests (> `SLOW_REQUEST_MS`, default 1000) log as `http.slow_request`.

### Grafana dashboards (port 3001)

| Dashboard | UID |
|-----------|-----|
| API | `luxride-api` |
| Booking | `luxride-booking` |
| Payment | `luxride-payment` |
| Database | `luxride-database` |
| System Health | `luxride-system` |

### Alerts (Alertmanager, port 9093)

Prometheus rules in `monitoring/prometheus/alerts.yml`. Critical alerts:

- **PaidButNotConfirmed** — fires when `paid_not_confirmed_count > 0` or `processing_paid_count > 0` for 1 minute
- **ReservationConflictAfterPayment**
- **DbPoolExhausted**

Configure webhook delivery in root `.env`:

```env
ALERTMANAGER_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Also configure Sentry via `SENTRY_DSN` for error tracking.

### Local monitoring stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / admin by default)
- Alertmanager: http://localhost:9093

## License

ISC
