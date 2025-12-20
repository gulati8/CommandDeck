#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <state-file> <budget-tokens>" >&2
  exit 2
fi

state_file="$1"
budget_tokens="$2"

if [[ ! -f "$state_file" ]]; then
  echo "State file not found: $state_file" >&2
  exit 2
fi

if [[ ! "$budget_tokens" =~ ^[0-9]+$ ]]; then
  echo "Budget must be an integer token count: $budget_tokens" >&2
  exit 2
fi

total_tokens="$(awk '
  /Est\. Tokens/ {
    line=$0
    gsub(/[^0-9]/, "", line)
    if (line != "") sum += line
  }
  END { print sum+0 }
' "$state_file")"

if [[ "$total_tokens" -gt "$budget_tokens" ]]; then
  echo "Budget exceeded: ${total_tokens} > ${budget_tokens} tokens" >&2
  exit 1
fi

echo "Budget OK: ${total_tokens} / ${budget_tokens} tokens."
