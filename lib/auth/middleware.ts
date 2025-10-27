import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { JWTService, JWTPayload } from './jwt';

export interface AuthenticatedRequest extends NextRequest {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

/**
 * Authentication middleware for API routes
 */
export async function withAuth(
    handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
    return async (req: NextRequest, context?: any): Promise<NextResponse> => {
        try {
            const token = extractTokenFromRequest(req);

            if (!token) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }

            const payload = JWTService.verifyAccessToken(token);

            // Verify user exists and is active
            const [user] = await db
                .select({
                    id: users.id,
                    email: users.email,
                    role: users.role,
                    status: users.status,
                })
                .from(users)
                .where(eq(users.id, payload.userId))
                .limit(1);

            if (!user) {
                return NextResponse.json(
                    { error: 'User not found' },
                    { status: 401 }
                );
            }

            if (user.status !== 'ACTIVE') {
                return NextResponse.json(
                    { error: 'Account is not active' },
                    { status: 403 }
                );
            }

            // Add user info to request
            (req as AuthenticatedRequest).user = {
                id: user.id,
                email: user.email,
                role: user.role,
            };

            return await handler(req as AuthenticatedRequest, context);
        } catch (error) {
            console.error('Authentication error:', error);

            if (error instanceof Error) {
                if (error.message.includes('expired')) {
                    return NextResponse.json(
                        { error: 'Token expired', code: 'TOKEN_EXPIRED' },
                        { status: 401 }
                    );
                }

                if (error.message.includes('invalid') || error.message.includes('verification failed')) {
                    return NextResponse.json(
                        { error: 'Invalid token' },
                        { status: 401 }
                    );
                }
            }

            return NextResponse.json(
                { error: 'Authentication failed' },
                { status: 401 }
            );
        }
    };
}

/**
 * Admin role middleware
 */
export function withAdmin(handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>) {
    return withAuth(async (req: AuthenticatedRequest, context?: any): Promise<NextResponse> => {
        if (!req.user || req.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        return await handler(req, context);
    });
}

/**
 * Extract JWT token from request
 */
function extractTokenFromRequest(req: NextRequest): string | null {
    // Try Authorization header first
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Try cookies
    const tokenCookie = req.cookies.get('access_token');
    if (tokenCookie) {
        return tokenCookie.value;
    }

    return null;
}

/**
 * Get user from request (for use in API routes)
 */
export function getUserFromRequest(req: NextRequest): {
    id: string;
    email: string;
    role: string;
} | null {
    try {
        const token = extractTokenFromRequest(req);
        if (!token) return null;

        const payload = JWTService.verifyAccessToken(token);
        return {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
        };
    } catch {
        return null;
    }
}

/**
 * Check if user has permission for a resource
 */
export async function checkResourcePermission(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string = 'read'
): Promise<boolean> {
    // This is a simplified permission check
    // In a real implementation, you might want to check:
    // - Project membership
    // - Conversation membership
    // - File ownership
    // - Division membership
    // etc.

    try {
        switch (resourceType) {
            case 'project':
                // Check if user is a member of the project
                const { projectMembers } = await import('@/db/schema');
                const [membership] = await db
                    .select()
                    .from(projectMembers)
                    .where(
                        eq(projectMembers.projectId, resourceId)
                    )
                    .limit(1);

                return !!membership;

            case 'conversation':
                // Check if user is a member of the conversation
                const { conversationMembers } = await import('@/db/schema');
                const [conversation] = await db
                    .select()
                    .from(conversationMembers)
                    .where(
                        eq(conversationMembers.conversationId, resourceId)
                    )
                    .limit(1);

                return !!conversation;

            case 'user':
                // Users can only access their own resources unless they're admin
                const [user] = await db
                    .select({ role: users.role })
                    .from(users)
                    .where(eq(users.id, userId))
                    .limit(1);

                return user?.role === 'ADMIN' || userId === resourceId;

            default:
                return false;
        }
    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

/**
 * Rate limiting middleware
 */
export function withRateLimit(
    maxRequests: number = 100,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (handler: (req: NextRequest, context?: any) => Promise<NextResponse>) => {
        return async (req: NextRequest, context?: any): Promise<NextResponse> => {
            const clientId = getClientIdentifier(req);
            const now = Date.now();

            // Clean up expired entries
            for (const [key, value] of requests.entries()) {
                if (value.resetTime < now) {
                    requests.delete(key);
                }
            }

            // Get or create client record
            const client = requests.get(clientId);

            if (!client) {
                requests.set(clientId, {
                    count: 1,
                    resetTime: now + windowMs,
                });
                return await handler(req, context);
            }

            // Reset if window expired
            if (client.resetTime < now) {
                client.count = 1;
                client.resetTime = now + windowMs;
                return await handler(req, context);
            }

            // Check rate limit
            if (client.count >= maxRequests) {
                return NextResponse.json(
                    {
                        error: 'Too many requests',
                        retryAfter: Math.ceil((client.resetTime - now) / 1000)
                    },
                    {
                        status: 429,
                        headers: {
                            'Retry-After': Math.ceil((client.resetTime - now) / 1000).toString(),
                            'X-RateLimit-Limit': maxRequests.toString(),
                            'X-RateLimit-Remaining': '0',
                            'X-RateLimit-Reset': client.resetTime.toString(),
                        }
                    }
                );
            }

            client.count++;

            const response = await handler(req, context);

            // Add rate limit headers
            response.headers.set('X-RateLimit-Limit', maxRequests.toString());
            response.headers.set('X-RateLimit-Remaining', (maxRequests - client.count).toString());
            response.headers.set('X-RateLimit-Reset', client.resetTime.toString());

            return response;
        };
    };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: NextRequest): string {
    // Try to get user ID if authenticated
    const user = getUserFromRequest(req);
    if (user) {
        return `user:${user.id}`;
    }

    // Fall back to IP address
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
    return `ip:${ip || 'unknown'}`;
}

/**
 * CORS middleware
 */
export function withCors(handler: (req: NextRequest, context?: any) => Promise<NextResponse>) {
    return async (req: NextRequest, context?: any): Promise<NextResponse> => {
        const origin = req.headers.get('origin');
        const allowedOrigins = [
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'http://localhost:3000',
        ];

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            const response = new NextResponse(null, { status: 200 });

            if (origin && allowedOrigins.includes(origin)) {
                response.headers.set('Access-Control-Allow-Origin', origin);
                response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
                response.headers.set('Access-Control-Allow-Credentials', 'true');
            }

            return response;
        }

        const response = await handler(req, context);

        // Add CORS headers to actual response
        if (origin && allowedOrigins.includes(origin)) {
            response.headers.set('Access-Control-Allow-Origin', origin);
            response.headers.set('Access-Control-Allow-Credentials', 'true');
        }

        return response;
    };
}