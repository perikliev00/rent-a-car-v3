# LuxRide

Production-oriented car-rental reservation and operations platform built with Node.js, Express, PostgreSQL, React, Stripe, Docker, GitHub Actions, and AWS.

LuxRide covers the customer booking journey and the staff operational lifecycle: availability search, temporary holds, Stripe Checkout, booking finalization, customer account management, fleet operations, pickup/return workflows, refunds, monitoring, and production deployment.

## Current status

- Customer and admin applications are split into separate React frontends.
- The API and background worker run as separate production processes.
- PostgreSQL enforces booking consistency with exclusion constraints in addition to application-level locking.
- CI validates linting, unit tests, frontend tests/builds, database consistency, migrations, integration flows, security scans, Docker images, and Playwright E2E.
- The production workflow promotes immutable container images from Amazon ECR to AWS Lightsail after CI succeeds.
- Prometheus, Grafana, Alertmanager, structured logs, health/readiness endpoints, and optional Sentry provide operational visibility.

> Production note: the current AWS Compose topology includes PostgreSQL on a persistent Docker volume. For business-critical use, prefer managed PostgreSQL with automated backups and PITR, or maintain validated off-host backups and regular restore drills. See `docs/runbooks/db-restore.md`.

## Product capabilities

### Customer application

- Search available cars by pickup/return date, time, and location.
- Temporary reservation holds before payment.
- Stripe-hosted Checkout with success and cancel flows.
- Email verification and authenticated customer account.
- Reservation history and detail views.
- Travel-detail updates, cancellation requests, document upload/download, and generated reservation PDFs.
- Responsive public and account interfaces with mobile E2E coverage.

### Staff application

- Operations dashboard and reservation lifecycle management.
- Fleet, vehicle details, service records, damage, compliance, and documents.
- Order create/edit/restore flows with conflict protection.
- Calendar views, manual blocks, tasks, and reservation operations.
- Pickup and return checklists.
- Payments, refund/reconciliation workflows, contacts, notifications, analytics, audit logs, users, roles, and RBAC.
- Realtime admin updates through server-sent events.

## Reliability and booking consistency

Booking correctness is protected at multiple layers:

1. Active payment holds use a PostgreSQL GiST exclusion constraint so overlapping `pending_payment` / `processing_payment` reservations for the same car cannot coexist.
2. Confirmed operational ranges are stored in `car_date_blocks` and protected by the `no_overlapping_car_blocks` GiST exclusion constraint.
3. Staff booking writes use per-car PostgreSQL advisory locks before availability-changing mutations.
4. Checkout session creation is serialized per reservation and reuses an existing valid Stripe Checkout Session when possible.
5. Stripe webhook processing is idempotent and validates the payment/session context before finalization.
6. A paid booking that becomes conflicting is routed to `manual_review` instead of silently confirming an inconsistent state.
7. `picked_up` and `active_rental` reservations remain unavailable even when the scheduled return time has passed; expired-block cleanup preserves open physical rentals.

## Architecture

| Component | Technology / responsibility |
| --- | --- |
| Customer SPA | React 19, TypeScript, Vite, Tailwind CSS, React Query |
| Admin SPA | React 19, TypeScript, Vite, Tailwind CSS, React Query |
| API | Node.js 22, Express 5, raw SQL through `pg` |
| Worker | Same backend image; scheduled/background operational jobs |
| Database | PostgreSQL 16 |
| Sessions | `express-session` + `connect-pg-simple` |
| Payments | Stripe Checkout + signed webhooks + reconciliation |
| Storage | S3-compatible public/private storage; local drivers for development |
| Email | Nodemailer / SMTP |
| Observability | Pino, Prometheus, Grafana, Alertmanager, optional Sentry |
| Testing | Jest, Supertest, Vitest, Testing Library, Playwright |
| Delivery | GitHub Actions, Amazon ECR, AWS Lightsail, Docker Compose |

## Repository layout

    rent-a-car-v3/
    ├── backend/           Express API, worker, SQL schema/migrations, tests
    ├── front end/         Customer React application
    ├── admin-front-end/   Staff/admin React application
    ├── e2e/               Playwright browser tests
    ├── monitoring/        Prometheus, Alertmanager, Grafana configuration
    ├── ops/               Production deployment scripts
    ├── infra/             AWS/Terraform infrastructure
    ├── docs/              Runbooks, operational notes, audit evidence
    └── .github/workflows/ CI and production deployment

## Local development

### Prerequisites

- Node.js 22+
- PostgreSQL 16+ or Docker
- Stripe test credentials for payment work
- Stripe CLI only when forwarding local webhooks

### Database

Start PostgreSQL with Docker:

    docker compose -f docker-compose.dev.yml up -d db

Apply schema and migrations:

    npm run db:setup

Optional development seed:

    npm run db:seed

### Backend

    cd backend
    npm ci
    cp .env.example .env
    npm run dev

The API starts on port 3000 by default.

### Customer frontend

    cd "front end"
    npm ci
    cp .env.example .env
    npm run dev

The customer app uses port 5173 by default.

### Admin frontend

    cd admin-front-end
    npm ci
    cp .env.example .env
    npm run dev

The admin app uses port 5174 by default.

## Environment and production validation

Reference files:

- `backend/.env.example`
- `front end/.env.example`
- `admin-front-end/.env.example`
- `.env.docker.example`

Important backend variables include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing secret; minimum 32 characters |
| `FRONTEND_BASE_URL` | Customer-site URL used by redirects and verification |
| `CORS_ORIGINS` | Explicit customer/admin browser origins |
| `STRIPE_SECRET` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `EMAIL_ENABLED` + SMTP variables | Transactional email |
| `STORAGE_DRIVER` / `S3_BUCKET` | Public asset storage |
| `PRIVATE_STORAGE_DRIVER` / `PRIVATE_S3_BUCKET` | Private customer/staff documents |
| `METRICS_TOKEN` | Protects metrics endpoints |
| `SENTRY_DSN` | Optional backend error reporting |

When `NODE_ENV=production`, startup validation rejects unsafe or incomplete configuration, including weak session secrets, Stripe stub mode, invalid webhook secrets, insecure frontend/CORS URLs, loopback database URLs, disabled secure cookies, non-durable public storage, incomplete private-storage configuration, and missing production SMTP configuration.

## Security controls

- PostgreSQL-backed server sessions with secure, httpOnly cookies in production.
- CSRF protection on mutating session-authenticated API routes.
- Explicit CORS allowlist.
- Helmet security headers and HSTS in production.
- Separate auth/signup/login/admin/upload/checkout rate limits.
- Role-based authorization for staff operations.
- Upload validation and separate private-storage handling.
- Structured logging with sensitive-field redaction in Sentry integration.
- Full-history Gitleaks scan and `npm audit --audit-level=high` in CI.

## Testing

Run the common suites from the repository root:

    npm test
    npm run test:db
    npm run test:integration
    npm run test:e2e
    npm run test:all

`npm test` runs backend unit/API tests and both frontend unit suites without PostgreSQL. Database consistency, integration, and E2E suites use a dedicated test database.

See [`TESTING.md`](TESTING.md) for ownership boundaries, local test setup, concurrency coverage, CI behavior, and Playwright reporting.

## CI/CD

### CI

`.github/workflows/ci.yml` runs on pushes and pull requests. The pipeline includes:

- backend lint and Jest coverage;
- customer frontend lint, typecheck, Vitest coverage, and production build;
- admin frontend lint, typecheck, Vitest coverage, and production build;
- migration installation/idempotency checks;
- PostgreSQL database-consistency tests;
- integration tests with real PostgreSQL and signed Stripe webhook flows;
- Playwright E2E with a retry/flake gate;
- full-history Gitleaks and high-severity npm audits;
- Docker image builds for API, customer, and admin applications.

On `main`, the Docker job publishes commit-SHA-tagged images to Amazon ECR. Deployments use immutable image digests rather than rebuilding on the server.

### Production deployment

`.github/workflows/deploy.yml` starts after a successful CI run on `main` or through an explicit manual dispatch.

Release flow:

1. Resolve the exact 40-character commit SHA.
2. Verify that the API, customer, and admin images exist in ECR.
3. Resolve immutable ECR digests for all three images.
4. Check out the exact release commit.
5. Authenticate the Lightsail host to ECR through GitHub Actions AWS OIDC credentials.
6. Copy the versioned Compose, monitoring, and deployment payload.
7. Run `ops/deploy-production.sh` on the host.
8. Validate backend readiness, worker/frontend containers, Prometheus, Alertmanager, and Grafana.
9. Verify that the running API/worker/customer/admin containers use the expected immutable image references.
10. Automatically restore the previous deployment configuration if the deployment fails after rollback is armed.

Current AWS Compose services:

- PostgreSQL
- backend API
- background worker
- customer frontend
- admin frontend
- Prometheus
- Alertmanager
- Grafana

Use the deployment workflow for rollback rather than rebuilding an older commit. See [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md).

## Health and observability

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | Process liveness, uptime, version |
| `GET /health/ready` | Database, Stripe configuration, migration readiness |
| `GET /health` | Liveness alias |
| `GET /ready` | Readiness alias |
| `GET /metrics` | Authenticated JSON metrics snapshot |
| `GET /prometheus` | Authenticated Prometheus metrics |

Important alerts include API/worker availability, stale worker heartbeat, migration failures, database-pool pressure, Stripe webhook failures, paid-but-not-confirmed bookings, post-payment conflicts, high checkout error rate, 5xx spikes, storage errors, and low disk space.

Operational documentation:

- [`docs/README.md`](docs/README.md) — documentation index
- [`docs/runbooks/webhook-failure.md`](docs/runbooks/webhook-failure.md) — Stripe/payment recovery
- [`docs/runbooks/rollback.md`](docs/runbooks/rollback.md) — application rollback
- [`docs/runbooks/db-restore.md`](docs/runbooks/db-restore.md) — backup/restore and DR guidance
- [`docs/ops/production-alertmanager-email.md`](docs/ops/production-alertmanager-email.md) — production alert email setup

## Reservation lifecycle

Primary statuses:

| Status | Meaning |
| --- | --- |
| `pending_payment` | Temporary hold created |
| `processing_payment` | Stripe Checkout session in progress |
| `paid` | Payment received while finalization is completing |
| `confirmed` | Booking finalized and operational order exists |
| `car_prepared` | Vehicle prepared for pickup |
| `picked_up` | Vehicle handed to customer |
| `active_rental` | Rental currently open |
| `returned` | Vehicle returned |
| `completed` | Rental workflow closed |
| `cancelled` | Reservation cancelled/released |
| `no_show` | Pickup did not occur |
| `expired` | Temporary hold expired |
| `manual_review` | Paid booking requires staff intervention |
| `refunded` | Payment refunded |

Status history is persisted for operational visibility. Customer cancellation requests and admin actions follow the service-layer transition rules rather than mutating statuses directly from the UI.

## Payment flow

1. Customer creates a reservation hold.
2. Checkout validates the current reservation and pricing context.
3. A Stripe Checkout Session is created or an existing valid session is reused under a reservation checkout lock.
4. Stripe sends `checkout.session.completed` to the raw-body webhook endpoint.
5. The backend validates the signed event, payment/session metadata, amount/currency context, and reservation state.
6. Finalization atomically creates/updates the operational booking state and date block.
7. Duplicate events are safely ignored.
8. Paid conflicts are retained for `manual_review` and surfaced through metrics/alerts.

Use `npm --prefix backend run reconcile:stripe` for operational reconciliation of stuck Stripe sessions when required.

## Backups and disaster recovery

The repository includes logical PostgreSQL backup/restore tooling and a restore runbook. Logical dumps are useful for drills and recovery, but they are not a substitute for a tested production DR strategy.

For a real business deployment, maintain all of the following:

- automated off-host backups or managed snapshots;
- defined retention and encryption;
- alerts when backups fail;
- a documented RPO/RTO;
- regular restore drills into a separate database;
- post-restore checks for migrations, booking constraints, payment state, and application readiness.

See [`docs/runbooks/db-restore.md`](docs/runbooks/db-restore.md).

## License

ISC
