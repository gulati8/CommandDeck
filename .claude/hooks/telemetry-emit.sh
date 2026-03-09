#!/bin/bash
# PostToolUse hook: pipes tool call data to CommandDeck telemetry Unix socket.
# Receives JSON on stdin with tool name, input, output.
# Forwards to the telemetry socket for real-time visibility into worker sessions.

SOCKET="${COMMANDDECK_TELEMETRY_SOCKET:-/tmp/commanddeck-telemetry.sock}"

# Only emit if the socket exists
[ -S "$SOCKET" ] || exit 0

# Read stdin (hook JSON payload)
INPUT=$(cat)

# Inject context env vars if available
ENRICHED=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    import os
    for key in ['COMMANDDECK_MISSION_ID', 'COMMANDDECK_TRACE_ID', 'COMMANDDECK_SPAN_ID', 'COMMANDDECK_AGENT', 'COMMANDDECK_OBJECTIVE_ID', 'COMMANDDECK_REPO']:
        env_key = key.replace('COMMANDDECK_', '').lower()
        val = os.environ.get(key)
        if val:
            data[env_key] = val
    print(json.dumps(data))
except:
    pass
" 2>/dev/null)

# Send to socket (non-blocking)
if [ -n "$ENRICHED" ]; then
  echo "$ENRICHED" | nc -U -w1 "$SOCKET" 2>/dev/null &
fi

exit 0
