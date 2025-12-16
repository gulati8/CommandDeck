# Test-Driven Development (TDD)

Workflow and patterns for test-driven development.

## TDD Cycle

```
1. RED    - Write a failing test
2. GREEN  - Write minimal code to pass
3. REFACTOR - Improve code, keep tests passing
```

### Example: Building a User Service

```typescript
// Step 1: RED - Write failing test
describe('UserService', () => {
  it('should create a user with valid email', async () => {
    const userService = new UserService();
    const user = await userService.create({
      email: 'test@example.com',
      name: 'Test User',
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');
  });
});

// Step 2: GREEN - Write minimal implementation
class UserService {
  async create(data: CreateUserInput): Promise<User> {
    return {
      id: crypto.randomUUID(),
      email: data.email,
      name: data.name,
      createdAt: new Date(),
    };
  }
}

// Step 3: REFACTOR - Add validation, persistence
class UserService {
  constructor(private userRepo: UserRepository) {}

  async create(data: CreateUserInput): Promise<User> {
    this.validateEmail(data.email);

    const user: User = {
      id: crypto.randomUUID(),
      email: data.email.toLowerCase(),
      name: data.name.trim(),
      createdAt: new Date(),
    };

    return this.userRepo.save(user);
  }

  private validateEmail(email: string): void {
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new ValidationError('Invalid email format');
    }
  }
}
```

## Test Structure: AAA Pattern

```typescript
describe('Calculator', () => {
  it('should add two numbers', () => {
    // Arrange - Set up test data and dependencies
    const calculator = new Calculator();
    const a = 5;
    const b = 3;

    // Act - Execute the code under test
    const result = calculator.add(a, b);

    // Assert - Verify the outcome
    expect(result).toBe(8);
  });
});
```

## Test Naming Conventions

```typescript
// Pattern: should_ExpectedBehavior_When_Condition
describe('UserService.create', () => {
  it('should create user when email is valid', () => {});
  it('should throw ValidationError when email is empty', () => {});
  it('should normalize email to lowercase', () => {});
  it('should generate unique id for each user', () => {});
});

// Pattern: Given_When_Then
describe('UserService', () => {
  describe('given a valid email', () => {
    describe('when creating a user', () => {
      it('then returns a user with id', () => {});
    });
  });
});
```

## Writing Good Tests

### Test One Thing

```typescript
// BAD - Tests multiple behaviors
it('should validate and create user', async () => {
  // Tests validation
  await expect(service.create({ email: 'invalid' }))
    .rejects.toThrow();

  // Tests creation
  const user = await service.create({ email: 'valid@example.com' });
  expect(user.id).toBeDefined();
});

// GOOD - Separate tests for each behavior
it('should throw when email is invalid', async () => {
  await expect(service.create({ email: 'invalid' }))
    .rejects.toThrow(ValidationError);
});

it('should create user when email is valid', async () => {
  const user = await service.create({ email: 'valid@example.com' });
  expect(user.id).toBeDefined();
});
```

### Use Clear Assertions

```typescript
// BAD - Unclear what went wrong
expect(result).toBeTruthy();

// GOOD - Clear expectation
expect(result.isValid).toBe(true);
expect(result.errors).toHaveLength(0);

// GOOD - Custom matchers for domain objects
expect(user).toBeValidUser();
expect(order).toHaveStatus('completed');
```

### Test Edge Cases

```typescript
describe('divide', () => {
  it('divides two positive numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('divides negative numbers', () => {
    expect(divide(-10, 2)).toBe(-5);
  });

  it('throws when dividing by zero', () => {
    expect(() => divide(10, 0)).toThrow('Division by zero');
  });

  it('handles decimal results', () => {
    expect(divide(1, 3)).toBeCloseTo(0.333, 2);
  });

  it('handles very large numbers', () => {
    expect(divide(Number.MAX_SAFE_INTEGER, 2))
      .toBe(Math.floor(Number.MAX_SAFE_INTEGER / 2));
  });
});
```

## Mocking Strategies

### Manual Mocks

```typescript
// Create a mock repository
const mockUserRepo: UserRepository = {
  save: vi.fn().mockResolvedValue({ id: '1', email: 'test@example.com' }),
  findById: vi.fn().mockResolvedValue(null),
  findByEmail: vi.fn().mockResolvedValue(null),
};

const service = new UserService(mockUserRepo);
```

### Dependency Injection for Testing

```typescript
// Production code - accept dependencies
class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private emailService: EmailService,
    private paymentGateway: PaymentGateway
  ) {}

  async createOrder(data: CreateOrderInput): Promise<Order> {
    const order = await this.orderRepo.save(data);
    await this.paymentGateway.charge(data.paymentMethod, order.total);
    await this.emailService.sendConfirmation(order);
    return order;
  }
}

// Test - inject mocks
describe('OrderService', () => {
  let service: OrderService;
  let mockOrderRepo: jest.Mocked<OrderRepository>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockPaymentGateway: jest.Mocked<PaymentGateway>;

  beforeEach(() => {
    mockOrderRepo = { save: vi.fn() };
    mockEmailService = { sendConfirmation: vi.fn() };
    mockPaymentGateway = { charge: vi.fn() };

    service = new OrderService(
      mockOrderRepo,
      mockEmailService,
      mockPaymentGateway
    );
  });

  it('should charge payment and send email', async () => {
    mockOrderRepo.save.mockResolvedValue({ id: '1', total: 100 });
    mockPaymentGateway.charge.mockResolvedValue({ success: true });

    await service.createOrder({ /* ... */ });

    expect(mockPaymentGateway.charge).toHaveBeenCalledWith(
      expect.anything(),
      100
    );
    expect(mockEmailService.sendConfirmation).toHaveBeenCalled();
  });
});
```

## Testing Async Code

```typescript
// Promise-based
it('should fetch user', async () => {
  const user = await userService.getById('1');
  expect(user.name).toBe('John');
});

// Error handling
it('should throw when user not found', async () => {
  await expect(userService.getById('invalid'))
    .rejects.toThrow(NotFoundError);
});

// Timeout
it('should complete within timeout', async () => {
  await expect(
    Promise.race([
      slowOperation(),
      sleep(1000).then(() => { throw new Error('Timeout'); })
    ])
  ).resolves.toBeDefined();
}, 2000);
```

## Testing Error Handling

```typescript
describe('error handling', () => {
  it('should throw ValidationError for invalid input', () => {
    expect(() => service.process(null))
      .toThrow(ValidationError);

    expect(() => service.process(null))
      .toThrow('Input cannot be null');
  });

  it('should wrap database errors', async () => {
    mockRepo.save.mockRejectedValue(new Error('Connection failed'));

    await expect(service.create(data))
      .rejects.toThrow(DatabaseError);
  });

  it('should not expose internal errors to API', async () => {
    const response = await request(app)
      .post('/users')
      .send({ email: 'invalid' });

    expect(response.status).toBe(400);
    expect(response.body.error).not.toContain('stack');
  });
});
```

## Test Coverage Goals

### What to Cover
- Business logic and rules
- Edge cases and error handling
- Integration points
- Security-sensitive code
- Complex algorithms

### What NOT to Over-Test
- Trivial getters/setters
- Framework code
- Third-party libraries
- Pure configuration

### Coverage Targets
```
├── Critical business logic: 90%+
├── Service layer: 80%+
├── API handlers: 70%+
├── Utilities: 60%+
└── UI components: 50%+
```

## Red-Green-Refactor Tips

### Stay in Red Until Test Fails for Right Reason

```typescript
// Write test first
it('should throw when email already exists', async () => {
  mockRepo.findByEmail.mockResolvedValue({ id: '1', email: 'test@example.com' });

  await expect(service.create({ email: 'test@example.com' }))
    .rejects.toThrow('Email already registered');
});

// Verify it fails because feature doesn't exist
// NOT because of typo or wrong assertion
```

### Minimal Green Implementation

```typescript
// First make it work - ugly is OK
async create(email: string): Promise<User> {
  const existing = await this.repo.findByEmail(email);
  if (existing) throw new Error('Email already registered');
  return this.repo.save({ email });
}

// Then refactor with tests as safety net
async create(email: string): Promise<User> {
  await this.ensureEmailUnique(email);
  return this.repo.save({ email: this.normalizeEmail(email) });
}

private async ensureEmailUnique(email: string): Promise<void> {
  const existing = await this.repo.findByEmail(email);
  if (existing) {
    throw new DuplicateEmailError(email);
  }
}
```

## Benefits of TDD

1. **Design feedback** - Tests force better APIs
2. **Documentation** - Tests show how to use code
3. **Confidence** - Refactor without fear
4. **Focus** - Build only what's needed
5. **Fewer bugs** - Catch issues early
