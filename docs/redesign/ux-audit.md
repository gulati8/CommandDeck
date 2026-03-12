# CommandDeck UX & Design Audit

**Date:** March 10, 2026
**Target:** commanddeck.gulatilabs.me
**Tech Stack:** Single-page HTML/CSS/JS app, no framework, hash-based routing

## Executive Summary

CommandDeck's dashboard is a functional operations console with a strong dark-theme identity (gold accent on near-black), but it suffers from information density problems, inconsistent hierarchy, poor mobile responsiveness, and a lack of visual warmth that undermines the product's ambitious "AI development firm" narrative. The monospace-everywhere approach creates a dense, terminal-like feel that makes it hard to scan quickly. The core value — seeing what your AI agents are doing right now — is diluted by a long activity feed that dominates the home view.

## Current State Overview

### Tech Stack
- Pure HTML/CSS/JS (no framework)
- Hash-based SPA routing (`#/`, `#/projects`, `#/traces`, `#/logs`, `#/system`)
- Google Fonts: Orbitron (display), Space Mono (body mono)
- Chart.js for metrics charts
- No build step, no bundler

### Design System

**Color Palette:**
| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#06060a` | Page background |
| `--surface` | `#0d0d14` | Cards, panels |
| `--surface-hover` | `#13131f` | Hover states |
| `--border` | `#1a1a2a` | Default borders |
| `--border-light` | `#28283a` | Hover borders |
| `--accent` | `#c8a04a` | Primary gold |
| `--accent-bright` | `#e4c462` | Bright gold |
| `--text` | `#e8e4d9` | Primary text |
| `--text-secondary` | `#9a9890` | Secondary text |
| `--text-dim` | `#6b6a63` | Dim text |
| `--blue` | `#60a5fa` | Running/in-progress |
| `--green` | `#4ade80` | Success/completed |
| `--yellow` | `#f59e0b` | Warning/approval |
| `--red` | `#e05252` | Error/failed |
| `--purple` | `#a78bfa` | Merged |

**Typography:**
- Display: Orbitron (logo, section titles, modal headers, metric values)
- Body: Space Mono (everything else — monospace)
- Base font size: 15px
- Sizes range from 13px to 22px

**Layout:**
- Sticky topbar (48px height)
- Max-width 900px centered content
- Single breakpoint at 640px
- Slide-out panel (440px) from right for mission details

### Page/Component Inventory

| View | Route | Components |
|---|---|---|
| Dashboard | `#/` | Status banner, running cards, activity feed, completed chips |
| Projects | `#/projects` | Project cards grid (280px min) |
| Project Detail | `#/projects/:repo` | Data table with missions |
| Traces | `#/traces` | Filter dropdowns, data table |
| Trace Detail | `#/traces/:id` | Header card, waterfall timeline, live stream |
| Logs | `#/logs` | Filter input, live button, auto-refresh toggle, log entries |
| System | `#/system` | Server status card, metrics charts, stat cards, containers grid |
| Mission Detail | slide panel | Project tag, description, meta grid, objectives, timeline, links |
| New Mission | modal | Project select, textarea, Slack checkbox |

## Critical UX Issues (Ranked by Severity)

### 1. CRITICAL: Mobile Navigation is Hidden
At 640px, `topbar-nav { display: none }` — no hamburger menu, no alternative. Mobile users literally cannot navigate between pages. The only navigation is clicking the logo to go home.

### 2. HIGH: Mission Detail Panel Overlaps on Mobile
The slide panel goes to `width: 100%` on mobile but there's no way to dismiss it other than a small "x" button. It also appears to stack awkwardly on top of page content, as seen in the mobile screenshot where both the panel and underlying content are visible simultaneously.

### 3. HIGH: Information Hierarchy on Dashboard is Inverted
The most important content (running missions, action items needing approval) should dominate the viewport. Instead, the "Recent Activity" feed takes up most of the screen — it's a raw chronological event log that belongs in the Logs tab, not on the home page. Users must scroll past 15+ activity items to see completed missions.

### 4. HIGH: Project Detail Table is Unreadable
The mission description column contains full paragraphs of text in a table cell. On the full-page screenshot, the table becomes an unreadable wall of monospace text. Mission IDs like `mission-20260310-477` are not scannable.

### 5. MEDIUM: No Loading/Empty States for Most Views
- Traces view shows data directly or nothing
- No loading spinners during API fetches
- No helpful empty states ("No traces yet — traces appear when missions run")

### 6. MEDIUM: Monospace Body Font Hurts Readability
Space Mono as the body font makes long descriptions hard to read. Monospace fonts have equal character widths, which reduces reading speed by ~15% compared to proportional fonts. This is particularly painful in mission descriptions, which are natural language text.

### 7. MEDIUM: No Keyboard Navigation or Focus Management
- No visible focus indicators beyond browser defaults
- Tab order not managed
- Modal and slide panel don't trap focus
- No keyboard shortcut system

### 8. LOW: Color-Only Status Indicators
Status dots (green/blue/red) rely solely on color. Users with color blindness (8% of males) cannot distinguish between statuses without reading text labels.

### 9. LOW: Topbar Crowding
The topbar packs logo, status indicators (Online, 1 running, 18 missions, 4 projects), nav links, and the New Mission button into 48px of height. At narrower desktop widths, the status text could overlap.

## Page-by-Page Audit

### Dashboard (`#/`)
- **Good:** Status banner provides quick system health. Running missions are prominent with live progress.
- **Bad:** Activity feed is a raw event log (thread.classifying, auth.ok) — not user-meaningful activity. Completed missions are tiny truncated chips at the bottom — hard to click or read.
- **Missing:** No aggregate stats (missions this week, success rate). No quick-action buttons on running missions.

### Projects (`#/projects`)
- **Good:** Clean card grid with key info (branch, mission count, GitHub/Slack links).
- **Bad:** Cards lack visual hierarchy — project name, branch info, and links all feel the same weight. No project health indicator. No search/filter.
- **Missing:** Last mission status, project avatar/icon, sort options.

### Project Detail (`#/projects/:repo`)
- **Good:** Comprehensive table with status badges and PR links.
- **Bad:** Full mission description text in table cells. Mission IDs as primary identifiers instead of meaningful names. No pagination for projects with many missions.
- **Missing:** Mission filters (by status), bulk actions, timeline view option.

### Traces (`#/traces`)
- **Good:** Filter dropdowns for project and status.
- **Bad:** Sparse data display — large empty areas. Mission column shows "--" instead of useful info.
- **Missing:** Search, date range filter, direct trace links.

### Logs (`#/logs`)
- **Good:** Real-time streaming with Live button, filter input, auto-refresh toggle.
- **Bad:** Log entries are dense monospace lines that run off-screen. Key-value payload data is hard to parse visually.
- **Missing:** Log level filtering, export, clear filters button.

### System (`#/system`)
- **Good:** Server status with uptime, donut chart, line chart for trends.
- **Bad:** Metrics summary cards are small and oddly placed below charts. "No container data available" is unhelpful. Charts have low contrast axis labels.
- **Missing:** Memory/CPU usage, disk space, recent errors summary.

### Mission Detail (slide panel)
- **Good:** Shows project, description, status, timeline, and external links.
- **Bad:** Very long descriptions dominate the panel. No objective progress visualization. Timeline is sparse.
- **Missing:** Cancel/retry actions, worker logs, cost estimate.

### New Mission Modal
- **Good:** Simple and focused — project picker, description, Slack toggle.
- **Bad:** Placeholder text is too specific ("Add email notifications..."). No description validation or character count.
- **Missing:** Template suggestions, recent mission descriptions for reference.

## Accessibility Audit

| Criteria | WCAG | Status | Notes |
|---|---|---|---|
| Color contrast (text) | 1.4.3 AA | PARTIAL | `--text` (#e8e4d9) on `--bg` (#06060a) passes. `--text-dim` (#6b6a63) on `--bg` fails (3.4:1, needs 4.5:1) |
| Color contrast (UI) | 1.4.11 AA | PARTIAL | Border colors are very low contrast. Status dots may not meet 3:1 against background |
| Non-text contrast | 1.4.11 AA | FAIL | Progress bars (4px height, low-contrast colors) are nearly invisible |
| Keyboard navigation | 2.1.1 A | FAIL | No visible focus indicators, no focus trapping in modals |
| Focus order | 2.4.3 A | FAIL | Slide panel doesn't manage focus |
| Heading hierarchy | 1.3.1 A | PARTIAL | Some sections use h3 without h1/h2 on page |
| ARIA labels | 4.1.2 A | FAIL | No ARIA labels on interactive elements, status dots, progress bars |
| Touch targets | 2.5.8 AAA | FAIL | Nav links (padding: 4px 10px), completed chips (padding: 4px 10px) are under 44px |
| Motion | 2.3.3 AAA | PARTIAL | Pulse animation runs continuously, no prefers-reduced-motion check |
| Screen reader | 4.1.2 A | FAIL | Status information conveyed only visually, no sr-only text |

## Design System Inconsistencies

1. **Font sizes jump inconsistently:** 13px, 14px, 15px used interchangeably for similar purposes. Labels are sometimes 14px, sometimes 15px, sometimes 13px.
2. **Border radius inconsistent:** Badges use `border-radius: 3px`, modals use `border-radius: 8px`, everything else uses `0` (sharp corners).
3. **Spacing non-systematic:** Padding values include 4px, 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px, 22px — no spacing scale.
4. **Button styles fragmented:** `.btn-new`, `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger` etc. have different padding, font-size, and weight.
5. **Uppercase usage inconsistent:** Some labels are text-transform uppercase, some are manual uppercase in HTML, some are mixed.

## Core Product Identification

### What is the core value?
Seeing what your AI development agents are doing right now, and taking action when they need your input (approve objectives, merge PRs, handle failures).

### Is it prominently surfaced?
Partially. Running missions are visible, but the dashboard buries action items under noise. The "pending approval" state exists but there's no dedicated attention-grabbing treatment on the home screen.

### 5 Key Screens for Mockups
1. **Dashboard** — The nerve center: running missions, items needing attention, recent completions
2. **Project Detail** — Mission history for a single project
3. **Mission Detail** — Deep-dive into a single mission's progress, objectives, timeline
4. **Traces/Observability** — Understanding agent execution
5. **New Mission Modal** — The primary user action

## Proposed Design Directions

### Direction 1: "Bridge" — Sci-Fi Command Console

**Concept:** Lean into the Star Trek theme. The dashboard becomes a literal bridge command console — structured zones for different information types, rich data visualizations, and a sense of precision and control.

**Color Palette:**
- Background: `#0a0c12` (deep space blue-black)
- Surface: `#111827` (dark navy)
- Primary: `#f59e0b` (amber/gold — LCARS-inspired)
- Secondary: `#06b6d4` (cyan)
- Success: `#10b981`
- Error: `#ef4444`
- Text: `#f1f5f9`
- Muted: `#64748b`

**Typography:**
- Display: [Exo 2](https://fonts.google.com/specimen/Exo+2) (geometric, futuristic but readable)
- Body: [IBM Plex Sans](https://fonts.google.com/specimen/IBM+Plex+Sans) (technical but proportional, highly legible)
- Mono: [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (only for IDs, code, timestamps)

**Layout Philosophy:** Zone-based. Fixed sidebar navigation (left rail), main content area divided into scannable zones (status, actions, activity). Dashboard uses a 2-column layout: left column for missions, right column for activity/metrics.

**Surface Treatment:** Subtle gradient borders (amber to cyan), rounded corners (6px), elevated cards with glow effects on active states.

**Motion:** Smooth slide transitions between views, pulsing indicators for active missions, progress bar animations.

**Icon Style:** Outlined, geometric icons. Minimal.

**How it addresses UX problems:**
- Zone-based layout creates clear information hierarchy
- Proportional body font improves readability
- Sidebar navigation solves mobile nav (collapses to bottom tab bar)
- Dedicated "Needs Attention" zone at top of dashboard
- Mission descriptions truncated with expand-on-click

**Target Audience:** Technical operators who value control and information density.
**Emotional Tone:** Commanding, precise, futuristic.
**Risks:** Could feel over-themed/gimmicky if not executed with restraint. The Star Trek metaphor is fun internally but may confuse new users.

---

### Direction 2: "Studio" — Clean Developer Tool

**Concept:** Ditch the sci-fi theming entirely. Go for the clean, professional aesthetic of best-in-class developer tools (Linear, Vercel, Raycast). Focus on clarity, speed, and beautiful simplicity.

**Color Palette:**
- Background: `#09090b` (zinc-950)
- Surface: `#18181b` (zinc-900)
- Primary: `#a78bfa` (violet — distinctive, modern)
- Secondary: `#38bdf8` (sky blue)
- Success: `#22c55e`
- Error: `#f43f5e` (rose)
- Text: `#fafafa`
- Muted: `#71717a`

**Typography:**
- Display/Body: [Inter](https://fonts.google.com/specimen/Inter) (the standard for modern dev tools — clean, highly legible)
- Mono: [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) (mission IDs, timestamps, code only)

**Layout Philosophy:** Minimal chrome, maximum content. No sidebar — top nav with clean tabs. Single-column layouts that breathe. Generous whitespace.

**Surface Treatment:** Very subtle borders (`zinc-800`), no gradients, no glow. Cards distinguished by slight background shade difference. Border-radius 8px throughout.

**Motion:** Minimal — quick 150ms transitions. No continuous animations except a subtle progress indicator.

**Icon Style:** Lucide-style outlined icons, 1.5px stroke.

**How it addresses UX problems:**
- Inter at 14px base is dramatically more readable than Space Mono
- Clean hierarchy with proper heading sizes (24px, 18px, 14px)
- Mobile-first responsive with bottom navigation
- Dashboard redesigned: action cards at top, compact mission list, no raw event feed
- Tables replaced with scannable card lists for missions

**Target Audience:** Developers and technical managers who use Linear/GitHub/Vercel daily.
**Emotional Tone:** Professional, fast, trustworthy, understated.
**Risks:** May feel generic — looks like "another dev tool." Loses the distinctive CommandDeck personality.

---

### Direction 3: "War Room" — High-Density Ops Dashboard

**Concept:** Inspired by Grafana, Datadog, and military C2 systems. Optimize for maximum information density without sacrificing clarity. This is the dashboard you put on a wall monitor in your team room.

**Color Palette:**
- Background: `#0f0f0f` (true dark)
- Surface: `#1a1a1a` (neutral gray)
- Primary: `#22d3ee` (cyan — high visibility)
- Secondary: `#fbbf24` (amber accent)
- Success: `#34d399`
- Error: `#fb7185`
- Text: `#e5e5e5`
- Muted: `#737373`

**Typography:**
- Display: [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (techy but proportional)
- Body: [DM Sans](https://fonts.google.com/specimen/DM+Sans) (compact, clear at small sizes)
- Mono: [DM Mono](https://fonts.google.com/specimen/DM+Mono) (IDs, timestamps, technical data)

**Layout Philosophy:** Grid-based dashboard. Multiple panels visible simultaneously. Dashboard is a configurable grid of widgets — running missions, system health, recent activity, project status all visible at once without scrolling.

**Surface Treatment:** Thin 1px borders, no border-radius (sharp, utilitarian). Color-coded left borders on cards for status. Dark surfaces with barely-there backgrounds.

**Motion:** Data-driven animations only — counters ticking, progress bars advancing, live log scrolling. No decorative motion.

**Icon Style:** Minimal filled icons, 16px. Status communicated through color bars and shapes, not icons.

**How it addresses UX problems:**
- Grid layout shows all critical info above the fold
- Color-coded borders provide scannable status at a glance
- Compact typography allows more data per screen
- Split-view: missions on left, detail on right (no overlay)
- Mobile adapts to stacked single-column cards

**Target Audience:** DevOps/SRE teams running multiple projects, wall-display scenarios.
**Emotional Tone:** Tactical, efficient, data-rich.
**Risks:** Can feel cold and impersonal. High density may overwhelm casual users. Not inviting for first-time setup experience.

## Decision Matrix

| Criteria | Weight | Bridge | Studio | War Room |
|---|---|---|---|---|
| Trust & credibility | 25% | 7 (1.75) | 9 (2.25) | 8 (2.00) |
| Emotional connection | 20% | 9 (1.80) | 6 (1.20) | 5 (1.00) |
| Usability / clarity | 20% | 7 (1.40) | 9 (1.80) | 7 (1.40) |
| Differentiation | 15% | 9 (1.35) | 5 (0.75) | 7 (1.05) |
| Accessibility | 10% | 7 (0.70) | 9 (0.90) | 6 (0.60) |
| Development effort | 10% | 5 (0.50) | 8 (0.80) | 6 (0.60) |
| **Weighted Total** | | **7.50** | **7.70** | **6.65** |

### Recommendation

**"Studio"** scores highest overall due to superior usability and accessibility, but **"Bridge"** is a close second with the highest emotional connection and differentiation scores. Given CommandDeck's Star Trek heritage and self-hosted niche positioning, I recommend a **hybrid approach**: adopt Studio's typography and layout principles (Inter, clean hierarchy, mobile-first), but retain Bridge's amber/cyan color palette and selective sci-fi accents (logo treatment, section dividers) to preserve the product's distinctive identity.

## Pros/Cons/Tradeoffs

| | Bridge | Studio | War Room |
|---|---|---|---|
| **Pros** | Distinctive brand identity; emotionally engaging; fun to use; memorable | Maximum readability; fastest development; most accessible; familiar patterns | Highest info density; best for monitoring; scales to many projects; wall-display ready |
| **Cons** | Theming may feel unprofessional; harder to execute well; higher dev effort | Generic appearance; no personality; forgettable | Cold/impersonal; overwhelming for new users; worst mobile experience |
| **Best for** | Solo devs, small teams who enjoy the personality | Teams adopting CommandDeck alongside other dev tools | Power users running 10+ projects simultaneously |
| **Worst for** | Enterprise buyers evaluating tools | Users wanting a distinctive product experience | First-time users during onboarding |

## Mockup Files

- [Direction 1: Bridge](mockup-direction-1-bridge.html)
- [Direction 2: Studio](mockup-direction-2-studio.html)
- [Direction 3: War Room](mockup-direction-3-war-room.html)
