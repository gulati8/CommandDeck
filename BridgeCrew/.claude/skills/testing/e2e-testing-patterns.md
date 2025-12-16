# E2E Testing Patterns

End-to-end testing strategies using Playwright and Cypress.

## Playwright Setup

### Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Page Object Model

### Base Page

```typescript
// e2e/pages/BasePage.ts
import { Page, Locator } from '@playwright/test';

export abstract class BasePage {
  constructor(protected page: Page) {}

  async goto(path = ''): Promise<void> {
    await this.page.goto(path);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  protected getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId);
  }
}
```

### Login Page

```typescript
// e2e/pages/LoginPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton = page.getByRole('button', { name: 'Sign in' });
    this.errorMessage = page.getByRole('alert');
  }

  async goto(): Promise<void> {
    await super.goto('/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string): Promise<void> {
    await expect(this.errorMessage).toContainText(message);
  }

  async expectLoggedIn(): Promise<void> {
    await expect(this.page).toHaveURL('/dashboard');
  }
}
```

### Dashboard Page

```typescript
// e2e/pages/DashboardPage.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  readonly heading: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly statsCards: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.getByRole('heading', { name: 'Dashboard' });
    this.userMenu = page.getByRole('button', { name: /user menu/i });
    this.logoutButton = page.getByRole('menuitem', { name: 'Sign out' });
    this.statsCards = page.getByTestId('stats-card');
  }

  async goto(): Promise<void> {
    await super.goto('/dashboard');
  }

  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.click();
  }

  async expectVisible(): Promise<void> {
    await expect(this.heading).toBeVisible();
  }

  async getStatsCount(): Promise<number> {
    return this.statsCards.count();
  }
}
```

## Test Examples

### Authentication Flow

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';

test.describe('Authentication', () => {
  test('user can log in with valid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');

    await loginPage.expectLoggedIn();
    await dashboardPage.expectVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    const loginPage = new LoginPage(page);

    await loginPage.goto();
    await loginPage.login('wrong@example.com', 'wrongpassword');

    await loginPage.expectError('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('user can log out', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const dashboardPage = new DashboardPage(page);

    // Login first
    await loginPage.goto();
    await loginPage.login('test@example.com', 'password123');
    await dashboardPage.expectVisible();

    // Logout
    await dashboardPage.logout();

    await expect(page).toHaveURL('/login');
  });
});
```

### Form Testing

```typescript
// e2e/forms.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
  });

  test('submits form with valid data', async ({ page }) => {
    await page.getByLabel('Name').fill('John Doe');
    await page.getByLabel('Email').fill('john@example.com');
    await page.getByLabel('Message').fill('Test message content');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Message sent successfully')).toBeVisible();
  });

  test('shows validation errors for empty fields', async ({ page }) => {
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.getByText('Name is required')).toBeVisible();
    await expect(page.getByText('Email is required')).toBeVisible();
    await expect(page.getByText('Message is required')).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    await page.getByLabel('Email').fill('invalid-email');
    await page.getByLabel('Email').blur();

    await expect(page.getByText('Invalid email format')).toBeVisible();
  });
});
```

### Data-Driven Testing

```typescript
// e2e/data-driven.spec.ts
import { test, expect } from '@playwright/test';

const testUsers = [
  { email: 'admin@example.com', role: 'admin', expectedTabs: 5 },
  { email: 'editor@example.com', role: 'editor', expectedTabs: 3 },
  { email: 'viewer@example.com', role: 'viewer', expectedTabs: 1 },
];

for (const user of testUsers) {
  test(`${user.role} sees ${user.expectedTabs} tabs`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/dashboard');

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(user.expectedTabs);
  });
}
```

### API Mocking in E2E

```typescript
// e2e/api-mock.spec.ts
import { test, expect } from '@playwright/test';

test('displays loading state then data', async ({ page }) => {
  // Intercept API call
  await page.route('**/api/users', async (route) => {
    // Delay response to test loading state
    await new Promise((r) => setTimeout(r, 500));
    await route.fulfill({
      status: 200,
      body: JSON.stringify([
        { id: '1', name: 'Mock User 1' },
        { id: '2', name: 'Mock User 2' },
      ]),
    });
  });

  await page.goto('/users');

  // Should show loading
  await expect(page.getByText('Loading...')).toBeVisible();

  // Should show data after loading
  await expect(page.getByText('Mock User 1')).toBeVisible();
  await expect(page.getByText('Mock User 2')).toBeVisible();
});

test('handles API errors gracefully', async ({ page }) => {
  await page.route('**/api/users', (route) =>
    route.fulfill({ status: 500, body: 'Server Error' })
  );

  await page.goto('/users');

  await expect(page.getByText('Failed to load users')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
```

### Visual Regression Testing

```typescript
// e2e/visual.spec.ts
import { test, expect } from '@playwright/test';

test('homepage looks correct', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});

test('dashboard looks correct on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/dashboard');
  await expect(page).toHaveScreenshot('dashboard-mobile.png');
});

test('button states', async ({ page }) => {
  await page.goto('/components');

  const button = page.getByRole('button', { name: 'Submit' });

  // Normal state
  await expect(button).toHaveScreenshot('button-normal.png');

  // Hover state
  await button.hover();
  await expect(button).toHaveScreenshot('button-hover.png');

  // Focus state
  await button.focus();
  await expect(button).toHaveScreenshot('button-focus.png');
});
```

## Test Fixtures

### Authentication Fixture

```typescript
// e2e/fixtures.ts
import { test as base, Page } from '@playwright/test';

type Fixtures = {
  authenticatedPage: Page;
  adminPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');

    await use(page);
  },

  adminPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('adminpass');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/admin');

    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### Using Fixtures

```typescript
// e2e/protected.spec.ts
import { test, expect } from './fixtures';

test('authenticated user can access profile', async ({ authenticatedPage }) => {
  await authenticatedPage.goto('/profile');
  await expect(authenticatedPage.getByRole('heading', { name: 'Profile' }))
    .toBeVisible();
});

test('admin can access user management', async ({ adminPage }) => {
  await adminPage.goto('/admin/users');
  await expect(adminPage.getByRole('heading', { name: 'User Management' }))
    .toBeVisible();
});
```

## Best Practices

### Use Semantic Locators

```typescript
// GOOD - Semantic, accessible
page.getByRole('button', { name: 'Submit' });
page.getByLabel('Email');
page.getByText('Welcome back');

// AVOID - Implementation details
page.locator('.btn-primary');
page.locator('#submit-button');
page.locator('div.form-group input');
```

### Test User Journeys, Not Buttons

```typescript
// GOOD - Tests a complete flow
test('user can complete checkout', async ({ page }) => {
  await page.goto('/products');
  await page.getByText('Add to Cart').first().click();
  await page.getByRole('link', { name: 'Cart' }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();
  // ... complete checkout flow
  await expect(page.getByText('Order confirmed')).toBeVisible();
});

// BAD - Tests isolated UI elements
test('add to cart button works', async ({ page }) => {
  await page.goto('/products');
  await page.getByText('Add to Cart').click();
  // What does "works" mean?
});
```

### Wait for Specific Conditions

```typescript
// GOOD - Wait for specific element
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

// GOOD - Wait for navigation
await page.waitForURL('/dashboard');

// GOOD - Wait for network idle
await page.waitForLoadState('networkidle');

// AVOID - Arbitrary timeouts
await page.waitForTimeout(2000);
```

### Organize Tests by Feature

```
e2e/
├── auth/
│   ├── login.spec.ts
│   ├── logout.spec.ts
│   └── password-reset.spec.ts
├── checkout/
│   ├── cart.spec.ts
│   ├── payment.spec.ts
│   └── shipping.spec.ts
├── pages/
│   ├── LoginPage.ts
│   └── CheckoutPage.ts
└── fixtures.ts
```
