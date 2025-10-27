# EPOP Platform Architecture Document

## Overview

The Enterprise Platform for Operational Performance (EPOP) is a comprehensive real-time messaging, scheduling, and project management system built with modern web technologies. This document outlines the complete architecture, data models, API design, and implementation details.

## Technology Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, React, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Custom JWT implementation with access/refresh tokens
- **Real-time**: Socket.IO with Redis adapter
- **File Storage**: MinIO S3-compatible storage
- **AI Integration**: assistant-ui with Vercel @ai-sdk
- **Push Notifications**: Firebase Cloud Messaging (FCM)

## Database Schema

### Core Authentication Tables

#### `users`
- Primary user management with role-based access (ADMIN/USER)
- Password hashing using PBKDF2 with salt
- Account status tracking (ACTIVE/INACTIVE/SUSPENDED)
- Failed login attempt tracking with automatic lockout
- Email verification and password reset tokens

#### `refresh_tokens`
- JWT refresh token management
- Device fingerprinting for security
- Expiration tracking and automatic cleanup

#### `fcm_tokens`
- Push notification token registration per device/platform
- Device information and status tracking

#### `audit_logs`
- Comprehensive audit trail for all security events
- Actor tracking and metadata storage

### Organizational Structure

#### `divisions`
- Hierarchical organization structure with parent-child relationships
- Support for nested divisions and departments

#### `division_members`
- User membership in organizational divisions
- Role-based permissions within divisions

#### `settings`
- System-wide configuration management
- Category-based organization of settings
- Role-specific access to settings

### Messaging System

#### `conversations`
- Multi-type conversations (DM, GROUP, PROJECT)
- Last message tracking for performance
- Archival support

#### `conversation_members`
- User participation in conversations
- Read receipt tracking
- Mute functionality with duration

#### `messages`
- Rich-text message storage (TipTap JSON format)
- Thread support via parent message relationships
- Message status tracking (SENT, DELIVERED, READ)
- Edit/delete soft support
- Full-text search capabilities via PostgreSQL tsvector

#### `message_reactions`
- Emoji reaction support
- User-specific reaction tracking

#### `typing_indicators`
- Real-time typing indicators
- Automatic expiration for cleanup

#### `read_receipts`
- Detailed read receipt tracking
- Timestamp capture for each user

### Project Management

#### `projects`
- Project metadata and status tracking
- Progress percentage calculation
- Tag-based organization
- Time-based planning (start/end dates)

#### `project_members`
- Role-based project participation (OWNER, MAINTAINER, CONTRIBUTOR, VIEWER)
- Invitation tracking

#### `tasks`
- Detailed task management with hierarchical support
- Status workflow (TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED)
- Priority levels and assignment tracking
- Time tracking (estimated vs actual hours)
- Due date management

#### `task_dependencies`
- Task dependency tracking for project management
- Multiple dependency types supported

#### `project_activity`
- Comprehensive project activity logging
- Actor-based tracking

### Calendar System

#### `calendar_events`
- Multi-source calendar events (manual, message extraction, task due dates)
- All-day and time-specific events
- Recurring event support with RRULE
- Timezone-aware scheduling
- Reminder configuration

#### `event_attendees`
- Event attendance tracking
- RSVP support with multiple response types

#### `recurring_event_instances`
- Individual instance tracking for recurring events
- Cancellation support for specific instances

### File Management

#### `files`
- Comprehensive file metadata tracking
- MinIO integration with presigned URLs
- Duplicate detection via file hashing
- Thumbnail and preview generation tracking
- Retention policies and access control

#### `file_associations`
- Multi-resource file attachment support
- Entity-based file organization (messages, projects, tasks)

#### `file_access_logs`
- Detailed file access auditing
- IP address and user agent tracking

#### `file_shares`
- Secure file sharing capabilities
- Password protection support
- Expiration and download limits

## API Architecture

### Authentication Endpoints

#### `/api/auth/register`
- User registration with comprehensive validation
- Password strength requirements
- Email uniqueness checking
- Automatic JWT token generation

#### `/api/auth/login`
- Secure authentication with rate limiting
- Failed attempt tracking with account lockout
- Device fingerprinting support
- "Remember me" functionality

#### `/api/auth/logout`
- Secure token revocation
- Cookie cleanup

#### `/api/auth/refresh`
- JWT token rotation
- Automatic token cleanup

#### `/api/auth/password/request`
- Password reset request with secure token generation
- Email delivery integration point

#### `/api/auth/password/reset`
- Password reset with token validation
- Automatic token invalidation

### Push Notification Endpoints

#### `/api/notify/register-token`
- FCM token registration per device
- Device information capture
- Automatic duplicate token cleanup

#### `/api/notify/unregister-token`
- Secure token cleanup
- Device-specific removal

#### `/api/notify/tokens`
- User token retrieval for management

## Security Implementation

### Authentication & Authorization

#### JWT Token Management
- **Access Tokens**: 15-minute expiration with user data
- **Refresh Tokens**: 7-day expiration with rotation
- **Secure Cookies**: HTTP-only refresh tokens, access tokens available to client
- **Device Fingerprinting**: Enhanced security tracking

#### Password Security
- **PBKDF2 Hashing**: 100,000 iterations with SHA-512
- **Salt Management**: Unique salt per password
- **Password Policies**: Enforced strength requirements
- **Account Lockout**: 5 failed attempts trigger 30-minute lockout

#### Rate Limiting
- **Login Attempts**: 5 per 15 minutes per IP
- **Registration**: 3 per 15 minutes per IP
- **Password Reset**: 5 per 15 minutes per IP
- **API Requests**: Configurable per-endpoint limits

### Data Protection

#### Audit Logging
- **Comprehensive Tracking**: All security events logged
- **Metadata Capture**: IP addresses, user agents, timestamps
- **Actor Identification**: Track who performed actions

#### Input Validation
- **Zod Schemas**: Type-safe validation for all inputs
- **SQL Injection Prevention**: Drizzle ORM parameterization
- **XSS Prevention**: Input sanitization and output encoding

## Performance Optimizations

### Database Indexing
- **Primary Keys**: UUID-based primary keys for all tables
- **Foreign Keys**: Indexed for fast joins
- **Search Indexes**: Full-text search on messages and files
- **Time-based Indexes**: Optimized for temporal queries

### Query Optimization
- **Cursor-based Pagination**: For large datasets (messages, files)
- **Select Field Limiting**: Only requested data returned
- **Connection Pooling**: Database connection management

### Caching Strategy
- **Application Cache**: In-memory caching for frequent queries
- **Redis Integration**: Real-time data caching
- **CDN Ready**: Static asset optimization

## Real-time Features

### Socket.IO Implementation
- **Presence Tracking**: Online/offline/away status
- **Typing Indicators**: Real-time typing notifications
- **Message Broadcasting**: Live message delivery
- **Read Receipts**: Real-time read status updates

### Redis Adapter
- **Horizontal Scaling**: Multiple server support
- **Room Management**: Efficient channel subscriptions
- **Message Persistence**: Message history management

## File Management Architecture

### MinIO Integration
- **Presigned URLs**: Secure direct upload/download
- **Multi-Format Support**: Images, documents, videos
- **Size Limits**: Role-based file size restrictions
- **Storage Classes**: Lifecycle management

### File Processing
- **Thumbnail Generation**: Automatic image/video thumbnails
- **Document Preview**: PDF and office document previews
- **Virus Scanning**: Integration point for security
- **Deduplication**: Hash-based duplicate detection

## Development & Deployment

### Environment Configuration
- **Environment Variables**: Secure configuration management
- **Docker Support**: Containerized deployment
- **Database Migrations**: Drizzle-managed schema changes
- **Seed Scripts**: Demo data for development

### Monitoring & Logging
- **Structured Logging**: JSON-formatted logs
- **Error Tracking**: Comprehensive error capture
- **Performance Metrics**: Request timing and database queries
- **Health Checks**: System status monitoring

## Testing Strategy

### Unit Testing
- **Authentication**: JWT validation, password hashing
- **Database Operations**: CRUD operations with edge cases
- **Business Logic**: Core application logic

### Integration Testing
- **API Endpoints**: Full request/response cycles
- **Database Integration**: Migration and seeding
- **Real-time Features**: Socket.IO connection handling

### E2E Testing
- **User Workflows**: Registration to project completion
- **Security Scenarios**: Attack prevention validation
- **Performance Testing**: Load and stress testing

## Future Enhancements

### AI Integration
- **Message Summarization**: Thread analysis and summarization
- **Task Automation**: AI-powered task creation from conversations
- **Smart Search**: Natural language query processing

### Advanced Features
- **Advanced Analytics**: Usage patterns and productivity metrics
- **Integration APIs**: Third-party service connections
- **Mobile Application**: React Native mobile app
- **Advanced Reporting**: Custom dashboards and insights

## Security Considerations

### Threat Mitigation
- **SQL Injection**: ORM parameterization
- **XSS**: Input sanitization and CSP headers
- **CSRF**: SameSite cookies and token validation
- **Rate Limiting**: Request throttling
- **Account Protection**: Lockout and monitoring

### Compliance
- **Data Retention**: Configurable retention policies
- **Access Control**: Role-based permissions
- **Audit Trails**: Complete activity logging
- **Data Privacy**: Minimal data collection and processing

## Conclusion

The EPOP platform architecture provides a robust, scalable foundation for enterprise communication and project management. The comprehensive security implementation, real-time capabilities, and modular design support both current requirements and future growth opportunities.

The implementation follows modern best practices including:
- **Security-First Design**: Comprehensive protection mechanisms
- **Performance Optimization**: Efficient data structures and caching
- **Scalability**: Horizontal scaling capabilities
- **Maintainability**: Clean architecture and comprehensive testing
- **User Experience**: Real-time features and intuitive interfaces

This architecture is designed to handle enterprise-scale workloads while maintaining security, performance, and reliability standards.