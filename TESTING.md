# Testing

## Commands

From the repo root:

| Script | What it runs | Postgres? |
| --- | --- | --- |
| `npm test` | `test:unit` then `test:frontend` | No |
| `npm run test:unit` | Backend Jest (unit + API) | No |
| `npm run test:frontend` | Frontend Vitest | No |
| `npm run test:db` | Backend DB tests | Yes |
| `npm run test:integration` | Backend integration tests | Yes |
| `npm run test:e2e` | Playwright E2E | Yes |
| `npm run test:all` | unit + frontend + db + integration + e2e | Yes (after unit/frontend) |
| `npm --prefix backend run test:coverage` | Backend Jest with coverage | No |
| `npm --prefix "front end" run test:coverage` | Frontend Vitest with coverage | No |

`npm test` does not need Postgres. `test:db`, `test:integration`, and `test:e2e` do.

## Which layer owns which check

| Layer | Where | What it proves | What it must not be |
| --- | --- | --- | --- |
| Unit | `backend/tests/**/*.test.js` excluding `tests/integration/` and excluding `tests/api/` | Pure functions / services with mocks (timing, validation, fees, finalization branches) | Real Postgres, real Stripe, browser |
| API | `backend/tests/api/` | HTTP status/body against mocked SQL/Stripe (Supertest + `createApiTestApp`) | Browser, advisory locks, true races |
| Integration | `backend/tests/integration/` | Real Postgres, session cookies, signed webhooks, advisory locks, constraints | Playwright UI |
| E2E | `e2e/specs/` | Real UI flows (search → checkout → admin) | API/DB-only checks with no page |

Rule of thumb: if the test never uses `page` / `adminPage` / `staffPage` / `browser`, it is not E2E — it belongs in API or integration.

## Do not cut overlapping concurrency tests

Concurrency/payment integration tests overlap on purpose. Do not delete or “dedupe” by title:

`sessionHoldLocking`, `twoUsersSameDates`, `successWebhookRace`, `paidAfterCancel`, `amountCurrencyMismatch`, `processingCleanupMatrix`, `manualReviewResolution`, `checkoutCompensationRetry`.

## Already finished

CI runs each group once (unit backend, frontend check, db+integration+e2e). Seven former Playwright API/DB specs now live under `backend/tests/integration/`. E2E is ~24 domain suites. `workers: 1` is required (shared DB).
