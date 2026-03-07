# CommandDeck Web UI Design System

## System Intent

Design for two simultaneous truths:
- Operators need dense, high-signal control.
- Partners need calm, plain-language understanding.

The system therefore supports **dual readability**: technical precision + decision clarity.

---

## 1. Principles

1. **Signal over decoration**: status and next action are visually dominant.
2. **Progressive depth**: default to summary, expand to evidence.
3. **Role-adaptive clarity**: operator and partner modes share structure but vary language density.
4. **Stable semantics**: status colors and icons mean the same thing everywhere.
5. **Command confidence**: destructive actions require friction; routine actions stay one click.

---

## 2. Visual Language

### 2.1 Typography

- Display / headings: `Space Grotesk`
- UI/body: `Manrope`
- Technical metadata: `IBM Plex Mono`

Scale:
- `display`: 40/44
- `h1`: 30/36
- `h2`: 24/30
- `h3`: 18/24
- `body`: 15/22
- `meta`: 12/16

### 2.2 Core Palette (Recommended)

| Token | Hex | Purpose |
|---|---|---|
| `--bg-0` | `#070B11` | app background |
| `--bg-1` | `#0E1520` | panels/cards |
| `--bg-2` | `#152132` | hover/selected |
| `--line` | `#24344B` | borders/dividers |
| `--text-0` | `#E8F0FA` | primary text |
| `--text-1` | `#A8B8CD` | secondary text |
| `--text-2` | `#6F8098` | tertiary text |
| `--info` | `#44C2FF` | in-progress / links |
| `--pending` | `#FFC247` | pending approvals |
| `--success` | `#3ED598` | done/healthy |
| `--risk` | `#FF6B5E` | blocked/failure |
| `--accent` | `#65F3D5` | highlights/active |

### 2.3 Status Mapping (Global)

- `planning` -> pending
- `in_progress` -> info
- `pending_approval` -> pending
- `review` -> accent
- `done|merged` -> success
- `failed|aborted|stalled` -> risk

Never rely on color alone; pair with icon + label.

---

## 3. Layout and Responsiveness

### 3.1 Grid

- Desktop: 12-column fluid grid, 24px gutters.
- Tablet: 8-column grid.
- Mobile: single-column stack, sticky action tray.

### 3.2 Page Patterns

1. **Inbox page**: list + quick detail panel.
2. **Mission Studio**: summary header, objective rail, content tabs.
3. **Portfolio page**: KPI strip + board + trend panel.

### 3.3 Breakpoints

- `sm`: 640px
- `md`: 900px
- `lg`: 1200px
- `xl`: 1440px

Behavior:
- At `md` and below, side panels collapse to drawers.
- At `sm`, move row actions into a bottom sheet.

---

## 4. Components

### 4.1 Action Card

Purpose: triage actionable items.

Structure:
- status badge
- mission title
- project + age metadata
- context sentence
- action button group

States:
- hover lift `+1px`
- keyboard focus ring with `--accent`
- stale state adds `risk` left rail

### 4.2 Objective Row

Purpose: represent decomposed work items.

Fields:
- objective id + title
- assigned agent
- status
- risk flags
- evidence availability

### 4.3 Timeline Event

Purpose: trust via transparent chronology.

Fields:
- timestamp
- actor (agent/system/user)
- event label
- compact payload summary
- link to artifact

### 4.4 Partner Brief Card

Purpose: non-technical digest.

Sections:
- what was requested
- what changed
- current risk
- decision needed
- expected outcome

Plain-language constraints:
- no internal branch names by default
- no agent jargon unless toggled

### 4.5 Decision Docket Item

Purpose: explicit governance.

Fields:
- decision statement
- owner
- due date
- consequence if delayed
- approve/reject/comment

---

## 5. Motion

1. **Status pulse** (`in_progress` only): 2.2s loop, subtle opacity.
2. **Inbox reorder animation**: 180ms position shift.
3. **Timeline reveal**: 120ms stagger for first load.
4. **Panel transition**: 200ms ease-out slide.

Motion guardrails:
- disable non-essential animation on reduced-motion preference.
- no infinite decorative animations.

---

## 6. Content Style

### Operator Mode

- concise and technical
- include IDs and raw statuses
- prioritize anomaly visibility

### Partner Mode

- plain-language summaries
- avoid implementation detail unless expanded
- always include “what decision is needed now?”

Message templates:
- **Progress:** "Mission is 60% complete. Two objectives done, one in review."
- **Risk:** "One blocker: tests failing in payment flow. Proposed fix ready for review."
- **Decision:** "Approve merge to release preview?"

---

## 7. Accessibility Requirements

1. WCAG AA contrast for all text and controls.
2. Keyboard path for all mission actions.
3. Visible focus state with minimum 2px outline.
4. Status always represented by text + icon + color.
5. Minimum target size: 44x44 on touch screens.

---

## 8. CSS Token Starter

```css
:root {
  --bg-0: #070B11;
  --bg-1: #0E1520;
  --bg-2: #152132;
  --line: #24344B;

  --text-0: #E8F0FA;
  --text-1: #A8B8CD;
  --text-2: #6F8098;

  --info: #44C2FF;
  --pending: #FFC247;
  --success: #3ED598;
  --risk: #FF6B5E;
  --accent: #65F3D5;

  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;

  --font-display: 'Space Grotesk', sans-serif;
  --font-ui: 'Manrope', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
}
```

---

## 9. Implementation Notes for This Repo

1. Keep the current single-page architecture in `dashboard/public/app.js` initially.
2. Add a role-mode toggle (`operator` / `partner`) to state and URL params.
3. Extend `/api/mission/:id` payload with partner-safe computed summaries.
4. Preserve Slack channel/thread as canonical collaboration identity.
5. Keep all UI changes backward-compatible with existing API routes.

