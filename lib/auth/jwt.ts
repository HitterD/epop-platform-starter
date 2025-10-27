import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
import { eq, and, lt } from 'drizzle-orm';
import { db } from '@/db';
import { users, refreshTokens, auditLogs } from '@/db/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Access token expires in 15 minutes
const JWT_REFRESH_EXPIRES_IN = '7d'; // Refresh token expires in 7 days

/**
 * Hash a token for secure storage
 */
function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify a token against its hash
 */
function verifyTokenHash(token: string, hash: string): boolean {
    const tokenHash = hashToken(token);
    return crypto.timingSafeEqual(Buffer.from(tokenHash), Buffer.from(hash));
}

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export class JWTService {
    /**
     * Generate an access token
     */
    static generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
        return jwt.sign(payload, JWT_SECRET, {
            expiresIn: JWT_EXPIRES_IN,
            issuer: 'epop-platform',
            audience: 'epop-client',
        });
    }

    /**
     * Generate a refresh token
     */
    static generateRefreshToken(): string {
        return jwt.sign(
            { type: 'refresh' },
            JWT_REFRESH_SECRET,
            { expiresIn: JWT_REFRESH_EXPIRES_IN }
        );
    }

    /**
     * Verify an access token
     */
    static verifyAccessToken(token: string): JWTPayload {
        try {
            return jwt.verify(token, JWT_SECRET, {
                issuer: 'epop-platform',
                audience: 'epop-client',
            }) as JWTPayload;
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Access token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid access token');
            } else {
                throw new Error('Token verification failed');
            }
        }
    }

    /**
     * Verify a refresh token
     */
    static verifyRefreshToken(token: string): { type: string } {
        try {
            return jwt.verify(token, JWT_REFRESH_SECRET) as { type: string };
        } catch (error) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new Error('Refresh token expired');
            } else if (error instanceof jwt.JsonWebTokenError) {
                throw new Error('Invalid refresh token');
            } else {
                throw new Error('Refresh token verification failed');
            }
        }
    }

    /**
     * Create token pair for a user
     */
    static async createTokenPair(
        userId: string,
        deviceFingerprint?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<TokenPair> {
        // Get user data for token payload
        const [user] = await db
            .select({
                id: users.id,
                email: users.email,
                role: users.role,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        // Generate tokens
        const accessToken = this.generateAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });

        const refreshToken = this.generateRefreshToken();

        // Store refresh token in database with hash
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
        const refreshTokenHash = hashToken(refreshToken);

        await db.insert(refreshTokens).values({
            userId: user.id,
            token: refreshToken, // Keep original token for response
            tokenHash: refreshTokenHash, // Store hash for verification
            deviceFingerprint,
            expiresAt,
            ipAddress,
            userAgent,
        });

        // Log token creation
        await this.createAuditLog({
            actorId: userId,
            action: 'TOKEN_REFRESH_CREATED',
            targetResource: 'refresh_token',
            metadata: {
                deviceFingerprint,
                ipAddress,
            },
            ipAddress,
            userAgent,
        });

        return {
            accessToken,
            refreshToken,
            expiresIn: 15 * 60, // 15 minutes in seconds
        };
    }

    /**
     * Refresh tokens using a refresh token
     */
    static async refreshTokens(
        refreshToken: string,
        deviceFingerprint?: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<TokenPair> {
        // Verify the refresh token
        try {
            this.verifyRefreshToken(refreshToken);
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }

        // Find the refresh token in database using hash verification
        const refreshTokenHash = hashToken(refreshToken);
        const [tokenRecord] = await db
            .select()
            .from(refreshTokens)
            .where(
                and(
                    eq(refreshTokens.tokenHash, refreshTokenHash),
                    eq(refreshTokens.isActive, true)
                )
            )
            .limit(1);

        if (!tokenRecord) {
            throw new Error('Refresh token not found or inactive');
        }

        // Check if token has expired
        if (tokenRecord.expiresAt < new Date()) {
            // Deactivate the expired token
            await db
                .update(refreshTokens)
                .set({ isActive: false })
                .where(eq(refreshTokens.id, tokenRecord.id));

            throw new Error('Refresh token expired');
        }

        // Deactivate the old refresh token
        await db
            .update(refreshTokens)
            .set({
                isActive: false,
                lastUsedAt: new Date(),
            })
            .where(eq(refreshTokens.id, tokenRecord.id));

        // Create new token pair
        const tokenPair = await this.createTokenPair(
            tokenRecord.userId,
            deviceFingerprint,
            ipAddress,
            userAgent
        );

        // Log refresh event
        await this.createAuditLog({
            actorId: tokenRecord.userId,
            action: 'TOKEN_REFRESHED',
            targetResource: 'refresh_token',
            metadata: {
                oldTokenId: tokenRecord.id,
                deviceFingerprint,
            },
            ipAddress,
            userAgent,
        });

        return tokenPair;
    }

    /**
     * Revoke a refresh token
     */
    static async revokeRefreshToken(token: string, userId?: string): Promise<void> {
        const tokenHash = hashToken(token);
        const query = db
            .update(refreshTokens)
            .set({ isActive: false })
            .where(eq(refreshTokens.tokenHash, tokenHash));

        if (userId) {
            query.where(and(
                eq(refreshTokens.tokenHash, tokenHash),
                eq(refreshTokens.userId, userId)
            ));
        }

        const result = await query;

        if (result.rowCount === 0) {
            throw new Error('Refresh token not found');
        }
    }

    /**
     * Revoke all refresh tokens for a user
     */
    static async revokeAllRefreshTokens(userId: string): Promise<void> {
        await db
            .update(refreshTokens)
            .set({ isActive: false })
            .where(eq(refreshTokens.userId, userId));
    }

    /**
     * Clean up expired refresh tokens
     */
    static async cleanupExpiredTokens(): Promise<void> {
        await db
            .delete(refreshTokens)
            .where(
                and(
                    eq(refreshTokens.isActive, false),
                    lt(refreshTokens.expiresAt, new Date())
                )
            );
    }

    /**
     * Create an audit log entry
     */
    private static async createAuditLog({
        actorId,
        action,
        targetResource,
        targetId,
        metadata,
        ipAddress,
        userAgent,
        success = true,
        errorMessage,
    }: {
        actorId?: string;
        action: string;
        targetResource?: string;
        targetId?: string;
        metadata?: Record<string, any>;
        ipAddress?: string;
        userAgent?: string;
        success?: boolean;
        errorMessage?: string;
    }): Promise<void> {
        await db.insert(auditLogs).values({
            actorId,
            action,
            targetId,
            targetResource,
            metadata: metadata || {},
            ipAddress,
            userAgent,
            success,
            errorMessage,
        });
    }
}