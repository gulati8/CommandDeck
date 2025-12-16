# Component Architecture

Scalable React component organization and architecture patterns.

## File Structure

### Feature-Based Organization (Recommended)

```
src/
├── components/
│   ├── layout/                    # App-level layout components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Footer.tsx
│   │   └── index.ts
│   │
│   ├── ui/                        # Reusable presentational components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   ├── Card/
│   │   └── index.ts               # Re-export all UI components
│   │
│   └── features/                  # Feature-specific components
│       ├── auth/
│       │   ├── LoginForm.tsx
│       │   ├── RegisterForm.tsx
│       │   ├── useAuth.ts
│       │   └── index.ts
│       ├── dashboard/
│       │   ├── DashboardStats.tsx
│       │   ├── RecentActivity.tsx
│       │   ├── useDashboard.ts
│       │   └── index.ts
│       └── users/
│           ├── UserList.tsx
│           ├── UserProfile.tsx
│           ├── useUsers.ts
│           └── index.ts
│
├── hooks/                         # Global/shared hooks
│   ├── useDisclosure.ts
│   ├── useLocalStorage.ts
│   ├── useMediaQuery.ts
│   └── index.ts
│
├── lib/                           # Core utilities and configs
│   ├── api.ts                     # API client (axios instance)
│   ├── queryClient.ts             # React Query config
│   ├── store.ts                   # Zustand store
│   └── utils.ts                   # Helper functions (cn, formatDate)
│
├── pages/                         # Route components
│   ├── Dashboard.tsx
│   ├── Settings.tsx
│   └── index.ts
│
├── types/                         # TypeScript types
│   ├── user.ts
│   ├── api.ts
│   └── index.ts
│
└── styles/                        # Global styles
    └── globals.css
```

### Component File Structure

```
src/components/ui/Button/
├── Button.tsx           # Main component
├── Button.test.tsx      # Tests
├── Button.stories.tsx   # Storybook (optional)
└── index.ts             # Re-export
```

### Index File Pattern

```typescript
// src/components/ui/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';
export { Card } from './Card';

// Usage elsewhere
import { Button, Input, Modal } from '@/components/ui';
```

## Component Patterns

### Container/Presentational Split

```typescript
// Container: UserProfileContainer.tsx
// Handles data fetching, state, business logic
function UserProfileContainer({ userId }: { userId: string }) {
  const { data: user, isLoading, error } = useUser(userId);
  const { mutate: updateUser, isPending } = useUpdateUser();

  if (isLoading) return <ProfileSkeleton />;
  if (error) return <ErrorState message={error.message} />;
  if (!user) return <NotFound />;

  return (
    <UserProfileView
      user={user}
      isUpdating={isPending}
      onUpdate={updateUser}
    />
  );
}

// Presentational: UserProfileView.tsx
// Pure UI, no data fetching, easily testable
interface UserProfileViewProps {
  user: User;
  isUpdating: boolean;
  onUpdate: (data: Partial<User>) => void;
}

function UserProfileView({ user, isUpdating, onUpdate }: UserProfileViewProps) {
  return (
    <div className="space-y-6">
      <Avatar src={user.avatar} alt={user.name} size="lg" />
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
        <p className="text-gray-600">{user.email}</p>
      </div>
      <Button
        onClick={() => onUpdate({ status: 'active' })}
        loading={isUpdating}
      >
        Update Status
      </Button>
    </div>
  );
}
```

### Compound Components

For related components that share state:

```typescript
// Modal.tsx
const ModalContext = createContext<ModalContextType | null>(null);

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ open, onClose, children }: ModalProps) {
  return (
    <ModalContext.Provider value={{ open, onClose }}>
      <Dialog open={open} onClose={onClose}>
        {children}
      </Dialog>
    </ModalContext.Provider>
  );
}

Modal.Header = function ModalHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pt-6">
      <DialogTitle className="text-lg font-semibold">{children}</DialogTitle>
    </div>
  );
};

Modal.Body = function ModalBody({ children }: { children: React.ReactNode }) {
  return <div className="px-6 py-4">{children}</div>;
};

Modal.Footer = function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
      {children}
    </div>
  );
};

Modal.CloseButton = function ModalCloseButton() {
  const { onClose } = useContext(ModalContext)!;
  return (
    <button onClick={onClose} className="...">
      Cancel
    </button>
  );
};

// Usage
<Modal open={isOpen} onClose={close}>
  <Modal.Header>Confirm Action</Modal.Header>
  <Modal.Body>Are you sure you want to proceed?</Modal.Body>
  <Modal.Footer>
    <Modal.CloseButton />
    <Button onClick={handleConfirm}>Confirm</Button>
  </Modal.Footer>
</Modal>
```

### Polymorphic Components

Components that can render as different HTML elements:

```typescript
type PolymorphicProps<E extends React.ElementType> = {
  as?: E;
  children: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<E>, 'as' | 'children'>;

function Box<E extends React.ElementType = 'div'>({
  as,
  children,
  className,
  ...props
}: PolymorphicProps<E>) {
  const Component = as || 'div';
  return (
    <Component className={cn('p-4', className)} {...props}>
      {children}
    </Component>
  );
}

// Usage
<Box>Default div</Box>
<Box as="section">As section</Box>
<Box as="a" href="/home">As link</Box>
<Box as={Link} to="/home">As React Router Link</Box>
```

### Slots Pattern

For flexible component composition:

```typescript
interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  actions?: React.ReactNode;
}

function Card({ children, header, footer, actions }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm">
      {header && (
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>{header}</div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          {footer}
        </div>
      )}
    </div>
  );
}

// Usage
<Card
  header={<h3 className="font-semibold">User Profile</h3>}
  actions={<Button size="sm">Edit</Button>}
  footer={<span className="text-sm text-gray-500">Last updated: 2 hours ago</span>}
>
  <p>Card content here</p>
</Card>
```

## Props Patterns

### Discriminated Unions

For components with different modes:

```typescript
type ButtonProps =
  | { variant: 'primary'; loading?: boolean; onClick: () => void }
  | { variant: 'link'; href: string };

function Button(props: ButtonProps) {
  if (props.variant === 'link') {
    return <a href={props.href} className="text-brand-600">Link</a>;
  }

  return (
    <button onClick={props.onClick} disabled={props.loading}>
      {props.loading ? <Spinner /> : 'Click'}
    </button>
  );
}
```

### Spread Pattern for Native Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div>
      {label && <label className="text-sm font-medium">{label}</label>}
      <input
        className={cn(
          'block w-full rounded-lg border-0 py-2 px-3',
          error ? 'ring-red-500' : 'ring-gray-300',
          className
        )}
        aria-invalid={!!error}
        {...props}
      />
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

// Usage - all native input props work
<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  required
  autoComplete="email"
/>
```

### Default Props with TypeScript

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

function Button({
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  // variant and size are always defined
}
```

## State Architecture

### State Colocation

```
Component Tree:
App
├── Header
│   └── UserMenu (needs user)
├── Sidebar (needs user, navigation)
└── Main
    ├── Dashboard (needs stats)
    └── UserProfile (needs user, can edit)

State Placement:
- user → Context (cross-cutting, used in multiple places)
- stats → Dashboard local (only used there)
- navigation → Sidebar local or URL state
- edit mode → UserProfile local
```

### Context Organization

```typescript
// contexts/AuthContext.tsx
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: fetchCurrentUser,
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// App.tsx - Provider hierarchy
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <Router>
            <Routes />
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
```

### Zustand Store Organization

```typescript
// lib/store.ts
interface AppState {
  // UI State
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // UI State
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Notifications
  notifications: [],
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...notification, id: crypto.randomUUID() },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
}));

// Usage with selectors (prevents unnecessary re-renders)
function Sidebar() {
  const sidebarOpen = useAppStore((state) => state.sidebarOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  // ...
}
```

## Import Conventions

### Path Aliases

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/lib/*": ["src/lib/*"],
      "@/types/*": ["src/types/*"]
    }
  }
}
```

### Import Order Convention

```typescript
// 1. React/Next
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

// 3. Internal modules (aliases)
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';
import type { User } from '@/types';

// 4. Relative imports
import { UserCard } from './UserCard';
import { formatUserName } from './utils';

// 5. Styles (if any)
import styles from './styles.module.css';
```

## Component Guidelines

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Component | PascalCase | `UserProfile.tsx` |
| Hook | camelCase with `use` prefix | `useAuth.ts` |
| Utility | camelCase | `formatDate.ts` |
| Type | PascalCase | `User`, `ApiResponse` |
| Constant | SCREAMING_SNAKE_CASE | `MAX_FILE_SIZE` |
| Context | PascalCase with `Context` suffix | `AuthContext` |

### Component Checklist

Before considering a component complete:

- [ ] TypeScript types for all props
- [ ] Default values for optional props
- [ ] Loading/error states handled
- [ ] Accessibility (ARIA, keyboard, focus)
- [ ] Responsive design (mobile-first)
- [ ] Dark mode support (if applicable)
- [ ] Unit tests for logic
- [ ] Error boundaries where needed

### When to Create a New Component

Create a new component when:
- Code is repeated 3+ times (Rule of Three)
- Component exceeds 200 lines
- Component has multiple responsibilities
- Code could be reused in another feature
- Testing would be easier with isolation

Don't create a component when:
- Only used once and simple
- Abstraction makes code harder to understand
- You're creating it "just in case"

## Module Boundaries

### Feature Module Structure

```
src/features/users/
├── api/
│   └── userApi.ts         # API calls for this feature
├── components/
│   ├── UserList.tsx
│   ├── UserProfile.tsx
│   └── UserForm.tsx
├── hooks/
│   ├── useUsers.ts        # React Query hooks
│   └── useUserForm.ts
├── types/
│   └── user.ts            # Feature-specific types
├── utils/
│   └── userValidation.ts
└── index.ts               # Public API of the feature

// index.ts - Only export what other modules need
export { UserList } from './components/UserList';
export { UserProfile } from './components/UserProfile';
export { useUsers, useUser } from './hooks/useUsers';
export type { User, CreateUserInput } from './types/user';
```

### Dependency Rules

```
Allowed imports:
- features/X → components/ui (shared UI)
- features/X → hooks (shared hooks)
- features/X → lib (utilities)
- features/X → types (shared types)

Not allowed:
- features/X → features/Y (feature isolation)
- components/ui → features/* (UI shouldn't know about features)
- lib → components/* (utilities shouldn't depend on React)
```

### Cross-Feature Communication

When features need to communicate:

```typescript
// Option 1: URL state
// Navigate with params
navigate('/users', { state: { from: 'dashboard' } });

// Option 2: Global state (Zustand)
useAppStore.getState().setSelectedUserId(userId);

// Option 3: Events
const eventBus = new EventTarget();
eventBus.dispatchEvent(new CustomEvent('user:selected', { detail: { userId } }));

// Option 4: Parent orchestration
// Let a parent component coordinate between features
function Dashboard() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  return (
    <>
      <UserList onSelect={setSelectedUser} />
      {selectedUser && <UserDetails user={selectedUser} />}
    </>
  );
}
```
