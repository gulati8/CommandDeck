#!/bin/bash
STATE_FILE="$1"
[ -z "$STATE_FILE" ] && { echo "Error: Missing file path" >&2; exit 1; }
[ ! -f "$STATE_FILE" ] && { echo "Error: File not found" >&2; exit 1; }
cat "$STATE_FILE"
