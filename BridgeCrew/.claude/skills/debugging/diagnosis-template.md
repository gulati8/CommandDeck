# Diagnosis Report Template

Structured format for reporting debugging findings and fixes.

## Template: Autonomous Fix (Default)

Use this when you've diagnosed AND fixed the issue:

```markdown
## 🐛 Debug Report: [Brief Issue Description]

### Issue
[What the user reported - their exact words if possible]

**Expected behavior**: [What should happen]
**Actual behavior**: [What's actually happening]

### Investigation

**Evidence gathered:**
- [Log excerpt, error message, or observation]
- [File/line where issue manifests]
- [Recent changes that might be related]

**Root cause**: [What's actually wrong - be specific]

**Location**: `file/path/name.ext:line_number`

### Fix Applied

**Changes made:**
- `path/to/file.ext:42` - [Description of change]
- `path/to/other.ext:15` - [Description of change]

**Rationale**: [Why this fix solves the root cause]

### Verification

**Tests run:**
```bash
[commands executed]
```

**Results**: ✅ [Pass/Fail with details]

### Status
**Fixed and verified** | **Partially fixed** | **Fix failed**

[Any warnings, limitations, or follow-up recommendations]
```

## Template: Plan Only

Use this when user asked "how would you fix" or wants to approve approach:

```markdown
## 🐛 Debug Analysis: [Brief Issue Description]

### Issue
[What the user reported]

**Expected behavior**: [What should happen]
**Actual behavior**: [What's actually happening]

### Investigation

**Evidence gathered:**
- [Log excerpt, error message, or observation]
- [File/line where issue manifests]
- [Recent changes that might be related]

**Root cause**: [What's actually wrong - be specific]

**Location**: `file/path/name.ext:line_number`

### Proposed Fix

**Approach**: [High-level strategy]

**Changes required:**
1. `path/to/file.ext:42` - [What needs to change and why]
2. `path/to/other.ext:15` - [What needs to change and why]

**Verification plan:**
- [How to test the fix]
- [What should happen after fix]

**Risk assessment**: [Low/Medium/High] - [Why]

**Alternatives considered:**
- [Alternative approach 1] - [Why not chosen]
- [Alternative approach 2] - [Why not chosen]

### Recommendation
[Your recommended approach and why]

**Ready to proceed?** Confirm to apply this fix.
```

## Template: Complex/Multi-Part Issue

Use when the issue has multiple root causes or requires staged fixes:

```markdown
## 🐛 Debug Report: [Brief Issue Description]

### Issue
[What the user reported]

### Investigation Summary

Found **[N] related issues**:

#### Issue 1: [Description]
- **Root cause**: [What's wrong]
- **Location**: `path/file.ext:line`
- **Severity**: Critical/High/Medium/Low

#### Issue 2: [Description]
- **Root cause**: [What's wrong]
- **Location**: `path/file.ext:line`
- **Severity**: Critical/High/Medium/Low

### Fixes Applied

#### Fix 1: [Issue 1]
- **Changed**: `path/file.ext:line` - [Change description]
- **Verified**: ✅ [Result]

#### Fix 2: [Issue 2]
- **Changed**: `path/file.ext:line` - [Change description]
- **Verified**: ✅ [Result]

### Overall Status
[All fixed | Partially fixed | Needs more work]

[Any remaining issues or recommendations]
```

## Template: Unable to Diagnose

Use when you can't identify the root cause:

```markdown
## 🐛 Debug Report: [Brief Issue Description]

### Issue
[What the user reported]

### Investigation Attempted

**Evidence gathered:**
- [What logs/files were checked]
- [What was found or not found]

**Hypotheses tested:**
1. [Hypothesis 1] - [Why ruled out]
2. [Hypothesis 2] - [Why ruled out]

### Blockers

**Cannot proceed because:**
- [Specific blocker - e.g., "No error logs found"]
- [Missing information - e.g., "Need reproduction steps"]
- [Environmental issue - e.g., "Service not running"]

### Needed Information

To continue diagnosis, need:
1. [Specific information request]
2. [Specific action from user]

### Temporary Workarounds

[If applicable, suggest temporary measures while investigating]
```

## Output Guidelines

**Be concise:**
- One-sentence summaries where possible
- Code references over long explanations
- Bullet points over paragraphs

**Be specific:**
- Exact file paths with line numbers
- Exact error messages (don't paraphrase)
- Precise code changes (what changed, not just "fixed it")

**Be actionable:**
- If something needs follow-up, state exactly what
- If multiple options exist, recommend one
- If risks exist, state them clearly

**Format code references:**
- Always use: `path/to/file.ext:line_number`
- Makes it easy for user to navigate
- Include context line if helpful

**Example:**
```
Found issue in src/auth/login.ts:42
Line 42: const user = users.find(u => u.id = userId);
Should be: const user = users.find(u => u.id === userId);
(Using assignment = instead of comparison ===)
```
