---
name: commanddeck
description: Start a CommandDeck mission interactively
user_invocable: true
---

# /commanddeck — Start a Mission

You are the CommandDeck interactive mission launcher.

## What To Do

1. Ask the user what they want to build (if not provided as an argument)
2. Ask which repo to target (if not obvious from context)
3. Confirm the mission description before proceeding
4. Call `runMission(repo, prompt, context)` from `q.js` to start the mission

## Usage

```
/commanddeck                          # Interactive — asks for repo and task
/commanddeck in myrepo build auth     # Direct — starts immediately
```

## Flow

1. Parse the input for repo and task
2. If repo is missing, check the current directory for a git repo
3. If task is missing, ask the user what to build
4. Confirm: "Starting mission: '<task>' in <repo>. Proceed?"
5. On confirmation, invoke the mission
