# Tailwind UI Patterns

Proven Tailwind CSS patterns for building premium, production-ready interfaces.

## Design Tokens Setup

### tailwind.config.js

```javascript
const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
      },
      fontFamily: {
        sans: ['Inter var', ...defaultTheme.fontFamily.sans],
        display: ['Cal Sans', 'Inter var', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      boxShadow: {
        'premium': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'glow': '0 0 20px rgba(14, 165, 233, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

## Button Patterns

### Primary Button

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-lg
  text-sm font-semibold text-white
  bg-brand-600
  shadow-sm hover:bg-brand-500
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600
  disabled:opacity-50 disabled:cursor-not-allowed
  transition-colors duration-150
">
  <PlusIcon className="h-4 w-4" />
  Add Item
</button>
```

### Secondary Button

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-lg
  text-sm font-semibold text-gray-900
  bg-white
  shadow-sm ring-1 ring-inset ring-gray-300
  hover:bg-gray-50
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600
  transition-colors duration-150
">
  Cancel
</button>
```

### Soft/Ghost Button

```tsx
<button className="
  inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-lg
  text-sm font-semibold text-brand-600
  hover:bg-brand-50
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600
  transition-colors duration-150
">
  Learn more
</button>
```

### Icon Button

```tsx
<button
  className="
    p-2 rounded-lg
    text-gray-400 hover:text-gray-500
    hover:bg-gray-100
    focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600
    transition-colors duration-150
  "
  aria-label="Close"
>
  <XMarkIcon className="h-5 w-5" />
</button>
```

### Button Sizes

```tsx
// Small
<button className="px-3 py-1.5 text-xs font-semibold rounded-md">Small</button>

// Medium (default)
<button className="px-4 py-2.5 text-sm font-semibold rounded-lg">Medium</button>

// Large
<button className="px-6 py-3 text-base font-semibold rounded-lg">Large</button>
```

## Form Patterns

### Input Field

```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
    Email
  </label>
  <div className="mt-2">
    <input
      type="email"
      id="email"
      className="
        block w-full rounded-lg border-0 py-2.5 px-3
        text-gray-900 shadow-sm
        ring-1 ring-inset ring-gray-300
        placeholder:text-gray-400
        focus:ring-2 focus:ring-inset focus:ring-brand-600
        sm:text-sm sm:leading-6
        transition-shadow duration-150
      "
      placeholder="you@example.com"
    />
  </div>
</div>
```

### Input with Error

```tsx
<div>
  <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
    Email
  </label>
  <div className="mt-2 relative">
    <input
      type="email"
      id="email"
      aria-invalid="true"
      aria-describedby="email-error"
      className="
        block w-full rounded-lg border-0 py-2.5 px-3 pr-10
        text-red-900 shadow-sm
        ring-1 ring-inset ring-red-300
        placeholder:text-red-300
        focus:ring-2 focus:ring-inset focus:ring-red-500
        sm:text-sm sm:leading-6
      "
    />
    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
      <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
    </div>
  </div>
  <p id="email-error" className="mt-2 text-sm text-red-600">
    Not a valid email address.
  </p>
</div>
```

### Select

```tsx
<div>
  <label htmlFor="country" className="block text-sm font-medium leading-6 text-gray-900">
    Country
  </label>
  <div className="mt-2">
    <select
      id="country"
      className="
        block w-full rounded-lg border-0 py-2.5 pl-3 pr-10
        text-gray-900 shadow-sm
        ring-1 ring-inset ring-gray-300
        focus:ring-2 focus:ring-inset focus:ring-brand-600
        sm:text-sm sm:leading-6
      "
    >
      <option>United States</option>
      <option>Canada</option>
      <option>Mexico</option>
    </select>
  </div>
</div>
```

### Checkbox

```tsx
<div className="flex items-start">
  <div className="flex h-6 items-center">
    <input
      id="comments"
      type="checkbox"
      className="
        h-4 w-4 rounded
        border-gray-300 text-brand-600
        focus:ring-brand-600
      "
    />
  </div>
  <div className="ml-3">
    <label htmlFor="comments" className="text-sm font-medium text-gray-900">
      Email notifications
    </label>
    <p className="text-sm text-gray-500">
      Get notified when someone comments on your post.
    </p>
  </div>
</div>
```

### Toggle/Switch

```tsx
// Using Headless UI
<Switch
  checked={enabled}
  onChange={setEnabled}
  className={cn(
    enabled ? 'bg-brand-600' : 'bg-gray-200',
    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full',
    'border-2 border-transparent transition-colors duration-200 ease-in-out',
    'focus:outline-none focus:ring-2 focus:ring-brand-600 focus:ring-offset-2'
  )}
>
  <span className="sr-only">Use setting</span>
  <span
    className={cn(
      enabled ? 'translate-x-5' : 'translate-x-0',
      'pointer-events-none relative inline-block h-5 w-5 transform rounded-full',
      'bg-white shadow ring-0 transition duration-200 ease-in-out'
    )}
  />
</Switch>
```

## Card Patterns

### Basic Card

```tsx
<div className="
  bg-white rounded-2xl
  shadow-sm ring-1 ring-gray-900/5
  hover:shadow-md
  transition-shadow duration-200
">
  <div className="p-6">
    <h3 className="text-lg font-semibold leading-6 text-gray-900">
      Card Title
    </h3>
    <p className="mt-2 text-sm text-gray-600">
      Card description goes here with supporting details.
    </p>
  </div>
</div>
```

### Card with Image

```tsx
<div className="
  bg-white rounded-2xl overflow-hidden
  shadow-sm ring-1 ring-gray-900/5
  hover:shadow-md
  transition-shadow duration-200
">
  <img
    src="/image.jpg"
    alt=""
    className="h-48 w-full object-cover"
  />
  <div className="p-6">
    <h3 className="text-lg font-semibold leading-6 text-gray-900">
      Card Title
    </h3>
    <p className="mt-2 text-sm text-gray-600">
      Card description goes here.
    </p>
  </div>
</div>
```

### Card with Actions

```tsx
<div className="
  bg-white rounded-2xl
  shadow-sm ring-1 ring-gray-900/5
  divide-y divide-gray-100
">
  <div className="p-6">
    <h3 className="text-lg font-semibold leading-6 text-gray-900">
      Card Title
    </h3>
    <p className="mt-2 text-sm text-gray-600">
      Card description goes here.
    </p>
  </div>
  <div className="px-6 py-4 flex justify-end gap-3">
    <button className="text-sm font-semibold text-gray-900 hover:text-gray-700">
      Cancel
    </button>
    <button className="text-sm font-semibold text-brand-600 hover:text-brand-500">
      Save
    </button>
  </div>
</div>
```

## Modal Patterns

### Modal Dialog

```tsx
// Using Headless UI
<Dialog open={isOpen} onClose={setIsOpen} className="relative z-50">
  {/* Backdrop */}
  <div className="fixed inset-0 bg-gray-500/75 transition-opacity" aria-hidden="true" />

  {/* Full-screen container */}
  <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
    <div className="flex min-h-full items-end justify-center p-4 sm:items-center sm:p-0">

      {/* Modal panel */}
      <DialogPanel className="
        relative transform overflow-hidden rounded-2xl
        bg-white text-left shadow-xl
        transition-all
        sm:my-8 sm:w-full sm:max-w-lg
      ">
        {/* Header */}
        <div className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold leading-6 text-gray-900">
            Modal Title
          </DialogTitle>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600">
            Modal content goes here.
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2.5 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-500 rounded-lg"
          >
            Confirm
          </button>
        </div>
      </DialogPanel>

    </div>
  </div>
</Dialog>
```

## Navigation Patterns

### Navbar

```tsx
<nav className="bg-white shadow-sm">
  <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
    <div className="flex h-16 justify-between">
      {/* Logo */}
      <div className="flex items-center">
        <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
      </div>

      {/* Desktop Navigation */}
      <div className="hidden sm:flex sm:items-center sm:gap-8">
        <a href="#" className="text-sm font-medium text-gray-900 hover:text-brand-600">
          Dashboard
        </a>
        <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Projects
        </a>
        <a href="#" className="text-sm font-medium text-gray-500 hover:text-gray-900">
          Team
        </a>
      </div>

      {/* User Menu */}
      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-gray-500">
          <BellIcon className="h-6 w-6" />
        </button>
        <img
          src="/avatar.jpg"
          alt=""
          className="h-8 w-8 rounded-full"
        />
      </div>
    </div>
  </div>
</nav>
```

### Sidebar

```tsx
<aside className="fixed inset-y-0 left-0 z-50 w-64 bg-gray-900">
  <div className="flex h-16 items-center px-6">
    <img src="/logo-white.svg" alt="Logo" className="h-8 w-auto" />
  </div>

  <nav className="mt-6 px-3">
    <ul className="space-y-1">
      <li>
        <a
          href="#"
          className="
            group flex items-center gap-3 rounded-lg px-3 py-2
            text-sm font-medium text-white
            bg-gray-800
          "
        >
          <HomeIcon className="h-5 w-5 text-gray-400 group-hover:text-white" />
          Dashboard
        </a>
      </li>
      <li>
        <a
          href="#"
          className="
            group flex items-center gap-3 rounded-lg px-3 py-2
            text-sm font-medium text-gray-400
            hover:bg-gray-800 hover:text-white
          "
        >
          <FolderIcon className="h-5 w-5" />
          Projects
        </a>
      </li>
    </ul>
  </nav>
</aside>
```

### Tabs

```tsx
<div>
  <div className="border-b border-gray-200">
    <nav className="-mb-px flex gap-8" aria-label="Tabs">
      <a
        href="#"
        className="
          border-b-2 border-brand-500 py-4 px-1
          text-sm font-medium text-brand-600
        "
      >
        Profile
      </a>
      <a
        href="#"
        className="
          border-b-2 border-transparent py-4 px-1
          text-sm font-medium text-gray-500
          hover:border-gray-300 hover:text-gray-700
        "
      >
        Settings
      </a>
    </nav>
  </div>
</div>
```

## Data Display Patterns

### Stats Cards

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
    <p className="text-sm font-medium text-gray-500">Total Revenue</p>
    <p className="mt-2 text-3xl font-semibold text-gray-900">$45,231.89</p>
    <p className="mt-2 flex items-center gap-1 text-sm">
      <ArrowUpIcon className="h-4 w-4 text-green-500" />
      <span className="text-green-600 font-medium">20.1%</span>
      <span className="text-gray-500">from last month</span>
    </p>
  </div>
</div>
```

### Data Table

```tsx
<div className="overflow-hidden rounded-xl shadow-sm ring-1 ring-gray-900/5">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Name
        </th>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
          Actions
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          John Doe
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Active
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
          <button className="text-brand-600 hover:text-brand-900">Edit</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

## Feedback Patterns

### Alert

```tsx
// Success
<div className="rounded-lg bg-green-50 p-4">
  <div className="flex">
    <CheckCircleIcon className="h-5 w-5 text-green-400" />
    <div className="ml-3">
      <p className="text-sm font-medium text-green-800">
        Successfully saved!
      </p>
    </div>
  </div>
</div>

// Error
<div className="rounded-lg bg-red-50 p-4">
  <div className="flex">
    <XCircleIcon className="h-5 w-5 text-red-400" />
    <div className="ml-3">
      <p className="text-sm font-medium text-red-800">
        There was an error processing your request.
      </p>
    </div>
  </div>
</div>
```

### Badge

```tsx
// Default
<span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
  Badge
</span>

// Success
<span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
  Active
</span>

// Warning
<span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
  Pending
</span>
```

### Loading Spinner

```tsx
<svg className="animate-spin h-5 w-5 text-brand-600" viewBox="0 0 24 24">
  <circle
    className="opacity-25"
    cx="12" cy="12" r="10"
    stroke="currentColor"
    strokeWidth="4"
    fill="none"
  />
  <path
    className="opacity-75"
    fill="currentColor"
    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
  />
</svg>
```

### Skeleton Loading

```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4" />
  <div className="h-4 bg-gray-200 rounded w-5/6" />
</div>
```

## Responsive Patterns

### Mobile-First Grid

```tsx
// 1 column mobile → 2 columns tablet → 3 columns desktop → 4 columns large
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
  {items.map(item => <Card key={item.id} {...item} />)}
</div>
```

### Responsive Stack

```tsx
// Stack mobile → Row desktop
<div className="flex flex-col sm:flex-row gap-4">
  <div className="flex-1">Column 1</div>
  <div className="flex-1">Column 2</div>
</div>
```

### Responsive Visibility

```tsx
// Hide on mobile, show on desktop
<div className="hidden lg:block">Desktop only</div>

// Show on mobile, hide on desktop
<div className="lg:hidden">Mobile only</div>
```

### Responsive Spacing

```tsx
<div className="px-4 sm:px-6 lg:px-8">
  <div className="py-8 sm:py-12 lg:py-16">
    Content with responsive padding
  </div>
</div>
```

## Dark Mode Patterns

```tsx
// Background
<div className="bg-white dark:bg-gray-900">

// Text
<p className="text-gray-900 dark:text-white">
<p className="text-gray-600 dark:text-gray-300">

// Borders
<div className="border border-gray-200 dark:border-gray-700">

// Cards
<div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-gray-700">

// Inputs
<input className="
  bg-white dark:bg-gray-800
  text-gray-900 dark:text-white
  ring-gray-300 dark:ring-gray-600
  focus:ring-brand-600 dark:focus:ring-brand-500
">
```

## Animation Patterns

### Hover Effects

```tsx
// Scale
<div className="hover:scale-105 transition-transform duration-200">

// Shadow
<div className="hover:shadow-lg transition-shadow duration-200">

// Color
<button className="hover:bg-brand-500 transition-colors duration-150">
```

### Enter/Exit

```tsx
// Fade in
<div className="animate-fade-in">

// Slide up
<div className="animate-slide-up">

// For Headless UI transitions
<Transition
  show={isOpen}
  enter="transition-opacity duration-300"
  enterFrom="opacity-0"
  enterTo="opacity-100"
  leave="transition-opacity duration-200"
  leaveFrom="opacity-100"
  leaveTo="opacity-0"
>
```

## Class Organization Convention

Organize Tailwind classes in this order for consistency:

1. **Layout**: flex, grid, block, hidden
2. **Position**: relative, absolute, fixed
3. **Box Model**: w-, h-, p-, m-
4. **Typography**: text-, font-, leading-
5. **Visual**: bg-, border-, shadow-, ring-
6. **Interactivity**: hover:, focus:, active:
7. **Responsive**: sm:, md:, lg:, xl:
8. **Dark Mode**: dark:
9. **Animation**: transition-, animate-

Example:
```tsx
className="
  flex items-center justify-center gap-2
  relative
  px-4 py-2.5
  text-sm font-semibold text-white
  bg-brand-600 rounded-lg shadow-sm
  hover:bg-brand-500
  focus-visible:outline focus-visible:outline-2
  sm:px-6
  dark:bg-brand-500 dark:hover:bg-brand-400
  transition-colors duration-150
"
```
