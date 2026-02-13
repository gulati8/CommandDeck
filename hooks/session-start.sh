#!/usr/bin/env bash
# session-start.sh — Load layered CommandDeck context into new session
# Hook contract: receives JSON on stdin, outputs JSON with additionalContext on stdout
set -euo pipefail

payload="$(cat)"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPO_SLUG="$(basename "$PROJECT_DIR")"
GLOBAL_DIR="$HOME/.commanddeck"
PROJECT_STATE="$GLOBAL_DIR/projects/$REPO_SLUG"
AGENT_NAME="${COMMANDDECK_AGENT:-unknown}"
MISSION_ID="${COMMANDDECK_MISSION_ID:-}"

CONTEXT=""

# Layer 1: Global standards (universal engineering principles)
if [[ -d "${GLOBAL_DIR}/standards" ]] && ls "${GLOBAL_DIR}/standards"/*.md 1>/dev/null 2>&1; then
  CONTEXT+="## Technical Standards\n\n"
  for f in "${GLOBAL_DIR}/standards"/*.md; do
    CONTEXT+="### $(basename "$f" .md)\n$(cat "$f")\n\n"
  done
fi

# Layer 2: Crew preferences (agent-specific learned behavior)
PREFS="${GLOBAL_DIR}/crew/${AGENT_NAME}-preferences.md"
if [[ -f "$PREFS" ]]; then
  CONTEXT+="## Your Learned Preferences\n$(cat "$PREFS")\n\n"
fi

# Layer 3: Project directives (project-specific agent preferences)
if [[ -d "${PROJECT_STATE}/directives" ]] && ls "${PROJECT_STATE}/directives"/*.md 1>/dev/null 2>&1; then
  CONTEXT+="## Project Directives\n\n"
  for f in "${PROJECT_STATE}/directives"/*.md; do
    CONTEXT+="- $(basename "$f" .md): $(head -1 "$f" | sed 's/^# //')\n"
  done
  CONTEXT+="\nRead any directive file for full context.\n\n"
fi

# Layer 4: Repo ADRs (if present)
if [[ -d "${PROJECT_DIR}/docs/adr" ]] && ls "${PROJECT_DIR}/docs/adr"/*.md 1>/dev/null 2>&1; then
  CONTEXT+="## Architecture Decision Records\n\n"
  for f in "${PROJECT_DIR}/docs/adr"/*.md; do
    CONTEXT+="- $(basename "$f" .md): $(head -1 "$f" | sed 's/^# //')\n"
  done
  CONTEXT+="\nRead any ADR file for full context.\n\n"
fi

# Layer 5: Mission state (if active mission)
if [[ -n "$MISSION_ID" ]]; then
  MISSION_DIR="${PROJECT_STATE}/missions/${MISSION_ID}"

  if [[ -f "${MISSION_DIR}/mission.json" ]]; then
    CONTEXT+="## Active Mission\n\`\`\`json\n$(cat "${MISSION_DIR}/mission.json")\n\`\`\`\n\n"
  fi

  if [[ -f "${MISSION_DIR}/captains-log.md" ]]; then
    CONTEXT+="## Recent Captain's Log\n$(tail -50 "${MISSION_DIR}/captains-log.md")\n\n"
  fi

  if [[ -d "${MISSION_DIR}/briefings" ]] && ls "${MISSION_DIR}/briefings"/*.json 1>/dev/null 2>&1; then
    CONTEXT+="## Available Briefings\n"
    for f in "${MISSION_DIR}/briefings"/*.json; do
      CONTEXT+="- $(basename "$f")\n"
    done
    CONTEXT+="\n"
  fi
fi

# Layer 6: Recent git history
CONTEXT+="## Recent Commits\n\`\`\`\n$(git log --oneline -15 2>/dev/null || echo 'No commits yet')\n\`\`\`\n\n"

# Output JSON with additionalContext
echo "{\"additionalContext\": $(echo -e "$CONTEXT" | jq -Rs .)}"
