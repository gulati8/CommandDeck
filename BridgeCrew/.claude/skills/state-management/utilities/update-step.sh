#!/bin/bash
set -e
STATE_FILE="$1"; STEP_NAME="$2"; STATUS="$3"; DETAILS="$4"
[ -z "$STATE_FILE" ] || [ -z "$STEP_NAME" ] || [ -z "$STATUS" ] && { echo "Error: Missing arguments" >&2; exit 1; }
[ ! -f "$STATE_FILE" ] && { echo "Error: File not found" >&2; exit 1; }
case "$STATUS" in
    pending) E="⏳";; in_progress) E="🔄";; complete) E="✅";; failed) E="❌";;
    *) echo "Invalid status" >&2; exit 1;;
esac
cat >> "$STATE_FILE" << INNEREOF

### Step: ${STEP_NAME}
- **Status**: ${STATUS} ${E}
- **Time**: $(date -Iseconds)
${DETAILS:+- **Details**: ${DETAILS}}
INNEREOF
echo "Updated: $STEP_NAME → $STATUS"
