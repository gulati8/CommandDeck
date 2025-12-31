# Task Template Format

When delegating to a subagent, structure your prompt using this template to ensure clear, actionable instructions with all necessary context.

## Standard Task Template

```markdown
## Task
[Clear, actionable description of what to accomplish]

## Context
- **Files**: [List of relevant file paths]
- **Information**: [Background details needed for this task]
- **Prior Results**: [Relevant output from previous steps, if any]
- **Context Checklist**:
  - Only include files and snippets that are required to complete the task.
  - Summarize long content; avoid full-file dumps.
  - Exclude unrelated history or prior decisions.

## Constraints
- **Scope**: [What to focus on]
- **Avoid**: [What NOT to do]
- **Dependencies**: [What must be true before this task]

## Expected Output
- **Format**: [json | markdown | code | freeform]
- **Include**: [Specific elements to include in response]
- **Exclude**: [What to omit from response]
  - **Contract**: Must follow `.claude/skills/orchestration/agent-output-contract.md` (YAML frontmatter preferred)
```

## Best Practices for Task Decomposition

1. **Be specific and actionable** - Tasks should have clear success criteria
2. **Include relevant context** - Provide file paths, prior results, and background
3. **Set clear constraints** - Define scope boundaries and what to avoid
4. **Specify output format** - Tell the agent exactly what you need back
5. **One responsibility per task** - Keep tasks focused and single-purpose
6. **Pass only what's needed** - Don't overload agents with irrelevant information

## Template Examples

### Research Task Example

```markdown
## Task
Investigate how authentication is currently implemented in the codebase

## Context
- **Files**: Not yet known - discover during research
- **Information**: User wants to add OAuth support
- **Prior Results**: None (first step in workflow)

## Constraints
- **Scope**: Focus on authentication flows and session management
- **Avoid**: Don't analyze authorization or permissions yet
- **Dependencies**: None

## Expected Output
- **Format**: Markdown report
- **Include**:
  - List of authentication-related files
  - Current auth strategy (JWT, sessions, etc.)
  - Integration points where OAuth would fit
  - Potential challenges or conflicts
- **Exclude**: Implementation details or code snippets
```

### Planning Task Example

```markdown
## Task
Design an implementation plan for adding dark mode support

## Context
- **Files**:
  - src/styles/theme.ts (current theme configuration)
  - src/components/Layout.tsx (main layout component)
- **Information**: App uses Tailwind CSS with custom theme
- **Prior Results**: Researcher found theme is defined in tailwind.config.js

## Constraints
- **Scope**: UI theme switching only (not data/API changes)
- **Avoid**: Don't plan for user preference persistence yet
- **Dependencies**: Must work with existing Tailwind setup

## Expected Output
- **Format**: Structured plan with steps
- **Include**:
  - Architecture approach (CSS variables, Tailwind classes, etc.)
  - Files to modify
  - Component changes needed
  - Testing strategy
  - Estimated complexity (simple/moderate/complex)
- **Exclude**: Actual code implementation
```

### Implementation Task Example

```markdown
## Task
Implement the UserProfile component according to the design plan

## Context
- **Files**:
  - src/components/UserProfile.tsx (to be created)
  - src/types/User.ts (existing user type definitions)
- **Information**: Component displays user avatar, name, and bio
- **Prior Results**:
  - Planner specified using compound component pattern
  - Designer provided Tailwind classes for styling

## Constraints
- **Scope**: UserProfile component only (not the profile page)
- **Avoid**: Don't add edit functionality yet (future task)
- **Dependencies**: User type already exists, no API changes needed

## Expected Output
- **Format**: Code implementation
- **Include**:
  - UserProfile.tsx component file
  - Any necessary sub-components
  - PropTypes or TypeScript interfaces
  - Basic accessibility attributes
- **Exclude**: Tests (separate task), documentation
```

### Review Task Example

```markdown
## Task
Review the authentication implementation for security issues

## Context
- **Files**:
  - src/auth/login.ts (login flow)
  - src/auth/middleware.ts (auth middleware)
  - src/api/auth.routes.ts (auth endpoints)
- **Information**: New JWT-based auth system
- **Prior Results**: Code-writer implemented JWT authentication

## Constraints
- **Scope**: Security review only (not performance or style)
- **Avoid**: Don't review test files or documentation
- **Dependencies**: Code is already implemented and syntactically valid

## Expected Output
- **Format**: Structured review report
- **Include**:
  - Critical issues (must fix before merge)
  - Warnings (should fix but not blocking)
  - Security best practices missed
  - Positive findings (what was done well)
- **Exclude**: Line-by-line code style suggestions
```

### Test Writing Task Example

```markdown
## Task
Create comprehensive tests for the UserProfile component

## Context
- **Files**:
  - src/components/UserProfile.tsx (implementation)
  - src/components/__tests__/UserProfile.test.tsx (to be created)
- **Information**: Component renders user data with conditional display logic
- **Prior Results**: Component implemented and reviewed

## Constraints
- **Scope**: Unit tests for UserProfile component
- **Avoid**: Don't write integration tests yet (separate task)
- **Dependencies**: Component must be implemented first

## Expected Output
- **Format**: Test file
- **Include**:
  - Happy path tests
  - Edge cases (missing data, null values)
  - Accessibility tests
  - Coverage for all props and states
  - Test descriptions following "should..." pattern
- **Exclude**: E2E tests, performance benchmarks
```

### Documentation Task Example

```markdown
## Task
Update the README with setup instructions for the new auth system

## Context
- **Files**:
  - README.md (to be updated)
  - docs/authentication.md (detailed auth docs exist here)
- **Information**: Added OAuth support alongside existing JWT auth
- **Prior Results**: OAuth implementation complete and tested

## Constraints
- **Scope**: README quick start section only
- **Avoid**: Don't duplicate detailed content from docs/authentication.md
- **Dependencies**: Auth system must be working and tested

## Expected Output
- **Format**: Markdown content for README
- **Include**:
  - Brief setup steps for OAuth
  - Link to detailed docs
  - Environment variables needed
  - Quick example/usage
- **Exclude**: Detailed architecture explanations (those go in docs/)
```

## Common Pitfalls to Avoid

1. **Vague tasks** - "Improve the code" is not actionable
2. **Missing context** - Agents can't read your mind or see previous conversation
3. **Overloaded tasks** - One task shouldn't require 10+ file changes
4. **Unclear success criteria** - Agent won't know when they're done
5. **No constraints** - Unbounded tasks lead to scope creep
6. **Assuming shared knowledge** - Always pass necessary information explicitly
