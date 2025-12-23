#!/bin/bash
set -euo pipefail

ROOT_DIR="${1:-$(pwd)}"
E2E_DIR="$ROOT_DIR/e2e"
CONFIG_TS="$ROOT_DIR/playwright.config.ts"
CONFIG_JS="$ROOT_DIR/playwright.config.js"

if [ ! -d "$ROOT_DIR" ]; then
  echo "Root directory does not exist: $ROOT_DIR"
  exit 1
fi

mkdir -p "$E2E_DIR"

if [ -f "$CONFIG_TS" ] || [ -f "$CONFIG_JS" ]; then
  echo "Playwright config already exists. Skipping config creation."
else
  cat <<'CONFIG' > "$CONFIG_TS"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        reuseExistingServer: !process.env.CI,
      },
});
CONFIG
  echo "Created $CONFIG_TS"
fi

if [ ! -f "$E2E_DIR/smoke.spec.ts" ]; then
  cat <<'TEST' > "$E2E_DIR/smoke.spec.ts"
import { test, expect } from '@playwright/test';

test('smoke: home page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
TEST
  echo "Created $E2E_DIR/smoke.spec.ts"
fi

echo "Bootstrap complete."
echo "Next steps:"
echo "  1) Install Playwright in the project if needed: npm i -D @playwright/test"
echo "  2) Install browsers: npx playwright install"
echo "  3) Run tests: npx playwright test"
