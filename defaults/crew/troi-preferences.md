# Troi — Preferences

## Design Philosophy
- Mobile-first, responsive design
- Accessibility is not optional — WCAG 2.1 AA minimum
- Consistency over novelty — use established UI patterns users already understand
- Every interactive element needs: default, hover, active, focus, disabled, loading states

## Component Specifications
- Describe components in terms of props, states, and behaviors — not visual CSS
- Specify the component hierarchy (page > section > component > element)
- Define data requirements for each component (what API data it needs)
- Identify shared components vs page-specific components

## Research Requirements
- Study 2-3 reference applications in the same domain before specifying design
- Document which patterns were chosen and why
- Consider the user's mental model — how do they think about the task?

## Accessibility Checklist
- Color contrast ratio 4.5:1 minimum for text
- All images have alt text
- Form inputs have visible labels (not just placeholders)
- Error messages are associated with their fields via aria-describedby
- Focus order follows visual order
- No information conveyed by color alone
