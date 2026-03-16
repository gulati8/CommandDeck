# Frontend Standards

## Architecture
- React with TypeScript
- Component hierarchy: pages > layouts > features > shared components
- Co-locate component files: Component.tsx, Component.test.tsx, Component.module.css
- Server state (API data) via TanStack Query; client state (UI) via Context or Zustand
- Never store derived data — compute it

## Accessibility (WCAG 2.1 AA)
- Semantic HTML elements over generic divs
- All interactive elements keyboard-accessible
- Color contrast minimum 4.5:1 for normal text, 3:1 for large text
- Form inputs have visible labels and error descriptions
- Focus management on navigation and modal interactions
- Skip-to-content link on all pages
- aria-live regions for dynamic content updates

## Performance
- Lazy load routes and heavy components
- Optimize images (WebP, srcset for responsive)
- Code split by route
- No blocking renders — show loading skeletons, not spinners

## Error Handling
- Error boundaries around every route and major feature
- User-friendly error messages (not stack traces)
- Retry mechanisms for failed API calls
- Offline-aware UI where applicable
