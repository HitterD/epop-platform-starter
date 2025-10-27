# Backend Structure Document for EPOP Platform

This document describes the backend of the Enterprise Platform for Operational Performance (EPOP). It explains how the system is organized, where data lives, how different parts talk to each other, and how we keep everything running smoothly and securely.

## 1. Backend Architecture

**Overview:**
- We use Next.js both for the user interface and for server-side logic (API routes). This means one codebase handles web pages and data services.
- The server runs on Node.js and follows a simple, layered pattern:
  - **API Routes** receive requests from the front end.
  - **Service Layer** holds business rules (for example, creating a project or sending a message).
  - **Repository Layer** handles data operations (talking to the database).

**Key points:**
- **Stateless servers:** Each web process is identical and doesn’t store user data in memory. That lets us spin up as many copies as we need under high load.
- **Service/Repository separation:** Keeps code organized and testable. API routes stay thin, while services and repositories contain the real work.
- **Real-time support:** A Socket.IO server, paired with Redis, manages live chat features like typing indicators and presence.

**How it supports scale, maintenance, and speed:**
- **Scalability:** Stateless design and Redis-backed pub/sub let us add more servers easily. Database connection pooling and Next.js serverless functions keep requests fast.
- **Maintainability:** Clear separation of concerns (API vs. services vs. data) makes changes and debugging straightforward.
- **Performance:** Built-in caching at several layers (Redis, HTTP caching, CDN) reduces database load and speeds up responses.

## 2. Database Management

**Technology used:**
- **PostgreSQL** (relational SQL database).
- **Drizzle ORM** (type-safe database toolkit) to read and write data without hand-writing raw SQL.

**How data is handled:**
- Data is grouped into tables (for users, messages, projects, tasks, etc.).
- We use migrations to evolve the structure over time.
- Indexes and PostgreSQL features (like full-text search) help queries run quickly even on large datasets.
- Connection pooling ensures we reuse database connections rather than opening and closing them repeatedly.

## 3. Database Schema

### Human-Readable Description

1. **Users**: Personal details, login email, password hash, roles, creation date.
2. **RefreshTokens**: Stores issued refresh tokens securely per user.
3. **Conversations**: Chat groups or one-to-one threads.
4. **ConversationMembers**: Links users to conversations.
5. **Messages**: Text or metadata for each message in a conversation.
6. **MessageAttachments**: File references tied to messages.
7. **Projects**: High-level projects with an owner and status.
8. **ProjectMembers**: Users assigned to projects with roles.
9. **Tasks**: Work items under projects, with assignees and due dates.
10. **Notifications**: In-app or push alerts for users.
11. **CalendarEvents**: User-specific events for scheduling.

### SQL Schema (PostgreSQL)
```sql
CREATE TABLE users (
  id             UUID PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL,
  created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at     TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id           UUID PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE conversations (
  id           UUID PRIMARY KEY,
  name         TEXT,
  type         TEXT NOT NULL,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE conversation_members (
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES users(id) ON DELETE CASCADE,
  joined_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
  id               UUID PRIMARY KEY,
  conversation_id  UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id        UUID REFERENCES users(id),
  content          TEXT,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE message_attachments (
  id          UUID PRIMARY KEY,
  message_id  UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_name   TEXT NOT NULL,
  file_url    TEXT NOT NULL,
  file_size   BIGINT,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE projects (
  id            UUID PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  owner_id      UUID REFERENCES users(id),
  status        TEXT NOT NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE project_members (
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,
  joined_at   TIMESTAMP WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE tasks (
  id            UUID PRIMARY KEY,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  status        TEXT NOT NULL,
  assigned_to   UUID REFERENCES users(id),
  due_date      TIMESTAMP WITH TIME ZONE,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE notifications (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  payload     JSONB,
  is_read     BOOLEAN DEFAULT false,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE calendar_events (
  id          UUID PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  start_time  TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time    TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);
``` 

## 4. API Design and Endpoints

We follow a RESTful style. The frontend talks to these endpoints over HTTPS.

**Authentication**
- `POST /api/auth/register` — Create a new user.
- `POST /api/auth/login` — Check credentials and return access + refresh tokens.
- `POST /api/auth/refresh` — Get a new access token using a valid refresh token.
- `POST /api/auth/logout` — Invalidate the refresh token.

**Users**
- `GET /api/users/me` — Get current user profile.
- `PUT /api/users/me` — Update profile info.

**Conversations & Messages**
- `GET /api/conversations` — List user’s conversations.
- `POST /api/conversations` — Start a new conversation.
- `GET /api/conversations/:id/messages` — Fetch messages in a thread.
- `POST /api/conversations/:id/messages` — Send a new message.
- `POST /api/files/presign-upload` — Get a MinIO presigned URL.

**Projects & Tasks**
- `GET /api/projects` — List projects.
- `POST /api/projects` — Create a project.
- `GET /api/projects/:id` — Project details.
- `PUT /api/projects/:id` — Update project.
- `DELETE /api/projects/:id` — Remove a project.
- `GET /api/projects/:id/tasks` — List tasks in a project.
- `POST /api/projects/:id/tasks` — Create a task.
- `PUT /api/tasks/:id` — Update a task.
- `DELETE /api/tasks/:id` — Delete a task.

**Notifications & Calendar**
- `GET /api/notifications` — Fetch user notifications.
- `POST /api/calendar-events` — Create a calendar event.
- `GET /api/calendar-events` — List events.

**Real-Time**
- WebSockets via Socket.IO at `/socket.io/` for live chat, presence, typing indicators, and read receipts.

## 5. Hosting Solutions

**Local Development**
- Docker Compose brings up:
  - Next.js server
  - PostgreSQL database
  - Redis (for caching and Socket.IO pub/sub)
  - MinIO (S3-compatible storage)

**Production**
- **Next.js**: Hosted on Vercel (global edge network, automatic scaling).
- **PostgreSQL**: Managed in a cloud database service (Amazon RDS, Azure Database, or similar).
- **Redis**: Managed cache (Amazon ElastiCache, Azure Cache, or Redis Cloud).
- **MinIO**: Deployed in a container cluster or replaced by AWS S3 if desired.

**Benefits**
- **Reliability:** Managed services provide automatic backups, failover, and updates.
- **Scalability:** Each component can grow independently (e.g., adding more database replicas or Redis nodes).
- **Cost-effectiveness:** Pay-as-you-go pricing and options to right-size instances.

## 6. Infrastructure Components

- **Load Balancer / Edge Network:** Vercel’s edge CDN ensures fast delivery of pages and assets worldwide.
- **Caching:** Redis handles both real-time pub/sub for Socket.IO and data caching to reduce database hits.
- **Content Delivery Network (CDN):** Static images, scripts, and style files are served from a CDN layer.
- **Job Queue:** BullMQ (based on Redis) for background tasks like sending emails or push notifications.
- **Object Storage:** MinIO (or S3) for file uploads and downloads via presigned URLs.

These parts work together to serve content quickly, handle bursts of traffic, and offload slow operations to background workers.

## 7. Security Measures

- **Authentication & Authorization:** JWT access tokens for API requests, HTTP-only secure cookies for refresh tokens, and role-based checks in services.
- **Password Security:** Argon2id hashing algorithm for user passwords.
- **Transport Security:** HTTPS everywhere (TLS) to encrypt data in transit.
- **Data Encryption:** Cloud database encryption at rest, optional client-side encryption for very sensitive files.
- **Rate Limiting & Throttling:** Prevents abuse by limiting the number of requests per IP or user.
- **Input Validation:** All API inputs are checked (using Zod) to prevent malformed data or injection attacks.
- **Environment Isolation:** Secrets (database URLs, JWT keys) live in environment variables and are never committed to code.

## 8. Monitoring and Maintenance

- **Logging & Error Tracking:** Sentry for real-time error alerts and stack traces. Structured logs for each request (including request ID).
- **Performance Metrics:** Prometheus / Grafana (or hosted alternatives) monitor CPU, memory, response times, and database query performance.
- **Uptime & Health Checks:** Automated checks hit a `/health` endpoint to verify service readiness.
- **Backups & Migrations:** Daily database backups and versioned schema migrations via Drizzle’s migration scripts.
- **Automated Deployments:** CI/CD pipeline runs tests, builds Docker images, and deploys to staging/production on push to main.

## 9. Conclusion and Overall Backend Summary

The EPOP backend is a modern, full-stack solution built on Next.js, PostgreSQL, Redis, Socket.IO, and MinIO. It uses a clear, layered approach (API → Services → Repositories) for maintainability and testability. Real-time messaging, file storage, background jobs, and strong security practices ensure the platform can grow with your needs. Managed hosting and automated pipelines keep the system reliable, cost-effective, and easy to operate. This setup gives your team a solid foundation to focus on EPOP’s unique features without worrying about the plumbing underneath.