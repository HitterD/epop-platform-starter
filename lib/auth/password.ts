import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, auditLogs } from '@/db/schema';

// Configuration for password hashing
const SALT_ROUNDS = 12;

export class PasswordService {
    /**
     * Hash a password using bcrypt
     */
    static async hashPassword(password: string): Promise<string> {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }

        if (password.length > 128) {
            throw new Error('Password must be less than 128 characters long');
        }

        return new Promise((resolve, reject) => {
            // Generate salt and hash
            const salt = crypto.randomBytes(16).toString('hex');
            crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
                if (err) reject(err);
                // Store as salt:hash:iterations format
                resolve(`${salt}:${derivedKey.toString('hex')}:100000`);
            });
        });
    }

    /**
     * Verify a password against its hash
     */
    static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
        if (!password || !storedHash) {
            return false;
        }

        try {
            const [salt, hash, iterations] = storedHash.split(':');
            const iterCount = parseInt(iterations, 10);

            return new Promise((resolve, reject) => {
                crypto.pbkdf2(password, salt, iterCount, 64, 'sha512', (err, derivedKey) => {
                    if (err) reject(err);
                    resolve(derivedKey.toString('hex') === hash);
                });
            });
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if a user is locked out due to too many failed login attempts
     */
    static async isUserLocked(userId: string): Promise<boolean> {
        const [user] = await db
            .select({
                lockedUntil: users.lockedUntil,
                failedLoginAttempts: users.failedLoginAttempts,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return false;
        }

        // Check if user is currently locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            return true;
        }

        // Check if user has exceeded maximum failed attempts
        return user.failedLoginAttempts >= 5;
    }

    /**
     * Record a failed login attempt
     */
    static async recordFailedLogin(
        userId: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        const [user] = await db
            .select({
                failedLoginAttempts: users.failedLoginAttempts,
                lockedUntil: users.lockedUntil,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return;
        }

        const newFailedAttempts = (user.failedLoginAttempts || 0) + 1;
        let lockedUntil: Date | undefined;

        // Lock the account after 5 failed attempts for 30 minutes
        if (newFailedAttempts >= 5) {
            lockedUntil = new Date();
            lockedUntil.setMinutes(lockedUntil.getMinutes() + 30);
        }

        await db
            .update(users)
            .set({
                failedLoginAttempts: newFailedAttempts,
                lockedUntil,
            })
            .where(eq(users.id, userId));

        // Log the failed attempt
        await db.insert(auditLogs).values({
            actorId: userId,
            action: 'LOGIN_FAILED',
            targetResource: 'user',
            metadata: {
                failedAttempts: newFailedAttempts,
                accountLocked: !!lockedUntil,
                lockedUntil: lockedUntil?.toISOString(),
            },
            ipAddress,
            userAgent,
            success: false,
            errorMessage: `Failed login attempt ${newFailedAttempts}`,
        });
    }

    /**
     * Reset failed login attempts after successful login
     */
    static async resetFailedLoginAttempts(
        userId: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        await db
            .update(users)
            .set({
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
            })
            .where(eq(users.id, userId));

        // Log successful login
        await db.insert(auditLogs).values({
            actorId: userId,
            action: 'LOGIN_SUCCESS',
            targetResource: 'user',
            metadata: {},
            ipAddress,
            userAgent,
            success: true,
        });
    }

    /**
     * Change user password
     */
    static async changePassword(
        userId: string,
        currentPassword: string,
        newPassword: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        // Get current user with password hash
        const [user] = await db
            .select({
                passwordHash: users.passwordHash,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isCurrentPasswordValid = await this.verifyPassword(
            currentPassword,
            user.passwordHash
        );

        if (!isCurrentPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Hash new password
        const newPasswordHash = await this.hashPassword(newPassword);

        // Update password
        await db
            .update(users)
            .set({
                passwordHash: newPasswordHash,
                updatedAt: new Date(),
            })
            .where(eq(users.id, userId));

        // Log password change
        await db.insert(auditLogs).values({
            actorId: userId,
            action: 'PASSWORD_CHANGED',
            targetResource: 'user',
            metadata: {},
            ipAddress,
            userAgent,
            success: true,
        });

        // Revoke all refresh tokens to force re-login
        const { refreshTokens } = await import('./jwt');
        await refreshTokens.revokeAllRefreshTokens(userId);
    }

    /**
     * Reset password using reset token
     */
    static async resetPassword(
        resetToken: string,
        newPassword: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<void> {
        // Find user with valid reset token
        const [user] = await db
            .select({
                id: users.id,
                passwordResetToken: users.passwordResetToken,
                passwordResetExpires: users.passwordResetExpires,
            })
            .from(users)
            .where(
                eq(users.passwordResetToken, resetToken)
            )
            .limit(1);

        if (!user) {
            throw new Error('Invalid or expired reset token');
        }

        // Check if token has expired
        if (!user.passwordResetExpires || user.passwordResetExpires < new Date()) {
            throw new Error('Reset token has expired');
        }

        // Hash new password
        const newPasswordHash = await this.hashPassword(newPassword);

        // Update password and clear reset token
        await db
            .update(users)
            .set({
                passwordHash: newPasswordHash,
                passwordResetToken: null,
                passwordResetExpires: null,
                failedLoginAttempts: 0,
                lockedUntil: null,
                updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

        // Log password reset
        await db.insert(auditLogs).values({
            actorId: user.id,
            action: 'PASSWORD_RESET',
            targetResource: 'user',
            metadata: {},
            ipAddress,
            userAgent,
            success: true,
        });

        // Revoke all refresh tokens to force re-login
        const { JWTService } = await import('./jwt');
        await JWTService.revokeAllRefreshTokens(user.id);
    }

    /**
     * Generate password reset token
     */
    static async generatePasswordResetToken(email: string): Promise<string> {
        const [user] = await db
            .select({
                id: users.id,
                email: users.email,
            })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

        if (!user) {
            throw new Error('User with this email does not exist');
        }

        // Generate random token
        const token = Buffer.from(crypto.randomUUID()).toString('base64');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

        // Update user with reset token
        await db
            .update(users)
            .set({
                passwordResetToken: token,
                passwordResetExpires: expiresAt,
                updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

        // Log token generation
        await db.insert(auditLogs).values({
            actorId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            targetResource: 'user',
            metadata: {
                email: user.email,
            },
            success: true,
        });

        return token;
    }

    /**
     * Validate password strength
     */
    static validatePasswordStrength(password: string): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (password.length > 128) {
            errors.push('Password must be less than 128 characters long');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }

        // Check for common passwords
        const commonPasswords = [
            'password',
            '123456',
            'qwerty',
            'admin',
            'letmein',
            'welcome',
            'monkey',
            '123456789',
            'password123',
            'admin123',
        ];

        if (commonPasswords.includes(password.toLowerCase())) {
            errors.push('Password is too common. Please choose a stronger password');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}