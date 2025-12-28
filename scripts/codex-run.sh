#!/bin/bash
set -euo pipefail

WORKFLOW="${1:-}"
shift || true
REQUEST="$*"

if [ -z "$WORKFLOW" ] || [ -z "$REQUEST" ]; then
    echo "Usage: $(basename "$0") <workflow> \"<request>\"" >&2
    exit 1
fi

STATE_TOOL=".claude/skills/state-management/utilities/init-state.sh"
if [ -x "$STATE_TOOL" ]; then
    STATE_FILE="$($STATE_TOOL "codex-$WORKFLOW" "$REQUEST")"
else
    DATE=$(date +%Y-%m-%d)
    SLUG=$(echo "codex-$WORKFLOW" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g')
    STATE_FILE=".claude/state/${DATE}_${SLUG}.md"
    mkdir -p .claude/state
    cat > "$STATE_FILE" << INNEREOF
# Orchestration: codex-$WORKFLOW

**Started**: $(date -Iseconds)
**Status**: IN_PROGRESS

## Original Request
$REQUEST

## Execution Log

## Final Summary
INNEREOF
fi

case "$WORKFLOW" in
    feature)
        STEPS="Research\nPlan\nImplement\nVerify\nReview"
        ;;
    bugfix)
        STEPS="Triage\nDiagnose\nImplement\nVerify\nReview"
        ;;
    refactor)
        STEPS="Analyze\nPlan\nRefactor\nVerify\nReview"
        ;;
    plan)
        STEPS="Research\nOptions\nRecommendation"
        ;;
    review)
        STEPS="Scope\nFindings\nActions"
        ;;
    quickfix)
        STEPS="Identify\nImplement\nVerify"
        ;;
    lite-feature)
        STEPS="Research\nImplement\nVerify\nReview"
        ;;
    lite-bugfix)
        STEPS="Triage\nImplement\nVerify\nReview"
        ;;
    discovery)
        STEPS="Requirements\nUX\nArchitecture\nMilestones"
        ;;
    spec)
        STEPS="Vision\nUX Flow\nTechnical Spec\nQA Plan"
        ;;
    *)
        STEPS="Research\nPlan\nImplement\nVerify\nReview"
        ;;
 esac

if ! grep -q "^## Workflow$" "$STATE_FILE" 2>/dev/null; then
    {
        echo ""
        echo "## Workflow"
        while IFS= read -r step; do
            [ -n "$step" ] && echo "- $step"
        done <<INNERSTEPS
$STEPS
INNERSTEPS
    } >> "$STATE_FILE"
fi

cat <<EOF
State file: $STATE_FILE
Workflow: $WORKFLOW
Next: follow .codex/ORCHESTRATOR_CODEX.md and update the state file as you complete each step.
EOF
