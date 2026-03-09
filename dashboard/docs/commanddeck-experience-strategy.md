# CommandDeck Experience Strategy (Slack + Web)

## Executive Summary

CommandDeck should run as a **dual-surface product**:
- **Slack = Command Surface** for fast intent capture, approvals, and thread-based collaboration.
- **Web UI = Control Surface** for mission depth, evidence review, cross-project visibility, partner-friendly summaries, and admin operations.

This split matches your current architecture (Slack as access-control layer, dashboard/API for observability/actions) and avoids overloading either surface.

### Recommended Direction

Choose **Proposal 2: Mission Studio** as the primary experience, with Proposal 1’s high-signal inbox patterns layered in.

Why:
- Gives you (dev/admin/power user) speed + control without forcing context switches into raw logs.
- Gives non-technical partners a readable “what happened / what’s next / what decision is needed” view.
- Reuses existing primitives in `server.js`, `lib/slack.js`, SQLite events, mission detail APIs, and current dashboard feed.

---

## Part 1: Research Process

### 1.1 Repo and Product Reality (Current State)

I reviewed current system behavior across:
- `server.js` (Slack app + dashboard + API + action routes)
- `lib/slack.js`, `lib/thread.js`, `lib/db.js` (thread/approval/event models)
- `dashboard/public/*` and `dashboard/public/mockups/*` (existing UI patterns)
- `CLAUDE.md` vision/design principles

Current strengths to preserve:
- Strong Slack thread model for mission lifecycle and approvals.
- JSON + SQLite event/timeline data suitable for mission observability.
- Existing dashboard already supports actionable operations (approve/reject/merge/reconnect).

Current gaps to address:
- Partner-readable narrative is limited.
- Cross-project outcome context (business impact, release confidence, risk trend) is not first-class.
- Surface responsibilities (what belongs in Slack vs web) are implicit, not productized.

### 1.2 External Benchmarks and Platform Constraints

Key references:
- Slack slash command behavior and request timing constraints (ack quickly, then continue async): [Slack Docs - Slash Commands](https://docs.slack.dev/interactivity/implementing-slash-commands)
- Slack global shortcuts cannot open in threads/channels directly (important for conversation-first design): [Slack Docs - Shortcuts](https://docs.slack.dev/interactivity/implementing-shortcuts/)
- Slack modal capabilities and limits (3-view stack; good for structured input): [Slack Docs - Modals](https://docs.slack.dev/surfaces/modals)
- Slack App Home design guidance (prioritize relevance, don’t overload): [Slack Docs - App Home](https://docs.slack.dev/surfaces/app-home/)
- Slack UX guidance on using threads to keep channels focused: [Slack Help - Use Threads](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions-in-channels)
- GitHub + Slack notification threading approach (supports thread-centric mission updates): [GitHub Docs - Slack Integration](https://docs.github.com/en/integrations/how-tos/slack/customize-notifications)

### 1.3 What This Means for CommandDeck

1. Slack should optimize for:
- low-friction commands
- approvals and nudges
- thread continuity
- human/agent conversational follow-ups

2. Web should optimize for:
- deep context and multi-objective evidence
- mission and portfolio observability
- role-aware views (technical vs business)
- configuration and governance controls

---

## Part 2: Decision Framework

## 2.1 Product Goals (12-Month)

1. Increase mission throughput without reducing quality.
2. Reduce “where is this work?” ambiguity across teams.
3. Make partner collaboration possible without requiring technical tool fluency.
4. Keep setup/self-hosted complexity manageable.

## 2.2 Personas and Primary Jobs

| Persona | Primary Job | Risk if poorly served |
|---|---|---|
| Main Dev / Admin / Power User | Launch, steer, debug, approve, recover missions fast | Operational drag, alert fatigue, trust loss |
| Non-tech Partners / Biz Owners | Understand progress, risk, and decisions needed | Disengagement, delayed approvals |
| Idea Generators | Submit ideas and get crisp status loops | Idea drop-off, duplicate asks |

## 2.3 Surface Allocation Matrix (Slack vs Web)

| Workflow | Slack | Web UI | Owner Surface |
|---|---|---|---|
| Start simple mission from known repo | Excellent | Good | Slack |
| Start scoped mission with constraints/options | Limited | Excellent | Web |
| Plan approval (quick yes/no) | Excellent | Good | Slack |
| PR approval/merge reaction | Excellent | Good | Slack |
| Evidence deep-dive by objective | Weak | Excellent | Web |
| Cross-project triage and prioritization | Weak | Excellent | Web |
| Partner status readout | Okay (noisy) | Excellent | Web |
| Configuration/governance/admin | Weak | Excellent | Web |
| Follow-up conversational iteration | Excellent | Medium | Slack |

Decision rule:
- If action takes under 30 seconds and needs immediate collaboration, prefer Slack.
- If action requires comparison, history, or structured review, prefer Web.

## 2.4 Weighted Evaluation Criteria

| Criteria | Weight | Why it matters |
|---|---:|---|
| Speed to action | 25 | You run many missions; latency compounds |
| Decision quality | 20 | Merge/approval confidence must stay high |
| Partner clarity | 20 | Non-tech collaboration is core goal |
| Operational observability | 20 | You need control at project + portfolio level |
| Implementation lift (incremental) | 15 | Must ship in usable slices |

---

## Part 3: Three End-to-End Experience Proposals

## Proposal 1: Signal Inbox (Operator-First)

**Positioning:** “Everything needing attention, ranked, now.”

### Slack Experience
- `/commanddeck` starts missions with minimal friction.
- Thread remains canonical conversation stream.
- Reactions/buttons close loops on plan/PR approvals.
- App nudges only for state transitions (avoid spam).

### Web Experience
- Home = prioritized action inbox (approve plan, stalled mission, merge-ready PR).
- Two-click mission drill-down to evidence/timeline.
- Fast keyboard triage and bulk actions for power users.

### Partner Experience
- Read-only “Decision Needed” panel with plain-English summaries.
- Clear owner and due-by markers.

### Best For
- You as primary operator.
- Teams with high mission volume and low tolerance for UI friction.

### Tradeoffs
- Excellent operational speed; weaker strategic storytelling.
- Partners may still rely on your interpretation for context.

### Mockup
- `dashboard/public/mockups/proposal-1-signal-inbox.html`

---

## Proposal 2: Mission Studio (Balanced, Recommended)

**Positioning:** “Slack runs the conversation; web explains the mission.”

### Slack Experience
- Intake, thread dialogue, approvals stay in Slack.
- Mission links open directly into the web “Mission Studio” context.
- Follow-up prompts preserve thread continuity.

### Web Experience
- Mission page centers on:
  - Objective progress
  - Evidence and risk flags
  - Timeline narrative (what happened, by which agent, with what result)
  - “Explain for partner” summaries
- Project board view for technical oversight.
- Portfolio digest for business stakeholders.

### Partner Experience
- “Briefing mode” strips jargon and shows:
  - goal
  - current status
  - risks/decisions
  - expected impact
- Comment/decision module maps back to Slack thread.

### Best For
- Mixed technical/non-technical collaboration.
- Teams needing both velocity and decision transparency.

### Tradeoffs
- Slightly more product surface to design than Proposal 1.
- Requires consistent content generation for partner summaries.

### Mockup
- `dashboard/public/mockups/proposal-2-mission-studio.html`

---

## Proposal 3: Portfolio Radar (Business-First)

**Positioning:** “CommandDeck as delivery portfolio system.”

### Slack Experience
- Mostly intake + alerting + approvals.
- Operational details deliberately moved to web.

### Web Experience
- Executive portfolio dashboard:
  - mission throughput
  - cycle time
  - risk/quality trend
  - ROI proxy metrics by project
- Initiative-level planning and dependency mapping.

### Partner Experience
- Strongest for biz owners and idea contributors.
- Weakest for high-frequency operator workflows.

### Best For
- Multi-project orgs with formal planning cadence.

### Tradeoffs
- Highest implementation complexity.
- Risks slowing power users unless paired with strong inbox shortcuts.

### Mockup
- `dashboard/public/mockups/proposal-3-portfolio-radar.html`

---

## Part 4: Recommendation and Why

## 4.1 Recommended Path

Adopt **Proposal 2 (Mission Studio)** with **Proposal 1’s Signal Inbox** as the default home.

This yields:
- Slack speed for command-and-control loops.
- Web depth for quality decisions and partner trust.
- Incremental implementation path over existing architecture.

## 4.2 Why Not Proposal 1 Alone?

Proposal 1 is excellent for you, but under-serves non-technical partners.

## 4.3 Why Not Proposal 3 First?

Proposal 3 improves executive visibility but risks delaying operator ergonomics and core mission reliability improvements.

---

## Part 5: Functional Scope for the Web UI

### 5.1 Core Information Architecture

1. **Inbox** (default)
- Prioritized action queue
- SLA/staleness indicators
- One-click actions

2. **Mission Studio**
- Summary, objectives, risk, evidence, timeline
- Dev mode vs Partner mode toggle

3. **Projects**
- Active mission board by repo
- Throughput and blockers

4. **Portfolio**
- Cross-project health and trend views
- Decision docket for biz owners

5. **Admin**
- Slack channel mappings
- Worker limits/timeouts
- Guardrails and deployment configuration

### 5.2 Slack Responsibility Boundaries

Keep in Slack:
- Mission start (simple path)
- Mission conversation and follow-ups
- Plan/PR approvals
- Critical state change alerts

Move to web:
- Deep review/evidence
- Multi-project triage
- Long-form partner briefs
- System configuration

---

## Part 6: Design System Direction (Summary)

Detailed spec is in:
- `dashboard/docs/commanddeck-web-design-system.md`

Short version:
- Visual metaphor: **Flight deck + briefing room** (not generic SaaS cards).
- Typography: **Space Grotesk + IBM Plex Mono**.
- Palette: deep graphite base, electric cyan for active states, amber for pending decisions, vermilion for risk.
- Motion: subtle status pulses, timeline reveal, event-to-state transitions.
- Accessibility: WCAG AA contrast baseline, keyboard-first triage, semantic status cues beyond color.

---

## Part 7: Rollout Plan

## Phase 1 (2-3 weeks): Signal Inbox Foundation
- Refine home feed into strict priority inbox.
- Add explicit action classes and time-to-stale indicators.
- Add partner-safe status card excerpts.

## Phase 2 (3-4 weeks): Mission Studio
- Unified mission detail with timeline + evidence tabs.
- Partner mode summary generation.
- Slack deep links into mission sections.

## Phase 3 (2-3 weeks): Portfolio + Admin
- Cross-project trend page.
- Channel mapping/admin controls.
- Role-based presets (Operator, Partner).

## Phase 4 (optional): Advanced Intelligence Layer
- Recommendation engine for mission risk and routing.
- Initiative grouping and planning dependencies.

---

## Part 8: Scoring Snapshot

| Proposal | Speed | Decision Quality | Partner Clarity | Observability | Lift | Weighted Score |
|---|---:|---:|---:|---:|---:|---:|
| Proposal 1: Signal Inbox | 9 | 7 | 6 | 7 | 9 | 7.70 |
| Proposal 2: Mission Studio | 8 | 9 | 9 | 8 | 7 | **8.25** |
| Proposal 3: Portfolio Radar | 6 | 8 | 10 | 10 | 4 | 7.70 |

---

## Part 9: Open Questions

1. Do you want partner comments to sync back into Slack threads automatically, or stay web-only with periodic Slack summaries?
2. Should “Partner mode” be available per mission, per project, or globally toggled per user session?
3. For decision accountability, do you want explicit “decision owner + due date” fields in mission state?

---

## Sources

- [Slack Docs - Slash Commands](https://docs.slack.dev/interactivity/implementing-slash-commands)
- [Slack Docs - Shortcuts](https://docs.slack.dev/interactivity/implementing-shortcuts/)
- [Slack Docs - Modals](https://docs.slack.dev/surfaces/modals)
- [Slack Docs - App Home](https://docs.slack.dev/surfaces/app-home/)
- [Slack Help - Use Threads](https://slack.com/help/articles/115000769927-Use-threads-to-organize-discussions-in-channels)
- [GitHub Docs - Customize Slack Notifications](https://docs.github.com/en/integrations/how-tos/slack/customize-notifications)

