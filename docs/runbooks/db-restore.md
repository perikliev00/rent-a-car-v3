# Runbook: Restore the database

## Principles

- Treat production restore as a maintenance-window operation.
- Prefer provider snapshots / PITR in production. `npm run db:backup` is a logical dump for drills and local recovery — it does **not** replace PITR.
- Never overwrite a live production database without a confirmed backup and a rollback plan.

## Local / compose logical restore

```bash
# Backup
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U luxride luxride > backups/luxride_$(date +%F_%H-%M-%S).sql

# Restore (development / drill DB only unless you intentionally target prod)
cd backend
npm run db:restore -- --file=backups/<file>.sql --confirm
# or
npm run db:restore -- --latest --confirm
```

Docker alternative:

```bash
docker compose -f docker-compose.prod.yml exec -T db \
  psql -U luxride luxride < backups/<file>.sql
```

## Production (managed) outline

1. Stop or drain write traffic (maintenance page / scale API+worker down).
2. Restore from the provider snapshot or PITR to the target timestamp.
3. Start API + worker on a compatible `IMAGE_TAG`.
4. Check `/ready` (especially migrations), Stripe webhook backlog, and gauges:
   - `paid_not_confirmed_count`
   - `processing_paid_count`
   - `migrations_ok` / `migrations_pending`
   - `storage_free_bytes{path="postgres_data"}` / `DiskSpaceLow`
   - `pg_database_size_bytes`
5. Replay failed webhooks if needed (`webhook-failure.md`).

## Restore drill (required)

Restore into a **separate** database first:

```bash
DATABASE_URL=postgres://…/luxride_source npm run db:backup -- --out=backups/drill_source.sql
DATABASE_URL=postgres://…/luxride_drill npm run db:restore -- --file=backups/drill_source.sql --confirm
```

Document RPO/RTO after a successful drill.
