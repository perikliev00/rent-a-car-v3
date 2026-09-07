# LuxRide

Premium car rental platform for Bulgaria. Browse a fleet of vehicles, search by dates and locations, hold a car temporarily, pay securely via Stripe Checkout, and receive booking confirmation emails. Staff manage cars, orders, contacts, and payments in a separate admin application.

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

### Customer frontend (`front end/`)

| Layer | Technology |
|-------|------------|
| Framework | React 19 |
| Build tool | Vite 8 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Server state | TanStack React Query |
| Routing | React Router v7 |
| Tests | Vitest + Testing Library |

### Admin frontend (`admin-front-end/`)

Same stack as the customer frontend. Runs on port **5174** in development.

## Project Structure

```
rent-a-car-v3/
├── backend/           # Express API, SQL schema, migrations, Docker
├── front end/         # Customer/public React SPA
├── admin-front-end/   # Staff admin React SPA
├── e2e/               # Playwright tests
├── docs/screenshots/  # README screenshots
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
| `npm run worker` | Start background worker (jobs + health only) |
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

Customer app:

```bash
cd "front end"
npm install
cp .env.example .env   # set VITE_API_BASE_URL (optional VITE_ADMIN_FRONTEND_URL)
npm run dev            # http://localhost:5173
```

Admin app:

```bash
cd admin-front-end
npm install
cp .env.example .env   # set VITE_API_BASE_URL (optional VITE_CUSTOMER_FRONTEND_URL)
npm run dev            # http://localhost:5174
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

#### Managed backups and point-in-time recovery (production)

`docker-compose.prod.yml` ships a local Postgres volume for demos only — **not** production DR. Use managed PostgreSQL 16 (RDS, Cloud SQL, Neon, Aiven, Azure, etc.) with:

1. Automated daily snapshots (encrypted)
2. Continuous WAL / **PITR** with retention ≥ 7–14 days
3. Alerts on failed backups
4. Documented RPO/RTO for the team

`npm run db:backup` is a logical dump for drills and local recovery — it does **not** replace provider PITR.

#### Restore drill (required before trusting backups)

A backup that has never been restored is not a proven backup. Drill against a **separate** database (never overwrite production/`DATABASE_URL` you care about):

```bash
# 1) Backup source
cd backend
DATABASE_URL=postgres://…/luxride_source npm run db:backup -- --out=backups/drill_source.sql

# 2) Create empty drill DB, then restore into it
createdb luxride_restore_drill
DATABASE_URL=postgres://…/luxride_restore_drill NODE_ENV=development \
  npm run db:restore -- --file=backups/drill_source.sql --confirm

# 3) Boot API against the restored DB and check readiness
DATABASE_URL=postgres://…/luxride_restore_drill npm start
# GET /health/ready — then spot-check reservations, users, payment_events / refunds
```

Pass criteria: restore succeeds, `/health/ready` is OK, row counts for reservations/users/payments match expectations, GiST exclusion constraints (`no_overlapping_car_blocks`, `no_overlapping_active_reservation_holds`) exist.

### Schema and migrations

- **Schema** — `backend/sql/schema/` (categories, cars, users, sessions, reservations, orders, calendar, payments, etc.)
- **Migrations** — `backend/migrations/` (tracked in `schema_migrations` table)
- Fresh databases: always prefer `npm run db:setup` (schema + migrations). Migration `034_car_date_blocks_exclusion.sql` also installs `btree_gist` + `no_overlapping_car_blocks` for migrate-only / legacy paths.
- Connection pool / timeouts: see `PG_POOL_*` and `PG_STATEMENT_TIMEOUT_MS` / `PG_IDLE_IN_TRANSACTION_TIMEOUT_MS` / `PG_LOCK_TIMEOUT_MS` in [`backend/.env.example`](backend/.env.example). Production defaults: pool max 20, statement 15s, idle-in-tx 30s, lock 5s.

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
- **Customer frontend:** [`front end/.env.example`](front%20end/.env.example)
- **Admin frontend:** [`admin-front-end/.env.example`](admin-front-end/.env.example)

### Required (backend, non-test)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Min 32 characters; used for session cookies |
| `STRIPE_SECRET` | Stripe secret key (`sk_test_...` in dev, `sk_live_...` in prod) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`) |
| `FRONTEND_BASE_URL` | Required in production; customer site (Stripe success/cancel, email verify). Defaults to `http://localhost:5173` in dev |

### Commonly configured

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment |
| `PORT` | `3000` | API port |
| `CORS_ORIGINS` | dev defaults | Comma-separated allowed frontend origins (customer and admin) |
| `EMAIL_ENABLED` | `false` | Enable SMTP email sending |
| `STORAGE_DRIVER` | `local` | `local` or `s3` for public car images only |
| `PRIVATE_STORAGE_DRIVER` | `local` | `local` or `s3` for identity docs, signatures, and checklist photos |
| `PRIVATE_STORAGE_PERSISTENT` | unset | Required in production when private storage is `local` (attests a durable volume) |
| `PRIVATE_S3_BUCKET` | unset | Required when `PRIVATE_STORAGE_DRIVER=s3`; private bucket, not the CDN image bucket |

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

E2E starts backend (`STRIPE_STUB=1`), the customer frontend (`:5173`), and the admin frontend (`:5174`) via Playwright `webServer`, or reuses already-running dev servers locally.

### Frontend

```bash
cd "front end"
npm test          # single run
npm run test:watch
npm run test:coverage
npm run check     # lint + typecheck + test (no coverage)

cd ../admin-front-end
npm test
npm run check
```

Tests are co-located under each app’s `src/` directory.

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
| API | 2× containers from `backend/Dockerfile` (`node src/server.js`, `RUN_BACKGROUND_JOBS=false`) |
| Worker | 1× same image (`node src/worker.js`) for expiry / cleanup / notifications / fleet reconcile |
| Database | Managed PostgreSQL 16 with automated backups + PITR (job locks use `pg_try_advisory_lock`; Redis not required). Compose `db` volume is not production DR. |
| Frontend | Static build (`npm run build`) served via CDN/Nginx |
| Images | `STORAGE_DRIVER=s3` with S3-compatible bucket + CDN URL |
| Private documents | `PRIVATE_STORAGE_DRIVER=s3` with a private (non-CDN) bucket, or a backed-up volume at `/app/uploads/private` |

`docker-compose.prod.yml` wires `backend` (API, jobs off) + `worker` (jobs on). Local `npm run dev` may still run jobs in-process when `RUN_BACKGROUND_JOBS` is unset.

### 2. Environment (production)

Set these in the production `.env`:

```env
NODE_ENV=production
DATABASE_URL=postgres://...
SESSION_SECRET=<32+ random chars>
FRONTEND_BASE_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com,https://admin.your-domain.com
STRIPE_SECRET=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STORAGE_DRIVER=s3
S3_BUCKET=...
STORAGE_PUBLIC_BASE_URL=https://cdn.your-domain.com
PRIVATE_STORAGE_DRIVER=s3
PRIVATE_S3_BUCKET=...
SENTRY_DSN=https://...
EMAIL_ENABLED=true
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=noreply@your-domain.com
```

Production validation (in `backend/src/config/env.js`) refuses to start when:

- `STRIPE_STUB` is enabled
- Stripe webhook secret is missing, not `whsec_...`, or a known placeholder
- `SESSION_SECRET` is short or a known default
- `FRONTEND_BASE_URL` / `CORS_ORIGINS` use HTTP or localhost/dev hosts
- `DATABASE_URL` points at localhost / loopback
- `SESSION_COOKIE_SECURE` is explicitly disabled
- `STORAGE_DRIVER` is not `s3` (ephemeral local public uploads)
- Private storage is local without `PRIVATE_STORAGE_PERSISTENT=true` (prefer `PRIVATE_STORAGE_DRIVER=s3`)
- Email/SMTP is not fully configured (`EMAIL_ENABLED=true` + SMTP vars)
- Stripe secret is not a live key (`sk_live_...`)

Also enforced at runtime: CORS allowlist, `trust proxy`, CSRF on mutating `/api` routes, and `secure` / `httpOnly` / `sameSite` session cookies. Keep secrets in the environment or a secret manager — never in Git or the Docker image (`.env` is gitignored and dockerignored).

### 3. Deploy steps

1. **Database** — Provision PostgreSQL, run `npm run db:setup` against production DB.
2. **Stripe** — Register webhook endpoint `https://api.your-domain.com/webhook/stripe` for `checkout.session.completed`.
3. **API** — Deploy API replicas behind a reverse proxy with `trust proxy` enabled (`RUN_BACKGROUND_JOBS=false`). Express sets trust proxy in production.
4. **Worker** — Deploy one worker (`npm run worker` / compose `worker` service) for periodic jobs. PostgreSQL advisory locks skip overlapping runs.
5. **Customer frontend** — `cd "front end" && npm run build`, deploy `dist/` with `VITE_API_BASE_URL` pointing to the API. Optional `VITE_ADMIN_FRONTEND_URL` for staff redirect.
6. **Admin frontend** — `cd admin-front-end && npm run build`, deploy `dist/` on the admin hostname. Same `VITE_API_BASE_URL`.
7. **Verify** — Health check (`GET /health/live`), readiness (`GET /health/ready`), test booking flow end-to-end with Stripe test mode first. Confirm Stripe success/cancel still land on the customer site.
8. **Monitoring** — See [Observability](#observability) below.

### 4. CI

GitHub Actions (`.github/workflows/ci.yml`) runs on every push/PR. The aggregate job **`CI`** must be green before merge once branch protection is enabled.

| Job | What it runs |
|-----|----------------|
| `backend-lint` | ESLint |
| `backend-unit` | Jest unit + coverage floor |
| `frontend` / `frontend-admin` | lint + typecheck + Vitest + coverage + production `build` |
| `db-consistency` | PostgreSQL + `npm run test:db` |
| `integration` | PostgreSQL + `npm run test:integration` |
| `migration-test` | empty DB → `db:setup` → assert all migrations applied → idempotent `db:migrate` |
| `e2e-playwright` | fresh PostgreSQL + Playwright; **fails if any test needed a retry** (flake signal) |
| `docker-build` | builds API + customer + admin images tagged with commit SHA; **on `main` push also pushes them to GHCR** and records digests |
| `security-scan` | `npm audit --audit-level=high` for backend, frontends, e2e |
| `CI` (`ci-gate`) | fails unless every job above succeeded |

Playwright JSON/HTML and Jest results upload as artifacts (`if: always()`). Do not ignore failing integration/E2E — fix root causes.

**Deploy** (`.github/workflows/deploy.yml`): after a successful CI run on `main`, **does not rebuild**. It pulls the SHA images CI already pushed, records digests, deploys staging, then production with the **same digests**. Manual `workflow_dispatch` must pass a commit SHA that already has green CI on `main` and images in GHCR. Set repo variables `VITE_API_BASE_URL` (required on main), optional `VITE_ADMIN_FRONTEND_URL` / `VITE_CUSTOMER_FRONTEND_URL`. Hosts use `IMAGE_PREFIX=ghcr.io/<org>/<repo> IMAGE_TAG=<sha>` with `docker-compose.prod.yml` — never `up --build` for promote.

#### Making CI mandatory (after 3 fully green runs)

Gate: wait until **`CI` is fully green three times in a row** on `main` (no Playwright retries in the flake check). Then:

```bash
# requires: gh auth login with repo admin
bash scripts/enable-main-protection.sh
```

Or in GitHub UI:

1. **Settings → Rules → Rulesets** (or Branch protection) for `main`
2. Require a pull request before merging; block direct pushes
3. Require status checks: at minimum the aggregate **`CI`** job (or every individual job above)
4. Require branches to be up to date; do not allow admin bypass if you want a hard gate
5. Deploy only via the Deploy workflow / environment protection on `staging` and `production`

Until that gate is met, keep fixing flakes — do not mark checks optional and do not raise Playwright `retries`.

### 5. Post-deploy operations

- Run `npm run reconcile:stripe` periodically or on alert for stuck `processing_payment` reservations.
- Apply new migrations with `npm run db:migrate` on each release.
- Confirm managed backup + PITR is enabled; run a restore drill to a separate database after first deploy and after major schema changes (see [Restore drill](#restore-drill-required-before-trusting-backups)).
- Size `PG_POOL_MAX` so `max × (API replicas + worker) < managed max_connections − ~10`.

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
- `ready_status`, `migrations_ok`, `migrations_pending`
- `storage_free_bytes` / `storage_size_bytes` (upload volumes + `postgres_data` via RO mount `/mnt/pgdata`)
- `pg_database_size_bytes` — logical DB size (growth signal; free space still comes from `storage_*` on `postgres_data`)
- Worker-only: `worker_heartbeat_unixtime`, `background_job_*`

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

Prometheus rules in `monitoring/prometheus/alerts.yml`. Critical alerts include:

- **ApiDown** / **ReadinessFailed** / **MigrationsPendingOrFailed**
- **PaidButNotConfirmed** — Stripe paid but reservation not confirmed
- **ReservationConflictAfterPayment** / **DbPoolExhausted**
- **WorkerDown** / **WorkerStale** / **DiskSpaceLow**

Warning alerts include Stripe webhook failures, high 5xx, background job failures, booking conflict spikes, and storage errors.

Configure webhook delivery in root `.env`:

```env
ALERTMANAGER_WEBHOOK_URL=https://hooks.slack.com/services/...
```

Sentry:

- Backend / worker: `SENTRY_DSN`
- Customer + admin frontends: `VITE_SENTRY_DSN` (optional build arg / repo variable)

### Runbooks

| Scenario | Doc |
|----------|-----|
| Stripe webhook failure | [docs/runbooks/webhook-failure.md](docs/runbooks/webhook-failure.md) |
| Roll back previous version | [docs/runbooks/rollback.md](docs/runbooks/rollback.md) |
| Restore the database | [docs/runbooks/db-restore.md](docs/runbooks/db-restore.md) |

### Local monitoring stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin / admin by default)
- Alertmanager: http://localhost:9093
- Worker exposes `/prometheus` on the compose network (scraped as job `worker`)

## License

ISC
