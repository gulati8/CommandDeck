---
description: Complete frontend feature development with architecture, design, and implementation
argument-hint: <feature description>
---

# Frontend Feature Workflow

This workflow orchestrates complete frontend feature development with proper architecture, premium UI design, and production-ready implementation.

## Workflow Overview

**Goal**: Deliver a fully implemented, tested, and polished frontend feature.

**Common rules**: Follow `common-orchestration-rules.md`.

**Key Agents**:
- `researcher` - Explore existing frontend patterns and codebase
- `frontend-architect` - Design component hierarchy and state management
- `premium-ux-designer` - Create visual design with Tailwind UI patterns
- `code-writer` - Implement following architecture and design
- `code-reviewer` - Review for React best practices and accessibility
- `test-writer` - Create component and integration tests
- `documentation-writer` - Document component usage (if applicable)

---

## Phase 1: Research and Discovery

**Objective**: Understand existing frontend patterns and gather context.

### Tasks

1. **Delegate to `researcher`** (model: haiku):
   ```
   ## Task
   Explore the frontend codebase to understand existing patterns for the feature: $ARGUMENTS

   ## Context
   - Looking for: React component patterns, state management approach, styling conventions
   - Focus areas: Similar existing components, shared hooks, design system components

   ## Expected Output
   - Existing component patterns and conventions
   - State management approach (React Query, Zustand, Context, etc.)
   - Styling approach (Tailwind classes, component variants)
   - Relevant files and patterns to follow
   - Any existing components that can be reused
   ```

2. **Log research findings** to state file

---

## Phase 2: Architecture Planning

**Objective**: Design component structure, state management, and data flow.

### Tasks

1. **Delegate to `frontend-architect`** (model: sonnet):
   ```
   ## Task
   Design the frontend architecture for: $ARGUMENTS

   ## Context
   - Research findings: [Include Phase 1 results]
   - Existing patterns to follow: [From research]

   ## Expected Output
   Comprehensive architecture document including:
   - Component hierarchy (container/presentational split)
   - State management strategy (server state vs. client state)
   - Custom hooks needed
   - Data flow diagram
   - File structure for new components
   - Performance considerations (code splitting, memoization)
   - Accessibility requirements
   ```

2. **Review architecture** - Ensure it follows React best practices
3. **Log architecture decisions** to state file

---

## Phase 3: Visual Design

**Objective**: Create premium UI design with Tailwind patterns.

### Tasks

1. **Delegate to `premium-ux-designer`** (model: sonnet):
   ```
   ## Task
   Design the visual interface for: $ARGUMENTS

   ## Context
   - Architecture: [Include Phase 2 component hierarchy]
   - Existing design patterns: [From research]
   - Reference: .claude/skills/frontend/tailwind-ui-patterns.md

   ## Constraints
   - Use existing design system tokens
   - Follow Tailwind UI patterns
   - Mobile-first responsive design
   - Dark mode support if applicable

   ## Expected Output
   - Visual design specifications for each component
   - Tailwind class patterns to use
   - Micro-interactions and animations
   - Responsive behavior at breakpoints
   - Accessibility considerations (focus states, ARIA)
   ```

2. **Validate design consistency** with existing UI
3. **Log design decisions** to state file

---

## Phase 4: Implementation

**Objective**: Build the feature following architecture and design specs.

### Tasks

1. **Delegate to `code-writer`** (model: sonnet):
   ```
   ## Task
   Implement the frontend feature: $ARGUMENTS

   ## Context
   - Architecture: [Include Phase 2 output]
   - Design specs: [Include Phase 3 output]
   - Reference: .claude/skills/frontend/react-best-practices.md

   ## Implementation Order
   1. Create TypeScript types/interfaces
   2. Create custom hooks (data fetching, UI state)
   3. Create presentational components (bottom-up)
   4. Create container components
   5. Wire up state management
   6. Add loading/error states
   7. Implement responsive design
   8. Add accessibility features

   ## Expected Output
   - All component files created
   - Hooks implemented
   - Types defined
   - Production-ready code with error handling
   - Proper TypeScript coverage
   ```

2. **Verify implementation** matches architecture and design
3. **Log implementation summary** to state file

---

## Phase 5: Code Review

**Objective**: Ensure quality, security, and best practices.

### Tasks

1. **Delegate to `code-reviewer`** (model: sonnet):
   ```
   ## Task
   Review the frontend implementation for: $ARGUMENTS

   ## Context
   - Files to review: [Implementation files from Phase 4]
   - Architecture: [Phase 2 output]
   - Design specs: [Phase 3 output]

   ## Review Focus
   - React best practices (hooks rules, component patterns)
   - TypeScript correctness
   - Accessibility (WCAG 2.1 AA)
   - Performance (memoization, code splitting)
   - Tailwind usage consistency
   - Error handling completeness
   - Security (XSS prevention, input validation)

   ## Expected Output
   - Categorized findings (BLOCKER, CRITICAL, MAJOR, MINOR)
   - Specific fix recommendations
   - Approval status
   ```

2. **If BLOCKER/CRITICAL issues**:
   - Return to `code-writer` for fixes
   - Re-review after fixes

3. **Log review results** to state file

---

## Phase 6: Testing

**Objective**: Create comprehensive tests for the feature.

### Tasks

1. **Delegate to `test-writer`** (model: sonnet):
   ```
   ## Task
   Create tests for the frontend feature: $ARGUMENTS

   ## Context
   - Implementation: [Phase 4 files]
   - Reference: .claude/skills/frontend/testing-patterns.md
   - If E2E flows are involved: .claude/skills/playwright-mcp/SKILL.md

   ## Test Coverage
   - Unit tests for custom hooks
   - Component tests for user interactions
   - Integration tests for forms/API calls
   - Accessibility tests (axe-core)
   - Error state tests

   ## Expected Output
   - Test files for each component
   - Test utilities if needed
   - MSW handlers for API mocking
   - 80%+ coverage for critical paths
   ```

2. **Run tests** to verify passing
3. **Log test results** to state file

---

## Phase 7: Final Verification

**Objective**: Ensure the feature is complete and polished.

### Verification Checklist

- [ ] All components render correctly
- [ ] TypeScript compiles without errors
- [ ] All tests pass
- [ ] Responsive design works (mobile, tablet, desktop)
- [ ] Dark mode works (if applicable)
- [ ] Accessibility passes automated checks
- [ ] Loading states are smooth
- [ ] Error states are user-friendly
- [ ] Performance is acceptable (no unnecessary re-renders)
- [ ] Code follows project conventions

### Final Tasks

1. **Run build** to verify no compilation errors
2. **Run linter** to verify no style issues
3. **Manual smoke test** key user flows
4. **Update documentation** if needed

---

## State Tracking

Track progress in `.claude/state/frontend-feature-{timestamp}.json`:

```json
{
  "feature": "$ARGUMENTS",
  "started": "timestamp",
  "current_phase": "research|architecture|design|implementation|review|testing|verification",
  "phases": {
    "research": { "status": "pending|in_progress|completed", "findings": [] },
    "architecture": { "status": "pending", "decisions": [] },
    "design": { "status": "pending", "specs": [] },
    "implementation": { "status": "pending", "files": [] },
    "review": { "status": "pending", "issues": [] },
    "testing": { "status": "pending", "coverage": null },
    "verification": { "status": "pending", "checklist": [] }
  },
  "completed": null
}
```

---

## Quality Standards

This workflow ensures:

✅ **Senior-level architecture** - Proper component design, state management
✅ **Premium UI** - Tailwind UI patterns, micro-interactions, polish
✅ **Production-ready code** - Error handling, TypeScript, accessibility
✅ **Comprehensive testing** - Unit, integration, accessibility tests
✅ **Code quality** - Review catches issues before merge

---

## Begin Workflow

Execute Phase 1 for: $ARGUMENTS

Start by delegating to the `researcher` agent to explore existing frontend patterns.
