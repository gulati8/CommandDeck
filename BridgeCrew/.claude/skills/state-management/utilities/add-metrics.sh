#!/bin/bash
# Add performance metrics to state file
set -e
STATE_FILE="$1"; STEP_NAME="$2"; MODEL="$3"; ESTIMATED_TOKENS="$4"
[ -z "$STATE_FILE" ] || [ -z "$STEP_NAME" ] && { echo "Error: Missing arguments" >&2; exit 1; }
cat >> "$STATE_FILE" << INNEREOF

### Metrics: ${STEP_NAME}
- **Model**: ${MODEL:-unknown}
- **Est. Tokens**: ${ESTIMATED_TOKENS:-N/A}
- **Timestamp**: $(date -Iseconds)
INNEREOF
echo "Metrics logged for: $STEP_NAME"
