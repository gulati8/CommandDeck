#!/usr/bin/env bash
# pre-compact.sh — Checkpoint all state before compaction
# This is the most critical hook. It's deterministic (no LLM), runs in ~2 seconds,
# and can't fail from context exhaustion. It fires BEFORE context gets compacted.
set -euo pipefail

payload="$(cat)"

PROJECT_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPO_SLUG="$(basename "$PROJECT_DIR")"
MISSION_ID="${COMMANDDECK_MISSION_ID:-}"
MISSION_DIR="$HOME/.commanddeck/projects/$REPO_SLUG/missions/$MISSION_ID"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# 1. Auto-commit any dirty work
if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  git add -A
  git commit -m "commanddeck: auto-checkpoint before compaction [${TIMESTAMP}]" --no-verify 2>/dev/null || true
fi

# 2. Write compaction marker to captain's log
if [[ -n "$MISSION_ID" ]] && [[ -d "$MISSION_DIR" ]]; then
  echo -e "\n## ⚠️ Context Compaction — ${TIMESTAMP}\nSession compacted. Read mission.json and git log for continuity.\n" \
    >> "${MISSION_DIR}/captains-log.md" 2>/dev/null || true
fi

# 3. Backup transcript if available
if [[ -n "${CLAUDE_TRANSCRIPT:-}" ]] && [[ -f "$CLAUDE_TRANSCRIPT" ]] && [[ -d "${MISSION_DIR}/backups" ]]; then
  cp "$CLAUDE_TRANSCRIPT" "${MISSION_DIR}/backups/transcript-$(date +%s).txt" 2>/dev/null || true
fi

echo '{}'
exit 0
