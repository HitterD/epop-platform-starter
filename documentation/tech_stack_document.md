# Tech Stack Document for EPOP Platform Starter

This document explains, in simple terms, the technology choices behind the Enterprise Platform for Operational Performance (EPOP) starter kit. Each section describes why we picked certain tools and how they fit together to give you a solid foundation.

## Frontend Technologies

These tools shape what users see and interact with in their browsers.

- **Next.js 15 (App Router)**  
  A framework that handles both page rendering on the server (for fast initial loads) and client-side interactions (for smooth, app-like behavior). It also lets us define API routes next to pages.
- **React & TypeScript**  
  React builds the user interface using components, while TypeScript adds type checking to catch mistakes early. Together they make the code easier to maintain and refactor.
- **Tailwind CSS**  
  A utility-first styling framework that speeds up design by letting us apply styling rules directly in our markup. It keeps the CSS consistent and maintainable.
- **shadcn/ui**  
  A set of pre-built, headless UI components styled with Tailwind. It gives you buttons, forms, tables, modals, and more, all ready to customize to your brand.
- **Dynamic Theming (Dark Mode)**  
  Out of the box support for light and dark themes, letting users switch based on preference or system settings.
- **AI Assistant Integration (`assistant-ui` & `@ai-sdk`)**  
  Components and SDK hooks to embed AI-powered features, such as drafting messages or summarizing threads, directly into the UI.
- **Optional State Management (Zustand or Jotai)**  
  For complex real-time features (presence, notifications, chat threads), these lightweight libraries help keep the application state organized.

## Backend Technologies

These components power the server, manage data, and connect the frontend to the database.

- **Next.js API Routes**  
  We build RESTful endpoints (like `/api/auth/login`, `/api/projects`) right alongside the pages. This keeps frontend and backend code in one project.
- **Drizzle ORM & PostgreSQL**  
  Drizzle gives us a type-safe way to define and query database tables. PostgreSQL is a reliable open-source database that supports advanced features like full-text search and strong relational integrity.
- **Authentication (Custom JWT Flow)**  
  Built on the existing “Better Auth” starter, we replace or extend it with a JWT access/refresh token strategy. Passwords are hashed with Argon2id, and refresh tokens live in secure HTTP-only cookies.
- **Input Validation with Zod**  
  Each API route uses Zod schemas to verify incoming data. This prevents invalid or malicious data from ever reaching the database.
- **Real-Time Communication (Socket.IO & Redis)**  
  A Socket.IO server handles live chat, typing indicators, read receipts, and user presence. Redis serves as the adapter for pub/sub messaging and tracks user status across multiple server instances.
- **File Storage (MinIO)**  
  An S3-compatible object store where users upload and download attachments. We issue presigned URLs so the browser can upload files directly and securely.
- **Background Jobs (BullMQ & Redis)**  
  Offloads tasks like sending batch emails or push notifications. This keeps API responses fast by running long processes in the background.
- **Service/Repository Layer**  
  Organized code into services (business logic) and repositories (data access) to keep API routes focused on request/response handling.

## Infrastructure and Deployment

Tools and platforms that keep the application running smoothly and let teams deploy updates with confidence.

- **Docker & Docker Compose**  
  Defines a local development stack with containers for Next.js, PostgreSQL, Redis, and MinIO. Ensures everyone on the team works with the same setup.
- **Vercel**  
  A cloud platform optimized for Next.js. Automatic deployments on push, and built-in support for environment variables, serverless functions, and edge caching.
- **Environment Variables (`.env` Files)**  
  Centralized configuration for secrets like database URLs, JWT keys, and MinIO credentials. Keeps sensitive data out of the codebase.
- **Git & GitHub**  
  Version control and collaboration. Branching, pull requests, and code reviews ensure changes are tracked and quality is maintained.
- **CI/CD Pipelines**  
  Automated testing and deployment workflows (e.g., GitHub Actions) run on every push to catch errors early and deploy only when tests pass.

## Third-Party Integrations

External services that extend or simplify functionality.

- **Firebase Cloud Messaging (FCM)**  
  Manages device tokens and sends push notifications to web or mobile clients.
- **MinIO Client Library**  
  Handles the creation of presigned URLs for secure file uploads and downloads.
- **Redis**  
  Beyond real-time pub/sub, Redis can also serve as a caching layer to speed up frequent database reads.
- **AI SDK (`@ai-sdk`)**  
  Connects to your chosen AI service for features like message drafting, summarization, or search assistance.

## Security and Performance Considerations

Measures to protect user data and keep the app responsive.

**Security**

- JWT in HTTP-only cookies prevents JavaScript from stealing tokens.  
- Password hashing with Argon2id makes stored credentials safe even if the database is compromised.  
- Zod input validation blocks bad data at the API boundary.  
- Role-based access control and middleware guard protected routes and admin panels.  
- HTTPS everywhere—especially important for authentication and file uploads.

**Performance**

- Server-side rendering (SSR) of key pages allows fast first loads and better SEO.  
- Incremental Static Regeneration (ISR) for content that doesn’t change often.  
- Redis caching for expensive queries or frequently accessed data.  
- Cursor-based pagination in APIs to efficiently load large lists (e.g., long chat histories).  
- WebSocket connections via Socket.IO keep real-time updates lean and targeted.  

## Conclusion and Overall Tech Stack Summary

This starter kit combines modern, battle-tested technologies to give you:

- A **flexible front end** powered by Next.js, React, TypeScript, Tailwind CSS, and shadcn/ui for rapid UI development.  
- A **robust back end** using Next.js API routes, Drizzle ORM, PostgreSQL, custom JWT authentication, real-time communication with Socket.IO, and secure file storage via MinIO.  
- An **infrastructure** that ensures consistent development environments (Docker), seamless deployments (Vercel), and smooth team collaboration (Git/GitHub, CI/CD).  
- **Integrations** for push notifications (FCM), caching (Redis), background processing (BullMQ), and AI-powered features.  
- Carefully considered **security and performance** measures, from strong password hashing to server-side rendering and caching.

Together, these choices align with the EPOP’s goals of rapid feature development, scalability for enterprise usage, and a high-quality user experience. You can now focus on your unique business logic—messaging, project management, scheduling—and build on a solid, extensible foundation.