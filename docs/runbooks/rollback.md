# Runbook: Roll back to a previous version

Deploy uses immutable images tagged by commit SHA from GHCR. Do **not** `docker compose ... up --build` for a production rollback.

## Steps

1. Identify the last known-good commit SHA (previous green CI on `main`, or the prior `IMAGE_TAG` on the host).
2. Verify images exist:
   - `ghcr.io/<org>/<repo>/api:<sha>`
   - `ghcr.io/<org>/<repo>/frontend:<sha>`
   - `ghcr.io/<org>/<repo>/admin-frontend:<sha>`
3. On the host:

```bash
IMAGE_PREFIX=ghcr.io/<org>/<repo> IMAGE_TAG=<old-sha> PULL_POLICY=always \
  docker compose -f docker-compose.prod.yml pull
IMAGE_PREFIX=ghcr.io/<org>/<repo> IMAGE_TAG=<old-sha> PULL_POLICY=always \
  docker compose -f docker-compose.prod.yml up -d
```

4. Verify `GET /health/live`, `GET /ready`, worker heartbeat, and Alertmanager silence if needed.
5. Optional: GitHub Actions → Deploy → `workflow_dispatch` with `image_tag=<old-sha>` (must already have green CI + GHCR images).

## Migrations warning

Rolling back **containers does not roll back the database schema**. If the newer release applied irreversible migrations, prefer a forward fix or a controlled DB restore (see `db-restore.md`) instead of an unsafe app-only rollback.
