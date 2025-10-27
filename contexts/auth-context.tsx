'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useJWTAuth } from '@/hooks/use-jwt-auth';
import { authClient } from '@/lib/auth-client';

interface AuthContextType {
    // JWT Auth state
    user: {
        id: string;
        email: string;
        role: string;
        name?: string;
        avatarUrl?: string;
    } | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;

    // JWT Auth methods
    login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshTokens: () => Promise<boolean>;
    updateProfile: (data: any) => Promise<void>;

    // Better Auth methods (for compatibility)
    signIn: typeof authClient.signIn;
    signUp: typeof authClient.signUp;
    signOut: typeof authClient.signOut;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const jwtAuth = useJWTAuth();
    const [session, setSession] = useState<any>(null);
    const [betterAuthLoading, setBetterAuthLoading] = useState(true);

    // Load Better Auth session
    useEffect(() => {
        const loadSession = async () => {
            try {
                const sessionData = await authClient.getSession();
                setSession(sessionData);
            } catch (error) {
                console.error('Failed to load Better Auth session:', error);
            } finally {
                setBetterAuthLoading(false);
            }
        };

        loadSession();
    }, []);

    // Combine user data from both systems
    const combinedUser = React.useMemo(() => {
        if (jwtAuth.user) {
            // Prefer JWT user data, but merge any Better Auth data
            return {
                id: jwtAuth.user.id,
                email: jwtAuth.user.email,
                role: jwtAuth.user.role,
                ...(session?.user && {
                    name: session.user.name,
                    avatarUrl: session.user.image,
                }),
            };
        }

        if (session?.user) {
            // Fallback to Better Auth user data
            return {
                id: session.user.id,
                email: session.user.email,
                role: session.user.role || 'USER',
                name: session.user.name,
                avatarUrl: session.user.image,
            };
        }

        return null;
    }, [jwtAuth.user, session?.user]);

    const isLoading = jwtAuth.isLoading || betterAuthLoading;
    const isAuthenticated = !!combinedUser;
    const isAdmin = combinedUser?.role === 'ADMIN';

    // Enhanced login that handles both systems
    const login = async (email: string, password: string, rememberMe?: boolean) => {
        try {
            // Try JWT login first
            const jwtResult = await jwtAuth.login(email, password, rememberMe);

            if (jwtResult.success) {
                // Optionally also sign in with Better Auth for session consistency
                try {
                    await authClient.signIn.email({
                        email,
                        password,
                    });
                } catch (betterAuthError) {
                    console.warn('Better Auth sign-in failed, but JWT login succeeded:', betterAuthError);
                }

                return { success: true };
            }

            return jwtResult;
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Login failed',
            };
        }
    };

    // Enhanced logout that handles both systems
    const logout = async () => {
        try {
            // Logout from JWT
            await jwtAuth.logout();

            // Logout from Better Auth
            try {
                await authClient.signOut();
            } catch (betterAuthError) {
                console.warn('Better Auth sign-out failed:', betterAuthError);
            }

            setSession(null);
        } catch (error) {
            console.error('Logout error:', error);
            throw error;
        }
    };

    const value: AuthContextType = {
        // Auth state
        user: combinedUser,
        isLoading,
        isAuthenticated,
        isAdmin,

        // JWT methods
        login,
        logout,
        refreshTokens: jwtAuth.refreshTokens,
        updateProfile: jwtAuth.updateProfile,

        // Better Auth methods (for compatibility with existing components)
        signIn: authClient.signIn,
        signUp: authClient.signUp,
        signOut: authClient.signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

// Hook to protect routes that require authentication
export function useRequireAuth() {
    const auth = useAuth();

    useEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated) {
            // Redirect to login page
            window.location.href = '/auth/login';
        }
    }, [auth.isLoading, auth.isAuthenticated]);

    return auth;
}

// Hook to protect routes that require admin role
export function useRequireAdmin() {
    const auth = useAuth();

    useEffect(() => {
        if (!auth.isLoading) {
            if (!auth.isAuthenticated) {
                window.location.href = '/auth/login';
            } else if (!auth.isAdmin) {
                window.location.href = '/'; // or /unauthorized
            }
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.isAdmin]);

    return auth;
}