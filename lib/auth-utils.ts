import { jwtClient } from './jwt-client';
import { fcmClient } from './fcm-client';

/**
 * Utility functions for authentication workflow
 */
export class AuthUtils {
    /**
     * Complete login flow with FCM registration
     */
    static async completeLoginFlow(
        email: string,
        password: string,
        rememberMe: boolean = false
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Step 1: Login with JWT
            const loginResponse = await fetch('/api/auth/login', {
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

            if (!loginResponse.ok) {
                const errorData = await loginResponse.json();
                return {
                    success: false,
                    error: errorData.error || 'Login failed',
                };
            }

            const loginData = await loginResponse.json();

            // Step 2: Store JWT tokens
            if (loginData.tokenPair) {
                jwtClient.storeTokenPair(loginData.tokenPair);
            }

            // Step 3: Register FCM token for push notifications
            try {
                await fcmClient.registerAfterLogin();
            } catch (fcmError) {
                console.warn('FCM registration failed, but login succeeded:', fcmError);
                // Don't fail login if FCM registration fails
            }

            return { success: true };
        } catch (error) {
            console.error('Login flow error:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error occurred',
            };
        }
    }

    /**
     * Complete logout flow with cleanup
     */
    static async completeLogoutFlow(): Promise<void> {
        try {
            // Step 1: Unregister FCM token
            await fcmClient.unregisterOnLogout();
        } catch (fcmError) {
            console.warn('FCM unregistration failed:', fcmError);
            // Continue with logout even if FCM cleanup fails
        }

        try {
            // Step 2: Call server logout
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (logoutError) {
            console.warn('Server logout failed:', logoutError);
            // Continue with local cleanup even if server logout fails
        }

        // Step 3: Clear local tokens
        jwtClient.clearTokens();

        // Step 4: Trigger storage event for other tabs
        localStorage.setItem('auth_logout', Date.now().toString());
    }

    /**
     * Handle token refresh with FCM re-registration if needed
     */
    static async handleTokenRefresh(): Promise<boolean> {
        try {
            const tokenPair = await jwtClient.refreshAccessToken();

            if (tokenPair) {
                // Token refreshed successfully
                return true;
            }

            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);
            return false;
        }
    }

    /**
     * Check authentication status with server validation
     */
    static async checkAuthStatus(): Promise<{
        isAuthenticated: boolean;
        user?: any;
        requiresRefresh?: boolean;
    }> {
        try {
            const token = jwtClient.getAccessToken();
            if (!token) {
                return { isAuthenticated: false };
            }

            // Check if token is expired
            if (jwtClient.isTokenExpired(token)) {
                // Try to refresh
                const refreshed = await this.handleTokenRefresh();
                if (refreshed) {
                    const user = jwtClient.getCurrentUser();
                    return {
                        isAuthenticated: !!user,
                        user,
                        requiresRefresh: true,
                    };
                }

                return { isAuthenticated: false };
            }

            // Token is valid, get user info
            const user = jwtClient.getCurrentUser();
            return {
                isAuthenticated: !!user,
                user,
            };
        } catch (error) {
            console.error('Auth status check failed:', error);
            return { isAuthenticated: false };
        }
    }

    /**
     * Setup automatic token refresh
     */
    static setupAutoRefresh(): void {
        // Check token every 5 minutes
        setInterval(async () => {
            const token = jwtClient.getAccessToken();
            if (token && jwtClient.isTokenExpired(token, 300)) { // 5 minutes buffer
                console.log('Token expiring soon, attempting refresh...');
                await this.handleTokenRefresh();
            }
        }, 60000); // Check every minute

        // Listen for visibility changes to refresh when tab becomes active
        document.addEventListener('visibilitychange', async () => {
            if (!document.hidden) {
                const token = jwtClient.getAccessToken();
                if (token && jwtClient.isTokenExpired(token)) {
                    console.log('Tab became active with expired token, refreshing...');
                    await this.handleTokenRefresh();
                }
            }
        });

        // Listen for storage events from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key === 'auth_logout') {
                // Another tab logged out, clear local state
                jwtClient.clearTokens();
                window.location.reload();
            } else if (e.key === 'auth_login') {
                // Another tab logged in, refresh state
                window.location.reload();
            }
        });
    }

    /**
     * Initialize authentication system
     */
    static async initializeAuth(): Promise<void> {
        try {
            // Check current auth status
            const authStatus = await this.checkAuthStatus();

            if (authStatus.isAuthenticated) {
                console.log('User is authenticated');

                // Initialize FCM if authenticated
                try {
                    await fcmClient.initialize();
                } catch (fcmError) {
                    console.warn('FCM initialization failed:', fcmError);
                }
            } else {
                console.log('User is not authenticated');
            }

            // Setup automatic refresh
            this.setupAutoRefresh();
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    }

    /**
     * Fetch with automatic token handling
     */
    static async fetchWithAuth(
        url: string,
        options: RequestInit = {}
    ): Promise<Response> {
        try {
            return await jwtClient.fetchWithAuth(url, options);
        } catch (error) {
            console.error('Authenticated fetch failed:', error);
            throw error;
        }
    }

    /**
     * Get current user with fallback
     */
    static getCurrentUser(): {
        id: string;
        email: string;
        role: string;
    } | null {
        return jwtClient.getCurrentUser();
    }

    /**
     * Check if user has specific role
     */
    static hasRole(role: string): boolean {
        const user = this.getCurrentUser();
        return user?.role === role;
    }

    /**
     * Check if user is admin
     */
    static isAdmin(): boolean {
        return this.hasRole('ADMIN');
    }

    /**
     * Check if user is authenticated
     */
    static isAuthenticated(): boolean {
        return jwtClient.isAuthenticated();
    }
}

// Export convenience functions
export const {
    completeLoginFlow,
    completeLogoutFlow,
    handleTokenRefresh,
    checkAuthStatus,
    setupAutoRefresh,
    initializeAuth,
    fetchWithAuth,
    getCurrentUser,
    hasRole,
    isAdmin,
    isAuthenticated,
} = AuthUtils;