import { useState, useEffect, useCallback } from 'react';
import { jwtClient, TokenPair } from '@/lib/jwt-client';

export interface User {
    id: string;
    email: string;
    role: string;
}

export interface UseJWTAuthReturn {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isAdmin: boolean;
    login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    refreshTokens: () => Promise<boolean>;
    updateProfile: (data: Partial<User>) => Promise<void>;
}

export function useJWTAuth(): UseJWTAuthReturn {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Check authentication status on mount
    useEffect(() => {
        const checkAuth = () => {
            try {
                const currentUser = jwtClient.getCurrentUser();
                const isAuthenticated = jwtClient.isAuthenticated();

                if (isAuthenticated && currentUser) {
                    setUser(currentUser);
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();

        // Listen for storage events (for cross-tab synchronization)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'auth_event') {
                checkAuth();
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Login function
    const login = useCallback(async (
        email: string,
        password: string,
        rememberMe: boolean = false
    ): Promise<{ success: boolean; error?: string }> => {
        try {
            setIsLoading(true);

            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    email: email.toLowerCase().trim(),
                    password,
                    rememberMe,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                return {
                    success: false,
                    error: data.error || 'Login failed',
                };
            }

            if (data.tokenPair) {
                jwtClient.storeTokenPair(data.tokenPair);

                if (data.user) {
                    setUser(data.user);
                }

                // Trigger storage event for other tabs
                localStorage.setItem('auth_event', Date.now().toString());

                return { success: true };
            }

            return {
                success: false,
                error: 'Invalid response from server',
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: 'Network error occurred',
            };
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Logout function
    const logout = useCallback(async (): Promise<void> => {
        try {
            // Call server logout endpoint
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local tokens regardless of server response
            jwtClient.clearTokens();
            setUser(null);

            // Trigger storage event for other tabs
            localStorage.setItem('auth_event', Date.now().toString());
        }
    }, []);

    // Refresh tokens function
    const refreshTokens = useCallback(async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            const tokenPair = await jwtClient.refreshAccessToken();

            if (tokenPair) {
                // Trigger storage event for other tabs
                localStorage.setItem('auth_event', Date.now().toString());
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Update profile function
    const updateProfile = useCallback(async (data: Partial<User>): Promise<void> => {
        if (!user) return;

        try {
            const response = await jwtClient.fetchWithAuth('/api/user/profile', {
                method: 'PUT',
                body: JSON.stringify(data),
            });

            if (response.ok) {
                const updatedUser = await response.json();
                setUser(updatedUser);

                // Trigger storage event for other tabs
                localStorage.setItem('auth_event', Date.now().toString());
            }
        } catch (error) {
            console.error('Profile update error:', error);
            throw error;
        }
    }, [user]);

    return {
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'ADMIN',
        login,
        logout,
        refreshTokens,
        updateProfile,
    };
}

// Hook for protecting components
export function useRequireAuth(): UseJWTAuthReturn {
    const auth = useJWTAuth();

    useEffect(() => {
        if (!auth.isLoading && !auth.isAuthenticated) {
            // Redirect to login or throw an error
            window.location.href = '/auth/login';
        }
    }, [auth.isLoading, auth.isAuthenticated]);

    return auth;
}

// Hook for admin-only components
export function useRequireAdmin(): UseJWTAuthReturn {
    const auth = useJWTAuth();

    useEffect(() => {
        if (!auth.isLoading && (!auth.isAuthenticated || !auth.isAdmin)) {
            // Redirect to login or home page
            window.location.href = auth.isAuthenticated ? '/' : '/auth/login';
        }
    }, [auth.isLoading, auth.isAuthenticated, auth.isAdmin]);

    return auth;
}