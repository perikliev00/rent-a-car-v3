# Testing

This document defines the test layers, local commands, CI ownership, and concurrency expectations for LuxRide.

## Commands

Run from the repository root unless noted otherwise.

| Command | Scope | PostgreSQL required |
| --- | --- | --- |
| `npm test` | Backend Jest + customer Vitest + admin Vitest | No |
| `npm run test:unit` | Backend Jest | No |
| `npm run test:frontend` | Customer frontend Vitest | No |
| `npm run test:admin-frontend` | Admin frontend Vitest | No |
| `npm run test:db` | Database consistency/regression tests | Yes |
| `npm run test:integration` | Backend integration tests | Yes |
| `npm run test:e2e` | Playwright browser E2E | Yes |
| `npm run test:all` | All suites above | Yes |
| `npm --prefix backend run test:coverage` | Backend coverage report | No |
| `npm --prefix "front end" run test:coverage` | Customer coverage report | No |
| `npm --prefix admin-front-end run test:coverage` | Admin coverage report | No |

## Test-database setup

Use a dedicated test database. Do not point automated test commands at a development or production database.

Typical local setup:

```bash
cp .env.test.example .env.test
createdb luxride_test
npm run db:setup:test
```

The test runners load `.env.test` when present. Explicit environment variables still take precedence.

## Layer ownership

| Layer | Location | Primary responsibility |
| --- | --- | --- |
| Unit/service | `backend/tests/**/*.test.js` | Pure/domain/service behavior with mocks where appropriate |
| API | `backend/tests/api/` | HTTP contract and authorization behavior through Supertest |
| DB consistency | backend DB test runner | Real PostgreSQL constraints, migrations, and data-integrity regressions |
| Integration | `backend/tests/integration/` | Real PostgreSQL, sessions, signed webhooks, advisory locks, race conditions |
| Customer UI | `front end/src/**/*.test.*` | Components, hooks, routing, API client behavior |
| Admin UI | `admin-front-end/src/**/*.test.*` | Staff UI, permissions, operational screens |
| E2E | `e2e/specs/*.spec.ts` | Browser-level customer/admin journeys |

Rule of thumb: if a test does not use a browser page/context, it should not live in the E2E layer.

## Concurrency and payment regressions

Concurrency tests intentionally overlap in subject matter. They protect different failure modes and should not be removed merely because their names look similar.

Examples include:

- one active hold per session;
- two users competing for the same car/dates;
- checkout-session reuse/serialization;
- webhook vs success-page finalization races;
- paid-after-cancel handling;
- amount/currency mismatch validation;
- expired/processing cleanup;
- manual-review resolution;
- checkout compensation/retry;
- open physical-rental protection for `picked_up` / `active_rental`;
- overdue active-rental block retention during expired-block cleanup.

## Playwright

Playwright covers both customer and staff flows, including mobile-specific suites.

Install the browser runtime once:

```bash
npm run e2e:install
```

Run:

```bash
npm run test:e2e
```

The CI Playwright job:

- provisions a fresh PostgreSQL service;
- applies schema and migrations;
- starts backend, customer, and admin apps;
- runs browser suites;
- uploads JSON and HTML reports;
- fails when Playwright retries were required, using retries as a flake signal.

The suite currently includes booking, checkout outcomes, account/cancellation, admin operations, fleet, payments, realtime, calendar, RBAC/task flows, and mobile layout/booking coverage.

## Coverage

Coverage reports are generated in CI for backend, customer frontend, and admin frontend and uploaded as artifacts.

Coverage thresholds are a regression floor, not a target to game. Raise thresholds when coverage improves; do not lower them simply to make a failing change pass.

## CI ownership

`.github/workflows/ci.yml` runs these major jobs:

- `backend-lint`
- `backend-unit`
- `frontend`
- `frontend-admin`
- `security-scan`
- `migration-test`
- `db-consistency`
- `integration`
- `e2e-playwright`
- `docker-build`
- aggregate `CI` gate

A production deployment is only triggered automatically after the `CI` workflow succeeds on `main`.
