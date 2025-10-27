# Project Requirements Document (PRD)

## 1. Project Overview

The **Enterprise Platform for Operational Performance (EPOP)** is a modern web application designed to bring together real-time messaging, project management, and scheduling into a single, unified interface. Its goal is to eliminate fragmented workflows and scattered communication tools by offering a secure, extensible dashboard where teams can chat, track projects, and view calendars all in one place.

Built on a pre-configured full-stack foundation, EPOP accelerates development by handling user authentication, data persistence, theming, and deployment readiness out of the box. Your team can immediately focus on adding unique business logic—such as custom project workflows, advanced metrics, and AI-powered assistance—rather than setting up boilerplate infrastructure.

**Key Objectives & Success Criteria**
- Enable users to sign up, log in, and access a protected dashboard within seconds.
- Provide real-time chat and presence indicators for seamless team communication.
- Offer a basic Kanban project board and a viewable calendar in version 1.
- Support secure file attachments and downloads via an S3-compatible service.
- Maintain page load times under 300ms for core screens.

## 2. In-Scope vs. Out-of-Scope

### In-Scope (Version 1)
- JWT-based user authentication (sign-up, login, logout, password reset via email).
- Protected dashboard with sidebar (Inbox, Projects, Directory) and top bar (Search, User Menu).
- Real-time messaging with typing indicators, read receipts, and user presence.
- Project management module: simple Kanban board for creating, moving, and deleting tasks.
- Scheduling module: basic calendar view showing events.
- Directory panel listing all organization members and roles.
- File storage integration using MinIO (presigned URL uploads and downloads).
- Dark mode theming toggle.
- Docker Compose setup for local development (Next.js, PostgreSQL, Redis, MinIO).
- Core API endpoints (CRUD for users, projects, conversations, calendar events).

### Out-of-Scope (Version 1)
- Mobile app or React Native client.
- Advanced analytics dashboards and KPI widgets beyond placeholders.
- Full-text search across conversations and tasks.
- Gantt charts or complex project timelines.
- Push notifications via FCM (Firebase Cloud Messaging).
- Role-based access control beyond a basic admin/user split.
- Background job processing (email digests, scheduled reminders).
- AI Assistant integrations (e.g., message drafting) beyond placeholder hooks.

## 3. User Flow

A **new user** visits the landing page and signs up with an email address and password. After verifying the email (via a link sent automatically), they log in and receive a JWT access token stored in memory and a refresh token in a secure, HTTP-only cookie. Once authenticated, they are redirected to the main dashboard.

On the **dashboard**, the user sees a left sidebar with navigation links (Inbox for chats, Projects for Kanban boards, Directory for team members). The top bar offers a global search field and a user menu (with logout and profile settings). Selecting **Inbox** loads recent conversations and opens the chat view. Selecting **Projects** shows the Kanban board. Selecting **Calendar** (or a calendar widget on the home page) displays scheduled events. Users can upload attachments, which fetch a presigned URL from the server and upload directly to MinIO.

## 4. Core Features

- **Authentication**: Sign-up, login, logout, password reset. Implements access and refresh JWT tokens.
- **Protected Dashboard**: Pages and API routes guarded by authentication middleware.
- **Real-Time Messaging**: Socket.IO-powered chat with presence, typing indicators, and read receipts.
- **Project Management**: Kanban board component supporting task creation, editing, drag-and-drop, and deletion.
- **Scheduling / Calendar**: Calendar view showing events fetched from the backend. Create, edit, and delete events.
- **Organization Directory**: Tree or list view of all members, showing names, roles, and online status.
- **File Attachments**: File upload via presigned URLs to MinIO and metadata stored in the database.
- **Theming**: Light/dark mode toggle persisted per user.
- **API Layer**: RESTful endpoints for all core entities (users, conversations, projects, events).

## 5. Tech Stack & Tools

- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui component library.
- **Backend**: Next.js API routes, Node.js, TypeScript.
- **Database & ORM**: PostgreSQL, Drizzle ORM (type-safe SQL builder).
- **Real-Time**: Socket.IO server with Redis adapter for pub/sub and presence tracking.
- **File Storage**: MinIO (S3-compatible), accessed via server-generated presigned URLs.
- **Authentication**: JSON Web Tokens (JWT) for access/refresh flows, Argon2id for password hashing.
- **Containerization**: Docker Compose (Next.js, PostgreSQL, Redis, MinIO).
- **Deployment**: Vercel for frontend and API hosting; environment variables via `.env`.
- **Validation & State**: Zod for input validation; Zustand or Jotai for client-side global state (optional).

## 6. Non-Functional Requirements

- **Performance**: Core pages should render server-side within 200ms and hydrate in under 100ms on a 3G connection.
- **Scalability**: Socket.IO setup must support horizontal scaling using the Redis adapter.
- **Security**: 
  - All API routes require JWT validation.
  - Refresh tokens stored in HTTP-only cookies.
  - Passwords hashed with Argon2id.
  - File uploads restricted by size and MIME type.
- **Reliability**: Dockerized local environment mirrors production to prevent "works on my machine" issues.
- **Usability & Accessibility**: Follow WCAG 2.1 AA standards (keyboard navigation, ARIA labels).
- **Compliance**: GDPR-ready data handling (user consent, right to be forgotten).

## 7. Constraints & Assumptions

- **Node.js >= 18.x** is required for Next.js 15 and Drizzle ORM.
- **Redis** and **MinIO** services must be available (locally via Docker Compose or in a cloud environment).
- **Vercel** is the preferred hosting platform; serverless function cold starts should be minimized.
- Assumes users have modern browsers supporting ES2020 and WebSocket.
- Users will have stable internet; offline support is not required in v1.

## 8. Known Issues & Potential Pitfalls

- **Socket.IO Rate Limits**: Rapid reconnections can trigger rate limiting on serverless hosts. Mitigation: implement exponential backoff and sticky sessions if needed.
- **JWT Expiry & Refresh Races**: Simultaneous API calls when the access token expires can lead to multiple refresh attempts. Mitigation: serialize refresh calls on the client.
- **File Upload Errors**: Presigned URLs can expire or be misconfigured. Mitigation: validate URL generation logic and handle 403 errors gracefully.
- **Database Migrations**: Schema drift between environments can cause errors. Mitigation: use a migration tool and run migrations automatically on deploy.
- **State Inconsistency**: Real-time updates vs. REST fetches can conflict. Mitigation: centralize state in a store (Zustand) and apply optimistic updates with rollback.

---
**This PRD serves as the single source of truth for the EPOP project.** Next steps (Tech Stack Document, Frontend Guidelines, Backend Structure) can be derived directly from this specification without missing details.