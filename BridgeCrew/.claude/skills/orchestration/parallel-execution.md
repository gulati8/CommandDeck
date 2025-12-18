# Parallel Execution

You can invoke multiple independent subagents simultaneously to improve throughput and reduce overall orchestration time.

## When to Use Parallel Execution

Use parallel execution when tasks meet ALL these criteria:
1. **No data dependencies** - Task B doesn't need Task A's output
2. **Independent scopes** - Tasks modify different files or areas
3. **Concurrent safety** - No risk of conflicts or race conditions

## How to Execute in Parallel

**To run subagents in parallel**: Invoke multiple Task tools in a **single message**.

**Example**:
```
In one message, invoke:
- Task tool → researcher (investigate authentication)
- Task tool → researcher (investigate authorization)
- Task tool → researcher (investigate session management)

Then wait for all three to complete before proceeding.
```

## Parallel Execution Patterns

### Pattern 1: Parallel Research

```
Phase: Research
Goal: Understand multiple independent areas

Parallel invocation:
1. researcher → "Investigate frontend routing patterns"
2. researcher → "Investigate backend API structure"
3. researcher → "Investigate database schema"

Synchronization: Collect all three results
Next: Synthesize findings before planning
```

### Pattern 2: Parallel Testing

```
Phase: Testing
Goal: Test multiple independent modules

Parallel invocation:
1. test-writer → "Create tests for auth module"
2. test-writer → "Create tests for payment module"
3. test-writer → "Create tests for notification module"

Synchronization: Wait for all tests to complete
Next: Run full test suite
```

### Pattern 3: Parallel Review

```
Phase: Code Review
Goal: Review multiple changed files

Parallel invocation:
1. code-reviewer → "Review src/auth/*.ts"
2. code-reviewer → "Review src/api/*.ts"
3. code-reviewer → "Review src/db/*.ts"

Synchronization: Merge all review findings
Next: Consolidate and prioritize issues
```

### Pattern 4: Parallel Implementation (Independent Modules)

```
Phase: Implementation
Goal: Build independent features simultaneously

Parallel invocation:
1. code-writer → "Implement user authentication module"
2. code-writer → "Implement logging module"
3. code-writer → "Implement caching module"

Synchronization: Collect all implementations
Next: Integration step (sequential)
```

### Pattern 5: Parallel Documentation

```
Phase: Documentation
Goal: Document multiple independent areas

Parallel invocation:
1. documentation-writer → "Document API endpoints"
2. documentation-writer → "Document deployment process"
3. documentation-writer → "Document testing strategy"

Synchronization: Collect all documentation
Next: Review for consistency
```

## Synchronization Points

After parallel execution, you MUST:

1. **Wait for all tasks to complete** - Don't proceed until every parallel task returns
2. **Check status of each** - Some may succeed while others fail
3. **Handle partial success**:
   ```
   IF all tasks succeeded
     THEN proceed with all results
   ELSE IF some tasks succeeded
     THEN proceed with partial results, log failures
   ELSE IF all tasks failed
     THEN escalate to error recovery
   ```
4. **Merge results** - Combine outputs into coherent synthesis
5. **Update state** - Record all parallel executions in state file

**Example Synchronization**:
```
Parallel execution: 3 research tasks
Results:
- Task 1 (frontend): ✅ Success
- Task 2 (backend): ✅ Success
- Task 3 (database): ❌ Failed (couldn't find schema)

Action:
- Proceed with frontend + backend findings
- Retry database research with refined scope
- Update state file with partial completion
```

## Parallel Execution Limits

**Max parallel tasks**: 3-4 subagents recommended
- More than 4 becomes hard to track
- Increases token usage significantly
- May hit rate limits

**When NOT to use parallel execution**:
- Tasks have data dependencies (A's output needed for B)
- Tasks modify the same files
- Debugging a failure (sequential is clearer)
- Total context would exceed token limits

## Example: Parallel-Then-Sequential Workflow

```
Step 1: Parallel Research (3 areas simultaneously)
  → researcher (authentication)
  → researcher (authorization)
  → researcher (session management)

Synchronization Point 1: Collect all research

Step 2: Sequential Planning (needs combined research)
  → planner (design security architecture using all research)

Step 3: Parallel Implementation (independent modules)
  → code-writer (implement auth module)
  → code-writer (implement authz module)
  → code-writer (implement session module)

Synchronization Point 2: Collect all implementations

Step 4: Sequential Integration (needs all modules)
  → code-writer (integrate all modules)

Step 5: Sequential Review (holistic check)
  → code-reviewer (review entire security system)
```

## State File Tracking for Parallel Execution

Document parallel executions clearly in state file:

```markdown
### Step 2: Research (Parallel)
- **Status**: ✅ Complete
- **Parallel Tasks**:
  1. researcher (authentication) → ✅ Found JWT patterns in src/auth/
  2. researcher (authorization) → ✅ Found RBAC in src/permissions/
  3. researcher (session) → ✅ Found Redis session store
- **Result Summary**: All three research tasks completed successfully. System uses JWT + RBAC + Redis sessions.
- **Files Identified**: src/auth/jwt.ts, src/permissions/rbac.ts, src/session/redis.ts
- **Notes**: Parallel execution saved ~5 minutes vs sequential
```

## Advanced Parallel Patterns

### Pattern: Parallel-Then-Merge

```
Use case: Multiple perspectives on same problem

1. Invoke in parallel:
   - security-auditor → "Assess authentication security"
   - api-designer → "Assess authentication API design"
   - performance-optimizer → "Assess authentication performance"

2. Synchronization: Collect all assessments

3. Invoke feedback-coordinator:
   - "Synthesize security, design, and performance perspectives"
   - "Identify conflicts or trade-offs"
   - "Recommend balanced approach"

4. Proceed with synthesized recommendation
```

### Pattern: Parallel Validation

```
Use case: Multi-faceted validation

1. Code implementation complete

2. Invoke in parallel:
   - code-reviewer → "Review for code quality"
   - security-auditor → "Review for security"
   - test-writer → "Verify test coverage"

3. Synchronization: Collect all reviews

4. IF any critical issues
   THEN consolidate feedback and fix
   ELSE proceed to deployment
```

### Pattern: Parallel Optimization

```
Use case: Optimize multiple independent areas

1. Baseline performance established

2. Invoke in parallel:
   - performance-optimizer → "Optimize database queries"
   - performance-optimizer → "Optimize frontend rendering"
   - performance-optimizer → "Optimize API response times"

3. Synchronization: Collect all optimizations

4. Implement all optimizations (if independent)
   OR prioritize based on impact (if resource-constrained)
```

## Handling Parallel Failures

### Scenario 1: One Task Fails

```
Parallel tasks: A, B, C
Results: A ✅, B ❌, C ✅

Action:
1. Proceed with A and C results
2. Retry B with refinement (Level 1 recovery)
3. If B succeeds, incorporate result
4. If B fails again, continue without B (log as partial completion)
```

### Scenario 2: Multiple Tasks Fail

```
Parallel tasks: A, B, C
Results: A ❌, B ❌, C ✅

Action:
1. Invoke debugger on A and B failures
2. Determine if failures are related or independent
3. If related: Fix root cause, retry both
4. If independent: Handle each separately (may become sequential)
```

### Scenario 3: All Tasks Fail

```
Parallel tasks: A, B, C
Results: A ❌, B ❌, C ❌

Action:
1. Likely systemic issue (wrong approach, missing context, etc.)
2. Don't retry in parallel
3. Invoke debugger to analyze overall approach
4. Revise strategy (may need sequential execution instead)
5. Escalate to user if pattern unclear
```

## Performance Considerations

**Benefits of Parallel Execution**:
- Reduced wall-clock time (3 tasks in parallel vs 3 sequential)
- Better resource utilization
- Faster feedback cycles

**Costs of Parallel Execution**:
- Higher token usage (all contexts loaded simultaneously)
- More complex to debug
- Risk of partial failures
- Harder to track in real-time

**When to choose sequential over parallel**:
- Total token count would be very high
- Debugging a complex issue
- Tasks have subtle dependencies
- User is watching progress in real-time
