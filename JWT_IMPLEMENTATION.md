# JWT Authentication Implementation

This document describes the comprehensive JWT-based authentication system implemented for the EPOP Platform.

## Features Implemented

### 1. Database Schema Extensions ✅

- **Refresh Tokens Table**: Stores hashed refresh tokens with device fingerprinting and expiration
- **Password Reset Tokens Table**: Dedicated table for secure password reset flow
- **Proper Indexing**: Optimized queries with appropriate indexes
- **Foreign Key Constraints**: Maintains data integrity

### 2. JWT Token Generation & Validation ✅

- **Secure Token Hashing**: SHA-256 hashing for stored tokens
- **Access Tokens**: 15-minute expiry with user claims
- **Refresh Tokens**: 7-day expiry with rotation
- **Timing-Safe Verification**: Prevents timing attacks
- **Device Fingerprinting**: Enhanced security with device tracking

### 3. Token Refresh API Endpoint ✅

- **Enhanced Security**: Rate limiting (5 requests/minute)
- **Multiple Token Sources**: Supports cookies and request body
- **Remember Me**: Extended expiry option (30 days)
- **Comprehensive Error Handling**: Clear error codes and messages
- **Security Headers**: Cache control and XSS prevention

### 4. Password Reset Flow with Email ✅

- **Email Service**: Pluggable email providers (Resend, SendGrid, AWS SES)
- **Beautiful Templates**: HTML email templates with security notices
- **Development Mode**: Console logging for development
- **Token Security**: Hashed storage with expiration
- **Audit Logging**: Complete security audit trail

### 5. FCM Token Registration & Client-Side JWT Management ✅

- **FCM Client Manager**: Automatic push notification registration
- **JWT Client Manager**: Automatic token refresh and storage
- **React Hooks**: Easy integration with React components
- **Authentication Context**: Centralized auth state management
- **Cross-Tab Sync**: Authentication state across browser tabs

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend     │    │   API Server   │    │   Database      │
│                │    │                │    │                │
│ React Context  │◄──►│ JWT Middleware │◄──►│ Token Tables    │
│ JWT Client     │    │ Token Refresh  │    │ User Tables     │
│ FCM Client    │    │ Password Reset │    │ Audit Logs     │
│ React Hooks   │    │ Email Service  │    │                │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Security Features

### Token Security
- **SHA-256 Hashing**: All stored tokens are hashed
- **Timing-Safe Comparison**: Prevents timing attacks
- **Token Rotation**: New refresh token on each use
- **Secure Cookies**: HttpOnly, Secure, SameSite headers
- **Expiration Handling**: Automatic token cleanup

### Authentication Security
- **Rate Limiting**: Configurable limits per endpoint
- **Account Lockout**: 5 failed attempts = 30-minute lock
- **Device Fingerprinting**: Track unauthorized access
- **IP Logging**: Comprehensive audit trail
- **CORS Protection**: Proper cross-origin handling

### Password Security
- **PBKDF2 Hashing**: 100,000 iterations with salt
- **Strength Validation**: Complex password requirements
- **Secure Reset Flow**: Tokenized password resets
- **Email Verification**: Prevents user enumeration

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login with token generation
- `POST /api/auth/refresh` - Access token refresh
- `POST /api/auth/logout` - User logout and cleanup
- `POST /api/auth/register` - User registration

### Password Reset
- `POST /api/auth/password/request` - Request password reset
- `POST /api/auth/password/reset` - Reset password with token

### Push Notifications
- `POST /api/notify/register-token` - Register FCM token
- `POST /api/notify/unregister-token` - Unregister FCM token
- `GET /api/notify/tokens` - List user's FCM tokens

## Client-Side Usage

### 1. Authentication Context
```tsx
import { AuthProviderWrapper } from '@/components/auth-provider';

function App() {
    return (
        <AuthProviderWrapper>
            {/* Your app components */}
        </AuthProviderWrapper>
    );
}
```

### 2. Using Auth Hook
```tsx
import { useAuth } from '@/contexts/auth-context';

function MyComponent() {
    const { user, login, logout, isAuthenticated, isAdmin } = useAuth();

    const handleLogin = async () => {
        const result = await login('user@example.com', 'password');
        if (result.success) {
            // Logged in successfully
        }
    };

    return (
        <div>
            {isAuthenticated ? (
                <p>Welcome, {user?.email}!</p>
            ) : (
                <button onClick={handleLogin}>Login</button>
            )}
        </div>
    );
}
```

### 3. Protected API Calls
```tsx
import { AuthUtils } from '@/lib/auth-utils';

const response = await AuthUtils.fetchWithAuth('/api/user/profile', {
    method: 'GET',
});
```

### 4. Admin-Only Components
```tsx
import { useRequireAdmin } from '@/contexts/auth-context';

function AdminPanel() {
    const { user } = useRequireAdmin();

    return <div>Admin content for {user?.email}</div>;
}
```

## Environment Variables

### Email Configuration
```env
EMAIL_PROVIDER=resend                    # Email provider (resend, sendgrid, ses, smtp)
RESEND_API_KEY=your_resend_key         # Resend API key
EMAIL_FROM_EMAIL=noreply@epop-platform.com
EMAIL_FROM_NAME=EPOP Platform
EMAIL_REPLY_TO=support@epop-platform.com
```

### JWT Configuration
```env
JWT_SECRET=your_jwt_secret_key            # Access token secret
JWT_REFRESH_SECRET=your_refresh_secret    # Refresh token secret
```

### Application URLs
```env
NEXT_PUBLIC_APP_URL=https://your-app.com # Base URL for email links
NEXT_PUBLIC_APP_VERSION=1.0.0           # Version for device info
```

## Database Migration

Run the migration to add new tables:

```sql
-- Add token_hash column to refresh_tokens
ALTER TABLE "refresh_tokens" ADD COLUMN "token_hash" text;
CREATE UNIQUE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens" ("token_hash");

-- Create password_reset_tokens table
CREATE TABLE "password_reset_tokens" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "token" text NOT NULL,
    "token_hash" text NOT NULL,
    "expires_at" timestamp NOT NULL,
    "is_used" boolean NOT NULL DEFAULT false,
    "used_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "ip_address" text,
    "user_agent" text,
    CONSTRAINT "password_reset_tokens_token_unique" UNIQUE("token"),
    CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
```

## Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (see above)

3. Run database migration:
```bash
npm run db:push
```

4. Start development server:
```bash
npm run dev
```

## Security Best Practices

### Production Checklist
- [ ] Use strong, unique JWT secrets
- [ ] Enable secure cookies (HTTPS only)
- [ ] Configure email provider properly
- [ ] Set up proper CORS origins
- [ ] Monitor audit logs
- [ ] Implement rate limiting in production
- [ ] Use environment-specific configurations

### Token Management
- [ ] Access tokens expire in 15 minutes
- [ ] Refresh tokens expire in 7 days
- [ ] Tokens are rotated on refresh
- [ ] Expired tokens are cleaned up
- [ ] Tokens are stored securely with HttpOnly cookies

### Password Security
- [ ] Minimum 8 characters with complexity requirements
- [ ] PBKDF2 with 100,000 iterations
- [ ] Account lockout after 5 failed attempts
- [ ] Secure reset tokens with 1-hour expiry
- [ ] Email verification for reset requests

## Monitoring & Debugging

### Audit Logs
All authentication events are logged in the `audit_logs` table:
- Login attempts (success/failure)
- Token refresh events
- Password changes and resets
- Admin actions
- Failed security attempts

### Development Mode
In development mode:
- Password reset tokens are logged to console
- Email content is displayed instead of sent
- Mock FCM tokens are generated
- Debug information is included in responses

## Error Handling

### Standard Error Response Format
```json
{
    "error": "Human readable error message",
    "code": "ERROR_CODE",
    "details": {}, // For validation errors
    "requiresLogin": true // For auth errors
}
```

### Common Error Codes
- `TOKEN_EXPIRED` - Access token has expired
- `INVALID_TOKEN` - Token is invalid or malformed
- `SESSION_REVOKED` - Session has been revoked
- `ACCOUNT_LOCKED` - Account is temporarily locked
- `CREDENTIALS_INVALID` - Email or password incorrect

## Testing

The system includes comprehensive example components for testing:
- `ExampleLogin` - Complete login flow demonstration
- `AuthProviderWrapper` - Production-ready auth provider
- Mock FCM tokens for development
- Email preview in development mode

## Performance Considerations

- Database indexes are optimized for common queries
- Token refresh requests are rate limited
- Automatic cleanup of expired tokens
- Efficient client-side token caching
- Minimal API calls through intelligent refresh

## Future Enhancements

- Multi-factor authentication (MFA)
- Social login integration
- Biometric authentication
- Advanced device management
- Real-time security monitoring
- Email/SMS two-factor authentication