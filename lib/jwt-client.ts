import { JWTPayload } from './auth/jwt';

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

export class JWTClientManager {
    private static instance: JWTClientManager;
    private refreshPromise: Promise<TokenPair> | null = null;
    private isRefreshing = false;

    static getInstance(): JWTClientManager {
        if (!JWTClientManager.instance) {
            JWTClientManager.instance = new JWTClientManager();
        }
        return JWTClientManager.instance;
    }

    /**
     * Store token pair in cookies
     */
    static storeTokenPair(tokenPair: TokenPair): void {
        if (typeof window === 'undefined') return;

        const isSecure = process.env.NODE_ENV === 'production';
        const sameSite = isSecure ? 'strict' : 'lax';

        // Store access token (accessible to JavaScript for API calls)
        document.cookie = `access_token=${tokenPair.accessToken}; max-age=${tokenPair.expiresIn}; path=/; sameSite=${sameSite}; ${isSecure ? 'secure;' : ''}`;

        // Store refresh token (HttpOnly, handled by server)
        // Note: HttpOnly cookies can only be set by the server
        // The server should set this cookie in the login/refresh response
    }

    /**
     * Get access token from cookies or storage
     */
    static getAccessToken(): string | null {
        if (typeof window === 'undefined') return null;

        // Try cookie first
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'access_token') {
                return value || null;
            }
        }

        return null;
    }

    /**
     * Get refresh token from cookies
     */
    static getRefreshToken(): string | null {
        if (typeof window === 'undefined') return null;

        // Note: Refresh tokens should be HttpOnly, so we can't access them via JavaScript
        // This method is provided for completeness but should return null in most cases
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'refresh_token') {
                return value || null;
            }
        }

        return null;
    }

    /**
     * Clear all auth cookies
     */
    static clearTokens(): void {
        if (typeof window === 'undefined') return;

        const cookies = ['access_token', 'refresh_token'];
        const isSecure = process.env.NODE_ENV === 'production';
        const sameSite = isSecure ? 'strict' : 'lax';

        cookies.forEach(name => {
            document.cookie = `${name}=; max-age=0; path=/; sameSite=${sameSite}; ${isSecure ? 'secure;' : ''}`;
        });
    }

    /**
     * Decode JWT payload (without verification - for UI purposes only)
     */
    static decodeToken(token: string): JWTPayload | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            const payload = JSON.parse(atob(parts[1]));

            // Check if token is expired
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                return null;
            }

            return payload as JWTPayload;
        } catch {
            return null;
        }
    }

    /**
     * Check if access token is expired or will expire soon
     */
    static isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
        const payload = this.decodeToken(token);
        if (!payload || !payload.exp) return true;

        return payload.exp <= Math.floor(Date.now() / 1000) + bufferSeconds;
    }

    /**
     * Get current user from token
     */
    static getCurrentUser(): { id: string; email: string; role: string } | null {
        const token = this.getAccessToken();
        if (!token) return null;

        const payload = this.decodeToken(token);
        if (!payload) return null;

        return {
            id: payload.userId,
            email: payload.email,
            role: payload.role,
        };
    }

    /**
     * Check if user is authenticated
     */
    static isAuthenticated(): boolean {
        const token = this.getAccessToken();
        if (!token) return false;

        const payload = this.decodeToken(token);
        if (!payload) return false;

        return !this.isTokenExpired(token);
    }

    /**
     * Check if user has admin role
     */
    static isAdmin(): boolean {
        const user = this.getCurrentUser();
        return user?.role === 'ADMIN';
    }

    /**
     * Refresh access token automatically
     */
    async refreshAccessToken(): Promise<TokenPair | null> {
        // Prevent multiple concurrent refresh attempts
        if (this.isRefreshing && this.refreshPromise) {
            return this.refreshPromise;
        }

        this.isRefreshing = true;
        this.refreshPromise = this.performTokenRefresh();

        try {
            const result = await this.refreshPromise;
            return result;
        } finally {
            this.isRefreshing = false;
            this.refreshPromise = null;
        }
    }

    /**
     * Perform the actual token refresh
     */
    private async performTokenRefresh(): Promise<TokenPair | null> {
        try {
            const response = await fetch('/api/auth/refresh', {
                method: 'POST',
                credentials: 'include', // Important: include cookies for HttpOnly refresh token
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                // If refresh fails, tokens might be invalid
                this.clearTokens();
                return null;
            }

            const data = await response.json();

            if (data.tokenPair) {
                // Store new tokens (server will also set HttpOnly cookies)
                this.storeTokenPair(data.tokenPair);
                return data.tokenPair;
            }

            return null;
        } catch (error) {
            console.error('Token refresh failed:', error);
            this.clearTokens();
            return null;
        }
    }

    /**
     * Get valid access token, refreshing if necessary
     */
    async getValidAccessToken(): Promise<string | null> {
        const currentToken = this.getAccessToken();

        if (!currentToken) {
            return null;
        }

        // If token is still valid, return it
        if (!this.isTokenExpired(currentToken)) {
            return currentToken;
        }

        // Token is expired or will expire soon, try to refresh
        const newTokenPair = await this.refreshAccessToken();
        return newTokenPair?.accessToken || null;
    }

    /**
     * Fetch with automatic token refresh
     */
    async fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
        // Get valid token (refresh if necessary)
        const token = await this.getValidAccessToken();

        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            (headers as any)['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers,
            credentials: 'include', // Include cookies for refresh token
        });

        // If we get a 401 (unauthorized), try to refresh once more
        if (response.status === 401 && token) {
            const newToken = await this.refreshAccessToken();

            if (newToken?.accessToken) {
                // Retry the request with new token
                (headers as any)['Authorization'] = `Bearer ${newToken.accessToken}`;
                return fetch(url, {
                    ...options,
                    headers,
                    credentials: 'include',
                });
            }
        }

        return response;
    }
}

// Export singleton instance
export const jwtClient = JWTClientManager.getInstance();

// Export utility functions for convenience
export const {
    storeTokenPair,
    getAccessToken,
    getRefreshToken,
    clearTokens,
    decodeToken,
    isTokenExpired,
    getCurrentUser,
    isAuthenticated,
    isAdmin,
    fetchWithAuth,
} = JWTClientManager;