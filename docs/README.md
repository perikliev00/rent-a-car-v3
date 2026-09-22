# Documentation

This directory contains operational documentation, production runbooks, and implementation audit evidence for LuxRide.

## Start here

- [`../README.md`](../README.md) — system overview, architecture, local setup, CI/CD, production topology, and operational guarantees.
- [`../TESTING.md`](../TESTING.md) — test layers, local setup, concurrency coverage, Playwright, coverage, and CI ownership.

## Production runbooks

| Scenario | Document |
| --- | --- |
| Stripe webhook/payment finalization failure | [`runbooks/webhook-failure.md`](runbooks/webhook-failure.md) |
| Roll back an application release | [`runbooks/rollback.md`](runbooks/rollback.md) |
| Backup/restore and database recovery | [`runbooks/db-restore.md`](runbooks/db-restore.md) |
| Configure production Alertmanager email | [`ops/production-alertmanager-email.md`](ops/production-alertmanager-email.md) |

## Audit evidence

- [`mobile-frontend-audit.md`](mobile-frontend-audit.md) — historical mobile-layout audit, fixes, verification results, and remaining limitations.
- `mobile-audit/` — captured evidence associated with that audit.

Audit documents describe the state and verification performed at the time of the audit. They are evidence, not the canonical source for current production architecture. Use the root README and runbooks for current operational instructions.

## Documentation rules

When behavior changes:

1. Update the canonical README section or runbook in the same change.
2. Prefer links to implementation/config files instead of copying large configuration blocks.
3. Keep production instructions aligned with the active GitHub Actions and AWS deployment path.
4. Do not include real credentials, tokens, private host values, or customer data.
5. Treat audit reports as historical records; update their status only when a new audit is actually performed.
