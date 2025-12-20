# Workflow Patterns

This document describes common workflow patterns used in orchestration. These patterns can be invoked automatically via intent detection or explicitly via slash commands.

## Feature Development Workflow

**Intent triggers**: "add", "create", "build", "implement", "I need", "can you make"

**Pattern**:
```
1. researcher → Explore codebase for relevant patterns
2. planner → Design implementation approach
3. code-writer → Implement the feature
4. code-reviewer → Review for quality/security
5. test-writer → Create tests
6. documentation-writer → Update docs (if needed)
```

**When to use**:
- Adding new functionality
- Creating new components/modules
- Building new features

**Example**:
> User: "Add a dark mode toggle to the settings"
>
> Orchestrator executes:
> - researcher: Find existing theme/settings patterns
> - planner: Design dark mode implementation
> - code-writer: Implement toggle + theme switching
> - code-reviewer: Review implementation
> - test-writer: Add tests for theme switching
> - documentation-writer: Update README if setup affected

## Bug Fixing Workflow

**Intent triggers**: "fix", "broken", "not working", "error", "bug", "issue with"

**Pattern**:
```
1. researcher → Investigate the issue, find relevant code
2. debugger → Diagnose root cause (if needed)
3. code-writer → Fix the bug
4. test-writer → Add regression tests
5. code-reviewer → Verify the fix
```

**When to use**:
- Something is broken
- Error reports
- Unexpected behavior

**Example**:
> User: "The checkout button isn't working"
>
> Orchestrator executes:
> - researcher: Examine checkout flow, find button code
> - debugger: Analyze why button isn't responding
> - code-writer: Fix the event handler issue
> - test-writer: Add test for button click behavior
> - code-reviewer: Verify fix doesn't introduce issues

## Refactoring Workflow

**Intent triggers**: "refactor", "improve", "clean up", "reorganize", "optimize code structure"

**Pattern**:
```
1. researcher → Analyze current code structure
2. code-refactorer → Improve code quality
3. test-writer → Ensure tests still pass
4. code-reviewer → Verify improvements
```

**When to use**:
- Code quality improvements
- Technical debt reduction
- Structural improvements without functional changes

**Example**:
> User: "Clean up the user service"
>
> Orchestrator executes:
> - researcher: Analyze user service code structure
> - code-refactorer: Refactor for better organization/readability
> - test-writer: Verify all tests still pass
> - code-reviewer: Confirm improvements maintain correctness

## Planning Workflow

**Intent triggers**: "how would you", "what's the approach", "plan for", "design", "architecture for"

**Pattern**:
```
1. researcher → Understand current state
2. planner → Design approach and architecture
3. STOP → Present plan to user, don't implement
```

**When to use**:
- Exploratory questions
- Architecture decisions
- Before committing to implementation

**Example**:
> User: "How should we implement caching?"
>
> Orchestrator executes:
> - researcher: Analyze current data access patterns
> - planner: Design caching strategy with trade-offs
> - Present plan to user, await decision on implementation

## Code Review Workflow

**Intent triggers**: "review", "check", "audit", "look at", "assess quality"

**Pattern**:
```
1. researcher → Understand the code being reviewed (if needed)
2. code-reviewer → Review for quality/security/best practices
3. Present findings → Report issues and recommendations
```

**When to use**:
- Pre-merge reviews
- Security audits
- Quality assessments

**Example**:
> User: "Review the authentication implementation"
>
> Orchestrator executes:
> - researcher: Examine auth code and patterns
> - code-reviewer: Review for security, quality, best practices
> - Present: Critical issues, warnings, recommendations

## Documentation Workflow

**Intent triggers**: "document", "write docs", "README", "explain how to"

**Pattern**:
```
1. researcher → Understand project structure, tech stack, setup
2. documentation-writer → Create/update documentation
   - Follow minimal README principle
   - Reference .claude/skills/documentation/readme-guide.md
```

**When to use**:
- Creating/updating READMEs
- Writing guides
- Explaining features/setup

**Special considerations for documentation**:
- **READMEs must be minimal** (5-minute entry point, 100-200 lines max)
- **Follow layering principle**: Quick start → README, Everything else → `docs/`
- **No marketing language**: Be factual and direct
- **When fixing READMEs**: Check if architectural/implementation content should move to `docs/ARCHITECTURE.md`
- **When documenting features**: Decide between README (if affects setup) vs `docs/guides/`

**Example**:
> User: "Document the new OAuth setup"
>
> Orchestrator executes:
> - researcher: Understand OAuth implementation and requirements
> - documentation-writer: Add minimal setup steps to README
> - documentation-writer: Create detailed guide in docs/authentication.md

## Quick Fix Workflow

**Intent triggers**: "tiny change", "small tweak", "one-line", "typo", "minor fix"

**Pattern**:
```
1. researcher → (optional) confirm exact file/spot if unclear
2. code-writer → Apply minimal change
3. code-reviewer → Sanity check for regressions
```

**When to use**:
- Very small changes (1-2 files, low risk)
- Typo fixes or tiny logic tweaks

**Example**:
> User: "Fix this typo in the README"
>
> Orchestrator executes:
> - researcher: Locate the typo (if needed)
> - code-writer: Apply the correction
> - code-reviewer: Confirm no collateral changes

## Frontend Feature Workflow

**Intent triggers**: "UI", "component", "page", "design", "interface" (combined with feature keywords)

**Pattern**:
```
1. researcher → Explore frontend patterns and component structure
2. frontend-architect → Design component architecture
3. premium-ux-designer → Create UI/UX specifications
4. code-writer → Implement components
5. test-writer → Create component tests
6. code-reviewer → Review implementation
```

**When to use**:
- Building UI components
- Creating new pages
- Frontend-specific features

**Example**:
> User: "Add a user profile card component"
>
> Orchestrator executes:
> - researcher: Find existing card components and patterns
> - frontend-architect: Define component API and structure
> - premium-ux-designer: Design visual specifications with Tailwind
> - code-writer: Implement ProfileCard component
> - test-writer: Add component tests
> - code-reviewer: Review implementation

## Security Audit Workflow

**Intent triggers**: "security", "audit", "vulnerability", "threat" (combined with review keywords)

**Pattern**:
```
1. researcher → Identify attack surface and sensitive areas
2. security-auditor → Perform STRIDE threat modeling
3. Present findings → Report vulnerabilities and recommendations
4. (If fixes requested) code-writer → Implement security fixes
5. security-auditor → Re-verify fixes
```

**When to use**:
- Pre-deployment security reviews
- After security-sensitive changes
- Regular security assessments

**Example**:
> User: "Security audit the API endpoints"
>
> Orchestrator executes:
> - researcher: Map all API endpoints and authentication flows
> - security-auditor: Threat model using STRIDE, identify vulnerabilities
> - Present: Critical vulnerabilities, recommendations, risk assessment

## Design System Workflow

**Intent triggers**: Explicit command `/project:design-system` or "design system", "component library"

**Pattern**:
```
For component creation:
1. frontend-architect → Define design system principles
2. premium-ux-designer → Create component specifications
3. code-writer → Implement base components
4. test-writer → Create component tests
5. documentation-writer → Document component usage

For audit:
1. researcher → Analyze existing components
2. premium-ux-designer → Audit for consistency
3. Present findings → Report inconsistencies and improvements
```

## Performance Optimization Workflow

**Intent triggers**: "slow", "performance", "optimize speed", "improve performance"

**Pattern**:
```
1. researcher → Identify performance bottleneck areas
2. performance-optimizer → Analyze and suggest optimizations
3. (Choose path based on bottleneck):
   - Database: database-architect → optimize queries
   - Frontend: frontend-architect → optimize rendering
   - API: api-designer → optimize endpoints
4. code-writer → Implement optimizations
5. Benchmark → Verify improvements
6. code-reviewer → Review changes
```

## Workflow Composition

Workflows can be composed and adapted:

**Conditional composition**:
```
IF feature affects frontend
  THEN use Frontend Feature Workflow
ELSE IF feature affects API
  THEN use Feature Development Workflow with api-designer
ELSE
  THEN use standard Feature Development Workflow
```

**Parallel composition**:
```
For full-stack feature:
- Run Frontend Feature Workflow (UI components)
- Run Feature Development Workflow (Backend API)
- Synchronize: code-writer integrates frontend + backend
```

## Best Practices

1. **Detect intent automatically** - Don't ask users to invoke workflows explicitly
2. **Adapt workflows** - Add/remove steps based on context
3. **Start with research** - Almost all workflows begin with understanding current state
4. **End with verification** - Most workflows should include review/testing
5. **Document as needed** - Add documentation step if feature affects setup/usage
6. **Use delegation levels** - Apply 7 Levels of Delegation within workflows
7. **Validate outputs** - Use the output contract and validator before chaining results
8. **Log all steps** - Hook logs are automatic; add metrics to state for cost analysis
9. **Use feedback loops** - For review/fix cycles, prefer `feedback-coordinator` to reduce overhead
10. **Review new dependencies** - Require explicit approval and run a security/license check
