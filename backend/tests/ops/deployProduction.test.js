/**
 * H5: deploy-production.sh must roll back when a late health check fails
 * after ROLLBACK_ARMED=1 (including explicit exit 1 paths).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..', '..', '..');
const scriptPath = path.join(root, 'ops', 'deploy-production.sh');

const OLD_API =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-api@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const OLD_CUSTOMER =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-customer@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const OLD_ADMIN =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-admin@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc';
const NEW_API =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-api@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd';
const NEW_CUSTOMER =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-customer@sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
const NEW_ADMIN =
  '123456789012.dkr.ecr.eu-central-1.amazonaws.com/rentacar-admin@sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const OLD_TAG = '0123456789abcdef0123456789abcdef01234567';
const NEW_TAG = 'fedcba9876543210fedcba9876543210fedcba98';

function writeExecutable(filePath, contents) {
  fs.writeFileSync(filePath, contents.replace(/\r\n/g, '\n'), { mode: 0o755 });
}

function findBash() {
  const candidates = [
    process.env.BASH_PATH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    '/bin/bash',
    'bash',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['-lc', 'echo ok'], { encoding: 'utf8' });
    if (probe.status === 0 && String(probe.stdout || '').includes('ok')) {
      return candidate;
    }
  }
  return null;
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function toGitBashPath(bash, windowsPath) {
  const converted = spawnSync(bash, ['-lc', `cygpath -u "${toPosix(windowsPath)}"`], {
    encoding: 'utf8',
  });
  if (converted.status === 0 && converted.stdout.trim()) {
    return converted.stdout.trim();
  }
  // Fallback for non-Git environments.
  const normalized = toPosix(windowsPath);
  if (/^[A-Za-z]:\//.test(normalized)) {
    return `/${normalized[0].toLowerCase()}${normalized.slice(2)}`;
  }
  return normalized;
}

function setupFixtureRoot(bash, tmp, { failPull = false } = {}) {
  const rentacarRoot = path.join(tmp, 'rentacar');
  const bin = path.join(tmp, 'bin');
  const assets = path.join(tmp, 'assets');
  const config = path.join(rentacarRoot, 'config');
  const monitoringLive = path.join(rentacarRoot, 'monitoring');
  const monitoringPayload = path.join(assets, 'monitoring');

  fs.mkdirSync(bin, { recursive: true });
  fs.mkdirSync(config, { recursive: true });
  fs.mkdirSync(monitoringLive, { recursive: true });
  fs.mkdirSync(monitoringPayload, { recursive: true });
  fs.mkdirSync(path.join(config, 'deploy-backups'), { recursive: true });

  const alertEnv = toGitBashPath(bash, path.join(config, 'alertmanager.env'));
  fs.writeFileSync(
    path.join(config, 'compose.env'),
    [
      `API_IMAGE=${OLD_API}`,
      `CUSTOMER_IMAGE=${OLD_CUSTOMER}`,
      `ADMIN_IMAGE=${OLD_ADMIN}`,
      'METRICS_TOKEN=metrics-token-old',
      'POSTGRES_PASSWORD=postgres-password-16',
      'APP_DB_PASSWORD=app-db-password-16ch',
      'GRAFANA_ADMIN_PASSWORD=grafana-admin-16',
      `ALERTMANAGER_ENV_FILE=${alertEnv}`,
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(config, 'alertmanager.env'),
    [
      'ALERT_SMTP_HOST=localhost',
      'ALERT_SMTP_PORT=587',
      'ALERT_SMTP_FROM=ops@example.com',
      'ALERT_SMTP_USERNAME=ops',
      'ALERT_SMTP_PASSWORD=secret',
      'ALERT_EMAIL_TO=oncall@example.com',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(config, 'current-release.env'),
    [
      `IMAGE_TAG=${OLD_TAG}`,
      `API_IMAGE=${OLD_API}`,
      `CUSTOMER_IMAGE=${OLD_CUSTOMER}`,
      `ADMIN_IMAGE=${OLD_ADMIN}`,
      'DEPLOYED_AT=20200101T000000Z',
      '',
    ].join('\n')
  );
  fs.writeFileSync(
    path.join(rentacarRoot, 'docker-compose.aws.yml'),
    `services:\n  backend:\n    image: ${OLD_API}\n`
  );
  fs.writeFileSync(path.join(monitoringLive, 'prometheus.yml'), 'live: old\n');
  fs.writeFileSync(
    path.join(assets, 'docker-compose.aws.yml'),
    `services:\n  backend:\n    image: ${NEW_API}\n`
  );
  fs.writeFileSync(path.join(monitoringPayload, 'prometheus.yml'), 'payload: new\n');

  const releaseFile = path.join(tmp, 'verified-release.env');
  fs.writeFileSync(
    releaseFile,
    [
      `IMAGE_TAG=${NEW_TAG}`,
      `API_IMAGE=${NEW_API}`,
      `CUSTOMER_IMAGE=${NEW_CUSTOMER}`,
      `ADMIN_IMAGE=${NEW_ADMIN}`,
      '',
    ].join('\n')
  );

  const binUnix = toGitBashPath(bash, bin);
  const composeEnvUnix = toGitBashPath(bash, path.join(config, 'compose.env'));
  const scriptUnix = toGitBashPath(bash, scriptPath);
  const pullExit = failPull ? '1' : '0';

  writeExecutable(
    path.join(bin, 'docker'),
    `#!/usr/bin/env bash
echo "docker $*" >> "${binUnix}/docker.log"
if [[ "\${1-}" == "compose" && "\${2-}" == "config" ]]; then exit 0; fi
case "$*" in
  *pull*) if [[ "${pullExit}" == "1" ]]; then echo "pull failed" >&2; exit 1; fi; exit 0 ;;
esac
if [[ "\$1" == "compose" && "\$*" == *"ps"* && "\$*" == *"-q"* ]]; then
  # Last arg is the service name for \`compose ps -q <service>\`.
  service="\${@: -1}"
  echo "ctr_\${service}"
  exit 0
fi
if [[ "\$1" == "inspect" ]]; then
  if [[ "\$*" == *State.Status* ]]; then echo running; exit 0; fi
  if [[ "\$*" == *Config.Image* ]]; then
    target="\$2"
    if grep -F "API_IMAGE=${NEW_API}" "${composeEnvUnix}" >/dev/null 2>&1; then
      api="${NEW_API}"; customer="${NEW_CUSTOMER}"; admin="${NEW_ADMIN}"
    else
      api="${OLD_API}"; customer="${OLD_CUSTOMER}"; admin="${OLD_ADMIN}"
    fi
    case "\$target" in
      ctr_customer) echo "\$customer" ;;
      ctr_admin) echo "\$admin" ;;
      *) echo "\$api" ;;
    esac
    exit 0
  fi
fi
exit 0
`
  );

  writeExecutable(
    path.join(bin, 'curl'),
    `#!/usr/bin/env bash
echo "curl $*" >> "${binUnix}/curl.log"
url="\${@: -1}"
if [[ "$url" == *"/prometheus"* ]]; then
  echo "prometheus boom" >&2
  exit 22
fi
echo ok
exit 0
`
  );

  writeExecutable(
    path.join(bin, 'sleep'),
    `#!/usr/bin/env bash
exit 0
`
  );

  const wrapper = path.join(tmp, 'run-deploy.sh');
  writeExecutable(
    wrapper,
    `#!/usr/bin/env bash
set -euo pipefail
export PATH="${binUnix}:/usr/bin:/bin"
hash -r
exec bash "${scriptUnix}" "$@"
`
  );

  return {
    rentacarRoot,
    bin,
    assets,
    releaseFile,
    config,
    wrapper,
    paths: {
      rentacarRoot: toGitBashPath(bash, rentacarRoot),
      composeFile: toGitBashPath(bash, path.join(rentacarRoot, 'docker-compose.aws.yml')),
      composeEnv: toGitBashPath(bash, path.join(config, 'compose.env')),
      releaseFile: toGitBashPath(bash, releaseFile),
      assets: toGitBashPath(bash, assets),
      wrapper: toGitBashPath(bash, wrapper),
    },
  };
}

function runDeploy(bash, fx) {
  const env = {
    ...process.env,
    RENTACAR_ROOT: fx.paths.rentacarRoot,
    COMPOSE_FILE: fx.paths.composeFile,
    COMPOSE_ENV_FILE: fx.paths.composeEnv,
  };

  return spawnSync(
    bash,
    [fx.paths.wrapper, fx.paths.releaseFile, fx.paths.assets],
    { encoding: 'utf8', env, timeout: 60_000 }
  );
}

describe('H5: deploy-production rollback contracts', () => {
  const bash = findBash();
  const describeIf = bash ? describe : describe.skip;

  describeIf('bash deploy script', () => {
    let tmp;

    afterEach(() => {
      if (tmp && fs.existsSync(tmp)) {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });

    test('prometheus failure after arm restores previous release artifacts', () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-h5-'));
      const fx = setupFixtureRoot(bash, tmp, { failPull: false });
      const result = runDeploy(bash, fx);

      const curlLog = fs.existsSync(path.join(fx.bin, 'curl.log'))
        ? fs.readFileSync(path.join(fx.bin, 'curl.log'), 'utf8')
        : '';
      expect(curlLog).toMatch(/\/prometheus/);
      expect(result.status).not.toBe(0);

      const composeEnv = fs.readFileSync(path.join(fx.config, 'compose.env'), 'utf8');
      expect(composeEnv).toContain(OLD_API);
      expect(composeEnv).not.toContain(NEW_API);

      const composeFile = fs.readFileSync(
        path.join(fx.rentacarRoot, 'docker-compose.aws.yml'),
        'utf8'
      );
      expect(composeFile).toContain(OLD_API);
      expect(composeFile).not.toContain(NEW_API);

      const monitoring = fs.readFileSync(
        path.join(fx.rentacarRoot, 'monitoring', 'prometheus.yml'),
        'utf8'
      );
      expect(monitoring).toContain('live: old');

      const currentRelease = fs.readFileSync(
        path.join(fx.config, 'current-release.env'),
        'utf8'
      );
      expect(currentRelease).toContain(OLD_TAG);
      expect(currentRelease).not.toContain(NEW_TAG);

      const dockerLog = fs.readFileSync(path.join(fx.bin, 'docker.log'), 'utf8');
      expect(dockerLog).toMatch(/pull/);
      expect(dockerLog).toMatch(/up -d/);
    });

    test('negative control: docker compose pull failure also rolls back', () => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-h5-pull-'));
      const fx = setupFixtureRoot(bash, tmp, { failPull: true });
      const result = runDeploy(bash, fx);

      expect(result.status).not.toBe(0);
      const composeEnv = fs.readFileSync(path.join(fx.config, 'compose.env'), 'utf8');
      expect(composeEnv).toContain(OLD_API);
      expect(composeEnv).not.toContain(NEW_API);

      const dockerLog = fs.readFileSync(path.join(fx.bin, 'docker.log'), 'utf8');
      expect(dockerLog).toMatch(/pull/);
    });
  });
});
