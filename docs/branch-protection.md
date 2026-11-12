# GitHub branch protection for `main`

Goal: merges into `main` require a green aggregate **`CI`** check from `.github/workflows/ci.yml` (the `ci-gate` job named `CI`).

## Prepared configuration

| File | Purpose |
| --- | --- |
| [`scripts/main-ci-required.ruleset.json`](../scripts/main-ci-required.ruleset.json) | Ruleset payload |
| [`scripts/enable-main-protection.sh`](../scripts/enable-main-protection.sh) | Apply + verify via `gh` |

Rules enforced when active:

- Changes to `main` go through a pull request
- Stale reviews dismissed on new pushes
- Review threads must be resolved
- Required status check: **`CI`** (strict: branch must be up to date)
- Non-fast-forward (no force-push)

## Apply (requires repo admin + `gh` auth)

```bash
gh auth login
bash scripts/enable-main-protection.sh
# or: bash scripts/enable-main-protection.sh owner/repo
```

The script creates or updates the `main-ci-required` ruleset and **verifies** it is `active` with the `CI` context before printing success.

## Verify manually

```bash
gh api repos/OWNER/REPO/rulesets --jq '.[] | {id,name,enforcement}'
gh api repos/OWNER/REPO/rulesets/RULESET_ID
```

Do not claim protection is active until one of these checks succeeds.

## Local gate vs GitHub gate

| Gate | Mechanism |
| --- | --- |
| Developer push | `.githooks/pre-push` → `npm run ci:local` |
| Merge to `main` | GitHub ruleset requiring status check `CI` |

Both are required for a reliable workflow. The hook catches failures before they hit the remote; the ruleset enforces them for everyone, including the GitHub UI merge button.
