#!/usr/bin/env bash
# post-edit.sh — Auto-format after file writes
# Hook contract: receives JSON on stdin, outputs JSON on stdout
set -euo pipefail

payload="$(cat)"
tool_input="$(echo "$payload" | jq -r '.tool_input // empty')"

FILE_PATH=$(echo "$tool_input" | jq -r '.file_path // .path // empty' 2>/dev/null)
[[ -z "$FILE_PATH" ]] && echo '{}' && exit 0
[[ ! -f "$FILE_PATH" ]] && echo '{}' && exit 0

EXT="${FILE_PATH##*.}"

case "$EXT" in
  js|jsx|ts|tsx)
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
    npx eslint --fix "$FILE_PATH" 2>/dev/null || true
    ;;
  py)
    black "$FILE_PATH" 2>/dev/null || true
    isort "$FILE_PATH" 2>/dev/null || true
    ruff check --fix "$FILE_PATH" 2>/dev/null || true
    ;;
  rb)
    rubocop -A "$FILE_PATH" 2>/dev/null || true
    ;;
  go)
    gofmt -w "$FILE_PATH" 2>/dev/null || true
    ;;
  rs)
    rustfmt "$FILE_PATH" 2>/dev/null || true
    ;;
  css|scss|less|json)
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
    ;;
  tf)
    terraform fmt "$FILE_PATH" 2>/dev/null || true
    ;;
esac

echo '{}'
exit 0
