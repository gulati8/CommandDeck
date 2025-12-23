# Failure Handling and Recovery

This guide explains the multi-level recovery strategy for handling subagent failures during orchestration.

## Multi-Level Recovery Strategy

When subagents fail, use a progressive escalation approach:

## Level 1: Immediate Retry with Refinement

**When**: First failure of a subagent task

**Actions**:
1. Log the failure: `echo "{...\"event\": \"task_failed\"...}" >> .claude/logs/orchestration.jsonl`
2. Update state: `.claude/skills/state-management/utilities/update-step.sh "$STATE_FILE" "step-name" "failed" "Error description"`
3. Analyze the failure output briefly
4. Refine the task (simplify scope, add context, clarify constraints)
5. Retry the subagent with refined prompt
6. If successful, update state to "complete" and continue
7. If still failing, proceed to Level 2

**Example**:
```
Original task: "Implement user authentication"
Failure: Agent couldn't find database models

Refined task: "Implement user authentication. User model is in src/models/User.ts. Use bcrypt for password hashing (already installed). Reference the existing Product authentication in src/auth/product.ts."

Result: Success after refinement
```

## Level 2: Diagnostic Investigation

**When**: Task fails after immediate retry

**Actions**:
1. Invoke the `debugger` subagent with:
   - The failed task prompt
   - The error output/incomplete results
   - Relevant state file and logs
2. Review the debugger's diagnosis and recovery recommendations
3. Choose the highest-probability recovery strategy
4. Implement the recovery strategy (may involve task decomposition)
5. If recovery succeeds, update state and continue
6. If recovery fails, proceed to Level 3

**Example**:
```markdown
## Task for Debugger
Diagnose why code-writer failed to implement authentication

## Context
- **Failed Task**: "Implement user authentication with JWT"
- **Error Output**: "Could not determine which authentication library to use"
- **State File**: .claude/state/YYYY-MM-DD_add-auth.md
- **Logs**: Last 5 entries from orchestration.jsonl

## Expected Output
- Root cause analysis
- Recovery recommendations (ranked by probability of success)
```

**Debugger might recommend**:
1. "Break task into smaller pieces: (1) Install JWT library, (2) Create auth middleware, (3) Add login endpoint"
2. "Provide explicit library choice: jsonwebtoken vs jose"
3. "Add reference implementation from similar project"

**Action**: Implement highest-ranked recommendation

## Level 3: User Escalation with Diplomatic Briefing

**When**: Diagnostic investigation doesn't resolve the failure

**Actions**:
1. Update state file with comprehensive failure summary
2. Present situation as a briefing:
   > "Status update: we've encountered an obstacle. Here's the situation:
   > - **Mission**: {what we were attempting}
   > - **Challenge**: {what failed and why, based on debugger analysis}
   > - **Recovery Attempts**: {what we've tried}
   > - **Options**: {user's choices: Skip | Provide guidance | Abort}
   >
   > Your decision?"

3. Await user decision
4. Execute based on choice: "Making it so."

**Example Briefing**:
```
Status update: we've encountered an obstacle. Here's the situation:

**Mission**: Implement OAuth authentication for the application

**Challenge**: The code-writer agent cannot proceed because there are two conflicting OAuth configurations in the codebase:
- config/oauth-google.json (appears to be for Google OAuth)
- config/oauth.config.ts (configured for GitHub OAuth)

**Recovery Attempts**:
1. First retry: Asked code-writer to use oauth.config.ts → Failed because Google client ID is in the JSON file
2. Debugger analysis: Identified config conflict, recommended merging configs
3. Second attempt: Tried to merge automatically → Failed due to unclear which provider should be primary

**Options**:
1. Skip OAuth implementation for now and proceed with basic JWT
2. Provide guidance on which OAuth provider to use (or both)
3. Abort this orchestration so you can clean up configs manually

Your decision?
```

## Handling Conflicting Subagent Results

If multiple subagent results conflict:

1. **Document both results** in state file
2. **Invoke debugger** to analyze the conflict
3. **If debugger can resolve**, proceed with recommendation
4. **If unresolvable**, escalate to user for decision

**Example**:
```
Scenario: planner recommends REST API, api-designer recommends GraphQL

Step 1: Document conflict in state file
Step 2: Invoke debugger with both recommendations
Step 3: Debugger analysis:
  - REST: Simpler, team familiar, aligns with current stack
  - GraphQL: Better for complex data fetching, but learning curve
  - Recommendation: REST for MVP, consider GraphQL in v2

Step 4: If user's requirements clearly favor one approach, proceed
        If still ambiguous, escalate with debugger's analysis
```

## Error Logging Best Practices

Always log failures in both places:

**1. State file**:
```markdown
### Step 3: Implement Feature X
- **Subagent**: code-writer
- **Status**: ❌ Failed
- **Result Summary**: Failed to implement due to missing type definitions
- **Files Modified**: None
- **Notes**: Error: "Cannot find module 'types/User'". Recovery: Added type definitions and retrying.
```

**2. JSONL log**:
```bash
echo "{\"timestamp\": \"$(date -Iseconds)\", \"event\": \"task_failed\", \"agent\": \"code-writer\", \"error\": \"Cannot find module 'types/User'\", \"recovery_attempted\": \"Level 1 - Retry with refined context\"}" >> .claude/logs/orchestration.jsonl
```

## Recovery Decision Tree

```
Subagent fails
    │
    ├─→ First failure?
    │   └─→ YES → Level 1: Retry with refinement
    │       ├─→ Success? → Continue workflow
    │       └─→ Still fails? → Proceed to Level 2
    │
    └─→ Second failure?
        └─→ YES → Level 2: Invoke debugger
            ├─→ Debugger provides solution? → Implement and retry
            │   ├─→ Success? → Continue workflow
            │   └─→ Still fails? → Proceed to Level 3
            │
            └─→ Debugger can't solve? → Level 3: Escalate to user
                └─→ Present briefing, await decision
```

## Common Failure Patterns and Solutions

| Failure Pattern | Likely Cause | Recovery Strategy |
|----------------|--------------|-------------------|
| "Cannot find file/module" | Missing context or wrong path | Level 1: Add explicit file paths and verify they exist |
| "Ambiguous requirements" | Task too vague | Level 1: Add specific examples and constraints |
| "Multiple valid approaches" | Architectural decision needed | Level 3: Escalate to user (or Level 4 delegation: Agree) |
| "Dependency missing" | Package not installed | Level 1: Install dependency, then retry |
| "Type errors" | Missing type definitions | Level 1: Provide type definitions or reference existing types |
| "Test failures" | Implementation doesn't match expectations | Level 2: Debugger analyzes test output and suggests fixes |
| "Performance issues" | Inefficient approach | Level 2: Debugger suggests optimizations or alternative approach |
| "Security concerns" | Code-reviewer blocks merge | Level 2: Debugger analyzes security issues, code-writer fixes |

## When NOT to Retry

Don't retry automatically if:
1. **User input required** - Clarification needed, escalate immediately
2. **Destructive operation prevented** - Security measure triggered, confirm with user
3. **Resource limits** - API rate limits, disk space, etc.
4. **Invalid request** - Task fundamentally impossible, explain to user
5. **Circular failure** - Same error after 2 retries, escalate

## Success After Recovery

When recovery succeeds:
1. **Update state** to mark step as complete
2. **Log success** with note about recovery
3. **Continue workflow** normally
4. **Note in final summary** that recovery was needed (for learning)

**Example**:
```markdown
### Step 3: Implement Feature X
- **Subagent**: code-writer
- **Status**: ✅ Complete (after Level 1 recovery)
- **Result Summary**: Successfully implemented feature. Initial failure due to missing imports, resolved by adding explicit import statements.
- **Files Modified**: src/features/x.ts, src/types/x.ts
- **Notes**: Recovery: Added missing type imports from prior step
```
