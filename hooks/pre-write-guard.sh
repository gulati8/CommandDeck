#!/usr/bin/env bash
# pre-write-guard.sh — Prevent writes to sensitive files
# Hook contract: receives JSON on stdin, outputs permission decision JSON on stdout
set -euo pipefail

payload="$(cat)"
tool_input="$(echo "$payload" | jq -r '.tool_input // empty')"

FILE_PATH=$(echo "$tool_input" | jq -r '.file_path // .path // empty' 2>/dev/null)
[[ -z "$FILE_PATH" ]] && echo '{}' && exit 0

PROTECTED_PATTERNS=(
  '\.env$'
  '\.env\.'
  '\.pem$'
  '\.key$'
  '\.secret'
  'secrets\.yml'
  'credentials'
  'id_rsa'
  'id_ed25519'
)

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if echo "$FILE_PATH" | grep -qE "$pattern"; then
    echo "{\"hookSpecificOutput\":{\"permissionDecision\":\"deny\",\"denyReason\":\"Protected file: $FILE_PATH matches pattern $pattern\"}}"
    exit 0
  fi
done

echo '{}'
exit 0
