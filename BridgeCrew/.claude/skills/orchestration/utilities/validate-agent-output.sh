#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <output-file> [role]" >&2
  exit 2
fi

output_file="$1"
role="${2:-}"

if [[ ! -f "$output_file" ]]; then
  echo "Output file not found: $output_file" >&2
  exit 2
fi

if ! grep -q '^---$' "$output_file"; then
  echo "Missing YAML frontmatter in $output_file" >&2
  exit 1
fi

frontmatter="$(awk 'BEGIN{in=0} $0=="---"{if(in==0){in=1;next}else{exit}} in==1{print}' "$output_file")"
if [[ -z "$frontmatter" ]]; then
  echo "Empty YAML frontmatter in $output_file" >&2
  exit 1
fi

missing=()
required_keys=(
  "summary"
  "artifacts"
  "decisions"
  "risks"
  "open_questions"
  "confidence"
)

for key in "${required_keys[@]}"; do
  if ! printf "%s\n" "$frontmatter" | grep -q "^${key}:"; then
    missing+=("$key")
  fi
done

if [[ -n "$role" ]]; then
  case "$role" in
    planner) role_keys=("plan_steps" "parallel_groups" "test_plan" "rollback_plan") ;;
    code-writer) role_keys=("changes" "testing" "followups") ;;
    code-reviewer) role_keys=("must_fix" "should_fix" "nits" "tests_missing") ;;
    test-writer) role_keys=("tests_added" "coverage_notes" "how_to_run") ;;
    researcher) role_keys=("findings" "gaps") ;;
    security-auditor) role_keys=("findings" "attack_surface" "secrets" "tests") ;;
    devops-engineer) role_keys=("pipeline_steps" "env_vars" "rollout" "backout") ;;
    frontend-architect) role_keys=("component_plan" "state_strategy" "routing" "styling") ;;
    premium-ux-designer) role_keys=("layouts" "components" "states" "motion" "a11y" "content_notes") ;;
    product-strategy-advisor) role_keys=("options" "recommendation" "milestones" "metrics") ;;
    performance-optimizer) role_keys=("findings" "hotspots" "recommendations" "validation") ;;
    database-architect) role_keys=("schema_changes" "migrations" "indexes" "queries" "rollback_plan") ;;
    api-designer) role_keys=("endpoints" "versioning" "validation" "testing") ;;
    debugger) role_keys=("findings" "root_cause" "fix" "verification" "fallbacks") ;;
    documentation-writer) role_keys=("audience" "sections" "examples" "changes_made") ;;
    log-analyzer) role_keys=("activity_overview" "agent_usage" "failures" "recommendations") ;;
    feedback-coordinator) role_keys=("iterations" "status" "next_actions") ;;
    summarizer) role_keys=("compression" "key_decisions" "completed" "current_state" "next_actions") ;;
    *)
      echo "Unknown role: $role" >&2
      exit 2
      ;;
  esac

  for key in "${role_keys[@]}"; do
    if ! printf "%s\n" "$frontmatter" | grep -q "^${key}:"; then
      missing+=("$key")
    fi
  done
fi

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required fields: ${missing[*]}" >&2
  exit 1
fi

echo "Output contract OK${role:+ for role $role}."
