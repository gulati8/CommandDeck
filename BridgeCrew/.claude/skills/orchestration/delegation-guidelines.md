# 7 Levels of Delegation - Quick Reference

Use this guide to determine your delegation level for each task.

## Quick Decision Tree

```
1. Does this follow an exact existing pattern? (3+ examples)
   YES → Check: Single file, <20 lines, reversible?
     YES → AUTONOMOUS (Level 1-2)
     NO → CONSULT (Level 3)
   NO → Continue

2. Is this a standard refactoring operation?
   YES → AUTONOMOUS (Level 1-2)
   NO → Continue

3. Does this involve:
   - New dependencies?
   - Breaking changes?
   - >5 files?
   - Architecture changes?
   YES → AGREE (Level 4)
   NO → Continue

4. Are there multiple valid approaches?
   YES → CONSULT (Level 3)
   NO → AGREE (Level 4) [if you're unsure]
```

## Autonomous Execution Checklist

Before executing autonomously, verify ALL of these:

- [ ] Pattern exists: 3+ consistent examples in codebase
- [ ] Scope is limited: ≤5 files affected
- [ ] Changes are reversible
- [ ] No new dependencies
- [ ] No breaking changes
- [ ] Requirements are clear
- [ ] Confidence level: High

If ANY checkbox is unchecked → Escalate to CONSULT or AGREE level.

## Communication Templates

### Autonomous Execution Announcement

"I recognize this as {pattern_type}. The codebase contains {N} examples of this pattern in {files}. Following this established precedent, I'll {action}."

### Consultation Request

"I've analyzed this with {agent_name}. The situation presents {N} viable approaches:

**Option A**: {description}
- Advantages: {pros}
- Trade-offs: {cons}

**Option B**: {description}
- Advantages: {pros}
- Trade-offs: {cons}

Which direction aligns better with your vision for this project?"

### Agreement Request

"This is a significant architectural decision. Let me present the situation:

**Current State**: {what exists}
**Proposed Change**: {what we'd do}
**Implications**: {what this means}
- {implication 1}
- {implication 2}

{Planner} recommends {approach} because {reasoning}. Does this align with your goals? Let's discuss before proceeding."

## Pattern Recognition Process

1. Invoke researcher: "Identify all implementations of {pattern} in the codebase"
2. Analyze researcher findings:
   - 3+ consistent examples? → Pattern established
   - Examples vary in structure? → Pattern unclear
   - <3 examples? → No pattern
3. If pattern established, verify it matches the current need exactly
4. If match is exact and scope is limited → Proceed autonomously
5. Otherwise → Escalate

## Context-Aware Escalation Formula

```
Impact Score = (Files Affected × 2) + (New Dependencies × 10) + (Breaking Changes × 20)
Confidence Score = (Pattern Matches × 10) + (Similar Recent Commits × 5) + (Clear Requirements × 10)

Decision:
- If Impact Score > 30 → AGREE (Level 4)
- If Impact Score > 15 AND Confidence < 40 → CONSULT (Level 3)
- If Confidence > 70 AND Impact < 15 → AUTONOMOUS (Level 1-2)
- Otherwise → CONSULT (Level 3)

Uncertainty Adjustment:
If uncertain about scores → Add +1 delegation level
```

## Low-Risk Change Categories

### Category 1: Pure Refactoring (Always Autonomous if pattern exists)
- Extract Method/Function
- Rename (variable, function, class)
- Move (to different file, maintaining same exports)
- Inline (variable, function)
- Change Method Signature (with automated updates to callers)

### Category 2: Documentation (Always Autonomous)
- README updates
- Code comments
- JSDoc/docstrings
- API documentation
- CHANGELOG entries

### Category 3: Tests - Non-Breaking (Always Autonomous)
- Add new test cases
- Improve test coverage
- Add test utilities
- Refactor test code

### Category 4: Configuration (Autonomous if following schema)
- Add linting rules
- Update prettier config
- Modify .gitignore
- Add environment variables (non-secret)

### Category 5: Minor Bugs (Autonomous if criteria met)
Requirements for autonomous bug fix:
- <20 lines changed
- Single file affected
- Clear root cause identified
- No breaking changes
- Examples: off-by-one errors, typos, missing null checks

## Escalation Scenarios

### Always Escalate (AGREE - Level 4)

- Adding new dependencies (npm packages, libraries)
- Breaking API changes
- Database schema migrations
- Authentication/authorization changes
- Major refactoring (>5 files)
- New architectural patterns
- Security-critical changes
- Deployment configuration changes

### Usually Escalate (CONSULT - Level 3)

- Performance optimizations with trade-offs
- Multiple valid implementation approaches
- Moderate refactoring (2-5 files)
- New features without clear precedent
- Changes to core business logic
- API endpoint modifications
- State management changes

### Can Be Autonomous (Level 1-2)

- Following established patterns exactly (3+ examples)
- Standard refactoring operations
- Documentation and comment updates
- Test additions (no production code changes)
- Configuration following documented format
- Bug fixes (<20 lines, single file, clear cause)
- Code style/linting fixes

## Decision Examples

### Example 1: Add API Endpoint

**Scenario**: User requests "Add GET /api/users endpoint"

**Decision Process**:
1. Invoke researcher to find similar endpoints
2. Researcher finds: `/api/posts`, `/api/comments`, `/api/tags` - all follow identical pattern
3. Pattern: Express route → Joi validation → async controller → error handling
4. Impact: 2 files (routes.ts, controllers/users.ts), no dependencies, reversible
5. Confidence: High (3+ examples, clear pattern)

**Result**: AUTONOMOUS
**Announcement**: "I recognize this as our standard Express REST endpoint pattern. The codebase contains three examples (posts, comments, tags) following identical structure. Following this precedent, I'll implement the users endpoint."

### Example 2: Add Authentication

**Scenario**: User requests "Add authentication to the app"

**Decision Process**:
1. Invoke researcher to understand current state
2. No authentication exists currently
3. Multiple valid approaches: JWT, session-based, OAuth
4. Impact: High (affects many files, architecture change)
5. Confidence: Medium (no existing pattern)

**Result**: CONSULT or AGREE (depending on complexity)
**Announcement**: "I've consulted with researcher. Adding authentication is a significant architectural decision. I see three viable approaches:

**Option A: JWT tokens**
- Advantages: Stateless, scalable, works well for APIs
- Trade-offs: Token management, refresh logic needed

**Option B: Session-based**
- Advantages: Simpler, built-in Express support
- Trade-offs: Requires session store, not ideal for distributed systems

**Option C: OAuth (third-party)**
- Advantages: Secure, offloads auth complexity
- Trade-offs: Vendor lock-in, additional dependency

Which direction aligns better with your architecture goals?"

### Example 3: Fix Off-by-One Error

**Scenario**: User reports "Array index error in pagination"

**Decision Process**:
1. Invoke researcher to locate pagination code
2. Find bug: `for (let i = 0; i <= array.length; i++)` should be `< array.length`
3. Impact: 1 line, 1 file, no dependencies, easily reversible
4. Confidence: High (clear bug, obvious fix)
5. Category: Minor bug (<20 lines)

**Result**: AUTONOMOUS
**Announcement**: "I've identified an off-by-one error in pagination logic at `utils/pagination.ts:42`. This is a standard bug fix affecting a single line. Following best practices for loop bounds, I'll correct the comparison."

### Example 4: Refactor Component Structure

**Scenario**: User requests "Refactor the Dashboard component - it's too complex"

**Decision Process**:
1. Invoke researcher to analyze Dashboard component
2. Researcher reports: 500+ lines, multiple responsibilities
3. Multiple valid approaches: Split by feature, by layer, by container/presentation
4. Impact: Medium-High (affects Dashboard and creates new files)
5. Confidence: Medium (no single obvious approach)

**Result**: CONSULT
**Announcement**: "I've analyzed the Dashboard component with researcher. It's 500+ lines with mixed concerns. I see several refactoring strategies:

**Option A: Split by feature**
- Create DashboardMetrics, DashboardCharts, DashboardFilters
- Advantages: High cohesion, easy to understand
- Trade-offs: More files, need shared state management

**Option B: Container/Presentation split**
- Separate data logic from UI rendering
- Advantages: Reusable presentations, testability
- Trade-offs: More abstraction, learning curve

What's your preferred approach?"

## Tips for Using This Guide

1. **When in doubt, escalate** - It's better to ask than to make a wrong autonomous decision
2. **Pattern recognition is key** - Spend time with researcher to find precedents
3. **Document your reasoning** - Always explain why you chose a delegation level
4. **Use the formulas** - Calculate Impact and Confidence scores to guide decisions
5. **Trust the checklist** - If any autonomous checklist item is unchecked, escalate
6. **Communicate clearly** - Use the templates to structure your announcements
7. **Learn from feedback** - If user overrides your autonomous decisions, adjust your criteria
