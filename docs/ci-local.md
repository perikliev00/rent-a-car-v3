# Local CI gate (`ci:local`)

`npm run ci:local` reproduces the required GitHub Actions CI checks on a developer machine and is enforced by the Git `pre-push` hook.

## One-time setup

Prerequisites: Node.js 22+, Docker (daemon running), and package installs in `backend`, `front end`, `admin-front-end`, and `e2e`.

```bash
npm --prefix backend ci
npm --prefix "front end" ci
npm --prefix admin-front-end ci
npm --prefix e2e ci
npm run hooks:install
```

`npm run hooks:install` (also run via root `prepare`) sets `core.hooksPath=.githooks` for this clone. After that, every `git push` runs `npm run ci:local` and is blocked on failure.

## What it runs

| Local step | GitHub CI job |
| --- | --- |
| `backend` `lint` | `backend-lint` |
| `backend` `test:coverage` | `backend-unit` |
| `front end` `check` + `test:coverage` + `build` | `frontend` |
| `admin-front-end` `check` + `test:coverage` + `build` | `frontend-admin` |
| Gitleaks + `npm audit --audit-level=high` (all packages) | `security-scan` |
| `db:setup` / `db:assert-migrations` / idempotent `db:migrate` on `luxride_migrate` | `migration-test` |
| `db:setup` + `test:db` on `luxride_test` | `db-consistency` |
| `test:integration` on `luxride_test` | `integration` |
| `e2e:install` + `e2e` + `e2e:check-flakes` | `e2e-playwright` |
| `docker build` for api / customer / admin (no push) | `docker-build` (PR mode) |

Failed tests, crashes, timeouts, and missing dependencies exit non-zero. There is no hook bypass and no “skip failing tests” mode.

## PostgreSQL isolation

Each `ci:local` run:

1. Takes an exclusive `.ci-local.lock` (stale locks from dead PIDs are cleared).
2. Starts `docker-compose.ci.yml` under a unique Compose project name.
3. Publishes Postgres on a **random host port** (not fixed `5432`).
4. Uses `tmpfs` for data so the cluster is always fresh.
5. Creates `luxride_test` and `luxride_migrate` databases.
6. Sets `DATABASE_URL` explicitly (overrides empty values from `.env.test`).
7. Tears the project down on success or failure.

Concurrent `ci:local` invocations therefore cannot share PostgreSQL state. The lock also prevents E2E fixed ports (`3000` / `5173` / `5174`) from colliding.

## Differences vs GitHub CI

| Topic | Local | GitHub |
| --- | --- | --- |
| Job parallelism | Sequential | Parallel jobs |
| Node version | Whatever is installed (warns if ≠ 22) | Node 22 |
| Gitleaks | Local binary or `zricethezav/gitleaks:v8.28.0` image using `.gitleaks.toml` | `gitleaks/gitleaks-action` (same config file) |
| Docker images | Build only | Build; push to ECR only on `main` |
| Coverage artifacts | Written under each package; not uploaded | Uploaded as Actions artifacts |
| Aggregate gate | Single process exit code | `CI` job requiring all `needs` = success |

## Branch protection

See [`branch-protection.md`](branch-protection.md). Local hooks do not replace GitHub rulesets.
