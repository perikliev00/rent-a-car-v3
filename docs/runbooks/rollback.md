# Runbook: Roll back a production release

Production releases use immutable Amazon ECR image digests verified by `.github/workflows/deploy.yml`.

Do not rebuild an old commit on the server. Roll back by redeploying a previously verified commit SHA.

## Preferred rollback

1. Identify the last known-good full commit SHA from a successful CI/deploy run.
2. In GitHub Actions, run the **Deploy** workflow manually.
3. Set `image_tag` to that 40-character commit SHA.
4. The release gate verifies that:
   - the commit had successful CI on `main`;
   - API, customer, and admin images exist in ECR;
   - immutable ECR digests can be resolved.
5. The workflow deploys the exact release payload and images to Lightsail.
6. Verify:
   - `GET /health/live`;
   - `GET /ready`;
   - customer frontend;
   - admin frontend;
   - worker heartbeat;
   - Prometheus / Alertmanager / Grafana availability;
   - no `PaidButNotConfirmed` or migration alerts.

## Automatic rollback during deploy

`ops/deploy-production.sh` backs up the current Compose environment and monitoring/deployment payload before replacing the live release.

If a deployment fails after rollback is armed, the script restores the prior configuration/infrastructure and brings the previous release back up.

Treat this as deployment-failure recovery, not as a substitute for an intentional application rollback.

## Host verification

The current release metadata is written to:

```text
/opt/rentacar/config/current-release.env
```

It records the deployed commit and immutable image references.

## Database warning

Application rollback does **not** roll back database schema or data.

Before rolling back across schema changes:

1. inspect migrations introduced after the target release;
2. confirm the older application remains compatible with the current schema;
3. prefer a forward fix when compatibility is uncertain;
4. use a controlled database restore only when necessary.

See `db-restore.md` for database recovery.
