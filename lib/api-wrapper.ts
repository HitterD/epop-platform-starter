import { NextRequest, NextResponse } from 'next/server';
import { AuthenticatedRequest, withAuth } from './auth/middleware';

/**
 * API route wrapper that automatically handles JWT authentication
 * and token refresh for protected routes
 */
export function protectedApiRoute(
    handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
    return withAuth(async (req: AuthenticatedRequest, context?: any) => {
        try {
            // Add user context to response headers for debugging
            const response = await handler(req, context);

            if (req.user) {
                response.headers.set('X-User-ID', req.user.id);
                response.headers.set('X-User-Role', req.user.role);
            }

            return response;
        } catch (error) {
            console.error('Protected API route error:', error);

            // Handle different types of errors
            if (error instanceof Error) {
                // Return specific error messages for known error types
                if (error.message.includes('permission')) {
                    return NextResponse.json(
                        { error: 'Permission denied' },
                        { status: 403 }
                    );
                }

                if (error.message.includes('not found')) {
                    return NextResponse.json(
                        { error: 'Resource not found' },
                        { status: 404 }
                    );
                }

                if (error.message.includes('validation')) {
                    return NextResponse.json(
                        { error: 'Validation failed', details: error.message },
                        { status: 400 }
                    );
                }
            }

            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    });
}

/**
 * Admin-only API route wrapper
 */
export function adminApiRoute(
    handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
    return protectedApiRoute(async (req: AuthenticatedRequest, context?: any) => {
        if (!req.user || req.user.role !== 'ADMIN') {
            return NextResponse.json(
                { error: 'Admin access required' },
                { status: 403 }
            );
        }

        return handler(req, context);
    });
}

/**
 * Wrapper for checking resource ownership
 */
export function resourceOwnerApiRoute(
    resourceType: string,
    resourceIdParam: string = 'id',
    handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
    return protectedApiRoute(async (req: AuthenticatedRequest, context?: any) => {
        const resourceId = context?.params?.[resourceIdParam];

        if (!resourceId) {
            return NextResponse.json(
                { error: 'Resource ID required' },
                { status: 400 }
            );
        }

        // Check if user owns the resource or is admin
        if (req.user?.role !== 'ADMIN') {
            const { checkResourcePermission } = await import('./auth/middleware');

            const hasPermission = await checkResourcePermission(
                req.user!.id,
                resourceType,
                resourceId,
                'read'
            );

            if (!hasPermission) {
                return NextResponse.json(
                    { error: 'Access denied to this resource' },
                    { status: 403 }
                );
            }
        }

        return handler(req, context);
    });
}

/**
 * Utility to extract and validate request body
 */
export async function parseRequestBody<T>(
    req: NextRequest,
    schema?: { parse: (data: unknown) => T }
): Promise<{ data: T; error?: string }> {
    try {
        const body = await req.json();

        if (schema) {
            const data = schema.parse(body);
            return { data };
        }

        return { data: body as T };
    } catch (error) {
        console.error('Request body parsing error:', error);

        if (error instanceof Error && error.message.includes('validation')) {
            return {
                data: null as T,
                error: `Validation failed: ${error.message}`,
            };
        }

        return {
            data: null as T,
            error: 'Invalid request body',
        };
    }
}

/**
 * Utility to handle pagination
 */
export function getPaginationParams(req: NextRequest) {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;

    return {
        page: Math.max(1, page),
        limit: Math.min(100, Math.max(1, limit)), // Between 1 and 100
        offset,
    };
}

/**
 * Utility to create paginated response
 */
export function createPaginatedResponse<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
) {
    const totalPages = Math.ceil(total / limit);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Utility for standardized error responses
 */
export class ApiError extends Error {
    constructor(
        message: string,
        public statusCode: number = 500,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/**
 * Wrapper to handle async errors in API routes
 */
export function asyncHandler(
    handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
    return async (req: NextRequest, context?: any): Promise<NextResponse> => {
        try {
            return await handler(req, context);
        } catch (error) {
            console.error('Async handler error:', error);

            if (error instanceof ApiError) {
                return NextResponse.json(
                    {
                        error: error.message,
                        code: error.code,
                    },
                    { status: error.statusCode }
                );
            }

            if (error instanceof Error) {
                return NextResponse.json(
                    { error: error.message },
                    { status: 500 }
                );
            }

            return NextResponse.json(
                { error: 'Internal server error' },
                { status: 500 }
            );
        }
    };
}