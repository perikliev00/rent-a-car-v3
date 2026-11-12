#!/usr/bin/env bash
# Enable protected main + required CI check via GitHub Rulesets API.
# Prerequisites: gh auth login with admin rights on the repo.
# Run AFTER 3 consecutive fully green CI runs on main.
set -euo pipefail

# Set the REPO shell variable.
REPO="${1:-}"
# Evaluate the shell condition before running the branch body.
if [ -z "$REPO" ]; then
  # Set the REPO shell variable.
  REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
# Close the conditional block.
fi

# Write a status message to the terminal.
echo "Applying ruleset on $REPO (protect main, require PR, require status check CI)..."

# Delete existing ruleset with the same name if present (idempotent-ish update).
EXISTING_ID="$(gh api "repos/$REPO/rulesets" --jq '.[] | select(.name=="main-ci-required") | .id' | head -n1 || true)"
# Evaluate the shell condition before running the branch body.
if [ -n "${EXISTING_ID:-}" ]; then
  # Write a status message to the terminal.
  echo "Updating existing ruleset id=$EXISTING_ID"
  # Set the METHOD shell variable.
  METHOD="PUT"
  # Set the PATH_SUFFIX shell variable.
  PATH_SUFFIX="/$EXISTING_ID"
# Begin the fallback branch of the conditional.
else
  # Set the METHOD shell variable.
  METHOD="POST"
  # Set the PATH_SUFFIX shell variable.
  PATH_SUFFIX=""
# Close the conditional block.
fi

# Run the shell command that performs this deployment or validation step.
gh api --method "$METHOD" "repos/$REPO/rulesets$PATH_SUFFIX" --input - <<'EOF'
{
  # Run the shell command that performs this deployment or validation step.
  "name": "main-ci-required",
  # Run the shell command that performs this deployment or validation step.
  "target": "branch",
  # Run the shell command that performs this deployment or validation step.
  "enforcement": "active",
  # Run the shell command that performs this deployment or validation step.
  "conditions": {
    # Run the shell command that performs this deployment or validation step.
    "ref_name": {
      # Run the shell command that performs this deployment or validation step.
      "include": ["refs/heads/main"],
      # Run the shell command that performs this deployment or validation step.
      "exclude": []
    }
  },
  # Run the shell command that performs this deployment or validation step.
  "rules": [
    {
      # Run the shell command that performs this deployment or validation step.
      "type": "pull_request",
      # Run the shell command that performs this deployment or validation step.
      "parameters": {
        # Run the shell command that performs this deployment or validation step.
        "required_approving_review_count": 0,
        # Run the shell command that performs this deployment or validation step.
        "dismiss_stale_reviews_on_push": true,
        # Run the shell command that performs this deployment or validation step.
        "require_code_owner_review": false,
        # Run the shell command that performs this deployment or validation step.
        "require_last_push_approval": false,
        # Run the shell command that performs this deployment or validation step.
        "required_review_thread_resolution": true
      }
    },
    {
      # Run the shell command that performs this deployment or validation step.
      "type": "required_status_checks",
      # Run the shell command that performs this deployment or validation step.
      "parameters": {
        # Run the shell command that performs this deployment or validation step.
        "strict_required_status_checks_policy": true,
        # Run the shell command that performs this deployment or validation step.
        "do_not_enforce_on_create": false,
        # Run the shell command that performs this deployment or validation step.
        "required_status_checks": [
          # Run the shell command that performs this deployment or validation step.
          { "context": "CI" }
        ]
      }
    },
    {
      # Run the shell command that performs this deployment or validation step.
      "type": "non_fast_forward"
    }
  ],
  # Run the shell command that performs this deployment or validation step.
  "bypass_actors": []
}
# Run the shell command that performs this deployment or validation step.
EOF

# Write a status message to the terminal.
echo "✓ Ruleset active: direct pushes to main blocked; PR merges require green status check \"CI\"."
# Write a status message to the terminal.
echo "Tip: also add Environment protection rules for staging/production in GitHub Settings → Environments."
