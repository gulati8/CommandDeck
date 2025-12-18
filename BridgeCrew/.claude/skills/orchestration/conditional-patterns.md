# Conditional Orchestration

You can use conditional logic to make orchestrations adaptive and intelligent based on subagent results and runtime conditions.

## IF/THEN Pattern

**When to use**: Decision points based on subagent results

**Syntax**:
```
IF [condition based on result]
THEN [action A]
ELSE [action B]
```

**Example**:
```
1. Invoke code-reviewer
2. IF reviewer.status == "CHANGES_REQUESTED"
   THEN invoke code-writer to fix critical issues
   ELSE proceed to next phase
```

## WHILE Loop Pattern

**When to use**: Iterative improvement until criteria met

**Syntax**:
```
WHILE [condition] AND [attempts < max_attempts]
  DO [action]
  UPDATE [condition]
```

**Example**:
```
attempts = 0
WHILE test_coverage < 80% AND attempts < 3
  Invoke test-writer to improve coverage
  Run coverage analysis
  attempts += 1

IF test_coverage < 80%
  THEN log warning and continue
```

## Conditional Workflow Examples

### Example 1: Review-Fix Loop

```
1. Invoke code-writer to implement feature
2. Invoke code-reviewer
3. IF critical_issues > 0
   THEN
     - Update state: "Fixing critical issues"
     - Invoke code-writer with reviewer feedback
     - Invoke code-reviewer again (one retry)
     - IF still has critical issues
       THEN escalate to user
       ELSE proceed
   ELSE
     - Update state: "Review passed"
     - Proceed to testing
```

### Example 2: Progressive Test Coverage

```
attempts = 0
WHILE coverage < target_coverage AND attempts < 3
  1. Invoke test-writer: "Increase coverage to {target_coverage}%"
  2. Run: npm run test:coverage
  3. Parse coverage percentage
  4. attempts += 1

IF coverage >= target_coverage
  THEN update state: "Coverage target met"
  ELSE update state: "Coverage at {coverage}%, below target"
```

### Example 3: Conditional Decomposition

```
1. Invoke researcher to assess complexity
2. IF complexity == "HIGH"
   THEN
     - Break task into 3 smaller subtasks
     - Execute each with code-writer sequentially
   ELSE
     - Execute entire task with single code-writer invocation
```

### Example 4: Security-Gated Deployment

```
1. Invoke security-auditor on production code
2. IF critical_vulnerabilities > 0
   THEN
     - Update state: "Blocking deployment due to security issues"
     - Invoke code-writer to fix vulnerabilities
     - Re-run security-auditor
     - IF still has critical issues
       THEN escalate to user: "Cannot deploy safely"
       ELSE proceed to deployment
   ELSE
     - Proceed to devops-engineer deployment
```

### Example 5: Adaptive Testing Strategy

```
1. Invoke code-writer to implement feature
2. Analyze feature complexity (count files changed, lines added)
3. IF files_changed <= 2 AND lines_added <= 100
   THEN
     - Invoke test-writer: "Create unit tests only"
   ELSE IF files_changed <= 5
   THEN
     - Invoke test-writer: "Create unit and integration tests"
   ELSE
     - Invoke test-writer: "Create comprehensive test suite including E2E"
```

### Example 6: Performance-Driven Optimization Loop

```
1. Invoke performance-optimizer: "Analyze current performance"
2. baseline_time = performance_optimizer.result.response_time

3. attempts = 0
   WHILE current_time > target_time AND attempts < 3
     - Invoke performance-optimizer: "Suggest optimization for slowest operation"
     - Invoke code-writer: "Implement optimization"
     - Run performance benchmark
     - current_time = benchmark_result
     - attempts += 1

4. IF current_time <= target_time
   THEN
     - improvement = ((baseline_time - current_time) / baseline_time) * 100
     - Report: "Performance improved by {improvement}%"
   ELSE
     - Report: "Performance improved but didn't meet target. Consider architectural changes."
```

### Example 7: Multi-Path Architecture Decision

```
1. Invoke researcher: "Analyze current database usage patterns"
2. IF researcher.result.query_complexity == "SIMPLE"
   THEN
     - Use lightweight approach: REST + simple queries
     - Invoke api-designer: "Design REST endpoints"
   ELSE IF researcher.result.query_complexity == "MODERATE"
   THEN
     - Use moderate approach: REST + query optimization
     - Invoke database-architect: "Optimize schema and queries"
     - Invoke api-designer: "Design REST endpoints with optimized queries"
   ELSE
     - Use advanced approach: GraphQL + complex query handling
     - Invoke api-designer: "Design GraphQL schema"
     - Invoke database-architect: "Design efficient data loading strategy"
```

### Example 8: Documentation Completeness Check

```
1. Invoke documentation-writer: "Document new feature"
2. Invoke researcher: "Check if feature affects setup/installation"
3. IF researcher.result.affects_setup == true
   THEN
     - Invoke documentation-writer: "Update README with setup changes"
     - Invoke documentation-writer: "Update installation guide"
   ELSE
     - Skip README updates (feature is internal-only)
```

## Best Practices for Conditional Logic

1. **Always set max iteration limits** - Prevent infinite loops
   ```
   ❌ BAD: WHILE test_coverage < 80%
   ✅ GOOD: WHILE test_coverage < 80% AND attempts < 3
   ```

2. **Update state on each iteration** - Track progress through loops
   ```
   WHILE condition AND attempts < 3
     - Update state: "Iteration {attempts+1} of 3"
     - [perform work]
     - attempts += 1
   ```

3. **Log decision points** - Record which branch was taken and why
   ```
   IF complexity == "HIGH"
     - Log: "High complexity detected, breaking into subtasks"
     - Update state: "Decomposing into subtasks"
     - [break down task]
   ELSE
     - Log: "Low complexity, executing as single task"
     - [execute directly]
   ```

4. **Have fallback paths** - Every IF should have sensible ELSE
   ```
   ❌ BAD: IF success THEN continue
   ✅ GOOD: IF success THEN continue ELSE invoke debugger
   ```

5. **Escalate when stuck** - If max attempts reached, involve user
   ```
   IF attempts >= 3 AND not_resolved
     THEN escalate to user with summary of attempts
   ```

6. **Combine conditions logically** - Use AND/OR for complex decisions
   ```
   IF (critical_issues > 0 OR security_score < 7) AND user_approved_risk == false
     THEN block deployment
     ELSE proceed
   ```

7. **Extract common patterns** - If you use the same conditional often, consider it for a workflow command
   ```
   Common pattern: Review → Fix → Re-review loop
   → Could become a reusable pattern or dedicated workflow
   ```

8. **Be deterministic** - Same inputs should lead to same decisions
   ```
   ❌ BAD: IF random() > 0.5 THEN approach_a ELSE approach_b
   ✅ GOOD: IF complexity_score > threshold THEN approach_a ELSE approach_b
   ```

## Debugging Conditional Orchestrations

When conditional logic doesn't work as expected:

1. **Check state file** - Verify conditions were evaluated correctly
2. **Review logs** - Confirm which branches were executed
3. **Invoke debugger** - Ask debugger to analyze the conditional flow
4. **Simplify conditions** - Break complex conditionals into simpler steps
5. **Add logging** - Log intermediate values before conditionals

**Example Debug Logging**:
```
1. Parse test coverage result
2. Log: "Coverage: {coverage}%, Target: {target}%, Attempts: {attempts}"
3. IF coverage < target AND attempts < 3
     THEN
       - Log: "Condition TRUE: coverage below target, retrying (attempt {attempts+1})"
       - [retry logic]
   ELSE
     - Log: "Condition FALSE: coverage={coverage}, target={target}, attempts={attempts}"
     - [proceed to next phase]
```
