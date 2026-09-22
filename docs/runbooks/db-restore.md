# Runbook: Database backup and restore

## Goal

Recover PostgreSQL safely without creating a second incident while fixing the first one, a tradition software teams have somehow kept alive for decades.

## Principles

- Never test a restore against the only copy of data you care about.
- Stop or drain writers before an intentional production restore.
- Keep backups off the application host whenever possible.
- A backup is not considered proven until it has been restored successfully.
- Prefer managed snapshots/PITR for business-critical production use.
- Logical `pg_dump` backups are useful, but do not replace a complete DR strategy.

## Logical backup

From the repository:

```bash
cd backend
DATABASE_URL=postgres://... npm run db:backup
```

Custom output:

```bash
DATABASE_URL=postgres://... \
  npm run db:backup -- --out=backups/luxride_manual.sql
```

The helper uses `pg_dump` with plain SQL, `--no-owner`, and `--no-acl`.

## Restore drill

Restore into a separate database:

```bash
DATABASE_URL=postgres://.../luxride_source \
  npm run db:backup -- --out=backups/drill_source.sql

createdb luxride_restore_drill

DATABASE_URL=postgres://.../luxride_restore_drill \
NODE_ENV=development \
  npm run db:restore -- --file=backups/drill_source.sql --confirm
```

Then boot the API against the restored database and verify `/ready`.

## Restore pass criteria

At minimum confirm:

- restore command completes successfully;
- `GET /ready` returns ready;
- all expected migrations are recorded;
- `no_overlapping_car_blocks` exists;
- `no_overlapping_active_reservation_holds` exists;
- representative row counts for reservations, users, orders, payments/refunds match expectations;
- customer and admin applications can read the restored data;
- payment reconciliation metrics are sane.

Useful gauges/checks include:

- `paid_not_confirmed_count`
- `processing_paid_count`
- `migrations_ok`
- `migrations_pending`
- `pg_database_size_bytes`
- storage/disk alerts

## Production recovery outline

1. Declare a maintenance window or block write traffic.
2. Record the current application release and database state.
3. Confirm the backup/snapshot being restored and its timestamp.
4. Restore into a new database/instance when the provider supports it.
5. Point a controlled application instance at the restored database.
6. Verify migrations, constraints, payment state, and key booking records.
7. Resume API and worker only after checks pass.
8. Monitor Stripe webhook/reconciliation state after reopening traffic.

## Current AWS topology

`docker-compose.aws.yml` currently includes PostgreSQL with a persistent Docker volume on the Lightsail host.

That provides persistence across container recreation, but it is not equivalent to managed multi-AZ PostgreSQL, provider PITR, or an off-host disaster-recovery plan.

For real business traffic, use one of these patterns:

- managed PostgreSQL with automated snapshots + PITR; or
- automated encrypted off-host logical/physical backups with retention, monitoring, and tested restore procedures.

Document the actual RPO/RTO after a successful restore drill.
