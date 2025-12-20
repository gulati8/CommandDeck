# Log Analysis Guide

Techniques for extracting insights from application and orchestration logs.

## Log Location Discovery

### Orchestration Logs
- `.claude/logs/` - JSONL format orchestration activity
- `.claude/state/` - Current orchestration state files

### Application Logs (Common Patterns)

**Node.js/JavaScript:**
- Console output (stdout/stderr)
- `logs/`, `log/`
- Framework-specific:
  - Next.js: `.next/`, console
  - Express: Custom logger output
  - NestJS: Application logs

**Python:**
- Console output
- `logs/`, `log/`
- Framework-specific:
  - Django: `logs/django.log`, console
  - Flask: Application logs
  - FastAPI: uvicorn logs

**Other:**
- `tmp/`, `temp/`
- `var/log/`
- Cloud logs (if running in production)

**Finding logs:**
```bash
# Search for common log files
find . -name "*.log" -type f -mtime -1

# Check recent output
ls -lt logs/ | head -20

# Look for log configuration
grep -r "log" .env* config/ 2>/dev/null
```

## Reading Logs Effectively

### Stack Traces
**Identify:**
- Error type and message (first line usually most important)
- File and line number where error occurred
- Call stack (work backwards from error to entry point)

**Example (JavaScript):**
```
TypeError: Cannot read property 'name' of undefined
    at getUserName (src/auth.ts:42:15)
    at handleLogin (src/routes/login.ts:18:5)
```
**Analysis:** Line 42 in `src/auth.ts` is trying to access `.name` on undefined value

### Error Patterns

**HTTP Errors:**
- `404 Not Found` → Check URL paths, routing configuration
- `500 Internal Server Error` → Check server logs for stack trace
- `401 Unauthorized` → Check authentication logic
- `403 Forbidden` → Check authorization/permissions
- `CORS errors` → Check CORS configuration

**Database Errors:**
- `Connection refused` → Database not running or wrong connection string
- `Syntax error` → Check SQL query construction
- `Duplicate entry` → Unique constraint violation
- `Foreign key constraint` → Referenced record doesn't exist

**Dependency Errors:**
- `Module not found` → Missing dependency or wrong import path
- `Cannot find module 'X'` → Package not installed or wrong version

### Timeline Reconstruction

**Build a sequence:**
1. Note timestamps of relevant events
2. Order events chronologically
3. Identify what happened immediately before failure
4. Look for patterns across multiple failures

**Example analysis:**
```
12:34:15 - User clicked login button
12:34:16 - POST /api/login called
12:34:16 - Database query executed
12:34:17 - ERROR: Cannot read property 'token' of null
```
**Conclusion:** Database query returned null, likely user not found

### Pattern Recognition

**Repeated errors:**
```bash
# Count error occurrences
grep "ERROR" logs/app.log | sort | uniq -c | sort -rn

# Find errors in specific timeframe
grep "2024-01-15 14:" logs/app.log | grep ERROR
```

**Look for:**
- Same error repeated → Systematic issue
- Different errors, same module → Problem in that module
- Errors only at specific times → Timing/race condition
- Errors after deployment → Introduced by recent change

## Orchestration Log Analysis

**JSONL Format:**
```json
{"timestamp": "...", "event": "subagent_invoked", "agent": "code-writer", "task": "..."}
{"timestamp": "...", "event": "subagent_completed", "agent": "code-writer", "result": "..."}
```

**Key events to track:**
- Which agents were invoked
- What tasks were delegated
- How long each agent took
- Whether agents succeeded or failed
- What context was passed between agents

**Find issues:**
```bash
# List all agent invocations
grep "subagent_invoked" .claude/logs/*.jsonl

# Find failed agents
grep "failed" .claude/logs/*.jsonl

# Check specific agent history
grep "debugger" .claude/logs/*.jsonl
```

## Analysis Checklist

When analyzing logs:
- [ ] Identify the exact error message
- [ ] Note the file and line number
- [ ] Reconstruct the timeline leading to error
- [ ] Check what changed recently (git log)
- [ ] Look for similar errors in logs
- [ ] Verify services/dependencies are running
- [ ] Check environment variables and configuration
- [ ] Review related code sections
