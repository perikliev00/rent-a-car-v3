# LuxRide production deployment

LuxRide runs on one AWS Lightsail host. GitHub Actions builds the application images, publishes them to Amazon ECR, and deploys the same images by digest with Docker Compose. The [14 November 2026 deployment](https://github.com/perikliev00/rent-a-car-v3/actions/runs/43645069291) for `38397792ab23` completed both the release verification and the Lightsail deploy jobs successfully after [CI passed](https://github.com/perikliev00/rent-a-car-v3/actions/runs/43644437041). This records a successful release, not a live uptime check.

## Runtime topology

[`docker-compose.aws.yml`](../../docker-compose.aws.yml) is the live deployment definition. [`docker-compose.prod.yml`](../../docker-compose.prod.yml) is a separate, non-AWS configuration, not the file used by the Lightsail release workflow.

| Component | What runs on Lightsail |
| --- | --- |
| Web | Separate customer and staff React/TypeScript single-page applications, served by Nginx inside their images. Both container ports bind to the host loopback interface. |
| API and worker | A Node.js 22/Express API and a separate background worker use the same ECR image. The API does startup database setup; the worker starts after API readiness, with database setup skipped. |
| Database | PostgreSQL 16 runs in Compose on a named volume, with no published DB port. The API and worker use the application role for runtime access; API startup uses separate migration credentials. |
| Monitoring | Prometheus scrapes the API and worker with token authentication. Grafana reads Prometheus and Alertmanager is configured to send SMTP alerts. Monitoring ports in Compose are bound to loopback. |

The public HTTPS reverse proxy sits outside this Compose file. The deploy payload does not install or validate the host proxy, DNS records, or certificates. Verify HTTPS and browser/API routing separately after a release. Application object storage and host disk/volume persistence are separate from database disaster recovery.

The [Terraform configuration](../../infra/terraform/main.tf) describes the Lightsail instance, static IP, firewall, ECR repositories, and an application storage bucket. The [GitHub OIDC configuration](../../infra/terraform/github-oidc.tf) defines AWS access for the workflow. A normal application release does not apply Terraform.

## Release sequence

1. **Test and publish.** [CI](../../.github/workflows/ci.yml) runs lint, unit and frontend tests, migration checks, PostgreSQL consistency and integration tests, Playwright, and security scans. On a push to `main`, its Docker job publishes API, customer, and admin images tagged with the commit SHA. The aggregate `CI` job must pass before automatic deployment.
2. **Resolve digests.** [Deploy](../../.github/workflows/deploy.yml) resolves the three ECR tags to `@sha256:…` references and checks out that exact commit. The runner assumes an AWS role via OIDC and passes a short-lived ECR login to the host over SSH with known-host verification. Secrets stay in GitHub or in host-only environment files.
3. **Promote and check.** The [host script](../../ops/deploy-production.sh) validates the Compose payload, preserves the previous configuration, and pulls the release images. It pauses the worker, starts PostgreSQL and the API, waits for `/ready`, and starts the worker, both frontends, and monitoring. It checks liveness of containers, HTTP readiness, the authenticated metrics endpoint, and image references before recording the commit in `current-release.env`.

## Verify a release

An operator with existing access can check the deployed commit and service state without printing secrets. Run on the Lightsail host:

```bash
sudo awk -F= '$1 == "IMAGE_TAG" || $1 == "DEPLOYED_AT" { print }' /opt/rentacar/config/current-release.env
sudo docker compose --env-file /opt/rentacar/config/compose.env \
  -f /opt/rentacar/docker-compose.aws.yml ps
curl --fail --silent --show-error http://127.0.0.1:3000/ready
```

Compare the commit with the intended Actions run. From outside the host, open the configured customer and admin HTTPS origins and verify that the browser can load each app and reach its API. Keep payment and email checks non-destructive unless using an approved test flow. In Grafana/Prometheus, check the worker heartbeat and errors for migrations, webhooks, and checkout. A healthy Alertmanager process does not prove that an alert reached the operator; verify delivery separately using the [SMTP runbook](production-alertmanager-email.md).

## Rollback and recovery

- **Application:** On failure after promotion starts, the host script makes a best-effort rollback to the previous Compose configuration and images. Confirm the resulting service health. For a deliberate rollback, use a known-good SHA whose images still exist in ECR and follow the [rollback runbook](../runbooks/rollback.md). Neither route undoes schema changes.
- **Data:** The PostgreSQL volume survives container recreation but remains on the one host. The repo includes logical `pg_dump` and isolated restore tooling. Verify off-host backup scheduling, alert delivery, retention, and a timed restore on the operational environment before claiming a recovery objective. See [database backup and restore](../runbooks/db-restore.md).
