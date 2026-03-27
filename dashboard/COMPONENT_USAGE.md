# Component Usage Guide

This guide explains how to use the React components in the FloodGuard Admin Dashboard.

## UI Components

### Button Component

```jsx
import { Button } from './components/UI/Button';

// Primary button
<Button onClick={() => console.log('clicked')}>
  Submit
</Button>

// Button variants: primary, approve, reject, secondary
<Button variant="approve">Approve</Button>
<Button variant="reject">Reject</Button>
<Button variant="secondary">Info</Button>

// Button sizes: sm, md, lg
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// Disabled state
<Button disabled>Disabled</Button>

// Custom class
<Button className="custom-class">Custom</Button>
```

### Card Component

```jsx
import { Card } from './components/UI/Card';

// Basic card
<Card>
  <p>Card content</p>
</Card>

// Card with title
<Card title="Card Title">
  <p>Card content</p>
</Card>

// Card with title and icon
<Card title="Dashboard" title_icon="📊">
  <p>Card content</p>
</Card>

// Custom class
<Card className="custom-card">
  <p>Content</p>
</Card>
```

### Badge Component

```jsx
import { Badge } from './components/UI/Badge';

// Default badge (green)
<Badge>New</Badge>

// Badge variants: default, red, yellow, live
<Badge variant="red">Critical</Badge>
<Badge variant="yellow">Warning</Badge>
<Badge variant="live">LIVE</Badge>

// Custom class
<Badge className="custom-badge">Info</Badge>
```

### Toast Notifications

```jsx
import { useToast } from './context/ToastContext';

function MyComponent() {
  const { showToast } = useToast();

  const handleSuccess = () => {
    showToast('✅ Success!', 'var(--accent)');
  };

  const handleError = () => {
    showToast('❌ Error!', 'var(--danger)');
  };

  return (
    <>
      <button onClick={handleSuccess}>Show Success</button>
      <button onClick={handleError}>Show Error</button>
    </>
  );
}
```

## Layout Components

### Topbar Component

```jsx
import { Topbar } from './components/Layout/Topbar';

// Used in main App layout
<Topbar />
```

The Topbar displays:
- Logo with pulse indicator
- Critical zones alert
- Current time (updates every second)
- User avatar
- Logout button

### Sidebar Component

```jsx
import { Sidebar } from './components/Layout/Sidebar';

<Sidebar activeTab="overview" onTabChange={(tabId) => setActiveTab(tabId)} />
```

Props:
- `activeTab` - Current active tab ID
- `onTabChange` - Callback when tab is clicked

## Page Components

### Overview Page

```jsx
import { Overview } from './components/Pages/Overview';

<Overview onTabChange={(tabId) => setActiveTab(tabId)} />
```

Displays:
- 4 stat cards (Critical Zones, Pending Reports, Affected Areas, Safe Routes)
- Live activity feed
- Report sparkline chart
- Quick action buttons

### Reports Page

```jsx
import { Reports } from './components/Pages/Reports';

<Reports />
```

Features:
- List of flood reports with details
- Approve/Reject buttons
- Severity badges (high, medium, low)
- Auto-removes processed reports

### Weather Page

```jsx
import { Weather } from './components/Pages/Weather';

<Weather />
```

Features:
- Form to add weather data points
- Current conditions display
- Data table with all entries
- Update map functionality

### Dams Page

```jsx
import { Dams } from './components/Pages/Dams';

<Dams />
```

Features:
- Dam cards with water level status
- Flow rate information
- At-risk districts
- Progress bar visualization
- Mark downstream risk functionality

### Map Page

```jsx
import { FloodMap } from './components/Pages/Map';

<FloodMap />
```

Features:
- Interactive map container (Leaflet ready)
- Map controls (add warning/critical/safe zones)
- Zone legend
- Dynamic marker addition

### System Page

```jsx
import { System } from './components/Pages/System';

<System />
```

Displays:
- 6 architecture nodes in 2x3 grid
- Components: Admin Dashboard, Mobile App, Server, Data Sources, P2P, Security
- Responsive layout that stacks on mobile

## Context / State Management

### AuthContext

```jsx
import { useAuth } from './context/AuthContext';

function MyComponent() {
  const { isAuthenticated, currentUser, error, login, logout } = useAuth();

  const handleLogin = () => {
    const success = login('admin1', 'admin123');
    if (success) {
      console.log('Logged in!');
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {isAuthenticated && <p>Welcome, {currentUser}!</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleLogin}>Login</button>
      <button onClick={handleLogout}>Logout</button>
    </>
  );
}
```

### ToastContext

```jsx
import { useToast } from './context/ToastContext';

function MyComponent() {
  const { showToast } = useToast();

  const handleAction = () => {
    showToast('Action completed!', 'var(--accent)', 3000);
  };

  return <button onClick={handleAction}>Do Action</button>;
}
```

Parameters for `showToast(message, color, duration)`:
- `message` - Toast message text
- `color` - CSS color or var (default: 'var(--accent)')
- `duration` - Display duration in ms (default: 3000)

## Styling

### Using CSS Modules

```jsx
import styles from './MyComponent.module.css';

export function MyComponent() {
  return <div className={styles.container}>Content</div>;
}
```

### CSS Classes

```css
.container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 22px;
}
```

### Available CSS Variables

```css
--bg: #0a0d12;              /* Main background */
--surface: #111520;         /* Card background */
--surface2: #161c2a;        /* Secondary surface */
--surface3: #1d2538;        /* Tertiary surface */
--border: rgba(255,255,255,0.07);  /* Border color */
--accent: #00c9a7;          /* Primary accent (green) */
--accent2: #ff6b35;         /* Secondary accent (orange) */
--accent3: #f7c948;         /* Tertiary accent (yellow) */
--danger: #ff3f5b;          /* Danger/Error (red) */
--info: #4a9eff;            /* Info (blue) */
--text: #e8eaf0;            /* Main text */
--muted: #6b7a99;           /* Muted text */
--font-head: 'Syne', sans-serif;          /* Headline font */
--font-mono: 'DM Mono', monospace;        /* Monospace font */
--font-body: 'DM Sans', sans-serif;       /* Body font */
```

## Common Patterns

### Tab Navigation

```jsx
const [activeTab, setActiveTab] = useState('overview');

<Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

{activeTab === 'overview' && <Overview onTabChange={setActiveTab} />}
{activeTab === 'reports' && <Reports />}
```

### Conditional Rendering

```jsx
{isAuthenticated && (
  <>
    <Topbar />
    <main>Content</main>
  </>
)}

{!isAuthenticated && <LoginScreen />}
```

### Form Handling

```jsx
const [value, setValue] = useState('');

<input
  className={styles.formInput}
  value={value}
  onChange={(e) => setValue(e.target.value)}
/>

<Button onClick={() => handleSubmit(value)}>Submit</Button>
```

### Error Handling

```jsx
const handleAction = async () => {
  try {
    await someAsyncAction();
    showToast('✅ Success!', 'var(--accent)');
  } catch (error) {
    showToast('❌ Error!', 'var(--danger)');
  }
};
```

## Tips & Best Practices

1. **Props Drilling** - Use Context for deeply nested props
2. **Component Reusability** - Keep components small and focused
3. **Name Consistency** - Use clear, descriptive names
4. **Accessibility** - Add aria labels to interactive elements
5. **Performance** - Use useCallback for memoized callbacks
6. **Error Boundaries** - Wrap components in error boundaries
7. **Loading States** - Always show loading indicators for async operations
8. **Responsive Design** - Test at different breakpoints (900px, 768px, 480px)
9. **Color Consistency** - Use CSS variables instead of hardcoded colors
10. **Documentation** - Document complex component APIs

## Migration from HTML to React

If you need to convert more HTML components:

1. Create a new JSX file in appropriate directory
2. Extract state into hooks (useState for local, Context for global)
3. Extract styles into CSS modules
4. Use existing UI components for consistency
5. Add proper TypeScript types (optional but recommended)
6. Test all interactions
