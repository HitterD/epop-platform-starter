# Frontend Guideline Document

This document outlines the frontend architecture, design principles, and technologies used in the EPOP (Enterprise Platform for Operational Performance) starter. It is written in everyday language to ensure clarity for both technical and non-technical readers.

## 1. Frontend Architecture

### 1.1 Technology Stack
- **Framework**: Next.js 15 (App Router) for server-side rendering, API routes, and client-side interactivity.
- **UI Library**: React with TypeScript for type safety and maintainability.
- **Styling**: Tailwind CSS paired with the **shadcn/ui** component library for ready-made, customizable UI components.
- **AI Integration**: `assistant-ui` & `@ai-sdk` for embedding AI-driven features (e.g., message drafting, summarization).

### 1.2 How It Fits Together
- **Next.js App Router** handles page layouts, data fetching, and API endpoints all in one place.
- **Drizzle ORM + PostgreSQL** (backend) is accessed via API routes, but from a frontend perspective you fetch data with `fetch` or React hooks.
- **Socket.IO + Redis** (planned) will provide real-time chat and presence features through a WebSocket connection managed in React.
- **MinIO** integration via presigned URLs lets the client upload files securely.

### 1.3 Benefits for Scalability & Performance
- **Modular Structure**: Each feature lives in its own folder (`/app`, `/components`, `/lib`), making it easy to add or remove functionality.
- **Server-Side Rendering (SSR)** & **Static Rendering** where appropriate ensure fast initial page loads.
- **API Routes** in Next.js allow you to expand backend capabilities without spinning up a separate server.

## 2. Design Principles

### 2.1 Key Principles
1. **Usability**: Clear navigation and predictable interactions. Tooltips, loading states, and error messages guide the user.
2. **Accessibility (A11y)**: Keyboard navigation, ARIA attributes, and contrast ratios are audited for enterprise compliance.
3. **Responsiveness**: Mobile-first design with breakpoints to adapt layouts on tablets and desktops.
4. **Consistency**: Shared colors, spacing, and typography across all screens.

### 2.2 How They’re Applied
- **Form Components** display inline validation errors and use appropriate input types (`email`, `password`).
- **Navigation** collapses to a hamburger menu on small screens.
- **Buttons & Links** use consistent padding, hover/focus states, and disabled styles.

## 3. Styling and Theming

### 3.1 Styling Approach
- **Utility-First** with Tailwind CSS. No separate CSS files—styles are applied via Tailwind classes.
- **Component Tokens**: shadcn/ui provides prebuilt components using Tailwind under the hood.

### 3.2 Theming
- **Light & Dark Modes** supported out of the box via Tailwind’s `dark:` variants.
- Theme toggle stored in `localStorage` and managed with a React Context.

### 3.3 Visual Style
- **Overall Style**: Modern flat design with subtle glassmorphism for modals and overlays.
- **Color Palette**:
  - Primary: `#4F46E5` (indigo-600)
  - Secondary: `#F43F5E` (rose-500)
  - Background (Light): `#F9FAFB` (gray-50)
  - Background (Dark): `#111827` (gray-900)
  - Surface: `#FFFFFF` / `#1F2937` (gray-800)
  - Accent: `#10B981` (emerald-500)
  - Error: `#EF4444` (red-500)

### 3.4 Typography
- **Font Family**: Inter (system fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI'`).
- **Headings**: Semi-bold, scaled using defined Tailwind typography plugin.
- **Body**: Regular weight, comfortable line-height for readability.

## 4. Component Structure

### 4.1 Organization
- `/app/` – Next.js pages and layouts.
- `/components/ui/` – Reusable UI primitives from shadcn/ui (buttons, modals, inputs).
- `/components/features/` – Feature-specific components (chat, project board, directory tree).
- `/hooks/` – Custom React hooks (e.g., `useSocket`, `useTheme`).
- `/lib/` – Client setups (Drizzle, MinIO, Socket.IO client).

### 4.2 Reusability
- Components accept props for labels, icons, and callbacks to maximize reuse.
- Compound components pattern for complex UI (e.g., `Modal.Trigger`, `Modal.Content`).

### 4.3 Benefits
- **Maintainability**: Changes to a single button style propagate everywhere.
- **Testability**: Small, focused components are easy to unit-test.

## 5. State Management

### 5.1 Approach
- **Local State**: Managed with React’s `useState` and `useReducer` inside components.
- **Global State**: Recommended to use **Zustand** or **Jotai** for:
  - User session and profile.
  - Real-time data (conversations, presence).
  - Theme preference.

### 5.2 Data Fetching
- Next.js `useRouter` + `fetch` or `SWR` for caching and revalidation of API data.
- Socket.IO events update global state via hooks.

## 6. Routing and Navigation

### 6.1 Next.js App Router
- **File-Based Routes** in `/app` directory, e.g.,:
  - `/app/dashboard/layout.tsx` – Dashboard shell (sidebar + topbar).
  - `/app/dashboard/page.tsx` – Main dashboard content.
  - `/app/dashboard/projects/[id]/page.tsx` – Project details.
- **Nested Layouts** ensure persistent UI (sidebar stays visible).

### 6.2 Navigation Flow
1. Visitor lands on `/login` or `/register`.
2. After auth, user is redirected to `/dashboard`.
3. Sidebar links navigate to `/dashboard/projects`, `/dashboard/messages`, `/dashboard/directory`.
4. Protected routes guarded by a small client-side wrapper checking if the JWT token exists.

## 7. Performance Optimization

- **Code Splitting**: Next.js automatically splits pages, and dynamic `import()` is used for heavy components (e.g., rich-text editor).
- **Lazy Loading**: Images and charts load only when in viewport via `next/image` and `react-intersection-observer`.
- **Caching**: HTTP caching headers on API routes and CDN caching on static assets.
- **Bundle Analysis**: Regularly audit with `next/bundle-analyzer` to keep bundles lean.

## 8. Testing and Quality Assurance

### 8.1 Unit & Integration Tests
- **Vitest** + **React Testing Library**:
  - Test components, custom hooks, and utility functions.
  - Mock API calls and Socket.IO events.

### 8.2 End-to-End Tests
- **Playwright**:
  - Simulate user flows (signup → dashboard → send message with attachment).
  - Verify responsive layouts and accessibility.

### 8.3 Linting & Formatting
- **ESLint** with recommended React/Next.js rules.
- **Prettier** for consistent code style.
- **Tailwind Linting** plugin to ensure correct class usage.

## 9. Conclusion and Overall Frontend Summary

This guideline lays out a clear, scalable, and maintainable frontend setup for the EPOP platform. Leveraging Next.js 15, React with TypeScript, Tailwind CSS, and shadcn/ui, the architecture balances performance (SSR + code splitting) and developer productivity (utility-first styling, reusable components). The design prioritizes usability, accessibility, and responsiveness. Global state is managed with lightweight libraries (Zustand/Jotai), and real-time features use Socket.IO. Comprehensive testing with Vitest and Playwright ensures reliability. Together, these practices equip your team to focus on EPOP’s unique business logic with confidence that the foundational code is rock solid.