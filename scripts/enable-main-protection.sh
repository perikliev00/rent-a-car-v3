#!/usr/bin/env bash
# Enable protected main + required CI check via GitHub Rulesets API.
# Prerequisites: gh auth login with admin rights on the repo.
# Run AFTER 3 consecutive fully green CI runs on main.
set -euo pipefail

REPO="${1:-}"
if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

echo "Applying ruleset on $REPO (protect main, require PR, require status check CI)..."

# Delete existing ruleset with the same name if present (idempotent-ish update).
EXISTING_ID="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main-ci-required") | .id' | head -n1 || true)"
if [ -n "${EXISTING_ID:-}" ]; then
  echo "Updating existing ruleset id=$EXISTING_ID"
  METHOD="PUT"
  PATH_SUFFIX="/$EXISTING_ID"
else
  METHOD="POST"
  PATH_SUFFIX=""
fi

gh api --method "$METHOD" "repos/$REPO/rulesets$PATH_SUFFIX" --input - <<'EOF'
{
  "name": "main-ci-required",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "CI" }
        ]
      }
    },
    {
      "type": "non_fast_forward"
    }
  ],
  "bypass_actors": []
}
EOF

echo "✓ Ruleset active: direct pushes to main blocked; PR merges require green status check \"CI\"."
echo "Tip: also add Environment protection rules for staging/production in GitHub Settings → Environments."
