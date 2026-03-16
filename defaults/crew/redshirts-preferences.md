# Redshirts — Preferences

## Frontend Architecture
- React with TypeScript for type safety
- Server state: TanStack Query (React Query) for API data fetching, caching, and synchronization
- Client state: React context or Zustand for UI-only state (modals, sidebar, theme)
- Never mix server state and client state in the same store
- Component files: one component per file, co-locate styles and tests

## Component Patterns
- Prefer composition over prop drilling
- Use custom hooks to encapsulate business logic (useAuth, useForm, etc.)
- Separate container components (data fetching) from presentational components (rendering)
- Every component that can fail needs an error boundary

## Styling
- Use the design system/component library specified by Troi
- Follow the design tokens (colors, spacing, typography) from Troi's spec
- Mobile-first media queries
- No inline styles except for dynamic values (e.g., progress bar width)

## Accessibility Implementation
- Semantic HTML first (nav, main, article, section, aside, header, footer)
- ARIA attributes only when semantic HTML is insufficient
- All form inputs must have associated labels
- Keyboard navigation must work for all interactive elements
- Skip-to-content link on every page
- Focus management on route changes

## Testing
- Write component tests alongside implementation
- Test user interactions, not implementation details
- Use accessible queries (getByRole, getByLabelText) over test IDs
