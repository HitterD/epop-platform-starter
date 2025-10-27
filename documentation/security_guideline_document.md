# EPOP Platform Security Guidelines

This document outlines mandatory security controls and best practices for the Enterprise Platform for Operational Performance (EPOP). It aligns with core security principles and addresses the specific architecture, technologies, and workflows of your Next.js 15 + TypeScript + Drizzle ORM + PostgreSQL + Redis + MinIO codebase.

---

## 1. Core Security Principles

1. **Security by Design**: Embed security at every phase—design, development, testing, and deployment.  
2. **Least Privilege**: Grant only the permissions needed to perform a function (e.g., database roles, API scopes).  
3. **Defense in Depth**: Layer controls—network, application, data—to mitigate failure of any single control.  
4. **Fail Securely**: On errors or timeouts, default to denying access; avoid exposing stack traces or PII.  
5. **Secure Defaults**: Enable the most restrictive settings out of the box (e.g., require HTTPS, HTTP-only cookies).

---

## 2. Authentication & Access Control

### 2.1 JWT & Session Management
- Use **RS256** or **HS256** with a strong secret/ key pair; never allow `alg: none`.  
- Enforce short-lived access tokens (< 15 min) and long-lived refresh tokens stored in **httpOnly**, **Secure**, **SameSite=Strict** cookies.  
- Validate token claims (`iss`, `aud`, `exp`, `nbf`) on every request.  
- Implement **silent-refresh** endpoint under strict rate limiting to avoid token replay.

### 2.2 Password Policies & Hashing
- Enforce minimum length (12+ chars), complexity, and prohibit blacklisted passwords.  
- Hash with **Argon2id** or **bcrypt** w/ unique per-user salt.  
- Never store plaintext or reversible-encrypted passwords.

### 2.3 Role-Based Access Control (RBAC)
- Define roles (e.g., `user`, `manager`, `admin`) and assign granular permissions.  
- Enforce server-side authorization in middleware for `/app/api/**` and Next.js page handlers.  
- Validate each action against the user’s roles and resource ownership.

### 2.4 Multi-Factor Authentication (MFA)
- Offer TOTP (e.g., Google Authenticator) or SMS-based OTP as an additional verification step.  
- Store second-factor secrets encrypted at rest and require re-authentication for high-risk operations.

---

## 3. Input Handling & Data Validation

- Validate **all** inputs server-side using **zod** schemas: API body, query, and path parameters.  
- Sanitize user-generated content displayed in the UI: use React’s built-in XSS protections plus a custom sanitizer (e.g., `DOMPurify`) for rich-text input.  
- Use parameterized Drizzle queries or prepared statements to prevent SQL injection.  
- Validate file uploads:
  - Restrict by MIME type and file extension.  
  - Enforce maximum file size limits (configurable).  
  - Normalize filenames; disallow path-traversal sequences.

---

## 4. API & Service Security

- **Enforce HTTPS**: All API routes (`/api/*`) must require TLS 1.2+. Redirect HTTP to HTTPS.  
- **Rate Limiting & Throttling**: Apply per-IP and per-user limits on endpoints like `/auth/login`, `/auth/refresh`, and `/files/presign-upload`.  
- **CORS**: Restrict allowed origins to the official frontend domains; enable `Access-Control-Allow-Credentials` only as needed.  
- **Versioning**: Prefix endpoints (`/v1/projects`) to manage changes without breaking clients.  
- **Least Response Data**: Return only requested fields; avoid leaking internal IDs, file paths, or stack traces.

---

## 5. Real-Time Messaging Layer

- **Socket.IO Authentication**: Require a valid access token during handshake; reject unauthorized connections.  
- **Redis Adapter**: Secure Redis with ACLs and strong credentials; isolate pub/sub database.  
- **Event Authorization**: Validate each incoming event (e.g., `sendMessage`, `joinRoom`) against user’s permissions.  
- **Rate Limiting**: Throttle message sends per socket to prevent spamming or denial-of-service.

---

## 6. File Storage & MinIO Integration

- **Presigned URLs**: Generate short-lived, one-time-use URLs via `POST /api/files/presign-upload`.  
- **Access Policies**: Use MinIO buckets with least-privilege policies (e.g., separate buckets per user or project).  
- **Virus/Malware Scanning**: Integrate a scanning service (e.g., ClamAV) in the upload pipeline.  
- **Metadata Validation**: Store and verify content-type and size after upload; reject mismatches.

---

## 7. Data Protection & Privacy

- **At Rest Encryption**: Encrypt PostgreSQL data volumes (e.g., LUKS or managed RDS encryption).  
- **In Transit Encryption**: Enforce TLS for client–server, server–database, and server–MinIO connections.  
- **Secrets Management**: Do NOT commit secrets. Use Vault, AWS Secrets Manager, or environment variables protected by CI/CD.  
- **PII Handling**: Mask or redact PII in logs. Implement GDPR/CCPA compliant data deletion workflows.

---

## 8. Infrastructure & Deployment

- **Docker Hardening**:
  - Run containers as non-root users.  
  - Avoid unnecessary privileges (e.g., disable `--privileged`).  
- **Network Segmentation**: Place the database, Redis, and MinIO in a private network; only Next.js app can access them.  
- **TLS Configuration**: Use strong cipher suites; disable TLS 1.0/1.1.  
- **CI/CD Pipeline**:
  - Scan images for vulnerabilities.  
  - Deploy only from tagged commits.  
  - Rotate deploy keys regularly.
- **Disable Debug Endpoints** in production; ensure stack traces are off.

---

## 9. Dependency & Supply-Chain Security

- **Lockfiles**: Commit `package-lock.json` or `yarn.lock` for deterministic builds.  
- **Vulnerability Scanning**: Integrate SCA tools (e.g., Snyk, Dependabot) to detect CVEs in direct and transitive dependencies.  
- **Minimal Footprint**: Audit installed packages; remove unused modules.  
- **Regular Updates**: Schedule monthly dependency reviews and patching.

---

## 10. Monitoring, Logging & Incident Response

- **Centralized Logging**: Ship structured logs (JSON) with request IDs; redact sensitive fields.  
- **Metrics & Alerts**: Track auth failures, rate-limit blocks, error rates, CPU/memory; set up alerts for anomalies.  
- **Audit Trails**: Log admin-actions, file-downloads, and permission changes.  
- **Incident Playbook**: Define processes for breach detection, containment, and notification.

---

## 11. Developer Best Practices

- **Code Reviews**: Enforce security checklists in PR reviews: input validation, error handling, auth checks.  
- **Pair with QA**: Include security test cases in your test suite (unit, integration, Playwright).  
- **Secure Coding Training**: Regularly train teams on OWASP Top 10, dependency management, and new threat vectors.  
- **Documentation**: Keep this guideline and environment variable inventory up to date.

---

Adhering to these guidelines will ensure the EPOP platform is built with a robust, layered security posture—protecting your data, your users, and your enterprise reputation.
