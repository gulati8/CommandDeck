# Debugging Methodology

Systematic approach to diagnosing and fixing issues in application code.

## Investigation Process

### Phase 1: Gather Evidence

**Reproduce the Issue**
1. Understand what action triggers the problem
2. Identify expected vs. actual behavior
3. Determine if issue is consistent or intermittent
4. Note any error messages verbatim

**Collect Logs**
1. Check `.claude/logs/` for recent orchestration activity
2. Look for application logs in common locations:
   - `logs/`, `log/`
   - Console output (stdout/stderr)
   - Framework-specific locations (e.g., `storage/logs/`, `.next/`, `dist/`)
3. Check browser console for frontend issues
4. Review test output if available

**Examine Recent Changes**
1. Run `git log -10 --oneline` to see recent commits
2. Check what files were modified: `git diff HEAD~5..HEAD --name-only`
3. Look at diffs for suspicious areas: `git diff HEAD~3..HEAD`

### Phase 2: Isolate the Failure Point

**Trace the Path**
1. Identify the code path that leads to the issue
2. Use Grep to find relevant functions/modules
3. Read the actual implementation
4. Look for:
   - Typos in variable names, function calls
   - Off-by-one errors
   - Missing null checks
   - Incorrect API endpoints
   - Wrong environment variables

**Test Hypotheses**
1. Form specific hypotheses about what's wrong
2. Look for evidence that confirms/refutes each hypothesis
3. Check assumptions (e.g., "does this file exist?", "is this service running?")

### Phase 3: Identify Root Cause

**Common Patterns**
- **Configuration issues**: Wrong env vars, missing config files
- **Dependency issues**: Version mismatches, missing packages
- **Logic errors**: Wrong conditions, incorrect operators
- **Integration issues**: API changes, schema mismatches
- **Race conditions**: Timing-dependent failures
- **State issues**: Stale cache, incorrect initialization

**Verification**
- Confirm the root cause explains ALL observed symptoms
- Check if the issue could affect other areas
- Verify recent changes didn't introduce the bug

## Decision Tree: Fix or Plan?

**Fix Immediately If:**
- Root cause is clear and straightforward
- Fix is localized (1-3 files)
- No architectural implications
- Low risk of side effects

**Provide Plan If:**
- User explicitly asked "how would you fix this?"
- Multiple approaches are viable
- Fix affects many files or core architecture
- Requires significant refactoring
- May introduce breaking changes

## Instrumentation Strategy

**When to Add Debug Logging:**
- Issue is intermittent and hard to reproduce
- Need to see intermediate state
- Tracing execution flow through complex code

**Add logs at:**
- Function entry points with parameters
- Before/after critical operations
- Decision points (if/else branches)
- Error handlers

**Remove debug logging after:**
- Issue is diagnosed and fixed
- Verification passes
