---
description: Create or audit design system components with consistency checks
argument-hint: <component-name> or "audit"
---

# Design System Workflow

This workflow manages design system creation and auditing using specialized agents.

## Purpose

- Create new design system components following established patterns
- Audit existing components for consistency
- Ensure Tailwind UI integration and accessibility
- Maintain design token consistency
- Generate comprehensive component documentation

## Usage

```bash
# Create a new component
/project:design-system Button

# Audit existing design system
/project:design-system audit

# Create multiple related components
/project:design-system Card CardHeader CardBody CardFooter
```

## Workflow Phases

### Phase 1: Discovery and Analysis
**Agent**: researcher (model: haiku)
**Task**: Analyze existing design system structure
- Locate design tokens and configuration
- Identify existing component patterns
- Find Tailwind theme configuration
- Review accessibility patterns
- Catalog current components

### Phase 2: Design Architecture
**Agent**: frontend-architect (model: sonnet)
**Task**: Define component architecture
- Component API design (props, variants, states)
- Composition patterns
- TypeScript interfaces
- Integration with design tokens
- Accessibility requirements (ARIA attributes, keyboard navigation)

### Phase 3: Visual Design Specification
**Agent**: premium-ux-designer (model: sonnet)
**Task**: Create visual specifications
- Tailwind UI pattern recommendations
- Visual states (default, hover, focus, active, disabled)
- Responsive behavior
- Dark mode support
- Animation and transition specifications

### Phase 4: Implementation
**Agent**: code-writer (model: sonnet)
**Task**: Implement components
- Create React component files
- Implement all variants and states
- Add TypeScript type definitions
- Integrate design tokens
- Implement accessibility features
- Add Storybook stories (if applicable)

### Phase 5: Code Review
**Agent**: code-reviewer (model: sonnet)
**Task**: Review implementation
- Component API consistency
- Accessibility compliance (WCAG 2.1 AA)
- Performance optimization
- TypeScript type safety
- Tailwind best practices
- Reusability and composability

### Phase 6: Testing
**Agent**: test-writer (model: sonnet)
**Task**: Create comprehensive tests
- Unit tests for component logic
- Accessibility tests (jest-axe)
- Visual regression tests (if applicable)
- Interaction tests (user-event)
- Responsive behavior tests

### Phase 7: Documentation
**Agent**: documentation-writer (model: haiku)
**Task**: Generate documentation
- Component usage examples
- Props API reference
- Accessibility notes
- Design token mapping
- Storybook integration
- Migration guide (if updating existing component)

### Phase 8 (Audit Mode): Consistency Analysis
**Agent**: frontend-architect (model: sonnet)
**Task**: Audit design system
- Check component consistency
- Verify design token usage
- Validate accessibility patterns
- Identify missing components
- Recommend improvements

## Begin Orchestration

**Orchestrator Instructions:**

1. Parse the arguments to determine mode:
   - If "audit" → Run Phase 8 only
   - Otherwise → Run Phases 1-7 for each component

2. Initialize state file:
   ```bash
   bash .claude/skills/state-management/utilities/init-state.sh "design-system" "$ARGUMENTS"
   ```

3. For each phase, delegate to the specified agent with clear input/output format

4. Pass context between phases:
   - Phase 1 output → Phase 2 (architecture needs existing patterns)
   - Phase 2 output → Phase 3 (visual design needs API spec)
   - Phase 3 output → Phase 4 (implementation needs visual spec)
   - Phase 4 output → Phase 5 (review needs implementation)
   - Phase 5 output → Phase 6 (testing needs reviewed code)
   - Phase 6 output → Phase 7 (docs need test examples)

5. Update state after each phase:
   ```bash
   bash .claude/skills/state-management/utilities/update-step.sh "design-system" "phase-1" "completed"
   ```

6. Handle feedback loops:
   - If code review finds issues → return to Phase 4
   - If tests reveal bugs → return to Phase 4
   - Maximum 2 iterations per phase

7. Log all agent invocations with metrics:
   - Agent name and model
   - Task description
   - Input/output sizes
   - Duration

8. On completion, generate summary:
   - Components created/updated
   - Files modified
   - Test coverage
   - Accessibility score
   - Next steps

## Example Task Delegation

### Phase 2: Frontend Architect

```markdown
# Task: Design System Component Architecture

## Context
Creating a Button component for our design system.

## Existing Patterns
- Using Tailwind CSS for styling
- TypeScript for type safety
- Design tokens in `src/theme/tokens.ts`
- Compound component pattern for complex components

## Requirements
Design the component architecture for a Button component that supports:
- Variants: primary, secondary, outline, ghost, link
- Sizes: xs, sm, md, lg, xl
- States: default, hover, focus, active, disabled, loading
- Icons: leading and trailing icon support
- Full width option
- Custom colors via design tokens

## Output Required
1. TypeScript interface for props
2. Component composition strategy
3. Accessibility requirements
4. Integration with existing design tokens
5. Example usage code

## Format
Use the standard Frontend Architect output format.
```

### Phase 4: Code Writer

```markdown
# Task: Implement Design System Button Component

## Architecture Specification
[Output from Phase 2]

## Visual Specification
[Output from Phase 3]

## Requirements
Implement the Button component with:
- All variants and sizes
- Proper accessibility (ARIA attributes, keyboard navigation)
- Loading state with spinner
- Icon integration
- TypeScript type safety
- Tailwind styling using design tokens

## Files to Create/Modify
- `src/components/Button/Button.tsx`
- `src/components/Button/Button.types.ts`
- `src/components/Button/index.ts`

## Format
Implement complete, production-ready code.
```

## Success Criteria

- [ ] Component implemented with all required variants
- [ ] TypeScript types are complete and accurate
- [ ] Accessibility requirements met (WCAG 2.1 AA)
- [ ] Tests achieve >80% coverage
- [ ] Documentation includes usage examples
- [ ] Design tokens properly integrated
- [ ] Code review passed with no major issues
- [ ] Responsive behavior verified

## Notes

- Use the design-system-guide skill for reference patterns
- Use the component-architecture skill for structural guidance
- Use the tailwind-ui-patterns skill for styling patterns
- Use the testing-patterns skill for test structure

Execute Phase 1 with arguments: $ARGUMENTS
