#!/bin/bash
# Initialize a new orchestration state file
set -e

TASK_NAME="$1"
ORIGINAL_REQUEST="$2"

if [ -z "$TASK_NAME" ] || [ -z "$ORIGINAL_REQUEST" ]; then
    echo "Error: Missing arguments" >&2
    echo "Usage: $0 \"task-name\" \"Original request text\"" >&2
    exit 1
fi

DATE=$(date +%Y-%m-%d)
SLUG=$(echo "$TASK_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g')
STATE_FILE=".claude/state/${DATE}_${SLUG}.md"
mkdir -p .claude/state

cat > "$STATE_FILE" << INNEREOF
# Orchestration: ${TASK_NAME}

**Started**: $(date -Iseconds)
**Status**: IN_PROGRESS

## Original Request
${ORIGINAL_REQUEST}

## Execution Log

## Final Summary
INNEREOF

echo "$STATE_FILE"
