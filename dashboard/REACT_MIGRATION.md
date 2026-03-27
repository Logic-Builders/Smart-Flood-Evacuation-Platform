# FloodGuard Admin Dashboard - React Version

This is a complete React transformation of the FloodGuard Admin Dashboard HTML application. The code is now organized into modular, reusable components with proper state management.

## Project Structure

```
src/
├── components/
│   ├── Auth/
│   │   ├── LoginScreen.jsx
│   │   └── LoginScreen.module.css
│   ├── Layout/
│   │   ├── Topbar.jsx
│   │   ├── Topbar.module.css
│   │   ├── Sidebar.jsx
│   │   └── Sidebar.module.css
│   ├── Pages/
│   │   ├── Overview.jsx
│   │   ├── Overview.module.css
│   │   ├── Reports.jsx
│   │   ├── Reports.module.css
│   │   ├── Weather.jsx
│   │   ├── Weather.module.css
│   │   ├── Dams.jsx
│   │   ├── Dams.module.css
│   │   ├── Map.jsx
│   │   ├── Map.module.css
│   │   ├── System.jsx
│   │   └── System.module.css
│   └── UI/
│       ├── Badge.jsx
│       ├── Badge.module.css
│       ├── Button.jsx
│       ├── Button.module.css
│       ├── Card.jsx
│       ├── Card.module.css
│       ├── Toast.jsx
│       └── Toast.module.css
├── context/
│   ├── AuthContext.jsx
│   └── ToastContext.jsx
├── App.jsx
├── App.module.css
├── index.js
├── index.css
└── ...
```

## Key Features

### Components Included

1. **Authentication**
   - `LoginScreen` - Secure login with demo credentials (admin1/admin123, admin2/flood2024)
   - `AuthContext` - Global auth state management

2. **Layout**
   - `Topbar` - Header with live clock, alerts, and user menu
   - `Sidebar` - Navigation with active tab highlighting and badges
   - Responsive design with proper spacing and styling

3. **Pages**
   - **Overview** - Dashboard with statistics, activity feed, and quick actions
   - **Reports** - User flood report management with approve/reject actions
   - **Weather** - Weather data entry and current conditions display
   - **Dams** - Dam water level monitoring with risk visualization
   - **Map** - Interactive flood map with zone marking (placeholder for Leaflet.js)
   - **System** - System architecture overview

4. **UI Components**
   - `Button` - Flexible button component with variants (primary, approve, reject, secondary)
   - `Card` - Reusable card container with title support
   - `Badge` - Status badges with color variants
   - `Toast` - Toast notifications with auto-dismiss

### Context & State Management

- **AuthContext** - Handles user authentication and login/logout
- **ToastContext** - Manages toast notifications across the app

## Styling

- **CSS Modules** - Each component has its own scoped styles for maintainability
- **Theme Variables** - Global CSS variables for consistent theming
- **Responsive Design** - Mobile-friendly breakpoints included
- **Dark Theme** - Modern dark UI with accent colors (green, red, yellow)

## Getting Started

### Installation

```bash
cd dashboard
npm install
```

### Running the App

```bash
npm start
```

The app will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

## Demo Credentials

- **Admin 1**: username: `admin1`, password: `admin123`
- **Admin 2**: username: `admin2`, password: `flood2024`

## Key Implementation Details

### Login System
- Pre-seeded credentials (no self-signup)
- JWT-ready architecture (current: simple validation)
- Error handling with user feedback
- Enter key support for quick login

### Component Communication
- Parent-to-child via props
- Child-to-parent via callbacks (e.g., `onTabChange`)
- Sibling communication via Context API

### Responsive Design
- 4-column grid on desktop, 2-column on tablets, 1-column on mobile
- Flex layouts for flexible component arrangement
- Media queries at 900px breakpoint

### Styling Approach
- CSS Modules prevent style conflicts
- Color scheme uses CSS variables for easy theming
- Consistent spacing and typography system
- Smooth animations and transitions

## Future Enhancements

1. **Leaflet.js Integration** - Real map functionality in Map component
2. **Real Data Integration** - Connect to backend API
3. **WebSocket Support** - Real-time updates for live data
4. **Advanced Charts** - GraphQL integration for sparklines and analytics
5. **Offline Support** - Service workers for PWA capability
6. **Authentication** - JWT token management and refresh
7. **Testing** - Jest and React Testing Library coverage
8. **Performance** - Code splitting and lazy loading

## File Size Optimization

The original HTML file (1 file, ~50KB) has been split into:
- **26+ Component files** with proper separation of concerns
- **CSS Modules** for scoped styling (no global CSS conflicts)
- **Modular Context** for state management
- Ready for tree-shaking and code splitting

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

MIT
