#!/bin/bash
set -e
STATE_FILE="$1"; SUMMARY="$2"
[ -z "$STATE_FILE" ] || [ -z "$SUMMARY" ] && { echo "Error: Missing arguments" >&2; exit 1; }
sed -i.bak 's/IN_PROGRESS/COMPLETED/' "$STATE_FILE"
cat >> "$STATE_FILE" << INNEREOF

**Completed**: $(date -Iseconds)

${SUMMARY}
INNEREOF
rm -f "${STATE_FILE}.bak"
echo "Completed: $STATE_FILE"
