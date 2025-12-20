# Fix Implementation Workflow

Process for implementing fixes autonomously after diagnosing issues.

## Fix → Verify → Report Pattern

### Step 1: Implement the Fix

**Minimal Changes Principle:**
- Fix ONLY what's broken
- Don't refactor surrounding code
- Don't add "improvements" beyond the fix
- Keep changes localized

**Make the change:**
1. Use Edit tool for existing files (preserve formatting)
2. Test the exact line/section that needs changing
3. Verify syntax is correct
4. Check for side effects in the same file

**Common fixes:**
- Typo correction: Fix variable names, function calls
- Logic fix: Correct conditions, operators
- Null checks: Add missing validations
- API endpoint: Update URLs to match backend
- Import fix: Correct module paths
- Configuration: Update env vars, config files

### Step 2: Verify the Fix

**Immediate verification:**
```bash
# For compile-time errors
npm run build   # or: tsc, cargo build, etc.

# For test failures
npm test        # or: pytest, cargo test, etc.

# For runtime errors (if quick to verify)
npm run dev     # Start and spot-check
```

**Verification checklist:**
- [ ] Code compiles/builds without errors
- [ ] Existing tests still pass
- [ ] Specific issue is resolved
- [ ] No new errors introduced

**If verification fails:**
- DO NOT mark fix as complete
- Investigate why verification failed
- Either adjust the fix or add it to open issues
- Consider if the diagnosis was incorrect

### Step 3: Report Results

**Use diagnosis template** (see: `diagnosis-template.md`)

**Include:**
- What was broken
- Root cause identified
- Fix applied (file:line references)
- Verification results
- Any warnings or follow-up needed

## When to Add Tests

**Add tests if:**
- No tests exist for the buggy code
- Bug was a regression (working before, broken now)
- Fix is non-obvious and could easily break again

**Don't add tests if:**
- Tests already exist and caught the bug
- Fix is trivial (typo, obvious logic error)
- User didn't request test coverage

**Test additions:**
```bash
# Find existing test files
find . -name "*.test.*" -o -name "*.spec.*"

# Check test patterns
head -20 tests/example.test.js
```

## When to Add Instrumentation

**Add logging/debugging if:**
- Issue was hard to diagnose
- Could recur and need better visibility
- Multiple related issues might emerge

**Add at:**
- Error boundaries
- Critical state changes
- Integration points

**Example:**
```javascript
// Before fix: Silent failure
const user = await getUser(id);
return user.name;

// After fix: With instrumentation
const user = await getUser(id);
if (!user) {
  console.error(`User not found: ${id}`);
  throw new Error(`User ${id} not found`);
}
return user.name;
```

## Multi-File Fixes

**If fix spans multiple files:**

1. **Plan the changes:**
   - List all files that need updates
   - Determine the order (dependencies first)
   - Check for consistency requirements

2. **Apply changes systematically:**
   - Update implementation files first
   - Then update tests
   - Then update types/interfaces
   - Finally update documentation if needed

3. **Verify incrementally:**
   - Check compilation after each file
   - Run relevant tests after each change
   - Catch errors early

## Rollback Strategy

**If fix causes new issues:**

1. **Assess severity:**
   - Is it worse than the original bug?
   - Does it break critical functionality?

2. **Decision:**
   - **Minor issue**: Document as known limitation, keep fix
   - **Major issue**: Revert fix, report as complex bug requiring different approach

3. **Report honestly:**
   - Don't hide failed fix attempts
   - Explain what went wrong
   - Suggest alternative approaches

## Post-Fix Cleanup

**After successful fix:**

1. **Remove debug logging** (if added temporarily)
2. **Check for commented code** (clean up if added)
3. **Verify formatting** is consistent
4. **Update state file** if part of orchestration

**Don't do:**
- Don't refactor unrelated code
- Don't add features
- Don't change formatting of unchanged code
- Don't add TODOs or comments about future improvements
