#!/usr/bin/env bash
# pre-bash-guard.sh — Block dangerous bash commands
# Hook contract: receives JSON on stdin, outputs permission decision JSON on stdout
set -euo pipefail

payload="$(cat)"
tool_input="$(echo "$payload" | jq -r '.tool_input // empty')"

COMMAND=$(echo "$tool_input" | jq -r '.command // empty' 2>/dev/null)
[[ -z "$COMMAND" ]] && echo '{}' && exit 0

DANGEROUS_PATTERNS=(
  'rm -rf /'
  'rm -rf /\*'
  'dd if='
  'mkfs'
  'curl.*|.*sh'
  'wget.*|.*sh'
  'chmod -R 777'
  ':(){.*};'
  '> /dev/sda'
  'shutdown'
  'reboot'
  'kill -9 1'
  'systemctl stop'
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "{\"hookSpecificOutput\":{\"permissionDecision\":\"deny\",\"denyReason\":\"Dangerous command blocked: matches pattern '$pattern'\"}}"
    exit 0
  fi
done

echo '{}'
exit 0
