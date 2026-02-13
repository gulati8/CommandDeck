---
name: commanddeck-learn
description: Propose a new learning for CommandDeck's knowledge base
user_invocable: true
---

# /commanddeck:learn — Propose New Learning

You are helping the user propose a new learning for the CommandDeck knowledge base.

## What You Received

The user wants to teach CommandDeck something. Their input follows this command.

## Scope Detection

Determine what kind of learning this is:

1. **Global standard** — applies to all projects and agents
   - Example: "always use pnpm"
   - Stored in: `~/.commanddeck/standards/`
   - Requires governance approval

2. **Crew preference** — applies to a specific agent
   - Example: "Spock should use Vitest not Jest"
   - Stored in: `~/.commanddeck/crew/{agent}-preferences.md`
   - Requires governance approval

3. **Playbook** — reusable mission template
   - Example: "standard auth playbook should include rate limiting"
   - Stored in: `~/.commanddeck/playbooks/`
   - Requires governance approval

4. **Project directive** — applies to one project only
   - Example: "in invoicing-app, invoices use soft delete"
   - Stored in: `~/.commanddeck/projects/{repo}/directives/`
   - Written directly (no governance needed)

## Workflow

1. Parse the user's learning text
2. Detect the scope using the rules above
3. Use the `learn.propose()` function from `lib/learn.js` to write the proposal
4. Report back to the user:
   - What scope was detected
   - Where the learning was written
   - Whether it needs governance approval
   - If governance: remind them to react ✅ or ❌ in Slack (or approve via CLI)

## Output

Tell the user clearly:
- **Scope:** What kind of learning this is
- **Content:** What will be remembered
- **Status:** Whether it's pending approval or already active
- **Impact:** What this learning will affect going forward
