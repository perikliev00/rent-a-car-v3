#!/usr/bin/env bash
# Enable protected main + required CI check via the GitHub Rulesets API.
#
# Prerequisites:
#   - gh auth login with admin rights on the repository
#   - Prefer waiting until the aggregate "CI" check has been green on main
#
# Usage:
#   bash scripts/enable-main-protection.sh [owner/repo]
#
# Verifies the ruleset afterwards. Does not claim success without API confirmation.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
RULESET_FILE="$ROOT/scripts/main-ci-required.ruleset.json"

REPO="${1:-}"
if [ -z "$REPO" ]; then
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
fi

if [ ! -f "$RULESET_FILE" ]; then
  echo "Missing ruleset definition: $RULESET_FILE" >&2
  exit 1
fi

echo "Applying ruleset on $REPO (protect main, require PR, require status check \"CI\")…"

EXISTING_ID="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main-ci-required") | .id' | head -n1 || true)"
if [ -n "${EXISTING_ID:-}" ]; then
  echo "Updating existing ruleset id=$EXISTING_ID"
  METHOD="PUT"
  PATH_SUFFIX="/$EXISTING_ID"
else
  METHOD="POST"
  PATH_SUFFIX=""
fi

gh api --method "$METHOD" "repos/$REPO/rulesets$PATH_SUFFIX" --input "$RULESET_FILE"

echo "Verifying ruleset…"
ACTIVE_ID="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main-ci-required" and .enforcement=="active") | .id' | head -n1 || true)"
if [ -z "${ACTIVE_ID:-}" ]; then
  echo "Ruleset was not found as active after apply." >&2
  exit 1
fi

DETAIL="$(gh api "repos/$REPO/rulesets/$ACTIVE_ID")"
echo "$DETAIL" | grep -q '"CI"' || {
  echo "Active ruleset does not list required status check \"CI\"." >&2
  exit 1
}

echo "Verified: ruleset main-ci-required (id=$ACTIVE_ID) is active."
echo "Direct pushes to main are blocked; PR merges require a green \"CI\" check."
echo "Tip: also configure Environment protection for staging/production under GitHub Settings → Environments."
