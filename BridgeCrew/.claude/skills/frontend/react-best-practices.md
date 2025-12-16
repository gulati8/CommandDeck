# React Best Practices

Comprehensive React patterns and anti-patterns for building production-grade applications.

## Component Design Patterns

### Container/Presentational Pattern

Separate data logic from presentation for better testability and reusability.

```typescript
// Container Component - handles data and logic
function UserProfileContainer({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useUser(userId);
  const { mutate: updateUser } = useUpdateUser();

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorState error={error} />;
  if (!user) return <NotFound />;

  return (
    <UserProfileView
      user={user}
      onUpdate={updateUser}
    />
  );
}

// Presentational Component - pure UI
interface UserProfileViewProps {
  user: User;
  onUpdate: (data: Partial<User>) => void;
}

function UserProfileView({ user, onUpdate }: UserProfileViewProps) {
  return (
    <div className="space-y-4">
      <Avatar src={user.avatar} alt={user.name} />
      <h1 className="text-2xl font-bold">{user.name}</h1>
      <p className="text-gray-600">{user.email}</p>
      <EditButton onClick={() => onUpdate({ name: 'New Name' })} />
    </div>
  );
}
```

### Compound Components Pattern

For flexible, related component groups that share state.

```typescript
// Compound component pattern for Tabs
const TabsContext = createContext<TabsContextType | null>(null);

function Tabs({ children, defaultValue }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.List = function TabsList({ children }: { children: React.ReactNode }) {
  return <div role="tablist" className="flex gap-2">{children}</div>;
};

Tabs.Trigger = function TabsTrigger({ value, children }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  return (
    <button
      role="tab"
      aria-selected={activeTab === value}
      onClick={() => setActiveTab(value)}
      className={cn(
        "px-4 py-2 rounded-lg",
        activeTab === value ? "bg-blue-500 text-white" : "text-gray-600"
      )}
    >
      {children}
    </button>
  );
};

Tabs.Content = function TabsContent({ value, children }: TabsContentProps) {
  const { activeTab } = useTabsContext();
  if (activeTab !== value) return null;
  return <div role="tabpanel">{children}</div>;
};

// Usage
<Tabs defaultValue="profile">
  <Tabs.List>
    <Tabs.Trigger value="profile">Profile</Tabs.Trigger>
    <Tabs.Trigger value="settings">Settings</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="profile"><ProfilePanel /></Tabs.Content>
  <Tabs.Content value="settings"><SettingsPanel /></Tabs.Content>
</Tabs>
```

### Custom Hooks for Reusable Logic

Extract stateful logic into reusable hooks.

```typescript
// Data fetching hook
export function useUser(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.getUser(userId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// UI state hook
export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

// Form hook with validation
export function useFormWithValidation<T extends z.ZodSchema>(schema: T) {
  type FormData = z.infer<T>;

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const validate = useCallback((data: unknown): data is FormData => {
    const result = schema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach(err => {
        const path = err.path.join('.');
        fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors as any);
      return false;
    }
    setErrors({});
    return true;
  }, [schema]);

  return { errors, validate, clearErrors: () => setErrors({}) };
}

// Local storage hook with SSR safety
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    setStoredValue(prev => {
      const valueToStore = value instanceof Function ? value(prev) : value;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
      return valueToStore;
    });
  }, [key]);

  return [storedValue, setValue] as const;
}

// Debounce hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

## State Management Decision Tree

```
Is the state needed?
├── No → Don't create it (derive from props or other state)
└── Yes → Where should it live?
    │
    ├── Only this component?
    │   └── useState or useReducer
    │
    ├── Shared by parent/children?
    │   └── Lift to common ancestor
    │
    ├── From server/API?
    │   └── React Query / SWR (server state)
    │
    ├── Global UI state? (theme, sidebar, notifications)
    │   └── Zustand / Context
    │
    └── URL state? (filters, pagination, search)
        └── React Router searchParams
```

### State Colocation Rules

1. **Start local**: Begin with useState in the component
2. **Lift when shared**: Only lift when 2+ siblings need it
3. **Never duplicate server data**: Use React Query, reference its cache
4. **URL for shareable state**: Filters, pagination, tabs that should be linkable

## Performance Optimization

### When to Memoize

```typescript
// React.memo - for expensive components receiving same props
const ExpensiveList = React.memo(function ExpensiveList({ items }: Props) {
  return (
    <ul>
      {items.map(item => <ExpensiveItem key={item.id} item={item} />)}
    </ul>
  );
});

// useMemo - for expensive calculations
function FilteredList({ items, filter }: Props) {
  const filteredItems = useMemo(
    () => items.filter(item => item.name.includes(filter)),
    [items, filter]
  );

  return <List items={filteredItems} />;
}

// useCallback - for functions passed to memoized children
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  return <MemoizedChild onClick={handleClick} />;
}
```

### When NOT to Memoize

- Cheap components (< 20 elements)
- Components that receive new props every render anyway
- Primitive props (strings, numbers, booleans)
- When the calculation is trivial (simple array operations on < 100 items)

### Code Splitting

```typescript
// Route-based splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}

// Component-based splitting for heavy components
const HeavyChart = lazy(() => import('./components/HeavyChart'));

function Analytics() {
  return (
    <div>
      <h1>Analytics</h1>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart data={data} />
      </Suspense>
    </div>
  );
}
```

## Common Anti-Patterns to Avoid

### ❌ Prop Drilling

```typescript
// Bad: Passing props through many levels
function App() {
  const [user, setUser] = useState(null);
  return <Layout user={user} setUser={setUser} />;
}
function Layout({ user, setUser }) {
  return <Header user={user} setUser={setUser} />;
}
function Header({ user, setUser }) {
  return <UserMenu user={user} setUser={setUser} />;
}

// Good: Use Context
const UserContext = createContext<UserContextType | null>(null);

function App() {
  const [user, setUser] = useState(null);
  return (
    <UserContext.Provider value={{ user, setUser }}>
      <Layout />
    </UserContext.Provider>
  );
}

function UserMenu() {
  const { user, setUser } = useContext(UserContext)!;
  // Use directly
}
```

### ❌ useEffect for Derived State

```typescript
// Bad: Using effect for derived state
function Form({ items }) {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setTotal(items.reduce((sum, item) => sum + item.price, 0));
  }, [items]);

  return <span>Total: {total}</span>;
}

// Good: Calculate during render
function Form({ items }) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  // Or with useMemo if expensive
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items]
  );

  return <span>Total: {total}</span>;
}
```

### ❌ Missing Cleanup

```typescript
// Bad: Memory leak from uncleared subscription
useEffect(() => {
  const subscription = api.subscribe(handleUpdate);
  // Missing cleanup!
}, []);

// Good: Always clean up
useEffect(() => {
  const subscription = api.subscribe(handleUpdate);
  return () => subscription.unsubscribe();
}, []);

// Bad: Memory leak from uncleared interval
useEffect(() => {
  setInterval(() => setCount(c => c + 1), 1000);
}, []);

// Good: Clear interval
useEffect(() => {
  const id = setInterval(() => setCount(c => c + 1), 1000);
  return () => clearInterval(id);
}, []);
```

### ❌ Duplicate Server State

```typescript
// Bad: Copying API data to local state
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return user ? <Profile user={user} /> : <Loading />;
}

// Good: Use React Query for server state
function UserProfile({ userId }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Loading />;
  return <Profile user={user} />;
}
```

### ❌ Inline Objects/Arrays in JSX

```typescript
// Bad: Creates new reference every render
function Parent() {
  return <Child style={{ color: 'red' }} items={[1, 2, 3]} />;
}

// Good: Stable references
const style = { color: 'red' };
const items = [1, 2, 3];

function Parent() {
  return <Child style={style} items={items} />;
}

// Or with useMemo if dynamic
function Parent({ color }) {
  const style = useMemo(() => ({ color }), [color]);
  return <Child style={style} />;
}
```

## Error Handling Patterns

### Error Boundaries

```typescript
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Send to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ErrorPage />}>
  <App />
</ErrorBoundary>
```

### Async Error Handling

```typescript
// With React Query
function UserProfile({ userId }) {
  const { data, error, isError, refetch } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => fetchUser(userId),
  });

  if (isError) {
    return (
      <ErrorState
        message={error.message}
        onRetry={() => refetch()}
      />
    );
  }

  return <Profile user={data} />;
}
```

## Accessibility Checklist

- [ ] Use semantic HTML elements (`<button>`, `<nav>`, `<main>`)
- [ ] Add `aria-label` for icon-only buttons
- [ ] Implement keyboard navigation (Tab, Enter, Escape)
- [ ] Manage focus (trap in modals, restore after close)
- [ ] Use `aria-live` for dynamic announcements
- [ ] Ensure 4.5:1 color contrast ratio
- [ ] Support `prefers-reduced-motion`
- [ ] Add skip links for navigation
- [ ] Label all form inputs with `<label>` or `aria-labelledby`

## Testing Strategies

### Component Testing

```typescript
// Test user behavior, not implementation
import { render, screen, userEvent } from '@testing-library/react';

test('submits form with valid data', async () => {
  const onSubmit = vi.fn();
  render(<LoginForm onSubmit={onSubmit} />);

  await userEvent.type(screen.getByLabelText(/email/i), 'test@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'password123');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

  expect(onSubmit).toHaveBeenCalledWith({
    email: 'test@example.com',
    password: 'password123',
  });
});
```

### Hook Testing

```typescript
import { renderHook, act } from '@testing-library/react';

test('useCounter increments', () => {
  const { result } = renderHook(() => useCounter());

  expect(result.current.count).toBe(0);

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

## Key Principles Summary

1. **Composition over Inheritance** - Build complex UIs from simple components
2. **Colocation** - Keep state and logic close to where it's used
3. **Single Responsibility** - Each component/hook does one thing well
4. **Derive, Don't Duplicate** - Calculate values during render when possible
5. **Server State is Special** - Use React Query/SWR, don't put in local state
6. **Performance is a Feature** - Measure first, optimize strategically
7. **Accessibility Always** - Build accessible from day one
