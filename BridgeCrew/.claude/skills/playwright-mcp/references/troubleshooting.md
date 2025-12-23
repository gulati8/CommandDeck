# Troubleshooting

## Common Failures

- Flaky timing: replace timeouts with explicit waits.
- Navigation issues: wait for URL or specific element.
- Slow network: increase timeouts only when justified.
- Auth issues: use stored state or seed sessions.

## Debugging Steps

1. Re-run the test with `--debug`.
2. Use trace viewer and screenshots.
3. Capture console errors and network responses.
4. Confirm selectors still match the UI.

## Stability Practices

- Prefer semantic locators.
- Avoid tests that depend on execution order.
- Keep test data isolated and cleaned up.
