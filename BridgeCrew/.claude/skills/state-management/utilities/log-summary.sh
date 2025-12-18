#!/bin/bash
# Summarize agent Task logs for counts and durations.
# Usage: .claude/skills/state-management/utilities/log-summary.sh [.claude/logs/orchestration.jsonl]
set -e

LOG_FILE="${1:-.claude/logs/orchestration.jsonl}"

if [ ! -f "$LOG_FILE" ]; then
  echo "Log file not found: $LOG_FILE" >&2
  exit 1
fi

python3 - <<'PY' "$LOG_FILE"
import sys, json, datetime, collections

path = sys.argv[1]
events = []
with open(path) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            events.append(json.loads(line))
        except json.JSONDecodeError:
            continue

starts = collections.defaultdict(list)
stats = collections.defaultdict(lambda: {"invocations": 0, "durations": []})

for ev in events:
    ts_raw = ev.get("timestamp")
    if not ts_raw:
        continue
    try:
        ts = datetime.datetime.fromisoformat(ts_raw)
    except Exception:
        continue
    agent = ev.get("agent", "unknown")
    event = ev.get("event")
    if event == "subagent_start":
        starts[agent].append(ts)
    elif event == "subagent_complete":
        stats[agent]["invocations"] += 1
        if starts[agent]:
            t0 = starts[agent].pop(0)
            dur = (ts - t0).total_seconds()
            stats[agent]["durations"].append(dur)

def fmt_dur(values):
    if not values:
        return "n/a"
    return f"{sum(values)/len(values):.1f}s avg ({max(values):.1f}s max)"

total_invocations = sum(s["invocations"] for s in stats.values())

print("## Log Summary")
print(f"**Log File**: {path}")
print(f"**Total Subagent Invocations**: {total_invocations}")
print()
print("| Agent | Invocations | Duration |")
print("|-------|-------------|----------|")
for agent, s in sorted(stats.items()):
    print(f"| {agent} | {s['invocations']} | {fmt_dur(s['durations'])} |")

PY
