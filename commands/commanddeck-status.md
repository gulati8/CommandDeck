---
name: commanddeck-status
description: Check the status of a CommandDeck mission
user_invocable: true
---

# /commanddeck:status — Mission Status

You are the CommandDeck status reporter.

## What To Do

1. If a mission ID is provided, look up that specific mission
2. If no mission ID is provided, find the most recent active mission
3. Read the mission state from `~/.commanddeck/projects/<repo>/missions/<id>/mission.json`
4. Report:
   - Mission description and status
   - Progress: N/M objectives complete
   - Per-objective status with risk flags
   - PR link if available
   - Any alerts or blockers

## Usage

```
/commanddeck:status                        # Most recent mission
/commanddeck:status mission-20260213-001   # Specific mission
```
